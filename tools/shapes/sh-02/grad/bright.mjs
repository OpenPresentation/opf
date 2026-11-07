import { createRequire } from 'node:module';
import fs from 'node:fs';
const sharp = createRequire('C:/opf-work/sh-02-shape-block/packages/render/package.json')('sharp');
const { composeSlide } = await import('file:///C:/opf-work/sh-02-shape-block/packages/javascript/dist/composition.js');
const deck = JSON.parse(fs.readFileSync('deck7.json', 'utf8'));
for (const [si, slide] of deck.slides.entries()) {
  const { data, info } = await sharp(`ppt7/slide${si + 1}.png`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const item of composeSlide(slide, { presentation: deck }).items.filter(i => i.field === 'shape')) {
    const b = item.shape.box; let best = -1, bx = 0, by = 0, n = 0, sx = 0, sy = 0;
    for (let y = Math.ceil(b.y); y < b.y + b.height; y++) for (let x = Math.ceil(b.x); x < b.x + b.width; x++) {
      const i = (y * info.width + x) * 3, v = data[i] + data[i + 1] + data[i + 2];
      if (v > best) { best = v; }
    }
    for (let y = Math.ceil(b.y); y < b.y + b.height; y++) for (let x = Math.ceil(b.x); x < b.x + b.width; x++) {
      const i = (y * info.width + x) * 3, v = data[i] + data[i + 1] + data[i + 2];
      if (v >= best - 3) { sx += x; sy += y; n++; }
    }
    const pb = item.shape.paths.map(p => p.d).join(' ').match(/-?[\d.]+/g).map(Number);
    console.log(si + 1, item.payload.shape.padEnd(18), 'frame c', (b.x + b.width / 2).toFixed(0), (b.y + b.height / 2).toFixed(0), 'bright', (sx / n).toFixed(0), (sy / n).toFixed(0), 'n', n, 'max', best);
  }
}
