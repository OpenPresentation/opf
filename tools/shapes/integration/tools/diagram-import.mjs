// node diagram-import.mjs <repo> <deck.opf.json> <exported.pptx> <powerpoint-resaved.pptx>
// Counts the deck's diagram blocks, then imports the export and PowerPoint's re-saved copy: how many diagrams come back as their
// Mermaid source (equal to the authored one), how many slides gained overlay shapes or connectors, and the provenance findings.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const [repo, deckFile, exported, resaved] = process.argv.slice(2);
const { fromPptx } = await import(pathToFileURL(`${repo}/packages/pptx/dist/index.js`).href);
const { gallery } = await import(pathToFileURL(`${repo}/packages/gallery/dist/index.js`).href).catch(() => ({}));
const deck = JSON.parse(readFileSync(deckFile, 'utf8'));
const sourceOf = (value) => typeof value === 'string' ? value : value?.source;
const diagramsOf = (slides) => slides.flatMap((slide, index) => {
  const found = [];
  const walk = (node) => { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(walk); if (node.diagram !== undefined) found.push({ slide: index, source: sourceOf(node.diagram) }); for (const [key, value] of Object.entries(node)) if (key !== 'diagram' && key !== 'extensions') walk(value); };
  walk(slide);
  return found;
});
const authored = diagramsOf(deck.slides);
for (const [label, file] of [['export', exported], ['PowerPoint re-save', resaved]]) {
  const reports = [];
  const back = await fromPptx(readFileSync(file), { onDiagnostic: (entry) => reports.push(entry), ...(gallery ? { catalogs: [gallery] } : {}) });
  const got = diagramsOf(back.slides);
  const same = authored.filter((item) => got.some((g) => g.slide === item.slide && g.source === item.source)).length;
  const overlaySlides = back.slides.map((slide, index) => ({ index, n: (slide.shapes ?? []).length, authored: (deck.slides[index]?.shapes ?? []).length })).filter((s) => s.n !== s.authored);
  const codes = {};
  for (const entry of reports) if (/diagram|grouped|reflow/.test(entry.code)) codes[entry.code] = (codes[entry.code] ?? 0) + 1;
  console.log(`${label}: ${same} of ${authored.length} diagrams back as their Mermaid source; slides whose overlay count differs from the deck: ${overlaySlides.length ? JSON.stringify(overlaySlides) : 'none'}; findings ${JSON.stringify(codes)}`);
}
