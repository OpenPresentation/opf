// NEVERMERGE: exact input/identity preparation only. Never invokes PowerShell or Office.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {lane,sha,BASELINE_SHA,HELPERS_SHA} from './derive-worker.mjs';
export const root=path.resolve(lane,'../../../..');
export function plainPath(file) {
  const absolute=path.resolve(file);
  assert(!absolute.startsWith('\\\\'),'Local paths only');
  let current=absolute;
  while(true) { if(fs.existsSync(current))assert(!fs.lstatSync(current).isSymbolicLink(),'Linked path refused: '+current);const parent=path.dirname(current);if(parent===current)break;current=parent; }
  return absolute;
}
export function verifyInputFiles(base,definition) {
  const records=[];
  for(const spec of definition.cases)for(const mode of ['live','native']) {
    const relative=spec[mode].file;
    assert.equal(relative,(mode==='live'?'pptx/':'pptx-shapes/')+spec.id+'.pptx');
    const file=plainPath(path.join(base,relative));
    assert(file.startsWith(path.resolve(base)+path.sep));
    const bytes=fs.readFileSync(file);assert.equal(sha(bytes),spec[mode].sha256,'Exact sealed archive '+spec.id+' '+mode);
    records.push({path:relative,bytes:bytes.length,sha256:sha(bytes)});
  }
  assert.equal(records.length,4);
  return records;
}
export function prepareSuite(output) {
  const target=plainPath(output),parent=plainPath(path.dirname(target));
  assert(fs.statSync(parent).isDirectory());assert(!fs.existsSync(target),'Preserve prior suites');
  const inside=(a,b)=>{const left=process.platform==='win32'?a.toLowerCase():a,right=process.platform==='win32'?b.toLowerCase():b;return left===right||left.startsWith(right+path.sep);};
  assert(!inside(target,root)&&!inside(root,target),'Keep suite outside source worktree');
  const git=(...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim();
  assert.equal(git('status','--porcelain','--untracked-files=normal'),'','Freeze a clean source head first');
  const definition=JSON.parse(fs.readFileSync(path.join(lane,'inputs.json'),'utf8'));
  const source=plainPath(path.join(root,definition.sourcePacket));
  const records=verifyInputFiles(source,definition);
  const helpers=gunzipSync(fs.readFileSync(path.join(lane,'reference-helpers.ps1.gz')));assert.equal(sha(helpers),HELPERS_SHA);
  const worker=fs.readFileSync(path.join(lane,'observer-worker.ps1'));
  const manifest={...definition,scope:'Predeclared failure-observation diagnostic; first-count guard preserved. No Office run or live eligibility.',sourceHead:git('rev-parse','HEAD'),files:records,sourceIdentity:{workerPath:path.join(lane,'observer-worker.ps1'),workerSha256:sha(worker),executedBaselineSha256:BASELINE_SHA,nativeHelpersSha256:HELPERS_SHA},nativeAuthorized:false,nativeRun:false};
  fs.mkdirSync(target);
  for(const record of records) {const to=path.join(target,record.path);fs.mkdirSync(path.dirname(to),{recursive:true});fs.writeFileSync(to,fs.readFileSync(path.join(source,record.path)),{flag:'wx'});}
  fs.writeFileSync(path.join(target,'native-helpers.ps1'),helpers,{flag:'wx'});
  const oldMeta=JSON.parse(fs.readFileSync(path.join(source,'meta.json'),'utf8'));
  const meta=Object.fromEntries(Object.entries(oldMeta).filter(([key])=>key==='venn-1-1'||key==='venn-2-1'));
  fs.writeFileSync(path.join(target,'meta.json'),JSON.stringify(meta,null,2)+'\n',{flag:'wx'});
  // The unchanged helper also retains matching preview controls. Never rerender them.
  for(const spec of definition.cases) {const rel='preview/'+spec.id+'-1.png';const from=plainPath(path.join(source,rel));const b=fs.readFileSync(from);fs.mkdirSync(path.join(target,'preview'),{recursive:true});fs.writeFileSync(path.join(target,rel),b,{flag:'wx'});manifest.files.push({path:rel,bytes:b.length,sha256:sha(b)});}
  fs.writeFileSync(path.join(target,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  return {suite:target,sourceHead:manifest.sourceHead,manifestSha256:sha(fs.readFileSync(path.join(target,'manifest.json'))),workerSha256:sha(worker),nativeAuthorized:false,nativeRun:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {assert.equal(process.argv.length,3,'One fresh external output path required');console.log(JSON.stringify(prepareSuite(process.argv[2]),null,2));}
