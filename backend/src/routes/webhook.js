import { Router } from 'express';
import { parseMetaPayload } from '../services/parser.js';
import { addMessage } from '../services/store.js';
import { verifyMetaSignature } from '../services/verifySignature.js';

export function createWebhookRouter(io) {
  const router = Router();

  /**
   * @openapi
   * /webhook:
   *   get:
   *     tags: [Webhook Meta]
   *     summary: Verificação do webhook (hub.challenge)
   *     description: >
   *       Chamado pela Meta ao cadastrar a URL do webhook no painel de desenvolvedor.
   *       Valida o token e devolve o challenge em texto puro.
   *     parameters:
   *       - in: query
   *         name: hub.mode
   *         required: true
   *         schema:
   *           type: string
   *           example: subscribe
   *       - in: query
   *         name: hub.verify_token
   *         required: true
   *         schema:
   *           type: string
   *           example: dev_verify_token_123
   *       - in: query
   *         name: hub.challenge
   *         required: true
   *         schema:
   *           type: string
   *           example: CHALLENGE_12345
   *     responses:
   *       200:
   *         description: Token válido — devolve o hub.challenge em texto puro
   *         content:
   *           text/plain:
   *             schema:
   *               type: string
   *               example: CHALLENGE_12345
   *       403:
   *         description: Token de verificação inválido
   */
  router.get('/', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
      console.log('[webhook] verificação aceita pela Meta');
      return res.status(200).send(challenge);
    }

    console.warn('[webhook] verificação recusada: token inválido');
    return res.sendStatus(403);
  });

  /**
   * @openapi
   * /webhook:
   *   post:
   *     tags: [Webhook Meta]
   *     summary: Recebimento de mensagens do WhatsApp
   *     description: >
   *       Chamado pela Meta a cada evento (mensagem recebida, recibo de status, etc.).
   *       Valida a assinatura **X-Hub-Signature-256** (HMAC-SHA256 com `META_APP_SECRET`)
   *       antes de processar. Sempre responde **200 imediatamente** para payloads
   *       autênticos. Mensagens recebidas são convertidas no DTO `Message` e emitidas
   *       via Socket.io no evento `new-message`. Eventos de status (entregue/lido) são ignorados.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/MetaWebhookPayload'
   *           example:
   *             object: whatsapp_business_account
   *             entry:
   *               - id: "123456789"
   *                 changes:
   *                   - field: messages
   *                     value:
   *                       messaging_product: whatsapp
   *                       metadata:
   *                         display_phone_number: "5511987654321"
   *                         phone_number_id: "999888777"
   *                       contacts:
   *                         - wa_id: "5511999998888"
   *                           profile:
   *                             name: Maria Silva
   *                       messages:
   *                         - id: wamid.TESTE123
   *                           from: "5511999998888"
   *                           timestamp: "1786838400"
   *                           type: text
   *                           text:
   *                             body: Olá, gostaria de agendar uma fisioterapia
   *     responses:
   *       200:
   *         description: Evento aceito (o processamento é assíncrono)
   *       403:
   *         description: Assinatura X-Hub-Signature-256 inválida (payload não veio da Meta)
   */
  router.post('/', (req, res) => {
    if (!verifyMetaSignature(req)) {
      console.warn('[webhook] assinatura X-Hub-Signature-256 inválida — payload rejeitado');
      return res.sendStatus(403);
    }

    res.sendStatus(200);

    try {
      const messages = parseMetaPayload(req.body);

      for (const message of messages) {
        console.log(`[webhook] nova mensagem de ${message.from} (${message.name ?? 'sem nome'}): "${message.text}"`);
        addMessage(message);
        io.emit('new-message', message);
      }
    } catch (error) {
      console.error('[webhook] erro ao processar payload:', error);
    }
  });

  return router;
}
