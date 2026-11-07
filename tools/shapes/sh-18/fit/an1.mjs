import { load } from './load.mjs';
const file = process.argv[2], only = +process.argv[3];
for (const i of load(file)) {
  if (only && i.n !== only) continue;
  const a = i.nodes[0], W = i.frame.w, H = i.frame.h, n = i.n;
  // ring: center = mean of node centers (regular polygon)
  const cx = i.nodes.reduce((s, p) => s + p.cx, 0) / n, cy = i.nodes.reduce((s, p) => s + p.cy, 0) / n;
  const r = Math.hypot(a.cx - cx, a.cy - cy);
  const s = a.d / W, e = Math.floor(Math.log2(s)), grid = 2 ** (e - 9);
  const chord = n === 1 ? 0 : 2 * r * Math.sin(Math.PI / n);
  const minx = Math.min(...i.nodes.map(p => p.x)), maxx = Math.max(...i.nodes.map(p => p.x + p.d)), miny = Math.min(...i.nodes.map(p => p.y)), maxy = Math.max(...i.nodes.map(p => p.y + p.d));
  console.log(`${W}x${H} n${n} d ${a.d.toFixed(4)} s/grid ${(s / grid).toFixed(3)} r ${r.toFixed(4)} sp/d ${((chord - a.d) / a.d).toFixed(5)} bbox ${(maxx - minx).toFixed(3)}x${(maxy - miny).toFixed(3)} slack ${(W - (maxx - minx)).toFixed(3)},${(H - (maxy - miny)).toFixed(3)}`);
}
