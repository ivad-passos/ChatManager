/**
 * Cliente mínimo da WhatsApp Cloud API (Graph API da Meta).
 * Documentação: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
 * Templates: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
 */

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v22.0';

// Limite oficial da Meta para o corpo de mensagens de texto livre.
const TEXT_BODY_MAX_LENGTH = 4096;

function getConfig() {
  const { META_ACCESS_TOKEN, META_PHONE_NUMBER_ID } = process.env;

  if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) {
    const error = new Error(
      'META_ACCESS_TOKEN e META_PHONE_NUMBER_ID precisam estar configurados nas variáveis de ambiente para enviar mensagens.'
    );
    error.status = 500;
    throw error;
  }

  return { token: META_ACCESS_TOKEN, phoneNumberId: META_PHONE_NUMBER_ID };
}

/**
 * Normaliza o número do destinatário para o formato esperado pela Cloud API:
 * apenas dígitos, com código do país, sem espaços/traços/parênteses
 * (a Meta trata isso como o `wa_id`; o prefixo "+" é opcional e é removido
 * aqui para manter consistência com o `wa_id` recebido nos webhooks).
 */
function normalizeRecipient(to) {
  return String(to).replace(/[^\d]/g, '');
}

async function callMeta(payload) {
  const { token, phoneNumberId } = getConfig();
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data?.error?.message ?? `Meta respondeu HTTP ${response.status}`);
    error.status = 502;
    error.details = data?.error ?? data;
    throw error;
  }

  return data;
}

/**
 * Envia mensagem de texto livre. Só funciona dentro da janela de 24h
 * após a última mensagem do cliente (regra da Meta).
 */
export function sendTextMessage(to, text) {
  if (text.length > TEXT_BODY_MAX_LENGTH) {
    const error = new Error(
      `O corpo da mensagem excede o limite de ${TEXT_BODY_MAX_LENGTH} caracteres da Cloud API (recebido: ${text.length}).`
    );
    error.status = 400;
    throw error;
  }

  return callMeta({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizeRecipient(to),
    type: 'text',
    text: { body: text },
  });
}

/**
 * Envia mensagem de template (ex.: 'hello_world'). Necessária para
 * iniciar conversa fora da janela de 24h.
 *
 * `components` segue o formato oficial da Cloud API para preencher variáveis
 * do template (header/body/botões), por exemplo:
 * [{ type: 'body', parameters: [{ type: 'text', text: 'Maria' }] }]
 */
export function sendTemplateMessage(to, templateName, languageCode = 'en_US', components) {
  return callMeta({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizeRecipient(to),
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components?.length ? { components } : {}),
    },
  });
}
