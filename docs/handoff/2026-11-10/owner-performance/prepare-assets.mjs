// Run the maintained split-font builder once, with readonly input tracing in its
// owned child. Nothing here starts a benchmark or alters product/build output.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {captureBinding, verifyBinding, verifyFiles, inventory, fileRecord, folder, sha256, compilerRecords} from './bindings.mjs';

const root = process.cwd();
const out = path.resolve(process.argv.find(arg => arg.startsWith('--out='))?.slice(6) ?? 'artifacts/owner-current-assets-01');
const relative = path.relative(root, out);
assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative) && !fs.existsSync(out), 'Fresh owned assets required');
const compiler = compilerRecords(root), before = captureBinding(root, compiler);
fs.mkdirSync(out, {recursive: true});
const traceFile = out + '.inputs.jsonl'; assert.ok(!fs.existsSync(traceFile));
fs.writeFileSync(traceFile, '', {flag: 'wx'});
const tracer = path.join(folder, 'trace-asset-inputs.mjs');
const command = ['--import', pathToFileURL(tracer).href, 'packages/editor/scripts/build-playground.mjs', '--split-fonts'];
const result = execFileSync(process.execPath, command, {cwd: root, env: {...process.env, OPF_PLAYGROUND_OUT: out, OPF_PLAYGROUND_SPLIT_FONTS: '1', OPF_OWNER_ASSET_TRACE: traceFile}, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit']});
verifyBinding(root, before);
verifyFiles(root, compiler);
const traced = fs.readFileSync(traceFile, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
const inputs = traced.map(item => {const record = fileRecord(root, item.file); assert.equal(record.sha256, item.sha256); assert.equal(record.bytes, item.bytes); return record;});
verifyFiles(root, inputs);
const binding = captureBinding(root, [...inputs, ...compiler]), outputs = inventory(root, out);
const receipt = {
  scope: 'MAINTAINED_ASSET_PREPARATION_NOT_BROWSER_QUALIFICATION', binding, command, tracer: fileRecord(root, tracer),
  maintainedBuilder: fileRecord(root, 'packages/editor/scripts/build-playground.mjs'), compiler, inputs, trace: fileRecord(root, traceFile), outputs,
  terminal: {exitCode: 0, stderr: 'Inherited by the actual parent execution log, not silently discarded'}, stdout: {bytes: result.length, sha256: sha256(result)},
  coverage: 'Actual Node module/read/copy inputs are bound. All prepared outputs are inventoried. Native esbuild internally reads the unused playground/demo JavaScript graphs outside this Node trace; those unserved JavaScript outputs are not qualified by this receipt. The separately built current harness binds its actual esbuild input graph. Only assets actually served by the later browser run receive browser-use evidence.',
};
fs.writeFileSync(path.join(out, 'asset-receipt.json'), JSON.stringify(receipt, null, 2) + '\n', {flag: 'wx'});
process.stdout.write(result); console.log(JSON.stringify({scope: receipt.scope, inputs: inputs.length, outputs: outputs.length, out}));
