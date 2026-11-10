import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspect,prepare,sha,WORKER_HEAD,CONTROLLER_HEAD,GENERATION_HEAD,CASE_ID,CODE_FILES} from './prepare-core.mjs';
import {parseArgs} from './prepare-suite.mjs';
const folder=path.dirname(fileURLToPath(import.meta.url));
const fixture=JSON.parse(gunzipSync(fs.readFileSync(path.join(folder,'test-fixture.json.gz'))));
const FAKE_DRIVER_HEAD='a'.repeat(40);
function make(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'opf-b07-prep-pure-'));
 const roots={driver:path.join(root,'driver'),worker:path.join(root,'worker'),controller:path.join(root,'controller'),historic:path.join(root,'historic')};
 for(const p of Object.values(roots))fs.mkdirSync(p);
 const put=(base,name,bytes)=>{const p=path.join(base,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,bytes,{flag:'wx'});};
 for(const file of fixture.worker)put(roots.worker,file.path,Buffer.from(file.base64,'base64'));
 for(const file of fixture.controller)put(roots.controller,file.path,Buffer.from(file.base64,'base64'));
 for(const name of CODE_FILES)put(roots.driver,name,fs.readFileSync(path.join(folder,path.basename(name))));
 const packet=path.join(roots.historic,'observations.json.gz');fs.writeFileSync(packet,Buffer.from(fixture.generationPacketBase64,'base64'));
 const heads=new Map([[roots.driver,FAKE_DRIVER_HEAD],[roots.worker,WORKER_HEAD],[roots.controller,CONTROLLER_HEAD],[roots.historic,GENERATION_HEAD]]);
 const git=(at,args)=>{assert.ok(heads.has(at),'Unit fixture never queries a real repository');if(args.join(' ')==='rev-parse HEAD')return heads.get(at);if(args.join(' ')==='rev-parse --show-toplevel')return at;if(args[0]==='status')return '';throw Error('Unexpected pure Git query');};
 const options={workerRepo:roots.worker,controllerRepo:roots.controller,generationRepo:roots.historic,generationPacket:packet,expectDriverHead:FAKE_DRIVER_HEAD,out:path.join(root,'output')};
 return{root,roots,packet,heads,git,options,dependencies:{git,driverRoot:roots.driver},clean(){fs.rmSync(root,{recursive:true,force:true})}};
}
function using(fn){const f=make();try{return fn(f)}finally{f.clean()}}
test('default CLI parses inspect only and rejects accidental output, ambiguity and unpinned prepare',()=>{
 const flags=['--worker-repo','w','--controller-repo','c','--generation-repo','g','--generation-packet','p'];assert.equal(parseArgs(flags).mode,'inspect');assert.equal(parseArgs(['inspect',...flags]).mode,'inspect');
 for(const argv of[[...flags,'--out','o'],['prepare',...flags,'--out','o'],[...flags,'--worker-repo','again'],[...flags,'--force'],['prepare',...flags,'--out','o','--expect-driver-head','not-a-sha']])assert.throws(()=>parseArgs(argv));

});
// A real failing child has a nonzero result; it must not create an output or open Office.
test('actual public CLI fails closed with no arguments',()=>{assert.throws(()=>execFileSync(process.execPath,[path.join(folder,'prepare-suite.mjs')],{stdio:'pipe'}),e=>e.status===1&&String(e.stderr).includes('Missing required workerRepo'));});
test('inspect reads authentic fixed fixtures and never creates output',()=>using(f=>{
 const before=fs.readdirSync(f.root).sort();const value=inspect(f.options,f.dependencies);assert.equal(value.mode,'inspect');assert.equal(value.case,CASE_ID);assert.equal(value.identities.worker.revision,WORKER_HEAD);assert.equal(value.identities.controller.revision,CONTROLLER_HEAD);assert.equal(value.identities.historicGeneration.revision,GENERATION_HEAD);assert.equal(value.identities.driver.revision,FAKE_DRIVER_HEAD);assert.equal(value.files.length,4);assert.deepEqual(value.limits.phases,['original','edited','reopened']);assert.equal(value.nativeRun,false);assert.equal(value.nativeAcceptance,false);assert.deepEqual(fs.readdirSync(f.root).sort(),before);assert.equal(fs.existsSync(f.options.out),false);
}));
test('explicit prepare builds only a synthetic four-asset one-case suite with separate identities',()=>using(f=>{
 const result=prepare(f.options,f.dependencies);assert.equal(result.prepared,true);const suite=JSON.parse(fs.readFileSync(path.join(f.options.out,'suite.json')));assert.equal(suite.cases.length,1);assert.equal(suite.cases[0].id,CASE_ID);assert.equal(suite.files.length,4);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.options.out,'actions/empty.json'))),[]);assert.equal(suite.provenance.preparation.revision,FAKE_DRIVER_HEAD);assert.equal(suite.provenance.workerRepository.revision,WORKER_HEAD);assert.equal(suite.provenance.suiteRepository.revision,CONTROLLER_HEAD);assert.equal(suite.provenance.historicGeneration.revision,GENERATION_HEAD);assert.equal(suite.provenance.diagnostic.nativeAuthorized,false);assert.equal(suite.provenance.diagnostic.nativeRun,false);for(const file of suite.files){const b=fs.readFileSync(path.join(f.options.out,file.path));assert.equal(b.length,file.bytes);assert.equal(sha(b),file.sha256)}assert.throws(()=>prepare(f.options,f.dependencies),/Preserve prior output/);
}));
for(const target of['driver','worker','controller','historic'])test('wrong '+target+' head and dirty repository refuse before output',()=>using(f=>{
 const root=f.roots[target],old=f.heads.get(root);f.heads.set(root,'b'.repeat(40));assert.throws(()=>prepare(f.options,f.dependencies),/head differs/);f.heads.set(root,old);const dirty=(at,args)=>args[0]==='status'&&at===root?' M changed':f.git(at,args);assert.throws(()=>prepare(f.options,{...f.dependencies,git:dirty}),/must be clean/);assert.equal(fs.existsSync(f.options.out),false);
}));
test('missing and altered worker, support and controller code refuse',()=>{
 for(const target of['worker','controller'])using(f=>{const records=target==='worker'?fixture.worker.filter(x=>x.path.includes('/worker-package/test/')):fixture.controller;for(const file of records){const p=path.join(f.roots[target],file.path),original=fs.readFileSync(p);fs.writeFileSync(p,Buffer.concat([original,Buffer.from('changed')]));assert.throws(()=>prepare(f.options,f.dependencies));fs.writeFileSync(p,original);fs.renameSync(p,p+'.held');assert.throws(()=>prepare(f.options,f.dependencies));fs.renameSync(p+'.held',p);assert.equal(fs.existsSync(f.options.out),false);}});
});
test('changed history transport and foreign packet location refuse',()=>using(f=>{
 const b=fs.readFileSync(f.packet);fs.writeFileSync(f.packet,Buffer.concat([b,Buffer.from([0])]));assert.throws(()=>prepare(f.options,f.dependencies),/Historical transport identity differs/);fs.writeFileSync(f.packet,b);const outside=path.join(f.root,'foreign.json.gz');fs.writeFileSync(outside,b);assert.throws(()=>prepare({...f.options,generationPacket:outside},f.dependencies),/must belong/);assert.equal(fs.existsSync(f.options.out),false);
}));
test('unbound driver, stale output, overlapping outputs and repository subroot refuse',()=>using(f=>{
 assert.throws(()=>prepare({...f.options,expectDriverHead:undefined},f.dependencies),/externally pinned/);fs.mkdirSync(f.options.out);fs.writeFileSync(path.join(f.options.out,'sentinel'),'keep');assert.throws(()=>prepare(f.options,f.dependencies),/Preserve prior output/);assert.equal(fs.readFileSync(path.join(f.options.out,'sentinel'),'utf8'),'keep');fs.rmSync(f.options.out,{recursive:true});
 for(const root of Object.values(f.roots))assert.throws(()=>prepare({...f.options,out:path.join(root,'new-output')},f.dependencies),/must be separate/);
 const sub=path.join(f.roots.historic,'sub');fs.mkdirSync(sub);const git=(at,args)=>at===sub?(args.join(' ')==='rev-parse --show-toplevel'?f.roots.historic:args.join(' ')==='rev-parse HEAD'?GENERATION_HEAD:''):f.git(at,args);assert.throws(()=>prepare({...f.options,generationRepo:sub}, {...f.dependencies,git}),/actual repository root/);
}));
test('symlink/junction identity or output ancestors refuse without writes',t=>using(f=>{
 const alias=path.join(f.root,'alias');try{fs.symlinkSync(f.roots.worker,alias,'junction')}catch(e){if(e.code==='EPERM'){t.skip('Host cannot create a pure junction fixture');return}throw e}assert.throws(()=>prepare({...f.options,workerRepo:alias},f.dependencies),/Symlink/);assert.throws(()=>prepare({...f.options,out:path.join(alias,'new')},f.dependencies),/Symlink/);assert.equal(fs.existsSync(path.join(f.roots.worker,'new')),false);
}));
test('identity mutation on reinspection refuses before any write',()=>using(f=>{
 let reads=0;const git=(at,args)=>{if(at===f.roots.worker&&args[0]==='status'&&++reads===2)return ' M changed';return f.git(at,args)};assert.throws(()=>prepare(f.options,{...f.dependencies,git}),/must be clean/);assert.equal(fs.existsSync(f.options.out),false);
}));
test('late identity change leaves partial evidence and no suite seal or deletion',()=>using(f=>{
 let reads=0;const git=(at,args)=>{if(at===f.roots.worker&&args[0]==='status'&&++reads===3)return ' M changed';return f.git(at,args)};assert.throws(()=>prepare(f.options,{...f.dependencies,git}),/must be clean/);assert.equal(fs.existsSync(path.join(f.options.out,'suite.json')),false);assert.equal(JSON.parse(fs.readFileSync(path.join(f.options.out,'preparation-failure.json'))).sealed,false);assert.equal(fs.existsSync(path.join(f.options.out,'inputs/original09.pptx')),true);
}));
test('exclusive manifest write preserves a competing sentinel and reports failure',()=>using(f=>{
 let reads=0;const git=(at,args)=>{if(at===f.roots.worker&&args[0]==='status'&&++reads===3)fs.writeFileSync(path.join(f.options.out,'suite.json'),'competing sentinel',{flag:'wx'});return f.git(at,args)};assert.throws(()=>prepare(f.options,{...f.dependencies,git}),/EEXIST/);assert.equal(fs.readFileSync(path.join(f.options.out,'suite.json'),'utf8'),'competing sentinel');assert.equal(JSON.parse(fs.readFileSync(path.join(f.options.out,'preparation-failure.json'))).prepared,false);
}));