# Product Requirements Document (PRD)
## Projeto: PhysioVilas - Painel de Atendimento WhatsApp (API Oficial)
**Autor:** Davi Serra Passos
**Data:** Agosto 2026
**Cliente:** Clínica PhysioVilas
**Status:** Em desenvolvimento (Backend do MVP implementado)

---

## 1. Visão Geral e Objetivo
O objetivo deste projeto é desenvolver uma aplicação web corporativa para a clínica de fisioterapia **PhysioVilas**, permitindo o monitoramento e atendimento centralizado de mensagens de WhatsApp.

A aplicação utilizará a **API Oficial da Meta (Cloud API)**, garantindo estabilidade e adequação às políticas do WhatsApp para empresas. O sistema atuará como um "Painel de Atendimento", substituindo o uso do WhatsApp Business convencional em aparelhos celulares na clínica.

O frontend será desenvolvido em **Next.js (React)** hospedado na **Vercel**, seguindo o design system do protótipo anexo (cores da marca: azul primário `#055BAA`, laranja sotaque `#EA7E26`). O backend rodará no **Render** (Web Service, plano gratuito) via **Node.js** para lidar com os webhooks da Meta.

---

## 2. Avisos Importantes sobre a Migração (Para a Clínica)

**Atenção Equipe PhysioVilas:** A adoção da API Oficial da Meta traz mudanças operacionais drásticas em relação ao uso do WhatsApp convencional.

1. **Adeus ao Celular:** Ao migrar o número oficial da clínica para este sistema, o aplicativo **WhatsApp Business no celular será desconectado permanentemente**. O número passará a viver 100% "na nuvem".
2. **Uso Exclusivo pelo Painel:** Toda e qualquer mensagem (recebimento ou, futuramente, envio) deverá ser feita **exclusivamente** através da nossa tela de "Atendimento" (Painel Web). 
3. **Migração Gradual (Recomendação):** Para evitar interrupções no atendimento, recomendamos iniciar o projeto utilizando um **número de telefone novo** (chip novo) dedicado apenas para o sistema. O número principal atual da clínica pode conter uma resposta automática direcionando os agendamentos automatizados para o número novo.

---

## 3. Escopo do Produto
### O que ESTÁ no escopo (MVP):
- Configuração do Webhook da Meta para receber mensagens em tempo real.
- **Tela 1 - Home:** Resumo básico do dia.
- **Tela 2 - Atendimento:** Tela estilo "WhatsApp Web" listando as mensagens que chegam no número oficial (apenas visualização das mensagens recebidas por enquanto).
- Tratamento do JSON enviado pela Meta e emissão em tempo real para o frontend via WebSocket.
- Estilização do Frontend idêntica ao protótipo HTML fornecido (Sidebar lateral, abas de navegação, cards brancos com bordas, chat layout).

### O que NÃO ESTÁ no escopo (Futuro):
- **Envio de respostas** pelo painel (no MVP, a tela mostrará a entrada da mensagem, mas o campo de digitar estará bloqueado).
- Fluxo de bot automatizado (Menu principal, agendamentos).
- Módulo de Agendamentos (Calendário Visual).
- Módulo de Relatórios.
- Módulo de Configurações (FAQ).

---

## 4. Telas e UX/UI (Baseado no Design System PhysioVilas)

O sistema terá a barra lateral (Sidebar) padrão com as opções de navegação, mas no MVP focaremos na funcionalidade de Atendimento.

### Layout Base
- **Cores:** Fundo cinza claro (`#F8F9FA`), Cards brancos (`#FFFFFF`), Primária Azul (`#055BAA`), Destaques Laranja (`#EA7E26`).
- **Sidebar:** Logo PhysioVilas no topo, botões de navegação (Home, Atendimento, etc.), e identificação do usuário no rodapé.

### Tela de Atendimento (Chat)
- **Painel Esquerdo (Lista de Chats):** 
  - Lista de contatos ordenados pela mensagem mais recente.
  - Indicadores visuais de mensagens novas.
- **Painel Direito (Janela de Chat):** 
  - Cabeçalho com o nome/número do paciente.
  - Área de mensagens (Fundo `#F0F2F5`) com balões de mensagem brancos (recebidas).
  - *No MVP, a barra inferior de envio estará presente visualmente (conforme protótipo), mas inativa com o placeholder: "Visualização apenas. Envio de mensagens em breve."*

