// node ink.mjs <x> <y> <w> <h> <png>...: the ink box (rows and columns differing from the region's most common color) of each image
// in a region of the 1280x720 frame, with subpixel edges from the coverage of the edge rows.
import { createRequire } from 'node:module';
const sharp = createRequire('C:/opf-work/sh-07-native-diagrams/packages/pptx/package.json')('sharp');
const [x, y, w, h, ...files] = process.argv.slice(2);
for (const file of files) {
  const { data } = await sharp(file).resize(1280, 720, { fit: 'fill' }).flatten({ background: '#fff' }).removeAlpha().greyscale()
    .extract({ left: +x, top: +y, width: +w, height: +h }).raw().toBuffer({ resolveWithObject: true });
  const counts = new Map();
  for (const v of data) counts.set(v, (counts.get(v) ?? 0) + 1);
  const bg = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const rows = [], cols = [];
  for (let r = 0; r < +h; r++) { let s = 0; for (let c = 0; c < +w; c++) s += Math.abs(data[r * +w + c] - bg); rows.push(s); }
  for (let c = 0; c < +w; c++) { let s = 0; for (let r = 0; r < +h; r++) s += Math.abs(data[r * +w + c] - bg); cols.push(s); }
  const edge = (list) => { const max = Math.max(...list); const first = list.findIndex((v) => v > max * 0.05); const last = list.findLastIndex((v) => v > max * 0.05); return [first, last]; };
  const [top, bottom] = edge(rows), [left, right] = edge(cols);
  // The centroid of ink rows: a robust vertical position.
  let m = 0, t = 0; rows.forEach((v, i) => { m += v * i; t += v; });
  let mc = 0, tc = 0; cols.forEach((v, i) => { mc += v * i; tc += v; });
  console.log(file.split('/').slice(-3).join('/').padEnd(40), 'rows', top + +y, bottom + +y, 'cols', left + +x, right + +x, 'centroid', (m / t + +y).toFixed(2), (mc / tc + +x).toFixed(2));
}
