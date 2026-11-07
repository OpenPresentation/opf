// node vs.mjs <dir> <base> <a> <b>: ink offsets per node text rectangle between two PNGs of one instance (variants a and b of <base>),
// the rectangles from <dir>/pptx/<base>-<a>.pptx's drawing part.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('C:/opf-work/sh-09-smartart-tier1/packages/pptx/package.json');
const sharp = require('sharp'), { unzipSync, strFromU8 } = require('fflate');
const [dir, base, a, b] = process.argv.slice(2);
const parts = unzipSync(readFileSync(`${dir}/pptx/${base}-${a}.pptx`));
const slide = strFromU8(parts['ppt/slides/slide1.xml']);
const [fx, fy] = /<p:graphicFrame>[\s\S]*?<p:xfrm><a:off x="(\d+)" y="(\d+)"/.exec(slide).slice(1).map(Number);
const drawing = strFromU8(parts['ppt/diagrams/drawing1.xml']), margin = Number(/lIns="(\d+)"/.exec(drawing)[1]) / 9525;
const boxes = [...drawing.matchAll(/<dsp:txXfrm><a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/g)].map(m => ({ x: (fx + Number(m[1])) / 9525 + margin, y: (fy + Number(m[2])) / 9525 + margin, width: Number(m[3]) / 9525 - 2 * margin, height: Number(m[4]) / 9525 - 2 * margin }));
const load = async file => { const { data, info } = await sharp(file).flatten({ background: '#fff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, W: info.width }; };
const ink = ({ data, W }, box) => {
  const x0 = Math.round(box.x), y0 = Math.round(box.y), x1 = Math.round(box.x + box.width), y1 = Math.round(box.y + box.height);
  const at = (x, y) => { const i = (y * W + x) * 3; return [data[i], data[i + 1], data[i + 2]]; }, counts = new Map();
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const [r, g, bl] = at(x, y), key = `${r >> 3},${g >> 3},${bl >> 3}`; counts.set(key, (counts.get(key) ?? 0) + 1); }
  const fill = [...counts.entries()].sort((p, q) => q[1] - p[1])[0][0].split(',').map(v => Number(v) << 3), dist = (p, q) => (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2])) / 3;
  let far = fill, best = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const c = at(x, y), d = dist(c, fill); if (d > best) { best = d; far = c; } }
  let w = 0, sx = 0, sy = 0, top = Infinity, bottom = -Infinity;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const c = at(x, y), d = dist(c, fill); if (d > 40 && dist(c, far) < dist(c, fill)) { w += d; sx += d * x; sy += d * y; if (d > 120) { top = Math.min(top, y); bottom = Math.max(bottom, y); } } }
  return w ? { x: sx / w, y: sy / w, top, bottom } : undefined;
};
const [A, B] = [await load(`${dir}/ppt/${base}-${a}-1.png`), await load(`${dir}/ppt/${base}-${b}-1.png`)];
for (const box of boxes) { const p = ink(A, box), q = ink(B, box); if (p && q) console.log(`${base} ${a} vs ${b}: dx ${(p.x - q.x).toFixed(2)} dy ${(p.y - q.y).toFixed(2)} top ${p.top - q.top} bottom ${p.bottom - q.bottom}`); }
