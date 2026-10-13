import assert from 'node:assert/strict';
import test from 'node:test';
import {parseArguments} from './prepare.mjs';

test('prepare requires explicit reproducible inputs and rejects ambiguous CLI options', () => {
  assert.throws(() => parseArguments([]), /Required/);
  assert.throws(() => parseArguments(['--consumer']), /Missing value/);
  assert.throws(() => parseArguments(['--consumer', 'one', '--consumer', 'two']), /Duplicate/);
  assert.throws(() => parseArguments(['--packet', 'one']), /Unknown option/);
  const parsed = parseArguments(['--consumer', 'consumer', '--output', 'results', '--pptx-repo', 'pptx']);
  assert.ok(parsed['--consumer'].endsWith('consumer'));
});
