import { composeSlide } from 'file:///C:/opf-work/sh-04-overlays-connectors/packages/javascript/dist/composition.js';
const slide = { title: 'Flow', blocks: [ { id: 'a', shape: 'roundRect', text: 'Plan' }, { id: 'b', shape: 'ellipse', text: 'Build' }, { id: 'c', text: 'Ship it' } ],
  shapes: [
    { id: 'n', shape: 'wedgeRectCallout', text: 'New', x: 0.7, y: 0.05, width: 0.2, height: 0.1 },
    { id: 'badge', shape: 'ellipse', text: '3', at: { block: 'a', edge: 'top', offset: -10 } },
    { connector: { from: 'a', to: 'b', route: 'elbow' }, stroke: { end: { type: 'triangle' } } },
    { connector: { from: 'b', to: 'c', route: 'curved' } },
    { connector: { from: 'n', to: 'a', route: 'straight' } },
  ] };
for (const direction of ['ltr','rtl']) {
const r = composeSlide(slide, { width: 1280, height: 720, ...(direction==='rtl'?{direction:'rtl'}:{}) });
for (const i of r.items) console.log(i.path, JSON.stringify(i.box));
for (const o of r.overlayShapes ?? []) {
  if (o.kind === 'shape') console.log('SHAPE', o.path, JSON.stringify(o.box), o.text?.fontSize, JSON.stringify(o.attachedTo));
  else console.log('CXN', o.path, o.preset, JSON.stringify(o.box), o.rotate, o.flipH, o.flipV, JSON.stringify(o.avLst), o.paths[0].d, 'from', JSON.stringify(o.from), 'to', JSON.stringify(o.to));
}
}
