import { paginate } from 'file:///C:/opf-work/sh-04-overlays-connectors/packages/javascript/dist/index.js';
const para = (n) => Array.from({ length: n }, (_, i) => `Sentence number ${i + 1} explains one more detail of the plan in plain words.`).join(' ');
const deck = { name: 'P', language: 'en-US', slides: [{ title: 'Long', blocks: [{ id: 'first', text: para(14) }, { id: 'second', text: para(14) }, { id: 'third', text: para(4) }],
  shapes: [
    { id: 'stamp', shape: 'rect', text: 'Draft', x: 0.8, y: 0.02, width: 0.15, height: 0.06 },
    { id: 'pin', shape: 'ellipse', at: { block: 'third', edge: 'top' } },
    { connector: { from: 'first', to: 'second' } },
    { connector: { from: 'second', to: 'third' } },
    { connector: { from: 'stamp', to: 'pin' } },
  ] }] };
const r = paginate(deck);
r.presentation.slides.forEach((s, i) => console.log(i, JSON.stringify(s.blocks.map(b => b.id)), JSON.stringify(s.shapes)));
for (const p of r.pages) console.log(p.slideIndex, JSON.stringify(p.diagnostics));
