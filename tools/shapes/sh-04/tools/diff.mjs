// node diff.mjs a.png b.png out.png -> an overlay (a in magenta, b in green, white where both draw the same) and the mean difference per channel.
import { createRequire } from 'node:module';
const require = createRequire('C:/opf-work/sh-04-overlays-connectors/packages/render/package.json');
const sharp = require('sharp');
const [a, b, out, region] = process.argv.slice(2);
const W = 1280, H = 720;
const raw = async file => (await sharp(file).resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer());
const [pa, pb] = await Promise.all([raw(a), raw(b)]);
const [x0, y0, x1, y1] = region ? region.split(',').map(Number) : [0, 0, W, H];
let sum = 0, count = 0, differing = 0;
const overlay = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 3;
  const la = (pa[i] + pa[i + 1] + pa[i + 2]) / 3, lb = (pb[i] + pb[i + 1] + pb[i + 2]) / 3;
  overlay[i] = la; overlay[i + 1] = lb; overlay[i + 2] = la;
  if (x >= x0 && x < x1 && y >= y0 && y < y1) {
    const d = (Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2])) / 3;
    sum += d; count++; if (d > 64) differing++;
  }
}
await sharp(overlay, { raw: { width: W, height: H, channels: 3 } }).png().toFile(out);
console.log(JSON.stringify({ meanDifference: Math.round(sum / count * 100) / 100, pixelsOver64: differing, pixels: count }));
