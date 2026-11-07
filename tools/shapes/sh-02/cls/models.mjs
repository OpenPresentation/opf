import { createRequire } from 'node:module';
import fs from 'node:fs';
const sharp = createRequire('C:/opf-work/sh-02-shape-block/packages/render/package.json')('sharp');
const { composeSlide } = await import('file:///C:/opf-work/sh-02-shape-block/packages/javascript/dist/composition.js');
const deck = JSON.parse(fs.readFileSync('deck.json', 'utf8'));
const models = ['m-per', 'm-union', 'm-first', 'm-circle'];
const load = async file => { const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width }; };
const results = [];
for (const [index, slide] of deck.slides.entries()) {
  const n = String(index + 1).padStart(2, '0');
  const ppt = await load(`ppt/slide${index + 1}.png`);
  const imgs = await Promise.all(models.map(m => load(`${m}/s-${n}.png`)));
  for (const item of composeSlide(slide, { presentation: deck }).items.filter(i => i.field === 'shape')) {
    const box = item.shape.box, sums = models.map(() => 0); let count = 0;
    for (let y = Math.ceil(box.y + 3); y < box.y + box.height - 3; y += 2) for (let x = Math.ceil(box.x + 3); x < box.x + box.width - 3; x += 2) {
      const i = (y * ppt.w + x) * 3;
      if (Math.abs(ppt.data[i] - 42) + Math.abs(ppt.data[i + 1] - 52) + Math.abs(ppt.data[i + 2] - 64) < 14) continue;
      imgs.forEach((img, m) => { for (let c = 0; c < 3; c++) sums[m] += Math.abs(ppt.data[i + c] - img.data[i + c]); });
      count += 3;
    }
    const r = { preset: item.payload.shape }; models.forEach((m, k) => r[m] = +(sums[k] / count).toFixed(2)); results.push(r);
  }
}
fs.writeFileSync('models.json', JSON.stringify(results, null, 1));
for (const r of results) { const best = models.reduce((a, b) => r[a] <= r[b] ? a : b); console.log(r.preset.padEnd(26), models.map(m => String(r[m]).padStart(6)).join(' '), best, Math.abs(r['m-per'] - r['m-union']) > 0.5 ? '*' : ''); }
