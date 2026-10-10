import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {embed,paginate,validate} from '../packages/javascript/dist/index.js';
import {gallery} from '@openpresentation/gallery';
import {toSvg, toPng} from '../../opf-render/dist/index.js';
import {toPptx} from '../../opf-pptx/dist/index.js';
const require=createRequire(new URL('../../opf-pptx/package.json',import.meta.url));
const {unzipSync}=require('fflate');
const {XMLParser}=require('fast-xml-parser');
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:''});
const list=value=>Array.isArray(value)?value:value?[value]:[];
const text='Describe the evidence clearly. Keep related details together and preserve the original words. '.repeat(60);
const rows=Array.from({length:55},(_,index)=>[`Checkpoint ${index+1}`,index%2?'Verified':'In review']);
// OPF 0.15: core registers no catalog; the deck embeds the records it names (theme classic and its schemes), as a saved deck does.
const source=embed({name:'Pagination verification',design:{theme:'classic'},slides:[{id:'draft',title:'A draft that needs room to breathe',text},{id:'checkpoints',title:'Review every checkpoint',table:{columns:['Checkpoint','Status'],rows}}]},{catalogs:[gallery]}).document;
const result=paginate(source);
assert.equal(validate(result.presentation,{ only: ['format'] }).valid,true);
assert.equal(result.presentation.slides.filter(s=>s.text).map(s=>s.text).join(''),text);
assert.deepEqual(result.presentation.slides.filter(s=>s.table).flatMap(s=>s.table.rows),rows);
const diagnostics=[];
const svgs=toSvg(result.presentation,{onDiagnostic:issue=>diagnostics.push(issue)});
assert.deepEqual(diagnostics,[]);
const bytes=await toPptx(result.presentation);
const entries=unzipSync(bytes);
const slideFiles=Object.keys(entries).filter(key=>/^ppt\/slides\/slide\d+\.xml$/.test(key));
assert.equal(slideFiles.length,result.presentation.slides.length,'PPTX must not create hidden extra table pages');
let exportedDataRows=0;
for(const file of slideFiles){
 const xml=parser.parse(new TextDecoder().decode(entries[file]));
 const frames=list(xml['p:sld']['p:cSld']['p:spTree']['p:graphicFrame']);
 for(const frame of frames){const table=frame['a:graphic']?.['a:graphicData']?.['a:tbl'];if(table)exportedDataRows+=list(table['a:tr']).length-1;}
}
assert.equal(exportedDataRows,rows.length);
await mkdir(new URL('../artifacts/pagination/',import.meta.url),{recursive:true});
await writeFile(new URL('../artifacts/pagination/source.opf.json',import.meta.url),JSON.stringify(source,null,2));
await writeFile(new URL('../artifacts/pagination/paginated.opf.json',import.meta.url),JSON.stringify(result.presentation,null,2));
await writeFile(new URL('../artifacts/pagination/paginated.pptx',import.meta.url),bytes);
for(let i=0;i<svgs.length;i++)await writeFile(new URL(`../artifacts/pagination/slide-${i+1}.png`,import.meta.url),await toPng(svgs[i]));
console.log(`Pagination ecosystem passed: ${source.slides.length} source slides -> ${svgs.length} pages; all text and ${exportedDataRows} table rows preserved.`);
