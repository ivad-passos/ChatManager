# Backlog do Projeto — PhysioVilas WhatsApp

**Última atualização:** 2026-08-18

Este backlog substitui a seção de tickets que antes vivia no PRD
(`PRD_PhysioVilas_WhatsApp.md`, seção "Tickets de Desenvolvimento"). Ele é
organizado por equipe/frente de trabalho, na ordem em que o projeto deve
avançar:

1. **Integração** (APIs da Meta)
2. **Backend**
3. **Frontend**
4. **Banco de Dados / Persistência** — última fase, junto com Dashboards

Cada ticket tem um ID prefixado pela equipe. Tickets marcados com 🔴 são
bloqueantes para o restante da frente; 🟡 exige pesquisa/spike antes de
poder ser estimado.

---

## 1. Integração (APIs da Meta / Cloud API)

Responsável por tudo que fala diretamente com o Graph API / Cloud API da
Meta: envio, recebimento, templates, automações no nível de protocolo.

### Concluído
- [x] INT-00a — Setup do App Meta, número de teste, token de acesso, webhook configurado (`GET`/`POST /webhook`).
- [x] INT-00b — Envio de texto livre (`sendTextMessage`) e template básico (`sendTemplateMessage`) via `services/meta.js`.
- [x] INT-00c — Recebimento e parsing de mensagens de texto (`parser.js`).

### Backlog
- [ ] **INT-01 — Ativar número de produção** 🔴 bloqueante
  Sair do número de teste da Meta e configurar o número real da clínica (ou
  o número novo dedicado, conforme recomendação do PRD) no Business
  Manager. Sem isso, o resto da integração (mídia, templates, automações)
  só pode ser validado no número de teste, que tem limitações de
  destinatários e de volume.
- [ ] **INT-02 — Envio e recebimento de mídia (fotos/vídeos)**
  - Enviar: novo método em `services/meta.js` para `image`/`video` (por
    link ou upload via Media API).
  - Receber: hoje `parser.js` só gera `[imagem]`/`[vídeo]` como
    placeholder — implementar download do arquivo via Media API da Meta (a
    URL de mídia expira e exige o token de acesso) e definir como isso fica
    disponível para backend/frontend.
- [ ] **INT-03 — Status de leitura e entrega**
  - Marcar mensagem recebida como lida (`POST /messages` com
    `status: read` no Graph API).
  - Parsear `value.statuses` para `sent`/`delivered`/`read` (hoje só
    `failed` é tratado — ver `parseMetaStatusFailures` em `parser.js`).
- [ ] **INT-04 — Spike: Templates de mensagem** 🟡 requer pesquisa
  Entender categorias (utility/marketing/authentication), fluxo de
  aprovação pela Meta, variáveis de componente e limites de uso. Resultado
  esperado: documentação curta (nos moldes de `META_CLOUD_API_RULES.md`) +
  endpoint para criar/listar templates via Graph API.
- [ ] **INT-05 — Mensagens interativas para o menu de navegação**
  Avaliar se o menu "digite 1 a 5" (agendar consulta, acessar exame, falar
  com atendimento etc.) deve ser texto simples numerado ou usar o tipo
  `interactive` (List Message / Reply Buttons) da Cloud API. Depende de
  INT-04 se a primeira mensagem do fluxo for iniciada pela empresa fora da
  janela de 24h (nesse caso precisa ser template).

---

## 2. Backend

Responsável por expor as capacidades da Integração como rotas/eventos
consumíveis pelo frontend, e pela lógica de automação.

### Concluído
- [x] BACK-00a — `GET /conversations`, `GET /messages`, `POST /messages`, `POST /messages/template`.
- [x] BACK-00b — Broadcast via Socket.io (`new-message`, `message-failed`).
- [x] BACK-00c — `GET /health` (anti cold start Render).

### Backlog
- [ ] **BACK-01 — Endpoint de envio de mídia**
  `POST /messages/media` (ou equivalente), usando o service de INT-02.
  Validar tipo/tamanho antes de chamar a Meta.
