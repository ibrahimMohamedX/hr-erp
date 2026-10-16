// One-off: unwrap nested __bundler/template from extracted pages into final HTML.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pagesDir = join(__dirname, 'pages');
const outDir = join(__dirname, 'pages-final');
mkdirSync(outDir, { recursive: true });

const files = process.argv.slice(2);
for (const f of files) {
  const raw = readFileSync(join(pagesDir, f), 'utf8');
  const m = raw.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/);
  if (!m) { console.log('no template in', f); continue; }
  const json = JSON.parse(m[1]);
  writeFileSync(join(outDir, f), json);
  console.log('unwrapped', f, json.length, 'chars');
}
