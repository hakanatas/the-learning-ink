// ─────────────────────────────────────────────────────────────
// Deterministic frame-by-frame export → MP4 (H.264) + matching .srt
//
//   npm run export -- --format=horizontal --captions=tr
//
// Options
//   --format=horizontal|vertical|both   (default horizontal)
//   --captions=off|tr|en|bi             burned-in captions (default bi)
//   --fps=30  --crf=18  --preset=slow   encoder settings
//   --from=0 --to=90                    render a time range (seconds)
//   --workers=3                         parallel headless pages
//   --frames=png|jpeg                   frame transport (png = lossless, default)
//   --out=out                           output folder
//
// Every frame is produced by renderFrame(t) with t = frame / fps. Nothing is
// screen-recorded, so the result is identical on every run.
// ─────────────────────────────────────────────────────────────
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };

const FPS = +arg('fps', 30);
const CAPS = arg('captions', 'bi');
const FROM = +arg('from', 0), TO = +arg('to', 90);
const CRF = arg('crf', '18'), PRESET = arg('preset', 'slow');
const WORKERS = Math.max(1, +arg('workers', 3));
const FRAMES = arg('frames', 'png');
const OUT = path.resolve(root, arg('out', 'out'));
const formats = arg('format', 'horizontal') === 'both' ? ['horizontal', 'vertical'] : [arg('format', 'horizontal')];

function findFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try { const p = require('ffmpeg-static'); if (p && fs.existsSync(p)) return p; } catch {}
  const r = spawnSync('ffmpeg', ['-version']);
  if (r.status === 0) return 'ffmpeg';
  console.error('FFmpeg not found. Install it (https://ffmpeg.org) or `npm i ffmpeg-static`, or set FFMPEG_PATH.');
  process.exit(1);
}

function srt(mode) {
  const C = require(path.join(root, 'captions.js'));
  const ts = (s) => { const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
  return C.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${mode === 'tr' ? c.tr : mode === 'en' ? c.en : c.tr + '\n' + c.en}\n`).join('\n');
}

async function exportFormat(browser, format, ffmpeg) {
  const W = format === 'vertical' ? 1080 : 1920, H = format === 'vertical' ? 1920 : 1080;
  const base = `learning-ink_${format}_${CAPS}`;
  const mp4 = path.join(OUT, base + '.mp4');
  const url = pathToFileURL(path.join(root, 'index.html')).href + `?render=1&format=${format}&captions=${CAPS}`;
  const pages = [];
  for (let i = 0; i < WORKERS; i++) {
    const p = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    p.on('pageerror', (e) => console.error('[page]', e.message));
    await p.goto(url);
    await p.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 120000 });
    pages.push(p);
  }
  const f0 = Math.round(FROM * FPS), f1 = Math.min(Math.round(TO * FPS), Math.round(90 * FPS));
  const total = f1 - f0;
  const enc = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', FRAMES === 'jpeg' ? 'mjpeg' : 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', PRESET, '-crf', CRF, '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart',
    '-metadata', 'title=The Learning Ink — How AI Learns', mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
  const write = (buf) => new Promise((res) => (enc.stdin.write(buf) ? res() : enc.stdin.once('drain', res)));

  const t0 = Date.now();
  const mime = FRAMES === 'jpeg' ? 'image/jpeg' : 'image/png';
  for (let f = f0; f < f1; f += WORKERS) {
    const batch = [];
    for (let k = 0; k < WORKERS && f + k < f1; k++) {
      const t = (f + k) / FPS;
      batch.push(pages[k].evaluate(([t, mime]) => { window.__LI.renderAt(t); return document.getElementById('film').toDataURL(mime, 0.96); }, [t, mime]));
    }
    const res = await Promise.all(batch);
    for (const d of res) await write(Buffer.from(d.slice(d.indexOf(',') + 1), 'base64'));
    const done = f - f0 + res.length;
    if (done % (FPS * 2) < WORKERS || done === total) {
      const el = (Date.now() - t0) / 1000, eta = (el / done) * (total - done);
      process.stdout.write(`\r  ${format}: ${done}/${total} frames  ${(done / FPS).toFixed(1)}s  ·  ${el.toFixed(0)}s elapsed  ·  ~${eta.toFixed(0)}s left   `);
    }
  }
  enc.stdin.end();
  await new Promise((res, rej) => enc.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))));
  for (const p of pages) await p.close();
  const srtMode = CAPS === 'off' ? 'bi' : CAPS;
  fs.writeFileSync(path.join(OUT, base + '.srt'), srt(srtMode));
  console.log(`\n  ✓ ${path.relative(root, mp4)}  +  ${base}.srt`);
}

fs.mkdirSync(OUT, { recursive: true });
const ffmpeg = findFfmpeg();
const browser = await chromium.launch();
console.log(`The Learning Ink → MP4  (${FPS} fps, captions: ${CAPS}, ${WORKERS} workers)`);
for (const f of formats) await exportFormat(browser, f, ffmpeg);
await browser.close();
