import swaggerJsdoc from 'swagger-jsdoc';

// Render injeta RENDER_EXTERNAL_URL automaticamente em produção.
// Em desenvolvimento, cai no localhost.
const servers = process.env.RENDER_EXTERNAL_URL
  ? [
      { url: process.env.RENDER_EXTERNAL_URL, description: 'Produção (Render)' },
      { url: 'http://localhost:3001', description: 'Desenvolvimento local' },
    ]
  : [{ url: 'http://localhost:3001', description: 'Desenvolvimento local' }];

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'PhysioVilas ChatManager API',
      version: '1.0.0',
      description: [
        'Backend do Painel de Atendimento WhatsApp da Clínica PhysioVilas.',
        '',
        'Responsável por receber os eventos da **API Oficial da Meta (Cloud API)** via webhook',
        'e repassá-los em tempo real ao frontend (Next.js na Vercel) via **Socket.io**.',
        '',
        '### Tempo real (WebSocket)',
        'O OpenAPI/Swagger documenta apenas HTTP. O frontend também deve se conectar via Socket.io',
        'e ouvir o evento **`new-message`**, cujo payload segue o schema `Message` (ver *Schemas* abaixo).',
      ].join('\n'),
    },
    servers,
    tags: [
      { name: 'Webhook Meta', description: 'Rotas consumidas pela Cloud API da Meta' },
      { name: 'Util', description: 'Rotas utilitárias' },
    ],
    components: {
      schemas: {
        Message: {
          type: 'object',
          description: 'DTO emitido no evento Socket.io `new-message`',
          properties: {
            id: { type: 'string', example: 'wamid.TESTE123' },
            from: { type: 'string', example: '5511999998888' },
            name: { type: 'string', nullable: true, example: 'Maria Silva' },
            text: { type: 'string', example: 'Olá, gostaria de agendar uma fisioterapia' },
            timestamp: { type: 'integer', example: 1786838400 },
          },
        },
        MetaWebhookPayload: {
          type: 'object',
          description: 'Payload original enviado pela Meta (versão simplificada)',
          properties: {
            object: { type: 'string', example: 'whatsapp_business_account' },
            entry: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: '123456789' },
                  changes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        field: { type: 'string', example: 'messages' },
                        value: { $ref: '#/components/schemas/MetaWebhookValue' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        MetaWebhookValue: {
          type: 'object',
          properties: {
            messaging_product: { type: 'string', example: 'whatsapp' },
            metadata: {
              type: 'object',
              properties: {
                display_phone_number: { type: 'string', example: '5511987654321' },
                phone_number_id: { type: 'string', example: '999888777' },
              },
            },
            contacts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  wa_id: { type: 'string', example: '5511999998888' },
                  profile: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', example: 'Maria Silva' },
                    },
                  },
                },
              },
            },
            messages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'wamid.TESTE123' },
                  from: { type: 'string', example: '5511999998888' },
                  timestamp: { type: 'string', example: '1786838400' },
                  type: { type: 'string', example: 'text' },
                  text: {
                    type: 'object',
                    properties: {
                      body: { type: 'string', example: 'Olá!' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.js', './src/index.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
