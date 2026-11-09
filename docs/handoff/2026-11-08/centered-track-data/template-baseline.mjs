import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {gzipSync} from 'node:zlib';
import {layouts, sampleSlide} from '../../../../packages/javascript/test/support/template-samples.mjs';
import {composeSlide as compiledCurrent} from '../../../../packages/javascript/dist/composition.js';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const out = fileURLToPath(new URL('./', import.meta.url));
const baseline = '67dd9ec10b7019cb95807f59c75186482c800f10';
const candidate = '37eb56ce26a873aed6b86255e4d042384099f8bf';
const source = 'packages/javascript/src/composition.ts';
const require = createRequire(new URL('../../../../packages/javascript/package.json', import.meta.url));
const {build} = createRequire(require.resolve('tsup/package.json'))('esbuild');
const hash = value => createHash('sha256').update(value).digest('hex');
const git = args => execFileSync('git', args, {cwd: root, maxBuffer: 16 * 1024 * 1024});
const changedCore = git(['diff', '--name-only', baseline, candidate, '--', 'packages/javascript/src']).toString().trim().split(/\r?\n/);
assert.deepEqual(changedCore, [source]);
const scratch = await mkdtemp(path.join(tmpdir(), 'opf-track-template-'));
const inputs = {};
const modules = {};
for (const [label, ref] of [['baseline', baseline], ['candidate', candidate]]) {
  const contents = git(['show', ref + ':' + source]);
  const result = await build({stdin: {contents: contents.toString(), loader: 'ts', resolveDir: path.join(root, 'packages/javascript/src'), sourcefile: 'composition-source.ts'}, absWorkingDir: root, bundle: true, platform: 'node', target: 'node24', format: 'esm', write: false, metafile: true, logLevel: 'silent'});
  const bytes = result.outputFiles[0].contents;
  const file = path.join(scratch, label + '.mjs');
  await writeFile(file, bytes);
  await writeFile(path.join(out, 'template-' + label + '.mjs.gz'), gzipSync(bytes));
  modules[label] = (await import(pathToFileURL(file).href)).composeSlide;
  inputs[label] = {ref, sourceSha256: hash(contents), bundleSha256: hash(bytes), dependencyInputs: {}};
  for (const file of Object.keys(result.metafile.inputs).filter(file => !file.startsWith('<stdin>') && !file.endsWith('composition-source.ts')).sort()) inputs[label].dependencyInputs[file] = hash(await readFile(path.resolve(root, file)));
}
assert.deepEqual(inputs.baseline.dependencyInputs, inputs.candidate.dependencyInputs, 'both isolated sources use exactly the same dependency bytes');
const r = value => Math.round(value * 10) / 10;
const box = value => [value.x, value.y, value.width, value.height].map(r).join(',');
// Same public summary contract as the maintained template-goldens.test.mjs; never writes its fixture.
const summary = result => [
 ...(result.headingAreas ?? []).map(area => 'area ' + area.name + ' ' + box(area.box) + (area.collapsed ? ' collapsed' : '') + (area.implicit ? ' implicit' : '')),
 ...(result.regions ?? []).map(region => 'region ' + region.name + ' ' + box(region.box) + ' ' + (region.arrangement ?? '-') + ' ' + region.content.length + (region.overflow ? '+' + region.overflow.length : '') + (region.collapsed ? ' collapsed' : '')),
 ...result.items.map(item => 'item ' + item.path.replace(/^slides\.0\./, '') + ' ' + (item.region ?? '-') + ' ' + box(item.box) + (item.text?.fontSize ? ' ' + r(item.text.fontSize) + 'px' : '') + (item.listColumns ? ' cols=' + item.listColumns.length : '')),
 ...result.diagnostics.map(entry => 'diagnostic ' + entry.code + ' ' + entry.path.replace(/^slides\.0\./, '')),
];
const fixture = JSON.parse(await readFile(path.join(root, 'packages/javascript/test/fixtures/template-goldens-0.19.json'), 'utf8'));
const records = [], actual = {};
for (const [id, record] of Object.entries(layouts)) for (const size of ['short', 'long']) for (let count = 1; count <= 6; count++) {
 const key = id + ' ' + count + ' ' + size, slide = sampleSlide(record, count, size), options = {layout: record};
 const before = summary(modules.baseline(slide, options)), after = summary(modules.candidate(slide, options)), compiled = summary(compiledCurrent(slide, options));
 assert.deepEqual(after, before, key + ': source correction changes no template summary');
 assert.deepEqual(after, compiled, key + ': isolated candidate matches actual frozen build');
 actual[key] = after;
 if (JSON.stringify(after) !== JSON.stringify(fixture[key])) records.push({key, baseline: before, candidate: after, frozenFixture: fixture[key]});
}
assert.equal(Object.keys(actual).length, 480);
const receipt = {node: process.version, execPath: process.execPath, baseline, candidate, count: 480, allSourceSummariesEqual: true, allCompiledCandidateSummariesEqual: true, fixtureChanged: false, fixtureSha256: hash(await readFile(path.join(root, 'packages/javascript/test/fixtures/template-goldens-0.19.json'))), summaryDigest: hash(JSON.stringify(actual)), inputs, inheritedFixtureDifferences: records};
await writeFile(path.join(out, 'template-baseline.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({count: 480, unchangedSourceAndCompiled: true, inheritedFixtureDifferences: records.length, first: records[0]?.key}));
