import { composeSlide } from 'file:///C:/opf-work/sh-04-overlays-connectors/packages/javascript/dist/composition.js';
import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync('C:/opf-work/sh-04-overlays-connectors/examples/technical/shape-overlays-rtl.opf.json','utf8'));
const r = composeSlide(d.slides[0], { presentation: d, slideIndex: 0 });
for (const i of r.items) console.log(i.path, i.text?.fontSize, JSON.stringify(i.textStyle?.fontFamily));
for (const o of r.overlayShapes) console.log(o.path, o.text?.fontSize);
