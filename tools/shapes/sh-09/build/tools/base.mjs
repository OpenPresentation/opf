// node base.mjs <png> <x0> <x1> <y0> <y1>: the bottom-most and top-most rows of strong ink (text) in a box.
import { createRequire } from 'node:module';
const sharp = createRequire('C:/opf-work/sh-09-smartart-tier1/packages/pptx/package.json')('sharp');
const [file, ...b] = process.argv.slice(2); const [x0, x1, y0, y1] = b.map(Number);
const { data, info } = await sharp(file).flatten({ background: '#fff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
let top = Infinity, bottom = -1;
for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * info.width + x) * 3; if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) { top = Math.min(top, y); bottom = Math.max(bottom, y); } }
console.log(file.split('/').pop(), 'ink rows', top, bottom);
