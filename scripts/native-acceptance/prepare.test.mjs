import assert from 'node:assert/strict';
import test from 'node:test';
import {parseArguments,preparationInputPaths} from './prepare.mjs';

test('prepare requires explicit reproducible inputs and rejects ambiguous CLI options', () => {
  assert.throws(() => parseArguments([]), /Required/);
  assert.throws(() => parseArguments(['--consumer']), /Missing value/);
  assert.throws(() => parseArguments(['--consumer', 'one', '--consumer', 'two']), /Duplicate/);
  assert.throws(() => parseArguments(['--packet', 'one']), /Unknown option/);
  const parsed = parseArguments(['--consumer', 'consumer', '--output', 'results', '--pptx-repo', 'pptx']);
  assert.ok(parsed['--consumer'].endsWith('consumer'));
});


test('suite provenance inventories the canonical and historical chart authorities without parent paths',async()=>{
  const files=await preparationInputPaths();
  assert.equal(new Set(files).size,files.length);
  assert.ok(files.includes('packages/pptx/test/fixtures/chartex-fallback-main.json'));
  assert.ok(files.includes('scripts/native-acceptance/fixtures/chartex-fallback-main.json'));
  assert.ok(files.every(file=>!file.split('/').includes('..')));
});
