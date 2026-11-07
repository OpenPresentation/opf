import {readFileSync} from 'node:fs';
import {layoutDiagram} from 'file:///C:/opf-work/sh-07-native-diagrams/packages/javascript/dist/composition.js';
const measure = (text, size, style) => Array.from(text).length * size * (style.mono ? .6 : style.bold ? .58 : .52);
const src = readFileSync(process.argv[2], 'utf8');
const d = layoutDiagram(src, {width: 800, height: 500, nominal: 24, floor: 16, measure, idPrefix: 'd0'});
console.log(d.type, d.width, d.height, d.scale);
console.log(d.svg);
