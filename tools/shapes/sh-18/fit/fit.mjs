// Fit the per-count constants of Basic Cycle at a fixed frame aspect: node diameter, ring radius and center (relative to the frame
// center), arrow length and thickness, the arrow center's place along the chord between two node centers and across it.
import { load } from './load.mjs';
const out = {};
for (const file of process.argv.slice(2)) for (const i of load(file)) {
  const A = +(i.frame.w / i.frame.h).toFixed(3), W = i.frame.w, n = i.n;
  if (W !== 920) continue;
  const fx = i.frame.x + W / 2, fy = i.frame.y + i.frame.h / 2;
  const d = i.nodes[0].d / W;
  const cx = i.nodes.reduce((s, p) => s + p.cx, 0) / n, cy = n === 2 ? i.nodes[0].cy : i.nodes.reduce((s, p) => s + p.cy, 0) / n;
  // radius: least squares over nodes of distance from (cx, cy)
  const r = n === 1 ? 0 : i.nodes.reduce((s, p) => s + Math.hypot(p.cx - cx, p.cy - cy), 0) / n / W;
  const arrows = i.arrows.map((a, k) => {
    const p = i.nodes[k], q = i.nodes[(k + 1) % n];
    const dx = q.cx - p.cx, dy = q.cy - p.cy, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    const ax = a.cx - p.cx, ay = a.cy - p.cy;
    return { t: (ax * ux + ay * uy) / len, off: (-ax * uy + ay * ux) / W, w: a.w / W, h: a.h / W, rot: a.rot };
  });
  const key = `${n}@${A}`;
  out[key] = { n, aspect: A, d, r, cx: (cx - fx) / W, cy: (cy - fy) / W, arrows };
}
for (const [k, v] of Object.entries(out)) console.log(k, 'd', v.d.toFixed(8), 'r', v.r.toFixed(8), 'c', v.cx.toFixed(8), v.cy.toFixed(8), 'arrows', v.arrows.map(a => `t ${a.t.toFixed(5)} off ${(a.off).toFixed(6)} w ${a.w.toFixed(7)} h ${a.h.toFixed(7)} rot ${a.rot}`).join(' | '));
