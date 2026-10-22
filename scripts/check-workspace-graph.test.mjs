// MR-10: check:workspace-graph and the workspace reader. The fixtures are the target six packages plus
// packages/integration (E0), the three experiments of spike S4 as the monorepo plan (D12) reads them (E1, E2, E3), and
// today's two-package workspace with its one transitional override.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkWorkspaceGraph, parseLockImporters } from './check-workspace-graph.mjs';
import { parseWorkspaceYaml, SIX } from './workspace-packages.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = Object.fromEntries(SIX.map(({ dir, name }) => [dir, name]));
const member = (dir, manifest) => ({ dir: `packages/${dir}`, manifest: structuredClone(manifest) });
const workspaceFor = (members, extra = {}) => ({ packages: members.map((entry) => entry.dir), overrides: {}, scalars: {}, ...extra });
const peers = { [N.render]: 'workspace:^', [N.pptx]: 'workspace:^' };
// Core cannot have devDependencies on its optional peers (the cycle), so it carries the concrete range `pnpm pack` would write.
const corePeers = { [N.render]: '^0.26.0', [N.pptx]: '^0.26.0' };

/** E0: the target state after MR-23. */
function target() {
  return [
    member('gallery', { name: N.gallery, version: '0.26.0' }),
    member('javascript', { name: N.javascript, version: '0.26.0', dependencies: { [N.gallery]: 'workspace:^' }, peerDependencies: corePeers }),
    member('render', { name: N.render, version: '0.26.0', dependencies: { [N.javascript]: 'workspace:^' }, devDependencies: { [N.gallery]: 'workspace:*' } }),
    member('pptx', {
      name: N.pptx,
      version: '0.26.0',
      dependencies: { [N.javascript]: 'workspace:^', [N.gallery]: 'workspace:^' },
      devDependencies: { [N.render]: 'workspace:*' },
      peerDependencies: { [N.render]: 'workspace:^' },
    }),
    member('editor', {
      name: N.editor,
      version: '0.26.0',
      dependencies: { [N.javascript]: 'workspace:^' },
      devDependencies: { [N.render]: 'workspace:*', [N.pptx]: 'workspace:*', [N.gallery]: 'workspace:*' },
      peerDependencies: peers,
    }),
    member('cli', {
      name: N.cli,
      version: '0.26.0',
      dependencies: { [N.javascript]: 'workspace:^', [N.gallery]: 'workspace:^' },
      devDependencies: { [N.render]: 'workspace:*', [N.pptx]: 'workspace:*' },
      peerDependencies: peers,
    }),
    member('integration', { name: '@openpresentation/integration', private: true, devDependencies: Object.fromEntries(Object.values(N).map((name) => [name, 'workspace:*'])) }),
  ];
}
const get = (members, dir) => members.find((entry) => entry.dir === `packages/${dir}`).manifest;
const run = (members, options = {}) => checkWorkspaceGraph({ members, workspace: workspaceFor(members), ...options });

test('E0: the target graph is acyclic and passes', () => {
  assert.deepEqual(run(target()), []);
});

test('E1: core devDependencies on render and pptx as workspace:* make both cycles and are named', () => {
  const members = target();
  get(members, 'javascript').devDependencies = { [N.render]: 'workspace:*', [N.pptx]: 'workspace:*' };
  const problems = run(members);
  assert.ok(problems.some((problem) => /^cycle: .*opf-render/.test(problem)), problems.join('\n'));
  assert.ok(problems.some((problem) => /^cycle: .*opf-pptx/.test(problem)), problems.join('\n'));
  assert.ok(problems.some((problem) => problem.includes(`${N.javascript} must not depend on`) && problem.includes(N.render) && problem.includes(N.pptx)));
});

test('E1 through a registry pin: core pinning render from the registry is a finding, not a silent cycle', () => {
  const members = target();
  get(members, 'javascript').devDependencies = { [N.render]: '0.26.0' };
  assert.ok(run(members).some((problem) => problem.includes('registry specifier 0.26.0')));
});

test('E2: a peer that is not workspace:^ fails', () => {
  const members = target();
  get(members, 'pptx').peerDependencies = { [N.render]: '^0.26.0' };
  assert.deepEqual(run(members), [`${N.pptx}: peer ${N.render} must be workspace:^ (found ^0.26.0)`]);
});

test('E4: core\'s peers are the concrete range of the workspace version: workspace:^ cannot be packed, a stale range drifts', () => {
  const members = target();
  get(members, 'javascript').peerDependencies = { [N.render]: 'workspace:^', [N.pptx]: '^0.25.0' };
  const problems = run(members);
  assert.equal(problems.length, 2, problems.join('\n'));
  assert.ok(problems.every((problem) => problem.startsWith(`${N.javascript}: peer `) && problem.includes('concrete range ^0.26.0')), problems.join('\n'));
  assert.ok(problems[0].includes(`${N.render} has no workspace devDependency`) && problems[0].endsWith('(found workspace:^)'));
  assert.ok(problems[1].endsWith('(found ^0.25.0)'));
});

