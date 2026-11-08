// RR20: immutable exact-baseline review for the nine ChartEx fallback archives, separate from RR54's 21.
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,readdirSync,existsSync,mkdirSync,rmSync,copyFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {zipSync,strToU8} from 'fflate';
import {chartexFallbackDecks} from './helpers/chartex-fallback-decks.mjs';
import {compareArchiveParts,exportFallbackArchive,reviewFallbackArchives,sha256,summarizeArchive,validateFixture} from '../scripts/chartex-fallback-archives.mjs';
const fixtureFile=new URL('./fixtures/chartex-fallback-main.json',import.meta.url),fixtureBytes=readFileSync(fixtureFile),fixture=JSON.parse(fixtureBytes);
validateFixture(fixture);
// The promoted definitions equal both the immutable historical generator and the locked test source.
const historical=readFileSync(new URL('./fixtures/chartex-fallback-main.mjs.txt',import.meta.url),'utf8');
const source=historical.slice(historical.indexOf('const region ='),historical.indexOf('const entries ='));
assert.ok(source.startsWith('const region =')&&source.includes('const decks ='));
assert.deepEqual(JSON.parse(vm.runInNewContext(source+'\nJSON.stringify(decks)',Object.create(null),{timeout:1000})),chartexFallbackDecks);
for(const field of ['decks','entries']){const changed=structuredClone(fixture);delete changed[field]['box-multi'];assert.throws(()=>validateFixture(changed));const extra=structuredClone(fixture);extra[field]['extra-deck']={};assert.throws(()=>validateFixture(extra));}
const root=mkdtempSync(path.join(os.tmpdir(),'opf-nine-archive-review-'));
const bytes=(change=false)=>zipSync({
  'ppt/slides/slide1.xml':strToU8('<p:sld>Exact slide</p:sld>'),
  'ppt/slideLayouts/slideLayout1.xml':strToU8('<p:sldLayout/>'),
  'ppt/tags/opfLayout1.xml':strToU8('<tag/>'),
  'ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx':zipSync({'xl/tables/table1.xml':strToU8(change?'<table ref="A1:C5"/>':'<table ref="A1:B5"/>'),'xl/sharedStrings.xml':strToU8('<sst/>')},{mtime:new Date('2026-11-08T00:00:00Z')}),
},{mtime:new Date('2026-11-08T00:00:00Z')});
const oldBytes=bytes(),newBytes=bytes(true),catalog={id:'separate-catalog'};
const makeRuntime=(data,counter)=>({catalog,toPptx:async(deck,options)=>{counter.count++;assert.ok(Object.hasOwn(options,'catalogs'));assert.equal(options.catalogs.length,1);assert.equal(options.catalogs[0],catalog);assert.deepEqual(Object.keys(options),['chartex','catalogs','onDiagnostic']);assert.equal(options.chartex,'fallback');deck.slides[0].title='Exporter mutation must not reach the source';options.onDiagnostic({code:'sentinel',adaptation:'ordered'});options.onDiagnostic({code:'second'});return typeof data==='function'?data(deck):data;}});
const locked=structuredClone(fixture);for(const name of Object.keys(locked.decks))locked.entries[name]={...locked.entries[name],...summarizeArchive(oldBytes,['sentinel/ordered','second'])};
const provenance={baseline:{head:'a'.repeat(40),catalogSha256:'c'.repeat(64),dist:[{file:'index.js',sha256:'d'.repeat(64)}]},candidate:{head:'b'.repeat(40)}};
try{
  const a={count:0},b={count:0},before=JSON.stringify(locked),out=path.join(root,'success');
  const review=await reviewFallbackArchives({fixture:locked,baseline:makeRuntime(oldBytes,a),candidate:makeRuntime(newBytes,b),out,provenance});
  assert.equal(a.count,9);assert.equal(b.count,9);assert.equal(review.entries.length,9);assert.equal(JSON.stringify(locked),before);
  const generated=JSON.parse(readFileSync(path.join(out,'candidate-fixture.json')));assert.deepEqual(generated.decks,locked.decks);assert.deepEqual(generated.source.note,locked.source.note);assert.equal(generated.source.rr20FallbackArchiveReviews.at(-1).evidence.sha256,sha256(readFileSync(path.join(out,'review.json'))));assert.deepEqual(generated.source.rr20FallbackArchiveReviews.at(-1).baseline,{head:provenance.baseline.head,catalogSha256:provenance.baseline.catalogSha256,distManifestSha256:sha256(JSON.stringify(provenance.baseline.dist,null,2)+'\n')});
  for(const row of review.entries){assert.equal(row.parts.changed.length,1);const part=row.parts.changed[0];assert.equal(part.file,'ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx');assert.deepEqual(part.embedded.changed.map(change=>change.file),['xl/tables/table1.xml']);assert.equal(part.embedded.before.length,2);assert.equal(part.embedded.after.length,2);assert.ok(readFileSync(path.join(out,row.name,'before.pptx')).equals(oldBytes));assert.ok(readFileSync(path.join(out,row.name,'after.pptx')).equals(newBytes));assert.deepEqual(generated.entries[row.name].rr20ArchivePrevious.at(-1),summarizeArchive(oldBytes,['sentinel/ordered','second']));assert.equal(generated.entries[row.name].sha256,sha256(newBytes));}
  const selective=path.join(root,'one-change'),selectiveLeft={count:0},selectiveRight={count:0};
  await reviewFallbackArchives({fixture:locked,baseline:makeRuntime(oldBytes,selectiveLeft),candidate:makeRuntime(deck=>deck.slides[0].chart.type==='treemap'&&deck.slides.length===1?newBytes:oldBytes,selectiveRight),out:selective,provenance});
  const selectiveFixture=JSON.parse(readFileSync(path.join(selective,'candidate-fixture.json')));for(const name of Object.keys(locked.decks).slice(1))assert.deepEqual(selectiveFixture.entries[name],locked.entries[name],'Unchanged archive retains its complete entry/history');
  // Producer movement fails closed before candidate JSON publication, retaining raw completed archives.
  const moving=path.join(root,'moved-producer'),leftMoving={count:0},rightMoving={count:0};
  await assert.rejects(reviewFallbackArchives({fixture:locked,baseline:makeRuntime(oldBytes,leftMoving),candidate:makeRuntime(newBytes,rightMoving),out:moving,provenance,verifyProducers:()=>{throw Error('Producer changed during review');}}),/Producer changed/);assert.equal(rightMoving.count,9);assert.equal(existsSync(path.join(moving,'candidate-fixture.json')),false);assert.ok(readFileSync(path.join(moving,'all-seven','after.pptx')).equals(newBytes));
  // Existing evidence is refused before either exporter can run; every sentinel survives.
  const prior=path.join(root,'prior');mkdirSync(prior);writeFileSync(path.join(prior,'keep'),'earlier attempt');const idle={count:0};
  await assert.rejects(reviewFallbackArchives({fixture:locked,baseline:makeRuntime(oldBytes,idle),candidate:makeRuntime(newBytes,idle),out:prior,provenance}),/Preserve previous evidence/);assert.equal(idle.count,0);assert.deepEqual(readdirSync(prior),['keep']);
  const command=fileURLToPath(new URL('../scripts/review-chartex-fallback-archives.mjs',import.meta.url));
  const refusal=spawnSync(process.execPath,[command,'--baseline',root,'--candidate',root,'--out',prior,'--baseline-export-ref','a'.repeat(40)],{encoding:'utf8'});assert.notEqual(refusal.status,0);assert.match(refusal.stderr,/Preserve previous evidence/);assert.deepEqual(readdirSync(prior),['keep']);
  // Every locked property is required, and failure prevents all candidate exports/candidate JSON.
  for(const key of ['sha256','bytes','diagnostics','layoutParts','layoutTagParts']){
    const bad=structuredClone(locked),name=Object.keys(bad.entries)[0];bad.entries[name][key]=key==='sha256'?'0'.repeat(64):key==='diagnostics'?['second','sentinel/ordered']:999;
    const left={count:0},right={count:0},target=path.join(root,'bad-'+key);
    await assert.rejects(reviewFallbackArchives({fixture:bad,baseline:makeRuntime(oldBytes,left),candidate:makeRuntime(newBytes,right),out:target,provenance}),/reproduce every locked baseline/);
    assert.equal(right.count,0);assert.equal(existsSync(path.join(target,'candidate-fixture.json')),false);assert.ok(readFileSync(path.join(target,name,'before.pptx')).equals(oldBytes),'failed baseline bytes remain inspectable');
  }
  // Added/removed workbooks retain nested inventories too; raw XML changes are never normalized away.
  const empty=zipSync({},{mtime:new Date('2026-11-08T00:00:00Z')});
  for(const [label,from,to,status]of[['added',empty,oldBytes,'added'],['removed',oldBytes,empty,'removed']]){const directory=path.join(root,label);mkdirSync(directory);const comparison=compareArchiveParts(from,to,directory),workbook=comparison.changed.find(part=>part.file.endsWith('.xlsx'));assert.equal(workbook.status,status);assert.equal(workbook.embedded.changed.length,2);assert.ok(workbook.embedded.changed.every(part=>part.status===status));}
  const raw=path.join(root,'raw-xml');mkdirSync(raw);const rawComparison=compareArchiveParts(zipSync({'same.xml':strToU8('<x a="1" b="2"/>')}),zipSync({'same.xml':strToU8('<x b="2" a="1"/>')}),raw);assert.equal(rawComparison.changed.length,1,'No XML canonicalization or masking');
  // Exercise the real command on a fresh synthetic Git checkout, never a real export/fixture refresh.
  const producer=path.join(root,'synthetic-producer');mkdirSync(producer);
  const write=(relative,text)=>{const file=path.join(producer,relative);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,text);};
  const repository=fileURLToPath(new URL('../../../',import.meta.url));
  for(const relative of ['packages/pptx/scripts/review-chartex-fallback-archives.mjs','packages/pptx/scripts/chartex-fallback-archives.mjs','packages/pptx/test/helpers/chartex-fallback-decks.mjs','packages/pptx/test/fixtures/chartex-fallback-main.mjs.txt']){const file=path.join(producer,relative);mkdirSync(path.dirname(file),{recursive:true});copyFileSync(path.join(repository,relative),file);}
  write('package.json',JSON.stringify({type:'module'}));write('packages/pptx/package.json',JSON.stringify({type:'module'}));write('packages/pptx/test/fixtures/chartex-fallback-main.json',JSON.stringify(locked));
  write('packages/pptx/dist/index.js','export async function toPptx(deck,options){options.onDiagnostic({code:"sentinel",adaptation:"ordered"});options.onDiagnostic({code:"second"});return Uint8Array.from(Buffer.from("'+Buffer.from(oldBytes).toString('base64')+'","base64"));}');
  for(const [pkg,sub]of [['gallery','index'],['javascript','composition'],['render','svg']]){write('packages/'+pkg+'/dist/index.js',pkg==='gallery'?'export const gallery={id:"synthetic-catalog"};':'export {};');if(sub!=='index')write('packages/'+pkg+'/dist/'+sub+'.js','export {};');}
  for(const [name,pkg,sub]of [['gallery','gallery','index'],['opf','javascript','composition'],['opf-render','render','svg']]){const relative='node_modules/@openpresentation/'+name;write(relative+'/package.json',JSON.stringify({type:'module',exports:sub==='index'?'./index.js':{['./'+sub]:'./index.js'}}));write(relative+'/index.js','export * from '+JSON.stringify(pathToFileURL(path.join(producer,'packages/'+pkg+'/dist/'+sub+'.js')).href)+';');}
  const require=createRequire(import.meta.url);write('node_modules/fflate/package.json',JSON.stringify({type:'module',exports:'./index.js'}));write('node_modules/fflate/index.js','export {strFromU8,unzipSync} from '+JSON.stringify(pathToFileURL(require.resolve('fflate')).href)+';');
  const git=(...args)=>execFileSync('git',['-C',producer,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();git('init');git('add','--force','.');git('-c','user.name=OPF Test','-c','user.email=opf-test@example.invalid','-c','commit.gpgsign=false','-c','core.hooksPath=.no-hooks','commit','-m','Synthetic archive reviewer control');const revision=git('rev-parse','HEAD');
  const syntheticCommand=path.join(producer,'packages/pptx/scripts/review-chartex-fallback-archives.mjs'),native=path.join(root,'synthetic-command-output'),args=[syntheticCommand,'--baseline',producer,'--candidate',producer,'--out',native,'--baseline-export-ref',revision];
  const generatedByCommand=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(generatedByCommand.status,0,generatedByCommand.stderr);assert.match(generatedByCommand.stdout,/9 exact baseline locks reproduced/);
  const sealed=JSON.parse(readFileSync(path.join(native,'review.json')));assert.equal(sealed.baseline.head,revision);assert.ok(sealed.baseline.dist.length>=4);assert.ok(sealed.baseline.resolved.gallery.startsWith('node_modules/'));assert.ok(readFileSync(path.join(producer,'packages/pptx/test/fixtures/chartex-fallback-main.json')).equals(Buffer.from(JSON.stringify(locked))));
  write('packages/pptx/dirty.txt','Producer edits must be refused');const dirtyArgs=args.map(value=>value===native?path.join(root,'dirty-command-output'):value),dirty=spawnSync(process.execPath,dirtyArgs,{encoding:'utf8'});assert.notEqual(dirty.status,0);assert.match(dirty.stderr,/clean committed producer/);assert.equal(existsSync(path.join(root,'dirty-command-output')),false);
  const clean={count:0};await exportFallbackArchive(makeRuntime(oldBytes,clean),chartexFallbackDecks['treemap-category']);assert.equal(chartexFallbackDecks['treemap-category'].slides[0].title,'treemap');
  const archive=parts=>zipSync(parts,{mtime:new Date('2026-11-08T00:00:00Z')});
  assert.throws(()=>summarizeArchive(archive({'ppt/charts/chartEx1.xml':strToU8('<cx:chartSpace/>')}),[]),/no ChartEx/);
  assert.throws(()=>summarizeArchive(archive({'ppt/slides/slide1.xml':strToU8('<mc:AlternateContent/>')}),[]),/no alternate/);
  assert.ok(readFileSync(fixtureFile).equals(fixtureBytes),'Strict archive lock remains byte-identical');
  console.log('RR20 nine-deck reviewer passes: authoritative source equality, exact caller and every baseline lock, full archives/nested workbook diffs, immutable source/fixture and prior-evidence refusal. No real fixture refreshed.');
}finally{
  const target=path.resolve(root),temporary=path.resolve(os.tmpdir())+path.sep;assert.ok(target.startsWith(temporary)&&path.basename(target).startsWith('opf-nine-archive-review-'));rmSync(target,{recursive:true});
}
