import { DefaultAzureCredential } from '@azure/identity';

const SPEECH_REGION = process.env.SPEECH_REGION ?? 'westeurope';
const credential = new DefaultAzureCredential();

let cachedToken: { token: string; expiresAt: number } | undefined;

/**
 * Exchange an AAD token for a 10-minute Speech service authorization token.
 * The Function App's managed identity holds Cognitive Services Speech User on
 * spch-echo-prod (granted by infra/modules/rbac.bicep). No keys involved.
 */
async function getSpeechToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.token;

  const aad = await credential.getToken('https://cognitiveservices.azure.com/.default');
  if (!aad?.token) throw new Error('Failed to acquire AAD token for Cognitive Services');

  const issueUrl = `https://${SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
  const res = await fetch(issueUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${aad.token}`, 'Content-Length': '0' }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Speech token issue failed: ${res.status} ${res.statusText} ${body}`);
  }
  const speechToken = await res.text();
  // Tokens last 10 minutes; refresh at 9 to stay safely in window.
  cachedToken = { token: speechToken, expiresAt: now + 9 * 60_000 };
  return speechToken;
}

/**
 * Synthesize SSML to MP3 using Azure AI Speech REST API with managed identity.
 * Returns the raw MP3 bytes.
 */
export async function synthesizeSsmlToMp3(ssml: string): Promise<Buffer> {
  const token = await getSpeechToken();
  const url = `https://${SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
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
