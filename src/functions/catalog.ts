import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { readCatalog } from '../lib/catalog.js';
import { userSlug } from '../lib/slug.js';

export async function getCatalog(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const userId = request.query.get('userId');
  const limit = parseInt(request.query.get('limit') ?? '200', 10) || 200;
  if (!userId) {
    return { status: 400, jsonBody: { error: 'userId is required' } };
  }
  const slug = userSlug(userId);
  const records = await readCatalog(slug);
  return { jsonBody: { items: records.slice(0, limit) } };
}

app.http('getCatalog', {
  route: 'catalog',
  methods: ['GET'],
  authLevel: 'function',
  handler: getCatalog
});
