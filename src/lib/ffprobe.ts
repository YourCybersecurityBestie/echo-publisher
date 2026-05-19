import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm, chmod, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// reason: package has no TypeScript types
// eslint-disable-next-line @typescript-eslint/no-var-requires
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

// On Flex Consumption Linux, /home/site/wwwroot is read-only and the bundled
// ffprobe binary lacks the executable bit, so spawning it fails with EACCES
// and chmod-in-place fails with EPERM. Copy it to /tmp once per cold start
// and chmod the copy.
let cachedFfprobePath: Promise<string> | undefined;
function getExecutableFfprobePath(): Promise<string> {
  if (!cachedFfprobePath) {
    cachedFfprobePath = (async () => {
      const dest = join(tmpdir(), 'echo-ffprobe');
      await copyFile(ffprobeInstaller.path, dest);
      await chmod(dest, 0o755);
      return dest;
    })().catch((err) => {
      cachedFfprobePath = undefined;
      throw err;
    });
  }
  return cachedFfprobePath;
}

interface FfprobeFormat {
  format?: { duration?: string };
}

/**
 * Get duration in seconds for an MP3 buffer using ffprobe.
 * music-metadata returns 0 for some HD voice outputs — ffprobe is reliable.
 */
export async function getMp3DurationSeconds(mp3: Buffer): Promise<number> {
  const ffprobePath = await getExecutableFfprobePath();
  const dir = await mkdtemp(join(tmpdir(), 'echo-'));
  const filePath = join(dir, 'episode.mp3');
  await writeFile(filePath, mp3);

  try {
    const json = await runFfprobe(ffprobePath, filePath);
    const parsed = JSON.parse(json) as FfprobeFormat;
    const duration = parseFloat(parsed.format?.duration ?? '0');
    return Number.isFinite(duration) ? Math.round(duration) : 0;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runFfprobe(ffprobePath: string, filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffprobePath, [
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
