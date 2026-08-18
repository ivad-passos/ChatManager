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
        '### Testando a integração sem o frontend',
        '1. Envie uma mensagem do seu WhatsApp para o número de teste da Meta.',
        '2. Veja-a em **GET /conversations** e **GET /messages**.',
        '3. Responda pelo **POST /messages** (texto livre, janela de 24h)',
        '   ou **POST /messages/template** (fora da janela, ex.: `hello_world`).',
        '',
        '### Tempo real (WebSocket)',
        'O OpenAPI/Swagger documenta apenas HTTP. O frontend também deve se conectar via Socket.io',
        'e ouvir o evento **`new-message`**, cujo payload segue o schema `Message` (ver *Schemas* abaixo).',
        '',
        '### ⚠️ Formato do número (`wa_id`)',
        'Toda vez que um número de telefone aparece como `wa_id` — nos campos `from`/`waId` que a API',
        'devolve, ou nos campos `to` que você envia — o formato é **DDD + número, concatenados, sem o',
        '`+` e sem o 9º dígito inicial** do número de celular brasileiro.',
        'Exemplo: `+55 11 98765-4321` vira `551187654321` (não `5511987654321`).',
        'O `GET /messages?from=` e a comparação usada em `GET /conversations` fazem correspondência',
        'exata — buscar com o 9 incluído não encontra a conversa. Use sempre o `waId`/`from` retornado',
        'por `GET /conversations` ou `GET /messages` como fonte da verdade, em vez de digitar o número',
        'manualmente.',
      ].join('\n'),
    },
    servers,
    tags: [
      { name: 'Webhook Meta', description: 'Rotas consumidas pela Cloud API da Meta' },
      {
        name: 'Chat (teste sem frontend)',
        description:
          'Rotas para testar a integração de ponta a ponta pelo Swagger: ver mensagens recebidas e enviar mensagens via Cloud API.',
      },
      { name: 'Util', description: 'Rotas utilitárias' },
    ],
    components: {
      schemas: {
        Message: {
          type: 'object',
          description: 'DTO emitido no evento Socket.io `new-message`',
          properties: {
            id: { type: 'string', example: 'wamid.TESTE123' },
            from: {
              type: 'string',
              description:
                'wa_id do remetente: DDD + número concatenados, sem "+" e sem o 9º dígito ' +
                'inicial de celulares brasileiros (ex.: +55 11 98765-4321 vira "551187654321").',
              example: '5511999998888',
            },
            name: { type: 'string', nullable: true, example: 'Maria Silva' },
            text: { type: 'string', example: 'Olá, gostaria de agendar uma fisioterapia' },
            timestamp: { type: 'integer', example: 1786838400 },
          },
        },
        Conversation: {
          type: 'object',
          description: 'Resumo de uma conversa, agrupado por contato (wa_id)',
          properties: {
            waId: {
              type: 'string',
              description:
                'DDD + número concatenados, sem "+" e sem o 9º dígito inicial de celulares ' +
                'brasileiros (ex.: +55 11 98765-4321 vira "551187654321"). Use este valor, e não ' +
                'o número digitado manualmente, como "to" nas rotas de envio ou "from" no filtro de GET /messages.',
              example: '5511999998888',
            },
            name: { type: 'string', nullable: true, example: 'Maria Silva' },
            messageCount: { type: 'integer', example: 3 },
            lastMessage: { type: 'string', example: 'Olá, gostaria de agendar uma fisioterapia' },
            lastTimestamp: { type: 'integer', example: 1786838400 },
          },
        },
        SendTextInput: {
          type: 'object',
          required: ['to', 'text'],
          properties: {
            to: {
              type: 'string',
              description:
                'wa_id do destinatário: DDD + número concatenados, sem "+" e sem o 9º dígito ' +
                'inicial de celulares brasileiros (ex.: +55 11 98765-4321 vira "551187654321"). ' +
                'Prefira copiar o "waId" retornado por GET /conversations em vez de digitar o número.',
              example: '5511999998888',
            },
            text: { type: 'string', example: 'Oi, tudo bom?' },
          },
        },
        SendTemplateInput: {
          type: 'object',
          required: ['to', 'templateName'],
          properties: {
            to: {
              type: 'string',
              description:
                'wa_id do destinatário: DDD + número concatenados, sem "+" e sem o 9º dígito ' +
                'inicial de celulares brasileiros (ex.: +55 11 98765-4321 vira "551187654321"). ' +
                'Prefira copiar o "waId" retornado por GET /conversations em vez de digitar o número.',
              example: '5511999998888',
            },
            templateName: {
              type: 'string',
              description: 'Nome do template aprovado no painel da Meta',
              example: 'hello_world',
            },
            languageCode: {
              type: 'string',
              description: 'Idioma do template (opcional, padrão en_US)',
              example: 'en_US',
            },
            components: {
              type: 'array',
              description:
                'Preenchimento das variáveis do template (opcional). ' +
                'Formato oficial da Cloud API: um item por seção do template ' +
                '(header/body/button) com seus respectivos parameters.',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['header', 'body', 'button'], example: 'body' },
                  sub_type: {
                    type: 'string',
                    description: 'Obrigatório apenas quando type = "button" (ex.: quick_reply, url)',
                    example: 'quick_reply',
                  },
                  index: {
                    type: 'string',
                    description: 'Obrigatório apenas quando type = "button" (posição do botão, começando em 0)',
                    example: '0',
                  },
                  parameters: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type: { type: 'string', example: 'text' },
                        text: { type: 'string', example: 'Maria' },
                      },
                    },
                  },
                },
              },
              example: [
                { type: 'body', parameters: [{ type: 'text', text: 'Maria' }] },
              ],
            },
          },
        },
        MetaSendResponse: {
          type: 'object',
          description: 'Resposta de sucesso da Cloud API ao aceitar uma mensagem',
          properties: {
            messaging_product: { type: 'string', example: 'whatsapp' },
            contacts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  input: { type: 'string', example: '5511999998888' },
                  wa_id: { type: 'string', example: '5511999998888' },
                },
              },
            },
            messages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'wamid.HBgNNTUxMTk5OTk5ODg4OBUCABIYFjNFQjBDMEMxRjY5OTlFOEUzAA==' },
                },
              },
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Campos "to" e "text" são obrigatórios.' },
            details: {
              type: 'object',
              description: 'Detalhes do erro retornados pela Meta (quando houver)',
              nullable: true,
            },
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
