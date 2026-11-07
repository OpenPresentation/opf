import { load } from './load.mjs';
const acc = new Map();
for (const file of process.argv.slice(2)) for (const i of load(file)) {
  const A = +(i.frame.w / i.frame.h).toFixed(3), n = i.n, W = i.frame.w;
  if (n === 1 || (n === 2 && A !== 1.8) || (n !== 2 && A !== 1.15)) continue;
  const cx = i.nodes.reduce((s, p) => s + p.cx, 0) / n, cy = i.nodes.reduce((s, p) => s + p.cy, 0) / n;
  const r = i.nodes.reduce((s, p) => s + Math.hypot(p.cx - cx, p.cy - cy), 0) / n / W;
  const d = i.nodes[0].d / W;
  if (!acc.has(n)) acc.set(n, []);
  const a = i.arrows[0], p = i.nodes[0];
  acc.get(n).push({ r, d, aw: a.w / W, off: n === 2 ? (p.cy - a.cy) / W : 0, t: n === 2 ? (a.cx - p.cx) / (2 * r * W) : 0 });
}
for (const [n, list] of acc) {
  const mean = k => list.reduce((s, v) => s + v[k], 0) / list.length, spread = k => Math.max(...list.map(v => v[k])) - Math.min(...list.map(v => v[k]));
  console.log(n, 'r', mean('r').toFixed(9), 'spread', spread('r').toExponential(2), 'd', mean('d').toFixed(9), n === 2 ? `aw ${mean('aw').toFixed(9)} off ${mean('off').toFixed(9)} t ${mean('t').toFixed(9)}` : '');
}
