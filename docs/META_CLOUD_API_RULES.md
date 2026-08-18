# WhatsApp Cloud API — Referência Completa (Meta)

Documento de referência **completo** sobre a WhatsApp Cloud API (Graph API da
Meta), cobrindo tanto o que já está implementado no ChatManager quanto o que
ainda não foi construído — para facilitar os próximos passos (envio de
mídia, mensagens interativas, templates com variáveis, etc.).

Sempre que houver dúvida ou o comportamento da API mudar, a documentação
oficial é a fonte de verdade:

- Guia geral / setup: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
- Envio de mensagens: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
- Templates: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
- Webhooks: https://developers.facebook.com/docs/graph-api/webhooks/getting-started
- Segurança de webhooks: https://developers.facebook.com/docs/messenger-platform/webhooks#security
- Precificação: https://developers.facebook.com/docs/whatsapp/pricing
- Limites de mensagens: https://developers.facebook.com/docs/whatsapp/messaging-limits
- Referência de mídia: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media
- Códigos de erro: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes

> **Legenda:** cada seção indica **✅ Implementado** (com o arquivo do
> projeto) ou **⏳ Não implementado** (referência para o futuro).

---

## Sumário

1. [Setup inicial (App, WABA, número, tokens)](#1-setup-inicial-app-waba-número-tokens)
2. [Autenticação e tokens de acesso](#2-autenticação-e-tokens-de-acesso)
3. [Webhooks — verificação e recebimento](#3-webhooks--verificação-e-recebimento)
4. [Validação de assinatura (X-Hub-Signature-256)](#4-validação-de-assinatura-x-hub-signature-256)
5. [Estrutura do payload recebido (mensagens e status)](#5-estrutura-do-payload-recebido-mensagens-e-status)
6. [Envio de mensagem de texto](#6-envio-de-mensagem-de-texto)
7. [Envio de mídia (imagem, vídeo, áudio, documento, sticker)](#7-envio-de-mídia-imagem-vídeo-áudio-documento-sticker)
8. [Localização, contatos e reações](#8-localização-contatos-e-reações)
9. [Mensagens interativas (botões e listas)](#9-mensagens-interativas-botões-e-listas)
10. [Templates de mensagem](#10-templates-de-mensagem)
11. [Janela de atendimento (24h) e regra texto livre × template](#11-janela-de-atendimento-24h-e-regra-texto-livre--template)
12. [Precificação (modelo atual, pós-julho/2025)](#12-precificação-modelo-atual-pós-julho2025)
13. [Limites de mensagens e quality rating](#13-limites-de-mensagens-e-quality-rating)
14. [Rate limits de requisição e throughput](#14-rate-limits-de-requisição-e-throughput)
15. [Códigos de erro comuns](#15-códigos-de-erro-comuns)
16. [Boas práticas e políticas de opt-in](#16-boas-práticas-e-políticas-de-opt-in)
17. [Status atual do projeto x próximos passos](#17-status-atual-do-projeto-x-próximos-passos)

---

## 1. Setup inicial (App, WABA, número, tokens)

Passos para configurar a Cloud API do zero no [Meta App Dashboard](https://developers.facebook.com/apps):

1. **Criar o App:** selecione o caso de uso "Connect with customers through
   WhatsApp" (produto WhatsApp).
2. **Conectar/criar a WhatsApp Business Account (WABA):** o painel gera um
   **WABA ID** — guardar, é usado em algumas chamadas de gerenciamento
   (templates, qualidade do número, etc.).
3. **Número de telefone de teste:** a Meta fornece um número de teste
   gratuito com o **Phone Number ID** correspondente — é o valor usado em
   `META_PHONE_NUMBER_ID`. Números de teste só enviam para até 5 destinatários
   pré-cadastrados na aba "To" do painel.
4. **Token de acesso temporário:** gerado direto no painel, válido por
   **24h** — ótimo para testar rápido, mas expira.
5. **Token permanente (produção):** criar um **System User** em
   [Business Settings](https://business.facebook.com/latest/settings),
   atribuir permissão total sobre o App e a WABA, e gerar um token sem
   expiração (`whatsapp_business_messaging` + `whatsapp_business_management`).
6. **Migrar para número real:** trocar o número de teste por um número real
   da clínica exige verificação do número (SMS/chamada) e, para volumes
   maiores, verificação do negócio (Meta Business Verification).

**✅ Implementado:** `META_PHONE_NUMBER_ID` e `META_ACCESS_TOKEN` em
[`backend/.env.example`](../backend/.env.example), consumidos por
[`backend/src/services/meta.js`](../backend/src/services/meta.js).

---

## 2. Autenticação e tokens de acesso

| Tipo | Validade | Uso recomendado |
|---|---|---|
| Token temporário (painel) | 24h | Testes manuais rápidos |
| Token de System User | Configurável (pode ser permanente) | Produção |
| Token de usuário comum | Expira, atrelado à sessão pessoal | Evitar |

Todas as chamadas usam o header `Authorization: Bearer <token>`.

**✅ Implementado:** `callMeta()` em
[`backend/src/services/meta.js`](../backend/src/services/meta.js) injeta o
`Authorization: Bearer`. **⏳ Não implementado:** refresh/rotação automática
de token, alerta de expiração próxima.

---

## 3. Webhooks — verificação e recebimento

A Meta chama a URL cadastrada no painel (Configuração > Webhook) de duas formas:

### GET — verificação (handshake)
Query params: `hub.mode`, `hub.verify_token`, `hub.challenge`. Se
`hub.mode === 'subscribe'` e o token bater com o cadastrado no app, responder
**200** com `hub.challenge` em texto puro; caso contrário, **403**.

### POST — eventos
Chamado a cada evento (mensagem recebida, status de entrega/leitura, etc.).
Regras oficiais:
- Responder **200 OK** o mais rápido possível (processamento deve ser
  assíncrono/não bloqueante).
- Se não responder a tempo, a Meta **reenvia**: retry imediato, depois com
  frequência decrescente por até **36 horas**. O endpoint deve ser
  **idempotente** (tolerar duplicatas).
- Limite de até **1000 atualizações por lote** em um único POST.

**✅ Implementado:** [`backend/src/routes/webhook.js`](../backend/src/routes/webhook.js)
— `GET /webhook` valida `META_VERIFY_TOKEN`; `POST /webhook` responde 200
antes de processar. **⏳ Não implementado:** deduplicação de eventos
repetidos por `message.id` (hoje reprocessar um retry duplicaria a mensagem
em memória — sem efeito colateral grave no MVP atual, mas relevante antes de
qualquer lógica com efeito colateral por mensagem).

---

## 4. Validação de assinatura (X-Hub-Signature-256)

Toda requisição de webhook é assinada pela Meta com **HMAC-SHA256**, usando o
**App Secret** do app, enviado no header `X-Hub-Signature-256: sha256=<hash>`.
O receptor deve recalcular o HMAC sobre o **corpo bruto** (raw body, antes do
`JSON.parse`) e comparar — isso garante que o payload realmente veio da Meta.

**✅ Implementado:**
- [`backend/src/index.js`](../backend/src/index.js) — `express.json({ verify })`
  captura `req.rawBody`.
- [`backend/src/services/verifySignature.js`](../backend/src/services/verifySignature.js)
  — recalcula o HMAC e compara com `timingSafeEqual` (evita timing attack).
- `POST /webhook` rejeita com **403** antes de processar qualquer payload com
  assinatura inválida.

**Configuração:** `META_APP_SECRET` no `.env` (Configurações do App > Básico
> Chave Secreta do App). Sem essa variável, a validação é pulada — aceitável
apenas em desenvolvimento local, **nunca em produção**.

---

## 5. Estrutura do payload recebido (mensagens e status)

Um mesmo webhook cobre eventos diferentes dentro de `entry[].changes[].value`:

```jsonc
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WABA_ID",
    "changes": [{
      "field": "messages",
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "display_phone_number": "551198...", "phone_number_id": "..." },
        "contacts": [{ "wa_id": "5511999998888", "profile": { "name": "Maria Silva" } }],
        // presente quando é MENSAGEM NOVA do cliente:
        "messages": [{
          "id": "wamid....",
          "from": "5511999998888",
          "timestamp": "1786838400",
          "type": "text", // text | image | audio | video | document | sticker | location | contacts | button | interactive | reaction
          "text": { "body": "Olá" }
        }],
        // presente quando é RECIBO DE STATUS (entregue/lido/falhou):
        "statuses": [{
          "id": "wamid....",
          "status": "delivered", // sent | delivered | read | failed
          "timestamp": "1786838410",
          "recipient_id": "5511999998888"
        }]
      }
    }]
  }]
}
```

Pontos importantes:
- `value.messages` e `value.statuses` **nunca vêm juntos** no mesmo evento —
  são notificações separadas.
- O `type` da mensagem determina qual sub-objeto ler (`text.body`,
  `image.id`/`image.link`, `location.latitude/longitude`, etc.).
- Mensagens de mídia recebidas trazem apenas um **media ID** — é preciso
  fazer `GET /{media-id}` para obter a URL temporária e baixar o arquivo
  (ver seção 7).

**✅ Implementado:** [`backend/src/services/parser.js`](../backend/src/services/parser.js)
lê `value.messages` (ignora `value.statuses`) e mapeia para o DTO
`{ id, from, name, text, timestamp }`. Tipos não-texto viram um placeholder
(`[imagem]`, `[áudio]`, etc.) — o conteúdo real da mídia **não é baixado**.
**⏳ Não implementado:** processamento de `value.statuses` (não há indicação
de "entregue"/"lido" na UI), download de mídia recebida.

---

## 6. Envio de mensagem de texto

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "5511999998888",
  "type": "text",
  "text": { "body": "conteúdo da mensagem", "preview_url": false }
}
```
- `to`: `wa_id` do destinatário, só dígitos, com código do país.
- `text.body`: limite de **4096 caracteres**.
- `text.preview_url`: se `true`, gera preview de links contidos no texto.
- Só é aceito **dentro da janela de 24h** (seção 11); fora dela, use template.

**✅ Implementado:** `sendTextMessage()` em
[`backend/src/services/meta.js`](../backend/src/services/meta.js) — normaliza
o número, valida o limite de 4096 caracteres antes de chamar a API, envia via
`POST /messages` (rota [`chat.js`](../backend/src/routes/chat.js)). **⏳ Não
implementado:** `preview_url` (hoje sempre omitido/false implícito).

---

## 7. Envio de mídia (imagem, vídeo, áudio, documento, sticker)

### 7.1 Duas formas de enviar

**Por link (URL pública, mais simples):**
```json
{
  "messaging_product": "whatsapp",
  "to": "5511999998888",
  "type": "image",
  "image": { "link": "https://exemplo.com/foto.jpg", "caption": "opcional" }
}
```

**Por media ID (upload prévio, recomendado para produção — não depende de a URL ficar no ar):**
```
POST /{PHONE_NUMBER_ID}/media   (multipart/form-data: file, type, messaging_product=whatsapp)
→ resposta: { "id": "MEDIA_ID" }
```
```json
{
  "messaging_product": "whatsapp",
  "to": "5511999998888",
  "type": "image",
  "image": { "id": "MEDIA_ID", "caption": "opcional" }
}
```
O mesmo padrão (`link` ou `id`) vale para `video`, `audio`, `document` (aceita
também `filename`) e `sticker`.

### 7.2 Download de mídia recebida
1. `GET /{MEDIA_ID}` (com o access token) → retorna uma `url` temporária
   (expira em **5 minutos**) + `mime_type` + `file_size`.
2. `GET <url>` com o access token no header para baixar os bytes.
3. Arquivos da Meta ficam disponíveis por **30 dias**.

### 7.3 Limites por tipo

| Tipo | Extensões aceitas | Tamanho máx. |
|---|---|---|
| Imagem | `.jpeg`, `.png` | 5 MB |
| Vídeo | `.mp4`, `.3gp` (H.264 + áudio AAC) | 16 MB |
| Áudio | `.mp3`, `.aac`, `.m4a`, `.amr`, `.ogg` | 16 MB |
| Documento | `.pdf`, `.doc(x)`, `.xls(x)`, `.ppt(x)`, `.txt` | 100 MB |
| Sticker | `.webp` | 100 KB (estático) / 500 KB (animado) |

Erro comum: MIME type declarado não bate com a extensão real do arquivo.

**⏳ Não implementado.** Sugestão de próximos passos: `sendMediaMessage(to, type, { link | id }, caption)`
em `meta.js`, endpoint `POST /media/upload` (proxy para a Meta) e worker para
baixar mídia recebida (hoje o parser só grava um placeholder de texto).

---

## 8. Localização, contatos e reações

**Localização (enviar):**
```json
{ "messaging_product": "whatsapp", "to": "...", "type": "location",
  "location": { "latitude": -23.55, "longitude": -46.63, "name": "Clínica PhysioVilas", "address": "Rua X, 123" } }
```

**Contato (enviar):**
```json
{ "messaging_product": "whatsapp", "to": "...", "type": "contacts",
  "contacts": [{ "name": { "formatted_name": "Dra. Ana", "first_name": "Ana" }, "phones": [{ "phone": "+5511999990000", "type": "WORK" }] }] }
```

**Reação (emoji em cima de uma mensagem, enviar):**
```json
{ "messaging_product": "whatsapp", "to": "...", "type": "reaction",
  "reaction": { "message_id": "wamid....", "emoji": "👍" } }
```
Enviar `emoji: ""` remove uma reação existente.

**⏳ Não implementado** — nenhuma dessas rotas existe hoje no projeto.

---

## 9. Mensagens interativas (botões e listas)

**Reply buttons (até 3 botões):**
```json
{
  "messaging_product": "whatsapp", "to": "...", "type": "interactive",
  "interactive": {
    "type": "button",
    "body": { "text": "Deseja confirmar sua consulta?" },
    "action": {
      "buttons": [
        { "type": "reply", "reply": { "id": "confirmar", "title": "Confirmar" } },
        { "type": "reply", "reply": { "id": "cancelar", "title": "Cancelar" } }
      ]
    }
  }
}
```

**List message (menu com seções, até 10 itens):**
```json
{
  "messaging_product": "whatsapp", "to": "...", "type": "interactive",
  "interactive": {
    "type": "list",
    "body": { "text": "Escolha um horário disponível:" },
    "action": {
      "button": "Ver horários",
      "sections": [{
        "title": "Manhã",
        "rows": [{ "id": "09h", "title": "09:00", "description": "Fisioterapia - Dra. Ana" }]
      }]
    }
  }
}
```

A **resposta** do usuário a um botão/lista chega no webhook como
`message.type === "interactive"`, com `interactive.button_reply.id` ou
`interactive.list_reply.id` — é assim que o backend identifica qual opção foi
escolhida.

**⏳ Não implementado.** É a base recomendada para qualquer fluxo de bot
(menu principal, confirmação de agendamento) citado como "fora do escopo do
MVP" no [PRD](./PRD_PhysioVilas_WhatsApp.md#3-escopo-do-produto).

---

## 10. Templates de mensagem

### 10.1 Por que existem
Só é possível **iniciar** uma conversa (fora da janela de 24h) com um
template pré-aprovado pela Meta — mensagem de texto livre só funciona como
resposta dentro da janela.

### 10.2 Categorias (desde a reforma de 2024/2025)
| Categoria | Uso | Cobrança dentro da janela de 24h |
|---|---|---|
| **Marketing** | Promoções, novidades, campanhas | Sempre cobrado quando entregue |
| **Utility** | Transacional (confirmação de agendamento, lembrete) | Grátis se a janela estiver aberta |
| **Authentication** | Código/OTP de verificação | Grátis se a janela estiver aberta |

(A categoria **Service** foi descontinuada — mensagens de atendimento
não-template dentro da janela de 24h são simplesmente gratuitas, sem precisar
de template.)

### 10.3 Componentes de um template
- **Header** (opcional): texto curto, ou mídia (imagem/vídeo/documento).
- **Body** (obrigatório): texto principal, até 1024 caracteres, aceita
  variáveis `{{1}}`, `{{2}}`, ...
- **Footer** (opcional): texto estático curto (até 60 caracteres), sem variáveis.
- **Buttons** (opcional): até 3 quick reply, ou até 2 CTA (`URL`/`PHONE_NUMBER`).

### 10.4 Payload de envio com variáveis
```json
{
  "messaging_product": "whatsapp", "to": "5511999998888", "type": "template",
  "template": {
    "name": "confirmacao_consulta",
    "language": { "code": "pt_BR" },
    "components": [
      { "type": "body", "parameters": [
          { "type": "text", "text": "Maria" },
          { "type": "text", "text": "18/08 às 14h" }
        ] },
      { "type": "button", "sub_type": "quick_reply", "index": "0",
        "parameters": [{ "type": "payload", "payload": "CONFIRMAR_18_08" }] }
    ]
  }
}
```
Templates **sem variáveis** (ex.: `hello_world`) não enviam `components`.

### 10.5 Criação e aprovação
- Criados no painel (WhatsApp Manager) ou via API de gerenciamento de templates.
- Passam por revisão automática/manual da Meta — normalmente minutos a
  algumas horas, podendo levar até 24h+.
- Rejeição comum: linguagem promocional em template `utility`, variáveis sem
  contexto suficiente, conteúdo ambíguo/genérico demais.
- Templates ganham **quality rating** próprio; templates com qualidade baixa
  podem ser pausados automaticamente (erro `132015`).

**✅ Implementado (envio, com variáveis):** `sendTemplateMessage(to, templateName, languageCode, components)`
em [`backend/src/services/meta.js`](../backend/src/services/meta.js), exposto
em `POST /messages/template` ([`chat.js`](../backend/src/routes/chat.js)),
com `components` documentado no Swagger (`SendTemplateInput`).
**⏳ Não implementado:** criação/gestão de templates via API (hoje é 100%
manual no painel da Meta), header de mídia em template.

---

## 11. Janela de atendimento (24h) e regra texto livre × template

- A **Customer Service Window (CSW)** abre quando o cliente envia qualquer
  mensagem ao número da clínica, e permanece aberta por **24h** a partir da
  última mensagem dele.
- Dentro da janela: texto livre, mídia, interativas — tudo permitido e
  **gratuito** (não-template).
- Fora da janela: só é possível enviar **template**; texto livre é recusado
  pela Meta com erro `131047` ("Re-engagement message" / mais de 24h desde a
  última mensagem do cliente).
- **Free Entry Point (FEP):** se o cliente inicia a conversa clicando em um
  anúncio ("Click to WhatsApp Ads") ou botão do Instagram/Facebook, abre-se
  uma janela especial de **72h** com mensagens gratuitas.

**✅ Implementado:** documentado no Swagger de `POST /messages` (aviso sobre a
janela). A regra em si é **imposta pela própria Meta** (a API recusa a
chamada) — o backend não replica essa validação localmente, apenas repassa o
erro `502` com os `details` originais.

---

## 12. Precificação (modelo atual, pós-julho/2025)

Desde **1º de julho de 2025**, a Meta mudou de cobrança **por conversa**
(janelas de 24h) para cobrança **por mensagem de template entregue**:

- Só **templates** geram custo — mensagens não-template dentro da janela de
  24h são **gratuitas**, independente da categoria.
- Cobrança varia por **categoria do template** (marketing/utility/authentication)
  e **país do destinatário**.
- Templates `utility`/`authentication` entregues **dentro** de uma janela de
  24h aberta são gratuitos; `marketing` é sempre cobrado quando entregue.
- **Volume tiers:** descontos progressivos em `utility`/`authentication`
  conforme o volume mensal agregado da empresa aumenta.
- **Free Entry Point (72h):** mensagens (inclusive templates) originadas de
  clique em anúncio ficam gratuitas dentro dessa janela estendida.
- A partir de outubro/2025, a Meta passou a emitir **webhooks de mudança de
  tier de preço**; um recurso de **"max-price"** para templates de marketing
  está planejado para 2026.

**Implicação prática para o projeto:** como o MVP hoje só recebe e responde
dentro da janela de 24h (texto livre) e usa templates simples de teste, o uso
atual é **gratuito**. Custos só entram em cena se: (a) a clínica disparar
templates de `marketing` proativamente, ou (b) precisar reengajar pacientes
fora da janela de 24h com `utility`/`authentication` sem janela aberta.

---

## 13. Limites de mensagens e quality rating

### 13.1 Tiers de mensagens iniciadas pelo negócio (por dia, contatos únicos)
| Tier | Limite |
|---|---|
| Inicial | 250 |
| Nível 1 | 2.000 |
| Nível 2 | 10.000 |
| Nível 3 | 100.000 |
| Máximo | Ilimitado |

**Como subir do tier inicial (250 → 2.000):** verificar o negócio no Meta
Business Manager, **ou** ter um parceiro (BSP) verificando por você, **ou**
entregar 2.000 mensagens (fora de janela, via template de boa qualidade) para
contatos únicos em 30 dias.

**Escalonamento automático seguinte:** ocorre sozinho quando a conta mantém
**mensagens de alta qualidade** e usa **pelo menos metade do limite atual**
nos últimos 7 dias.

### 13.2 Quality rating do número
Classificação (Alta/Média/Baixa, indicada por cor no painel) baseada em
feedback recente dos usuários (bloqueios, denúncias, respostas negativas).
Qualidade baixa pode: pausar templates automaticamente (`132015`), reduzir o
tier, ou em casos extremos restringir o número.

**⏳ Não implementado / não monitorado.** Sugestão: acompanhar isso pelo
WhatsApp Manager por enquanto; se o volume crescer, vale expor o quality
rating no painel via API de gerenciamento da WABA.

---

## 14. Rate limits de requisição e throughput

| Limite | Valor |
|---|---|
| Requisições/hora (WABA inativa) | 200 por app por WABA |
| Requisições/hora (WABA ativa) | 5.000 por app por WABA |
| Throughput de envio (padrão) | Até 80 mensagens/segundo por número (upgradável) |
| Pair rate limit (mesmo destinatário) | ~1 mensagem a cada 6s (~600/h); rajadas de até 45 msgs em 6s, com "empréstimo" que exige espera equivalente depois |

Estourar esses limites gera erros `4` (rate limit da app), `80007` (rate
limit da WABA) ou `130429` (throughput excedido) — ver seção 15.

**⏳ Não implementado:** fila/retry com backoff para respeitar esses limites.
Irrelevante no volume atual do MVP, mas necessário antes de qualquer disparo
em massa (ex.: lembretes de agendamento para muitos pacientes de uma vez).

---

## 15. Códigos de erro comuns

| Código | Significado |
|---|---|
| `0` / `190` | Token expirado ou inválido |
| `10` | Permissão não concedida/removida |
| `100` | Parâmetro inválido/não suportado |
| `131021` | Número do remetente igual ao do destinatário |
| `131026` | Número de destino não é um WhatsApp válido |
| `131047` | Fora da janela de 24h — use template |
| `131049` | Limite diário de mensagens de marketing atingido |
| `131050` | Usuário optou por não receber mensagens (opt-out) |
| `131056` | Excesso de mensagens para o mesmo destinatário (pair rate limit) |
| `132000` | Número de variáveis do payload não bate com o template |
| `132001` | Template não existe ou não está aprovado no idioma informado |
| `132015` | Template pausado por baixa qualidade |
| `368` | Conta restrita por violação de política |
| `4` | Rate limit da aplicação |
| `80007` | Rate limit da WABA |
| `130429` | Throughput excedido |

**✅ Implementado:** `callMeta()` em
[`backend/src/services/meta.js`](../backend/src/services/meta.js) repassa
`error.message` e `error.details` (payload de erro original da Meta) nas
respostas `502` — dá para ver o código exato direto no Swagger.

---

## 16. Boas práticas e políticas de opt-in

- **Opt-in obrigatório:** só é permitido enviar mensagens (incluindo
  templates) a números que deram consentimento explícito para contato via
  WhatsApp pela empresa — não vale importar uma lista de contatos e disparar.
- **Templates `marketing`** exigem clareza sobre remetente e finalidade;
  linguagem enganosa é motivo comum de rejeição/banimento.
- **Respeitar opt-out:** se o usuário pedir para parar (ou bloquear o
  número), não insistir — a própria Meta já recusa (`131050`) mas a política
  de negócio deve reforçar isso.
- **Um único WhatsApp Business App por número:** ao migrar o número da
  clínica para a Cloud API, o WhatsApp Business (app de celular) é
  desconectado — já documentado no [PRD](./PRD_PhysioVilas_WhatsApp.md#2-avisos-importantes-sobre-a-migração-para-a-clínica).
- **Nunca commitar tokens/App Secret:** `META_ACCESS_TOKEN` e
  `META_APP_SECRET` só devem existir no `.env` local/variáveis de ambiente do
  Render, nunca no `.env.example` nem no git.

---

## 17. Status atual do projeto x próximos passos

### ✅ Já implementado
- Verificação de webhook (`GET /webhook`).
- Validação de assinatura HMAC (`X-Hub-Signature-256`).
- Recebimento e parsing de mensagens de texto (`POST /webhook`).
- Armazenamento em memória + listagem (`GET /conversations`, `GET /messages`).
- Envio de texto livre (`POST /messages`), com validação de janela implícita
  (repassa erro da Meta) e limite de 4096 caracteres.
- Envio de template com variáveis (`POST /messages/template`, `components`).
- Documentação Swagger de tudo isso.

### ⏳ Próximos passos sugeridos (ordem de prioridade sugerida)
1. **Persistência real** (banco de dados) — hoje tudo some a cada
   restart/redeploy do Render ([`store.js`](../backend/src/services/store.js)).
2. **Processamento de `value.statuses`** — mostrar "entregue"/"lido" no
   painel.
3. **Envio de mídia** (seção 7) — pelo menos imagem e documento, comuns em
   confirmação de exame/receita.
4. **Deduplicação por `message.id`** — proteger contra retries do webhook
   processarem a mesma mensagem duas vezes.
5. **Mensagens interativas** (seção 9) — base para qualquer bot de menu/
   agendamento citado como fora de escopo do MVP no PRD.
6. **Download de mídia recebida** (hoje vira só um placeholder de texto).
7. **Rate limiting/retry no envio** — só necessário se houver disparo em
   massa (lembretes de agendamento).
