import { DefaultAzureCredential } from '@azure/identity';

const SPEECH_REGION = process.env.SPEECH_REGION ?? 'westeurope';
// ARM resource ID for the Speech account. Required as Ocp-Apim-ResourceId
// when authenticating with an AAD bearer token (disableLocalAuth=true).
// reason: with local auth disabled, /sts/v1.0/issueToken is blocked; the AAD
// token must be sent directly to the data plane with the resource id header.
const SPEECH_RESOURCE_ID = process.env.SPEECH_RESOURCE_ID
  ?? '/subscriptions/d7505cac-f0a2-4896-8c19-818421939a96/resourceGroups/rg-echo-prod/providers/Microsoft.CognitiveServices/accounts/spch-echo-prod';
const credential = new DefaultAzureCredential();

let cachedAadToken: { token: string; expiresAt: number } | undefined;

async function getAadToken(): Promise<string> {
  const now = Date.now();
  if (cachedAadToken && cachedAadToken.expiresAt > now + 60_000) return cachedAadToken.token;
  const aad = await credential.getToken('https://cognitiveservices.azure.com/.default');
  if (!aad?.token) throw new Error('Failed to acquire AAD token for Cognitive Services');
  cachedAadToken = { token: aad.token, expiresAt: aad.expiresOnTimestamp };
  return aad.token;
}

/**
 * Synthesize SSML to MP3 using Azure AI Speech REST API with managed identity.
 * Sends the AAD token directly to the TTS endpoint; no issueToken exchange is
 * possible because the Speech account has disableLocalAuth=true.
 * Returns the raw MP3 bytes.
 */
export async function synthesizeSsmlToMp3(ssml: string): Promise<Buffer> {
  const aadToken = await getAadToken();
  const url = `https://${SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${aadToken}`,
      'Ocp-Apim-ResourceId': SPEECH_RESOURCE_ID,
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
