import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,lstat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root='C:/opf-work/n034-current-table-validate01',repo='C:/opf-work/n034-current',output='C:/opf-work/n034-current-table-profile01';
const node='C:/Users/micha/AppData/Local/npm-cache/_npx/00a8f3ae68dc15e1/node_modules/node/bin/node.exe';
const wanted='0699820e2f562d94c48b8c44a2d9b72387c0cecb',hash=b=>createHash('sha256').update(b).digest('hex');
await mkdir(root);
await writeFile(root+'/driver.mjs',await readFile(new URL(import.meta.url)),{flag:'wx'});
const write=(name,value)=>writeFile(root+'/'+name,typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const git=args=>{const r=spawnSync('git',['-C',repo,...args],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
const helper=repo+'/scripts/native-acceptance/windows-powershell-env.mjs',helperBytes=await readFile(helper);
assert.equal(hash(helperBytes),'80ff3cb3936d2b928745152fc8c602e7014c85ed85a1b8c0d5057fecf13a93b6');
const {windowsPowerShellEnvironment}=await import(pathToFileURL(helper).href);
const childEnv=windowsPowerShellEnvironment(process.env);
assert.equal(git(['rev-parse','HEAD']),wanted);assert.equal(git(['status','--porcelain','--untracked-files=normal']),'');
try{await lstat(output);assert.fail('Fresh output already exists');}catch(error){if(error.code!=='ENOENT')throw error;}
await write('preflight.json',{observedAt:new Date().toISOString(),sourceHead:wanted,sourceClean:true,outputInitiallyAbsent:true,envHelper:{path:helper,sha256:hash(helperBytes)},node:{path:node,sha256:hash(await readFile(node))},OfficeCalls:0});
function run(name,exe,args,timeout){const began=new Date().toISOString(),r=spawnSync(exe,args,{cwd:repo,env:childEnv,windowsHide:true,timeout,maxBuffer:4*1024*1024});return {began,result:r,record:{executable:exe,args,timeoutMs:timeout,startedAt:began,endedAt:new Date().toISOString(),status:r.status,signal:r.signal,error:r.error?{name:r.error.name,message:r.error.message,code:r.error.code}:null,stdoutBytes:r.stdout?.length??0,stderrBytes:r.stderr?.length??0}};}
const prepArgs=[repo+'/scripts/native-acceptance/table-profile.mjs','prepare','--suite','C:/opf-work/n034-current-suite01','--producer',repo,'--legacy-worker',repo+'/packages/pptx','--consumer',repo+'/artifacts/npm/consumer','--output',output];
const prep=run('prepare',node,prepArgs,90000);await write('prepare.stdout.log',prep.result.stdout??Buffer.alloc(0));await write('prepare.stderr.log',prep.result.stderr??Buffer.alloc(0));await write('prepare.exit.json',prep.record);assert.equal(prep.result.status,0,'Preparation failed; stop, no retry');
const prepared=JSON.parse(prep.result.stdout.toString('utf8').replace(/^\uFEFF/,''));assert.equal(prepared.controllerRevision,wanted);assert.equal(prepared.envelope,output.replaceAll('/',String.fromCharCode(92))+'\\table-profile.json');
const envelopeBytes=await readFile(prepared.envelope),envelope=JSON.parse(envelopeBytes.toString('utf8'));assert.equal(hash(envelopeBytes),prepared.sha256);assert.equal(envelope.controller.revision,wanted);assert.equal(envelope.controller.dirty,false);assert.equal(envelope.suiteSha256,'34139d3a8c84b4d975333691b6a2a3801f5d3da402dfe701062b6677de393d29');assert.deepEqual(envelope.limits,{slides:6,tables:6,cells:24,phases:3,nativeCells:72,pngs:18,imports:9,timeoutSecondsMax:60});
await write('prepared-envelope.json',envelopeBytes);await write('prepared-binding.json',{envelope:prepared.envelope,sha256:prepared.sha256,controllerHead:envelope.controller.revision,suiteSha256:envelope.suiteSha256,inputSha256:envelope.selectedCase.archiveSha256,snapshots:envelope.snapshots,limits:envelope.limits,nativeAcceptance:false});
const validationArgs=['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',repo+'/scripts/native-acceptance/run-table-profile.ps1','-Envelope',prepared.envelope,'-EnvelopeSha256',prepared.sha256,'-NodeExecutable',node,'-TimeoutSeconds','60','-ValidateOnly'];
const validation=run('validate','C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',validationArgs,90000);await write('validate.stdout.log',validation.result.stdout??Buffer.alloc(0));await write('validate.stderr.log',validation.result.stderr??Buffer.alloc(0));await write('validate.exit.json',validation.record);
const post={sourceHead:git(['rev-parse','HEAD']),sourceStatus:git(['status','--porcelain','--untracked-files=normal']),envelopeSha256:hash(await readFile(prepared.envelope)),OfficeCalls:0,profilePrepared:true,ValidateOnlyInvoked:true,RunOfficeInvoked:false,nativeAcceptance:false};await write('postflight.json',post);assert.equal(post.sourceHead,wanted);assert.equal(post.sourceStatus,'');assert.equal(post.envelopeSha256,prepared.sha256);assert.equal(validation.result.status,0,'Pure validation failed; stop, no retry');
console.log(JSON.stringify({root,envelope:prepared.envelope,sha256:prepared.sha256,controllerHead:wanted,prepareExit:prep.result.status,ValidateOnlyExit:validation.result.status,OfficeCalls:0,nativeAcceptance:false}));