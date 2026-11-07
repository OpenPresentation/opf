// node mad.mjs <a.png> <b.png>: mean absolute difference per channel (0-255) over the whole image, at its size and at a quarter.
import { createRequire } from 'node:module';
const sharp = createRequire('C:/opf-work/sh-17-linear-smartart/packages/pptx/package.json')('sharp');
const [a, b] = process.argv.slice(2), m = await sharp(a).metadata();
const raw = (f, w, h) => sharp(f).flatten({ background: '#fff' }).resize(w, h, { fit: 'fill' }).removeAlpha().raw().toBuffer();
const score = async (w, h) => { const [x, y] = [await raw(a, w, h), await raw(b, w, h)]; let s = 0; for (let i = 0; i < x.length; i++) s += Math.abs(x[i] - y[i]); return +(s / x.length).toFixed(2); };
console.log(a.split('/').pop(), 'mad', await score(m.width, m.height), 'quarter', await score(Math.round(m.width / 4), Math.round(m.height / 4)));
