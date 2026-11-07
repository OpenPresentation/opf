// node crops.mjs out.png preset... : preview | PowerPoint crops of the named presets from the classification deck.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const sharp = createRequire('C:/opf-work/sh-02-shape-block/packages/render/package.json')('sharp');
const { composeSlide } = await import('file:///C:/opf-work/sh-02-shape-block/packages/javascript/dist/composition.js');
const [out, ...names] = process.argv.slice(2);
const deck = JSON.parse(fs.readFileSync('deck.json', 'utf8'));
const tiles = [];
for (const [index, slide] of deck.slides.entries()) {
  const n = String(index + 1).padStart(2, '0');
  for (const item of composeSlide(slide, { presentation: deck }).items.filter(i => i.field === 'shape')) {
    if (!names.includes(item.payload.shape)) continue;
    const b = item.shape.box, region = { left: Math.max(0, Math.floor(b.x) - 4), top: Math.max(0, Math.floor(b.y) - 4), width: Math.ceil(b.width) + 8, height: Math.ceil(b.height) + 8 };
    region.width = Math.min(region.width, 1280 - region.left); region.height = Math.min(region.height, 720 - region.top);
    const crop = async f => sharp(await sharp(f).resize(1280, 720).png().toBuffer()).extract(region).resize(240, 240, { fit: 'contain', background: '#fff' }).png().toBuffer();
    tiles.push({ name: item.payload.shape, a: await crop(`final/s-${n}.png`), b: await crop(`ppt/slide${index + 1}.png`) });
  }
}
const W = 240, L = 22, cols = 2;
const rows = Math.ceil(tiles.length / cols);
const composites = [];
tiles.forEach((t, i) => {
  const x = (i % cols) * (W * 2 + 24) + 8, y = Math.floor(i / cols) * (W + L + 8) + 8;
  composites.push({ input: Buffer.from(`<svg width="${W * 2}" height="${L}"><text x="0" y="16" font-family="Arial" font-size="14">${t.name} (preview | PowerPoint)</text></svg>`), left: x, top: y });
  composites.push({ input: t.a, left: x, top: y + L }, { input: t.b, left: x + W + 4, top: y + L });
});
await sharp({ create: { width: cols * (W * 2 + 24) + 8, height: rows * (W + L + 8) + 8, channels: 3, background: '#e8e8e8' } }).composite(composites).png().toFile(out);
console.log('wrote', out);
