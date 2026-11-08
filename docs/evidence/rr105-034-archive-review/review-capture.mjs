// Evidence-only companion. No producer writes, fixture promotion, normalization or native execution.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const [baselineRoot,candidateRoot,out]=process.argv.slice(2).map(value=>fs.realpathSync.native(path.dirname(path.resolve(value)))+path.sep+path.basename(path.resolve(value)));
assert.ok(baselineRoot&&candidateRoot&&out&&!fs.existsSync(out));
assert.ok(!out.startsWith(baselineRoot+path.sep)&&!out.startsWith(candidateRoot+path.sep));
fs.mkdirSync(out);const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const put=(file,bytes)=>fs.writeFileSync(path.join(out,file),bytes,{flag:'wx'});
const json=(file,value)=>put(file,JSON.stringify(value,null,2)+'\n');
const git=(root,...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',maxBuffer:32*1024*1024}).trim();
function files(root,directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  const absolute=path.join(directory,entry.name);assert.ok(!entry.isSymbolicLink());if(entry.isDirectory())return files(root,absolute);assert.ok(entry.isFile());const bytes=fs.readFileSync(absolute);return[{file:path.relative(root,absolute).split(path.sep).join('/'),bytes:bytes.length,sha256:sha(bytes)}];
}).sort((a,b)=>a.file.localeCompare(b.file,'en'));}
function seal(root,expected){
  assert.equal(git(root,'rev-parse','HEAD'),expected);assert.equal(git(root,'status','--porcelain'),'');
  const packages=['javascript','gallery','cli','mcp','render','pptx','editor'];
  return{root,head:expected,node:process.version,platform:process.platform,sourceTrees:git(root,'ls-tree','HEAD','--',...packages.map(p=>'packages/'+p),'spec','pnpm-lock.yaml','pnpm-workspace.yaml','package.json'),dist:packages.flatMap(pkg=>files(root,path.join(root,'packages',pkg,'dist')))};
}
const baselineHead='26fd4de9cee7e57f9e0620eddcad2dcef04e00e3',candidateHead='513156a982397eaa0033808215fbb86dd284745b';
const before={baseline:seal(baselineRoot,baselineHead),candidate:seal(candidateRoot,candidateHead)};json('runtime-before.json',before);
const tools=['review-chartex-fallback-archives.mjs','chartex-fallback-archives.mjs','review-rr54-archives.mjs'].map(name=>{const bytes=fs.readFileSync(path.join(candidateRoot,'packages/pptx/scripts',name));return{file:name,sha256:sha(bytes),bytes:bytes.length};});json('tools.json',tools);
for(const[family,tool]of[['nine','review-chartex-fallback-archives.mjs'],['twenty-one','review-rr54-archives.mjs']]){
  const args=[path.join(candidateRoot,'packages/pptx/scripts',tool),'--baseline',baselineRoot,'--candidate',candidateRoot,'--out',path.join(out,family),'--baseline-export-ref',baselineHead];
  const result=spawnSync(process.execPath,args,{cwd:candidateRoot,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});put(family+'.stdout.log',result.stdout??'');put(family+'.stderr.log',result.stderr??'');json(family+'.command.json',{command:process.execPath,args,status:result.status,error:result.error?.message});assert.ifError(result.error);assert.equal(result.status,0,family+' maintained reviewer refused; preserve first attempt');
}
const require=createRequire(path.join(candidateRoot,'packages/pptx/package.json'));const{unzipSync}=require('fflate');
const{compareArchiveParts}=await import(pathToFileURL(path.join(candidateRoot,'packages/pptx/scripts/chartex-fallback-archives.mjs')).href);
const workbookInventory=parts=>Object.entries(parts).filter(([file])=>/\.xlsx$/iu.test(file)).map(([file,bytes])=>({file,sha256:sha(bytes),bytes:bytes.length,parts:Object.entries(unzipSync(bytes)).map(([name,value])=>({file:name,bytes:value.length,sha256:sha(value)}))}));
const baseline=await import(pathToFileURL(path.join(baselineRoot,'packages/pptx/dist/index.js')).href),candidate=await import(pathToFileURL(path.join(candidateRoot,'packages/pptx/dist/index.js')).href);
const fixtureFile='packages/pptx/test/fixtures/rr-54-unchanged.json';const fixtureBytes=fs.readFileSync(path.join(candidateRoot,fixtureFile));assert.ok(fixtureBytes.equals(fs.readFileSync(path.join(baselineRoot,fixtureFile))));
const fixture=JSON.parse(fixtureBytes),maintained=JSON.parse(fs.readFileSync(path.join(out,'twenty-one/review.json')));const rows=[];
fs.mkdirSync(path.join(out,'twenty-one-complete'));
for(const[name,entry]of Object.entries(fixture.entries)){
  const reference=maintained.entries.find(row=>row.name===name);assert.ok(reference);const directory=path.join(out,'twenty-one-complete',name);fs.mkdirSync(directory);
  const a=new Uint8Array(await baseline.toPptx(structuredClone(entry.deck))),b=new Uint8Array(await candidate.toPptx(structuredClone(entry.deck)));
  assert.equal(sha(a),reference.baseline);assert.equal(a.length,reference.baselineBytes);assert.equal(sha(b),reference.candidate);assert.equal(b.length,reference.candidateBytes);
  fs.writeFileSync(path.join(directory,'before.pptx'),a,{flag:'wx'});fs.writeFileSync(path.join(directory,'after.pptx'),b,{flag:'wx'});
  fs.mkdirSync(path.join(directory,'parts'));const comparison=compareArchiveParts(a,b,path.join(directory,'parts'));
  assert.deepEqual(comparison.changed.map(row=>row.file),reference.changedParts);
  const row={name,baseline:reference.baseline,candidate:reference.candidate,parts:comparison,workbooks:{before:workbookInventory(unzipSync(a)),after:workbookInventory(unzipSync(b))}};rows.push(row);fs.writeFileSync(path.join(directory,'comparison.json'),JSON.stringify(row,null,2)+'\n',{flag:'wx'});
}
json('twenty-one-complete/review.json',{scope:'Exact same bare toPptx route; all hashes/sizes equal maintained reviewer; complete literal raw ZIP and workbook inventories. Maintained candidate-fixture.json is raw and its hardcoded033 narrative is not accepted for034.',entries:rows});
const nine=JSON.parse(fs.readFileSync(path.join(out,'nine/review.json')));json('nine/workbook-inventories.json',nine.entries.map(row=>({name:row.name,before:workbookInventory(unzipSync(fs.readFileSync(path.join(out,'nine',row.name,'before.pptx')))),after:workbookInventory(unzipSync(fs.readFileSync(path.join(out,'nine',row.name,'after.pptx'))))})));
const after={baseline:seal(baselineRoot,baselineHead),candidate:seal(candidateRoot,candidateHead)};json('runtime-after.json',after);assert.deepEqual(after,before,'Source/runtime changed during review');
json('capture-summary.json',{baselineHead,candidateHead,node:process.version,nine:nine.entries.length,twentyOne:rows.length,producerSealsExact:true,fixturePromotion:false,nativeAcceptance:false,xmlNormalization:false});
console.log('PASS: maintained9+21, complete companion21, all source/dist seals unchanged');
