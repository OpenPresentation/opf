import { validate } from 'file:///C:/opf-work/sh-04-overlays-connectors/packages/javascript/dist/index.js';
const deck = (slide) => ({ name: 'Fixture', language: 'en-US', slides: [slide] });
const cases = {
  ok: { title: 'x', blocks: [{ id: 'a', shape: 'rect' }, { id: 'b', text: 'b' }], shapes: [{ id: 's', shape: 'ellipse', x: 0.1, y: 0.1, width: 0.1, height: 0.1 }, { connector: { from: 'a', to: 's', route: 'elbow' } }] },
  both: { title: 'x', blocks: [{ id: 'a', text: 'a' }], shapes: [{ shape: 'ellipse', x: 0.1, y: 0.1, width: 0.1, height: 0.1, at: { block: 'a', edge: 'top' } }] },
  none: { title: 'x', blocks: [{ id: 'a', text: 'a' }], shapes: [{ shape: 'ellipse' }] },
  partial: { title: 'x', shapes: [{ shape: 'ellipse', x: 0.1 }] },
  anchor: { title: 'x', blocks: [{ id: 'a', text: 'a' }], shapes: [{ shape: 'ellipse', at: { block: 'b', edge: 'top' } }] },
  end: { title: 'x', blocks: [{ id: 'a', text: 'a' }], shapes: [{ id: 'c1', connector: { from: 'a', to: 'zz' } }, { connector: { from: 'c1', to: 'a' } }] },
  site: { title: 'x', blocks: [{ id: 'a', text: 'a' }, { id: 'e', shape: 'ellipse' }], shapes: [{ connector: { from: 'a', to: 'e', fromSite: 4, toSite: 8 } }, { connector: { from: 'a', to: 'e', fromSite: 3, toSite: 7 } }] },
  dupe: { title: 'x', blocks: [{ id: 'a', text: 'a' }], shapes: [{ id: 'a', shape: 'rect', x: 0, y: 0, width: 0.1, height: 0.1 }] },
  badconnector: { title: 'x', shapes: [{ connector: { from: 'a' } }] },
  adjust: { title: 'x', shapes: [{ shape: 'roundRect', adjust: { adj: 0.9 }, x: 0, y: 0, width: 0.1, height: 0.1, hidden: true, link: 'https://e.com' }] },
};
for (const [name, slide] of Object.entries(cases)) {
  const r = validate(deck(slide));
  console.log('==', name, r.valid, r.findings.filter(f => f.ruleId !== 'opf/unused-dataset').map(f => `${f.ruleId} ${f.severity} ${f.path} :: ${f.message}`).join('\n   '));
}
for (const [name, slide] of Object.entries({
  typo: { title: 'x', shapes: [{ shape: 'ellipse', colour: 'red', x: 0, y: 0, width: 0.1, height: 0.1 }] },
  ctypo: { title: 'x', blocks: [{ id: 'a', text: 'a' }, { id: 'b', text: 'b' }], shapes: [{ connector: { from: 'a', to: 'b', route: 'zigzag' }, colur: 1 }] },
  badshape: { title: 'x', shapes: [{ shape: 'blob', x: 0, y: 0, width: 0.1, height: 0.1 }] },
})) { const r = validate(deck(slide)); console.log('==', name, r.valid, r.findings.map(f => `${f.ruleId} ${f.path} :: ${f.message}`).join('\n   ')); }
