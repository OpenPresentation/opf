import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const out=path.dirname(fileURLToPath(import.meta.url));
const root='/private/tmp/opf-completion-fix-20260921/pptx-dev';
const testedHead='a5201c88a219262b21a6c7fd4ef49a01a5bbe0a3';
const testedTree='203bdab509d05911f04f234d996f9c91f2b5e4f2';
const origin='https://www.pptx.dev';
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(f,j)=>fs.writeFileSync(path.join(out,f),JSON.stringify(j,null,2)+'\n');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const fileRows=()=>[...git('ls-files','tests/e2e').split('\n'),'playwright.config.ts','package.json','pnpm-lock.yaml'].filter(Boolean).sort().map(file=>{const bytes=fs.readFileSync(path.join(root,file));return{file,bytes:bytes.length,sha256:sha(bytes)}});
const require=createRequire(path.join(root,'package.json'));
const testPkg=read(require.resolve('@playwright/test/package.json'));
const playwrightRequire=createRequire(require.resolve('@playwright/test'));
const playwrightPkg=playwrightRequire.resolve('playwright/package.json');
const coreRequire=createRequire(playwrightPkg);
const coreRoot=path.dirname(coreRequire.resolve('playwright-core/package.json'));
const browsers=read(path.join(coreRoot,'browsers.json'));
function preparedRuntime(){
 const {chromium}=require('@playwright/test');
 const headedExecutable=chromium.executablePath();
 const {registry}=coreRequire(path.join(coreRoot,'lib/coreBundle.js')).registry;
 const headlessExecutable=registry.findExecutable('chromium-headless-shell').executablePath();
 return{node:process.version,platform:process.platform,arch:process.arch,playwright:testPkg.version,headless:true,channel:null,chromiumDescriptor:browsers.browsers.find(b=>b.name==='chromium'),headlessDescriptor:browsers.browsers.find(b=>b.name==='chromium-headless-shell'),headedExecutable,headlessExecutable,headlessExecutableSha256:sha(fs.readFileSync(headlessExecutable)),note:'Metadata/file inspection only at preparation; actual launch is recorded by pw:browser during the authorized run.'};
}
assert.match(process.versions.node,/^24\./,'Use Node24');
assert.equal(git('rev-parse','HEAD'),testedHead,'Test worktree head changed');
assert.equal(git('rev-parse','HEAD^{tree}'),testedTree,'Tested tree changed');
assert.equal(git('status','--porcelain'),'','Test worktree must remain clean');
if(process.argv[2]==='--prepare'){
 assert.ok(!fs.existsSync(path.join(out,'run-started.json')),'Do not prepare over a started run');
 const listing=fs.readFileSync(path.join(out,'test-list.txt'),'utf8');assert.match(listing,/Total: 24 tests in 11 files/);
 for(const row of fileRows()){const dest=path.join(out,'source',row.file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,row.file),dest);}
 write('prepared.json',{preparedAt:new Date().toISOString(),root,testedHead,testedTree,origin,tests:24,retries:0,workers:1,configuredTimeoutMs:45000,trace:'retain-on-failure',inputFiles:fileRows(),runtime:preparedRuntime(),status:'Prepared only; no browser launched; awaiting root authorization and exact READY receipt.'});
 console.log('Prepared. No browser launched.');
 process.exit(0);
}
assert.equal(process.argv[2],'--go','Usage: node run-once.mjs --go ACCEPTED_MERGE_SHA READY_DEPLOYMENT_JSON; only after explicit root authorization');
const acceptedHead=process.argv[3],receiptPath=path.resolve(process.argv[4]??'');
assert.match(acceptedHead??'',/^[a-f0-9]{40}$/);
const receipt=read(receiptPath),prepared=read(path.join(out,'prepared.json'));
assert.equal(receipt.state,'READY');assert.equal(receipt.target,'production');assert.ok(receipt.alias.includes('www.pptx.dev'));assert.equal(receipt.meta.githubCommitSha,acceptedHead);
assert.equal(git('rev-parse',`${acceptedHead}^{tree}`),testedTree,'Accepted and tested source trees differ');
assert.deepEqual(fileRows(),prepared.inputFiles,'Test inputs changed since preparation');
const runtime=preparedRuntime();assert.equal(runtime.headlessExecutableSha256,prepared.runtime.headlessExecutableSha256,'Installed Chromium changed');
const args=[path.join(root,'node_modules/@playwright/test/cli.js'),'test','--reporter=list,json','--retries=0',`--output=${path.join(out,'results')}`];
const env={...process.env,OPF_APP_URL:origin,PLAYWRIGHT_JSON_OUTPUT_FILE:path.join(out,'results.json'),DEBUG:'pw:browser'};
for(const key of ['OPF_BROWSER_STORAGE_STATE','PWDEBUG','PW_TEST_RETRIES'])delete env[key];
const started={startedAt:new Date().toISOString(),testedHead,testedTree,acceptedHead,deploymentId:receipt.id,origin,root,executable:process.execPath,args,environment:{OPF_APP_URL:origin,PLAYWRIGHT_JSON_OUTPUT_FILE:env.PLAYWRIGHT_JSON_OUTPUT_FILE,DEBUG:env.DEBUG,OPF_BROWSER_STORAGE_STATE:'unset'},runtime};
fs.writeFileSync(path.join(out,'run-started.json'),JSON.stringify(started,null,2)+'\n',{flag:'wx'});
fs.copyFileSync(receiptPath,path.join(out,'deployment.json'));
let versionProbe;try{versionProbe={value:execFileSync(runtime.headlessExecutable,['--version'],{encoding:'utf8',timeout:10000}).trim(),exitCode:0};}catch(error){versionProbe={exitCode:error.status,message:error.message};}
write('browser-runtime.json',{...runtime,versionProbe});
const log=fs.openSync(path.join(out,'browser.log'),'wx');
let code,signal,executionError;
try{
 const child=spawn(process.execPath,args,{cwd:root,env,stdio:['ignore','pipe','pipe']});
 write('runner-process.json',{pid:child.pid,startedAt:new Date().toISOString()});
 for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{fs.writeSync(log,b);process.stdout.write(b)});
 ({code,signal}=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',(code,signal)=>resolve({code,signal}));}));
}catch(error){executionError={message:error.message,stack:error.stack};code=1;write('execution-error.json',executionError);}finally{fs.closeSync(log);}
const result=fs.existsSync(path.join(out,'results.json'))?read(path.join(out,'results.json')):null;
const tests=[];function walk(suite){for(const spec of suite.specs??[])for(const test of spec.tests??[])tests.push({file:spec.file,line:spec.line,title:spec.title,expectedStatus:test.expectedStatus,status:test.status,results:test.results.map(r=>({status:r.status,retry:r.retry,duration:r.duration,error:r.error,errors:r.errors,attachments:r.attachments}))});for(const s of suite.suites??[])walk(s);}
for(const s of result?.suites??[])walk(s);
write('acceptance-summary.json',{finishedAt:new Date().toISOString(),exitCode:code,signal,executionError,stats:result?.stats,tests,postRunInputIdentity:JSON.stringify(fileRows())===JSON.stringify(prepared.inputFiles),postRunGitStatus:git('status','--porcelain'),scope:'One canonical attempt only; earlier app46 11/19 and app45 14/18 remain failed history. Native/font and broader source preservation gates are separate.'});
const hashes=[];function inventory(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const p=path.join(dir,entry.name);if(entry.isDirectory())inventory(p);else if(entry.isFile()&&entry.name!=='artifact-hashes.json'){const b=fs.readFileSync(p);hashes.push({file:path.relative(out,p),bytes:b.length,sha256:sha(b)})}}}inventory(out);write('artifact-hashes.json',{files:hashes});
process.exitCode=code??1;
