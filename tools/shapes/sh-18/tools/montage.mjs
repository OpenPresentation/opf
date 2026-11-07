// node montage.mjs out.png a.png b.png ...: tile PNGs in rows of three at 400 px wide, with their names.
import { createRequire } from 'node:module';
import { basename } from 'node:path';
const sharp = createRequire('C:/opf-work/sh-18-cycle-smartart/packages/pptx/package.json')('sharp');
const [out, ...files] = process.argv.slice(2), W = 400, head = 18, gap = 6, per = 3, comps = [];
let height = 0;
for (const [i, file] of files.entries()) {
  const meta = await sharp(file).metadata(), H = Math.round(W * meta.height / meta.width), x = gap + (i % per) * (W + gap), y = Math.floor(i / per) * (head + 420 + gap);
  comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${head}"><text x="2" y="13" font-family="Arial" font-size="12">${basename(file)}</text></svg>`), left: x, top: y });
  comps.push({ input: await sharp(file).resize(W, H, { fit: 'fill' }).png().toBuffer(), left: x, top: y + head });
  height = Math.max(height, y + head + H + gap);
}
await sharp({ create: { width: per * (W + gap) + gap, height, channels: 3, background: '#dddddd' } }).composite(comps).png().toFile(out);
console.log(out);
