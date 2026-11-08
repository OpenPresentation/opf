// Prepared only: root must approve the frozen merged fix head and successful build before invocation.
// No Office, network, builds, source writes, archive edits or cleanup operations are performed here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import zlib from 'node:zlib';

const REPO = 'C:/opf-work/rr105-sh26-rtl';
const WORK_ROOT = 'C:/opf-work';
const SCOPE_BASE = '495bc4a98e904561e212d8035632fedd614ea727';
const SUITE_ROOT = 'C:/opf-work/qualification034-sh26-suite-02';
const SUITE_SHA = '1f87dd96814a7c9582d77a28cde3471f30e5868817665b5cb0128cfd12958ce3';
const OLD_ROOT = 'C:/opf-work/sh26-native-chunks-02';
const OLD_BUILD_SHA = '667670ef816ba6952d9a12a06464783339e94f0ec28e9166fe08a5277365d610';
const IDS = ['inverted-pyramid-continuation-1-3','inverted-pyramid-continuation-4','org-chart-continuation-1-3','org-chart-continuation-4','hierarchy-continuation-1-3','hierarchy-continuation-4','venn-continuation-1-3','venn-continuation-4','supplemental-controls-1-3','supplemental-controls-4-6','supplemental-controls-7-9','supplemental-controls-10-12','supplemental-controls-13-14'];
const DATE = '2026-11-08';
const PACKAGES = ['javascript','gallery','render','pptx','editor','cli','mcp'];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => fs.readFileSync(file);
const json = file => JSON.parse(read(file).toString('utf8').replace(/^\uFEFF/u,''));
const fact = file => {const b=read(file);return {bytes:b.length,sha256:sha(b)};};
const git = (...args) => execFileSync('git',['-C',REPO,...args],{encoding:'utf8',maxBuffer:64*1024*1024,windowsHide:true}).trim();
function relative(root, name) {
  assert.equal(typeof name,'string');
  assert.ok(name && !name.includes('\\') && !path.isAbsolute(name) && !name.split('/').some(p=>!p||p==='.'||p==='..'), 'Unsafe relative manifest path');
  const result=path.resolve(root,name);
  assert.ok(path.relative(path.resolve(root),result) && !path.relative(path.resolve(root),result).startsWith('..'+path.sep));
  return result;
}
function regular(file) {assert.ok(fs.lstatSync(file).isFile()&&!fs.lstatSync(file).isSymbolicLink(),'Regular file required: '+file);return file;}
function inventory(root, directory=root) {
  return fs.readdirSync(directory).sort().flatMap(name=>{
    const file=path.join(directory,name),stat=fs.lstatSync(file);
    assert.ok(!stat.isSymbolicLink(),'Do not follow links: '+file);
    return stat.isDirectory()?inventory(root,file):[{path:path.relative(root,file).split(path.sep).join('/'),...fact(regular(file))}];
  });
}
function runtime() {
  assert.equal(git('status','--porcelain'),'','Tracked/untracked source must be clean');
  return {head:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),clean:true,
    roots:git('ls-tree','HEAD','packages','spec','examples','pnpm-lock.yaml','pnpm-workspace.yaml','package.json'),
    packages:PACKAGES.map(name=>({name,manifest:fact(regular(REPO+'/packages/'+name+'/package.json')),version:json(REPO+'/packages/'+name+'/package.json').version,dist:inventory(REPO+'/packages/'+name+'/dist')})),
    node:{version:process.version,file:process.execPath,...fact(regular(process.execPath))}};
}
function stable(value) {return Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;}
function differences(a,b,at='',rows=[]) {
  if(JSON.stringify(a)===JSON.stringify(b))return rows;
  if(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b))for(const key of new Set([...Object.keys(a),...Object.keys(b)]))differences(a[key],b[key],at+'.'+key,rows);
  else rows.push({path:at,before:a,after:b});
  return rows;
}
function options() {
  const args=process.argv.slice(2),result={};
  for(let i=0;i<args.length;i+=2){assert.ok(['--expect-head','--build-log','--out'].includes(args[i]),'Unknown argument');assert.ok(args[i+1]&&!Object.hasOwn(result,args[i]),'Missing/duplicate argument');result[args[i]]=args[i+1];}
  assert.match(result['--expect-head']??'',/^[a-f0-9]{40}$/u,'An explicitly approved full frozen merged head is required');
  assert.ok(result['--build-log']&&result['--out'],'Usage: node export-sh26-rtl-targeted.mjs --expect-head <40sha> --build-log <successful-root-build.log> --out <fresh-C:/opf-work/sibling>');
  assert.notEqual(result['--expect-head'],SCOPE_BASE,'The unfixed qualification base is not an approved fix head');
  return {head:result['--expect-head'],buildLog:path.resolve(result['--build-log']),out:path.resolve(result['--out'])};
}

