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
          summary: 'Start an async SSML-to-MP3 synthesis job. Returns 202; poll the Location URL until 200.',
          'x-ms-long-running-operation': true,
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SynthesizeRequest' } } }
          },
          responses: {
            '202': {
              description: 'Accepted. Job queued; poll the Location URL for completion.',
              headers: {
                Location: { schema: { type: 'string', format: 'uri' }, description: 'Polling URL.' },
                'Retry-After': { schema: { type: 'integer' }, description: 'Seconds to wait before polling.' }
              },
              content: { 'application/json': { schema: { $ref: '#/components/schemas/SynthesizeAccepted' } } }
            },
            '400': { description: 'Invalid input' }
          }
        }
      },
      '/synthesize/status/{jobId}': {
        get: {
          operationId: 'synthesizeStatus',
          summary: 'Poll a synthesis job. Returns 202 while running, 200 when done.',
          parameters: [
            { name: 'jobId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            '202': {
              description: 'Job still running.',
              headers: {
                'Retry-After': { schema: { type: 'integer' } }
              },
              content: { 'application/json': { schema: { $ref: '#/components/schemas/SynthesizeAccepted' } } }
            },
            '200': {
              description: 'Job complete.',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/SynthesizeResponse' } } }
            },
            '404': { description: 'Job not found' },
            '500': { description: 'Job failed' }
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
        SynthesizeAccepted: {
          type: 'object',
          properties: {
            jobId: { type: 'string' },
            status: { type: 'string', enum: ['queued', 'running'] },
            statusUrl: { type: 'string', format: 'uri' }
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
