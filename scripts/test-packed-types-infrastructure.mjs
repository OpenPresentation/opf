// Check the real compiler boundary using a disposable copy, never the accepted consumer.
import assert from 'node:assert/strict';
import {cp, mkdir, mkdtemp, readFile, realpath, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import {checkPackedTypes, assertPackedTypeEnvironment} from './check-packed-types.mjs';

const cleanEnvironment = {nodeOptions: '', nodePath: '', execArgv: []};
const allowedEnvironments = [{}, {nodeOptions: '--max-old-space-size=256 --enable-source-maps'}, {execArgv: ['--enable-source-maps']}];
const refusedEnvironments = [
  {nodeOptions: '--import ./fixture.mjs'}, {nodeOptions: '--import=./fixture.mjs'}, {nodeOptions: '"--import=./fixture.mjs"'},
  {nodeOptions: '--loader=./fixture.mjs'}, {nodeOptions: '--experimental-loader ./fixture.mjs'},
  {nodeOptions: '--require=./fixture.cjs'}, {nodeOptions: '-r./fixture.cjs'}, {nodeOptions: '-r "./fixture.cjs"'},
  {execArgv: ['--require', './fixture.cjs']}, {nodePath: '/ancestor/node_modules'},
];
for (const env of allowedEnvironments) assert.doesNotThrow(() => assertPackedTypeEnvironment({...cleanEnvironment, ...env}));
for (const env of refusedEnvironments) assert.throws(() => assertPackedTypeEnvironment({...cleanEnvironment, ...env}), /must not alias packages/);
if (process.argv[2] === '--environment-only') {
  console.log('Packed type environment passed: 3 harmless settings allowed, 10 source-injection settings refused.');
  process.exit(0);
}

const consumer = await realpath(process.argv[2] ?? 'artifacts/npm/consumer');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const positive = JSON.parse(await readFile(path.join(consumer, 'artifacts/packed-types/report.json'), 'utf8'));
assert.equal(positive.consumer, consumer);
assert.equal(positive.downstream, true);
// NodeNext and Bundler with TypeScript 5.9 and 7, plus the browser consumer (RR-62: every non-Node entry, no Node types).
assert.equal(positive.results.length, 6);
assert.equal(new Set(positive.results.map(result => `${result.mode}/${result.compiler}`)).size, 6);
assert.equal(positive.results.filter(result => result.mode === 'Browser').length, 2);
for (const result of positive.results) {
  assert.equal(result.status, 0);
  assert.equal(result.error, undefined);
  for (const file of result.resolvedFiles) assert.equal(hash(await readFile(file.path)), file.sha256, `Positive input changed: ${file.path}`);
}

const output = await mkdtemp(path.join(consumer, 'artifacts/packed-types/negative-'));
const poisoned = path.join(output, 'downstream');
await mkdir(poisoned);
await cp(path.join(consumer, 'package.json'), path.join(poisoned, 'package.json'));
await cp(path.join(consumer, 'node_modules'), path.join(poisoned, 'node_modules'), {recursive: true, dereference: true});
const declaration = path.join(poisoned, 'node_modules/@openpresentation/opf-render/dist/index.d.ts');
const before = await readFile(declaration, 'utf8');
// The candidate consumer (check-packed-types.mjs) types `renderSlideSvg(edited, 0)` as a string, so this is the downstream
// signature it depends on (opf-render 0.14: renderSlideSvg draws one slide, renderSvg a whole deck as string[]).
const signature = 'export declare function renderSlideSvg(input: unknown, index: number, options?: RenderSvgOptions): string;';
assert.equal(before.split(signature).length, 2, 'Negative control must change exactly one public downstream signature');
const after = before.replace(signature, signature.replace(': string;', ': number;'));
await writeFile(declaration, after);
await assert.rejects(checkPackedTypes(poisoned, {downstream: true}), /failed in 4 compiler\/mode combinations/);
const negative = JSON.parse(await readFile(path.join(poisoned, 'artifacts/packed-types/report.json'), 'utf8'));
assert.equal(negative.results.length, 6);
// The browser consumer imports no renderer, so the poisoned downstream signature breaks exactly the four Node combinations.
for (const result of negative.results.filter(result => result.mode === 'Browser')) assert.equal(result.status, 0);
for (const result of negative.results.filter(result => result.mode !== 'Browser')) {
  assert.notEqual(result.status, 0);
  const stdout = await readFile(path.join(poisoned, 'artifacts/packed-types', `${result.mode}-${result.compiler}.stdout.txt`), 'utf8');
  assert.match(stdout, /Type 'number' is not assignable to type 'string'/);
}

// A real ancestor package must not satisfy the explicitly consumer-installed Node type requirement.
const ancestor = path.join(output, 'ancestor-types');
const missing = path.join(ancestor, 'consumer');
await mkdir(path.join(missing, 'node_modules/@openpresentation/opf'), {recursive: true});
await cp(path.join(consumer, 'package.json'), path.join(missing, 'package.json'));
await cp(path.join(consumer, 'node_modules/@openpresentation/opf/package.json'), path.join(missing, 'node_modules/@openpresentation/opf/package.json'));
await mkdir(path.join(ancestor, 'node_modules/@types'), {recursive: true});
await cp(path.join(consumer, 'node_modules/@types/node'), path.join(ancestor, 'node_modules/@types/node'), {recursive: true});
const escaped = createRequire(path.join(missing, 'package.json')).resolve('@types/node/package.json');
assert.equal(await realpath(escaped), await realpath(path.join(ancestor, 'node_modules/@types/node/package.json')));
await assert.rejects(checkPackedTypes(missing, {downstream: true}), /Installed declaration input escaped consumer/);

for (const result of positive.results) {
  for (const file of result.resolvedFiles) assert.equal(hash(await readFile(file.path)), file.sha256, `Negative control altered positive input: ${file.path}`);
}
await writeFile(path.join(output, 'report.json'), `${JSON.stringify({
  environmentControls: {allowed: allowedEnvironments.length, refused: refusedEnvironments.length},
  consumer, positiveCombinations: 6, rejectedDownstreamCombinations: 4,
  ancestorNodeTypesRejected: true, originalInputsUnchanged: true,
  mutation: {path: declaration, before: hash(before), after: hash(after), signature},
}, null, 2)}\n`);
console.log('Packed type infrastructure passed: six positive combinations (four Node, two browser), four real downstream errors, ancestor Node types refused; original inputs unchanged.');
