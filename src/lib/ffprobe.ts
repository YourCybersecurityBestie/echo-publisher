import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm, chmod, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// reason: package has no TypeScript types
// eslint-disable-next-line @typescript-eslint/no-var-requires
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

// Flex Consumption Linux strips the executable bit when extracting the deploy
// package, so the bundled ffprobe binary errors with EACCES on spawn. Restore
// 0o755 once per cold start.
let ffprobeReady: Promise<void> | undefined;
function ensureFfprobeExecutable(): Promise<void> {
  if (!ffprobeReady) {
    ffprobeReady = (async () => {
      try {
        const s = await stat(ffprobeInstaller.path);
        // Add owner/group/other execute bits if missing.
        const desired = s.mode | 0o111;
        if (desired !== s.mode) await chmod(ffprobeInstaller.path, desired);
      } catch (err) {
        ffprobeReady = undefined;
        throw err;
      }
    })();
  }
  return ffprobeReady;
}

interface FfprobeFormat {
  format?: { duration?: string };
}

/**
 * Get duration in seconds for an MP3 buffer using ffprobe.
 * music-metadata returns 0 for some HD voice outputs — ffprobe is reliable.
 */
export async function getMp3DurationSeconds(mp3: Buffer): Promise<number> {
  await ensureFfprobeExecutable();
  const dir = await mkdtemp(join(tmpdir(), 'echo-'));
  const filePath = join(dir, 'episode.mp3');
  await writeFile(filePath, mp3);

  try {
    const json = await runFfprobe(filePath);
    const parsed = JSON.parse(json) as FfprobeFormat;
    const duration = parseFloat(parsed.format?.duration ?? '0');
    return Number.isFinite(duration) ? Math.round(duration) : 0;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runFfprobe(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffprobeInstaller.path, [
      '-v', 'error',
      '-show_format',
      '-of', 'json',
      filePath
    ]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`ffprobe exited ${code}: ${stderr}`));
    });
  });
}
