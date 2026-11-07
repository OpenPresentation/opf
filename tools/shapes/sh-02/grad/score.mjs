// Mean channel difference (0-255) between the preview and PowerPoint's export inside each shape's frame, per shape of each gradient deck.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const sharp = createRequire('C:/opf-work/sh-02-shape-block/packages/render/package.json')('sharp');
const { composeSlide } = await import('file:///C:/opf-work/sh-02-shape-block/packages/javascript/dist/composition.js');
const dir = 'C:/opf-work/shapes/sh-02/grad/';
const load = async file => { const { data, info } = await sharp(file).removeAlpha().resize(1280, 720).raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width }; };
for (const n of ['', '2', '3', '4', '5', '7']) {
  const deck = JSON.parse(fs.readFileSync(`${dir}deck${n}.json`, 'utf8'));
  for (const [index, slide] of deck.slides.entries()) {
    const pv = fs.existsSync(`${dir}pv${n}/s-${index + 1}.png`) ? `${dir}pv${n}/s-${index + 1}.png` : `${dir}pv${n}/s.png`;
    const [ppt, mine] = await Promise.all([load(`${dir}ppt${n}/slide${index + 1}.png`), load(pv)]);
    const items = composeSlide(slide, { presentation: deck }).items.filter(item => item.field === 'shape');
    const row = [];
    for (const item of items) {
      const box = item.shape.box;
      let sum = 0, count = 0;
      for (let y = Math.ceil(box.y + 3); y < box.y + box.height - 3; y += 2) for (let x = Math.ceil(box.x + 3); x < box.x + box.width - 3; x += 2) {
        const i = (y * ppt.w + x) * 3;
        for (let c = 0; c < 3; c++) sum += Math.abs(ppt.data[i + c] - mine.data[i + c]);
        count += 3;
      }
      const g = item.payload.fill?.gradient;
      row.push(`${item.payload.shape ?? 'path'}/${g?.type}${item.payload.rotate ? `@${item.payload.rotate}deg` : ''}=${(sum / count).toFixed(1)}`);
    }
    console.log(`deck${n || 1} s${index + 1}: ${row.join('  ')}`);
  }
}
