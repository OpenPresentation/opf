import { load } from './load.mjs';
import { cycle } from './model.mjs';
let worstAll = 0;
for (const file of process.argv.slice(2)) for (const i of load(file)) {
  const m = cycle({ x: i.frame.x, y: i.frame.y, width: i.frame.w, height: i.frame.h }, i.n);
  let worst = 0, rot = 0;
  i.nodes.forEach((p, k) => { const q = m.nodes[k]; worst = Math.max(worst, Math.abs(p.x - q.x), Math.abs(p.y - q.y), Math.abs(p.d - q.w), Math.abs(p.h - q.h)); });
  i.arrows.forEach((p, k) => { const q = m.arrows[k]; worst = Math.max(worst, Math.abs(p.x - q.x), Math.abs(p.y - q.y), Math.abs(p.w - q.w), Math.abs(p.h - q.h)); rot = Math.max(rot, Math.abs(p.rot - q.rot)); });
  worstAll = Math.max(worstAll, worst);
  if (process.env.V || worst > .05) console.log(file, i.frame.w + 'x' + i.frame.h, 'n', i.n, 'worst', worst.toFixed(4), 'rot', rot.toFixed(4));
}
console.log('worst overall', worstAll.toFixed(4));
