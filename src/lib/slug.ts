import { createHash } from 'node:crypto';

/**
 * Convert a userId (typically an email) to a stable 16-char slug
 * for use in blob container names and S3 prefixes.
 */
export function userSlug(userId: string): string {
  const normalized = userId.trim().toLowerCase();
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

/**
 * Container name for a user's audio + feed + catalog blobs.
 * The Bicep creates a single shared `echo-audio` container; per-user data
 * lives under blob prefixes inside it. Listed here for clarity.
 */
export function audioPrefix(slug: string): string {
  return `users/${slug}`;
}
