// Narration analysis with ffprobe/ffmpeg (already required by the pipeline). No AI calls.
import {spawn} from 'node:child_process';

const capture = (cmd, args) => new Promise((resolve, reject) => {
  let out = '', err = '';
  const child = spawn(cmd, args, {stdio: ['ignore', 'pipe', 'pipe']});
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { err = (err + d).slice(-60000); });
  child.on('error', reject);
  child.on('close', (code) => (code === 0 ? resolve({out, err}) : reject(new Error(`${cmd} exited ${code}: ${err.slice(-400)}`))));
});

// Returns {duration, speechStart, speechEnd}. Leading/trailing silence is trimmed from the speech span
// so scene boundaries follow the voice, not the file's padding.
export async function analyzeNarration(file) {
  const probe = await capture('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  const duration = Number(probe.out.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Could not read narration duration');
  const {err} = await capture('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'silencedetect=noise=-38dB:d=0.3', '-f', 'null', '-']);
  const starts = [...err.matchAll(/silence_start:\s*(-?[\d.]+)/g)].map((m) => Math.max(0, Number(m[1])));
  const ends = [...err.matchAll(/silence_end:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  let speechStart = 0, speechEnd = duration;
  if (starts.length && starts[0] < 0.05) speechStart = ends[0] ?? duration;
  const last = starts.at(-1);
  if (starts.length && last > speechStart && (ends.length < starts.length || ends.at(-1) >= duration - 0.1)) speechEnd = last;
  // All silence (demo mode without a speech engine): treat the whole file as the speech span.
  if (speechEnd - speechStart < 1) { speechStart = 0.3; speechEnd = Math.max(1.3, duration - 0.5); }
  return {duration, speechStart, speechEnd};
}
