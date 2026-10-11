// Published runtime with explicitly reported reviewed-plan metadata and a narrowly pinned test-tooling bridge.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,lstatSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readRegularJson,publishedGalleryControl} from './candidate-gallery.mjs';
const regularBytes=file=>{const absolute=path.resolve(file);assert.equal(realpathSync(absolute),absolute,'aliased test-tooling file');assert.ok(lstatSync(absolute).isFile(),'nonregular test-tooling file');return readFileSync(absolute);};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const BRIDGE_PATH='scripts/lazy-font-counts.mjs';
export const FONT_COUNT_BRIDGE=Object.freeze({sourceSha:'382ae0102335f536131a6e3659761f8a5240fe4d',originalSha256:'036291922645b9cf0e25e40b4b8dc31ed6d98098b275f3bbfbd00fb34aa7eabb',reviewedSha256:'4bd224521620e8036af161c4e14338d0868019a2dbee36b33fdec9a539ba1b1c'});
const git=(root,...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim();
export function stagePublishedControlPlan({toolsRoot,coreRoot}){
  const target=path.join(coreRoot,'release-plan.json'),source=path.join(toolsRoot,'release-plan.json');
  const reviewed=readRegularJson(source),original=readRegularJson(target);
  assert.equal(git(coreRoot,'ls-files','--others','--exclude-standard'),'','published source must contain no untracked source files');
  assert.equal(git(coreRoot,'diff','--name-only','HEAD'),'','published source must be clean before metadata staging');
  const originalBytes=readFileSync(target),reviewedBytes=readFileSync(source);
  const record={qualification:'published source/harness with reviewed registry-plan metadata; not an unchanged checkout',sourceSha:git(coreRoot,'rev-parse','HEAD'),originalPlan:original,reviewedPlan:reviewed,originalSha256:digest(originalBytes),reviewedSha256:digest(reviewedBytes)};
  mkdirSync(path.join(coreRoot,'artifacts/published-control'),{recursive:true});
  writeFileSync(path.join(coreRoot,'artifacts/published-control/original-release-plan.json'),originalBytes);
  writeFileSync(path.join(coreRoot,'artifacts/published-control/metadata.json'),`${JSON.stringify(record,null,2)}\n`);
  const renderer=reviewed.packages?.find(item=>item.name==='@openpresentation/opf-render')?.version;
  if(renderer==='0.18.2'){
    const helper=path.join(coreRoot,BRIDGE_PATH),originalHelper=regularBytes(helper);
    if(digest(originalHelper)!==FONT_COUNT_BRIDGE.reviewedSha256){
      assert.equal(digest(originalHelper),FONT_COUNT_BRIDGE.originalSha256,'published test helper differs from the known original');
      const reviewedHelper=execFileSync('git',['-C',toolsRoot,'show',`${FONT_COUNT_BRIDGE.sourceSha}:${BRIDGE_PATH}`]);
      assert.equal(digest(reviewedHelper),FONT_COUNT_BRIDGE.reviewedSha256,'pinned test helper differs from reviewed bytes');
      writeFileSync(path.join(coreRoot,'artifacts/published-control/original-lazy-font-counts.mjs'),originalHelper);
      writeFileSync(helper,reviewedHelper);
      record.testToolingBridge={path:BRIDGE_PATH,...FONT_COUNT_BRIDGE};
      record.qualification='published runtime with reviewed registry-plan metadata and recorded pinned test-tooling bridge; not pristine source';
    }
  }
  writeFileSync(path.join(coreRoot,'artifacts/published-control/metadata.json'),`${JSON.stringify(record,null,2)}\n`);
  writeFileSync(target,reviewedBytes);
  return record;
}
export function verifyPublishedControlPlan({toolsRoot,coreRoot}){
  const record=readRegularJson(path.join(coreRoot,'artifacts/published-control/metadata.json'));
  const target=path.join(coreRoot,'release-plan.json'),source=path.join(toolsRoot,'release-plan.json');
  assert.equal(git(coreRoot,'rev-parse','HEAD'),record.sourceSha);
  assert.equal(digest(readFileSync(target)),record.reviewedSha256);
  assert.equal(digest(readFileSync(source)),record.reviewedSha256);
  assert.equal(digest(execFileSync('git',['-C',coreRoot,'show','HEAD:release-plan.json'])),record.originalSha256);
  assert.equal(digest(readFileSync(path.join(coreRoot,'artifacts/published-control/original-release-plan.json'))),record.originalSha256);
  assert.deepEqual(readRegularJson(target),record.reviewedPlan);
  assert.equal(git(coreRoot,'ls-files','--others','--exclude-standard'),'','published control contains untracked source files');
  const allowed=['release-plan.json'];
  if(record.testToolingBridge){
    assert.deepEqual(record.testToolingBridge,{path:BRIDGE_PATH,...FONT_COUNT_BRIDGE},'unknown test-tooling override');
    assert.equal(record.reviewedPlan.packages.find(item=>item.name==='@openpresentation/opf-render').version,'0.18.2');
    assert.equal(digest(execFileSync('git',['-C',coreRoot,'show',`HEAD:${BRIDGE_PATH}`])),FONT_COUNT_BRIDGE.originalSha256,'original helper identity changed');
    assert.equal(digest(regularBytes(path.join(coreRoot,'artifacts/published-control/original-lazy-font-counts.mjs'))),FONT_COUNT_BRIDGE.originalSha256);
    assert.equal(digest(regularBytes(path.join(coreRoot,BRIDGE_PATH))),FONT_COUNT_BRIDGE.reviewedSha256,'bridged helper identity changed');
    assert.equal(digest(execFileSync('git',['-C',toolsRoot,'show',`${FONT_COUNT_BRIDGE.sourceSha}:${BRIDGE_PATH}`])),FONT_COUNT_BRIDGE.reviewedSha256);
    allowed.push(BRIDGE_PATH);
  }
  const files=git(coreRoot,'diff','--name-only','HEAD').split('\n').filter(Boolean);
  assert.ok(files.every(file=>allowed.includes(file)),'published control altered source outside its exact metadata/tooling override');
  return record;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [command,toolsRoot,coreRoot]=process.argv.slice(2);
  assert.ok(['stage','verify'].includes(command));
  if(command==='stage')await publishedGalleryControl(readRegularJson(path.join(toolsRoot,'release-plan.json')));
  console.log(JSON.stringify((command==='stage'?stagePublishedControlPlan:verifyPublishedControlPlan)({toolsRoot,coreRoot}),null,2));
}
