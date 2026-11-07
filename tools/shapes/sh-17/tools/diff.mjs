// node diff.mjs <a.png> <b.png> <out.png>: |a - b| x4, white = same; prints the bounding box and sum per region of differences > 40.
import { createRequire } from 'node:module';
const sharp = createRequire('C:/opf-work/sh-17-linear-smartart/packages/pptx/package.json')('sharp');
const [a, b, out] = process.argv.slice(2);
const load = async f => (await sharp(f).flatten({ background: '#fff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true }));
const A = await load(a), B = await load(b), W = A.info.width, H = A.info.height, d = Buffer.alloc(W * H * 3);
const rows = new Array(H).fill(0), cols = new Array(W).fill(0);
for (let i = 0; i < W * H; i++) { const m = Math.max(...[0, 1, 2].map(c => Math.abs(A.data[i * 3 + c] - B.data[i * 3 + c]))); const v = Math.min(255, 4 * m); d[i * 3] = 255; d[i * 3 + 1] = 255 - v; d[i * 3 + 2] = 255 - v; if (m > 40) { rows[Math.floor(i / W)]++; cols[i % W]++; } }
await sharp(d, { raw: { width: W, height: H, channels: 3 } }).png().toFile(out);
const span = arr => { const idx = arr.map((v, i) => v ? i : -1).filter(i => i >= 0); return idx.length ? [idx[0], idx.at(-1), idx.length] : []; };
console.log('rows', span(rows), 'cols', span(cols));
