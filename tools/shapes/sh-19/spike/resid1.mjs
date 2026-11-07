// Residuals of the composite placement (exp1 fill and interiorBg) against the constraint tables.
import { readFileSync } from 'node:fs';
const m = JSON.parse(readFileSync('exp1/m.json', 'utf8').replace(/^﻿/, ''));
const odd = [.0123457, .3141593, .2718282, .1618034, .4142136, .7320508];
const fill = k => Array.from({ length: k }, (_, i) => { const w = .31 + odd[i % 6] / 10, h = .27 + odd[(i + 2) % 6] / 10; const l = k === 1 ? 0 : (1 - w) * i / (k - 1), t = k === 1 ? 0 : (1 - h) * i / (k - 1); return { l, t, w: k === 1 ? 1 : w, h: k === 1 ? 1 : h }; });
const interior = k => Array.from({ length: k }, (_, i) => ({ l: .1 + .15 * i, t: .2 + .1 * i, w: .13, h: .2 }));
for (const [file, table] of [['fill-3', fill], ['interiorBg-3', interior]]) {
  const d = [m.find(x => x.file === file).diagrams].flat()[0]; let worst = 0, count = 0;
  for (const s of [d.sweep].flat()) {
    const g = [s.shapes].flat().filter(x => x.text !== undefined); const t = table(s.n);
    g.forEach((x, i) => { const e = t[i]; worst = Math.max(worst, Math.abs(x.l - e.l * s.W), Math.abs(x.t - e.t * s.H), Math.abs(x.w - e.w * s.W), Math.abs(x.h - e.h * s.H)); count++; });
  }
  console.log(file, 'nodes', count, 'worst residual', worst.toFixed(5), 'pt');
}
