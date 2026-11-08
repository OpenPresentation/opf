import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const repo='C:/opf-work/rr105-sh26-rtl';
const root='C:/opf-work/qualification034-sh26-rtl-suite-01';
const nativeRoot='C:/opf-work/qualification034-sh26-rtl-native-01';
const out='C:/opf-work/qualification034-sh26-rtl-review-01';
const {execFileSync}=await import('node:child_process');
if(execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!=='473d3fff623bda3f191ae2669824f1b02a5d90f8'||execFileSync('git',['-C',repo,'status','--porcelain'],{encoding:'utf8'}).trim())throw Error('Expected clean frozen producer/importer head');
const req=createRequire(repo+'/packages/pptx/package.json');
const sharp=req('sharp');
const {unzipSync,strFromU8}=req('fflate');
const {fromPptx}=await import(pathToFileURL(repo+'/packages/pptx/dist/index.js'));
const parse=b=>JSON.parse(b.toString().replace(/^\uFEFF/,''));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sort=v=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;
function diff(a,b,p='',rows=[]){
 if(JSON.stringify(a)===JSON.stringify(b))return rows;
 if(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)){
  for(const k of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[k],b[k],p+'.'+k,rows);
 }else rows.push({path:p,before:a,after:b});
 return rows;
}
const suiteBytes=await fs.readFile(root+'/suite.json');
const suite=parse(suiteBytes);
await fs.mkdir(out);
const rows=[],panels=[];
for(const c of suite.cases){
 const native=(c.id==='supplemental-controls-7-9'?'C:/opf-work/qualification034-sh26-rtl-native-02':nativeRoot)+'/'+c.id+'/native';
 const terminal=parse(await fs.readFile(native+'/supervisor.json'));
 const report=parse(await fs.readFile(native+'/report.json'));
 if(terminal.exitCode!==0||terminal.timedOut||!terminal.cleanupConfirmed||!report.cleanupConfirmed||report.officeOperationsStopped||report.error)throw Error('Lifecycle incomplete '+c.id);
 const input=await fs.readFile(root+'/'+c.input);
 const saved=await fs.readFile(native+'/native-furniture-control.pptx');
 if(sha(input)!==c.archiveSha256)throw Error('Input changed '+c.id);
 const beforeDiagnostics=[],afterDiagnostics=[];
 const before=await fromPptx(input,{onDiagnostic:d=>beforeDiagnostics.push(d)});
 const after=await fromPptx(saved,{onDiagnostic:d=>afterDiagnostics.push(d)});
 const changes=diff(sort(before),sort(after));
 const stateChanges={edited:diff(report.phases.original.slides,report.phases.edited.slides),reopened:diff(report.phases.original.slides,report.phases.reopened.slides)};
 const zip=unzipSync(saved);
 const shrink=Object.keys(zip).filter(k=>/^ppt\/slides\/slide\d+\.xml$/.test(k)).flatMap(k=>[...strFromU8(zip[k]).matchAll(/<a:(normAutofit|spAutoFit)\b|\bfontScale=/g)].map(m=>({part:k,tag:m[0]})));
 const slideRows=[];
 for(let i=0;i<c.slideCount;i++){
  const page=i+1;
  const images=await Promise.all(['original','edited','reopened'].map(p=>fs.readFile(native+'/'+p+'-slide-'+String(page).padStart(2,'0')+'.png')));
  const slide=report.phases.original.slides[i];
  const preview=await fs.readFile(root+'/previews/'+c.id+'-'+page+'.png');
  const entry={page,shapeCount:slide.shapeCount,phaseImagesExact:new Set(images.map(sha)).size===1,phaseImagesSha256:images.map(sha),previewSha256:sha(preview),nativeFonts:slide.shapes.filter(s=>s.text).map(s=>({name:s.name,text:s.text,font:s.textFont}))};
  slideRows.push(entry);
  panels.push({id:c.id+' / page '+page,preview,native:images[0]});
 }
 const row={id:c.id,inputSha256:sha(input),savedSha256:sha(saved),terminal,slideCount:report.phases.original.slideCount,declaredSlideCount:c.slideCount,declaredMaximumTopLevelShapes:c.declaredTopLevelShapes,canonicalImportExact:!changes.length,canonicalChanges:changes,namedStatesExact:Object.values(stateChanges).every(a=>!a.length),stateChanges,shrink,beforeDiagnostics,afterDiagnostics,slides:slideRows};
 rows.push(row);
 await fs.writeFile(out+'/'+c.id+'-imports.json.gz',zlib.gzipSync(Buffer.from(JSON.stringify({before,after,beforeDiagnostics,afterDiagnostics,changes},null,2))));
}
for(let i=0;i<panels.length;i+=3){
 const batch=panels.slice(i,i+3),layers=[];
 for(const [j,p]of batch.entries()){
  const label=Buffer.from('<svg width="2560" height="50"><rect width="2560" height="50" fill="#eee"/><text x="12" y="32" font-family="Arial" font-size="25">'+p.id+' / sealed CLI preview left / actual PowerPoint right</text></svg>');
  layers.push({input:label,left:0,top:j*770},{input:await sharp(p.preview).resize(1280,720).png().toBuffer(),left:0,top:j*770+50},{input:await sharp(p.native).resize(1280,720).png().toBuffer(),left:1280,top:j*770+50});
 }
 await sharp({create:{width:2560,height:770*batch.length,channels:3,background:'#fff'}}).composite(layers).png().toFile(out+'/sheet-'+String(i/3+1).padStart(2,'0')+'.png');
}
const result={scope:'Two changed sealed inputs, six SH-26 pages; eleven other archives and all thirty previews are byte-exact to the retained earlier witness. Owned original/SaveCopyAs/read-only reopen, empty actions. Whole-range declared Aptos names, native geometry/text, phase PNGs and canonical import compared. Aptos/Aptos Display were not GDI-enumerated; no glyph-file or exact font-binary claim. Root visual acceptance remains separate.',nativeAcceptance:false,sourceManifestSha256:sha(suiteBytes),importerRepositoryRevision:'473d3fff623bda3f191ae2669824f1b02a5d90f8',rows};
await fs.writeFile(out+'/review.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(rows.map(r=>({id:r.id,slides:r.slideCount,shapes:r.slides.map(s=>s.shapeCount),imports:r.canonicalImportExact,namedStates:r.namedStatesExact,images:r.slides.every(s=>s.phaseImagesExact),shrink:r.shrink.length,importDifferenceCount:r.canonicalChanges.length,beforeWarnings:r.beforeDiagnostics.map(d=>d.code),afterWarnings:r.afterDiagnostics.map(d=>d.code)})),null,2));
if(rows.some(r=>!r.canonicalImportExact||!r.namedStatesExact||r.slides.some(s=>!s.phaseImagesExact||s.shapeCount>r.declaredMaximumTopLevelShapes)||r.shrink.length||r.slideCount!==r.declaredSlideCount))process.exitCode=1;
