import PptxGenJS from 'file:///C:/opf-work/never-shrink-text/packages/pptx/vendor/pptxgenjs/pptxgen.es.js';
import { writeFileSync } from 'node:fs';
const words = n => Array.from({length:n},(_,i)=>['growth','revenue','customers','market','platform','strategy','quarter','team'][i%8]).join(' ');
const pptx = new PptxGenJS(); pptx.layout = 'LAYOUT_WIDE';
const text = Array.from({length:14},(_,i)=>`Point ${i+1}: ${words(10)}`).join('\n');
const add = (name, fit, extra = {}) => { const s = pptx.addSlide(); s.addText(text, { x: 0.6, y: 1.5, w: 12.1, h: 5.4, fontSize: 24, fontFace: 'Arial', valign: 'top', fit, objectName: name, ...extra }); };
add('shrink-bare', 'shrink');   // <a:normAutofit/> with no fontScale, as a generator writes it
add('none', 'none');            // no autofit element
writeFileSync('C:/opf-work/never-shrink/out/autofit.pptx', Buffer.from(await pptx.write({ outputType: 'nodebuffer' })));
console.log('ok');
