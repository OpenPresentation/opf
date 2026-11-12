// NEVERMERGE: one Windows attribution witness, not Full CI or release qualification.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync,spawnSync} from 'node:child_process';
import {spawnSpec} from '../../../scripts/package-manager.mjs';
const ROOT=fs.realpathSync.native(fileURLToPath(new URL('../../../',import.meta.url))),HERE=path.join(ROOT,'docs/evidence/worker-flight-witness');
const binding=JSON.parse(fs.readFileSync(path.join(HERE,'source-bindings.json'),'utf8'));
const OUT=path.join(ROOT,'artifacts/worker-flight-witness');
fs.mkdirSync(path.dirname(OUT),{recursive:true});assert.equal(fs.existsSync(OUT),false,'Preserve the earlier witness output');fs.mkdirSync(OUT);
const sha=b=>createHash('sha256').update(b).digest('hex');
const identity=file=>{const b=fs.readFileSync(file);return {bytes:b.length,sha256:sha(b)};};
const git=args=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const status=()=>git(['status','--porcelain','--untracked-files=normal']);
const errorInfo=e=>({name:String(e?.name??'Error'),message:String(e?.message??e),stack:String(e?.stack??'')});
const receipt={scope:'NEVERMERGE evidence only: ONE normal Windows worker-flight witness plus exact Office-free Name snapshot controls',base:binding.base,head:null,phases:{},errors:[],afterSourceChecksPassed:false,sourceAndBuildUnchanged:false,startedAt:new Date().toISOString()};
const persist=()=>fs.writeFileSync(path.join(OUT,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');persist();
function sourcePins(){return binding.sources.map(x=>{const got=identity(path.join(ROOT,x.path));assert.deepEqual(got,{bytes:x.bytes,sha256:x.sha256},x.path);return {path:x.path,...got};});}
function inventory(directory,predicate=()=>true){const rows=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);assert.equal(e.isSymbolicLink(),false,'No aliased build input');if(e.isDirectory())walk(f);else if(e.isFile()&&predicate(f))rows.push({path:path.relative(ROOT,f).replaceAll('\\','/'),...identity(f)});}}walk(directory);return rows.sort((a,b)=>a.path.localeCompare(b.path));}
function currentFiles(){const assets=inventory(path.join(ROOT,'packages/editor/artifacts/playground'));assert.equal(assets.length,223);for(const x of binding.assets)assert.deepEqual(identity(path.join(ROOT,x.path)),{bytes:x.bytes,sha256:x.sha256},x.path);const compiled=['javascript','gallery','render','pptx','editor','cli','mcp'].flatMap(pkg=>inventory(path.join(ROOT,'packages',pkg,'dist')));return {sources:sourcePins(),assets,compiled};}
const normalEnv={...process.env};for(const key of Object.keys(normalEnv)){const name=key.toUpperCase();if(name.startsWith('OPF_')||['NODE_OPTIONS','NODE_PATH','NODE_DEBUG','NODE_V8_COVERAGE','DEBUG'].includes(name))delete normalEnv[key];}
Object.assign(normalEnv,{CI:'true',OPF_PERF_LIMIT_MS:'100',OPF_PERF_ROUNDS:'1',OPF_PERF_COMPARE:'1',OPF_PERF_WORKER_OFF:'0',OPF_PERF_BURN_MS:'0',OPF_PERF_SLOW_APPLY_MS:'0',OPF_BROWSER_ENGINE:'chromium',OPF_CPU_THROTTLE:'1',OPF_KEYBOARD_PLATFORM:'win32'});
function child(label,args){const started=Date.now(),r=spawnSync(process.execPath,args,{cwd:ROOT,env:normalEnv,encoding:'utf8',timeout:label==='native-controls'?120000:360000,maxBuffer:16*1024*1024});const stdout=r.stdout??'',stderr=r.stderr??'';fs.writeFileSync(path.join(OUT,label+'.stdout.log'),stdout);fs.writeFileSync(path.join(OUT,label+'.stderr.log'),stderr);fs.writeFileSync(path.join(OUT,label+'.log'),stdout+stderr);const row={args,seconds:(Date.now()-started)/1000,code:r.status,signal:r.signal,error:r.error?errorInfo(r.error):null,stdout:identity(path.join(OUT,label+'.stdout.log')),stderr:identity(path.join(OUT,label+'.stderr.log'))};receipt.phases[label]=row;if(r.status!==0||r.error)receipt.errors.push({phase:label,...row});persist();return row;}
let before;
try{
 assert.equal(process.platform,'win32');assert.deepEqual(process.execArgv,[]);assert.equal(process.version,binding.expected.node);assert.equal(process.env.CI,'true');assert.ok(!process.env.NODE_OPTIONS&&!process.env.NODE_PATH,'No preloaded runtime or donor resolution');
 receipt.head=git(['rev-parse','HEAD']);assert.equal(git(['rev-parse','HEAD^']),binding.base,'One reviewed source commit directly on79');assert.equal(receipt.head,process.env.GITHUB_SHA);assert.equal(process.env.GITHUB_REF,'refs/heads/'+binding.branch);assert.equal(status(),'');
 execFileSync('git',['merge-base','--is-ancestor',binding.base,receipt.head],{cwd:ROOT});
 const changed=git(['diff','--name-only',binding.base,receipt.head]).split(/\r?\n/u).filter(Boolean).sort();assert.deepEqual(changed,[...binding.allowedChangedPaths].sort());receipt.changedPaths=changed;
 const require=createRequire(path.join(ROOT,'packages/editor/package.json'));const playwright=require('playwright/package.json').version;assert.equal(playwright,binding.expected.playwright);
 const spec=spawnSpec(['pnpm','--version']),version=spawnSync(spec.command,spec.args,{cwd:ROOT,encoding:'utf8',...spec.options});assert.equal(version.status,0);const pnpm=version.stdout.trim();assert.equal(pnpm,binding.expected.pnpm);receipt.versions={node:process.version,pnpm,playwright,platform:process.platform,nativeKeymap:normalEnv.OPF_KEYBOARD_PLATFORM,cpuThrottle:normalEnv.OPF_CPU_THROTTLE};
 const portable=fs.readFileSync(path.join(HERE,'diagnostic.mjs'));assert.deepEqual({bytes:portable.length,sha256:sha(portable)},binding.portableDiagnostic);let inverse=portable.toString();for(const x of [...binding.portableChanges].reverse()){assert.equal(inverse.split(x.new).length,2);inverse=inverse.replace(x.new,x.old);}assert.deepEqual({bytes:Buffer.byteLength(inverse),sha256:sha(Buffer.from(inverse))},binding.acceptedDiagnostic);
 before=currentFiles();fs.writeFileSync(path.join(OUT,'bindings-before.json'),JSON.stringify(before,null,2)+'\n');receipt.boundBefore={assets:before.assets.length,compiled:before.compiled.length,sources:before.sources.length};persist();
 // Independent Office-free controls run first; either child RED remains RED and never suppresses the other assigned witness.
 child('native-controls',[path.join(HERE,'native-controls.mjs'),'--expect-head',receipt.head,'--output',path.join(OUT,'native')]);
 const between=currentFiles();fs.writeFileSync(path.join(OUT,'bindings-between.json'),JSON.stringify(between,null,2)+'\n');assert.deepEqual(between,before,'Native controls must not change any source/asset/dist byte before the independent browser witness');assert.equal(git(['rev-parse','HEAD']),receipt.head);assert.equal(status(),'');receipt.preBrowserSourceAndBuildUnchanged=true;persist();
 const browser=child('browser',[path.join(HERE,'diagnostic.mjs')]);
 const reportFile=path.join(OUT,'browser/report.json');receipt.browserReport=fs.existsSync(reportFile)?identity(reportFile):null;
 if(fs.existsSync(reportFile)){
  const report=JSON.parse(fs.readFileSync(reportFile,'utf8'));receipt.browser={parameters:report.parameters,browserVersion:report.browserVersion,originalFailure:report.originalFailure,preservationErrors:report.preservationErrors,rows:report.rows.map(x=>({format:x.format,mode:x.mode,error:x.error,restored:x.evidence?.restored,overflow:x.evidence?.overflow}))};
  assert.equal(report.browserVersion,binding.expected.chromium);assert.deepEqual(report.parameters,{CI:true,LIMIT:100,ROUNDS:1,COMPARE:true,WORKER_OFF:false,BURN:0,SLOW_APPLY:0,SLIDES:1000,TAIL:150,PATTERNS:{quick:{bursts:4,size:3,spacing:30},paced:{bursts:12,size:1,spacing:90}},engineName:'chromium'});
  if(browser.code===0){assert.equal(report.originalFailure,null);assert.deepEqual(report.preservationErrors,[]);assert.deepEqual(report.rows.map(x=>[x.format,x.mode]),[['yaml','on'],['yaml','off'],['md','on'],['md','off'],['json','on']]);for(const row of report.rows){assert.equal(row.error,null);assert.equal(row.evidence.restored,true);assert.deepEqual(row.evidence.overflow,{});}}
 }else if(browser.code===0)throw new Error('Successful child omitted its raw report');
}catch(error){receipt.errors.push({phase:'authority-or-evidence',error:errorInfo(error)});}
finally{
 try{const after=currentFiles();fs.writeFileSync(path.join(OUT,'bindings-after.json'),JSON.stringify(after,null,2)+'\n');receipt.boundAfter={assets:after.assets.length,compiled:after.compiled.length,sources:after.sources.length};assert.equal(git(['rev-parse','HEAD']),receipt.head);assert.equal(status(),'');receipt.afterSourceChecksPassed=true;if(before){assert.deepEqual(after,before);receipt.sourceAndBuildUnchanged=true;}else receipt.sourceAndBuildUnchanged=null;}catch(error){receipt.errors.push({phase:'final-bindings',error:errorInfo(error)});}
 receipt.finishedAt=new Date().toISOString();receipt.code=receipt.errors.length?1:0;persist();process.exitCode=receipt.code;
}
