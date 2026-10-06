// Shared helpers for build-decks.mjs: load an item's own opf-pptx (from src, so no dist rebuild touches the worktree),
// export a deck from an OPF object, write the .opf.json source next to the .pptx.
import {pathToFileURL} from 'node:url';
import {writeFileSync, mkdirSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {createRequire} from 'node:module';

export const ROOT = 'C:/opf-work';
export const OUT = 'C:/opf-work/fa-native/decks';
mkdirSync(OUT, {recursive: true});

export async function loadPptx(item) {
  return import(pathToFileURL(`${ROOT}/${item}/opf-pptx/src/index.js`).href);
}
export async function loadFflate(item) {
  const req = createRequire(`${ROOT}/${item}/opf-pptx/package.json`);
  return import(pathToFileURL(req.resolve('fflate')).href);
}

export const OPTIONS = {seed: 1, timestamp: '2026-10-06T00:00:00Z', zipDate: '2026-10-06T00:00:00Z'};

export async function exportDeck(item, name, document, options = {}) {
  const {toPptx} = await loadPptx(item);
  const diagnostics = [];
  const bytes = await toPptx(document, {...OPTIONS, ...options, onDiagnostic: d => diagnostics.push(d)});
  const file = `${OUT}/${name}.pptx`;
  writeFileSync(file, bytes);
  writeFileSync(`${OUT}/${name}.opf.json`, JSON.stringify(document, null, 2) + '\n');
  return {file, bytes, diagnostics};
}

// A PNG with a diagonal colour gradient and a dark cross so a crop or a stretch is visible.
const crcTable = Array.from({length: 256}, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buffer => { let c = 0xffffffff; for (const byte of buffer) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const length = Buffer.alloc(4), checksum = Buffer.alloc(4), body = Buffer.concat([Buffer.from(type), data]); length.writeUInt32BE(data.length); checksum.writeUInt32BE(crc(body)); return Buffer.concat([length, body, checksum]); };
export function pngDataUri(width, height) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const cross = Math.abs(x - width / 2) < 3 || Math.abs(y - height / 2) < 3;
    const px = cross ? [20, 20, 20] : [Math.round(255 * x / width), Math.round(255 * y / height), 160];
    raw.set(px, y * (width * 3 + 1) + 1 + x * 3);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  return `data:image/png;base64,${png.toString('base64')}`;
}
