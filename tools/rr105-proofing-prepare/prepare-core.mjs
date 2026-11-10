// NEVERMERGE original09 preparation. Node builtins only; no Office/export entrypoint.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
export const WORKER_HEAD='2b825aa72e16dfa6593a8171011f7fcb6138255b';
export const CONTROLLER_HEAD='ce92ccc65d8cb40cc6532b2d9082e12202d6c283';
export const GENERATION_HEAD='fb37046f043f860c8887e0574620ef3c507e3fa4';
export const GENERATION_SHA='beaaa89b3373c0c0e215ad86da5611f75edea6de8eb442957522fd1014583e31';
export const OLD_SUITE_SHA='50dc947be9220127c2a18f6b3e47d47479a275bf3563144b00b27c38fa18e097';
export const CASE_ID='proofing-direction-original09';
export const ORIGINAL_SHA='4b9d084f5ddccd23f553cc0a030ad8a43bca6e120de89d13cfca34b4163f06e2';
export const WORKER_SUBDIR='tools/rr105-proofing-direction/worker-package';
export const CODE_FILES=['tools/rr105-proofing-prepare/prepare-core.mjs','tools/rr105-proofing-prepare/prepare-suite.mjs'];
export const WORKER_FILES=[
 ['test/native-furniture-control.ps1',81652,'51cb21003f058bd401669458e6f0afdd0acd899fdd54c4ee529595a32f5e65b9'],
 ['test/native-process.ps1',2341,'b9444de1367fe3a3aab654f4787b5aa9a1304dc38360159a45d1f9f420adf69c'],
 ['test/native-process-check.ps1',2333,'50ae41cf771dab0e0c9245f3627abc4586451df8414bdc986df882d3ceda5027'],
 ['test/native-furniture-harness-check.ps1',45855,'06ac3e49dc2b6973d58357b381f9319d9b2d5f2c9176d6fb6d1bf3fd8a3c650d'],
 ['test/fixtures/sh25-native-circle-observations.json',2490,'e8e452a52977f6a76925cfb31c92f8d1340448dd59566193468e616a98322af0'],
];
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const parse=bytes=>JSON.parse(Buffer.from(bytes).toString('utf8').replace(/^\uFEFF/,''));
export function plainPath(value,{directory=false,mustExist=true}={}){
 assert.equal(typeof value,'string');assert.ok(value.length>0&&!/[\x00-\x1f]/.test(value),'Path must be literal and nonempty');
 assert.ok(!value.startsWith('\\\\')&&!value.startsWith('//'),'UNC/network paths are forbidden');
 const full=path.resolve(value);let current=full;
 for(;;){if(fs.existsSync(current)){const stat=fs.lstatSync(current);assert.ok(!stat.isSymbolicLink(),'Symlink/reparse path is forbidden: '+current);}const parent=path.dirname(current);if(parent===current)break;current=parent;}
 if(mustExist){const stat=fs.statSync(full);assert.ok(directory?stat.isDirectory():stat.isFile(),'Wrong path kind: '+full);}
 return full;
}
export function overlaps(a,b){const x=path.resolve(a).toLowerCase(),y=path.resolve(b).toLowerCase();return x===y||x.startsWith(y+path.sep)||y.startsWith(x+path.sep);}
export function freshOutput(value,protectedRoots){const full=plainPath(value,{mustExist:false});assert.ok(!fs.existsSync(full),'Preserve prior output; choose a fresh directory');plainPath(path.dirname(full),{directory:true});for(const root of protectedRoots)assert.ok(!overlaps(full,root),'Output must be separate from every identity root');return full;}
const defaultGit=(root,args)=>execFileSync('git',['--no-optional-locks','-C',root,...args],{encoding:'utf8',maxBuffer:8*1024*1024}).trim();
function repository(root,expected,git){const actual=plainPath(root,{directory:true});assert.equal(path.resolve(git(actual,['rev-parse','--show-toplevel'])).toLowerCase(),actual.toLowerCase(),'Identity root must be the actual repository root');assert.match(expected,/^[a-f0-9]{40}$/);assert.equal(git(actual,['rev-parse','HEAD']),expected,'Repository head differs: '+actual);assert.equal(git(actual,['status','--porcelain','--untracked-files=normal']),'','Repository must be clean: '+actual);return actual;}
function fileRecord(root,name,expectedBytes,expectedHash){assert.ok(name.split('/').every(p=>p&&p!=='.'&&p!=='..')&&!name.includes('\\'));const full=plainPath(path.join(root,name)),bytes=fs.readFileSync(full);if(expectedBytes!==undefined)assert.equal(bytes.length,expectedBytes,name);if(expectedHash)assert.equal(sha(bytes),expectedHash,name);return{path:name,bytes:bytes.length,sha256:sha(bytes)};}
function generation(packet){
 const transport=fs.readFileSync(plainPath(packet));assert.ok(transport.length<=2*1024*1024);assert.equal(sha(transport),GENERATION_SHA,'Historical transport identity differs');
 const body=parse(gunzipSync(transport,{maxOutputLength:24*1024*1024}));assert.equal(body.format,'rr105-proofing-observation-v1');assert.equal(body.entries.length,452);const entries=new Map();let total=0;
 for(const e of body.entries){assert.ok(typeof e.name==='string'&&e.name.split('/').every(p=>p&&p!=='.'&&p!=='..')&&!e.name.includes('\\')&&!path.isAbsolute(e.name));assert.ok(!entries.has(e.name));assert.equal(typeof e.base64,'string');const b=Buffer.from(e.base64,'base64');assert.equal(b.toString('base64'),e.base64);assert.equal(b.length,e.size);assert.equal(sha(b),e.sha256);entries.set(e.name,b);total+=b.length;}
 assert.equal(total,3447922);const old=entries.get('suite/suite.json');assert.equal(sha(old),OLD_SUITE_SHA);const suite=parse(old);
 assert.equal(suite.provenance.workerRepository.revision,'b8461d48b193e32dee4e6e1bb60896823f2303ff');assert.equal(suite.provenance.suiteRepository.revision,CONTROLLER_HEAD);
 const selected=suite.cases.filter(c=>c.id==='proofing-inheritance-A');assert.equal(selected.length,1);assert.equal(selected[0].archiveSha256,ORIGINAL_SHA);
 for(const f of suite.files){const b=entries.get('suite/'+f.path);assert.ok(b);assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);}
 const pick=(name,size,hash)=>{const b=entries.get('suite/'+name);assert.ok(b);assert.equal(b.length,size);assert.equal(sha(b),hash);return b;};
 return{transportSha256:sha(transport),suiteSha256:sha(old),files:[
  ['inputs/original09.pptx',pick('inputs/A.pptx',101027,ORIGINAL_SHA)],
  ['actions/empty.json',pick('actions/empty.json',3,'37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570')],
  ['sources/source.opf.json',pick('sources/source.opf.json',371,'16064a74fd25c95544df46dc4f340829280caef7ef7324d117f492bb4284f15c')],
  ['previews/sealed-cli-preview.png',pick('previews/sealed-cli-preview.png',30278,'127608f4fda60dbe284f7c4ea25caa6ad6a3c63763453e15a09a76f434ddc8dd')],
 ]};
}
export function inspect(options,{git=defaultGit,driverRoot}={}){
 assert.ok(driverRoot,'The caller must bind its executing driver root');
 const own=plainPath(driverRoot,{directory:true}),ownHead=git(own,['rev-parse','HEAD']);assert.match(ownHead,/^[a-f0-9]{40}$/);repository(own,options.expectDriverHead??ownHead,git);
 const worker=repository(options.workerRepo,WORKER_HEAD,git),controller=repository(options.controllerRepo,CONTROLLER_HEAD,git),historic=repository(options.generationRepo,GENERATION_HEAD,git);
 for(const[a,b]of[[own,worker],[own,controller],[own,historic],[worker,controller],[worker,historic],[controller,historic]])assert.ok(!overlaps(a,b),'Identity repositories must remain separate');
 const packet=plainPath(options.generationPacket);assert.ok(packet.toLowerCase().startsWith(historic.toLowerCase()+path.sep),'Generation packet must belong to the pinned historical repository');
 const workerRoot=plainPath(path.join(worker,WORKER_SUBDIR),{directory:true});
 const workerFiles=WORKER_FILES.map(([name,bytes,hash])=>fileRecord(workerRoot,name,bytes,hash));
 const controllerFiles=[fileRecord(controller,'scripts/native-acceptance/run-windows.ps1',15359,'5121ce5438db3fd932f7780c13091162b0786fe5368a6d63e8059d76efa91e9a')];
 const driverFiles=CODE_FILES.map(name=>fileRecord(own,name));
 const source=generation(packet),original=gunzipSync(fs.readFileSync(plainPath(path.join(worker,'tools/rr105-proofing-direction/original09.pptx.gz'))),{maxOutputLength:1024*1024});assert.equal(sha(original),ORIGINAL_SHA);assert.deepEqual(original,source.files[0][1]);assert.deepEqual(parse(source.files[1][1]),[]);
 const identities={driver:{revision:ownHead,dirty:false,files:driverFiles},worker:{revision:WORKER_HEAD,dirty:false,files:workerFiles},controller:{revision:CONTROLLER_HEAD,dirty:false,files:controllerFiles},historicGeneration:{revision:GENERATION_HEAD,dirty:false,transportSha256:source.transportSha256,suiteSha256:source.suiteSha256,original09Sha256:ORIGINAL_SHA,originalWorkerRevision:'b8461d48b193e32dee4e6e1bb60896823f2303ff'}};
 return{mode:'inspect',case:CASE_ID,identities,roots:{driver:own,worker,workerPackage:workerRoot,controller,historic},files:source.files.map(([name,b])=>({path:name,bytes:b.length,sha256:sha(b)})),limits:{slides:1,shapes:3,actions:0,timeoutSeconds:45,maximumSeconds:60,phases:['original','edited','reopened'],pngs:3},nativeAuthorized:false,nativeRun:false,nativeAcceptance:false,registryAcceptance:false};
}
export function prepare(options,dependencies={}){
 assert.match(options.expectDriverHead??'',/^[a-f0-9]{40}$/,'Explicit prepare requires an externally pinned driver head');
 const before=inspect(options,dependencies),target=freshOutput(options.out,Object.values(before.roots));
 // Re-read every identity/input before first write. No cached inspection authorizes preparation.
 assert.deepEqual(inspect(options,dependencies),before);
 fs.mkdirSync(target);let sealed=false;
 try{
  const source=generation(options.generationPacket);const files=[];
  for(const[name,bytes]of source.files){const output=path.join(target,name);fs.mkdirSync(path.dirname(output),{recursive:true});plainPath(path.dirname(output),{directory:true});fs.writeFileSync(output,bytes,{flag:'wx'});files.push(fileRecord(target,name,bytes.length,sha(bytes)));}
  assert.deepEqual(inspect(options,dependencies),before,'Code or original input changed during preparation');
  const selected={id:CASE_ID,worker:'furniture',automaticControlEligible:true,input:'inputs/original09.pptx',actionPlan:'actions/empty.json',archiveSha256:ORIGINAL_SHA,slideCount:1,declaredTopLevelShapes:3,source:'sources/source.opf.json',preview:'previews/sealed-cli-preview.png',expectedPrimaryLanguageId:1025,requiredPhaseNamePairs:9,diagnosticOnly:true,knownPriorVisualFailure:true,nativeAcceptance:false};
  const suite={schemaVersion:1,cases:[selected],files,provenance:{workerRepository:before.identities.worker,suiteRepository:before.identities.controller,preparation:before.identities.driver,historicGeneration:before.identities.historicGeneration,diagnostic:{neverMerge:true,kind:'paragraph-direction-original09',nativeAuthorized:false,nativeRun:false,nativeAcceptance:false,registryAcceptance:false,guard:'Original09 only; primary1025/ordinalUTF16/geometry retained; TextDirection enum is an observation, not glyph acceptance.'}}};
  fs.writeFileSync(path.join(target,'suite.json'),JSON.stringify(suite,null,2)+'\n',{flag:'wx'});sealed=true;
  for(const f of files)fileRecord(target,f.path,f.bytes,f.sha256);assert.deepEqual(inspect(options,dependencies),before,'Identity changed after sealing');
  return{...before,mode:'prepare',prepared:true,suiteDirectory:target,suiteSha256:sha(fs.readFileSync(path.join(target,'suite.json'))),sealed};
 }catch(error){try{fs.writeFileSync(path.join(target,'preparation-failure.json'),JSON.stringify({prepared:false,sealed,nativeRun:false,nativeAuthorized:false,error:error.message})+'\n',{flag:'wx'});}catch{}throw error;}
}