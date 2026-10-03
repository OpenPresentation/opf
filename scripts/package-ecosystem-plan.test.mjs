// RR-45: the three `packages` shards run exactly the commands of the unsharded run, once each, in the original order.
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseShardArguments, planEcosystem } from './package-ecosystem-plan.mjs';

const key = (step) => `${step.sibling ?? 'opf'}: ${step.command} ${step.args.join(' ')}`;
const full = planEcosystem([]).map(key);
const shards = {
  render: planEcosystem(['--siblings', 'opf-render']).map(key),
  pptxEditor: planEcosystem(['--siblings', 'opf-editor,opf-pptx']).map(key),
  core: planEcosystem(['--skip-siblings']).map(key),
};

test('the unsharded plan is the original command list', () => {
  assert.equal(full[0], 'opf: node scripts/test-ecosystem-links.mjs');
  assert.equal(full.at(-1), 'opf: pnpm test:cli:packed');
  assert.equal(new Set(full).size, full.length);
  assert.equal(full.filter((step) => step.startsWith('opf-')).length, 6 + 3 + 5);
});

test('the shards partition the unsharded plan', () => {
  const union = [...shards.render, ...shards.pptxEditor, ...shards.core];
  assert.deepEqual([...union].sort(), [...full].sort());
  assert.equal(new Set(union).size, union.length);
});

test('sibling shards run only sibling suites and keep their order', () => {
  assert.ok(shards.render.every((step) => step.startsWith('opf-render: ')));
  assert.ok(shards.pptxEditor.every((step) => step.startsWith('opf-editor: ') || step.startsWith('opf-pptx: ')));
  assert.deepEqual(shards.pptxEditor, full.filter((step) => shards.pptxEditor.includes(step)));
  assert.deepEqual(planEcosystem(['--siblings=opf-pptx,opf-editor']).map(key), shards.pptxEditor);
  assert.ok(shards.core.every((step) => step.startsWith('opf: ')));
  assert.deepEqual(shards.core, full.filter((step) => step.startsWith('opf: ')));
});

test('bad arguments fail', () => {
  for (const argv of [['--siblings'], ['--siblings', ''], ['--siblings', 'opf-nope'], ['--siblings', 'opf-render', '--skip-siblings'], ['--other']]) assert.throws(() => parseShardArguments(argv));
});