---

## 5. Arquitetura (Vercel + Render)

1. **Frontend (Vercel):** Aplicação **Next.js (React)** consumindo eventos de WebSocket do servidor. Responsável por toda a renderização UI do protótipo.
2. **Backend (Render):** Node.js rodando um servidor Express com Socket.io, em um Web Service do plano gratuito.
3. **Fluxo:** Paciente envia mensagem -> Meta dispara POST webhook -> Render processa payload -> Render emite Socket.io -> Vercel atualiza UI.

### 5.1 Regras de Deploy do Backend (Render — Plano Gratuito)
- **Bind de porta e host:** o Render injeta a porta dinamicamente. O servidor escuta em `process.env.PORT` (fallback `3000`) com bind explícito em `0.0.0.0` para evitar erros de roteamento na nuvem. Em desenvolvimento local, o `.env` usa a porta `3001`.
- **CORS dinâmico:** Express e Socket.io aceitam somente a origem definida em `FRONTEND_URL` (URL do frontend na Vercel), permitindo os métodos `GET` e `POST`.
- **Health check (anti cold start):** o plano gratuito do Render hiberna após ~15 minutos sem tráfego. A rota `GET /health` (retorna `200` + `{ "status": "ok" }`) será chamada pelo frontend para "acordar" o servidor antes das operações.
- **Infraestrutura como Código:** deploy automatizado via `render.yaml` na raiz do monorepo (`type: web`, `rootDir: backend`, `runtime: node`, `buildCommand`/`startCommand`), com deploy automático a cada push no GitHub.

---

## 6. Tickets de Desenvolvimento (Backlog MVP)

### Épico 1: Setup e Configuração Meta
- [ ] **TK-01: Setup App Meta**
  - Criar App no painel Meta for Developers.
  - Cadastrar o número (novo ou da clínica) e gerar `Token Permanente`.
- [x] **TK-02: Setup Backend (Render)**
  - Projeto Express + Socket.io.
  - Configurar `.env` com Tokens da Meta.
  - Rota `GET /webhook` para validação da Meta (`hub.challenge`).
  - Bind em `0.0.0.0` + `process.env.PORT`, rota `GET /health` (anti cold start) e `render.yaml` na raiz do monorepo.
  - Documentação Swagger disponível em `/docs`.

### Épico 2: Motor de Recepção (Backend)
- [x] **TK-03: Processamento do Webhook**
  - Rota `POST /webhook` para receber mensagens.
  - Mapear JSON complexo da Meta para um DTO simples: `{ from, text, timestamp }`.
  - Retornar HTTP 200 imediatamente.
- [x] **TK-04: Emissão WebSocket**
  - Configurar Socket.io para disparar o evento `new-message` contendo o DTO estruturado.

### Épico 3: Frontend - UI Base (Vercel)
- [ ] **TK-05: Setup Frontend (Next.js/React)**
  - Inicializar projeto, configurar TailwindCSS.
  - Criar variáveis CSS globais baseadas no protótipo (ex: `--primary: #055BAA`, `--accent: #EA7E26`).
- [ ] **TK-06: Layout Base (Sidebar)**
  - Componentizar o Sidebar com logo PhysioVilas e links de navegação.

### Épico 4: Frontend - Telas do MVP
- [ ] **TK-07: Tela Home (Resumo Básico)**
  - Implementar UI de cards de "Conversas Hoje" conforme protótipo estático.
- [ ] **TK-08: Tela de Atendimento (UI Chat)**
  - Implementar layout dividido (lista à esquerda, chat à direita).
  - Componentizar balões de mensagem.
  - Bloquear campo de input com mensagem de aviso.
- [ ] **TK-09: Conexão Real-time**
  - Integrar `socket.io-client` na tela de Atendimento.
  - Atualizar o estado da lista e do chat quando o evento `new-message` chegar do Render.

### Épico 5: Go-Live
- [ ] **TK-10: Reunião de Alinhamento com a Clínica**
  - Explicar o impacto da perda do WhatsApp no celular.
  - Decidir sobre uso de número novo vs. número antigo.
- [ ] **TK-11: Deploy e Homologação**
  - Deploy final (Render + Vercel).
  - Atualizar URL do Webhook na Meta para apontar para a produção do Render.
