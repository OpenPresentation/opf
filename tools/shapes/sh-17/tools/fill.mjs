// node fill.mjs <sweep-dir>: per live instance of the gate, the arrangement as the export composed it (opf-render with its bundled fonts):
// the size, line counts, and how much of each node's text rectangle (less margins) the text fills across (h) and down (v), and the text's
// share of the frame (ink: line widths x size over the frame's area).
import { readFileSync } from 'node:fs';
const { resolvePresentation } = await import('file:///C:/opf-work/sh-17-linear-smartart/packages/render/src/svg.js');
const { loadFonts } = await import('file:///C:/opf-work/sh-17-linear-smartart/packages/render/src/fonts-node.js');
const { gallery } = await import('file:///C:/opf-work/sh-17-linear-smartart/packages/gallery/dist/index.js');
const fonts = await loadFonts({ pack: 'office' });
const dir = process.argv[2], gate = JSON.parse(readFileSync(`${dir}/gate.json`, 'utf8'));
const out = [];
for (const row of gate.filter(r => r.live || process.argv.includes('--all'))) {
  const deck = JSON.parse(readFileSync(`${dir}/decks/${row.id.replace(/-1$/, '')}.opf.json`, 'utf8'));
  const g = resolvePresentation(deck, { catalogs: [gallery], fonts }).slides[0].geometry, a = g.arrangements?.[0];
  if (!a) continue;
  const cols = g.items.find(it => it.path === a.path).listColumns, [l, t, r, b] = a.margins ?? [a.textMargin, a.textMargin, a.textMargin, a.textMargin];
  const fill = cols.map((c, i) => { const n = a.nodes[i], e = c.text.listEntries[0]; return [Math.max(...e.text.richLines.map(x => x.width)) / (n.textBox.width - l - r), e.text.height / (n.textBox.height - t - b)]; });
  const ink = cols.reduce((s, c) => s + c.text.listEntries[0].text.richLines.reduce((u, x) => u + x.width * a.fontSize, 0), 0) / (a.frame.width * a.frame.height);
  const rec = { id: row.id, result: row.result, design: a.design, size: +(a.fontSize * .75).toFixed(2), lines: a.smartArt.lines.join(','), h: +Math.max(...fill.map(f => f[0])).toFixed(3), v: +Math.max(...fill.map(f => f[1])).toFixed(3), ink: +ink.toFixed(3), rect: row.rect, nat: row.native?.mad };
  out.push(rec); console.log(Object.values(rec).join('  '));
}
