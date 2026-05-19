import { app, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { uploadMp3 } from '../lib/blob.js';
import { getMp3DurationSeconds } from '../lib/ffprobe.js';
import { getJob, readJobSsml, updateJob } from '../lib/jobs.js';
import { userSlug } from '../lib/slug.js';
import { synthesizeSsmlToMp3 } from '../lib/speech.js';

interface QueueMessage {
  jobId: string;
}

export async function synthesizeWorker(message: unknown, context: InvocationContext): Promise<void> {
  // Storage queue trigger decodes base64 messages into the configured shape.
  // We allow either an already-parsed object or a JSON string.
  let payload: QueueMessage;
  if (typeof message === 'string') {
    payload = JSON.parse(message) as QueueMessage;
  } else {
    payload = message as QueueMessage;
  }
  const { jobId } = payload;
  if (!jobId) throw new Error('queue message missing jobId');

  context.log(`worker starting job ${jobId}`);

  const job = await getJob(jobId);
  if (!job) throw new Error(`job ${jobId} not found`);

  try {
    await updateJob(jobId, { status: 'running' });

    const ssml = await readJobSsml(jobId);
    const mp3 = await synthesizeSsmlToMp3(ssml);

    const slug = userSlug(job.userId);
    const blobName = `users/${slug}/audio/${uuidv4()}.mp3`;
    const mp3Url = await uploadMp3(blobName, mp3);
    const durationSeconds = await getMp3DurationSeconds(mp3);

    await updateJob(jobId, { status: 'done', mp3Url, durationSeconds });
    context.log(`worker finished job ${jobId}: ${mp3.length} bytes, ${durationSeconds}s`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    context.error(`worker failed job ${jobId}: ${msg}`);
    await updateJob(jobId, { status: 'failed', error: msg }).catch(() => undefined);
    throw err;
  }
}

app.storageQueue('synthesizeWorker', {
  queueName: 'synth-jobs',
  connection: 'AzureWebJobsStorage',
  handler: synthesizeWorker
});
