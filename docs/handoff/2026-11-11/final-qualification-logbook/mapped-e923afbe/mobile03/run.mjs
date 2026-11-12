import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
const root='/tmp/opf-034',out='/tmp/opf-final-mobile-controls03',expected='e923afbe78413608f98d942089e9763d6b10282b';
const hash=b=>createHash('sha256').update(b).digest('hex');
const git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8'}).trim();
const source=()=>({head:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),status:git('status','--porcelain')});
const before=source();assert.equal(before.head,expected);assert.equal(before.status,'');assert.equal(process.version,'v24.21.0');
const compiled=JSON.parse(fs.readFileSync('/tmp/opf-final-coherent-qualification02/runtime-after.json'));
const assets=JSON.parse(fs.readFileSync('/tmp/opf-worker-flight-assets01/receipt.json')).outputs;
const records=[...compiled.map(r=>({path:r.file,bytes:r.bytes,sha256:r.sha256})),...assets];
function verify(){for(const r of records){const b=fs.readFileSync(path.resolve(root,r.path));assert.equal(b.length,r.bytes,r.path);assert.equal(hash(b),r.sha256,r.path);}}
const journalRoot=path.join(root,'packages/editor/artifacts/mobile-touch-failures/startup');
const names=()=>fs.existsSync(journalRoot)?fs.readdirSync(journalRoot).sort():[];
const oldNames=names();verify();
const env={...process.env,CI:'true',OPF_AGENT_SLOTS:'1',PATH:path.dirname(process.execPath)+':/tmp/opf-native-toolbin:/opt/homebrew/bin:/usr/bin:/bin'};
for(const key of Object.keys(env))if(key.startsWith('OPF_TOUCH_')||key==='OPF_WEBKIT_EXECUTABLE')delete env[key];
assert.ok(!env.NODE_OPTIONS&&!env.NODE_PATH);
const argv=['test/mobile-touch-browser.mjs'],started=Date.now();
const receipt={scope:'One actual unchanged core21 mobile/touch suite, both Chromium and WebKit; new diagnostic retention source; no retries',sourceBefore:before,node:process.version,argv,startedAt:new Date(started).toISOString(),compiledFiles:compiled.length,assets:assets.length};
const persist=()=>fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');persist();
const stdout=fs.createWriteStream(path.join(out,'stdout.log'),{flags:'wx'}),stderr=fs.createWriteStream(path.join(out,'stderr.log'),{flags:'wx'});
try{
 const result=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,argv,{cwd:path.join(root,'packages/editor'),env});child.stdout.pipe(stdout,{end:false});child.stderr.pipe(stderr,{end:false});child.on('error',reject);child.on('close',(code,signal)=>stdout.end(()=>stderr.end(()=>resolve({code,signal}))));});
 Object.assign(receipt,result,{seconds:(Date.now()-started)/1000});
 const raw=fs.readFileSync(path.join(out,'stdout.log'));receipt.stdout={bytes:raw.length,sha256:hash(raw)};
 const errors=fs.readFileSync(path.join(out,'stderr.log'));receipt.stderr={bytes:errors.length,sha256:hash(errors)};
 const fresh=names().filter(n=>!oldNames.includes(n));fs.mkdirSync(path.join(out,'startup'));
 receipt.journals=fresh.map(n=>{const b=fs.readFileSync(path.join(journalRoot,n));fs.writeFileSync(path.join(out,'startup',n),b,{flag:'wx'});return{file:n,bytes:b.length,sha256:hash(b)};});
 assert.equal(result.signal,null);assert.equal(result.code,0);assert.match(raw.toString(),/Mobile and touch \(chromium, webkit; core states\): 21 groups\./u);
 assert.ok(!errors.toString().includes('Mobile startup evidence fault:'));
 receipt.qualified=true;
}catch(error){receipt.failure={name:error.name,message:error.message,stack:error.stack};process.exitCode=1;}
finally{receipt.sourceAfter=source();receipt.sourceUnchanged=JSON.stringify(before)===JSON.stringify(receipt.sourceAfter);try{verify();receipt.boundRuntimeAndAssetsUnchanged=true;}catch(error){receipt.boundRuntimeAndAssetsUnchanged=false;receipt.bindingFailure=String(error);process.exitCode=1;}if(!receipt.sourceUnchanged)process.exitCode=1;persist();console.log(JSON.stringify(receipt));}
