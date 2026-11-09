import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {validate} from '../../../../packages/javascript/dist/index.js';
import {gallery} from '../../../../packages/gallery/dist/index.js';
const manifest=JSON.parse(readFileSync(new URL('inputs/manifest.json',import.meta.url))),results=[];
for(const [name,key]of [['original-16','original'],['extended-36','extended']]){
 const bytes=readFileSync(new URL('inputs/'+name+'.opf.json',import.meta.url)),doc=JSON.parse(bytes);
 assert.equal(bytes.length,manifest[key].bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest[key].sha256);
 const report=validate(doc,{only:['format'],catalogs:[gallery]});
 results.push({name,bytes:bytes.length,slides:doc.slides.length,valid:report.valid,errors:report.findings.filter(f=>f.severity==='error')});
}
const original=JSON.parse(readFileSync(new URL('inputs/original-16.opf.json',import.meta.url))),extended=JSON.parse(readFileSync(new URL('inputs/extended-36.opf.json',import.meta.url)));
assert.deepEqual(extended.slides.slice(0,16),original.slides);assert.equal(extended.slides.length-original.slides.length,20);
writeFileSync(new URL('input-validation.json',import.meta.url),JSON.stringify({results,firstSixteenSlidesUnchanged:true,exactlyTwentyAdded:true},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(results));process.exitCode=results.every(r=>r.valid)?0:1;
