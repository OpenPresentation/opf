// Verify a same-version linked checkout cannot masquerade as the candidate's registry dependency.
// Usage: node scripts/test-native-candidate-guard.mjs <registry-consumer> <candidate-root>
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, symlink, realpath, rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const consumer = path.resolve(process.argv[2]), candidateRoot = path.resolve(process.argv[3]);
const parent = await realpath(path.resolve('artifacts'));
const fixture = await mkdtemp(path.join(parent, 'native-candidate-guard-'));
const candidateRequire = createRequire(path.join(candidateRoot, 'package.json'));
try {
  await mkdir(path.join(fixture, 'dist'));
  await mkdir(path.join(fixture, 'node_modules/@openpresentation'), {recursive:true});
  await writeFile(path.join(fixture, 'dist/index.js'), 'export {};\n');
  for (const file of ['package.json','package-lock.json']) await writeFile(path.join(fixture,file),await readFile(path.join(candidateRoot,file)));
  const source = await realpath(path.dirname(candidateRequire.resolve('@openpresentation/opf/package.json')));
  const linked = path.join(fixture,'node_modules/@openpresentation/opf');
  await symlink(source, linked, process.platform==='win32'?'junction':'dir');
  const result = spawnSync(process.execPath,[fileURLToPath(new URL('./test-native-feature-matrix.mjs',import.meta.url)),consumer,path.join(fixture,'evidence'),'generate',path.join(fixture,'dist/index.js')],{encoding:'utf8',maxBuffer:2*1024*1024});
  assert.notEqual(result.status,0,'Linked dependency must be rejected');
  assert.match(result.stderr,/Candidate dependencies must resolve inside its installed node_modules/);
  console.log('Candidate guard passed: same-version linked OPF with matching lock integrity is rejected before export.');
} finally {
  const resolved = await realpath(fixture);
  assert.ok(resolved.startsWith(parent+path.sep) && path.basename(resolved).startsWith('native-candidate-guard-'),'Cleanup must stay in the generated fixture');
  await rm(fixture,{recursive:true,force:true});
}
