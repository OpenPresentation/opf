import { composeSlide } from 'file:///C:/opf-work/sh-02-shape-block/packages/javascript/dist/composition.js';
import { validate } from 'file:///C:/opf-work/sh-02-shape-block/packages/javascript/dist/index.js';
const deck = { name: 'S', slides: [{ title: 'Shapes', blocks: [
  { shape: 'chevron', text: 'Plan' },
  { shape: 'ellipse', text: 'Build', fill: { color: 'accent2', lighten: 0.4 }, stroke: { color: 'text', width: 2, dash: 'dash' } },
  { shape: 'roundRect', adjust: { adj: 0.3 }, text: [{ text: 'Ship', bold: true }], style: 'intense' },
  { path: 'M0 0 L1 0 L0.5 1 Z', fill: 'accent3' },
] }] };
const c = composeSlide(deck.slides[0], { slideIndex: 0, presentation: deck });
for (const item of c.items) console.log(item.field, item.path, JSON.stringify(item.box), item.shape ? JSON.stringify({ preset: item.shape.preset, fill: item.shape.fill, stroke: item.shape.stroke && { ...item.shape.stroke }, textBox: item.shape.textBox, d: item.shape.paths[0].d.slice(0, 60), effects: item.shape.effects }) : '', item.text ? `font ${item.text.fontSize} overflow ${item.text.overflow}` : '');
console.log(c.diagnostics);
const r = validate(deck);
console.log(r.findings.map(f => [f.ruleId, f.path, f.message]));
const bad = { name: 'S', slides: [{ title: 'x', blocks: [{ shape: 'roundRect', adjust: { adj1: .3, adj: 0.9 } }, { text: 'y', fill: 'accent1' }, { shape: 'rect', link: 'https://a.com', hidden: true }, { image: { src: 'https://e.com/a.png', alt: 'a' }, shape: 'hexagon', stroke: { color: 'accent1', width: 3 } }] }] };
console.log(validate(bad).findings.map(f => [f.ruleId, f.path, f.severity]));