- [ ] **BACK-02 — Evento de status de leitura/entrega**
  Novo evento Socket.io (`message-status`) emitido a partir do parsing de
  INT-03, para o frontend renderizar os checkmarks.
- [ ] **BACK-03 — Notificação ao receber mensagem**
  Definir escopo antes de estimar: se for notificação no navegador (Web
  Notification API) com o app aberto, o evento `new-message` que já existe
  é suficiente e a implementação fica só no Frontend (ver FRONT-04). Se
  precisar funcionar com o app fechado (Web Push), aí sim entra backend
  (service worker + push subscription).
- [ ] **BACK-04 — Motor de automação de mensagens**
  Depende de INT-05 estar definido. Sugestão de quebra:
  - BACK-04a — modelo de fluxo (config/JSON) para o menu de opções 1–5 e a
    ação associada a cada opção.
  - BACK-04b — processamento da resposta do paciente (número digitado ou
    id do botão/lista) e disparo da ação (encaminhar para atendimento
    humano, responder FAQ, etc.).
  - BACK-04c — CRUD de FAQs configuráveis pelo usuário (endpoint para
    cadastrar pergunta/resposta usadas na triagem inicial).
- [ ] **BACK-05 — Endpoint de gestão de templates**
  Expor o que for implementado em INT-04 (criar/listar templates) para o
  painel, sem depender do Business Manager da Meta.

---

## 3. Frontend

### Sem dependência de outra equipe
- [ ] **FRONT-01 — Layout completo do site**
  Sidebar, navegação entre telas, design system do protótipo
  (`--primary: #055BAA`, `--accent: #EA7E26`, cards brancos, fundo
  `#F8F9FA`).
- [ ] **FRONT-02 — Tela de conversas**
  Lista de chats (esquerda) + janela de chat (direita), consumindo
  `GET /conversations`, `GET /messages` e o evento `new-message` via
  `socket.io-client`.
- [ ] **FRONT-03 — Ícones/avatares dos usuários**
  A Cloud API não envia foto de perfil de contato (confirmado — só manda
  `profile.name`). Gerar avatar por iniciais do nome + cor derivada do
  `wa_id`, não esperar uma URL de imagem vinda do backend.

### Depende de Integração/Backend
- [ ] **FRONT-04 — Notificação ao receber mensagem**
  Browser Notification API disparada ao chegar `new-message` (ver nota de
  escopo em BACK-03).
- [ ] **FRONT-05 — Envio e exibição de fotos/vídeos no chat** — depende de INT-02/BACK-01.
- [ ] **FRONT-06 — Indicador de status de leitura (checkmarks)** — depende de INT-03/BACK-02.
- [ ] **FRONT-07 — Tela de configuração de FAQs / automação** (cadastro das perguntas frequentes e do menu de navegação) — depende de BACK-04.
- [ ] **FRONT-08 — Tela de criação de templates** — depende de INT-04/BACK-05.

---

## 4. Banco de Dados / Persistência — última fase

Implementado por último, junto com os Dashboards (que dependem de dados
históricos persistidos — hoje tudo é perdido a cada redeploy;
`services/store.js` é um array em memória capado em 200 mensagens).

- [ ] **DB-01 — Modelagem do banco**
  Schema para mensagens, conversas, contatos, templates e FAQs (as duas
  últimas só fazem sentido depois que INT-04 e BACK-04c existirem).
- [ ] **DB-02 — Migração do store em memória para persistência real**
  Substituir `services/store.js` mantendo a mesma interface (`addMessage`,
  `listMessages`, `listConversations`) para não quebrar rotas/eventos
  existentes.
- [ ] **DB-03 — Dashboards**
  Métricas agregadas (conversas por dia, tempo médio de resposta, etc.) —
  depende diretamente de DB-01/DB-02.

---

## Ordem sugerida entre equipes

Integração (INT-01 primeiro, é bloqueante) → Backend consome o que a
Integração expõe → Frontend consome o que o Backend expõe → Banco de
Dados/Persistência e Dashboards por último, sobre o histórico real de uso.
