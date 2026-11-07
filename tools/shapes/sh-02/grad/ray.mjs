// node ray.mjs deckN slide shapeIndex : RGB along the ray from the frame center to the right edge, preview vs PowerPoint, every 4%.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const sharp = createRequire('C:/opf-work/sh-02-shape-block/packages/render/package.json')('sharp');
const { composeSlide } = await import('file:///C:/opf-work/sh-02-shape-block/packages/javascript/dist/composition.js');
const [n, s, k, dir = 'x'] = process.argv.slice(2);
const base = 'C:/opf-work/shapes/sh-02/grad/';
const deck = JSON.parse(fs.readFileSync(`${base}deck${n}.json`, 'utf8'));
const item = composeSlide(deck.slides[s - 1], { presentation: deck }).items.filter(i => i.field === 'shape')[k];
const load = async f => { const { data, info } = await sharp(f).removeAlpha().resize(1280, 720).raw().toBuffer({ resolveWithObject: true }); return p => { const i = (p[1] * info.width + p[0]) * 3; return [data[i], data[i + 1], data[i + 2]]; }; };
const pv = fs.existsSync(`${base}pv${n}/s-${s}.png`) ? `${base}pv${n}/s-${s}.png` : `${base}pv${n}/s.png`;
const [a, b] = await Promise.all([load(pv), load(`${base}ppt${n}/slide${s}.png`)]);
const box = item.shape.box, cx = box.x + box.width / 2, cy = box.y + box.height / 2;
for (let t = 0; t <= 1.0001; t += 0.04) {
  const p = dir === 'x' ? [Math.round(cx + (box.width / 2 - 2) * t), Math.round(cy)] : [Math.round(cx), Math.round(cy + (box.height / 2 - 2) * t)];
  console.log(t.toFixed(2), a(p).join(' ').padEnd(12), '|', b(p).join(' '));
}
