// One-off script: extract embedded design-system pages from the bundled HTML.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(__dirname, '..', 'Archai Design System.html');
const html = readFileSync(htmlPath, 'utf8');

const manifestMatch = html.match(/<script type="__bundler\/manifest">\s*([\s\S]*?)\s*<\/script>/);
const pageOrderMatch = html.match(/<script type="__bundler\/page_order">\s*([\s\S]*?)\s*<\/script>/);
if (!manifestMatch) throw new Error('manifest not found');

const manifest = JSON.parse(manifestMatch[1]);
const pageOrder = JSON.parse(pageOrderMatch[1]);

const titles = [
  '00-cover', '01-foundation', '02-logo', '03-color', '04-typography',
  '05-icons', '06-graphic-language', '07-ui-kit-tokens', '08-website',
  '09-profiles-banners', '10-social-content', '11-lead-gen-messaging',
  '12-voice-content', '13-motion', '14-applications', '15-rollout-tokens',
];

const outDir = join(__dirname, 'pages');
mkdirSync(outDir, { recursive: true });

pageOrder.forEach((uuid, i) => {
  const entry = manifest[uuid];
  if (!entry) { console.log('missing', uuid); return; }
  const bytes = Buffer.from(entry.data, 'base64');
  const finalBytes = entry.compressed ? gunzipSync(bytes) : bytes;
  const name = titles[i] ?? `page-${i}`;
  writeFileSync(join(outDir, `${name}.html`), finalBytes);
  console.log('extracted', name, finalBytes.length, 'bytes');
});
