// Render still frames at given timestamps (for inspection / thumbnails).
// usage: node scripts/shots.mjs --times=0,1.5,4 --format=horizontal --captions=bi --out=shots [--sheet]
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] ?? d;
const times = (arg('times', '0,2,4,6') || '').split(',').map(Number);
const format = arg('format', 'horizontal'), captions = arg('captions', 'bi'), out = arg('out', 'shots');
fs.mkdirSync(out, { recursive: true });
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const browser = await chromium.launch();
const W = format === 'vertical' ? 1080 : 1920, H = format === 'vertical' ? 1920 : 1080;
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(pathToFileURL(path.join(root, 'index.html')).href + `?render=1&format=${format}&captions=${captions}`);
await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 60000 });
const files = [];
for (const t of times) {
  const t0 = Date.now();
  const data = await page.evaluate((t) => { window.__LI.renderAt(t); return document.getElementById('film').toDataURL('image/png'); }, t);
  const f = path.join(out, `${format[0]}_${t.toFixed(2)}.png`);
  fs.writeFileSync(f, Buffer.from(data.split(',')[1], 'base64'));
  files.push(f);
  console.log(f, (Date.now() - t0) + 'ms');
}
if (errs.length) console.log('CONSOLE:\n' + [...new Set(errs)].slice(0, 20).join('\n'));
await browser.close();
