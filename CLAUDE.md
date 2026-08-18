# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from `backend/` (the only implemented workspace — see Architecture):

```
npm install       # install dependencies
npm run dev       # start with node --watch (auto-restart on file change)
npm start         # start normally (node src/index.js)
```

There is no lint config, formatter config, or test suite in this repo. To
sanity-check a file after editing, use `node --check src/path/to/file.js`
(syntax only — no bundler/build step; this is plain ESM Node.js, `"type": "module"`).

Swagger UI (auto-generated from JSDoc comments on routes) is served at
`/docs` when the server is running; raw spec at `/docs.json`.

## Architecture

**Monorepo, backend-only today.** The frontend (Next.js on Vercel) described
in `docs/PRD_PhysioVilas_WhatsApp.md` has not been started yet — don't look
for it. `render.yaml` at the repo root deploys `backend/` as a Render
Blueprint (`rootDir: backend`, binds `process.env.PORT` on `0.0.0.0`,
`/health` used to avoid free-tier cold starts).

**Purpose:** receive WhatsApp messages via the Meta Cloud API webhook,
broadcast them in real time over Socket.io, and send replies/templates back
through the Cloud API. Two reference docs already exist in this repo and
should be read instead of re-derived:
- `docs/PRD_PhysioVilas_WhatsApp.md` — product scope, MVP boundaries (no
  send UI yet, no bot flows), screens, deploy rules.
- `docs/META_CLOUD_API_RULES.md` — full WhatsApp Cloud API reference
  (message types, templates, pricing, rate limits, error codes), each
  section marked as implemented (with file link) or not.

### Receiving flow (webhook)
`POST /webhook` → `verifySignature.js` checks `X-Hub-Signature-256` (HMAC-SHA256
over the raw body, keyed by `META_APP_SECRET`) → responds `200` immediately
(Meta requirement — it retries for up to 36h otherwise) → `parser.js`
(`parseMetaPayload`) flattens Meta's nested JSON into `{ id, from, name, text, timestamp }`
→ `store.js` (`addMessage`) appends in-memory → `io.emit('new-message', dto)`
to all connected Socket.io clients. Delivery/read receipts (`value.statuses`
with `status: sent/delivered/read`) are still ignored; `status: failed` is
extracted by `parseMetaStatusFailures` and emitted as `io.emit('message-failed', ...)`.

### wa_id format — no leading "9"
Every `wa_id` in this codebase (`from` on received messages, `waId` in
`GET /conversations`, `to` when sending) is DDD + number concatenated, with
no `+` and no Brazilian mobile's leading "9" digit — e.g. `+55 11 98765-4321`
→ `551187654321`, not `5511987654321`. Meta's send API (`to` field) tolerates
the 9 and normalizes it internally, but everywhere else in this codebase the
comparison is an exact string match with zero normalization
(`store.js`'s `listMessages`/`listConversations` filter/group by `from` as-is)
— passing a `wa_id` with the 9 to `GET /messages?from=` silently matches
nothing. Full explanation: `docs/META_CLOUD_API_RULES.md` section 6 and the
Swagger `info.description` (served at `/docs`).

### Sending flow
`routes/chat.js` (`POST /messages`, `POST /messages/template`) → `services/meta.js`
(`sendTextMessage` / `sendTemplateMessage`) → Graph API. Errors from the Graph
API are thrown with `.status`/`.details` attached and forwarded as-is by the
route handlers (`502` with Meta's original error body).

### Key files
- `src/index.js` — Express + `http` server + Socket.io bootstrap. CORS locked
  to `FRONTEND_URL`. `express.json({ verify })` captures `req.rawBody`,
  which the webhook signature check depends on — don't remove it.
- `src/routes/webhook.js` — `GET` (hub.challenge handshake) + `POST`
  (signature check → 200 → parse/store/broadcast).
- `src/routes/chat.js` — endpoints usable without a frontend for manual
  testing via Swagger: `GET /conversations`, `GET /messages`, `POST /messages`,
  `POST /messages/template`. Endpoint docs live as `@openapi` JSDoc blocks
  directly above each handler (consumed by `swagger-jsdoc`), not in `swagger.js`.
- `src/services/parser.js` — Meta payload → internal `Message` DTO. Non-text
  types (image/audio/video/...) become bracket placeholders (e.g. `[imagem]`);
  media is not downloaded.
- `src/services/store.js` — in-memory array, FIFO-capped at 200 messages,
  **not persistent** (wiped on every restart/redeploy). `listConversations()`
  groups by `wa_id`.
- `src/services/meta.js` — thin `fetch`-based Graph API client. Normalizes
  recipient numbers (strips non-digits), enforces the 4096-char text limit
  client-side before calling the API, builds template payloads (optional
  `components` array for template variables).
- `src/services/verifySignature.js` — HMAC-SHA256 check against
  `META_APP_SECRET`; **skips validation (returns true) if unset** — always
  set this in production.
- `src/docs/swagger.js` — `swagger-jsdoc` config and shared schema
  definitions only; route-level docs live next to each handler.

### Environment variables (`backend/.env.example`)
`PORT`, `META_VERIFY_TOKEN`, `META_APP_SECRET`, `META_ACCESS_TOKEN`,
`META_PHONE_NUMBER_ID`, `META_GRAPH_API_VERSION`, `FRONTEND_URL`.
