import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root='/tmp/opf-034',out='/tmp/opf-final-worker-controls02',expected=process.argv[2];
const hash=b=>createHash('sha256').update(b).digest('hex');
const git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8'}).trim();
assert.match(expected??'',/^[a-f0-9]{40}$/u);assert.equal(process.version,'v24.21.0');
assert.equal(git('rev-parse','HEAD'),expected);assert.equal(git('status','--porcelain'),'');
const source=()=>({head:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),status:git('status','--porcelain')});
const compiled=JSON.parse(fs.readFileSync('/tmp/opf-node22-demand-root-mapped01/runtime-after.json'));
const assets=JSON.parse(fs.readFileSync('/tmp/opf-worker-flight-assets01/receipt.json')).outputs;
const records=[...compiled.map(r=>({path:r.file,bytes:r.bytes,sha256:r.sha256})),...assets];
function verify(){for(const r of records){const b=fs.readFileSync(path.resolve(root,r.path));assert.equal(b.length,r.bytes,r.path);assert.equal(hash(b),r.sha256,r.path);}}
const evidenceRoot=path.join(root,'packages/editor/artifacts/source-worker-perf');
const names=()=>fs.existsSync(evidenceRoot)?fs.readdirSync(evidenceRoot).sort():[];
const env={...process.env,CI:'true',OPF_AGENT_SLOTS:'1',PATH:path.dirname(process.execPath)+':/tmp/opf-native-toolbin:/opt/homebrew/bin:/usr/bin:/bin'};
for(const key of Object.keys(env))if(key.startsWith('OPF_PERF_')||['OPF_CPU_THROTTLE','OPF_BROWSER_ENGINE','OPF_BROWSER_EXECUTABLE','OPF_KEYBOARD_PLATFORM'].includes(key))delete env[key];
assert.ok(!env.NODE_OPTIONS&&!env.NODE_PATH);
const cases=[{name:'normal',env:{},code:0},{name:'worker-off',env:{OPF_PERF_WORKER_OFF:'1'},code:1,reason:/only 0 of 4 edits were checked in the worker/u},{name:'burn45',env:{OPF_PERF_BURN_MS:'45'},code:1,reason:/while the worker checks, over 40%/u},{name:'outside-apply26',env:{OPF_PERF_SLOW_APPLY_MS:'26'},code:0}];
const receipt={source:source(),node:process.version,compiledFiles:compiled.length,assets:assets.length,scope:'One normal, two maintained negative controls and one maintained outside-apply positive; unchanged workload and budgets; no retry',runs:[],failure:null};
const persist=()=>fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');persist();
try{
verify();
for(const c of cases){
 const before=names(),started=Date.now();
 const result=spawnSync(process.execPath,['test/source-worker-perf-browser.mjs'],{cwd:path.join(root,'packages/editor'),env:{...env,...c.env},encoding:'utf8',timeout:360000,maxBuffer:16*1024*1024});
 fs.writeFileSync(path.join(out,c.name+'.stdout.log'),result.stdout??'',{flag:'wx'});fs.writeFileSync(path.join(out,c.name+'.stderr.log'),result.stderr??'',{flag:'wx'});
 const fresh=names().filter(n=>!before.includes(n)),row={name:c.name,env:c.env,code:result.status,signal:result.signal,error:result.error?.message??null,seconds:(Date.now()-started)/1000,freshOutputs:fresh};receipt.runs.push(row);persist();
 assert.equal(fresh.length,1,'One fresh report per actual invocation');
 const raw=fs.readFileSync(path.join(evidenceRoot,fresh[0],'report.json')),report=JSON.parse(raw);fs.writeFileSync(path.join(out,c.name+'.report.json'),raw,{flag:'wx'});
 row.report={bytes:raw.length,sha256:hash(raw)};row.browserVersion=report.browserVersion;row.originalFailure=report.originalFailure;row.rows=report.rows.map(r=>({mode:r.mode,format:r.format,restored:r.clock?.restored,error:r.error,opened:r.clock?.opened,faults:r.clock?.faults,overflow:r.clock?.overflow}));persist();
 assert.equal(result.signal,null);assert.equal(result.error,undefined);assert.equal(result.status,c.code,c.name);
 assert.deepEqual(report.preservationErrors,[]);assert.ok(report.rows.every(r=>r.clock?.restored&&r.clock.opened===null&&r.clock.faults.length===0&&Object.keys(r.clock.overflow).length===0));
 if(c.code===0){assert.equal(report.originalFailure,null);assert.equal(report.rows.length,5);}else assert.match(report.originalFailure?.message??'',c.reason,'The negative control must fail for its intended reason');
 verify();assert.deepEqual(source(),receipt.source);row.qualified=true;persist();console.log(JSON.stringify({name:c.name,qualified:true,code:row.code,seconds:row.seconds,browser:row.browserVersion}));
}
}catch(error){receipt.failure={name:error.name,message:error.message,stack:error.stack};throw error;}
finally{receipt.afterSource=source();try{verify();receipt.boundRuntimeAndAssetsUnchanged=true;}catch(error){receipt.boundRuntimeAndAssetsUnchanged=false;receipt.bindingFailure=String(error);}persist();}
