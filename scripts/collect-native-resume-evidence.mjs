import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const core=fileURLToPath(new URL('../',import.meta.url)),base=path.resolve(core,'..'),input=path.resolve(process.argv[2]??path.join(base,'native-resume-checks'));
const output=path.join(core,'docs/evidence/native-resume'),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async file=>JSON.parse((await readFile(path.join(input,file),'utf8')).replace(/^\uFEFF/,''));
const folders=['chart-node24','chart-indexed-node24','metric-node24','text-final-node20','text-final-node24','chart-bounded-node20','chart-bounded-node24','worker-controls'];
const chart=await json('chart-indexed-node24/partial-comparison.json');
assert.equal(chart.imports.length,16);assert.equal(chart.rasters.length,8);
const generation=await json('chart-indexed-node24/generation.json');
assert.equal(chart.generationSha256,hash(await readFile(path.join(input,'chart-indexed-node24/generation.json'))));
for(const record of chart.imports)assert.equal(record.sha256,hash(await readFile(path.join(input,'chart-indexed-node24',record.file))));
for(const record of chart.rasters)for(const phase of ['original','reopened'])assert.equal(record[phase+'Sha256'],hash(await readFile(path.join(input,'chart-indexed-node24',`${phase}-${record.slide}.png`))));
for(const file of ['native-chart-colors.mjs','native-chart-colors.ps1'])assert.equal(generation.runtime['test/'+file],hash(await readFile(path.join(input,'chart-indexed-node24/verifiers',file))));
assert.equal(chart.verifierSha256,hash(await readFile(path.join(input,'chart-indexed-node24/verifiers/check-native-resume-partial.mjs'))));
const registrations=await json('text-final-node24/font-registration.json');assert.equal(registrations.length,4);assert.ok(registrations.every(face=>face.added===1&&face.removed));
const text20=await json('text-final-node20/generation.json'),text24=await json('text-final-node24/generation.json');
assert.deepEqual(text20.fonts,text24.fonts);assert.deepEqual(text20.runtime,text24.runtime);
assert.deepEqual(text20.records,text24.records,'Pinned Node versions produce identical native text bytes and geometry');
assert.equal(text24.records.length,24);
for(const folder of ['text-final-node20','text-final-node24']) {
  const manifest=await json(folder+'/generation.json');
  assert.equal(manifest.reportSha256,hash(await readFile(path.join(input,folder,'report.json'))));
  for(const record of manifest.records)assert.equal(record.sha256,hash(await readFile(path.join(input,folder,record.file))));
  for(const face of manifest.fonts)assert.equal(face.sha256,hash(await readFile(path.join(input,folder,face.file))));
}
const controls=await json('worker-controls/report.json');assert.deepEqual(controls.map(test=>test.case),['success','failure','timeout']);assert.ok(controls.every(test=>test.passed));
const sources=Object.fromEntries(['opf','opf-render','opf-pptx','opf-editor'].map(name=>[name,{branch:'codex/shared-metric-integration-20260910',commit:execFileSync('git',['rev-parse','HEAD'],{cwd:path.join(base,name),encoding:'utf8'}).trim()}]));
await mkdir(output,{recursive:true});const artifacts=[];
async function copy(relative) {
  const source=path.join(input,relative),target=path.join(output,relative);await mkdir(path.dirname(target),{recursive:true});
  const bytes=await readFile(source);await copyFile(source,target);assert.equal(hash(await readFile(target)),hash(bytes));
  artifacts.push({path:relative.replaceAll('\\','/'),bytes:bytes.length,sha256:hash(bytes)});
}
async function visit(relative) {for(const item of await readdir(path.join(input,relative),{withFileTypes:true})) {if(item.name.startsWith('~$'))continue;const child=path.join(relative,item.name);if(item.isDirectory())await visit(child);else await copy(child);}}
for(const folder of folders)await visit(folder);
for(const file of ['github-audit.json','office-dialog.png','environment.json','coordinated-ci.json'])await copy(file);
await mkdir(path.join(output,'verifiers'),{recursive:true});
for(const file of ['native-text.mjs','native-text.ps1','accepted-text.mjs','native-chart-colors.mjs','native-chart-colors.ps1','native-process.ps1','native-process-check.ps1']) {
  const bytes=await readFile(path.join(base,'opf-pptx/test',file)),relative='verifiers/'+file;
  await writeFile(path.join(output,relative),bytes);artifacts.push({path:relative,bytes:bytes.length,sha256:hash(bytes)});
}
const summary={sources,chartExecutionSource:'0e3b58fb7a91a6f29f52ce2338f2cc91b4f803dc',scope:'Unpublished native test/harness milestone only. No product runtime, package version, approved baseline or public deployment changes.',
  chart:{dataImports:16,nativeSaveReopenRasterPairs:8,fullEditGate:'incomplete: second ChartData.Activate stalled',nativeTextGate:'not run'},
  text:{fixturesPerNode:24,nodeVersions:[text20.node,text24.node],identicalBytesAndGeometry:true,fontRegistrations:4,allOwnedRegistrationsRemoved:true,nativeApplicationRun:false},
  workerControls:controls,remaining:'The original chart helper and its blocked status/cleanup helper were explicitly terminated. Office processes were not stopped; generated-file cleanup completion is unknown. The user supplied the Excel-dialog/editing-mode warning. Do not retry Office until that interaction is resolved. Existing metric tab/ink, general layout/font, review/release/registry/public and native-platform gates remain open.',
  artifactCount:artifacts.length,bytes:artifacts.reduce((n,item)=>n+item.bytes,0),artifacts:artifacts.sort((a,b)=>a.path.localeCompare(b.path))};
await writeFile(path.join(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({artifacts:summary.artifactCount,bytes:summary.bytes,chart:summary.chart,text:summary.text}));
