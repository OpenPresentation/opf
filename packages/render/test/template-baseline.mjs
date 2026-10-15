import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {templateBaseline, readTemplateBaseline, LEGACY_TEMPLATE_BASELINE, CENTERED_TEMPLATE_BASELINE} from '../scripts/template-baseline.mjs';
const root = mkdtempSync(path.join(tmpdir(), 'template-baseline-'));
try {
  mkdirSync(path.join(root, 'test/golden'), {recursive: true});
  const old = {entries: {metric: {svg: 'old', png: 'old', bytes: 1}}};
  const next = {entries: {metric: {svg: 'new', png: 'new', bytes: 2}}};
  writeFileSync(path.join(root, LEGACY_TEMPLATE_BASELINE), JSON.stringify(old));
  assert.equal(templateBaseline('left'), LEGACY_TEMPLATE_BASELINE);
  assert.equal(templateBaseline('center'), CENTERED_TEMPLATE_BASELINE);
  for (const alignment of ['right', undefined, 'unexpected']) assert.throws(() => templateBaseline(alignment), /Unknown metric default/);
  assert.deepEqual(readTemplateBaseline(root, 'left').previous, old);
  assert.throws(() => readTemplateBaseline(root, 'center'), /ENOENT/, 'Normal checks never accept an older geometry baseline');
  const candidate = readTemplateBaseline(root, 'center', {update: true});
  assert.equal(candidate.selected, CENTERED_TEMPLATE_BASELINE);
  assert.equal(candidate.comparison, LEGACY_TEMPLATE_BASELINE);
  assert.deepEqual(candidate.previous, old);
  writeFileSync(path.join(root, CENTERED_TEMPLATE_BASELINE), JSON.stringify(next));
  assert.deepEqual(readTemplateBaseline(root, 'center').previous, next);
  assert.equal(readTemplateBaseline(root, 'center', {update: true}).comparison, CENTERED_TEMPLATE_BASELINE);
  assert.deepEqual(readTemplateBaseline(root, 'left').previous, old, 'Published-core baseline remains separate');
  writeFileSync(path.join(root, CENTERED_TEMPLATE_BASELINE), '{invalid');
  assert.throws(() => readTemplateBaseline(root, 'center', {update: true}), SyntaxError, 'A malformed selected baseline never falls back');
} finally { rmSync(root, {recursive: true, force: true}); }
console.log('Template baseline selector: known contracts, missing/invalid/unknown rejection, candidate-only old-baseline comparison and distinct exact fixtures passed.');
