import { getSecret } from './blob.js';

const SPEECH_REGION = process.env.SPEECH_REGION ?? 'westeurope';

let cachedKey: string | undefined;
async function speechKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  // Stored in Key Vault as secret name `speech-key`; populated post-deploy.
  cachedKey = await getSecret('speech-key');
  return cachedKey;
}

/**
 * Synthesize SSML to MP3 using Azure AI Speech REST API.
 * Returns the raw MP3 bytes.
 */
export async function synthesizeSsmlToMp3(ssml: string): Promise<Buffer> {
  const key = await speechKey();
  const url = `https://${SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-48khz-192kbitrate-mono-mp3',
      'User-Agent': 'echo-publisher/0.1'
    },
    body: ssml
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Speech synthesis failed: ${response.status} ${response.statusText} ${text}`);
  }

  const arr = await response.arrayBuffer();
  return Buffer.from(arr);
}
