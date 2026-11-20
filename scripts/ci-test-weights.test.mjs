// opf#1319: the weights generator reads a run's job logs into seconds per test, the drift report warns on stale weights, and the
// leg planner turns the committed weights into planned minutes per leg.
import assert from 'node:assert/strict';
import test from 'node:test';
import { legMinutes, planDecision } from './ci-leg-minutes.mjs';
import { loadGraph, scope } from './ci-scope.mjs';
import { driftReport, jobOfFile, mergeWeights, parseJobLog } from './ci-test-weights.mjs';

const at = (seconds) => new Date(Date.UTC(2026, 10, 14, 3, 0, 0) + seconds * 1000).toISOString().replace('Z', '0000Z');
const log = (rows) => rows.map(([seconds, text]) => `${at(seconds)} ${text}`).join('\n');

test('a ci-test-shards step: each test runs from its + line to the next + line or the end of the step', () => {
  const text = log([
    [0, '##[group]Run actions/checkout@abc'],
    [1, '+ node test/not-in-a-shard-step.mjs'],
    [10, '##[group]Run node scripts/ci-test-shards.mjs --package pptx --script "$SCRIPT" --shard "2/4"'],
    [11, '+ pnpm run build'],
    [20, '+ node test/a.mjs'],
    [22, 'a passed'],
    [25, '+ node --test test/b.test.mjs'],
    [70, '+ pnpm run check:scripts'],
    [80, '+ node test/c.mjs'],
    [95, '##[group]Run actions/upload-artifact@abc'],
  ]);
  assert.deepEqual(parseJobLog(text, 'pptx (tests 2/4)'), [
    { kind: 'tests', package: 'pptx', file: 'a.mjs', seconds: 5 },
    { kind: 'tests', package: 'pptx', file: 'b.test.mjs', seconds: 45 },
    { kind: 'tests', package: 'pptx', file: 'c.mjs', seconds: 15 },
  ]);
});

test('a sharded run-suite step: each test runs from its > id: line to the next > line; an unsharded step is not read', () => {
  const text = log([
    [0, '##[group]Run node ../../scripts/quarantine.mjs run-suite browser --shard "3/4"'],
    [1, '> setup: pnpm run build'],
    [5, '> @openpresentation/opf-editor@0.34.0 build /w/packages/editor'],
    [9, '> browser:code: pnpm run test:code-browser'],
    [10, '> @openpresentation/opf-editor@0.34.0 test:code-browser /w/packages/editor'],
    [30, '> browser:source-navigation: node test/source-navigation-browser.mjs'],
    [190, 'Post job cleanup.'],
    [200, '##[group]Run node ../../scripts/quarantine.mjs run-suite rich'],
    [201, '> rich:a: node test/a.mjs'],
    [260, 'Post job cleanup.'],
  ]);
  assert.deepEqual(parseJobLog(text, 'editor (browser 3/4)'), [
    { kind: 'suite', package: 'editor', suite: 'browser', id: 'browser:code', seconds: 21 },
    { kind: 'suite', package: 'editor', suite: 'browser', id: 'browser:source-navigation', seconds: 160 },
  ]);
  assert.equal(jobOfFile('5_editor (browser 3_3).txt'), 'editor (browser 3/3)');
  assert.equal(jobOfFile('18_core.txt'), 'core');
});

test('merging replaces each measured table (the longest of repeated measurements) and keeps the others', () => {
  const current = { $comment: 'old', 'opf-pptx': { 'gone.mjs': 3, 'a.mjs': 1 }, 'opf-render': { 'r.mjs': 2 } };
  const next = mergeWeights(current, [
    { kind: 'tests', package: 'pptx', file: 'a.mjs', seconds: 5 },
    { kind: 'tests', package: 'pptx', file: 'a.mjs', seconds: 7 },
    { kind: 'tests', package: 'core', file: 'x.mjs', seconds: 9 },
    { kind: 'suite', package: 'editor', suite: 'browser', id: 'browser:b', seconds: 40 },
  ], 'new');
  assert.deepEqual(next, { $comment: 'new', 'browser-suites': { editor: { browser: { 'browser:b': 40 } } }, 'opf-pptx': { 'a.mjs': 7 }, 'opf-render': { 'r.mjs': 2 } });
});

test('drift warns only past half the plan and two minutes, and never fails', () => {
  assert.equal(driftReport('x', 300, 400).length, 1);
  assert.equal(driftReport('x', 100, 200).length, 1, '100 s more is under two minutes');
  const stale = driftReport('pptx test shard 2/6', 300, 700);
  assert.equal(stale.length, 2);
  assert.match(stale[1], /^::warning title=Stale CI test weights::pptx test shard 2\/6 planned 300 s and took 700 s\. .*ci-test-weights\.mjs/);
  assert.equal(driftReport('x', 600, 200).length, 2, 'a much faster shard warns too');
});

test('the committed weights and LEG_PLAN plan every leg of a full run at under nine minutes', () => {
  const decision = scope({ files: ['scripts/a.mjs'], graph: loadGraph(process.cwd()).graph });
  const plan = planDecision(decision);
  assert.equal(plan.legs.length, decision.legs.length);
  for (const leg of plan.legs) assert.notEqual(leg.minutes, null, `${leg.name} has planned minutes`);
  assert.ok(plan.longest.minutes < 9, `the longest leg is ${plan.longest.name}, ${plan.longest.minutes.toFixed(1)} minutes`);
  assert.equal(legMinutes({ job: 'core', kind: 'tests', tier: 'full', name: 'core', index: 1, count: 1 }).source, 'measured');
});
