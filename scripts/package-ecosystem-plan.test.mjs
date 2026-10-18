// RR-45: the three `packages` shards run exactly the commands of the unsharded run, once each, in the original order.
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseShardArguments, planEcosystem, resolveStep } from './package-ecosystem-plan.mjs';

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

// RR-45 (opf#368, item 1): ecosystem-core is two core shards plus the registry shard; the two core halves partition core's list.
test('the core parts partition the core shard, in order', () => {
  const model = planEcosystem(['--skip-siblings', '--core', 'model']).map(key);
  const packed = planEcosystem(['--skip-siblings', '--core=packed']).map(key);
  assert.deepEqual(packed, ['opf: pnpm pack:ecosystem', 'opf: pnpm test:packed-ecosystem']);
  assert.deepEqual(model, shards.core.filter((step) => !packed.includes(step)));
  assert.deepEqual([...model, ...packed].sort(), [...shards.core].sort());
  assert.equal(new Set([...model, ...packed]).size, shards.core.length);
  assert.ok(model.includes('opf: pnpm test:fonts') && model.includes('opf: pnpm test:cli:packed'));
  for (const tier of ['full', 'contract']) {
    assert.deepEqual(planEcosystem(['--skip-siblings', '--core', 'model', '--tier', tier]).map(key), model);
  }
});

test('bad arguments fail', () => {
  for (const argv of [['--core', 'model'], ['--skip-siblings', '--core'], ['--skip-siblings', '--core', 'registry'], ['--siblings', 'opf-render', '--core', 'packed'], ['--siblings'], ['--siblings', ''], ['--siblings', 'opf-nope'], ['--siblings', 'opf-render', '--skip-siblings'], ['--other'], ['--tier'], ['--tier', 'nightly'], ['--tier=fast']]) assert.throws(() => parseShardArguments(argv));
});

// RR-53: the contract tier swaps only each sibling's `npm run test` for `npm run test:contract`.
test('the contract tier changes nothing but the siblings\' test step, and the full tier is the default', () => {
  const contract = planEcosystem(['--tier', 'contract']);
  assert.deepEqual(planEcosystem(['--tier', 'full']).map(key), full);
  assert.equal(contract.length, planEcosystem([]).length);
  const swapped = contract.map((step, index) => [step, planEcosystem([])[index]]).filter(([a, b]) => key(a) !== key(b));
  assert.deepEqual(swapped.map(([a]) => key(a)), ['opf-render: npm run test:contract', 'opf-editor: npm run test:contract', 'opf-pptx: npm run test:contract']);
  assert.deepEqual(swapped.map(([, b]) => key(b)), ['opf-render: npm run test', 'opf-editor: npm run test', 'opf-pptx: npm run test']);
  // The shards still partition the contract plan, and core's own steps are identical in both tiers.
  const shard = (argv) => planEcosystem([...argv, '--tier', 'contract']).map(key);
  assert.deepEqual([...shard(['--siblings', 'opf-render']), ...shard(['--siblings', 'opf-editor,opf-pptx']), ...shard(['--skip-siblings'])].sort(), contract.map(key).sort());
  assert.deepEqual(shard(['--skip-siblings']), shards.core);
  assert.deepEqual(planEcosystem(['--tier=contract', '--siblings=opf-render']).map(key), shard(['--siblings', 'opf-render']));
});

test('a sibling without test:contract (a lock that predates RR-53) runs its full test, never nothing', () => {
  const [contractStep] = planEcosystem(['--siblings', 'opf-pptx', '--tier', 'contract']).filter((step) => step.args.at(-1) === 'test:contract');
  const has = { 'opf-pptx': { test: 'x', 'test:contract': 'y' } };
  assert.deepEqual(resolveStep(contractStep, (name) => has[name]), { step: contractStep, fellBack: false });
  const old = resolveStep(contractStep, () => ({ test: 'x' }));
  assert.equal(old.fellBack, true);
  assert.equal(key(old.step), 'opf-pptx: npm run test');
  assert.equal(resolveStep(contractStep, () => undefined).fellBack, true);
  const plain = planEcosystem(['--siblings', 'opf-pptx'])[0];
  assert.deepEqual(resolveStep(plain, () => ({})), { step: plain, fellBack: false });
});

// RR-57: a test shard (index/count) splits only each sibling's `test` step; the shards together run every step once.
test('the test shards of a sibling partition its plan: shard 1 keeps every step, the others only their slice of the test step', () => {
  for (const [sibling, tier] of [['opf-pptx', 'full'], ['opf-render', 'contract'], ['opf-editor', 'full']]) {
    const whole = planEcosystem(['--siblings', sibling, '--tier', tier]);
    const shardPlans = [1, 2, 3].map((index) => planEcosystem(['--siblings', sibling, '--tier', tier, '--test-shard', `${index}/3`]));
    const testStep = whole.find((step) => step.args[1]?.startsWith('test') && step.args.length === 2 && ['test', 'test:contract'].includes(step.args[1]));
    // Shard 1 is the whole plan, with its test step marked as slice 1 of 3.
    assert.deepEqual(shardPlans[0].map(key), whole.map(key));
    assert.deepEqual(shardPlans[0].filter((step) => step.shard).map((step) => step.shard), [{ index: 1, count: 3 }]);
    for (const [offset, plan] of shardPlans.slice(1).entries()) {
      assert.equal(plan.length, 1, `shard ${offset + 2} runs one step`);
      assert.equal(key(plan[0]), key(testStep));
      assert.deepEqual(plan[0].shard, { index: offset + 2, count: 3 });
      assert.equal(plan[0].fallback?.args.join(' '), testStep.fallback?.args.join(' '), 'the contract fallback is kept');
    }
    // Without a shard nothing is marked.
    assert.ok(whole.every((step) => !step.shard));
  }
});

test('--test-shard needs --siblings and a valid index/count', () => {
  for (const argv of [['--test-shard', '1/3'], ['--skip-siblings', '--test-shard', '1/3'], ['--siblings', 'opf-pptx', '--test-shard'], ['--siblings', 'opf-pptx', '--test-shard', '4/3'], ['--siblings', 'opf-pptx', '--test-shard', 'x']]) assert.throws(() => parseShardArguments(argv));
  assert.deepEqual(parseShardArguments(['--siblings', 'opf-pptx', '--test-shard=2/3']).testShard, { index: 2, count: 3 });
  assert.equal(parseShardArguments(['--siblings', 'opf-pptx']).testShard, null);
});
