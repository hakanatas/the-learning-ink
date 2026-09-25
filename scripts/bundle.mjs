// Build a single self-contained HTML file (all scripts, styles and fonts inlined):
//   npm run bundle   → dist/learning-ink.html  (easy to email, put on a USB stick, or host)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => `<style>\n${fs.readFileSync(path.join(root, href), 'utf8')}\n</style>`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => `<script>/* ${src} */\n${fs.readFileSync(path.join(root, src), 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'learning-ink.html'), html);
console.log('✓ dist/learning-ink.html', (html.length / 1024).toFixed(0) + ' KB');

// Artifact variant (hosted page): no document skeleton, no download buttons (the host sandbox blocks downloads)
let art = html
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<html[^>]*>|<\/html>|<head>|<\/head>|<\/body>/gi, '')
  .replace(/<body>/i, '')
  .replace(/<meta [^>]*>\s*/gi, '');
const title = art.match(/<title>.*?<\/title>/)[0];
art = title + '\n' + art.replace(title, '') + '\n<style>:root{color-scheme:dark} html,body{height:100%;background:#12100e} #app{height:100%} #srt,#png{display:none}</style>\n';
fs.writeFileSync(path.join(root, 'dist', 'learning-ink.artifact.html'), art);
console.log('✓ dist/learning-ink.artifact.html');
