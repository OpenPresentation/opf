#!/usr/bin/env node
// RR-97: the files that examples/technical/*.opf.json name by relative path (./assets/logo.svg, ./assets/cover.png), so
// `opf convert` of every technical example finds them. Original abstract artwork, MIT licensed with this repository: the
// PNGs are drawn by scripts/gallery-artwork.mjs and the SVGs are written here. The media and data files those examples
// name (./media/demo.mp4, ./data/pipeline.csv) stay authoring examples: no conversion reads them.
//   node scripts/generate-technical-example-assets.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { galleryArtwork } from './gallery-artwork.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'examples', 'technical', 'assets');

const svg = (width, height, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>\n`;
const mark = (first, second) => `<rect x="8" y="10" width="34" height="34" rx="7" fill="${first}"/><rect x="48" y="10" width="34" height="34" rx="7" fill="${second}"/><rect x="8" y="50" width="34" height="34" rx="7" fill="${second}"/><rect x="48" y="50" width="34" height="34" rx="7" fill="${first}"/>`;
const bars = (ink) => `<rect x="110" y="23" width="188" height="13" rx="6" fill="${ink}"/><rect x="110" y="49" width="132" height="11" rx="5" fill="${ink}" fill-opacity=".62"/>`;
const files = new Map([
  ['logo.svg', svg(320, 96, mark('#2563EB', '#14B8A6') + bars('#0F172A'), 'Example logo')],
  ['logo-dark.svg', svg(320, 96, mark('#2563EB', '#14B8A6') + bars('#0F172A'), 'Example logo for light backgrounds')],
  ['logo-light.svg', svg(320, 96, mark('#FFFFFF', '#FFFFFF') + bars('#FFFFFF'), 'Example logo for dark backgrounds')],
  ['primary-logo.svg', svg(320, 96, mark('#7C3AED', '#DB2777') + bars('#0F172A'), 'Primary organization logo')],
  ['wordmark.svg', svg(320, 96, bars('#0F172A'), 'Example wordmark')],
  ['icon.svg', svg(128, 128, `<rect x="4" y="4" width="120" height="120" rx="28" fill="#2563EB"/><g transform="translate(24 24) scale(.88)">${mark('#FFFFFF', '#CFE8F3')}</g>`, 'Example icon')],
  ['diagram.svg', svg(640, 360, '<rect width="640" height="360" fill="#F8FAFC"/><g stroke="#334155" stroke-width="3" fill="none"><path d="M200 180H260M380 180H440"/></g><rect x="60" y="130" width="140" height="100" rx="14" fill="#2563EB"/><rect x="260" y="130" width="120" height="100" rx="14" fill="#14B8A6"/><rect x="440" y="130" width="140" height="100" rx="14" fill="#7C3AED"/>', 'Three-step flow diagram')],
]);

await mkdir(assets, { recursive: true });
for (const [name, contents] of files) await writeFile(path.join(assets, name), contents);

const png = new Map([
  ['watermark.png', galleryArtwork('Technical example', 0).watermark],
  ['product-shot.png', galleryArtwork('Technical product shot', 3)['cover-bg']],
]);
for (const [name, bytes] of png) await writeFile(path.join(assets, name), bytes);

const photos = new Map([
  ['cover.png', galleryArtwork('Technical cover', 1)['supporting-photo']],
  ['cover-image.png', galleryArtwork('Technical background', 2)['supporting-photo']],
  ['context-photo.png', galleryArtwork('Technical context', 4)['supporting-photo']],
  ['alice.png', galleryArtwork('Technical portrait', 5)['brand-icon']],
]);
for (const [name, bytes] of photos) await writeFile(path.join(assets, name), bytes);
console.log(`wrote ${files.size + png.size + photos.size} files to examples/technical/assets`);
