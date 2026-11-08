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

import {spawnSync} from 'node:child_process';

function workflowPatchRules() {
  const workflow = readFileSync(path.join(root, '.github/workflows/golden.yml'), 'utf8');
  const push = workflow.slice(workflow.indexOf('\n  push:'));
  const allowed = push.match(/bad="[^\n]*grep -Ev '([^']+)'/);
  const traversal = push.match(/unsafe="[^\n]*grep -E '([^']+)'/);
  assert.ok(allowed, 'the write job must enforce its explicit patch allowlist');
  assert.ok(traversal, 'the write job must reject dot path segments');
  return {workflow, push, allowed: new RegExp(allowed[1]), traversal: new RegExp(traversal[1])};
}

test('the pinned read-only job regenerates core and renderer templates with their review artifacts', () => {
  const {workflow, push} = workflowPatchRules();
  const regenerate = workflow.slice(workflow.indexOf('\n  regenerate:'), workflow.indexOf('\n  push:'));
  assert.match(regenerate, /OPF_UPDATE_GOLDENS=1 node --test packages\/javascript\/test\/template-goldens\.test\.mjs/);
  assert.match(regenerate, /OPF_TEMPLATE_GOLDEN_OUT=packages\/render\/artifacts\/golden\/templates node packages\/render\/test\/layout-template-goldens\.mjs --update --promote/);
  assert.match(regenerate, /git add -A -- packages\/render\/test\/golden packages\/javascript\/test\/fixtures\/template-goldens-0\.19\.json/);
  assert.match(regenerate, /packages\/render\/artifacts\/golden\/templates\//);
  assert.doesNotMatch(regenerate, /contents: write|persist-credentials: true/);
  assert.doesNotMatch(push, /pnpm |OPF_UPDATE_GOLDENS|layout-template-goldens\.mjs/);
  assert.match(push, /path: regenerated/);
  assert.match(push, /git apply --index regenerated\/golden\.patch/);
});

test('the actual write-job allowlist accepts generated baselines and refuses source, sibling and traversing patches', () => {
  const {allowed, traversal} = workflowPatchRules();
  const cases = [
    ['packages/render/test/golden/example/_baseline.json', true],
    ['packages/render/test/golden/layout-templates-rr96-color-variants.json', true],
    ['packages/javascript/test/fixtures/template-goldens-0.19.json', true],
    ['packages/javascript/test/fixtures/template-goldens-0.19.json.extra', false],
    ['packages/javascript/test/fixtures/other.json', false],
    ['packages/javascript/src/composition.ts', false],
    ['.github/workflows/ci.yml', false],
    ['packages/render/test/golden/../src/evil.js', false],
    ['packages/render/test/golden/./unexpected.json', false],
    ['packages/render/test/goldenish/baseline.json', false],
  ];
  for (const [file, expected] of cases) {
    const patch = `diff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1 @@\n+baseline\n`;
    const result = spawnSync('git', ['apply', '--numstat', '-'], {cwd: root, input: patch, encoding: 'utf8'});
    assert.ifError(result.error);
    const paths = result.stdout.trim().split('\n').filter(Boolean).map(row => row.split('\t')[2]);
    const accepted = result.status === 0 && paths.length > 0 && paths.every(value => allowed.test(value) && !traversal.test(value));
    assert.equal(accepted, expected, file);
  }
});
