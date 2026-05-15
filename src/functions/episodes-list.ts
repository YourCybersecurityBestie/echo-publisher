import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { readBlobText } from '../lib/blob.js';
import { listItems, parseFeed } from '../lib/rss.js';
import { userSlug } from '../lib/slug.js';

export async function listEpisodes(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const userId = request.query.get('userId');
  const limit = parseInt(request.query.get('limit') ?? '5', 10) || 5;
  if (!userId) {
    return { status: 400, jsonBody: { error: 'userId is required' } };
  }
  const slug = userSlug(userId);
  const xml = await readBlobText(`users/${slug}/feed.xml`);
  if (!xml) {
    return { jsonBody: { items: [] } };
  }
  const doc = parseFeed(xml);
  return { jsonBody: { items: listItems(doc, limit) } };
}

app.http('listEpisodes', {
  route: 'episodes',
  methods: ['GET'],
  authLevel: 'function',
  handler: listEpisodes
});
