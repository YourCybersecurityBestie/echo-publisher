import { readBlobText, writeBlobText } from './blob.js';

export interface CatalogRecord {
  episodeId: string;
  title: string;
  description: string;
  publishedAt: string;
  durationSeconds: number;
  sourceUrl?: string;
  topic?: string;
  takeaway?: string;
}

function catalogPath(userSlug: string): string {
  return `users/${userSlug}/catalog.json`;
}

export async function readCatalog(userSlug: string): Promise<CatalogRecord[]> {
  const text = await readBlobText(catalogPath(userSlug));
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as CatalogRecord[]) : [];
  } catch {
    return [];
  }
}

export async function appendCatalog(userSlug: string, record: CatalogRecord): Promise<void> {
  const existing = await readCatalog(userSlug);
  const updated = [record, ...existing];
  await writeBlobText(catalogPath(userSlug), JSON.stringify(updated, null, 2), 'application/json');
}
