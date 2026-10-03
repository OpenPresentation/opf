// The playground suite in test/browser-suites.json must stay the same list as `npm run test:playground`, so quarantine and the flake
// measurement see exactly what a developer runs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { listTests } from './quarantine.mjs';

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
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
    const name = entry.command.match(/^npm run (\S+)/)?.[1];
    assert.ok(scripts[name], `${entry.id}: package.json has no script ${name}`);
  }
});
