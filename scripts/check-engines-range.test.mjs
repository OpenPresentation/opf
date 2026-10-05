import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkManifest,
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
