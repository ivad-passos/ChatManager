/**
 * Armazenamento em memória das mensagens recebidas via webhook.
 *
 * Permite testar a integração (ver mensagens e conversas recentes no Swagger)
 * sem precisar do frontend. ATENÇÃO: os dados somem a cada restart/redeploy
 * do serviço — não é um banco de dados.
 */

// Limite para não estourar a memória do plano gratuito do Render.
const MAX_MESSAGES = 200;

const messages = [];

export function addMessage(message) {
  messages.push(message);
  if (messages.length > MAX_MESSAGES) {
    messages.shift();
  }
}

export function listMessages({ from } = {}) {
  if (!from) return [...messages];
  return messages.filter((message) => message.from === from);
}

export function listConversations() {
  const byContact = new Map();

  for (const message of messages) {
    const conversation = byContact.get(message.from) ?? {
      waId: message.from,
      name: message.name ?? null,
      messageCount: 0,
      lastMessage: null,
      lastTimestamp: 0,
    };

    conversation.messageCount += 1;
    conversation.name = conversation.name ?? message.name ?? null;

    if (message.timestamp >= conversation.lastTimestamp) {
      conversation.lastTimestamp = message.timestamp;
      conversation.lastMessage = message.text;
    }

    byContact.set(message.from, conversation);
  }

  return [...byContact.values()].sort((a, b) => b.lastTimestamp - a.lastTimestamp);
}
