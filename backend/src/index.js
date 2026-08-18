import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import swaggerUi from 'swagger-ui-express';
import { createWebhookRouter } from './routes/webhook.js';
import { createChatRouter } from './routes/chat.js';
import { swaggerSpec } from './docs/swagger.js';

// Render injeta process.env.PORT dinamicamente; bind explícito em 0.0.0.0
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const FRONTEND_URL = process.env.FRONTEND_URL || '*';
const CORS_METHODS = ['GET', 'POST'];

const app = express();
app.use(cors({ origin: FRONTEND_URL, methods: CORS_METHODS }));
// Guarda o corpo bruto (rawBody) para permitir a validação da assinatura
// X-Hub-Signature-256 exigida pela Meta nas rotas de webhook.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Raiz redireciona para a documentação Swagger
app.get('/', (_req, res) => res.redirect('/docs'));

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: FRONTEND_URL, methods: CORS_METHODS },
});

io.on('connection', (socket) => {
  console.log(`[socket] cliente conectado: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[socket] cliente desconectado: ${socket.id}`);
  });
});

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Util]
 *     summary: Health check do servidor (anti cold start do Render)
 *     description: Usada pelo frontend para "acordar" o servidor do plano gratuito do Render antes das operações.
 *     responses:
 *       200:
 *         description: Servidor no ar
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 uptime:
 *                   type: number
 *                   example: 123.45
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/docs.json', (_req, res) => res.json(swaggerSpec));

app.use('/webhook', createWebhookRouter(io));
app.use('/', createChatRouter());

httpServer.listen(PORT, HOST, () => {
  console.log(`[server] PhysioVilas ChatManager backend ouvindo em http://${HOST}:${PORT}`);
  console.log(`[server] Swagger disponível em http://localhost:${PORT}/docs`);
});
