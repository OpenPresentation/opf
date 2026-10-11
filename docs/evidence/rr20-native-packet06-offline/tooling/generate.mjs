import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {inputs} from './graph.mjs';
const {consumer,output,coreRoot,pptxRoot,expected,graph}=await inputs();
try{await access(output);throw Error('Use a fresh packet directory');}catch(e){if(e.code!=='ENOENT')throw e;}
const require=createRequire(path.join(consumer,'package.json'));
const module=async name=>import(pathToFileURL(require.resolve(name)).href);
const core=await module('@openpresentation/opf'),pptx=await module('@openpresentation/opf-pptx'),{gallery}=await module('@openpresentation/gallery');
const {unzipSync,zipSync,strFromU8,strToU8}=require('fflate');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const options={catalogs:[gallery],seed:1,timestamp:'2026-01-01T00:00:00Z',date:'2026-10-10',provenance:'full'};
const imageBytes=await readFile(path.join(pptxRoot,'test/fixtures/images/wide.png'));
const image={src:`data:image/png;base64,${imageBytes.toString('base64')}`,alt:'Packet local picture'};
const dimensions={widthInches:13.333333,heightInches:7.5};
const base={design:{fontScheme:'roboto',dimensions}};
const decks={
 'layout-title-auto':{slides:[{title:'Implicit automatic',text:'Untouched implicit body.'},{layout:'auto',title:'Explicit automatic',text:'Untouched explicit body.'},{layout:'text',title:[{text:'Rich ',bold:false},'title'],text:'Rich titles remain authored line shapes.'}]},
 'layout-media-regions':{slides:[{layout:'image-beside',title:'Picture region',blocks:[{text:'Native picture notes.'},{image}]},{layout:'chart-beside',title:'Chart region',blocks:[{chart:{type:'bar',data:{columns:['Quarter','Value'],rows:[['Q1',1],['Q2',2]]}}},{text:'Native chart notes.'}]},{layout:'table',title:'Table region',table:{columns:['A','B'],rows:[[1,2],[3,4]]}}]},
 'layout-empty-custom':{catalogs:{custom:{layouts:{named:{name:'Named regions',areas:['first second','first second'],regions:{first:{accepts:['text','list'],flow:'column'},second:{accepts:['image'],role:'media',flow:'none'}}},maximum:{name:'Maximum 12 by 12',areas:Array.from({length:12},(_,y)=>Array.from({length:12},(_,x)=>`cell-${y}-${x}`).join(' ')),regions:Object.fromEntries(Array.from({length:144},(_,i)=>[`cell-${Math.floor(i/12)}-${i%12}`,{accepts:['text'],flow:'none'}]))}}}},slides:[{layout:'two-column',title:'Collapsed empty regions'},{layout:'custom:named',title:'Named custom regions',blocks:[{text:'First region source.'},{image}]},{layout:'custom:maximum',title:'Maximum empty template'}]},
 'table-save':{slides:[{title:'Plain numbers',table:{columns:['A','B'],rows:[[1,2],[3,4]]}},{title:'Rich table',table:{columns:['Name','Note'],rows:[['Alpha',[{text:'Bold',bold:true},' and plain']],['Beta',[{text:'Red',color:'#FF0000'}]]]}},{title:'Headerless',table:{rows:[['a','b'],['c','d']]}}]},
 'furniture-inherited':{organization:{id:'registry_org',name:'  Registry Organization  '},design:{...base.design,header:{left:{text:'  Inherited header\twords\r\nsecond line  \r\n'},center:{text:'Registry Organization'},right:{text:'{{slide.section}}'}},footer:{left:{text:'  Inherited footer  '},right:{text:'{{slide.number}}'}}},slides:[{title:'Inherited furniture',section:'  Alpha section  ',text:'Scalar body inherited — exact.'},{title:'Local furniture',section:'  Beta section  ',text:'Scalar body local — exact.',design:{header:{left:{image,text:'  Local image label  '},center:{text:'Registry Organization'},right:{text:'{{slide.section}}'}},footer:{left:{text:'  Local footer  '},right:{text:'{{slide.number}}'}}}},{title:'Inherited again',section:'  Gamma section  ',text:'Scalar body inherited again — exact.'}]},
 'furniture-flags':{design:{...base.design,header:{left:{text:'Global header must be suppressed.'}},footer:{right:{text:'Global footer must be suppressed.'}}},slides:[{title:'False and empty',text:'Scalar body false and empty.',design:{header:false,footer:{}}},{title:'Empty and false',text:'Scalar body empty and false.',design:{header:{},footer:false}},{title:'Inactive fields',text:'Scalar body inactive fields.',design:{header:{left:{text:''},center:{date:false}},footer:{right:{text:''}}}}]},
 'picture-control':{slides:[{title:'Native picture control',image}]},
};
const chartFixture=JSON.parse(await readFile(path.join(pptxRoot,'test/fixtures/chartex-fallback-main.json')));
for(const [name,deck]of Object.entries(chartFixture.decks))decks[`chart-${name}`]=deck;
await mkdir(output,{recursive:true});
const manifest={source:expected.source,artifacts:graph.artifacts.map(({name,sourceSha,version,sha256,bytes,originalManifest,stagedManifest})=>({name,sourceSha,version,sha256,bytes,originalManifest,stagedManifest})),node:process.version,options:{...options,catalogs:[{source:gallery.source,layoutsSha256:hash(JSON.stringify(gallery.layouts)),layoutCount:Object.keys(gallery.layouts).length}]},files:[],decks:[],negativeControls:[]};
const put=async(relative,bytes)=>{const file=path.join(output,relative);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes);manifest.files.push({file:relative,sha256:hash(bytes),bytes:Buffer.byteLength(bytes)});};
for(const [name,raw]of Object.entries(decks)){
 const deck={...base,...raw};const before=structuredClone(deck);
 const validation=core.validate(deck,{catalogs:[gallery],only:['format','references']});assert.ok(validation.valid,JSON.stringify(validation.findings));
 await put(`sources/${name}.opf.json`,JSON.stringify(deck,null,2)+'\n');
 const diagnostics=[];const bytes=await pptx.toPptx(deck,{...options,onDiagnostic:d=>diagnostics.push(d)});
 assert.deepEqual(deck,before);assert.deepEqual(bytes,await pptx.toPptx(deck,options),'deterministic PPTX');
 const imported=await pptx.fromPptx(bytes,options);const roundTripEqual=isDeepStrictEqual(imported,deck);
 await put(`inspection/${name}-imported.opf.json`,JSON.stringify(imported,null,2)+'\n');
 const parts=unzipSync(bytes),slides=Object.keys(parts).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n));
 const shapes=slides.map(file=>({file,count:(strFromU8(parts[file]).match(/<p:(?:sp|pic|graphicFrame|grpSp)>/g)??[]).length}));
 await put(`inputs/${name}.pptx`,bytes);await put(`inspection/${name}.json`,JSON.stringify({roundTripEqual,acceptance:roundTripEqual?'offline-source-preserved':'failed-pending-review',validation,diagnostics,shapes,layoutParts:Object.keys(parts).filter(p=>/^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(p)),placeholderIndexes:Object.fromEntries(Object.entries(parts).filter(([p])=>/^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(p)).map(([p,b])=>[p,[...strFromU8(b).matchAll(/<p:ph\b[^>]*>/g)].map(([v])=>v)]))},null,2)+'\n');
 manifest.decks.push({name,roundTripEqual,slideCount:slides.length,automaticControlEligible:slides.length<=3&&shapes.every(s=>s.count<=30),chartex:name.startsWith('chart-')?'auto':'not-chart-fixture'});
 for(const format of ['svg','png']){const result=await core.convert(deck,{format,catalogs:[gallery],date:options.date});for(const [i,file]of result.files.entries())await put(`previews/${name}-${String(i+1).padStart(2,'0')}.${format}`,file.bytes);}
}
await put('tooling/generate.mjs',await readFile(new URL(import.meta.url)));
for(const file of ['test/native-furniture-control.ps1','test/native-process.ps1','test/native-furniture-harness-check.ps1','test/native-picture-control.ps1','test/native-picture-harness-check.ps1','test/native-table-colors.mjs','test/native-table-colors.ps1'])await put(`tooling/${path.basename(file)}`,await readFile(path.join(pptxRoot,file)));
await writeFile(path.join(output,'packet.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({output,decks:manifest.decks.length,files:manifest.files.length}));
