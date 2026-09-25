// Write subtitle files from captions.js:  npm run srt  → out/captions_tr.srt, _en.srt, _bi.srt
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const C = require(path.join(root, 'captions.js'));
const ts = (s) => { const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
const out = path.join(root, 'out');
fs.mkdirSync(out, { recursive: true });
for (const mode of ['tr', 'en', 'bi']) {
  const txt = C.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${mode === 'tr' ? c.tr : mode === 'en' ? c.en : c.tr + '\n' + c.en}\n`).join('\n');
  fs.writeFileSync(path.join(out, `captions_${mode}.srt`), txt);
}
// narration script for teachers (suggested voice-over lines, with timings)
const notes = C.map((c) => `[${ts(c.start).slice(3, 11)}] ${c.tr} / ${c.en}\n    ${c.note}`).join('\n\n');
fs.writeFileSync(path.join(out, 'narration_notes.txt'), notes + '\n');
console.log('✓ out/captions_tr.srt, captions_en.srt, captions_bi.srt, narration_notes.txt');
