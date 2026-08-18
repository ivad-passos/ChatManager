# ChatManager

Painel de atendimento via WhatsApp para a **[Physiovilas](https://www.physiovilas.com.br/)**,
clínica de saúde ortopédica (fisioterapia, RPG, Pilates, massoterapia,
reabilitação pélvica, osteopatia e microfisioterapia) com mais de 20 anos de
atuação na região metropolitana de Salvador/BA (unidades em Lauro de
Freitas, Busca Vida e Vilas do Atlântico).

## Ideia do projeto

Hoje o atendimento da clínica passa pelo WhatsApp comum, num celular físico.
O ChatManager substitui isso por um **painel web centralizado**, conectado à
**API Oficial da Meta (WhatsApp Cloud API)**, permitindo:

- Receber e visualizar em tempo real as mensagens que chegam no número
  oficial da clínica.
- Responder aos pacientes (texto livre e templates aprovados) sem depender
  de um aparelho físico específico.
- Futuramente, apoiar fluxos como confirmação/lembrete de agendamento.

Não é um bot nem um substituto do atendimento humano — é a ferramenta que a
equipe da recepção usa para conversar com os pacientes pelo número oficial.

> Contexto completo do produto (escopo do MVP, telas, avisos de migração
> para a clínica): [`docs/PRD_PhysioVilas_WhatsApp.md`](docs/PRD_PhysioVilas_WhatsApp.md)

## Status atual

**Backend implementado e funcional. Frontend ainda não iniciado.**

O que já funciona hoje, testável direto pelo Swagger (`/docs`), sem precisar
de frontend:

- ✅ Webhook da Meta: verificação (`GET /webhook`) e recebimento de mensagens
  (`POST /webhook`), com **validação de assinatura HMAC** (`X-Hub-Signature-256`).
- ✅ Emissão em tempo real via **Socket.io** (evento `new-message`) a cada
  mensagem recebida.
- ✅ Listagem de conversas e mensagens recebidas (`GET /conversations`,
  `GET /messages`) — armazenamento em memória, apenas para teste/demonstração.
- ✅ Envio de mensagem de texto livre (`POST /messages`) e de template
  aprovado, com suporte a variáveis (`POST /messages/template`).
- ✅ Documentação OpenAPI/Swagger completa de todas as rotas.

O que ainda **não** existe:

- ⏳ Frontend (Next.js, hospedado na Vercel) — a tela de atendimento estilo
  "WhatsApp Web" descrita no PRD.
- ⏳ Persistência real (banco de dados) — hoje as mensagens somem a cada
  restart/redeploy do backend.
- ⏳ Envio de mídia, mensagens interativas (botões/listas), fluxos de bot.

> Referência completa de tudo que a Cloud API da Meta permite fazer — o que
> já foi implementado e o que é próximo passo:
> [`docs/META_CLOUD_API_RULES.md`](docs/META_CLOUD_API_RULES.md)

## Arquitetura

Monorepo. Hoje só a pasta `backend/` existe; o frontend (Next.js) será
adicionado depois, seguindo o design system já definido no PRD.

```
Paciente (WhatsApp)
      │
      ▼
Meta Cloud API ──POST /webhook──▶ Backend (Render)
                                       │
                                       ├─ valida assinatura, salva em memória
                                       └─ Socket.io: evento "new-message"
                                                  │
                                                  ▼
                                     Frontend (Next.js, Vercel) — ainda não implementado
```

- **Backend:** Node.js + Express + Socket.io, deploy no **Render** (plano
  gratuito) via Blueprint (`render.yaml`).
- **Frontend (planejado):** Next.js (React) na **Vercel**, consumindo os
  eventos do Socket.io e as rotas REST do backend.

Detalhes de cada arquivo do backend estão em [`CLAUDE.md`](CLAUDE.md).

## Rodando localmente

```bash
cd backend
npm install
cp .env.example .env   # preencher com os valores do seu app na Meta for Developers
npm run dev             # http://localhost:3001 — Swagger em /docs
```

Variáveis de ambiente necessárias (ver [`backend/.env.example`](backend/.env.example)):

| Variável | Descrição |
|---|---|
| `PORT` | Porta local (Render injeta a sua própria em produção) |
| `META_VERIFY_TOKEN` | Token inventado por você, cadastrado no painel da Meta para validar o webhook |
| `META_APP_SECRET` | Chave secreta do App na Meta, usada para validar a assinatura do webhook |
| `META_ACCESS_TOKEN` | Token de acesso da Cloud API (temporário em dev, permanente/System User em produção) |
| `META_PHONE_NUMBER_ID` | ID do número de telefone cadastrado na Cloud API |
| `META_GRAPH_API_VERSION` | Versão da Graph API usada no envio (opcional, padrão `v22.0`) |
| `FRONTEND_URL` | URL do frontend na Vercel, para restringir o CORS em produção |

## Documentação

- [`docs/PRD_PhysioVilas_WhatsApp.md`](docs/PRD_PhysioVilas_WhatsApp.md) —
  escopo do produto, telas, backlog de desenvolvimento.
- [`docs/META_CLOUD_API_RULES.md`](docs/META_CLOUD_API_RULES.md) —
  referência completa da WhatsApp Cloud API (mensagens, mídia, templates,
  precificação, limites, códigos de erro).
- [`CLAUDE.md`](CLAUDE.md) — guia de arquitetura para desenvolvimento com IA
  (Claude Code).
- Swagger (`/docs` com o servidor rodando) — testar as rotas manualmente.

## Deploy

- **Backend:** Render, via Blueprint (`render.yaml` na raiz do monorepo,
  `rootDir: backend`). Deploy automático a cada push.
- **Frontend:** Vercel (a configurar quando o frontend for iniciado).
