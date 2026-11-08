// Bounded checkout qualification, never a published0.34 or registry receipt. Existing authored inputs only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import {currentGallerySource,sheetSvg} from 'file:///C:/opf-work/lh-10-reading-measure/scripts/e1-current-after.mjs';
import {BUNDLED_FONT_MANIFEST} from 'file:///C:/opf-work/lh-10-reading-measure/packages/render/src/font-manifest.js';
const workspace='C:/opf-work/lh-10-reading-measure',out='C:/opf-work/lh10-source-qual-02',baseline='C:/opf-work/e1-033-after-02',consumer='C:/opf-work/core033-office-consumer-01',sha=b=>createHash('sha256').update(b).digest('hex');
assert.ok(!fs.existsSync(out),'Fresh source qualification root');
const read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),fact=p=>{const b=read(p);return{bytes:b.length,sha256:sha(b)};},git=args=>execFileSync('git',['-C',workspace,...args],{encoding:'utf8'}).trim();
assert.equal(git(['rev-parse','HEAD']),'05898592029fe26de54232a5ae8a328a88cbe692');assert.equal(git(['status','--porcelain']),'');
const modules={gallery:'packages/gallery',opf:'packages/javascript',render:'packages/render',cli:'packages/cli'};
function entry(kind,key='.') {const dir=path.join(workspace,modules[kind]),pkg=json(dir+'/package.json');let value=pkg.exports?.[key];while(typeof value!=='string'){assert.ok(value&&typeof value==='object');const condition=Object.keys(value).find(k=>['node','import','default'].includes(k));assert.ok(condition);value=value[condition];}assert.ok(value.startsWith('./'));const p=path.resolve(dir,value);assert.ok(path.relative(dir,p)&&!path.relative(dir,p).startsWith('..'));return pathToFileURL(p).href;}
const {gallery}=await import(entry('gallery')),{examples}=await import(entry('opf','./examples')),render=await import(entry('render')),fontsModule=await import(entry('render','./fonts-node'));
assert.equal(Object.keys(gallery.layouts).length,40);assert.equal(examples.length,147);assert.equal(examples.find(e=>e.file==='examples/technical/layout-sampler.opf.json').deck.slides.length,53);
const old=json(baseline+'/receipt.json'),selected=json('C:/opf-work/e1-033-overflow-triage-input.json').map(r=>({deck:r.deck,id:r.id,ordinal:r.ordinal,reason:'overflow-warning'}));
for(const row of json('C:/opf-work/e1-033-lower-count-capacity.json'))if(!selected.some(r=>r.deck===row.deck&&r.id===row.id))selected.push({deck:row.deck,id:row.id,ordinal:Number(row.id.slice(1)),reason:'table-beside-capacity'});
selected.push({deck:'batch-13',id:'s32',ordinal:32,reason:'84-character-reading-measure'});assert.equal(selected.length,22);
const fontRequire=createRequire(workspace+'/packages/render/package.json'),fontProof=[];
for(const record of BUNDLED_FONT_MANIFEST.packages.filter(p=>p.pack==='base'||p.pack==='office')){
 const source=record.vendored?workspace+'/packages/render/'+record.vendored:path.dirname(fontRequire.resolve(record.name+'/package.json'));
 const before=record.vendored?consumer+'/node_modules/@openpresentation/opf-render/'+record.vendored:consumer+'/node_modules/'+record.name;
 assert.equal(sha(read(source+'/'+record.licenseFile)),record.licenseSha256);assert.equal(sha(read(before+'/'+record.licenseFile)),record.licenseSha256);
 for(const face of record.faces){const a=read(source+'/'+face.file),b=read(before+'/'+face.file);assert.equal(sha(a),face.sha256);assert.ok(a.equals(b),'Identical source/published font files');fontProof.push({package:record.name,file:face.file,sha256:sha(a),license:record.license,licenseSha256:record.licenseSha256});}
}
const dist=[];for(const name of ['javascript','gallery','render','pptx','cli','editor','mcp']){const root=workspace+'/packages/'+name+'/dist';function walk(dir,rel=''){for(const e of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const p=rel?rel+'/'+e.name:e.name;if(e.isDirectory())walk(dir+'/'+e.name,p);else dist.push({file:'packages/'+name+'/dist/'+p,...fact(dir+'/'+e.name)});}}walk(root);}
fs.mkdirSync(out);const save=(relative,b)=>{const p=out+'/'+relative;fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b,{flag:'wx'});return p;};
const receipt={schema:'opf-e1-source-qualification/v1',published:false,npmReleaseClaim:false,source:'05898592029fe26de54232a5ae8a328a88cbe692',prospectiveRelease:'0.34.0',actualPackageVersion:json(workspace+'/packages/cli/package.json').version,sourceCounts:{examples:147,gallery:101,technical:46,layouts:40,sampler:53},date:'2026-11-08',scale:0.5,complete:false,selected,fonts:{policy:{pack:'office',substitutionPolicy:'visual',scripts:'auto'},samePhysicalFontFilesAsPublished033:true,faces:fontProof},distSha256:sha(JSON.stringify(dist)),decks:[],cases:[],errors:[]};
save('dist-inventory.json',JSON.stringify(dist,null,2)+'\n');save('font-proof.json',JSON.stringify(receipt.fonts,null,2)+'\n');save('driver.mjs',read(new URL(import.meta.url)));
let sheetFonts;
try {
for(const id of [...new Set(selected.map(r=>r.deck))]){
 const previous=old.decks.find(d=>d.id===id),raw=read(baseline+'/decks/'+id+'/original.opf.json');assert.equal(sha(raw),previous.original.sha256);const current=currentGallerySource(raw,gallery);assert.equal(sha(current.bytes),previous.current.sha256,'Byte-exact current-gallery input to both versions');
 const group=selected.filter(r=>r.deck===id).sort((a,b)=>a.ordinal-b.ordinal),input=save('decks/'+id+'/input.opf.json',current.bytes);save('decks/'+id+'/original.opf.json',raw);const directory=out+'/decks/'+id+'/after';fs.mkdirSync(directory);
 const pkg=json(workspace+'/packages/cli/package.json'),cli=path.resolve(workspace+'/packages/cli',typeof pkg.bin==='string'?pkg.bin:pkg.bin.opf),args=[cli,'convert',input,directory+'/slide-{n}.png','--slides',group.map(r=>r.ordinal).join(','),'--scale','0.5','--date','2026-11-08','--keep-slides','--include-hidden'];
 const result=spawnSync(process.execPath,args,{cwd:workspace,encoding:'utf8',maxBuffer:64e6,timeout:300000,windowsHide:true});save('decks/'+id+'/cli.stdout.json',result.stdout??'');save('decks/'+id+'/cli.stderr.txt',result.stderr??'');save('decks/'+id+'/cli.exit.json',JSON.stringify({status:result.status,signal:result.signal,error:result.error?String(result.error):null,args},null,2)+'\n');assert.equal(result.status,0,'Preserve first source CLI refusal');
 const report=JSON.parse(result.stdout);assert.equal(report.ok,true);assert.equal(report.outputs.length,group.length);assert.equal(report.fonts.pack,'office');assert.equal(report.fonts.substitutionPolicy,'visual');assert.deepEqual(report.fonts.userFonts,[]);receipt.decks.push({id,originalSha256:sha(raw),inputSha256:sha(current.bytes),counts:report.counts,findings:report.findings,fontRoute:report.fonts});
 for(const [i,row]of group.entries()){
  const output=report.outputs[i],file=path.resolve(output.file),expected='slide-'+String(row.ordinal).padStart(String(Math.max(...group.map(r=>r.ordinal))).length,'0')+'.png';assert.equal(path.basename(file),expected);assert.equal(path.dirname(file),directory.replaceAll('/',path.sep));assert.equal(sha(read(file)),output.sha256);
  const oldSlide=previous.slides[row.ordinal-1];assert.equal(oldSlide.id,row.id);const beforeFile=baseline+'/decks/'+id+'/after/'+previous.outputs[row.ordinal-1].file,before=read(beforeFile);assert.equal(sha(before),previous.outputs[row.ordinal-1].sha256);save('baseline033/'+id+'-'+row.id+'.png',before);
  for(const role of ['before','claude'])if(oldSlide[role]){const b=read(baseline+'/decks/'+id+'/fixed/'+role+'-'+row.id+'.png');assert.equal(sha(b),oldSlide[role].sha256);save('fixed/'+id+'-'+row.id+'-'+role+'.png',b);}
  const selectedFindings=(report.findings??[]).filter(f=>f.path?.startsWith('/slides/'+(row.ordinal-1)+'/'));
  receipt.cases.push({...row,after:fact(file),afterFile:path.relative(out,file).replaceAll('\\','/'),published033:fact(beforeFile),samePngAs033:read(file).equals(before),findings:selectedFindings});
 }
 fs.writeFileSync(out+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');
}
sheetFonts=await fontsModule.loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:{slides:[{title:'Published033 Source034 Claude'}]}});receipt.sheets=[];
for(let i=0;i<receipt.cases.length;i+=4){const group=receipt.cases.slice(i,i+4),rows=group.map(row=>({label:row.deck+'/'+row.id+' '+row.reason,before:read(out+'/baseline033/'+row.deck+'-'+row.id+'.png'),after:read(out+'/'+row.afterFile),claude:read(out+'/fixed/'+row.deck+'-'+row.id+'-claude.png')})),svg=sheetSvg(rows).replace('Before (fixed)','Published 0.33').replace('After (current release)','0.34 source (unreleased)'),name='sheets/review-'+String(i/4+1).padStart(2,'0');save(name+'.svg',svg);const p=save(name+'.png',await render.toPng(svg,{fonts:sheetFonts,scale:1}));receipt.sheets.push({file:name+'.png',...fact(p)});}
assert.equal(git(['status','--porcelain']),'');receipt.complete=true;
} catch(error){receipt.errors.push({name:error.name,message:error.message,stack:error.stack});throw error;} finally {fs.writeFileSync(out+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');}
console.log(JSON.stringify({complete:receipt.complete,cases:receipt.cases.length,decks:receipt.decks.length,sheets:receipt.sheets.length,published:false,unchangedPngs:receipt.cases.filter(c=>c.samePngAs033).length}));