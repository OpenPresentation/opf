import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {build} = createRequire(require.resolve('tsup'))('esbuild');
let directory, backdropColors;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'opf-gradient-contrast-'));
  const file = path.join(directory, 'rule-design.mjs');
  await build({entryPoints: [fileURLToPath(new URL('../src/rule-design.ts', import.meta.url))], outfile: file, bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'silent'});
  ({backdropColors} = await import(pathToFileURL(file).href));
});
after(async () => { if (directory) await rm(directory, {recursive: true, force: true}); });
const sample = (stops, x) => backdropColors({kind: 'gradient', angle: 0, stops}, {x, y: 0, width: 0, height: 0}, {width: 100, height: 100}).colors;
const stops = [{color: '#000000', position: .25}, {color: '#FFFFFF', position: .75}];

test('gradient sampling extends first and last stop colours outside their positions', () => {
  assert.deepEqual(sample(stops, 10), ['#000000']);
  assert.deepEqual(sample(stops, 90), ['#FFFFFF']);
});
test('gradient sampling interpolates interior values and retains exact stop colours', () => {
  assert.deepEqual(sample(stops, 50), ['#808080']);
  assert.deepEqual(sample(stops, 25), ['#000000']);
  assert.deepEqual(sample(stops, 75), ['#FFFFFF']);
});
test('duplicate stops retain their step boundary and the final colour beyond it', () => {
  const step = [{color: '#000000', position: .5}, {color: '#FFFFFF', position: .5}];
  assert.deepEqual(sample(step, 49), ['#000000']);
  assert.deepEqual(sample(step, 51), ['#FFFFFF']);
});
test('one-stop internal fallback is constant without NaN or missing samples', () => {
  for (const x of [0, 50, 100]) assert.deepEqual(sample([{color: '#123456', position: .5}], x), ['#123456']);
});
test('public validation does not invent contrast failures after a valid gradient ends', async () => {
  const {validate} = await import('../dist/index.js');
  const background = {type: 'gradient', gradient: {angle: 0, stops: [{color: '#000000', position: 0}, {color: '#FFFFFF', position: .000001}]}};
  const deck = {design: {background}, slides: [{title: 'Readable content', text: 'Real presentation text.'}]};
  const result = validate(deck, {only: ['format', 'text-contrast']});
  assert.equal(result.valid, true);
  assert.deepEqual(result.findings, []);
  const lowContrast = validate({...deck, slides: [{title: [{text: 'Unreadable content', color: '#FFFFFF'}]}]}, {only: ['format', 'text-contrast']});
  assert.equal(lowContrast.valid, true);
  assert.ok(lowContrast.findings.some(f => f.ruleId === 'opf/text-contrast' && f.path === '/slides/0/title/0/color' && f.measured?.backgroundColor === '#FFFFFF'));
});
