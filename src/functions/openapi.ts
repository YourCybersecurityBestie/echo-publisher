import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { buildOpenApi } from '../lib/openapi-spec.js';

export async function openapi(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const host = request.headers.get('host') ?? 'func-echo-publisher.azurewebsites.net';
  return { jsonBody: buildOpenApi(host) };
}

app.http('openapi', {
  route: 'openapi.json',
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: openapi
});
