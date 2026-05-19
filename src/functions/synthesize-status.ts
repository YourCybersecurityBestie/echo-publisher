import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getJob } from '../lib/jobs.js';

export async function synthesizeStatus(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const jobId = request.params.jobId;
  if (!jobId) return { status: 400, jsonBody: { error: 'jobId required' } };

  const job = await getJob(jobId);
  if (!job) return { status: 404, jsonBody: { error: 'job not found', jobId } };

  context.log(`status ${jobId}: ${job.status}`);

  switch (job.status) {
    case 'queued':
    case 'running':
      return {
        status: 202,
        headers: { 'Retry-After': '10' },
        jsonBody: { jobId, status: job.status }
      };
    case 'done':
      return {
        status: 200,
        jsonBody: { jobId, status: 'done', mp3Url: job.mp3Url, durationSeconds: job.durationSeconds }
      };
    case 'failed':
      return {
        status: 500,
        jsonBody: { jobId, status: 'failed', error: job.error ?? 'unknown' }
      };
  }
}

app.http('synthesizeStatus', {
  route: 'synthesize/status/{jobId}',
  methods: ['GET'],
  authLevel: 'function',
  handler: synthesizeStatus
});
