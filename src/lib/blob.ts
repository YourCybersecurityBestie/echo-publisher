import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';

const credential = new DefaultAzureCredential();

const storageEndpoint = process.env.STORAGE_BLOB_ENDPOINT;
if (!storageEndpoint) {
  throw new Error('STORAGE_BLOB_ENDPOINT is required');
}

const blobService = new BlobServiceClient(storageEndpoint, credential);

export const AUDIO_CONTAINER = 'echo-audio';

export function audioContainer(): ContainerClient {
  return blobService.getContainerClient(AUDIO_CONTAINER);
}

export async function readBlobText(blobName: string): Promise<string | null> {
  const blob = audioContainer().getBlockBlobClient(blobName);
  if (!(await blob.exists())) return null;
  const buf = await blob.downloadToBuffer();
  return buf.toString('utf8');
}

export async function writeBlobText(
  blobName: string,
  content: string,
  contentType: string
): Promise<void> {
  const blob = audioContainer().getBlockBlobClient(blobName);
  await blob.upload(content, Buffer.byteLength(content, 'utf8'), {
    blobHTTPHeaders: { blobContentType: contentType }
  });
}

export async function uploadMp3(
  blobName: string,
  data: Buffer
): Promise<string> {
  const blob = audioContainer().getBlockBlobClient(blobName);
  await blob.uploadData(data, {
    blobHTTPHeaders: { blobContentType: 'audio/mpeg' }
  });
  return blob.url;
}

let cachedSecretClient: SecretClient | undefined;
function secretClient(): SecretClient {
  if (cachedSecretClient) return cachedSecretClient;
  const vaultName = process.env.KEY_VAULT_NAME;
  if (!vaultName) throw new Error('KEY_VAULT_NAME is required');
  cachedSecretClient = new SecretClient(`https://${vaultName}.vault.azure.net`, credential);
  return cachedSecretClient;
}

export async function getSecret(name: string): Promise<string> {
  const s = await secretClient().getSecret(name);
  if (!s.value) throw new Error(`Secret ${name} has no value`);
  return s.value;
}
