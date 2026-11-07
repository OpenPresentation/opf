// For each preset of the classification deck: mean channel difference of PowerPoint's export against the preview drawn with the shape
// gradient along the outline, and drawn as the circle gradient. Prints JSON lines and the circle list.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const sharp = createRequire('C:/opf-work/sh-02-shape-block/packages/render/package.json')('sharp');
const { composeSlide } = await import('file:///C:/opf-work/sh-02-shape-block/packages/javascript/dist/composition.js');
const deck = JSON.parse(fs.readFileSync('C:/opf-work/shapes/sh-02/cls/deck.json', 'utf8'));
const load = async file => { const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width }; };
const results = [];
for (const [index, slide] of deck.slides.entries()) {
  const n = String(index + 1).padStart(2, '0');
  const [ppt, outline] = await Promise.all([load(`C:/opf-work/shapes/sh-02/cls/ppt/slide${index + 1}.png`), load(`C:/opf-work/shapes/sh-02/cls/final/s-${n}.png`)]);
  const items = composeSlide(slide, { presentation: deck }).items.filter(item => item.field === 'shape');
  for (const item of items) {
    const box = item.shape.box;
    let a = 0, b = 0, count = 0;
    for (let y = Math.ceil(box.y + 3); y < box.y + box.height - 3; y += 2) for (let x = Math.ceil(box.x + 3); x < box.x + box.width - 3; x += 2) {
      const i = (y * ppt.w + x) * 3;
      // Only pixels inside the drawn shape in PowerPoint (not the slide background, 2A3440).
      if (Math.abs(ppt.data[i] - 42) + Math.abs(ppt.data[i + 1] - 52) + Math.abs(ppt.data[i + 2] - 64) < 14) continue;
      for (let c = 0; c < 3; c++) { a += Math.abs(ppt.data[i + c] - outline.data[i + c]);  }
      count += 3;
    }
    results.push({ preset: item.payload.shape, outline: +(a / count).toFixed(2), circle: 0 });
  }
}
fs.writeFileSync('C:/opf-work/shapes/sh-02/cls/final.json', JSON.stringify(results, null, 1));
for (const r of results) console.log(r.preset.padEnd(28), String(r.outline).padStart(6), String(r.circle).padStart(6), r.circle < r.outline ? 'CIRCLE' : '');
console.log(JSON.stringify(results.filter(r => r.circle < r.outline).map(r => r.preset)));