let out,stage='arguments';
const save = (name,bytes) => {const file=relative(out,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'wx'});return file;};
const saveJson = (name,value) => save(name,JSON.stringify(value,null,2)+'\n');
try {
  const opt=options();
  assert.equal(Number(process.versions.node.split('.')[0]),24,'Use Node24');
  assert.equal(path.dirname(opt.out).toLowerCase(),path.resolve(WORK_ROOT).toLowerCase(),'Use a new direct short-path sibling under C:/opf-work');
  assert.ok(!fs.existsSync(opt.out),'Fresh output required; never resume/overwrite an earlier attempt');
  regular(opt.buildLog);
  assert.equal(git('rev-parse','HEAD'),opt.head,'Source head differs from the explicitly approved head');
  git('merge-base','--is-ancestor',SCOPE_BASE,opt.head);
  assert.equal(git('status','--porcelain'),'','Source checkout must be clean');
  const suiteBytes=read(SUITE_ROOT+'/suite.json'),oldBuildBytes=read(OLD_ROOT+'/build.json');
  assert.equal(sha(suiteBytes),SUITE_SHA);assert.equal(sha(oldBuildBytes),OLD_BUILD_SHA);
  const suite=json(SUITE_ROOT+'/suite.json'),oldBuild=json(OLD_ROOT+'/build.json'),oldReceipt=json(OLD_ROOT+'/receipt.json');
  assert.deepEqual(suite.cases.map(c=>c.id),IDS);assert.deepEqual(oldBuild.decks.map(c=>c.id),IDS);
  assert.equal(suite.cases.reduce((n,c)=>n+c.slideCount,0),30);
  const oldInventories={suite:inventory(SUITE_ROOT),baseline:inventory(OLD_ROOT)},buildLogIdentity=fact(opt.buildLog);
  const sourceScope={baseline:SCOPE_BASE,head:opt.head,changedPaths:git('diff','--name-status',SCOPE_BASE,opt.head).split('\n').filter(Boolean),
    productionPaths:git('diff','--name-only',SCOPE_BASE,opt.head,'--',...PACKAGES.map(name=>'packages/'+name+'/src'),'spec','packages/gallery/catalog','examples').split('\n').filter(Boolean)};
  assert.ok(sourceScope.productionPaths.length,'No production fix delta from the qualification base');
  const before=runtime();assert.equal(before.head,opt.head);
  fs.mkdirSync(opt.out);out=opt.out;
  saveJson('runtime-before.json',before);saveJson('reference-inventory-before.json',oldInventories);saveJson('source-scope.json',sourceScope);
  save('source-production.diff',git('diff','--no-ext-diff','--full-index',SCOPE_BASE,opt.head,'--',...PACKAGES.map(name=>'packages/'+name+'/src'),'spec','packages/gallery/catalog','examples')+'\n');
  save('successful-build.log',read(opt.buildLog));
  saveJson('build-log-identity.json',{originalPath:opt.buildLog,...buildLogIdentity,sourceHead:opt.head,successAuthority:'Coordinator must verify this completed build at the approved head before invoking. The producer does not infer success from log contents or run another build.'});
  save('input-suite.json',suiteBytes);save('old-build.json',oldBuildBytes);saveJson('node-and-producer.json',{node:before.node,producerFile:fileURLToPath(import.meta.url),producer:fact(fileURLToPath(import.meta.url)),date:DATE});
  const req=createRequire(REPO+'/packages/pptx/package.json'),{unzipSync}=req('fflate'),{XMLParser}=req('fast-xml-parser'),parser=new XMLParser({ignoreAttributes:false});
  const {fromPptx}=await import(pathToFileURL(REPO+'/packages/pptx/dist/index.js').href);
  const array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
  const slideCountAndCaps=bytes=>{
    const zip=unzipSync(bytes),parts=Object.keys(zip).filter(name=>/^ppt\/slides\/slide\d+\.xml$/u.test(name)).sort((a,b)=>Number(a.match(/slide(\d+)/u)[1])-Number(b.match(/slide(\d+)/u)[1]));
    return parts.map(part=>{const xml=Buffer.from(zip[part]).toString('utf8'),tree=parser.parse(xml)['p:sld']['p:cSld']['p:spTree'];return {part,topLevelShapes:['p:sp','p:grpSp','p:graphicFrame','p:cxnSp','p:pic'].reduce((n,key)=>n+array(tree[key]).length,0),autofitTags:[...xml.matchAll(/<a:(?:normAutofit|spAutoFit)\b|\bfontScale=/gu)].map(m=>m[0])};});
  };
  const zipDiff=(oldBytes,newBytes)=>{
    const a=unzipSync(oldBytes),b=unzipSync(newBytes),rows=[];
    for(const part of [...new Set([...Object.keys(a),...Object.keys(b)])].sort())if(!a[part]||!b[part]||!Buffer.from(a[part]).equals(Buffer.from(b[part]))){
      const row={part,old:a[part]?{bytes:a[part].length,sha256:sha(a[part])}:null,new:b[part]?{bytes:b[part].length,sha256:sha(b[part])}:null};
      if(/\.xlsx$/iu.test(part)&&a[part]&&b[part])row.embeddedWorkbookParts=zipDiff(a[part],b[part]);
      rows.push(row);
    }
    return rows;
  };
  const receipt={sourceScope,buildLog:buildLogIdentity,node:before.node,nativeAcceptance:false,registryAcceptance:false,
    baselineNativeAcceptance:false,baselineEvidence:'eb3b3cbb815e39db2e06ec3ae3ec06f25be7e94f',
    comparisonHint:{expectedChangedArchives:['supplemental-controls-4-6','supplemental-controls-7-9'],meaning:'Expectation only; actual deltas are recorded without rewriting or assuming this set.'},cases:[]};
  const manifest={manifestVersion:1,revision:opt.head,dirty:false,qualificationTarget:'unreleased034source',opfVersion:json(REPO+'/packages/javascript/package.json').version,node:process.version,nativeAcceptance:false,sourceSuiteSha256:SUITE_SHA,date:DATE,fontRoute:{pack:'office',substitutionPolicy:'visual',scripts:'auto',userFonts:[]},decks:[]};
  for(const c of suite.cases){
    stage='preflight:'+c.id;
    assert.ok(c.slideCount>=1&&c.slideCount<=3);assert.equal(c.declaredTopLevelShapes,16,'Do not alter the declared shape guard');
    const d=oldBuild.decks.find(d=>d.id===c.id),oldRow=oldReceipt.rows.find(row=>row.id===c.id);assert.ok(d&&oldRow);
    const sourceName='sources/'+c.id+'.opf.json',sourceFact=suite.files.find(f=>f.path===sourceName);assert.ok(sourceFact);
    const bytes=read(relative(SUITE_ROOT,sourceName));assert.deepEqual({bytes:bytes.length,sha256:sha(bytes)},{bytes:sourceFact.bytes,sha256:sourceFact.sha256});
    assert.deepEqual(bytes,read(relative(OLD_ROOT,d.source)),'Use the exact already sealed complete OPF subset');
    const doc=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/u,''));assert.equal(doc.slides.length,c.slideCount);assert.equal(d.previewSlides,c.slideCount);
    const oldArchive=read(relative(OLD_ROOT,d.variants[0].pptx));assert.equal(sha(oldArchive),d.variants[0].sha256);assert.equal(sha(oldArchive),c.archiveSha256);
    const dir='cases/'+c.id,input=save(dir+'/source.opf.json',bytes);save(dir+'/before.pptx',oldArchive);
    const row={id:c.id,source:{suitePath:sourceName,...sourceFact},sourcePages:d.sourcePages,sourceFullPresentation:false,reports:[],previewComparisons:[]};
    for(const kind of ['png','pptx']){
      stage='export:'+c.id+':'+kind;
      const output=kind==='png'?out+'/preview/'+c.id+'/slide-{n}.png':out+'/'+dir+'/after.pptx';
      const args=['packages/cli/dist/index.js','convert',input,output,'--date',DATE,'--keep-slides',...(kind==='png'?['--include-hidden']:[])];
      const child=spawnSync(process.execPath,args,{cwd:REPO,encoding:'utf8',maxBuffer:64*1024*1024,windowsHide:true});
      save(dir+'/'+kind+'.stdout.json',child.stdout??'');save(dir+'/'+kind+'.stderr.txt',child.stderr??'');
      saveJson(dir+'/'+kind+'.exit.json',{args,cwd:REPO,status:child.status,signal:child.signal,error:child.error?String(child.error):undefined});
      assert.equal(child.status,0,'CLI refused '+c.id+'/'+kind+'; retained first output and stopped');
      const report=JSON.parse(child.stdout);assert.equal(report.ok,true);assert.equal(report.fonts.pack,'office');assert.equal(report.fonts.substitutionPolicy,'visual');assert.deepEqual(report.fonts.userFonts,[]);
      row.reports.push({kind,fonts:report.fonts,findings:report.findings});
      if(kind==='png'){
        assert.equal(report.outputs.length,c.slideCount);
        for(let page=1;page<=c.slideCount;page++){
          const outputFact=report.outputs.find(f=>f.slide===page);assert.ok(outputFact);
          const newFile=out+'/preview/'+c.id+'/slide-'+page+'.png',newBytes=read(newFile);assert.equal(sha(newBytes),outputFact.sha256);assert.equal(newBytes.length,outputFact.bytes);
          const oldPreview=oldRow.previews.find(p=>p.nativePage===page);assert.ok(oldPreview);
          const oldFile=OLD_ROOT+'/preview/'+c.id+'/slide-'+page+'.png',oldBytes=read(oldFile),suitePreview='previews/'+c.id+'-'+page+'.png',suitePreviewFact=suite.files.find(f=>f.path===suitePreview);assert.ok(suitePreviewFact);
          assert.deepEqual({bytes:oldBytes.length,sha256:sha(oldBytes)},{bytes:suitePreviewFact.bytes,sha256:suitePreviewFact.sha256});assert.deepEqual(oldBytes,read(relative(SUITE_ROOT,suitePreview)));
          assert.equal(sha(oldBytes),oldPreview.qualification.sha256);save(dir+'/before-slide-'+page+'.png',oldBytes);
          row.previewComparisons.push({page,old:{bytes:oldBytes.length,sha256:sha(oldBytes)},new:{bytes:newBytes.length,sha256:sha(newBytes)},byteExact:oldBytes.equals(newBytes),oldDimensions:{width:oldBytes.readUInt32BE(16),height:oldBytes.readUInt32BE(20)},newDimensions:{width:newBytes.readUInt32BE(16),height:newBytes.readUInt32BE(20)}});
        }
      }
    }
    stage='compare:'+c.id;
    const archive=read(out+'/'+dir+'/after.pptx'),slideCaps=slideCountAndCaps(archive);assert.equal(slideCaps.length,c.slideCount);assert.ok(slideCaps.every(slide=>slide.topLevelShapes<=16),'Actual new archive exceeds unchanged sixteen-shape guard');
    const beforeDiagnostics=[],afterDiagnostics=[],oldImported=await fromPptx(oldArchive,{onDiagnostic:d=>beforeDiagnostics.push(d)}),newImported=await fromPptx(archive,{onDiagnostic:d=>afterDiagnostics.push(d)});
    save(dir+'/imports.json.gz',zlib.gzipSync(Buffer.from(JSON.stringify({before:oldImported,after:newImported,beforeDiagnostics,afterDiagnostics},null,2)),{level:9}));
    row.pptxComparison={old:{bytes:oldArchive.length,sha256:sha(oldArchive)},new:{bytes:archive.length,sha256:sha(archive)},byteExact:oldArchive.equals(archive),parts:zipDiff(oldArchive,archive)};
    row.actualSlideCaps=slideCaps;row.canonicalImportDifferences=differences(stable(oldImported),stable(newImported));row.canonicalImportExact=row.canonicalImportDifferences.length===0;row.beforeDiagnostics=beforeDiagnostics;row.afterDiagnostics=afterDiagnostics;
    receipt.cases.push(row);manifest.decks.push({id:c.id,source:dir+'/source.opf.json',sourceSha256:sha(bytes),sourcePages:d.sourcePages,sourceFullPresentation:false,previewOk:true,previewSlides:c.slideCount,declaredTopLevelShapes:16,variants:[{name:'default',flags:['--keep-slides'],pptx:dir+'/after.pptx',ok:true,sha256:sha(archive)}]});
    saveJson('progress-'+String(receipt.cases.length).padStart(2,'0')+'.json',row);
    console.log(c.id+': '+row.previewComparisons.filter(p=>!p.byteExact).length+' PNG deltas; PPTX '+(row.pptxComparison.byteExact?'exact':'changed')+'; canonical import '+(row.canonicalImportExact?'exact':'CHANGED'));
  }
  stage='final-seals';
  assert.equal(receipt.cases.length,13);assert.equal(receipt.cases.reduce((n,row)=>n+row.previewComparisons.length,0),30);
  const after=runtime();assert.deepEqual(after,before,'Source or built runtime changed during exports');assert.deepEqual({suite:inventory(SUITE_ROOT),baseline:inventory(OLD_ROOT)},oldInventories,'Old input/control bytes changed');assert.deepEqual(fact(opt.buildLog),buildLogIdentity,'Provided build log changed');
  saveJson('runtime-after.json',after);saveJson('reference-inventory-after.json',oldInventories);
  const summary={head:opt.head,cases:13,slides:30,pngByteExact:receipt.cases.flatMap(c=>c.previewComparisons).filter(p=>p.byteExact).length,pngChanged:receipt.cases.flatMap(c=>c.previewComparisons).filter(p=>!p.byteExact).length,changedArchives:receipt.cases.filter(c=>!c.pptxComparison.byteExact).map(c=>c.id),canonicalImportsExact:receipt.cases.filter(c=>c.canonicalImportExact).length,actualMaximumTopLevelShapes:Math.max(...receipt.cases.flatMap(c=>c.actualSlideCaps.map(s=>s.topLevelShapes))),nativeAcceptance:false,sourceAndRuntimeUnchanged:true};
  summary.changedArchiveHintMatches=JSON.stringify([...summary.changedArchives].sort())===JSON.stringify([...receipt.comparisonHint.expectedChangedArchives].sort());
  saveJson('receipt.json',receipt);saveJson('build.json',manifest);saveJson('summary.json',summary);
  const files=inventory(out);saveJson('hashes.json',{files});
  console.log(JSON.stringify({summary,manifest:fact(out+'/build.json'),out},null,2));
  if(summary.canonicalImportsExact!==13)process.exitCode=1; // held semantic drift, without hiding any successful export/delta.
} catch(error) {
  const failure={stage,error:{name:error.name,message:error.message,stack:error.stack},nativeAcceptance:false,neverResumeThisOutput:true};
  if(out&&!fs.existsSync(out+'/failure.json'))saveJson('failure.json',failure);
  console.error(JSON.stringify(failure,null,2));process.exitCode=1;
}
