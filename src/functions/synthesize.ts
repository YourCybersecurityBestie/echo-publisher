import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { createJob } from '../lib/jobs.js';

const Body = z.object({
  ssml: z.string().min(1).max(102400),
  userId: z.string().email()
});

/**
 * LRO start: accept SSML, queue a synthesis job, return 202 with a Location
 * header pointing at the status endpoint. Power Platform / Copilot Studio
 * connectors auto-poll the Location URL until they get a non-202 response,
 * bypassing the 30s synchronous connector timeout.
 */
export async function synthesize(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return { status: 400, jsonBody: { error: 'Invalid input', issues: parsed.error.issues } };
  }
  const { ssml, userId } = parsed.data;

  const jobId = uuidv4();
  await createJob(jobId, userId, ssml);

  const origin = new URL(request.url).origin;
  const statusUrl = `${origin}/api/synthesize/status/${jobId}`;
  context.log(`queued synth job ${jobId} for ${userId}`);

  return {
    status: 202,
    headers: {
      Location: statusUrl,
      'Retry-After': '10'
    },
    jsonBody: { jobId, status: 'queued', statusUrl }
  };
}

app.http('synthesize', {
  route: 'synthesize',
  methods: ['POST'],
  authLevel: 'function',
  handler: synthesize
});
