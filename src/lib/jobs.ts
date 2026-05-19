import { DefaultAzureCredential } from '@azure/identity';
import { TableClient, TableServiceClient } from '@azure/data-tables';
import { QueueClient, QueueServiceClient } from '@azure/storage-queue';
import { audioContainer } from './blob.js';

const credential = new DefaultAzureCredential();

// Derive the storage account name from STORAGE_BLOB_ENDPOINT so we don't need
// a second app setting. e.g. https://stechoprodech01.blob.core.windows.net -> stechoprodech01
function deriveAccountName(): string {
  const ep = process.env.STORAGE_BLOB_ENDPOINT;
  if (!ep) throw new Error('STORAGE_BLOB_ENDPOINT is required');
  const host = new URL(ep).hostname;
  const name = host.split('.')[0];
  if (!name) throw new Error(`Cannot derive storage account name from ${ep}`);
  return name;
}

const STORAGE_ACCOUNT_NAME = process.env.STORAGE_ACCOUNT_NAME ?? deriveAccountName();

const TABLE_ENDPOINT = `https://${STORAGE_ACCOUNT_NAME}.table.core.windows.net`;
const QUEUE_ENDPOINT = `https://${STORAGE_ACCOUNT_NAME}.queue.core.windows.net`;

export const SYNTH_TABLE = 'synthjobs';
// Queue name matches the queueTrigger binding in synthesize-worker.ts.
export const SYNTH_QUEUE = 'synth-jobs';
const SSML_BLOB_PREFIX = 'synth-jobs';

let tableEnsured: Promise<void> | undefined;
async function ensureTable(): Promise<void> {
  if (!tableEnsured) {
    tableEnsured = (async () => {
      const svc = new TableServiceClient(TABLE_ENDPOINT, credential);
      await svc.createTable(SYNTH_TABLE).catch((err: unknown) => {
        const e = err as { statusCode?: number };
        if (e.statusCode !== 409) throw err;
      });
    })().catch((err) => { tableEnsured = undefined; throw err; });
  }
  return tableEnsured;
}

let queueEnsured: Promise<void> | undefined;
async function ensureQueue(): Promise<void> {
  if (!queueEnsured) {
    queueEnsured = (async () => {
      const svc = new QueueServiceClient(QUEUE_ENDPOINT, credential);
      await svc.createQueue(SYNTH_QUEUE).catch((err: unknown) => {
        const e = err as { statusCode?: number };
        if (e.statusCode !== 409) throw err;
      });
    })().catch((err) => { queueEnsured = undefined; throw err; });
  }
  return queueEnsured;
}

function tableClient(): TableClient {
  return new TableClient(TABLE_ENDPOINT, SYNTH_TABLE, credential);
}

function queueClient(): QueueClient {
  return new QueueClient(`${QUEUE_ENDPOINT}/${SYNTH_QUEUE}`, credential);
}

export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface SynthJob {
  jobId: string;
  status: JobStatus;
  userId: string;
  createdAt: string;
  updatedAt: string;
  mp3Url?: string;
  durationSeconds?: number;
  error?: string;
}

interface JobEntity {
  partitionKey: string;
  rowKey: string;
  status: JobStatus;
  userId: string;
  createdAt: string;
  updatedAt: string;
  mp3Url?: string;
  durationSeconds?: number;
  error?: string;
}

function toJob(e: JobEntity): SynthJob {
  return {
    jobId: e.rowKey,
    status: e.status,
    userId: e.userId,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    mp3Url: e.mp3Url,
    durationSeconds: e.durationSeconds,
    error: e.error
  };
}

export async function createJob(jobId: string, userId: string, ssml: string): Promise<void> {
  // Store SSML in blob (Table column limit is 64 KiB per property, SSML can exceed).
  await audioContainer().getBlockBlobClient(`${SSML_BLOB_PREFIX}/${jobId}.ssml`).upload(
    ssml,
    Buffer.byteLength(ssml, 'utf8'),
    { blobHTTPHeaders: { blobContentType: 'application/ssml+xml' } }
  );

  await ensureTable();
  const now = new Date().toISOString();
  await tableClient().createEntity<JobEntity>({
    partitionKey: 'synth',
    rowKey: jobId,
    status: 'queued',
    userId,
    createdAt: now,
    updatedAt: now
  });

  await ensureQueue();
  // Queue triggers expect base64-encoded messages by default in Functions v4.
  const payload = Buffer.from(JSON.stringify({ jobId })).toString('base64');
  await queueClient().sendMessage(payload);
}

export async function getJob(jobId: string): Promise<SynthJob | null> {
  try {
    const e = await tableClient().getEntity<JobEntity>('synth', jobId);
    return toJob(e);
  } catch (err) {
    const e = err as { statusCode?: number };
    if (e.statusCode === 404) return null;
    throw err;
  }
}

export async function readJobSsml(jobId: string): Promise<string> {
  const blob = audioContainer().getBlockBlobClient(`${SSML_BLOB_PREFIX}/${jobId}.ssml`);
  const buf = await blob.downloadToBuffer();
  return buf.toString('utf8');
}

export async function updateJob(
  jobId: string,
  patch: Partial<Pick<JobEntity, 'status' | 'mp3Url' | 'durationSeconds' | 'error'>>
): Promise<void> {
  await tableClient().updateEntity<JobEntity>(
    {
      partitionKey: 'synth',
      rowKey: jobId,
      ...patch,
      updatedAt: new Date().toISOString()
    } as JobEntity,
    'Merge'
  );
}
