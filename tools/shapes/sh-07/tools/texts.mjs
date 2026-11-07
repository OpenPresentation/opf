import { readFileSync } from 'node:fs';
import { layoutDiagram } from 'file:///C:/opf-work/sh-07-native-diagrams/packages/javascript/dist/composition.js';
const measure = (text, size, style) => Array.from(text).length * size * (style.mono ? .6 : style.bold ? .58 : .52);
const corpus = readFileSync('C:/opf-work/shapes/sh-07/sources/corpus.txt', 'utf8').split(/^=== /m).filter(Boolean).map((part) => { const nl = part.indexOf('\n'); return { id: part.slice(0, nl).trim(), source: part.slice(nl + 1).replace(/\s+$/, '') }; });
const seen = new Set();
for (const { id, source } of corpus) {
  const d = layoutDiagram(source, { width: 1100, height: 560, nominal: 32, floor: 16, measure, idPrefix: 'd' });
  for (const [t] of d.svg.matchAll(/<text\b[\s\S]*?<\/text>/g)) {
    const shape = t.replace(/"[-\d.]+"/g, '"#"').replace(/>[^<]+</g, '>T<');
    if (seen.has(shape)) continue; seen.add(shape);
    console.log(id, t.slice(0, 400));
  }
}
