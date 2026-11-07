// node mosaic.mjs <mode> <out.png> <ids...>: preview | PowerPoint pairs at 480x270, one row per id, for a quick look at many sources.
import { createRequire } from 'node:module';
const sharp = createRequire('C:/opf-work/sh-07-native-diagrams/packages/pptx/package.json')('sharp');
const [mode, out, ...ids] = process.argv.slice(2);
const root = process.env.SH07_ROOT ?? 'C:/opf-work/shapes/sh-07';
const W = 480, H = 270, head = 18, gap = 6;
const comps = [];
for (const [i, id] of ids.entries()) {
  const top = i * (H + head + gap);
  comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${2 * W + 3 * gap}" height="${head}"><text x="4" y="14" font-family="Arial" font-size="13">${id}</text></svg>`), left: 0, top });
  comps.push({ input: await sharp(`${root}/preview/${id}-1.png`).resize(W, H, { fit: 'fill' }).png().toBuffer(), left: gap, top: top + head });
  comps.push({ input: await sharp(`${root}/${mode}/ppt/${id}/1.png`).resize(W, H, { fit: 'fill' }).png().toBuffer(), left: 2 * gap + W, top: top + head });
}
await sharp({ create: { width: 2 * W + 3 * gap, height: ids.length * (H + head + gap), channels: 3, background: '#dddddd' } }).composite(comps).png().toFile(out);
console.log(out);
