import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { refusal, steps } from './golden-update.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pinned = { GITHUB_ACTIONS: 'true', PLAYWRIGHT_BROWSERS_PATH: '/ms-playwright' };

test('the baseline is rewritten only in GitHub Actions on Linux in the Playwright image', () => {
  assert.equal(refusal({ env: pinned, platform: 'linux', local: false }), undefined);
  assert.match(refusal({ env: {}, platform: 'darwin', local: false }), /not running in GitHub Actions[\s\S]*not linux[\s\S]*pinned Playwright image/);
  assert.match(refusal({ env: { GITHUB_ACTIONS: 'true' }, platform: 'linux', local: false }), /pinned Playwright image/);
  assert.match(refusal({ env: pinned, platform: 'win32', local: false }), /not linux/);
});

test('--local writes the review candidate only, anywhere', () => {
  assert.equal(refusal({ env: {}, platform: 'darwin', local: true }), undefined);
  assert.deepEqual(steps({ local: true }).map((args) => args.at(-1)), ['golden:update']);
  assert.deepEqual(steps({ local: false }).map((args) => args.at(-1)), ['golden:update', 'golden:promote']);
});

test('the steps are scripts of the renderer package, and the workflow runs this script in the pinned image', () => {
  const manifest = JSON.parse(readFileSync(path.join(root, 'packages/render/package.json'), 'utf8'));
  for (const script of ['golden:update', 'golden:promote']) assert.ok(manifest.scripts[script], script);
  assert.equal(manifest.name, '@openpresentation/opf-render');
  assert.equal(JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).scripts['golden:update'], 'node scripts/golden-update.mjs');
  const workflow = readFileSync(path.join(root, '.github/workflows/golden.yml'), 'utf8');
  assert.match(workflow, /container:\s*\n\s*image: mcr\.microsoft\.com\/playwright:v\d+\.\d+\.\d+-noble@sha256:[0-9a-f]{64}/);
  assert.match(workflow, /pnpm golden:update/);
  assert.doesNotMatch(workflow, /pull_request_target/, 'never run branch code with a write token on a fork pull request');
});
