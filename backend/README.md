# ChatManager — Backend

API que recebe mensagens do WhatsApp (via Webhook da Meta Cloud API),
transmite em tempo real por Socket.io e permite responder pacientes. Contexto
de produto e arquitetura completa: [`../README.md`](../README.md) e
[`../CLAUDE.md`](../CLAUDE.md).

## Rodando localmente

```bash
npm install
cp .env.example .env    # preencher com os valores do seu app na Meta for Developers
npm run dev              # http://localhost:3001
```

Todos os exemplos abaixo assumem o servidor rodando em `http://localhost:3001`.
A forma mais rápida de testar é pelo **Swagger UI** em
[`http://localhost:3001/docs`](http://localhost:3001/docs) — cada rota já
vem com exemplo de payload preenchido, é só clicar em "Try it out". Os
comandos `curl` abaixo são a alternativa para quem prefere terminal/scripts.

---

## Resumo das rotas

| Método | Rota | O que faz |
|---|---|---|
| `GET` | `/` | Redireciona para `/docs` |
| `GET` | `/health` | Health check (anti cold-start do Render) |
| `GET` | `/docs` | Swagger UI |
| `GET` | `/docs.json` | Spec OpenAPI cru (JSON) |
| `GET` | `/webhook` | Verificação do webhook pela Meta (`hub.challenge`) |
| `POST` | `/webhook` | Recebimento de mensagens/eventos da Meta |
| `GET` | `/conversations` | Lista conversas agrupadas por contato |
| `GET` | `/messages` | Lista mensagens recebidas (com filtro opcional) |
| `POST` | `/messages` | Envia mensagem de texto livre |
| `POST` | `/messages/template` | Envia mensagem de template aprovado |

---

## Util

### `GET /health`
Health check simples, usado para "acordar" o servidor no plano gratuito do
Render antes de outras operações (evita cold start na primeira chamada real).

**Testar:**
```bash
curl http://localhost:3001/health
```
**Resposta:**
```json
{ "status": "ok", "uptime": 123.45 }
```

### `GET /docs` e `GET /docs.json`
`/docs` serve a interface do Swagger UI (documentação interativa de todas as
rotas). `/docs.json` retorna a spec OpenAPI 3.0 crua, útil para importar em
Postman/Insomnia.

**Testar:** abrir [`http://localhost:3001/docs`](http://localhost:3001/docs)
no navegador.

---

## Webhook Meta

Rotas consumidas **pela própria Meta**, não pelo frontend. Implementação em
[`src/routes/webhook.js`](src/routes/webhook.js) — detalhes de cada regra em
[`../docs/META_CLOUD_API_RULES.md`](../docs/META_CLOUD_API_RULES.md#3-webhooks--verificação-e-recebimento).

### `GET /webhook`
Chamada pela Meta ao cadastrar a URL do webhook no painel (Meta for
Developers > WhatsApp > Configuração). Compara `hub.verify_token` com
`META_VERIFY_TOKEN` do `.env`; se bater, devolve `hub.challenge` em texto
puro (200). Caso contrário, `403`.

**Testar (simulando a Meta):**
```bash
curl "http://localhost:3001/webhook?hub.mode=subscribe&hub.verify_token=SEU_META_VERIFY_TOKEN&hub.challenge=teste123"
# → 200, corpo: teste123
```
Na prática, você não chama isso manualmente — é a Meta quem chama, uma única
vez, ao salvar a configuração do webhook no painel dela.

### `POST /webhook`
Chamada pela Meta a cada evento: mensagem nova, recibo de entrega/leitura,
etc. Fluxo:
1. Valida a assinatura `X-Hub-Signature-256` (HMAC-SHA256 com `META_APP_SECRET`) — payload sem assinatura válida é rejeitado com **403**.
2. Responde **200** imediatamente (exigência da Meta).
3. Extrai as mensagens (`value.messages`; eventos de status são ignorados), salva em memória e emite `new-message` via Socket.io para quem estiver conectado.

**Testar sem `META_APP_SECRET` configurado** (validação de assinatura é
pulada — só para dev local):
```bash
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "123456789",
      "changes": [{
        "field": "messages",
        "value": {
          "messaging_product": "whatsapp",
          "metadata": { "display_phone_number": "5511987654321", "phone_number_id": "999888777" },
          "contacts": [{ "wa_id": "5511999998888", "profile": { "name": "Maria Silva" } }],
          "messages": [{
            "id": "wamid.TESTE123",
            "from": "5511999998888",
            "timestamp": "1786838400",
            "type": "text",
            "text": { "body": "Olá, gostaria de agendar uma fisioterapia" }
          }]
        }
      }]
    }]
  }'
```
Depois, confira em `GET /messages` que a mensagem apareceu.

**Testar com `META_APP_SECRET` configurado** (assinatura obrigatória — igual
produção): é preciso calcular o HMAC-SHA256 do corpo com o secret e mandar no
header `X-Hub-Signature-256: sha256=<hash>`. Exemplo em Node:
```bash
BODY='{"object":"whatsapp_business_account","entry":[]}'
SIG=$(node -e "console.log(require('crypto').createHmac('sha256', process.env.META_APP_SECRET).update(process.argv[1]).digest('hex'))" "$BODY")

curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$SIG" \
  -d "$BODY"
```
Sem essa assinatura (ou com ela errada), a resposta é `403`.

> **Teste ponta a ponta de verdade:** exponha o servidor local com uma
> ferramenta de túnel (ex.: `ngrok http 3001`), cadastre a URL pública como
> webhook no painel da Meta, e mande uma mensagem real do seu WhatsApp para o
> número de teste. Ela deve aparecer em `GET /messages` e disparar o evento
> `new-message` no Socket.io.

---

## Chat (teste sem frontend)

Rotas para usar o sistema de ponta a ponta **sem precisar do frontend**
(que ainda não existe). Implementação em
[`src/routes/chat.js`](src/routes/chat.js).

### `GET /conversations`
Agrupa as mensagens recebidas por contato (`wa_id`), ordenadas da mais
recente para a mais antiga. Use o `waId` retornado aqui como `to` nas rotas
de envio. Dados em memória — somem a cada restart.

**Testar:**
```bash
curl http://localhost:3001/conversations
```
**Resposta:**
```json
[
  {
    "waId": "5511999998888",
    "name": "Maria Silva",
    "messageCount": 3,
    "lastMessage": "Olá, gostaria de agendar uma fisioterapia",
    "lastTimestamp": 1786838400
  }
]
```

### `GET /messages`
Lista as mensagens recebidas (DTO `{ id, from, name, text, timestamp }`).
Aceita `?from=` para filtrar por um contato específico.

**Testar:**
```bash
curl http://localhost:3001/messages
curl "http://localhost:3001/messages?from=5511999998888"
```

### `POST /messages`
Envia **texto livre** para um contato via Cloud API, usando
`META_ACCESS_TOKEN` e `META_PHONE_NUMBER_ID` do ambiente. Só funciona
**dentro da janela de 24h** após a última mensagem do cliente — fora dela, a
Meta recusa e você precisa usar `/messages/template`.

**Testar:**
```bash
curl -X POST http://localhost:3001/messages \
  -H "Content-Type: application/json" \
  -d '{ "to": "5511999998888", "text": "Oi, tudo bom?" }'
```
**Respostas possíveis:**
| Status | Quando |
|---|---|
| `200` | Aceito pela Meta — corpo traz o `wamid` (id da mensagem) |
| `400` | Faltou `to` ou `text` no corpo |
| `500` | `META_ACCESS_TOKEN`/`META_PHONE_NUMBER_ID` não configurados no `.env` |
| `502` | A Meta recusou o envio (ex.: fora da janela de 24h) — detalhes no campo `details` da resposta |

### `POST /messages/template`
Envia um **template aprovado** no painel da Meta (ex.: `hello_world`, que
todo app de teste já tem). É a única forma de **iniciar** uma conversa fora
da janela de 24h. `languageCode` precisa bater com o idioma configurado para
aquele template. Se o template tiver variáveis, preencha via `components`
(formato oficial da Cloud API — ver
[`../docs/META_CLOUD_API_RULES.md`](../docs/META_CLOUD_API_RULES.md#104-payload-de-envio-com-variáveis)).

**Testar (template simples, sem variáveis):**
```bash
curl -X POST http://localhost:3001/messages/template \
  -H "Content-Type: application/json" \
  -d '{ "to": "5511999998888", "templateName": "hello_world", "languageCode": "en_US" }'
```

**Testar (template com variáveis no body):**
```bash
curl -X POST http://localhost:3001/messages/template \
  -H "Content-Type: application/json" \
  -d '{
    "to": "5511999998888",
    "templateName": "confirmacao_consulta",
    "languageCode": "pt_BR",
    "components": [
      { "type": "body", "parameters": [
          { "type": "text", "text": "Maria" },
          { "type": "text", "text": "18/08 às 14h" }
        ] }
    ]
  }'
```
Mesmos códigos de resposta de `POST /messages` (`400`/`500`/`502`).

---

## Testando o fluxo completo (sem frontend)

1. `npm run dev` para subir o servidor.
2. Simule uma mensagem recebida com o `curl` de `POST /webhook` acima (ou,
   com túnel + webhook real cadastrado na Meta, mande do seu WhatsApp).
3. Confira em `GET /conversations` e `GET /messages` que ela chegou.
4. Responda com `POST /messages` (se estiver dentro da janela de 24h) ou
   `POST /messages/template` (fora dela).
5. Para ver o tempo real funcionando, conecte um cliente Socket.io (ou o
   painel do [Socket.IO Admin UI](https://socket.io/docs/v4/admin-ui/)) e
   escute o evento `new-message` enquanto repete o passo 2.
