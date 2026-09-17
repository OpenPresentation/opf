// Fail closed on changed installed bytes, integrity, source links and loaders.
// Only temporary installation artifacts are touched, then restored.
import assert from 'node:assert/strict';
import {readFile,writeFile,realpath,mkdtemp,mkdir,symlink,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),out=await realpath(path.join(root,'artifacts/npm'));
const registry=process.argv.includes('--registry');
const consumer=await realpath(path.join(out,registry?'registry-consumer':'consumer'));
assert.ok(consumer.startsWith(out+path.sep));
const script=path.join(root,'scripts/test-installed-code.mjs');
const reject=(directory,pattern,env=process.env)=>{
  const result=spawnSync(process.execPath,[script,directory,...(registry?['--registry']:[])],{cwd:root,env,encoding:'utf8'});
  if(result.error)throw result.error;assert.notEqual(result.status,0,'Invalid installation must fail');
  assert.match(result.stderr+result.stdout,pattern);
};
reject(consumer,/must not alias packages with a loader/,{...process.env,NODE_OPTIONS:'--no-warnings'});
const runtime=await realpath(path.join(consumer,'node_modules/@openpresentation/opf/dist/composition.js'));
assert.ok(runtime.startsWith(consumer+path.sep));
const original=await readFile(runtime);
try {await writeFile(runtime,Buffer.concat([original,Buffer.from('\n// stale installation guard\n')]));reject(consumer,registry?/Installed files differ from registry archive/:/Installed runtime differs from the staged package/);}
finally {await writeFile(runtime,original);}
const lockPath=path.join(consumer,'package-lock.json'),lockBytes=await readFile(lockPath),lock=JSON.parse(lockBytes);
try {
  lock.packages['node_modules/@openpresentation/opf'].integrity='sha512-invalid';
  await writeFile(lockPath,JSON.stringify(lock));reject(consumer,registry?/Registry integrity must match the installed lock/:/Candidate integrity must match the installed lock/);
} finally {await writeFile(lockPath,lockBytes);}
const temporary=await mkdtemp(path.join(out,'code-guards-'));
assert.ok((await realpath(temporary)).startsWith(out+path.sep));
try {
  const linked=path.join(temporary,'linked');await mkdir(linked);
  await symlink(await realpath(path.join(consumer,'node_modules')),path.join(linked,'node_modules'),process.platform==='win32'?'junction':'dir');
  reject(linked,/Installed modules must remain inside this consumer/);
} finally {
  // Targets are verified above. rm removes the generated link itself; it does
  // not recurse into its target. No source checkout or user data is removed.
  await rm(temporary,{recursive:true,force:true});
}
assert.deepEqual(await readFile(runtime),original);assert.deepEqual(await readFile(lockPath),lockBytes);
console.log('Installed code guards: runtime drift, wrong integrity, external modules and loader environment rejected; exact artifacts restored.');
