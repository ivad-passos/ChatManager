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

## 6. Backlog de Desenvolvimento

O backlog de tickets (organizado por equipe: Integração, Backend, Frontend
e Banco de Dados/Persistência) vive em documento dedicado, separado deste
PRD: `docs/BACKLOG.md`.
