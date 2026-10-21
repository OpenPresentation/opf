// MR-10: check:playwright-pin keeps the container image and the Playwright package on one version.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkPlaywrightPin, collect } from './check-playwright-pin.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIGEST = `@sha256:${'a'.repeat(64)}`;
const image = (version, digest = DIGEST, file = '.github/workflows/ci.yml') => ({ file, text: `mcr.microsoft.com/playwright:v${version}-noble${digest}`, version, digest: digest || undefined });
const temp = mkdtempSync(path.join(tmpdir(), 'opf-playwright-pin-'));
after(() => rmSync(temp, { recursive: true, force: true }));

test('one image string, and a package pin at the same version, pass', () => {
  assert.deepEqual(checkPlaywrightPin([image('1.64.0'), image('1.64.0', DIGEST, '.github/workflows/nightly.yml')], [{ where: 'catalog', version: '1.64.0' }]), []);
  assert.deepEqual(checkPlaywrightPin([], []), []);
});

test('a reference without a digest fails', () => {
  assert.match(checkPlaywrightPin([image('1.64.0', '')], [])[0], /has no @sha256 digest/);
});

test('two different image strings fail, whether the version or only the digest differs', () => {
  assert.match(checkPlaywrightPin([image('1.64.0'), image('1.65.0', DIGEST, '.github/workflows/b.yml')], [])[0], /one string everywhere, found 2/);
  assert.match(checkPlaywrightPin([image('1.64.0'), image('1.64.0', `@sha256:${'b'.repeat(64)}`, '.github/workflows/b.yml')], [])[0], /one string everywhere, found 2/);
});

test('a package pin that differs from the image fails', () => {
  assert.deepEqual(checkPlaywrightPin([image('1.64.0')], [{ where: 'packages/render/package.json devDependencies playwright', version: '1.65.0' }]), ['packages/render/package.json devDependencies playwright pins Playwright 1.65.0 but the container image is v1.64.0']);
});

test('collect reads workflow files, actions, manifests and the pnpm catalog', () => {
  mkdirSync(path.join(temp, '.github/workflows'), { recursive: true });
  mkdirSync(path.join(temp, '.github/actions/x'), { recursive: true });
  writeFileSync(path.join(temp, '.github/workflows/ci.yml'), `jobs:\n  a:\n    container: mcr.microsoft.com/playwright:v1.64.0-noble${DIGEST}\n`);
  writeFileSync(path.join(temp, '.github/actions/x/action.yml'), `image: mcr.microsoft.com/playwright:v1.64.0-noble\n`);
  writeFileSync(path.join(temp, 'package.json'), JSON.stringify({ devDependencies: { playwright: '1.65.0' } }));
  writeFileSync(path.join(temp, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/a"\ncatalog:\n  playwright: 1.66.0\n');
  const { images, pinned } = collect(temp);
  assert.deepEqual(images.map((entry) => [entry.file, entry.version, Boolean(entry.digest)]), [['.github/actions/x/action.yml', '1.64.0', false], ['.github/workflows/ci.yml', '1.64.0', true]]);
  assert.deepEqual(pinned.map((entry) => entry.version), ['1.65.0', '1.66.0']);
  assert.equal(checkPlaywrightPin(images, pinned).length, 4);
});

test('this repository passes check:playwright-pin', () => {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/check-playwright-pin.mjs'), root], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
