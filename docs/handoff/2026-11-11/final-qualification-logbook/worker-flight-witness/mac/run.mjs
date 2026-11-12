import fs from 'node:fs';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root='/tmp/opf-034',out='/tmp/opf-worker-flight-execution01',head='79cdb85d6ab8a58dde5d474e254cffa027735c51';
const packet='/tmp/opf-worker-flight-diagnostic-source01',manifestFile=packet+'/manifest.json';
const sha=b=>createHash('sha256').update(b).digest('hex'),git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8'}).trim();
const json=p=>JSON.parse(fs.readFileSync(p));
if(process.version!=='v24.21.0'||git('rev-parse','HEAD')!==head||git('status','--porcelain'))throw Error('Pinned current clean source required');
if(sha(fs.readFileSync(manifestFile))!=='abf33d6e5a650cb72fc03e7a1aa7b46b4b4bbf99398355dd23df8cc1e843a8b3')throw Error('Frozen diagnostic manifest required');
const manifest=json(manifestFile),assets=json('/tmp/opf-worker-flight-assets01/receipt.json'),compiled=json('/tmp/opf-node22-demand-root-mapped01/runtime-after.json');
const records=[...manifest.files,...manifest.protectedSources,...manifest.windowsAndFreshMacAssets.flatMap(r=>[r.mac,r.windows]),manifest.rootBuildReceipt,manifest.firstFailure,...assets.outputs,...compiled.map(r=>({path:r.file,bytes:r.bytes,sha256:r.sha256}))];
const verify=()=>records.every(r=>{const b=fs.readFileSync(path.resolve(root,r.path));return b.length===r.bytes&&sha(b)===r.sha256;});
if(!verify()||fs.existsSync('/tmp/opf-worker-flight-diagnostic-run01'))throw Error('Exact source/assets and fresh output required');
const env={...process.env,CI:'true',OPF_AGENT_SLOTS:'1',PATH:path.dirname(process.execPath)+':/tmp/opf-native-toolbin:/opt/homebrew/bin:/usr/bin:/bin'};
const scrubbed=[];for(const key of Object.keys(env))if(key.startsWith('OPF_PERF_')||['OPF_CPU_THROTTLE','OPF_BROWSER_ENGINE','OPF_BROWSER_EXECUTABLE','OPF_KEYBOARD_PLATFORM'].includes(key)){scrubbed.push(key);delete env[key];}
fs.writeFileSync(out+'/before.json',JSON.stringify({source:head,tree:git('rev-parse','HEAD^{tree}'),node:process.version,nodeExecutableSha256:sha(fs.readFileSync(process.execPath)),records:records.length,compiledFiles:compiled.length,freshAssets:assets.outputs.length,scrubbed,defaults:{CI:true,limit:100,rounds:1,compare:true,workerOff:false,burn:0,slowApply:0,cpu:1,engine:'chromium',keyboardPlatform:process.platform}},null,2)+'\n',{flag:'wx'});
const started=Date.now(),command=[packet+'/diagnostic.mjs'];
const result=spawnSync(process.execPath,command,{cwd:root+'/packages/editor',env,encoding:'utf8',timeout:360000,maxBuffer:16*1024*1024});
const log=(result.stdout??'')+(result.stderr??'');fs.writeFileSync(out+'/test.log',log,{flag:'wx'});
let report=null,reportError=null;try{report=json('/tmp/opf-worker-flight-diagnostic-run01/report.json');}catch(error){reportError=String(error);}
const stable=verify(),sourceUnchanged=git('rev-parse','HEAD')===head&&!git('status','--porcelain');
const receipt={source:head,tree:git('rev-parse','HEAD^{tree}'),node:process.version,command,startedAt:new Date(started).toISOString(),seconds:(Date.now()-started)/1000,code:result.status,signal:result.signal,error:result.error?.message??null,sourceUnchanged,boundRecords:records.length,boundRecordsUnchanged:stable,compiledFiles:compiled.length,assets:assets.outputs.length,log:{bytes:Buffer.byteLength(log),sha256:sha(log)},reportError,parameters:report?.parameters??null,browserVersion:report?.browserVersion??null,rows:report?.rows.map(r=>({mode:r.mode,format:r.format,error:r.error,recorderRestored:r.evidence?.restored,overflow:r.evidence?.overflow})),originalFailure:report?.originalFailure??null,preservationErrors:report?.preservationErrors??null,scope:'ONE instrumented normal Mac witness on exact Windows operative asset bytes; original verdict retained; no Windows failure-cause or benchmark acceptance claim'};
fs.writeFileSync(out+'/receipt.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));process.exitCode=result.status===0&&sourceUnchanged&&stable?0:1;
