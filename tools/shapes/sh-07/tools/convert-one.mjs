// node convert-one.mjs <id>: the converter on one corpus source (fake measurement), printing its summary and the shapes' names and geometry kinds.
import { readFileSync } from 'node:fs';
import { diagramPalette, layoutDiagram, paintDiagram } from 'file:///C:/opf-work/sh-07-native-diagrams/packages/javascript/dist/composition.js';
import { diagramShapes } from 'file:///C:/opf-work/sh-07-native-diagrams/packages/pptx/src/diagram-shapes.js';
const measure = (text, size, style) => Array.from(text).length * size * (style.mono ? .6 : style.bold ? .58 : .52);
const corpus = readFileSync('C:/opf-work/shapes/sh-07/sources/corpus.txt', 'utf8').split(/^=== /m).filter(Boolean).map((part) => { const nl = part.indexOf('\n'); return { id: part.slice(0, nl).trim(), source: part.slice(nl + 1).replace(/\s+$/, '') }; });
const id = process.argv[2];
const { source } = corpus.find((c) => c.id === id);
const d = layoutDiagram(source, { width: 1100, height: 560, nominal: 32, floor: 16, measure, idPrefix: 'd' });
const palette = diagramPalette({ surface: '#FFFFFF', text: '#1F1F1F', fonts: { body: 'Aptos', code: 'Consolas' } });
const box = { x: 90, y: 80, width: d.width * d.scale, height: d.height * d.scale };
const svg = paintDiagram(d, palette, box, { classes: true });
if (process.argv[3] === 'svg') console.log(svg);
const r = diagramShapes(svg, { box, name: 'OPF diagram 1', alt: d.alt, measure: (t, s, st) => measure(t, s, st), font: (f, b, i) => ({ fontFace: f, bold: b, italic: i }) });
if (r.unsupported) { console.log('UNSUPPORTED', r.unsupported); process.exit(0); }
console.log('shapes', r.shapes, 'connectors', r.connectors, 'bound', r.bound, 'ids', r.ids);
for (const [, kind, name, rest] of r.xml.matchAll(/<p:(sp|cxnSp)>[\s\S]*?name="([^"]+)"([\s\S]*?)<\/p:\1>/g)) {
  const geom = /prst="(\w+)"/.exec(rest)?.[1] ?? (rest.includes('custGeom') ? 'custGeom' : '?');
  const text = [...rest.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(' / ');
  const cxn = [...rest.matchAll(/<a:(stCxn|endCxn) id="[^"]+" idx="(\d+)"/g)].map((m) => `${m[1]}:${m[2]}`).join(' ');
  console.log(kind.padEnd(6), name.padEnd(40), geom.padEnd(14), cxn.padEnd(18), text);
}