test('E3: link-workspace-packages true fails in pnpm-workspace.yaml and in a legacy .npmrc', () => {
  const members = target();
  assert.deepEqual(run(members, { npmrc: 'link-workspace-packages=true\n' }), ['.npmrc: link-workspace-packages must not be true']);
  assert.deepEqual(run(members, { npmrc: 'link-workspace-packages=deep\n' }), ['.npmrc: link-workspace-packages must not be true']);
  assert.deepEqual(run(members, { workspace: workspaceFor(members, { scalars: { linkWorkspacePackages: 'true' } }) }), ['pnpm-workspace.yaml: linkWorkspacePackages must not be true']);
});

test('gallery has no workspace dependency (the cycle gallery -> core -> gallery), and core reaches only gallery', () => {
  const members = target();
  get(members, 'gallery').devDependencies = { [N.javascript]: 'workspace:*' };
  const problems = run(members);
  assert.ok(problems.some((problem) => problem.startsWith('cycle: ') && problem.includes(N.gallery) && problem.includes(N.javascript)));
  assert.ok(problems.some((problem) => problem.startsWith(`${N.gallery} must have no workspace dependencies`)));
});

test('dependency and devDependency specifiers: workspace:^ and workspace:*, never a registry range', () => {
  const members = target();
  get(members, 'render').dependencies[N.javascript] = '^0.26.0';
  get(members, 'cli').devDependencies[N.render] = 'workspace:^';
  assert.deepEqual(run(members), [
    `${N.render}: dependencies ${N.javascript} is the registry specifier ^0.26.0; a workspace package is workspace:^`,
    `${N.cli}: devDependencies ${N.render} must be workspace:* (found workspace:^)`,
  ]);
});

test('a glob in the packages list fails', () => {
  const members = target();
  assert.ok(run(members, { workspace: workspaceFor(members, { packages: ['packages/*'] }) }).some((problem) => problem.includes('not a glob (packages/*)')));
});

test('the lockfile: a link: between members that the manifest does not declare fails', () => {
  const members = target();
  const lock = ['importers:', '', '  .: {}', '', '  packages/javascript:', '    dependencies:', "      '@openpresentation/opf-render':", '        specifier: workspace:*', '        version: link:../render', ''].join('\n');
  const problems = run(members, { lock });
  assert.ok(problems.includes(`pnpm-lock.yaml: packages/javascript links ${N.render} (link:../render), which its package.json does not declare`));
  assert.ok(problems.some((problem) => problem.startsWith('cycle: ')), 'the lock edge closes the cycle');
  assert.deepEqual(run(target(), { lock: lock.replace('javascript', 'cli') }), []);
});

test('today: two members, cli -> opf as a registry range with the pnpm override, passes; without the override it fails', () => {
  const members = [
    member('javascript', { name: N.javascript, version: '0.25.0', dependencies: { [N.gallery]: '^5.0.0' }, devDependencies: { [N.render]: '0.25.0', [N.pptx]: '0.25.0' }, peerDependencies: { [N.render]: '^0.25.0', [N.pptx]: '^0.25.0' } }),
    member('cli', { name: N.cli, version: '0.25.0', dependencies: { [N.gallery]: '^5.0.0', [N.javascript]: '^0.25.0' }, devDependencies: { [N.render]: '0.25.0' }, peerDependencies: { [N.render]: '^0.25.0' } }),
  ];
  const overrides = { [`${N.cli}>${N.javascript}`]: 'workspace:*' };
  assert.deepEqual(run(members, { workspace: workspaceFor(members, { overrides }) }), []);
  assert.deepEqual(run(members), [`${N.cli}: dependencies ${N.javascript} is the registry specifier ^0.25.0; a workspace package is workspace:^`]);
});

test('the override is no longer accepted once all six are members', () => {
  const members = target();
  get(members, 'cli').dependencies[N.javascript] = '^0.26.0';
  const overrides = { [`${N.cli}>${N.javascript}`]: 'workspace:*' };
  assert.equal(run(members, { workspace: workspaceFor(members, { overrides }) }).length, 1);
});

test('parseWorkspaceYaml reads the package list, the overrides and top-level scalars', () => {
  const parsed = parseWorkspaceYaml(['packages:', '  - "packages/javascript"', "  - 'packages/cli'", '', '# comment', 'overrides:', '  "@a/b>@a/c": "workspace:*"', '  "x@<1": "1.0.0"', 'linkWorkspacePackages: false', 'ignoredBuiltDependencies:', '  - esbuild', ''].join('\n'));
  assert.deepEqual(parsed.packages, ['packages/javascript', 'packages/cli']);
  assert.deepEqual(parsed.overrides, { '@a/b>@a/c': 'workspace:*', 'x@<1': '1.0.0' });
  assert.equal(parsed.scalars.linkWorkspacePackages, 'false');
});

test('parseLockImporters reads the resolved version of each importer dependency', () => {
  const lock = ['lockfileVersion: 9.0', '', 'importers:', '', '  .:', '    devDependencies:', "      '@biomejs/biome':", '        specifier: ^2.5.3', '        version: 2.5.3', '', '  packages/cli:', '    dependencies:', "      '@openpresentation/opf':", '        specifier: workspace:*', '        version: link:../javascript', '', 'packages:', '', "  '@x/y@1.0.0':", '    version: 9'].join('\n');
  assert.deepEqual(parseLockImporters(lock), { '.': { '@biomejs/biome': '2.5.3' }, 'packages/cli': { '@openpresentation/opf': 'link:../javascript' } });
});

test('this repository passes check:workspace-graph', () => {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/check-workspace-graph.mjs'), root], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /check:workspace-graph ok/);
});
