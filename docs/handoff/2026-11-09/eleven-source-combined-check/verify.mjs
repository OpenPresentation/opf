import assert from 'node:assert/strict';
import fs from 'node:fs';
import cp from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
const dir=fileURLToPath(new URL('.',import.meta.url)),root=fileURLToPath(new URL('../../../../',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex'),json=n=>JSON.parse(fs.readFileSync(new URL(n,import.meta.url),'utf8'));
const manifest=json('manifest.json');for(const f of manifest.files){assert(!f.name.includes('..')&&!f.name.startsWith('/'));const b=fs.readFileSync(new URL(f.name,import.meta.url));assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);}
const receipt=json('receipt.json'),list=json('raw-files.json').files,raw=new Map();let total=0;assert.equal(list.length,53);
for(const f of list){assert(/^raw\/[A-Za-z0-9._-]+\.gz$/.test(f.name));const compressed=fs.readFileSync(new URL(f.name,import.meta.url));assert.equal(compressed.length,f.gzipBytes);assert.equal(sha(compressed),f.gzipSHA256);const bytes=gunzipSync(compressed,{maxOutputLength:16*1024*1024});total+=bytes.length;assert(total<=64*1024*1024);assert.equal(bytes.length,f.bytes);assert.equal(sha(bytes),f.sha256);assert(!raw.has(f.original));raw.set(f.original,bytes);}
assert.equal(total,receipt.rawBytes);assert.equal(receipt.rawFiles,53);assert.equal(receipt.exit.exitCode,1);assert.equal(receipt.passedSteps,41);assert.equal(receipt.failedSteps,3);
const text=n=>{assert(raw.has(n),'Missing raw input '+n);return raw.get(n).toString('utf8');},stage=name=>{const matches=[...raw.keys()].filter(k=>k.endsWith('-'+name));assert.equal(matches.length,1,'Exact stage log '+name);return text(matches[0]);},exit=JSON.parse(text('driver.exit.json'));assert.deepEqual(exit,receipt.exit);
const steps=[...text('driver.log').matchAll(/^(ok|FAILED)  (.+?) \(([0-9.]+) s\)\r?$/gm)];assert.equal(steps.length,44);assert.equal(steps.filter(m=>m[1]==='ok').length,41);assert.deepEqual(steps.filter(m=>m[1]==='FAILED').map(m=>m[2]),['tests opf','tests cli','tests render']);
assert.match(stage('tests_opf.log'),/ℹ tests 4270/);assert.match(stage('tests_opf.log'),/ℹ pass 4269/);assert.match(stage('tests_cli.log'),/ℹ tests 238/);assert.match(stage('tests_cli.log'),/ℹ pass 237/);assert.match(text('cli-focused-recovery.log'),/ℹ tests 3/);assert.match(text('cli-focused-recovery.log'),/ℹ pass 3/);
const render=stage('tests_render.log');assert.match(render,/Golden passed: 960 slides, 147 decks/);assert.match(render,/\[70\/178\] node test\/layout-template-goldens.mjs/);assert.match(render,/Template goldens moved \(25 slides\)/);
const pptx=stage('tests_pptx.log');const markers=[...pptx.matchAll(/^\[(\d+)\/280\] node /gm)].map(m=>Number(m[1]));assert.deepEqual(markers,Array.from({length:280},(_,i)=>i+1));
const recovery=JSON.parse(text('cli-xml-recovery.json'));assert.equal(recovery.indexUnchanged,true);assert.equal(recovery.generated,false);assert.equal(recovery.files.length,2);for(const[file,name]of recovery.files.map((f,i)=>[f,i?'original-published-0180-slide1.xml':'original-slide1.xml'])){const bytes=raw.get(name);assert.equal(sha(bytes),file.sha256);assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),file.gitBlob);}
const office=JSON.parse(text('office-global-1036.json'));assert.equal(office.officeCalls,0);assert.equal(office.processCount,1);
const git=(...args)=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',env:{...process.env,GIT_NO_LAZY_FETCH:'1'},maxBuffer:16*1024*1024}).trim();assert.equal(git('rev-parse',receipt.source+'^{tree}'),receipt.sourceTree);assert.equal(receipt.source,exit.head);assert.equal(receipt.base,exit.base);
const assembly=JSON.parse(text('assembly-eleven.json'));assert.equal(assembly.source,receipt.source);assert.equal(assembly.packageToolPaths,32);assert.equal(assembly.protectedObjects.length,11);for(const binding of assembly.bindings)assert.equal(git('ls-tree',receipt.source,'--',binding.file).split('\t')[0],binding.entry,binding.file);
for(const object of assembly.protectedObjects)assert.equal(git('rev-parse',receipt.source+':'+object.path),object.object,object.path);
console.log(JSON.stringify({verified:true,producer:receipt.source,originalAggregateExit:1,passedSteps:41,failedSteps:3,rawFiles:list.length,rawBytes:total,pptxScripts:280,cliFocusedRecoveryPassed:3,rendererUnrun:108,nativeAcceptance:false,currentHeadAcceptance:false,manifestSHA256:sha(fs.readFileSync(new URL('manifest.json',import.meta.url)))}));
