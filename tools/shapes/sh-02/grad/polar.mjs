// Effective outline of a 2-stop (white -> #1F5AA6) PowerPoint gradient: for each angle, the distance where u = 1, from t inverted
// through linear light and smoothstep.
import { createRequire } from 'node:module';
const sharp = createRequire('C:/opf-work/sh-02-shape-block/packages/render/package.json')('sharp');
const [file, region] = process.argv.slice(2);
const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
const px = (x, y) => { const i = (y * info.width + x) * info.channels; return [data[i], data[i + 1], data[i + 2]]; };
const isBg = (x, y) => { const [r, g, b] = px(x, y); return Math.abs(r - 42) + Math.abs(g - 51) + Math.abs(b - 64) < 12; };
const [x0, y0, x1, y1] = region.split(',').map(Number);
let a = 1e9, b = 1e9, c = -1, d = -1;
for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (!isBg(x, y)) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
const cx = (a + c) / 2, cy = (b + d) / 2;
const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const tOf = ([r]) => (1 - lin(r)) / (1 - lin(0x1F));
const invSmooth = t => { let lo = 0, hi = 1; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; (m * m * (3 - 2 * m) < t ? lo = m : hi = m); } return (lo + hi) / 2; };
console.log('box', a, b, c, d);
for (let deg = 0; deg < 360; deg += 15) {
  const th = deg * Math.PI / 180; let edge = 0; const samples = [];
  for (let i = 1; ; i++) { const x = Math.round(cx + Math.cos(th) * i), y = Math.round(cy - Math.sin(th) * i); if (x < a || x > c || y < b || y > d || isBg(x, y)) { edge = i; break; } samples.push([i, tOf(px(x, y))]); }
  const mid = samples.filter(([, t]) => t > 0.15 && t < 0.85);
  const R = mid.length ? mid.reduce((s, [i, t]) => s + i / invSmooth(t), 0) / mid.length : NaN;
  console.log(String(deg).padStart(3), 'outline', edge, 'effective R', R.toFixed(1), 't@edge', samples.at(-1)?.[1].toFixed(2));
}
