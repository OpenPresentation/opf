import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,symlinkSync,existsSync,realpathSync} from 'node:fs';
import http from 'node:http';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {digest,packageNames} from './identity.mjs';
import {parseArguments,plannedPackages,registryIdentity,retainedInputs,assertOutputIsolation,preflight,caseIds} from './replay-retained-saves.mjs';

function fixture() {
  const root=realpathSync(mkdtempSync(path.join(tmpdir(),'opf-replay-'))),consumer=path.join(root,'consumer'),evidence=path.join(root,'evidence');
  mkdirSync(consumer);mkdirSync(evidence);
  const plan={packages:[],independentPackages:[],verificationRefs:{}},dependencies={},lock={packages:{}};
  const integrity='sha512-'+Buffer.alloc(64,1).toString('base64');
  for(const name of packageNames){
    const short=name.split('/')[1],version=short==='opf'?'0.20.1':short==='gallery'?'3.0.0':'0.20.0';
    const record={name,version};
    (short==='gallery'?plan.independentPackages:plan.packages).push(record);
    if(short!=='gallery')plan.verificationRefs[short]='1'.repeat(40);
    dependencies[name]=version;
    lock.packages['node_modules/'+name]={version,integrity,resolved:`https://registry.npmjs.org/${name}/-/${short}-${version}.tgz`};
    const directory=path.join(consumer,'node_modules',name);mkdirSync(path.join(directory,'dist'),{recursive:true});
    writeFileSync(path.join(directory,'package.json'),JSON.stringify({name,version,type:'module',exports:{'.':'./dist/index.js','./package.json':'./package.json'}}));
    writeFileSync(path.join(directory,'dist/index.js'),'export const fixtureOnly=true;');
  }
  writeFileSync(path.join(consumer,'package.json'),JSON.stringify({private:true,type:'module',dependencies}));
  writeFileSync(path.join(consumer,'package-lock.json'),JSON.stringify(lock));
  const artifacts=[];
  const put=(relative,value)=>{const bytes=Buffer.from(typeof value==='string'?value:JSON.stringify(value));const file=path.join(evidence,relative);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,bytes);artifacts.push({path:relative,bytes:bytes.length,sha256:digest(bytes)});};
  for(const id of caseIds){put('manual/'+id+'.pptx','PK\x03\x04'+id);put('accepted/'+id+'-direct.opf.json',{slides:[]});put('accepted/'+id+'-historical-direct.opf.json',{slides:[]});}
  put('accepted/runtime-identities.json',{current:{fixtureOnly:true},historical:{fixtureOnly:true}});
  put('accepted/report.json',{passed:true,results:caseIds.map(id=>({id,savedSha256:artifacts.find(a=>a.path==='manual/'+id+'.pptx').sha256}))});put('manual/new-custom-region-binding.json',{binding:{regions:[]}});
  const index={artifacts,fixedSourceReplay:{report:'accepted/report.json',identities:'accepted/runtime-identities.json'},packageGraph:{historical:true},results:Array(17).fill({id:'fixture'}),manualOperations:caseIds.map(id=>({id})),coverage:Array.from({length:58},(_,i)=>({disposition:i<41?'unexecuted':'native-observed'}))};
  writeFileSync(path.join(evidence,'index.json'),JSON.stringify(index));
  const releasePlan=path.join(root,'release-plan.json');writeFileSync(releasePlan,JSON.stringify(plan));
  const checks=['npm version','tag','gitHead','tag on main','version at tag','dist.attestations','SLSA provenance','npm audit signatures'].map(name=>({name,ok:true}));
  const authority={schemaVersion:1,verifiedAt:'2026-10-14T00:00:00Z',packages:[...plan.packages,...plan.independentPackages].map(record=>({...record,gitHead:'1'.repeat(40),dist:{integrity},repository:'fixture',tag:'fixture',workflow:'fixture',provenanceInvocation:'fixture',canonicalVerification:{ok:true,checks,logSha256:'2'.repeat(64)}})),nativeScope:{selectedCases:17,uiOperations:4,totalCases:58,unexecutedCases:41,globalAcceptance:false},siteDeployment:false};
  const registryReceipt=path.join(root,'verified-registry-authority.json');writeFileSync(registryReceipt,JSON.stringify(authority));
  return {root,consumer,evidence,plan,lock,index,releasePlan,registryReceipt,authority,output:path.join(root,'output'),close:()=>{assert.equal(path.dirname(root),realpathSync(tmpdir()));rmSync(root,{recursive:true,force:true});}};
}

