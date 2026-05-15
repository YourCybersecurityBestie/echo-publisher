import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { uploadMp3 } from '../lib/blob.js';
import { getMp3DurationSeconds } from '../lib/ffprobe.js';
import { userSlug } from '../lib/slug.js';
import { synthesizeSsmlToMp3 } from '../lib/speech.js';

const Body = z.object({
  ssml: z.string().min(1).max(102400),
  userId: z.string().email()
});

export async function synthesize(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return { status: 400, jsonBody: { error: 'Invalid input', issues: parsed.error.issues } };
  }
  const { ssml, userId } = parsed.data;
  const slug = userSlug(userId);

  const mp3 = await synthesizeSsmlToMp3(ssml);
  const blobName = `users/${slug}/audio/${uuidv4()}.mp3`;
  const mp3Url = await uploadMp3(blobName, mp3);
  const durationSeconds = await getMp3DurationSeconds(mp3);

  context.log(`synthesized ${mp3.length} bytes, ${durationSeconds}s for ${slug}`);
  return { jsonBody: { mp3Url, durationSeconds } };
}

app.http('synthesize', {
  route: 'synthesize',
  methods: ['POST'],
  authLevel: 'function',
  handler: synthesize
});
