// node analyze1.mjs <m.json>: per diagram and sweep step, the shapes PowerPoint drew, as shares of the frame (l/W, t/H, w/W, h/H).
import { readFileSync } from 'node:fs';
const m = JSON.parse(readFileSync(process.argv[2], 'utf8').replace(/^﻿/, ''));
const f = v => Number(v).toFixed(5);
for (const deck of [m].flat()) {
  if (deck.error) { console.log(deck.file, 'ERROR', deck.error); continue; }
  for (const d of [deck.diagrams].flat()) {
    console.log(`\n== ${deck.file} ${d.name} smartArt=${d.hasSmartArt} layout=${d.layout} name="${d.layoutName}" cat=${d.layoutCategory} nodes=${d.nodes}`);
    for (const s of [d.sweep ?? []].flat()) {
      console.log(`-- W=${s.W} H=${s.H} n=${s.n}`);
      for (const g of [s.shapes].flat()) console.log(`   ${g.i} type=${g.type} rot=${g.rot} adj=${JSON.stringify(g.adj)} l=${f(g.l / s.W)} t=${f(g.t / s.H)} w=${f(g.w / s.W)} h=${f(g.h / s.H)}  [${g.l},${g.t},${g.w},${g.h}] ${g.text ? `"${g.text}" sz=${g.size} m=${g.ml},${g.mt}` : ''}`);
    }
  }
}
