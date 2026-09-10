// Prepare the existing Windows PowerPoint code workflow against verified local
// tarballs. Run the printed commands on Windows; PowerPoint is test-only.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),out=await realpath(path.join(root,'artifacts/npm'));
const report=JSON.parse(await readFile(path.join(root,'artifacts/editor/installed-code-summary.json'),'utf8'));
assert.equal(report.mode,'candidate-tarballs');
const consumer=await realpath(path.resolve(root,report.consumer));assert.ok(consumer.startsWith(out+path.sep));
const modules=await realpath(path.join(consumer,'node_modules'));assert.ok(modules.startsWith(consumer+path.sep));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(await readFile(path.join(consumer,'package-lock.json'))),report.lockSha256);
for(const [file,expected] of Object.entries(report.runtime)) {
  const actual=await realpath(path.join(modules,file));assert.ok(actual.startsWith(modules+path.sep));
  assert.equal(hash(await readFile(actual)),expected,'Installed native inputs must match the executed candidate workflow');
}
const sourceRoot=path.resolve(root,'..','opf-pptx'),test=path.join(consumer,'test');
await mkdir(test,{recursive:true});assert.ok((await realpath(test)).startsWith(consumer+path.sep));
const source=await readFile(path.join(sourceRoot,'test/native-code.mjs'),'utf8');
const adapted=source.replace("from '../dist/index.js'","from '@openpresentation/opf-pptx'")
  .replace("'vendor/pptxgenjs/pptxgen.es.js'","'node_modules/@openpresentation/opf-pptx/vendor/pptxgenjs/pptxgen.es.js'");
const native=await readFile(path.join(sourceRoot,'test/native-code.ps1'));
await writeFile(path.join(test,'native-code.mjs'),adapted);await writeFile(path.join(test,'native-code.ps1'),native);
const preparation={mode:report.mode,consumer:report.consumer,lockSha256:report.lockSha256,packages:report.packages,sourceHarnessSha256:hash(source),executedHarnessSha256:hash(adapted),powerShellHarnessSha256:hash(native),runtime:report.runtime};
await writeFile(path.join(test,'native-code-preparation.json'),JSON.stringify(preparation,null,2)+'\n');
console.log('Run from the verified consumer directory: '+consumer);
console.log('node test/native-code.mjs generate artifacts/native-code');
console.log('& test/native-code.ps1 -EvidenceDirectory artifacts/native-code');
console.log('node test/native-code.mjs compare artifacts/native-code');
