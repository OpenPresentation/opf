// The playground suite in test/browser-suites.json must stay the same list as `pnpm run test:playground`, so quarantine and the flake
// measurement see exactly what a developer runs.
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { listTests } from '../../../scripts/quarantine.mjs';

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
const checkStandalone = (entry, scripts) => {
  const name = entry.command.match(/^pnpm run (\S+)/)?.[1];
  if (name) return assert.ok(scripts[name], `${entry.id}: package.json has no script ${name}`);
  const file = entry.command.match(/^node (test\/[a-zA-Z0-9-]+-browser\.mjs)$/)?.[1];
  assert.ok(file, `${entry.id}: expected a normal pnpm script or direct browser test`);
  assert.ok(statSync(new URL(`../${file}`, import.meta.url)).isFile(), `${entry.id}: missing direct browser test`);
};
test('the playground suite is the test:playground script, one test per command', () => {
  const chain = read('package.json').scripts['test:playground'].split(' && ');
  const suite = read('test/browser-suites.json').suites.playground;
  assert.deepEqual(suite.setup, chain.slice(0, suite.setup.length));
  assert.deepEqual(suite.tests.map((entry) => entry.command), chain.slice(suite.setup.length));
});
test('the CI browser suite lists every standalone browser script CI runs', () => {
  const ids = listTests(read('test/browser-suites.json')).map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
  const scripts = read('package.json').scripts;
  for (const entry of read('test/browser-suites.json').suites.browser.tests) {
    checkStandalone(entry, scripts);
  }
});
test('the perf suite holds the wall-clock budgets the nightly runs instead of verify (opf#1319)', () => {
  const { browser, perf } = read('test/browser-suites.json').suites;
  assert.deepEqual(perf.setup, browser.setup, 'the same builds as the browser suite');
  assert.deepEqual(perf.tests.map((entry) => entry.command), ['node test/startup-perf-browser.mjs', 'node test/studio-perf-browser.mjs']);
  for (const entry of perf.tests) checkStandalone(entry, read('package.json').scripts);
  const browserCommands = new Set(browser.tests.map((entry) => entry.command));
  for (const entry of perf.tests) assert.equal(browserCommands.has(entry.command), false, `${entry.id} runs once, in the perf suite`);
});
test('direct browser registration refuses missing paths and arbitrary commands', () => {
  assert.throws(() => checkStandalone({ id: 'missing', command: 'node test/missing-browser.mjs' }, {}), /ENOENT/);
  assert.throws(() => checkStandalone({ id: 'outside', command: 'node ../outside-browser.mjs' }, {}), /expected a normal/);
});
