import { composeSlide } from 'file:///C:/opf-work/sh-04-overlays-connectors/packages/javascript/dist/composition.js';
const slide = { title: 'Flow', blocks: [ { id: 'a', shape: 'rect', text: 'A' }, { id: 'pic', image: { src: 'https://e.com/a.png', alt: 'a' } }, { id: 'g', blocks: [{ id: 't', text: 'hello world' }, { text: 'x', items: undefined }] } ] };
const r = composeSlide(slide, { width: 1280, height: 720 });
for (const i of r.items) console.log(i.path, i.field, JSON.stringify(i.box), i.frameBox ? 'frame ' + JSON.stringify(i.frameBox) : '', i.image ? 'img ' + JSON.stringify(i.image.box ?? i.image.frame) : '', i.payload?.id);
for (const g of r.groups) console.log('group', g.path, JSON.stringify(g.box));
console.log(Object.keys(r.items.find(i=>i.image).image));
