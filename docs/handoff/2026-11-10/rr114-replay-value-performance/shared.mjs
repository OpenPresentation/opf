import {readFileSync,readdirSync,statSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';import {join,relative,sep} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
import {RUNTIMES,INPUT_ROOT,COPY_NAMES,CANDIDATE_COPY_NAMES,REPLAY_DELTA} from './config.mjs';
export const sha=value=>createHash('sha256').update(value).digest('hex');
export const git=(root,...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim();
export const normalized=(root,file)=>relative(root,file).split(sep).join('/');
export function walk(directory){const files=[];for(const name of readdirSync(directory).sort()){const path=join(directory,name);if(statSync(path).isDirectory())files.push(...walk(path));else files.push(path);}return files;}
// Exact filesystem assets read by fonts-node HARFBUZZ; no JavaScript import is needed.
export function describeBackendAssets(root){
 const fontSource=readFileSync(join(root,'packages/render/src/fonts-node.js'),'utf8'),require=createRequire(pathToFileURL(join(root,'packages/render/dist/fonts-node.js')));
 return ['harfbuzzjs/dist/harfbuzz-subset.wasm','harfbuzzjs/dist/harfbuzz.wasm'].map(specifier=>{
  assert.ok(fontSource.includes(JSON.stringify(specifier)),'source-bound HARFBUZZ specifier');
  const file=realpathSync(require.resolve(specifier)),data=readFileSync(file);return{specifier,file:normalized(root,file),bytes:data.length,sha256:sha(data)};
 });
}
export function describeRuntime(name){
 const runtime=RUNTIMES[name];assert.ok(runtime,name);assert.equal(git(runtime.root,'rev-parse','HEAD'),runtime.head,name+' exact head');
 assert.equal(git(runtime.root,'status','--porcelain','--untracked-files=normal'),'','clean product '+name);
 assert.equal(git(runtime.root,'diff','--name-only',runtime.runtime,runtime.head,'--','packages','spec','pnpm-lock.yaml','pnpm-workspace.yaml'),'','runtime source alias '+name);
 const copies=[...COPY_NAMES,...(name==='candidate'?CANDIDATE_COPY_NAMES:[])].map(file=>{const source=readFileSync(join(runtime.root,'packages/render/src',file)),built=readFileSync(join(runtime.root,'packages/render/dist',file));assert.equal(sha(source),sha(built),name+' normal copied module '+file);return{file,bytes:built.length,sha256:sha(built)};});
 const built=[];for(const packageName of ['javascript','gallery','render'])for(const file of walk(join(runtime.root,'packages',packageName,'dist')).filter(file=>/\.(?:js|mjs|cjs|json|wasm)$/.test(file))){const data=readFileSync(file);built.push({file:normalized(runtime.root,file),bytes:data.length,sha256:sha(data)});}
 return {...runtime,tree:git(runtime.root,'rev-parse','HEAD^{tree}'),runtimeTree:git(runtime.root,'rev-parse',runtime.runtime+'^{tree}'),lockSha256:sha(readFileSync(join(runtime.root,'pnpm-lock.yaml'))),workspaceSha256:sha(readFileSync(join(runtime.root,'pnpm-workspace.yaml'))),backendAssets:describeBackendAssets(runtime.root),copies,built};
}
export function describeInputs(){const manifestBytes=readFileSync(join(INPUT_ROOT,'manifest.json')),manifest=JSON.parse(manifestBytes);return{manifestSha256:sha(manifestBytes),files:[['original',16,'original-16.opf.json'],['extended',36,'extended-36.opf.json'],['stress',48,'stress-48.opf.json']].map(([key,size,name])=>{const data=readFileSync(join(INPUT_ROOT,name));assert.equal(sha(data),manifest[key].sha256,name);assert.equal(data.length,manifest[key].bytes);assert.equal(JSON.parse(data).slides.length,size);return{size,name,bytes:data.length,sha256:sha(data)};})};}
export function preflight(){
 assert.match(process.version,/^v24\./,'pinned Node24');const control=describeRuntime('control'),candidate=describeRuntime('candidate');
 assert.equal(control.lockSha256,candidate.lockSha256);assert.equal(control.workspaceSha256,candidate.workspaceSha256);assert.deepEqual(control.backendAssets,candidate.backendAssets,'same source-bound WASM assets');
 assert.equal(git(candidate.root,'diff','--name-only',control.head,candidate.head,'--','packages/javascript','packages/gallery','spec','pnpm-lock.yaml','pnpm-workspace.yaml'),'','shared source graphs');
 const delta=git(candidate.root,'diff','--name-only',control.head,candidate.head,'--','packages/render/src').split('\n').filter(Boolean).sort();assert.deepEqual(delta,REPLAY_DELTA,'only approved replay source delta');
 const allowed=new Set(REPLAY_DELTA.map(file=>file.replace('/src/','/dist/'))),left=new Map(control.built.map(row=>[row.file,row]));
 for(const row of candidate.built){const old=left.get(row.file);if(allowed.has(row.file)){if(old)assert.notEqual(row.sha256,old.sha256,'changed approved module');}else{assert.ok(old,'unexpected added built module '+row.file);assert.equal(row.sha256,old.sha256,'shared built identity '+row.file);}left.delete(row.file);}
 assert.equal(left.size,0,'no removed built modules');
 const root=fileURLToPath(new URL('../../../../',import.meta.url));assert.equal(git(root,'status','--porcelain','--untracked-files=normal'),'','clean entire driver worktree');const driverFiles=['config.mjs','shared.mjs','preflight.mjs','case.mjs','run.mjs','derive-input.mjs','input-proof.mjs','driver-authority.json'].map(name=>({name,sha256:sha(readFileSync(new URL(name,import.meta.url)))}));
 return{schema:1,kind:'source-only-preflight',node:process.version,nodeExecutable:realpathSync(process.execPath),nodeExecutableSha256:sha(readFileSync(process.execPath)),driverSourceHead:git(root,'rev-parse','HEAD'),driverSourceTree:git(root,'rev-parse','HEAD^{tree}'),driverFiles,runtimes:{control,candidate},inputs:describeInputs()};
}
export function assertRuntimeStable(expected){const actual=describeRuntime(expected===undefined?'control':expected.name);assert.deepEqual(actual,expected.runtime);}
