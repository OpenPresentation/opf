import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const root = process.cwd();
const own = path.join(root, 'docs/handoff/2026-11-09/svg-performance');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const {BUNDLED_FONT_MANIFEST} = await import(pathToFileURL(path.join(root, 'packages/render/src/font-manifest.js')));
const manifest = JSON.parse(fs.readFileSync(path.join(own, 'server-baseline-01.manifest.json')));
const archive = fs.readFileSync(path.join(own, manifest.archive));
assert.equal(hash(archive), manifest.sha256);
const files = JSON.parse(gunzipSync(archive)).files;
const result = mode => {
  const name = 'results/server-baseline-01/36-' + mode + '.json';
  const member = files.find(file => file.file === name);
  const bytes = Buffer.from(member.data, 'base64');
  assert.equal(hash(bytes), manifest.files.find(file => file.file === name).sha256);
  const record = JSON.parse(bytes);
  assert.equal(record.status, 'PASS');
  return {
    mode, fontLoadMs: record.fontMs, setupAfterGc: record.setupMemory,
    firstRender: record.samples[0].afterRender,
    renderPeakRssBytes: Math.max(...record.samples.map(sample => sample.afterRender.peakRssBytes)),
    finalAfterGc: record.finalMemory,
  };
};
const selected = BUNDLED_FONT_MANIFEST.packages.filter(item => ['office', 'open', 'base'].includes(item.pack) || item.name === '@expo-google-fonts/noto-sans');
const groups = ['office', 'open', 'base', 'scripts'].map(pack => ({
  pack, packages: selected.filter(item => item.pack === pack).map(item => item.name),
  faces: selected.filter(item => item.pack === pack).reduce((sum, item) => sum + item.faces.length, 0),
}));
assert.deepEqual(groups.map(group => group.faces), [40, 78, 9, 4]);
const sources = ['packages/render/src/fonts-node.js', 'packages/render/src/font-registry.js', 'packages/render/src/font-manifest.js'].map(file => ({file, sha256: hash(fs.readFileSync(path.join(root, file)))}));
const report = {
  schema: 1, runtimeSource: '58e0d7939fc318119f5f81a8ba1455bbfab7f1cd',
  method: 'Read-only derivation from archived formal cases and the exact baseline source; no benchmark rerun.',
  fontSelection: {options: {pack: 'office', substitutionPolicy: 'visual'}, groups, totalFaces: groups.reduce((sum, group) => sum + group.faces, 0)},
  cases: [result('batch-fonts'), result('batch-system')], sources,
  limitations: [
    'Process RSS is not font-only allocation. Setup includes imported modules, the font registry, and shaping/subset engines.',
    'The formal run did not capture a same-process checkpoint immediately before font loading, so it cannot isolate the font-loader RSS delta.',
    'arrayBuffers is included within external; memory counters must not be added together.',
    'Both cases load the same font pack; batch-system skips font embedding, not font measurement or loading.',
    'Separate sequential cases establish an observed difference, not an exact causal allocation breakdown.',
    'No physical-mobile, isolated-cloud-worker or production optimization claim.',
  ],
};
const target = path.join(own, 'font-memory-audit.json');
const bytes = JSON.stringify(report, null, 2) + '\n';
if (process.argv.includes('--write')) fs.writeFileSync(target, bytes);
else assert.deepEqual(JSON.parse(fs.readFileSync(target)), report);
console.log(JSON.stringify({status: 'PASS', totalFaces: report.fontSelection.totalFaces, cases: report.cases.length, verifyOnly: !process.argv.includes('--write')}));
