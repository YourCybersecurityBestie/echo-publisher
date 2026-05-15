/**
 * Hand-authored OpenAPI 3.0 spec for the Echo Publisher.
 * Consumed by the M365 Copilot API Plugin and by /api/docs (Swagger UI).
 */
export function buildOpenApi(host: string): object {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Echo Publisher',
      description: 'Synthesize SSML to MP3, publish to per-user RSS feed, expose catalog.',
      version: '0.1.0',
      contact: { name: 'Echo', url: 'https://github.com/YourCybersecurityBestie/echo' }
    },
    servers: [{ url: `https://${host}/api`, description: 'Production' }],
    paths: {
      '/synthesize': {
        post: {
          operationId: 'synthesize',
          summary: 'Synthesize SSML to MP3 and store in user blob.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SynthesizeRequest' } } }
          },
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/SynthesizeResponse' } } } },
            '400': { description: 'Invalid input' }
          }
        }
      },
      '/episodes': {
        post: {
          operationId: 'createEpisode',
          summary: 'Append an episode to the user feed and catalog.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/EpisodeRequest' } } }
          },
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/EpisodeResponse' } } } }
          }
        },
        get: {
          operationId: 'listEpisodes',
          summary: 'List the most recent episodes from a user feed.',
          parameters: [
            { name: 'userId', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 5 } }
          ],
          responses: { '200': { description: 'OK' } }
        }
      },
      '/catalog': {
        get: {
          operationId: 'getCatalog',
          summary: 'Return the recent catalog records for a user (consumed by the Bedrock Q&A agent).',
          parameters: [
            { name: 'userId', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 200 } }
          ],
          responses: { '200': { description: 'OK' } }
        }
      }
    },
    components: {
      schemas: {
        SynthesizeRequest: {
          type: 'object',
          required: ['ssml', 'userId'],
          properties: {
            ssml: { type: 'string', maxLength: 102400 },
            userId: { type: 'string', format: 'email' }
          }
        },
        SynthesizeResponse: {
          type: 'object',
          properties: {
            mp3Url: { type: 'string', format: 'uri' },
            durationSeconds: { type: 'integer' }
          }
        },
        EpisodeRequest: {
          type: 'object',
          required: ['mp3Url', 'title', 'description', 'userId', 'durationSeconds'],
          properties: {
            mp3Url: { type: 'string', format: 'uri' },
            title: { type: 'string' },
            description: { type: 'string' },
            userId: { type: 'string', format: 'email' },
            durationSeconds: { type: 'integer' },
            sourceUrl: { type: 'string', format: 'uri' },
            topic: { type: 'string' },
            takeaway: { type: 'string' }
          }
        },
        EpisodeResponse: {
          type: 'object',
          properties: {
            episodeId: { type: 'string' },
            listenUrl: { type: 'string', format: 'uri' },
            rssFeedUrl: { type: 'string', format: 'uri' }
          }
        }
      },
      securitySchemes: {
        functionKey: { type: 'apiKey', in: 'header', name: 'x-functions-key' }
      }
    },
    security: [{ functionKey: [] }]
  };
}
