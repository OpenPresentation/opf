// Recover the actual owner inputs from their immutable Git objects. Never
// synthesize another document and label it the original private workload.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const source = '4d1ffa78440c47d955d9883575d347996325bf40';
const inputPath = 'docs/handoff/2026-11-09/svg-performance/inputs/';
const manifest = JSON.parse(readFileSync(new URL('input-manifest.json', import.meta.url)));
const root = process.cwd();
const out = path.resolve(root, process.argv.find(arg => arg.startsWith('--out='))?.slice(6) ?? 'artifacts/owner-performance-inputs');
const relative = path.relative(root, out);
assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative) && !existsSync(out), 'A fresh owned output directory is required');
const reports = [], documents = [];
for (const [name, key] of [['original-16', 'original'], ['extended-36', 'extended']]) {
  const file = inputPath + name + '.opf.json';
  const bytes = execFileSync('git', ['show', source + ':' + file], {maxBuffer: 1024 * 1024});
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  assert.equal(bytes.length, manifest[key].bytes);
  assert.equal(sha256, manifest[key].sha256);
  const document = JSON.parse(bytes);
  assert.equal(document.slides.length, manifest[key].slides);
  documents.push(document);
  reports.push({file: name + '.opf.json', bytes, receipt: {source, gitPath: file, bytes: bytes.length, sha256, slides: document.slides.length}});
}
assert.deepEqual(documents[1].slides.slice(0, 16), documents[0].slides);
assert.equal(documents[1].slides.length - documents[0].slides.length, 20);
mkdirSync(out, {recursive: true});
for (const report of reports) writeFileSync(path.join(out, report.file), report.bytes, {flag: 'wx'});
const receipt = {scope: 'EXACT_INPUT_RECOVERY_ONLY_NOT_BENCHMARK', firstSixteenSlideObjectsUnchanged: true, exactlyTwentyAdded: true, inputs: reports.map(report => report.receipt)};
writeFileSync(path.join(out, 'input-recovery.json'), JSON.stringify(receipt, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify(receipt));