// These tiny manifests only exercise guards: no fixture is represented as a genuine release replay.
test('preflight accepts complete sealed inputs without loading packages or creating output',()=>{
 const f=fixture();try{const result=preflight(f);assert.equal(result.identity.packages.length,6);assert.equal(result.inputs.cases.length,4);assert.equal(existsSync(f.output),false);assert.equal(result.identity.registryAcceptance,false);}finally{f.close();}
});

test('wrong, missing and prerelease package graphs are refused before output or engine import',()=>{
 for(const mutation of [
  f=>{f.plan.packages.pop();},
  f=>{f.plan.packages[0].version='0.20.1-preview.1';},
  f=>{delete f.plan.verificationRefs.opf;},
  f=>{f.plan.packages.push({...f.plan.packages[0]});},
  f=>{const file=path.join(f.consumer,'node_modules/@openpresentation/opf/package.json');const m=JSON.parse(readFileSync(file));m.version='0.19.0';writeFileSync(file,JSON.stringify(m));},
  f=>{f.lock.packages['node_modules/@openpresentation/cli'].resolved='file:../candidate.tgz';},
  f=>{f.lock.packages['node_modules/@openpresentation/opf'].integrity='sha512-invalid';},
  f=>{f.lock.packages['node_modules/@openpresentation/opf'].integrity='sha512-'+Buffer.alloc(64,2).toString('base64');},
  f=>{f.lock.packages['node_modules/@openpresentation/opf'].link=true;},
  f=>{f.lock.packages['node_modules/escaped-helper']={version:'1.0.0',resolved:'file:../source'};},
 ]){const f=fixture();try{mutation(f);writeFileSync(f.releasePlan,JSON.stringify(f.plan));writeFileSync(path.join(f.consumer,'package-lock.json'),JSON.stringify(f.lock));assert.throws(()=>preflight(f));assert.equal(existsSync(f.output),false);}finally{f.close();}}
});

test('declared source aliases, package junctions and consumer-boundary escape are refused',()=>{
 const f=fixture();try{
 const manifest=path.join(f.consumer,'package.json'),m=JSON.parse(readFileSync(manifest));m.dependencies['@openpresentation/opf']='file:../source';writeFileSync(manifest,JSON.stringify(m));assert.throws(()=>registryIdentity(f.consumer,f.plan),/exact registry version/);
 m.dependencies['@openpresentation/opf']='0.20.1';writeFileSync(manifest,JSON.stringify(m));
 const packagePath=path.join(f.consumer,'node_modules/@openpresentation/opf'),source=path.join(f.root,'source');
 // Move only this owned synthetic fixture, then expose it through a junction.
 mkdirSync(source);writeFileSync(path.join(source,'package.json'),readFileSync(path.join(packagePath,'package.json')));mkdirSync(path.join(source,'dist'));writeFileSync(path.join(source,'dist/index.js'),'export const fixtureOnly=true;');rmSync(packagePath,{recursive:true});symlinkSync(source,packagePath,process.platform==='win32'?'junction':'dir');assert.throws(()=>registryIdentity(f.consumer,f.plan),/alias/);
 }finally{f.close();}
});

test('corrupt saved bytes, missing baseline seal and unsafe duplicate paths cannot be replayed',()=>{
 const f=fixture();try{
 const archive=path.join(f.evidence,'manual/change-picture.pptx'),original=readFileSync(archive);writeFileSync(archive,Buffer.alloc(original.length));assert.throws(()=>retainedInputs(f.evidence),/Corrupt evidence hash/);writeFileSync(archive,original);
 const indexFile=path.join(f.evidence,'index.json');const changed=structuredClone(f.index);changed.artifacts=changed.artifacts.filter(a=>!a.path.endsWith('new-custom-direct.opf.json'));writeFileSync(indexFile,JSON.stringify(changed));assert.throws(()=>retainedInputs(f.evidence),/Missing sealed evidence/);
 changed.artifacts.push({path:'../outside',bytes:0,sha256:''});writeFileSync(indexFile,JSON.stringify(changed));assert.throws(()=>retainedInputs(f.evidence),/Unsafe evidence path/);
 writeFileSync(indexFile,JSON.stringify({...f.index,artifacts:[...f.index.artifacts,f.index.artifacts[0]]}));assert.throws(()=>retainedInputs(f.evidence),/Duplicate evidence/);
 }finally{f.close();}
});

