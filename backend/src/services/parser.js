/**
 * Converte o payload complexo da Meta (Cloud API) em um DTO simples:
 * { id, from, name, text, timestamp }
 *
 * Eventos que não são mensagens recebidas (ex.: recibos de entrega/leitura
 * em `value.statuses`) são ignorados e resultam em uma lista vazia.
 */

const NON_TEXT_PLACEHOLDERS = {
  image: '[imagem]',
  audio: '[áudio]',
  video: '[vídeo]',
  document: '[documento]',
  sticker: '[figurinha]',
  location: '[localização]',
  contacts: '[contato]',
  button: '[botão]',
  interactive: '[resposta interativa]',
  reaction: '[reação]',
};

export function parseMetaPayload(body) {
  if (body?.object !== 'whatsapp_business_account') {
    return [];
  }

  const messages = [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change?.value;
      if (!value?.messages) continue;

      const nameByWaId = new Map(
        (value.contacts ?? []).map((contact) => [contact.wa_id, contact.profile?.name])
      );

      for (const message of value.messages) {
        messages.push({
          id: message.id,
          from: message.from,
          name: nameByWaId.get(message.from) ?? null,
          text: extractText(message),
          timestamp: Number(message.timestamp),
        });
      }
    }
  }

  return messages;
}

function extractText(message) {
  if (message.type === 'text') {
    return message.text?.body ?? '';
  }
  return NON_TEXT_PLACEHOLDERS[message.type] ?? `[mensagem do tipo ${message.type}]`;
}
