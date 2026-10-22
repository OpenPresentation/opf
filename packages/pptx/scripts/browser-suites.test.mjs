// The browser suite in test/browser-suites.json must stay the same list as `npm run test:browser`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
test('the browser suite is the test:browser script', () => {
  const chain = read('package.json').scripts['test:browser'].split(' && ');
  const suite = read('test/browser-suites.json').suites.browser;
  assert.deepEqual(suite.setup, chain.slice(0, suite.setup.length));
  assert.deepEqual(suite.tests.map((entry) => entry.command), chain.slice(suite.setup.length));
});
