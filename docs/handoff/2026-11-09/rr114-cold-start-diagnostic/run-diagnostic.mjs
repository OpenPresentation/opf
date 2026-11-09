import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync,realpathSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {moduleHashes,runtimeSource,builtSource} from './diagnostic-loader.mjs';

const[runtimeArg,evidenceArg,outputArg]=process.argv.slice(2);
assert.equal(process.argv.length,5,'runtime, accepted evidence folder, fresh external output');
assert.match(process.version,/^v24[.]/);
const own=path.dirname(fileURLToPath(import.meta.url)),runtime=realpathSync(runtimeArg),evidence=realpathSync(evidenceArg),output=path.resolve(outputArg);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',['-C',runtime,...args],{encoding:'utf8',maxBuffer:2*1024*1024}).trim();
assert.equal(git('status','--porcelain','--untracked-files=no'),'','clean tracked helper checkout');
const runtimeHead=git('rev-parse','HEAD'),runtimeTree=git('rev-parse','HEAD^{tree}');
for(const part of ['packages','spec','pnpm-lock.yaml','pnpm-workspace.yaml']){
  assert.equal(git('diff','--name-only',runtimeSource,'HEAD','--',part),'','reviewed product inputs '+part);
}
for(const[file,expected]of Object.entries(moduleHashes)){
  for(const area of ['src','dist'])assert.equal(sha(readFileSync(path.join(runtime,'packages/render',area,file))),expected,'exact '+area+' '+file);
}
assert.ok(!existsSync(output),'output must be fresh');
assert.ok(!output.toLowerCase().startsWith(runtime.toLowerCase()+path.sep),'output is external to runtime checkout');
mkdirSync(output,{recursive:false});
const manifest=JSON.parse(readFileSync(path.join(evidence,'demand-font-01.manifest.json'),'utf8'));
assert.equal(manifest.runtimeSource,runtimeSource);assert.equal(manifest.sourceHead,builtSource);
const archive=readFileSync(path.join(evidence,manifest.archive.file));
assert.equal(archive.length,102118);assert.equal(sha(archive),'1470fa8ce1d23d0f6fc146e36a3ea0d8fec809d2a4c0b5a31b8acfbc3d1a1bf0');
assert.equal(archive.length,manifest.archive.size);assert.equal(sha(archive),manifest.archive.sha256);
const raw=gunzipSync(archive,{maxOutputLength:2*1024*1024});
assert.equal(raw.length,manifest.archive.rawBytes);
const body=JSON.parse(raw),entries=new Map();
assert.equal(body.format,manifest.format);assert.equal(body.entries.length,manifest.archive.members);
let decoded=0;
for(const[index,entry]of body.entries.entries()){
  assert.match(entry.name,/^[a-zA-Z0-9./-]+$/);assert.ok(!entry.name.includes('..'));assert.ok(!entries.has(entry.name));
  const bytes=Buffer.from(entry.base64,'base64');assert.equal(bytes.length,entry.size);assert.equal(sha(bytes),entry.sha256);
  const{base64,...metadata}=entry;assert.deepEqual(metadata,manifest.entries[index]);
  decoded+=bytes.length;entries.set(entry.name,bytes);
}
assert.equal(decoded,manifest.archive.decodedBytes);
const expected={};
for(const[size,name]of [[16,'01-16-whole'],[36,'03-36-whole']]){
  const baseline=JSON.parse(entries.get('results/'+name+'.json'));
  assert.equal(baseline.status,'PASS');assert.equal(baseline.runtimeSource,runtimeSource);
  expected[size]=baseline.storage.perSlide.map(item=>item.sha256);assert.equal(expected[size].length,size);
}
const expectedFile=path.join(output,'expected-svg-hashes.json');
writeFileSync(expectedFile,JSON.stringify(expected,null,2)+'\n',{flag:'wx'});
const receipt={schema:1,status:'RUNNING',kind:'INSTRUMENTED_DIAGNOSTIC',started:new Date().toISOString(),runtimeSource,builtSource,runtimeHead,runtimeTree,runtimeRoot:runtime,evidenceCommit:'4d1ffa78440c47d955d9883575d347996325bf40',originalEvidenceArchive:{bytes:archive.length,sha256:sha(archive)},node:process.version,childTimeoutMs:45000,retries:0,sourceFiles:['diagnostic-loader.mjs','diagnostic-case.mjs','run-diagnostic.mjs'].map(file=>({file,bytes:readFileSync(path.join(own,file)).length,sha256:sha(readFileSync(path.join(own,file)))})),rows:[],scope:'Attribution only. Inclusive nested/concurrent times are not additive; instrumentation changes overhead. Not replacement performance statistics, optimization, native or release acceptance.'};
const summaryFile=path.join(output,'summary.json'),save=()=>writeFileSync(summaryFile,JSON.stringify(receipt,null,2)+'\n');
save();
let verifiedHashes=0;
for(const[index,[size,variant]]of [[16,'whole'],[16,'demand'],[36,'whole'],[36,'demand']].entries()){
  const name=String(index+1).padStart(2,'0')+'-'+size+'-'+variant,file=path.join(output,name+'.json');
  const started=new Date().toISOString();
  const child=spawnSync(process.execPath,['--expose-gc',path.join(own,'diagnostic-case.mjs'),runtime,String(size),variant,path.join(evidence,'inputs'),expectedFile,file],{cwd:runtime,encoding:'utf8',timeout:45000,maxBuffer:2*1024*1024});
  writeFileSync(path.join(output,name+'.stdout'),child.stdout??'',{flag:'wx'});
  writeFileSync(path.join(output,name+'.stderr'),child.stderr??'',{flag:'wx'});
  const row={order:index+1,size,variant,started,finished:new Date().toISOString(),exitCode:child.status,signal:child.signal,error:child.error?.message};
  receipt.rows.push(row);
  try{
    assert.equal(child.status,0,'first actual child failure stops the diagnostic');
    const result=JSON.parse(readFileSync(file,'utf8'));assert.equal(result.status,'PASS');assert.equal(result.samples.length,3);
    assert.equal(result.runtimeSource,runtimeSource);assert.equal(result.size,size);assert.equal(result.variant,variant);
    assert.equal(result.faceCount,variant==='demand'?3:131);
    for(const sample of result.samples){assert.deepEqual(sample.hashes,expected[size]);verifiedHashes+=sample.hashes.length;}
    assert.deepEqual(result.diagnostic.incompleteSpanIds,[]);
    Object.assign(row,{status:'PASS',fontMs:result.fontMs,firstRenderMs:result.samples[0].elapsedMs,spans:result.diagnostic.spans.length,events:result.diagnostic.events.length});
    save();console.log(JSON.stringify(row));
  }catch(error){
    receipt.status='FAIL';receipt.failure=error.stack??String(error);receipt.finished=new Date().toISOString();receipt.verifiedSlideHashes=verifiedHashes;save();throw error;
  }
}
assert.equal(verifiedHashes,312);
for(const[file,expected]of Object.entries(moduleHashes)){
  for(const area of ['src','dist'])assert.equal(sha(readFileSync(path.join(runtime,'packages/render',area,file))),expected,'unchanged '+area+' '+file);
}
assert.equal(git('status','--porcelain','--untracked-files=no'),'','runtime remains clean');
receipt.status='PASS';receipt.verifiedSlideHashes=verifiedHashes;receipt.perConfigurationSlideHashes=104;receipt.finished=new Date().toISOString();save();
console.log(JSON.stringify({status:'PASS',children:4,verifiedSlideHashes:312,output}));
