import fs from 'node:fs';
export function readCsv(file) {
  const [head, ...lines] = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
  const keys = head.split(',').map(k => k.replace(/"/g, ''));
  return lines.map(line => { const cells = line.split(',').map(c => c.replace(/"/g, '')); const o = {}; keys.forEach((k, i) => { const v = cells[i]; o[k] = v !== '' && !isNaN(+v) ? +v : v; }); return o; });
}
export function groups(rows) { const m = new Map(); for (const r of rows) { const k = `${r.W}x${r.H}n${r.n}`; if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; }
