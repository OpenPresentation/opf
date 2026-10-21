import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  IMPORTED_MANIFESTS,
  PUBLISHED_MANIFESTS,
  checkManifest,
  checkRepo,
  checkPackageLock,
  checkPnpmLock,
  checkWorkflow,
  closedRangeAllowed,
  openRangeMinimum,
} from './check-engines-range.mjs';

test('only an open-ended ">=" range passes', () => {
  assert.equal(openRangeMinimum('>=22'), 22);
  assert.equal(openRangeMinimum('>= 22.12.0'), 22);
  assert.equal(openRangeMinimum('>=24.1'), 24);
  for (const closed of ['24.x', '24', '^24', '~24.1', '22.x || 24.x', '>=22 <27', '>=22 || 24.x', '*', '', undefined]) {
    assert.equal(openRangeMinimum(closed), null, `accepted ${closed}`);
  }
});

test('a package.json with a closed range is reported; one without engines is not', () => {
  assert.equal(checkManifest('package.json', { engines: { node: '>=22' } }).length, 0);
  assert.equal(checkManifest('package.json', {}).length, 0);
  assert.match(checkManifest('packages/cli/package.json', { engines: { node: '24.x' } })[0], /packages\/cli\/package\.json: engines\.node is "24\.x"/);
});

test('a lock may pin the releases before the fix, never a later closed one', () => {
  assert.equal(closedRangeAllowed('@openpresentation/opf-pptx', '0.12.3'), true);
  assert.equal(closedRangeAllowed('@openpresentation/opf-pptx', '0.12.4'), false);
  assert.equal(closedRangeAllowed('@openpresentation/opf', '0.9.0'), true);
  const lock = {
    packages: {
      '': { engines: { node: '>=22' } },
      'node_modules/@openpresentation/opf': { version: '0.12.1', engines: { node: '24.x' } },
      'node_modules/@openpresentation/opf-render': { version: '0.12.1', engines: { node: '24.x' } },
      'node_modules/@openpresentation/opf-editor': { version: '0.11.3', engines: { node: '>=22' } },
      'node_modules/sharp': { version: '0.35.4', engines: { node: '^20.9.0 || >=22' } },
    },
  };
  const findings = checkPackageLock('consumer/package-lock.json', lock);
  assert.equal(findings.length, 1);
  assert.match(findings[0], /@openpresentation\/opf-render@0\.12\.1/);
  assert.match(checkPackageLock('package-lock.json', { packages: { '': { engines: { node: '24.x' } } } })[0], /root entry/);
});

test('pnpm-lock entries are read from the packages section', () => {
  const text = [
    'packages:',
    '',
    "  '@openpresentation/opf-pptx@0.12.0':",
    '    resolution: {integrity: sha512-x}',
    '    engines: {node: 24.x}',
    '',
    "  '@openpresentation/opf@0.12.2':",
    '    resolution: {integrity: sha512-y}',
    "    engines: {node: '>=22'}",
    '',
    "  '@openpresentation/opf-render@0.12.1':",
    '    resolution: {integrity: sha512-z}',
    '    engines: {node: 24.x}',
    '    hasBin: true',
    '',
  ].join('\n');
  const findings = checkPnpmLock('pnpm-lock.yaml', text);
  assert.equal(findings.length, 1);
  assert.match(findings[0], /opf-render@0\.12\.1/);
});

test('workflow Node versions must lie inside the range', () => {
  const text = ['        with:', '          node-version: 24', '  NODE_VERSION: 24.21.0', '        node: [22, 26]', "          node-version: '20'"].join('\n');
  const findings = checkWorkflow('ci.yml', text, 22);
  assert.equal(findings.length, 1);
  assert.match(findings[0], /ci\.yml:5: node-version 20/);
  assert.equal(checkWorkflow('ci.yml', '        node: [20, 24]\n', 22).length, 1);
  assert.equal(checkWorkflow('ci.yml', ['          node-version: $', '{{ matrix.node }}\n'].join(''), 22).length, 0);
});

// MR-11: the four packages that join the monorepo are held to the root's range as soon as their manifest is tracked.
test('MR-11: an imported package must declare the root engines.node range once its manifest is tracked', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'opf-engines-range-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (file, value) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), `${JSON.stringify(value)}\n`);
  };
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { cwd: root, stdio: 'pipe' });
  git('init', '-q');
  write('package.json', { engines: { node: '>=22' } });
  for (const file of PUBLISHED_MANIFESTS) write(file, { engines: { node: '>=22' } });
  git('add', '-A');
  assert.deepEqual(checkRepo(root).findings, [], 'core and the CLI alone pass, as today');

  // Untracked manifests (a generated or half-copied directory) are not read.
  write('packages/render/package.json', { engines: { node: '24.x' } });
  assert.deepEqual(checkRepo(root).findings, []);

  for (const file of IMPORTED_MANIFESTS) write(file, { engines: { node: file.includes('editor') ? '>=24' : '>=22' } });
  write('packages/gallery/package.json', {});
  git('add', '-A');
  const findings = checkRepo(root).findings.join('\n');
  assert.match(findings, /packages\/editor\/package\.json: engines\.node ">=24" differs from the root's ">=22"/);
  assert.match(findings, /packages\/gallery\/package\.json: a published package must declare engines\.node/);
  assert.doesNotMatch(findings, /packages\/(pptx|render)\//);

  // A closed range in an imported package's own manifest is reported by the any-manifest rule too.
  write('packages/pptx/package.json', { engines: { node: '24.x' } });
  git('add', '-A');
  assert.match(checkRepo(root).findings.join('\n'), /packages\/pptx\/package\.json: engines\.node is "24\.x"/);

  // Evidence packages record history and are skipped, as the root's docs/evidence is.
  write('packages/render/docs/evidence/old-run/package.json', { engines: { node: '24.x' } });
  write('packages/pptx/package.json', { engines: { node: '>=22' } });
  write('packages/editor/package.json', { engines: { node: '>=22' } });
  write('packages/gallery/package.json', { engines: { node: '>=22' } });
  git('add', '-A');
  assert.deepEqual(checkRepo(root).findings, []);
});
