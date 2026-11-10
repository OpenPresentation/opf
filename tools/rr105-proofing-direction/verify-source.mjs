// Office-free identity replay only. No install, worker entrypoint, export or native process.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {derive,sha} from './derive-worker.mjs';
const read=name=>readFileSync(new URL(name,import.meta.url));
const baseline=gunzipSync(read('reference-worker.ps1.gz'));
const generated=derive(baseline),worker=read('worker-package/test/native-furniture-control.ps1');
assert.deepEqual(worker,generated,'Complete worker must equal mechanical derivation');
assert.equal(sha(worker),'51cb21003f058bd401669458e6f0afdd0acd899fdd54c4ee529595a32f5e65b9');
const expected={
 'native-process.ps1':'b9444de1367fe3a3aab654f4787b5aa9a1304dc38360159a45d1f9f420adf69c',
 'native-process-check.ps1':'50ae41cf771dab0e0c9245f3627abc4586451df8414bdc986df882d3ceda5027',
 'native-furniture-harness-check.ps1':'06ac3e49dc2b6973d58357b381f9319d9b2d5f2c9176d6fb6d1bf3fd8a3c650d',
 'fixtures/sh25-native-circle-observations.json':'e8e452a52977f6a76925cfb31c92f8d1340448dd59566193468e616a98322af0',
};
for(const[name,hash]of Object.entries(expected))assert.equal(sha(read('worker-package/test/'+name)),hash,name);
const input=gunzipSync(read('original09.pptx.gz'));
assert.equal(input.length,101027);
assert.equal(sha(input),'4b9d084f5ddccd23f553cc0a030ad8a43bca6e120de89d13cfca34b4163f06e2');
const reference=JSON.parse(gunzipSync(read('reference-native-shapes.json.gz')));
assert.equal(reference.inputSha256,sha(input));assert.equal(reference.rows.length,3);
assert.equal(reference.rows[0].text.length,26);
assert.equal(Buffer.from(reference.rows[0].text,'utf16le').toString('base64'),'RgY1BiAARAYnBioGSgZGBkoGIAAoBkQGOgYpBiAAOQYxBigGSgYpBiAANQYxBkoGLQYpBg==');
assert.ok(!/[\u0080-\uffff]/.test(worker.toString('utf8')),'New PowerShell source must be ASCII-safe on WPS5');
console.log(JSON.stringify({passed:true,workerSha256:sha(worker),mechanicalWorkerExact:true,unchangedSupportFiles:4,original09Bytes:input.length,original09Sha256:sha(input),titleUtf16Units:26,officeConstructed:false,workerEntrypointExecuted:false},null,2));