test('output isolation rejects overlapping, existing and aliased directories without writes',()=>{
 const f=fixture();try{
 for(const output of [f.root,f.consumer,path.join(f.consumer,'out'),path.join(f.evidence,'out')])assert.throws(()=>assertOutputIsolation(output,[f.consumer,f.evidence]),/overlaps/);
 mkdirSync(f.output);writeFileSync(path.join(f.output,'keep'),'unchanged');assert.throws(()=>assertOutputIsolation(f.output,[f.consumer,f.evidence]),/fresh/);assert.equal(readFileSync(path.join(f.output,'keep'),'utf8'),'unchanged');
 const alias=path.join(f.root,'alias');symlinkSync(f.evidence,alias,process.platform==='win32'?'junction':'dir');assert.throws(()=>assertOutputIsolation(path.join(alias,'new'),[f.consumer,f.evidence]),/alias/);
 }finally{f.close();}
});

test('installed-child preload refuses swallowed fetch/socket attempts and records them before any connection',async()=>{
 const root=realpathSync(mkdtempSync(path.join(tmpdir(),'opf-offline-'))),log=path.join(root,'network.jsonl');let connections=0;
 const server=http.createServer();server.on('connection',()=>connections++);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
 const guard=new URL('./replay-offline.mjs',import.meta.url).href;
 const code=`import net from 'node:net';try{net.createConnection({host:'127.0.0.1',port:${server.address().port}})}catch{}try{await fetch('http://127.0.0.1:${server.address().port}')}catch{};`;
 const child=spawnSync(process.execPath,['--import',guard,'--input-type=module','-e',code],{encoding:'utf8',env:{...process.env,NODE_OPTIONS:'',OPF_REPLAY_NETWORK_LOG:log},timeout:10000});
 assert.equal(child.status,0,child.stderr);const attempts=readFileSync(log,'utf8').trim().split('\n').map(line=>JSON.parse(line));assert.deepEqual(attempts.map(a=>a.kind),['connect','fetch']);assert.equal(connections,0);
 }finally{await new Promise(resolve=>server.close(resolve));assert.equal(path.dirname(root),realpathSync(tmpdir()));rmSync(root,{recursive:true,force:true});}
});

test('arguments and historical release plans cannot silently select a partial or source graph',()=>{
 assert.throws(()=>parseArguments([]),/Required/);assert.throws(()=>parseArguments(['--consumer','one','--consumer','two']),/Duplicate/);assert.throws(()=>parseArguments(['--office','yes']),/Unknown/);
 const f=fixture();try{f.plan.packages[0].version='0.19.0';assert.throws(()=>plannedPackages(f.plan),/0.20/);f.plan.packages[0].version='0.20.1';f.plan.independentPackages[0].version='2.0.0';assert.throws(()=>plannedPackages(f.plan),/Gallery 3/);}finally{f.close();}
 const parsed=parseArguments(['--consumer','consumer','--evidence','evidence','--output','output','--registry-receipt','authority.json']);assert.ok(path.isAbsolute(parsed.releasePlan));
});

test('final replay refuses absent, incomplete, failed or integrity-mismatched canonical authority',()=>{
 for(const mutation of [f=>{delete f.registryReceipt;},f=>{f.authority.packages.pop();},f=>{f.authority.packages[0].canonicalVerification.ok=false;},f=>{f.authority.packages[0].canonicalVerification.checks.pop();},f=>{f.authority.packages[0].dist.integrity='sha512-'+Buffer.alloc(64,3).toString('base64');},f=>{f.authority.packages[0].gitHead='3'.repeat(40);},f=>{f.authority.nativeScope.unexecutedCases=40;}]){const f=fixture();try{mutation(f);if(f.registryReceipt)writeFileSync(f.registryReceipt,JSON.stringify(f.authority));assert.throws(()=>preflight(f));assert.equal(existsSync(f.output),false);}finally{f.close();}}
});

test('same-version nested core cannot substitute for the single installed runtime',()=>{
 const f=fixture();try{const nested=path.join(f.consumer,'node_modules/@openpresentation/opf-render/node_modules/@openpresentation/opf');mkdirSync(nested,{recursive:true});writeFileSync(path.join(nested,'package.json'),readFileSync(path.join(f.consumer,'node_modules/@openpresentation/opf/package.json')));assert.throws(()=>registryIdentity(f.consumer,f.plan),/resolves another/);}finally{f.close();}
});
