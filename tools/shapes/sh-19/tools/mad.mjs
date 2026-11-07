// node mad.mjs <a.png> <b.png>: mean absolute difference (0-255) at full size and at a quarter size, over the whole image.
import { createRequire } from 'node:module';
const sharp = createRequire('C:/opf-work/sh-19-smartart-layouts/packages/pptx/package.json')('sharp');
const [a, b] = process.argv.slice(2);
const raw = async (file, scale) => { const m = await sharp(file).metadata(); const img = sharp(file).flatten({ background: '#fff' }).removeAlpha(); return (scale ? img.resize(Math.round(m.width * scale), Math.round(m.height * scale), { fit: 'fill' }) : img).raw().toBuffer(); };
for (const scale of [undefined, .25]) {
  const [x, y] = [await raw(a, scale), await raw(b, scale)]; let sum = 0;
  for (let i = 0; i < x.length; i++) sum += Math.abs(x[i] - y[i]);
  console.log(scale ? 'quarter' : 'full', (sum / x.length).toFixed(3));
}
