import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {toPptx,fromPptx} from './helpers/default-catalog.mjs';
const cases=value=>[
 ['heading',{title:[{text:value,bold:true}]}],
 ['body',{text:[{text:value,bold:true}]}],
 ['list',{items:[{text:[{text:value,bold:true}]}]}],
 ['table',{table:{columns:['A'],rows:[[[{text:value,bold:true}]]]}}],
 ['plain-table',{table:{columns:['A'],rows:[[value]]}}],
];
for(const invalid of ['\0','\u0001','\u000B','\uD800','\uDC00','\uFFFE','\uFFFF'])for(const [name,slide] of cases(`Before${invalid}After`)) {
 await assert.rejects(()=>toPptx({slides:[slide]}),error=>error.code==='invalid-text'&&error.details.path.startsWith('slides.0.')&&/UTF-16 offset/.test(error.message),`${name} rejects XML-invalid authored rich text`);
}
await assert.rejects(()=>toPptx({slides:[{title:'Before\0After'}]}),error=>error.code==='invalid-text'&&error.details.path==='slides.0.title','existing plain heading code/path');
const legal='Tab\tLF\nCR\rPair 😀';
for(const [name,slide] of cases(legal)) {
 const bytes=await toPptx({slides:[slide]});
 const entries=unzipSync(bytes),xml=new TextDecoder().decode(entries['ppt/slides/slide1.xml']);
 assert.ok(xml.includes('😀'),`${name}: legal non-BMP pair reaches the actual slide member`);
 assert.doesNotMatch(xml,/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/u);
 const imported=await fromPptx(bytes);
 assert.equal(imported.slides.length,1);
}
// Complete rich heading text (including hard-line whitespace) keeps its normal roundtrip contract.
const title=['Tab\t',{text:'LF\nCR\rPair 😀',bold:true}];
const imported=await fromPptx(await toPptx({slides:[{title}]}));
const flatten=value=>Array.isArray(value)?value.map(run=>typeof run==='string'?run:run.text).join(''):value;
assert.equal(flatten(imported.slides[0].title),legal);
console.log('Rich heading/body/list/table XML negatives and legal actual PPTX/roundtrip controls passed.');
