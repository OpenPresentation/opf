// node calib-measure.mjs: the measured first baseline of each calibration text box (the bottom edge of the H stems, with the coverage of
// the antialiased last row), as a share of the size.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const sharp = createRequire('C:/opf-work/sh-07-native-diagrams/packages/pptx/package.json')('sharp');
const root = 'C:/opf-work/shapes/sh-07/calib';
const cases = JSON.parse(readFileSync(`${root}/expect.json`, 'utf8'));
const images = new Map();
for (const c of cases) {
  if (!images.has(c.slide)) images.set(c.slide, await sharp(`${root}/ppt/calib/${c.slide}.png`).flatten({ background: '#fff' }).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true }));
  const { data, info } = images.get(c.slide);
  // Ink per row (0..1 per pixel) in the box's columns.
  const ink = [];
  for (let y = c.y - 5; y < Math.min(info.height, c.y + c.size * 1.6); y++) {
    let sum = 0;
    for (let x = c.x; x < Math.min(info.width, c.x + c.size * 1.6); x++) sum += 1 - data[y * info.width + x] / 255;
    ink.push({ y, sum });
  }
  const full = Math.max(...ink.map((r) => r.sum));
  let last = ink.findLastIndex((r) => r.sum > full * 0.05);
  const first = ink.findIndex((r) => r.sum > full * 0.05);
  // A stem row is about `full`; the last row's coverage is its share of a full row.
  const bottom = ink[last].y + Math.min(1, ink[last].sum / full);
  const top = ink[first].y + 1 - Math.min(1, ink[first].sum / full);
  console.log(c.font.padEnd(16), String(c.size).padStart(3), c.mode.padEnd(7), 'baseline/size', ((bottom - c.y) / c.size).toFixed(3), ' capTop/size', ((top - c.y) / c.size).toFixed(3));
}
