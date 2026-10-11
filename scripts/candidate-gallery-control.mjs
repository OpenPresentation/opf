// Published source and harness, with one explicitly reported reviewed-plan metadata override.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readRegularJson,publishedGalleryControl} from './candidate-gallery.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
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
  const files=git(coreRoot,'diff','--name-only','HEAD');
  assert.ok(files===''||files==='release-plan.json','published control altered source outside its exact metadata override');
  return record;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [command,toolsRoot,coreRoot]=process.argv.slice(2);
  assert.ok(['stage','verify'].includes(command));
  if(command==='stage')await publishedGalleryControl(readRegularJson(path.join(toolsRoot,'release-plan.json')));
  console.log(JSON.stringify((command==='stage'?stagePublishedControlPlan:verifyPublishedControlPlan)({toolsRoot,coreRoot}),null,2));
}
