import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const [root,nativeRoot,out]=process.argv.slice(2);
if(!root||!nativeRoot||!out)throw Error('suite native fresh-output required');
const repo='C:/opf-work/rr105-tag-ownership';
const revision='3e03bd13d693d91f194769d8d6878adbc27f4146';
const git=(...a)=>execFileSync('git',['-C',repo,...a],{encoding:'utf8'}).trim();
if(git('rev-parse','HEAD')!==revision||git('status','--porcelain'))throw Error('Frozen importer changed');
const req=createRequire(repo+'/packages/pptx/package.json'),sharp=req('sharp');
const {unzipSync,strFromU8}=req('fflate');
const {fromPptx}=await import(pathToFileURL(repo+'/packages/pptx/dist/index.js'));
const {gallery}=await import(pathToFileURL(repo+'/packages/gallery/dist/index.js'));
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
const suiteBytes=await fs.readFile(root+'/suite.json'),suite=parse(suiteBytes);
for(const f of suite.files){const b=await fs.readFile(root+'/'+f.path);if(b.length!==f.bytes||sha(b)!==f.sha256)throw Error('Sealed input changed: '+f.path);}
await fs.mkdir(out);
const rows=[],panels=[];
for(const c of suite.cases){
 const native=nativeRoot+'/'+c.id+'/native';
 const terminal=parse(await fs.readFile(native+'/supervisor.json')),report=parse(await fs.readFile(native+'/report.json'));
 if(terminal.exitCode!==0||terminal.timedOut||!terminal.cleanupConfirmed||!report.cleanupConfirmed||report.officeOperationsStopped||report.error)throw Error('Lifecycle incomplete '+c.id);
 const source=parse(await fs.readFile(root+'/sources/'+c.id+'.opf.json'));
 const input=await fs.readFile(root+'/'+c.input),saved=await fs.readFile(native+'/native-furniture-control.pptx');
 if(sha(input)!==c.archiveSha256)throw Error('Input changed '+c.id);
 const beforeDiagnostics=[],afterDiagnostics=[];
 const before=await fromPptx(input,{catalogs:[gallery],onDiagnostic:d=>beforeDiagnostics.push(d)});
 const after=await fromPptx(saved,{catalogs:[gallery],onDiagnostic:d=>afterDiagnostics.push(d)});
 const changes=diff(sort(before),sort(after)),sourceBeforeChanges=diff(sort(source),sort(before)),sourceSavedChanges=diff(sort(source),sort(after));
 const stateChanges={edited:diff(report.phases.original.slides,report.phases.edited.slides),reopened:diff(report.phases.original.slides,report.phases.reopened.slides)};
 const zip=unzipSync(saved);
 const shrink=Object.keys(zip).filter(k=>/^ppt\/slides\/slide\d+\.xml$/.test(k)).flatMap(k=>[...strFromU8(zip[k]).matchAll(/<a:(normAutofit|spAutoFit)\b|\bfontScale=/g)].map(m=>({part:k,tag:m[0]})));
 const slideRows=[];
 for(let i=0;i<c.slideCount;i++){
  const page=i+1,images=await Promise.all(['original','edited','reopened'].map(p=>fs.readFile(native+'/'+p+'-slide-'+String(page).padStart(2,'0')+'.png')));
  const preview=await fs.readFile(root+'/'+c.preview),slide=report.phases.original.slides[i];
  const entry={page,shapeCount:slide.shapeCount,phaseImagesExact:new Set(images.map(sha)).size===1,phaseImagesSha256:images.map(sha),previewSha256:sha(preview),nativeFonts:slide.shapes.filter(s=>s.text).map(s=>({name:s.name,text:s.text,font:s.textFont}))};
  slideRows.push(entry);panels.push({id:c.id+' / page '+page,preview,native:images[0]});
 }
 const row={id:c.id,inputSha256:sha(input),savedSha256:sha(saved),terminal,slideCount:report.phases.original.slideCount,declaredSlideCount:c.slideCount,declaredMaximumTopLevelShapes:c.declaredTopLevelShapes,canonicalImportExact:!changes.length,canonicalChanges:changes,authoredSourceBeforeExact:!sourceBeforeChanges.length,authoredSourceSavedExact:!sourceSavedChanges.length,sourceBeforeChanges,sourceSavedChanges,namedStatesExact:Object.values(stateChanges).every(a=>!a.length),stateChanges,shrink,beforeDiagnostics,afterDiagnostics,slides:slideRows};
 rows.push(row);
 await fs.writeFile(out+'/'+c.id+'-imports.json.gz',zlib.gzipSync(Buffer.from(JSON.stringify({source,before,after,beforeDiagnostics,afterDiagnostics,changes,sourceBeforeChanges,sourceSavedChanges},null,2))));
}
for(let i=0;i<panels.length;i+=3){
 const batch=panels.slice(i,i+3),layers=[];
 for(const [j,p]of batch.entries()){
  const label=Buffer.from('<svg width="2560" height="50"><rect width="2560" height="50" fill="#eee"/><text x="12" y="32" font-family="Arial" font-size="25">'+p.id+' / sealed CLI preview left / actual PowerPoint right</text></svg>');
  layers.push({input:label,left:0,top:j*770},{input:await sharp(p.preview).resize(1280,720).png().toBuffer(),left:0,top:j*770+50},{input:await sharp(p.native).resize(1280,720).png().toBuffer(),left:1280,top:j*770+50});
 }
 await sharp({create:{width:2560,height:770*batch.length,channels:3,background:'#fff'}}).composite(layers).png().toFile(out+'/sheet-'+String(i/3+1).padStart(2,'0')+'.png');
}
const result={scope:'Exact sealed inputs and every authored field/Unicode codepoint; owned original/SaveCopy/reopen. No Unicode/language normalization, no fixture substitution or tolerance changes. Actual glyph judgment is separate and nativeAcceptance remains false. Known visually reversed pages must not be accepted from matching text/API state.',nativeAcceptance:false,sourceManifestSha256:sha(suiteBytes),reviewProducerSha256:sha(await fs.readFile(new URL(import.meta.url))),importerRepositoryRevision:revision,rows};
await fs.writeFile(out+'/review.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(rows.map(r=>({id:r.id,slides:r.slideCount,shapes:r.slides.map(s=>s.shapeCount),imports:r.canonicalImportExact,authoredBefore:r.authoredSourceBeforeExact,authoredSaved:r.authoredSourceSavedExact,namedStates:r.namedStatesExact,images:r.slides.every(s=>s.phaseImagesExact),shrink:r.shrink.length,importDifferenceCount:r.canonicalChanges.length,sourceDifferenceCount:r.sourceSavedChanges.length,beforeWarnings:r.beforeDiagnostics.map(d=>d.code),afterWarnings:r.afterDiagnostics.map(d=>d.code)})),null,2));
if(rows.some(r=>!r.canonicalImportExact||!r.authoredSourceBeforeExact||!r.authoredSourceSavedExact||!r.namedStatesExact||r.slides.some(s=>!s.phaseImagesExact||s.shapeCount>r.declaredMaximumTopLevelShapes)||r.shrink.length||r.slideCount!==r.declaredSlideCount))process.exitCode=1;
