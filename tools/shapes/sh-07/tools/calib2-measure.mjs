// node calib2-measure.mjs: the measured baseline (bottom edge of the H stems with the last row's coverage) of each calib2 case against its
// expected y.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const sharp = createRequire('C:/opf-work/sh-07-native-diagrams/packages/pptx/package.json')('sharp');
const root = 'C:/opf-work/shapes/sh-07/calib2';
const cases = JSON.parse(readFileSync(`${root}/expect.json`, 'utf8'));
const { data, info } = await sharp(`${root}/ppt/calib/1.png`).flatten({ background: '#fff' }).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
for (const c of cases) {
  const ink = [];
  for (let y = c.baseline - 60; y < c.baseline + 30; y++) {
    let sum = 0;
    for (let x = c.x + 2; x < c.x + 80; x++) { const v = data[y * info.width + x]; if (v < 200) sum += 1 - v / 255; }
    ink.push({ y, sum });
  }
  const full = Math.max(...ink.map((r) => r.sum));
  const last = ink.findLastIndex((r) => r.sum > full * 0.05);
  const bottom = ink[last].y + Math.min(1, ink[last].sum / full);
  console.log(c.kind.padEnd(12), 'expected', c.baseline, 'measured', bottom.toFixed(2), 'delta', (bottom - c.baseline).toFixed(2));
}
