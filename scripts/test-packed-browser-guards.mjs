// Negative integration checks use only disposable browser/consumer artifacts.
// Every changed file is restored even when a guard unexpectedly fails.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const directory=path.join(root,'artifacts/editor');
const manifest=JSON.parse(await readFile(path.join(directory,'packed-browser-manifest.json'),'utf8'));
assert.ok(['packed','registry','registry-libraries'].includes(manifest.mode));
const consumer=path.join(root,'artifacts/npm',manifest.mode==='packed'?'consumer':`${manifest.mode}-consumer`);
const artifactRoot=await realpath(path.join(root,'artifacts'));
const checks=[];
function rejects(mode,message){
  const result=spawnSync(process.execPath,['scripts/test-packed-browser.mjs',mode],{cwd:root,encoding:'utf8',timeout:90000});
  if(result.error)throw result.error;
  assert.notEqual(result.status,0,`Expected rejection: ${message}`);
  assert.ok((result.stderr+result.stdout).includes(message),result.stderr+result.stdout);
  checks.push(message);
}
async function change(file,bytes,message){
  const actual=await realpath(file),relative=path.relative(artifactRoot,actual);
  assert.ok(relative!==''&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Guard fixtures must stay inside artifacts');
  const before=await readFile(actual);
  try{await writeFile(actual,bytes(before));rejects(manifest.mode,message);}
  finally{await writeFile(actual,before);}
  assert.deepEqual(await readFile(actual),before,'Guard fixture must be restored byte-for-byte');
}
rejects(manifest.mode==='packed'?'registry':'packed','Rebuild the requested installed-package harness before testing it');
await change(path.join(consumer,'browser-build-id.json'),()=>JSON.stringify('newer-consumer-build'),'Browser assets are from a stale consumer build');
await change(path.join(consumer,'package-lock.json'),before=>Buffer.concat([before,Buffer.from('\n')]),'Installed dependency lock changed after bundling');
await change(path.join(directory,'fonts.json'),before=>Buffer.concat([before,Buffer.from('\n')]),'Browser asset changed after bundling: fonts.json');
await writeFile(path.join(directory,`packed-browser-${manifest.mode}-guards-node${process.versions.node.split('.')[0]}-report.json`),JSON.stringify({mode:manifest.mode,node:process.version,checks,fixturesRestored:true},null,2)+'\n');
console.log(`PASS ${manifest.mode}: ${checks.length} installed-browser evidence guards; all fixtures restored`);
