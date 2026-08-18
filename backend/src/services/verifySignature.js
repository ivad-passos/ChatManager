/**
 * Validação da assinatura X-Hub-Signature-256, exigida pela Meta para
 * confirmar que o payload do webhook realmente veio da Graph API.
 * Docs: https://developers.facebook.com/docs/messenger-platform/webhooks#security
 *
 * A Meta assina o corpo bruto (rawBody) da requisição com HMAC-SHA256,
 * usando o App Secret do app cadastrado no painel Meta for Developers.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyMetaSignature(req) {
  const appSecret = process.env.META_APP_SECRET;

  // Sem App Secret configurado, a validação é pulada (ex.: dev local sem HTTPS
  // público). Em produção, META_APP_SECRET deve estar sempre definido.
  if (!appSecret) return true;

  const signatureHeader = req.get('X-Hub-Signature-256');
  if (!signatureHeader || !req.rawBody) return false;

  const [algorithm, receivedHash] = signatureHeader.split('=');
  if (algorithm !== 'sha256' || !receivedHash) return false;

  const expectedHash = createHmac('sha256', appSecret).update(req.rawBody).digest('hex');

  const receivedBuffer = Buffer.from(receivedHash, 'hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');

  if (receivedBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}
