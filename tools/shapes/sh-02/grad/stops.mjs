import { createRequire } from 'node:module';
import fs from 'node:fs';
const sharp = createRequire('C:/opf-work/sh-02-shape-block/packages/render/package.json')('sharp');
const { composeSlide } = await import('file:///C:/opf-work/sh-02-shape-block/packages/javascript/dist/composition.js');
const deck = JSON.parse(fs.readFileSync('deck6.json', 'utf8'));
const load = async f => { const { data, info } = await sharp(f).removeAlpha().resize(1280, 720).raw().toBuffer({ resolveWithObject: true }); return p => { const i = (p[1] * info.width + p[0]) * 3; return [data[i], data[i + 1], data[i + 2]]; }; };
for (const s of [1, 2]) {
  const ppt = await load(`ppt6/slide${s}.png`), pv = await load(`pv6/s-${s}.png`);
  const items = composeSlide(deck.slides[s - 1], { presentation: deck }).items.filter(i => i.field === 'shape');
  items.forEach((item, k) => {
    const b = item.shape.box; const out = [];
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const p = s === 1 ? [Math.round(b.x + 2 + (b.width - 4) * t), Math.round(b.y + b.height / 2)] : [Math.round(b.x + b.width / 2 + (b.width / 2 - 2) * t), Math.round(b.y + b.height / 2)];
      out.push(`${ppt(p)[0]}/${pv(p)[0]}`);
    }
    console.log(s, k, out.join(' '));
  });
}
