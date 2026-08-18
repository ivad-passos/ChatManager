import { Router } from 'express';
import { listConversations, listMessages } from '../services/store.js';
import { sendTemplateMessage, sendTextMessage } from '../services/meta.js';

export function createChatRouter() {
  const router = Router();

  /**
   * @openapi
   * /conversations:
   *   get:
   *     tags: [Chat (teste sem frontend)]
   *     summary: Lista as conversas recentes
   *     description: >
   *       Agrupa as mensagens recebidas pelo webhook por contato (wa_id),
   *       ordenadas da mais recente para a mais antiga.
   *       Use o `waId` retornado aqui como parâmetro `to` no envio de mensagens.
   *       Os dados ficam em memória e são perdidos a cada restart/redeploy.
   *     responses:
   *       200:
   *         description: Lista de conversas (vazia se nenhuma mensagem chegou ainda)
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Conversation'
   */
  router.get('/conversations', (_req, res) => {
    res.json(listConversations());
  });

  /**
   * @openapi
   * /messages:
   *   get:
   *     tags: [Chat (teste sem frontend)]
   *     summary: Lista as mensagens recebidas
   *     description: >
   *       Retorna as mensagens que chegaram pelo webhook (DTO `Message`).
   *       Use o parâmetro `from` para filtrar por um contato específico.
   *       Os dados ficam em memória e são perdidos a cada restart/redeploy.
   *     parameters:
   *       - in: query
   *         name: from
   *         required: false
   *         description: Filtra mensagens de um contato (wa_id, ex. 5511999998888)
   *         schema:
   *           type: string
   *           example: "5511999998888"
   *     responses:
   *       200:
   *         description: Lista de mensagens recebidas
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Message'
   */
  router.get('/messages', (req, res) => {
    res.json(listMessages({ from: req.query.from }));
  });

  /**
   * @openapi
   * /messages:
   *   post:
   *     tags: [Chat (teste sem frontend)]
   *     summary: Envia mensagem de texto via Cloud API
   *     description: >
   *       Envia texto livre para um contato usando as credenciais
   *       `META_ACCESS_TOKEN` e `META_PHONE_NUMBER_ID` do ambiente.
   *       **Atenção:** a Meta só permite texto livre dentro da janela de 24h
   *       após a última mensagem do cliente. Fora dela, use `POST /messages/template`.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/SendTextInput'
   *           example:
   *             to: "5511999998888"
   *             text: Oi, tudo bom?
   *     responses:
   *       200:
   *         description: Mensagem aceita pela Meta (retorna o wamid)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/MetaSendResponse'
   *       400:
   *         description: Campos obrigatórios ausentes
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Credenciais da Meta não configuradas no ambiente
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       502:
   *         description: A Meta recusou o envio (detalhes no campo `details`)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.post('/messages', async (req, res) => {
    const { to, text } = req.body ?? {};

    if (!to || !text) {
      return res.status(400).json({ error: 'Campos "to" e "text" são obrigatórios.' });
    }

    try {
      const result = await sendTextMessage(to, text);
      console.log(`[chat] mensagem enviada para ${to}: "${text}"`);
      return res.json(result);
    } catch (error) {
      console.error('[chat] erro ao enviar mensagem:', error.details ?? error.message);
      return res.status(error.status ?? 500).json({ error: error.message, details: error.details });
    }
  });

  /**
   * @openapi
   * /messages/template:
   *   post:
   *     tags: [Chat (teste sem frontend)]
   *     summary: Envia mensagem de template via Cloud API
   *     description: >
   *       Envia um template aprovado (ex.: `hello_world`, que todo app de teste possui).
   *       Necessário para iniciar conversa **fora da janela de 24h**.
   *       O `languageCode` deve bater com o idioma do template na Meta
   *       (`hello_world` de teste costuma ser `en_US`).
   *       Use `components` para preencher variáveis do template (header/body/botões),
   *       seguindo o formato oficial da Cloud API — veja o schema `SendTemplateInput`.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/SendTemplateInput'
   *           example:
   *             to: "5511999998888"
   *             templateName: hello_world
   *             languageCode: en_US
   *     responses:
   *       200:
   *         description: Template aceito pela Meta (retorna o wamid)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/MetaSendResponse'
   *       400:
   *         description: Campos obrigatórios ausentes
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Credenciais da Meta não configuradas no ambiente
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       502:
   *         description: A Meta recusou o envio (detalhes no campo `details`)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.post('/messages/template', async (req, res) => {
    const { to, templateName, languageCode, components } = req.body ?? {};

    if (!to || !templateName) {
      return res.status(400).json({ error: 'Campos "to" e "templateName" são obrigatórios.' });
    }

    try {
      const result = await sendTemplateMessage(to, templateName, languageCode, components);
      console.log(`[chat] template "${templateName}" enviado para ${to}`);
      return res.json(result);
    } catch (error) {
      console.error('[chat] erro ao enviar template:', error.details ?? error.message);
      return res.status(error.status ?? 500).json({ error: error.message, details: error.details });
    }
  });

  return router;
}
