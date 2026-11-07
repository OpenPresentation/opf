// Check scale invariance: every shape's box relative to the frame, divided by the frame width, per n, across sizes.
import { load } from './load.mjs';
const groups = new Map();
for (const file of process.argv.slice(2)) for (const i of load(file)) {
  const key = `${i.n}@${(i.frame.w / i.frame.h).toFixed(3)}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(i);
}
for (const [key, list] of groups) {
  const ref = list.at(-1), W = ref.frame.w;
  const shapes = inst => { const out = []; const a = [...inst.nodes], b = [...inst.arrows]; for (let k = 0; k < a.length; k++) { out.push({ ...a[k], kind: 'n' }); if (b[k]) out.push({ ...b[k], kind: 'a' }); } return out; };
  let worst = 0, worstRot = 0;
  const refRel = shapes(ref).map(s => [(s.x - ref.frame.x) / W, (s.y - ref.frame.y) / W, (s.w ?? s.d) / W, s.h / W, s.rot ?? 0]);
  for (const inst of list) {
    const w = inst.frame.w;
    shapes(inst).forEach((s, i) => {
      const rel = [(s.x - inst.frame.x) / w, (s.y - inst.frame.y) / w, (s.w ?? s.d) / w, s.h / w];
      for (let k = 0; k < 4; k++) worst = Math.max(worst, Math.abs(rel[k] - refRel[i][k]) * W);
      worstRot = Math.max(worstRot, Math.abs((s.rot ?? 0) - refRel[i][4]));
    });
  }
  console.log(key, 'sizes', list.map(i => i.frame.w).join(','), 'worst diff (pt at ref width)', worst.toFixed(4), 'rot', worstRot, 'd/W', (ref.nodes[0].d / W).toFixed(7));
}
