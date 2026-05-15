import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { readBlobText, writeBlobText } from '../lib/blob.js';
import { appendCatalog } from '../lib/catalog.js';
import { appendItem, buildFeed, parseFeed } from '../lib/rss.js';
import { userSlug } from '../lib/slug.js';
import { trackPublish } from '../lib/telemetry.js';

const Body = z.object({
  mp3Url: z.string().url(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  userId: z.string().email(),
  durationSeconds: z.number().int().positive(),
  sourceUrl: z.string().url().optional(),
  topic: z.string().optional(),
  takeaway: z.string().optional()
});

export async function createEpisode(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const start = Date.now();
  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return { status: 400, jsonBody: { error: 'Invalid input', issues: parsed.error.issues } };
  }
  const data = parsed.data;
  const slug = userSlug(data.userId);
  const episodeId = uuidv4();
  const swaUrl = process.env.STATIC_WEB_APP_URL ?? '';
  const coverUrl = process.env.DEFAULT_COVER_URL ?? '';

  const feedBlobName = `users/${slug}/feed.xml`;
  const existingXml = await readBlobText(feedBlobName);
  const existingDoc = existingXml ? parseFeed(existingXml) : null;

  const updated = appendItem(
    existingDoc,
    {
      guid: episodeId,
      title: data.title,
      description: data.description,
      pubDate: new Date().toUTCString(),
      enclosureUrl: data.mp3Url,
      enclosureLength: 0,
      durationSeconds: data.durationSeconds
    },
    {
      title: 'Echo — Personal Edition',
      description: 'AI-generated podcast episodes from articles you share.',
      link: `${swaUrl}/feed`,
      coverUrl
    }
  );

  await writeBlobText(feedBlobName, buildFeed(updated), 'application/rss+xml');

  await appendCatalog(slug, {
    episodeId,
    title: data.title,
    description: data.description,
    publishedAt: new Date().toISOString(),
    durationSeconds: data.durationSeconds,
    sourceUrl: data.sourceUrl,
    topic: data.topic,
    takeaway: data.takeaway
  });

  const listenUrl = `${swaUrl}/listen/${slug}/${episodeId}`;
  const rssFeedUrl = `${process.env.STORAGE_BLOB_ENDPOINT}echo-audio/users/${slug}/feed.xml`;

  trackPublish({ episodeId, userSlug: slug, durationMs: Date.now() - start });
  context.log(`published episode ${episodeId} for ${slug}`);
  return { jsonBody: { episodeId, listenUrl, rssFeedUrl } };
}

app.http('createEpisode', {
  route: 'episodes',
  methods: ['POST'],
  authLevel: 'function',
  handler: createEpisode
});
