// Builtins-only receipt/refusal checks. No product import, build or browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {captureBinding, verifyBinding, verifyFiles, fileRecord, measuredInputs, folder} from './bindings.mjs';

const root = process.cwd(), out = path.resolve(process.argv.find(arg => arg.startsWith('--out='))?.slice(6) ?? 'artifacts/owner-bindings-pure-01');
assert.ok(!fs.existsSync(out)); fs.mkdirSync(out, {recursive: true});
const checks = [];
const binding = captureBinding(root);
verifyBinding(root, binding); checks.push('Exact source/manifest/driver/Node binding passes');
for (const suffix of ['build-current.mjs', 'run-current.mjs', 'current-browser-entry.mjs', 'bindings.mjs', 'pnpm-lock.yaml', 'package.json']) {
  const changed = structuredClone(binding), target = changed.manifestsAndDrivers.find(record => record.path === suffix || record.path.endsWith('/' + suffix));
  assert.ok(target, suffix); target.sha256 = '0'.repeat(64);
  assert.throws(() => verifyBinding(root, changed)); checks.push('Reject altered binding for ' + suffix);
}
const changedManifest = structuredClone(binding); changedManifest.sourceManifest.sha256 = '0'.repeat(64);
assert.throws(() => verifyBinding(root, changedManifest)); checks.push('Reject changed source-manifest identity');
for (const role of ['asset-input', 'asset-output']) {
  const file = path.join(out, role); fs.writeFileSync(file, role);
  const record = fileRecord(root, file); fs.appendFileSync(file, 'changed');
  assert.throws(() => verifyFiles(root, [record])); checks.push('Reject changed ' + role + ' bytes');
}
const projection = path.join(root, 'artifacts/owner-projection-reviewed-ed51-01/proposal.json');
const raw = path.join(root, 'artifacts/owner-performance-inputs');
const measured = measuredInputs(root, raw, projection);
assert.equal(measured.admission.scope, 'ROOT_REVIEWED_TYPED_PROJECTION');
assert.deepEqual(measured.admission.changes.map(item => item.changes.length), [31, 59]);
verifyFiles(root, measured.inputFiles); checks.push('Explicit reviewed projection pins/inverse/datasets/first16/raw preservation pass');
const altered = JSON.parse(fs.readFileSync(projection)); altered.inputs[0].changes[0].before = 'right';
const alteredReceipt = path.join(out, 'altered-projection.json'); fs.writeFileSync(alteredReceipt, JSON.stringify(altered));
// Correct projected files are copied beside the altered receipt, so this refusal
// exercises the inverse rather than a missing-file setup error.
for (const name of ['original-16', 'extended-36']) fs.copyFileSync(path.join(path.dirname(projection), name + '.proposed.opf.json'), path.join(out, name + '.proposed.opf.json'));
assert.throws(() => measuredInputs(root, raw, alteredReceipt), /Whole typed inverse/); checks.push('Reject altered typed inverse receipt');
const trace = path.join(out, 'trace.jsonl'), input = path.join(out, 'trace-input.txt'), copied = path.join(out, 'trace-copy.txt'), entry = path.join(out, 'trace-entry.mjs');
fs.writeFileSync(trace, ''); fs.writeFileSync(input, 'Exact Unicode 日本語 🙂');
fs.writeFileSync(entry, "import fs from 'node:fs';import{readFile,copyFile}from'node:fs/promises';const input=process.argv[2],copy=process.argv[3];const a=fs.readFileSync(input,'utf8'),b=await readFile(input,'utf8');if(a!==b)throw Error('read changed');await copyFile(input,copy);");
execFileSync(process.execPath, ['--import', pathToFileURL(path.join(folder, 'trace-asset-inputs.mjs')).href, entry, input, copied], {cwd: root, env: {...process.env, OPF_OWNER_ASSET_TRACE: trace}});
assert.deepEqual(fs.readFileSync(copied), fs.readFileSync(input));
const rows = fs.readFileSync(trace, 'utf8').trim().split('\n').map(line => JSON.parse(line));
assert.ok(rows.some(row => row.file === entry && row.cause === 'module-resolve'));
assert.ok(rows.some(row => row.file === input));
for (const row of rows) assert.equal(fileRecord(root, row.file).sha256, row.sha256);
checks.push('Actual owned Node tracer preserves read/copy bytes and binds imported module plus data input');
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({scope: 'BUILTINS_ONLY_NOT_PRODUCT_BUILD_OR_BROWSER', checks, node: process.version, productBuilds: 0, browsers: 0}, null, 2) + '\n');
console.log(JSON.stringify({passed: checks.length, checks, out}));
