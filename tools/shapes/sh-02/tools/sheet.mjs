// node sheet.mjs out.png label:preview.png:ppt.png ...  -> one row per pair, scaled to 640x360 each.
import { createRequire } from 'node:module';
const require = createRequire('C:/opf-work/sh-02-shape-block/packages/render/package.json');
const sharp = require('sharp');
const [out, ...pairs] = process.argv.slice(2);
const W = 640, H = 360, LABEL = 28, GAP = 8;
const rows = [];
for (const pair of pairs) {
  const [label, a, b] = pair.split('|');
  const left = await sharp(a).resize(W, H, { fit: 'contain', background: '#fff' }).png().toBuffer();
  const right = await sharp(b).resize(W, H, { fit: 'contain', background: '#fff' }).png().toBuffer();
  rows.push({ label, left, right });
}
const width = W * 2 + GAP * 3, height = rows.length * (H + LABEL + GAP) + GAP;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const composites = [];
rows.forEach((row, i) => {
  const y = GAP + i * (H + LABEL + GAP);
  const text = Buffer.from(`<svg width="${width}" height="${LABEL}"><text x="${GAP}" y="20" font-family="Arial" font-size="16" fill="#222">${esc(row.label)}  (preview | PowerPoint)</text></svg>`);
  composites.push({ input: text, left: 0, top: y });
  composites.push({ input: row.left, left: GAP, top: y + LABEL });
  composites.push({ input: row.right, left: GAP * 2 + W, top: y + LABEL });
});
await sharp({ create: { width, height, channels: 3, background: '#e8e8e8' } }).composite(composites).png().toFile(out);
console.log('wrote', out, width, height);
