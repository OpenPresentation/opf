// Spike 1a: compare each algorithm's result with the naive closed form of its spec description.
import { readFileSync, writeFileSync } from 'node:fs';
const m = JSON.parse(readFileSync('exp6/m.json', 'utf8').replace(/^﻿/, ''));
const out = [];
const nodesOf = s => [s.shapes].flat().filter(g => g && g.text !== undefined);
for (const deck of m) {
  const d = [deck.diagrams].flat()[0];
  out.push(`\n## ${deck.file} (${d.layoutName})`);
  let worst = 0;
  for (const s of [d.sweep].flat()) {
    const g = nodesOf(s), n = s.n, W = s.W, H = s.H;
    let model = [], note = '';
    if (deck.file === 'lin') {
      // spec: nodes the root's width each, gaps 0.1 of a node, then scaled to fit the frame keeping proportions, centered.
      let w = W, h = .6 * w; const total = n * w + (n - 1) * .1 * w, k = Math.min(W / total, H / h); w *= k; h *= k;
      const x0 = (W - (n * w + (n - 1) * .1 * w)) / 2;
      model = Array.from({ length: n }, (_, i) => ({ l: x0 + i * 1.1 * w, t: (H - h) / 2, w, h }));
    } else if (deck.file === 'cycle') {
      const r = .3 * W, dd = .25 * W; model = Array.from({ length: n }, (_, i) => { const a = 2 * Math.PI * i / n; return { l: W / 2 + r * Math.sin(a) - dd / 2, t: H / 2 - r * Math.cos(a) - dd / 2, w: dd, h: dd }; });
      if (n === 1) model = [{ l: (W - dd) / 2, t: (H - dd) / 2, w: dd, h: dd }];
    } else if (deck.file === 'pyra') {
      model = Array.from({ length: n }, (_, i) => ({ l: 0, t: i * H / n, w: W, h: H / n }));
    } else if (deck.file === 'snake') {
      // the best grid: columns c maximizing the node width that fits both ways.
      let best;
      for (let c = 1; c <= n; c++) { const r = Math.ceil(n / c), w = Math.min(W / (c + .1 * (c - 1)), H / (r * .6 + (r - 1) * .1)); if (!best || w > best.w + 1e-9) best = { c, r, w }; }
      const { c, r, w } = best, h = .6 * w, x0 = (W - (c * w + (c - 1) * .1 * w)) / 2, y0 = (H - (r * h + (r - 1) * .1 * w)) / 2;
      model = Array.from({ length: n }, (_, i) => ({ l: x0 + (i % c) * 1.1 * w, t: y0 + Math.floor(i / c) * (h + .1 * w), w, h }));
      note = ` model grid ${c}x${r}`;
    }
    let res = 0;
    g.forEach((x, i) => { const y = model[i]; if (y) res = Math.max(res, Math.abs(x.l - y.l), Math.abs(x.t - y.t), Math.abs(x.w - y.w), Math.abs(x.h - y.h)); });
    worst = Math.max(worst, res);
    out.push(`W=${W} H=${H} n=${n}: ${g.length} nodes; first ${g[0] ? [g[0].l, g[0].t, g[0].w, g[0].h].map(v => v.toFixed(2)).join(',') : '-'}; last ${g.at(-1) ? [g.at(-1).l, g.at(-1).t, g.at(-1).w, g.at(-1).h].map(v => v.toFixed(2)).join(',') : '-'}; residual vs model ${res.toFixed(3)} pt${note}`);
  }
  out.push(`worst residual ${worst.toFixed(3)} pt`);
}
writeFileSync('exp6/analysis.md', out.join('\n'));
console.log(out.join('\n'));
