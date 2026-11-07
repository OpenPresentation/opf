// Load a measure.ps1 CSV into instances: {frame:{x,y,w,h}, n, nodes:[{x,y,d,cx,cy}], arrows:[{x,y,w,h,rot,cx,cy}]}
import { readFileSync } from 'node:fs';
export function load(file) {
  const lines = readFileSync(file, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/);
  const head = lines[0].replace(/"/g, '').split(',');
  const parse = line => { const out = []; let cur = '', q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
  const map = new Map();
  for (const line of lines.slice(1)) {
    const cells = parse(line), row = Object.fromEntries(head.map((h, i) => [h, cells[i]]));
    const key = `${row.frame}|${row.n}`;
    if (!map.has(key)) { const [x, y, w, h] = row.frame.split(',').map(Number); map.set(key, { frame: { x, y, w, h }, n: +row.n, nodes: [], arrows: [] }); }
    const inst = map.get(key), x = +row.left, y = +row.top, w = +row.width, h = +row.height;
    if (row.type === '9') inst.nodes.push({ x, y, d: w, h, cx: x + w / 2, cy: y + h / 2, size: +row.size });
    else inst.arrows.push({ x, y, w, h, rot: +row.rot, cx: x + w / 2, cy: y + h / 2, size: +row.size });
  }
  return [...map.values()];
}
