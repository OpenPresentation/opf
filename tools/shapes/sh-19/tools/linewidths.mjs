// node linewidths.mjs <sweep> : for every built-in live row, its widest line (px), the text size and the text density, against the native text offset.
import { readFileSync } from 'node:fs';
const { resolvePresentation } = await import('file:///C:/opf-work/sh-19-smartart-layouts/packages/render/src/svg.js');
const { gallery } = await import('file:///C:/opf-work/sh-19-smartart-layouts/packages/gallery/dist/index.js');
const { loadFonts } = await import('file:///C:/opf-work/sh-19-smartart-layouts/packages/render/src/fonts-node.js');
const fonts = await loadFonts({ pack: 'office' });
const sweep = process.argv[2] ?? 'sweep4', rows = [];
for (const k of ['pyramid', 'matrix', 'cycle', 'chevrons', 'flow', 'vertical-flow']) {
  const g = JSON.parse(readFileSync(`${sweep}/${k}/gate.json`, 'utf8'));
  for (const r of g.filter(r => r.drew === 'SmartArt (built-in)')) {
    const deck = JSON.parse(readFileSync(`${sweep}/${k}/decks/${r.id.replace(/-1$/, '')}.opf.json`, 'utf8'));
    const geo = resolvePresentation(deck, { catalogs: [gallery], validate: false, fonts, textMeasurement: fonts.textMeasurement }).slides[0].geometry;
    const a = geo.arrangements[0], item = geo.items.find(i => i.path === a.path);
    const widths = item.listColumns.flatMap(c => c.text.listEntries[0].text.richLines.map(l => l.width * a.fontSize));
    const ink = widths.reduce((s, w) => s + w * a.fontSize, 0) / (a.frame.width * a.frame.height);
    rows.push({ id: r.id, widest: Math.max(...widths), size: a.fontSize, ink, text: r.native.text, dx: r.native.dx, result: r.result });
  }
}
rows.sort((x, y) => y.widest - x.widest);
for (const r of rows.slice(0, 20)) console.log(r.id, 'widest', r.widest.toFixed(0), 'size', r.size.toFixed(1), 'ink', r.ink.toFixed(3), 'text', r.text, 'dx', r.dx, r.result);
