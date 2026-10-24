import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { LEG_PLAN, PACKAGE_IDS, PACKAGES, TARGET_GRAPH, changedFiles, classifyPath, findCycle, isDependencyFile, isGoldenInput, legsFor, loadGraph, readManifestGraph, renderMarkdown, renderText, run, scope, withDependents } from './ci-scope.mjs';

const byId = Object.fromEntries(PACKAGES.map((pkg) => [pkg.id, pkg]));
const targetScope = (files, extra = {}) => scope({ files, graph: TARGET_GRAPH, ...extra });
const tiersOf = (decision) => Object.fromEntries(Object.entries(decision.packages).filter(([, tier]) => tier !== 'skip'));

function write(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
}

// A workspace of the six target packages plus integration, with the manifests the plan fixes (D12): runtime edges and peers
// `workspace:^`, devDependency edges `workspace:*`, core's optional peers on the engines (not edges) and a registry pin of
// a workspace package name that pnpm must not treat as an edge.
function writeWorkspace(root) {
  write(path.join(root, 'package.json'), { name: 'root', private: true });
  write(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n');
  const runtime = { core: ['gallery'], pptx: ['core', 'gallery'], render: ['core'], editor: ['core'], cli: ['core', 'gallery'] };
  for (const pkg of PACKAGES) {
    const dependencies = {};
    const devDependencies = {};
    for (const dependency of TARGET_GRAPH[pkg.id]) {
      if ((runtime[pkg.id] ?? []).includes(dependency)) dependencies[byId[dependency].name] = 'workspace:^';
      else devDependencies[byId[dependency].name] = 'workspace:*';
    }
    const manifest = { name: pkg.name, version: '0.26.0', ...(pkg.id === 'integration' ? { private: true } : {}), dependencies, devDependencies };
    if (pkg.id === 'core') {
      // Optional peers on the engines are not graph edges; the old registry pins must not become edges either.
      manifest.peerDependencies = { [byId.render.name]: 'workspace:^', [byId.pptx.name]: 'workspace:^' };
      manifest.peerDependenciesMeta = { [byId.render.name]: { optional: true }, [byId.pptx.name]: { optional: true } };
      manifest.devDependencies = { ...manifest.devDependencies, [byId.render.name]: '0.25.0', [byId.pptx.name]: '0.25.0' };
    }
    write(path.join(root, pkg.dir, 'package.json'), manifest);
  }
}

const git = (cwd, ...args) => {
  const result = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout;
};

function makeRepo() {
  const root = mkdtempSync(path.join(tmpdir(), 'ci-scope-'));
  git(root, 'init', '-q', '-b', 'main');
  writeWorkspace(root);
  for (const pkg of PACKAGES) write(path.join(root, pkg.dir, 'src', 'index.js'), 'export {};\n');
  write(path.join(root, 'spec', 'README.md'), 'spec\n');
  write(path.join(root, 'scripts', 'run-tests.mjs'), '\n');
  write(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'base');
  git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  return root;
}

function branchWith(root, name, files) {
  git(root, 'checkout', '-q', '-B', name, 'origin/main');
  for (const file of files) {
    const target = path.join(root, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, `${existsLine(target)}// ${name}\n`);
  }
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', name);
}
const existsLine = (target) => {
  try {
    return readFileSync(target, 'utf8');
  } catch {
    return '';
  }
};

const pnpmVersion = spawnSync('pnpm', ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' });
const pnpmAvailable = pnpmVersion.status === 0;

/** The projects pnpm selects for `filter`, as package ids (the workspace root is reported as "root"). */
function pnpmSelect(root, filter) {
  const result = spawnSync('pnpm', ['--filter', filter, 'list', '--depth', '-1', '--json'], { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
  assert.equal(result.status, 0, `pnpm --filter ${filter}: ${result.stderr}`);
  const names = new Map([['root', 'root'], ...PACKAGES.map((pkg) => [pkg.name, pkg.id])]);
  return JSON.parse(result.stdout || '[]').map((project) => names.get(project.name) ?? project.name);
}

test('TARGET_GRAPH is acyclic, gallery has no workspace edge, core only depends on gallery, integration on what it imports', () => {
  assert.equal(findCycle(TARGET_GRAPH), null);
  assert.deepEqual(TARGET_GRAPH.gallery, []);
  assert.deepEqual(TARGET_GRAPH.core, ['gallery']);
  assert.deepEqual(new Set(TARGET_GRAPH.integration), new Set(['gallery', 'core', 'render', 'pptx']), 'integration imports core, render, pptx and the gallery, not the editor or the CLI');
  for (const id of PACKAGE_IDS) assert.ok(id in TARGET_GRAPH, id);
  assert.deepEqual(findCycle({ a: ['b'], b: ['c'], c: ['a'] }), ['a', 'b', 'c', 'a']);
});

test('readManifestGraph sees pnpm edges only: workspace:, link: and file: in dependencies, devDependencies, optionalDependencies', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'ci-scope-manifests-'));
  try {
    writeWorkspace(root);
    const { graph, present } = readManifestGraph(root);
    assert.deepEqual(present, PACKAGE_IDS);
    for (const id of PACKAGE_IDS) assert.deepEqual(new Set(graph[id]), new Set(TARGET_GRAPH[id]), `${id} edges equal the plan's graph`);
    // Peers and registry pins are not edges: core lists render and pptx as optional peers and devDependency pins.
    assert.equal(graph.core.includes('render'), false);
    assert.equal(graph.core.includes('pptx'), false);
    write(path.join(root, byId.cli.dir, 'package.json'), { name: byId.cli.name, dependencies: { [byId.core.name]: '^0.25.0' }, optionalDependencies: { [byId.render.name]: 'link:../render' }, devDependencies: { [byId.pptx.name]: 'file:../pptx' } });
    assert.deepEqual(new Set(readManifestGraph(root).graph.cli), new Set(['render', 'pptx']), 'a registry range is not an edge; link: and file: are');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('graph sources: manifests, target, union (fail closed) and a JSON file', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'ci-scope-sources-'));
  try {
    // Only core and the CLI exist, as in the repository before the import; the CLI is not wired to gallery yet.
    for (const id of ['core', 'cli']) write(path.join(root, byId[id].dir, 'package.json'), { name: byId[id].name, dependencies: id === 'cli' ? { [byId.core.name]: 'workspace:*' } : { [byId.gallery.name]: '^5.0.0' } });
    const manifests = loadGraph(root, 'manifests');
    assert.deepEqual(manifests.present, ['core', 'cli']);
    assert.deepEqual(manifests.graph.core, [], 'a registry range of gallery is not an edge');
    assert.deepEqual(manifests.graph.cli, ['core']);
    assert.equal(withDependents(manifests.graph, ['gallery']).join(), 'gallery', 'manifests alone do not see that core depends on gallery');
    const union = loadGraph(root, 'union');
    assert.equal(withDependents(union.graph, ['gallery']).join(), PACKAGE_IDS.join(), 'the union keeps the target edges, so a gallery change affects everything');
    assert.deepEqual(loadGraph(root, 'target').graph, TARGET_GRAPH);
    write(path.join(root, 'graph.json'), { cli: ['render'] });
    assert.deepEqual(loadGraph(root, 'graph.json').graph.cli, ['render']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the real repository manifests have no cycle and the union graph is acyclic', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  for (const source of ['manifests', 'union']) assert.equal(findCycle(loadGraph(root, source).graph), null, source);
});

test('classifyPath: package directories, core inputs, documentation, tooling and the unknown', () => {
  const cases = [
    ['packages/javascript/src/annotations.ts', { kind: 'package', package: 'core' }],
    ['packages/cli/src/args.ts', { kind: 'package', package: 'cli' }],
    ['packages/render/src/charts.js', { kind: 'package', package: 'render' }],
    ['packages/render/test/golden/a.sha256.json', { kind: 'package', package: 'render' }],
    ['packages/pptx/vendor/pptxgenjs/x.js', { kind: 'package', package: 'pptx' }],
    ['packages/editor/src/a.js', { kind: 'package', package: 'editor' }],
    ['packages/gallery/catalog/layouts/hero.json', { kind: 'package', package: 'gallery' }],
    ['packages/integration/test/a.mjs', { kind: 'package', package: 'integration' }],
    ['packages/render/docs/evidence/native/log.txt', { kind: 'docs' }],
    ['packages/render/docs/evidence/native/deck.opf.json', { kind: 'package', package: 'render' }],
    ['packages/render/docs/usage.md', { kind: 'package', package: 'render' }],
    ['spec/README.md', { kind: 'package', package: 'core' }],
    ['spec/schemas/opf.schema.json', { kind: 'package', package: 'core' }],
    ['examples/minimal.opf.json', { kind: 'package', package: 'core' }],
    ['skills/opf-author/SKILL.md', { kind: 'package', package: 'core' }],
    ['README.md', { kind: 'package', package: 'core' }],
    ['docs/cli.md', { kind: 'package', package: 'core' }],
    ['docs/fixtures/color-references.opf.json', { kind: 'package', package: 'core' }],
    ['docs/evidence/native/deck.opf.json', { kind: 'package', package: 'core' }],
    ['docs/evidence/native/shot.png', { kind: 'docs' }],
    ['docs/programs/monorepo/README.md', { kind: 'docs' }],
    ['docs/quickstart/step.md', { kind: 'package', package: 'core' }],
    ['docs/first-deck/deck.opf.json', { kind: 'package', package: 'core' }],
    ['docs/demos/partner/partner-demo.opf.json', { kind: 'package', package: 'core' }],
    ['docs/demos/partner/verification.json', { kind: 'docs' }],
    ['docs/programs/x/deck.opf.json', { kind: 'docs' }],
    ['docs/plans/x.md', { kind: 'docs' }],
    ['AGENTS.md', { kind: 'docs' }],
    ['CHANGELOG.md', { kind: 'docs' }],
    ['changes/mr-14-ci-scope.md', { kind: 'docs' }],
    ['.claude/settings.json', { kind: 'docs' }],
    ['scripts/run-tests.mjs', { kind: 'all', reason: 'tooling' }],
    ['test/quarantine.json', { kind: 'all', reason: 'tooling' }],
    ['pnpm-lock.yaml', { kind: 'all', reason: 'tooling' }],
    ['pnpm-workspace.yaml', { kind: 'all', reason: 'tooling' }],
    ['package.json', { kind: 'all', reason: 'tooling' }],
    ['biome.json', { kind: 'all', reason: 'tooling' }],
    ['.nvmrc', { kind: 'all', reason: 'tooling' }],
    ['.gitattributes', { kind: 'all', reason: 'tooling' }],
    ['.github/workflows/ci.yml', { kind: 'all', reason: 'workflow' }],
    ['.github/actions/x/action.yml', { kind: 'all', reason: 'tooling' }],
    ['.github/dependabot.yml', { kind: 'all', reason: 'tooling' }],
    ['packages/newthing/package.json', { kind: 'all', reason: 'unknown package directory packages/newthing' }],
    ['somewhere/else.txt', { kind: 'all', reason: 'unclassified' }],
    ['./spec/README.md', { kind: 'package', package: 'core' }],
  ];
  for (const [file, expected] of cases) assert.deepEqual(classifyPath(file), expected, file);
});

test('every package directory of the plan has a path rule, and a prefix of another package does not match', () => {
  for (const pkg of PACKAGES) assert.deepEqual(classifyPath(`${pkg.dir}/x`), { kind: 'package', package: pkg.id });
  assert.equal(classifyPath('packages/javascript-extra/x').kind, 'all', 'packages/javascript-extra is not packages/javascript');
});

test('S5 scenarios against the real `pnpm --filter "...[base]"`', { skip: pnpmAvailable ? false : 'pnpm is not installed' }, () => {
  const root = makeRepo();
  try {
    const scenarios = [
      ['editor-only', ['packages/editor/src/index.js']],
      ['CLI-only', ['packages/cli/src/index.js']],
      ['renderer', ['packages/render/src/index.js']],
      ['PPTX', ['packages/pptx/src/index.js']],
      ['core', ['packages/javascript/src/index.js']],
      ['cross-cutting', ['packages/javascript/src/index.js', 'packages/render/src/index.js', 'packages/editor/src/index.js']],
      ['gallery records', ['packages/gallery/src/index.js']],
      ['integration', ['packages/integration/src/index.js']],
    ];
    const { graph } = loadGraph(root, 'manifests');
    for (const [name, files] of scenarios) {
      branchWith(root, `scenario-${name.replace(/\W+/g, '-')}`, files);
      const decision = scope({ files: changedFiles('origin/main', 'HEAD', root), graph });
      // The changed-only filter is checked on the cross-cutting scenario; the others compare the affected set, which contains it.
      const pnpmChanged = name === 'cross-cutting' ? pnpmSelect(root, '[origin/main]') : null;
      const pnpmAffected = pnpmSelect(root, '...[origin/main]');
      if (pnpmChanged) assert.deepEqual(decision.changed, PACKAGE_IDS.filter((id) => pnpmChanged.includes(id)), `${name}: changed`);
      assert.deepEqual(decision.affected, PACKAGE_IDS.filter((id) => pnpmAffected.includes(id)), `${name}: changed plus dependents`);
      assert.equal(decision.forced, false, name);
    }
    // The plan's S5 table, spelled out, so a graph change that keeps both sides equal still has to be deliberate.
    const expected = {
      'editor-only': ['editor'],
      'CLI-only': ['cli'],
      renderer: ['render', 'pptx', 'editor', 'cli', 'integration'],
      PPTX: ['pptx', 'editor', 'cli', 'integration'],
      core: ['core', 'render', 'pptx', 'editor', 'cli', 'integration'],
      'cross-cutting': ['core', 'render', 'pptx', 'editor', 'cli', 'integration'],
      'gallery records': PACKAGE_IDS,
      integration: ['integration'],
    };
    for (const [name, files] of scenarios) assert.deepEqual(scope({ files, graph }).affected.sort(), [...expected[name]].sort(), name);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('root-owned paths: pnpm selects only the root project, so the path map decides (the reason ci-scope exists)', { skip: pnpmAvailable ? false : 'pnpm is not installed' }, () => {
  const root = makeRepo();
  try {
    const { graph } = loadGraph(root, 'manifests');
    const cases = [
      ['spec/README.md', 'core', (d) => d.changed.join() === 'core'],
      ['docs/programs/monorepo/README.md', 'docs', (d) => d.changed.length === 0 && d.forced === false],
      ['scripts/run-tests.mjs', 'all', (d) => d.forced === true],
      ['pnpm-lock.yaml', 'all', (d) => d.forced === true],
      ['.github/workflows/ci.yml', 'all', (d) => d.forced === true],
    ];
    for (const [file, tier, holds] of cases) {
      branchWith(root, `root-${file.replace(/\W+/g, '-')}`, [file]);
      assert.deepEqual(pnpmSelect(root, '...[origin/main]'), ['root'], `pnpm selects only the root for ${file}`);
      const decision = scope({ files: changedFiles('origin/main', 'HEAD', root), graph });
      assert.equal(decision.tier, tier, `${file}: class`);
      assert.ok(holds(decision), file);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('tiers: changed packages run full, dependents contract, the rest skip', () => {
  const editor = targetScope(['packages/editor/src/a.js']);
  assert.deepEqual(tiersOf(editor), { editor: 'full' }, 'an editor-only change does not select integration');
  assert.equal(editor.tier, 'leaf');
  assert.equal(editor.jobs.goldens, 'skip');
  assert.equal(editor.jobs['gallery-gates'], 'skip');

  const cli = targetScope(['packages/cli/src/a.ts']);
  assert.deepEqual(tiersOf(cli), { cli: 'full' }, 'a CLI-only change does not select integration');
  assert.equal(cli.tier, 'leaf');

  const render = targetScope(['packages/render/src/charts.js']);
  assert.deepEqual(tiersOf(render), { render: 'full', pptx: 'contract', editor: 'contract', cli: 'contract', integration: 'contract' });
  assert.equal(render.tier, 'engine');
  assert.equal(render.jobs.goldens, 'full');
  assert.equal(render.jobs['gallery-gates'], 'full');

  const pptx = targetScope(['packages/pptx/src/native-body.js']);
  assert.deepEqual(tiersOf(pptx), { pptx: 'full', editor: 'contract', cli: 'contract', integration: 'contract' });
  assert.equal(pptx.tier, 'engine');
  assert.equal(pptx.jobs.goldens, 'skip', 'pptx changes do not touch the golden corpus');
  assert.equal(pptx.jobs['gallery-gates'], 'skip');

  const core = targetScope(['packages/javascript/src/annotations.ts']);
  assert.deepEqual(tiersOf(core), { core: 'full', render: 'contract', pptx: 'contract', editor: 'contract', cli: 'contract', integration: 'contract' });
  assert.equal(core.tier, 'core');
  assert.equal(core.jobs.goldens, 'full');
  assert.equal(core.jobs['gallery-gates'], 'full');

  const cross = targetScope(['packages/javascript/src/a.ts', 'packages/render/src/a.js', 'packages/editor/src/a.js']);
  assert.deepEqual(tiersOf(cross), { core: 'full', render: 'full', editor: 'full', pptx: 'contract', cli: 'contract', integration: 'contract' });
  assert.deepEqual(cross.changed, ['core', 'render', 'editor']);
});

test('edge case: gallery records only affect every package at the contract tier and run the goldens and the gallery gates', () => {
  const decision = targetScope(['packages/gallery/catalog/layouts/hero.json', 'packages/gallery/previews/layouts/hero.svg']);
  assert.deepEqual(decision.changed, ['gallery']);
  assert.deepEqual(decision.affected, PACKAGE_IDS);
  assert.equal(decision.packages.gallery, 'full');
  for (const id of PACKAGE_IDS.filter((name) => name !== 'gallery')) assert.equal(decision.packages[id], 'contract', id);
  assert.equal(decision.jobs.goldens, 'full');
  assert.equal(decision.jobs['gallery-gates'], 'full');
  assert.equal(decision.tier, 'core');
  assert.equal(decision.forced, false);
});

test('edge case: docs only (programs, evidence, root documents, changes) runs lint and nothing else', () => {
  const decision = targetScope(['docs/programs/monorepo/burndown.md', 'docs/evidence/native/shot.png', 'AGENTS.md', 'changes/x.md', 'docs/plans/a.md', 'llms.txt']);
  assert.equal(decision.tier, 'docs');
  assert.deepEqual(decision.changed, []);
  assert.deepEqual(decision.affected, []);
  assert.deepEqual(decision.required, ['lint']);
  assert.equal(decision.forced, false);
  assert.deepEqual(decision.matrix, []);
});

test('edge case: a docs/*.md file is a core input (the core build embeds it), an evidence deck too', () => {
  const doc = targetScope(['docs/cli.md']);
  assert.deepEqual(doc.changed, ['core']);
  assert.equal(doc.packages.core, 'full');
  assert.equal(doc.jobs.goldens, 'skip', 'a markdown file is not a golden input');
  const deck = targetScope(['docs/evidence/native/a.opf.json']);
  assert.deepEqual(deck.changed, ['core']);
});

test('edge case: spec/ and examples/ map to core, examples also run the goldens', () => {
  const spec = targetScope(['spec/schemas/opf.schema.json']);
  assert.deepEqual(spec.changed, ['core']);
  assert.equal(spec.packages.render, 'contract');
  assert.equal(spec.jobs.goldens, 'skip');
  const examples = targetScope(['examples/minimal.opf.json']);
  assert.deepEqual(examples.changed, ['core']);
  assert.equal(examples.jobs.goldens, 'full');
  const reference = targetScope(['spec/reference/engine-defaults.json']);
  assert.equal(reference.jobs.goldens, 'full');
});

test('edge case: lockfile only, root configuration, scripts and workflows run everything at full', () => {
  for (const file of ['pnpm-lock.yaml', 'pnpm-workspace.yaml', 'package.json', 'biome.json', '.nvmrc', 'scripts/run-tests.mjs', '.github/workflows/ci.yml', '.gitattributes', 'test/quarantine.json']) {
    const decision = targetScope([file]);
    assert.equal(decision.forced, true, file);
    assert.equal(decision.tier, 'all', file);
    assert.deepEqual(decision.affected, PACKAGE_IDS, file);
    for (const id of PACKAGE_IDS) assert.equal(decision.packages[id], 'full', `${file}: ${id}`);
    assert.deepEqual(decision.skipped.filter((job) => job !== 'audit'), [], file); // audit follows the changed files, not the force
    assert.deepEqual(decision.unclassified, [], `${file} is classified`);
  }
});

test('edge case: unclassified paths and unknown package directories fail closed and are reported', () => {
  const decision = targetScope(['somewhere/else.txt', 'packages/newthing/index.js', 'docs/programs/a.md']);
  assert.equal(decision.forced, true);
  assert.deepEqual(decision.unclassified, ['somewhere/else.txt', 'packages/newthing/index.js']);
  assert.equal(decision.tier, 'all');
});

test('edge case: a package manifest change selects that package and its dependents', () => {
  const decision = targetScope(['packages/pptx/package.json']);
  assert.deepEqual(decision.changed, ['pptx']);
  assert.equal(decision.packages.editor, 'contract');
  assert.equal(decision.jobs['pack-shape'], 'full');
});

test('edge case: package evidence logs are documentation, a package change in the same diff is not', () => {
  const evidence = targetScope(['packages/pptx/docs/evidence/native/log.txt']);
  assert.equal(evidence.tier, 'docs');
  assert.deepEqual(evidence.required, ['lint']);
  const mixed = targetScope(['packages/pptx/docs/evidence/native/log.txt', 'packages/pptx/src/a.js']);
  assert.deepEqual(mixed.changed, ['pptx']);
});

test('edge case: events other than a pull request, the label full-ci and an empty diff run everything', () => {
  for (const event of ['push', 'schedule', 'workflow_dispatch', 'release']) {
    const decision = targetScope(['docs/programs/a.md'], { event });
    assert.equal(decision.forced, true, event);
    assert.equal(decision.tier, 'all', event);
    assert.deepEqual(decision.skipped.filter((job) => job !== 'audit'), [], event);
  }
  const labelled = targetScope(['packages/editor/src/a.js'], { labels: ['full-ci'] });
  assert.equal(labelled.forced, true);
  assert.equal(labelled.slow, true);
  assert.equal(labelled.packages.core, 'full');
  assert.equal(targetScope(['packages/editor/src/a.js'], { labels: ['bug'] }).slow, false);
  const empty = targetScope([]);
  assert.equal(empty.forced, true);
  assert.match(empty.reasons.join(' '), /no changed paths/);
});

test('required and skipped partition the jobs; the matrix lists the package jobs that run', () => {
  const decision = targetScope(['packages/render/src/a.js']);
  assert.deepEqual([...decision.required, ...decision.skipped].sort(), Object.keys(decision.jobs).sort());
  assert.deepEqual(decision.matrix, [
    { package: 'render', tier: 'full' },
    { package: 'pptx', tier: 'contract' },
    { package: 'editor', tier: 'contract' },
    { package: 'cli', tier: 'contract' },
    { package: 'integration', tier: 'contract' },
  ]);
  assert.equal(decision.jobs.lint, 'full', 'lint always runs');
});

test('legs: every package has a plan for both tiers, a skipped package has no legs, browser suites only run at full', () => {
  assert.deepEqual(Object.keys(LEG_PLAN).sort(), ['lint', ...PACKAGE_IDS].sort());
  for (const id of Object.keys(LEG_PLAN)) {
    assert.deepEqual(legsFor(id, 'skip'), []);
    for (const tier of id === 'lint' ? ['full', 'docs'] : ['full', 'contract']) {
      const legs = legsFor(id, tier);
      assert.ok(legs.length > 0, `${id} ${tier}`);
      assert.ok(legs.some((leg) => leg.kind === (id === 'lint' ? (tier === 'docs' ? 'docs' : 'static') : 'tests')), `${id} ${tier} runs its tests`);
      for (const leg of legs) assert.deepEqual(Object.keys(leg).sort(), ['count', 'index', 'kind', 'name', 'package', 'tier'], `${id} ${leg.name}`);
    }
    if (id !== 'lint') assert.deepEqual(legsFor(id, 'contract').filter((leg) => leg.kind !== 'tests'), [], `${id}: a dependent runs no browser suite`);
  }
  assert.deepEqual(legsFor('render', 'full').map((leg) => leg.name), ['tests 1/4', 'tests 2/4', 'tests 3/4', 'tests 4/4', 'browser']);
  assert.deepEqual(legsFor('editor', 'full').map((leg) => leg.name), ['tests 1/2', 'tests 2/2', 'playground 1/4', 'playground 2/4', 'playground 3/4', 'playground 4/4', 'browser 1/2', 'browser 2/2']);
  assert.deepEqual(legsFor('pptx', 'contract').map((leg) => `${leg.index}/${leg.count}`), ['1/4', '2/4', '3/4', '4/4']);
  assert.deepEqual(legsFor('lint', 'full').map((leg) => leg.name), ['static', 'checks 1/2', 'checks 2/2']);
});

test('legs follow the tiers of the decision: only packages that run have legs, forced runs have every leg', () => {
  const engine = targetScope(['packages/render/src/a.js']);
  assert.deepEqual(Object.entries(engine.legs).filter(([, legs]) => legs.length).map(([id]) => id), ['lint', 'render', 'pptx', 'editor', 'cli', 'integration']);
  assert.deepEqual(targetScope(['packages/editor/src/a.js']).legs.integration, [], 'an editor-only change runs no integration leg');
  assert.equal(engine.legs.render.length, 5);
  assert.equal(engine.legs.lint.length, 3, 'lint always has its legs');
  assert.equal(engine.legs.pptx.length, 4, 'a dependent runs its contract suite in four shards');
  assert.deepEqual(engine.legs.gallery, []);
  const forced = targetScope(['scripts/anything.mjs']);
  assert.equal(forced.legs.render.length, 5);
  assert.equal(forced.legs.editor.length, 8);
  assert.equal(forced.legs.gallery.length, 1);
  const docs = targetScope(['docs/programs/monorepo/README.md']);
  assert.deepEqual(Object.entries(docs.legs).filter(([, legs]) => legs.length).map(([id]) => id), ['lint'], 'a docs-only change runs lint and nothing else');
  assert.deepEqual(docs.legs.lint.map((leg) => leg.kind), ['docs'], 'and lint is the one lightweight docs leg');
  assert.deepEqual(targetScope(['packages/editor/src/a.js']).legs.lint.map((leg) => leg.kind), ['static', 'checks', 'checks']);
  assert.deepEqual(targetScope(['docs/programs/a.md'], { event: 'push' }).legs.lint.map((leg) => leg.kind), ['static', 'checks', 'checks'], 'a push to main runs the full lint');
  assert.deepEqual(targetScope(['docs/programs/a.md'], { labels: ['full-ci'] }).legs.lint.map((leg) => leg.kind), ['static', 'checks', 'checks']);
});

test('audit runs when the lockfile or a package manifest changed, and not because a run was forced', () => {
  for (const file of ['pnpm-lock.yaml', 'package.json', 'packages/render/package.json', 'packages/javascript/package.json']) assert.equal(isDependencyFile(file), true, file);
  for (const file of ['packages/render/src/package.json', 'packages/render/package.json.md', 'docs/package.json', 'pnpm-workspace.yaml']) assert.equal(isDependencyFile(file), false, file);
  assert.equal(targetScope(['pnpm-lock.yaml']).jobs.audit, 'full');
  assert.equal(targetScope(['packages/editor/package.json', 'packages/editor/src/a.js']).jobs.audit, 'full');
  for (const input of [{ files: ['packages/editor/src/a.js'] }, { files: ['docs/a.md'] }, { files: ['scripts/a.mjs'] }, { files: ['packages/editor/src/a.js'], event: 'push' }, { files: ['packages/editor/src/a.js'], labels: ['full-ci'] }]) {
    assert.equal(targetScope(input.files, input).jobs.audit, 'skip', JSON.stringify(input));
  }
});

test('isGoldenInput lists the corpus inputs only', () => {
  for (const file of ['packages/render/src/a.js', 'packages/render/fonts/x.woff2', 'packages/render/test/golden/a.sha256.json', 'packages/javascript/src/composition.ts', 'packages/gallery/catalog/a.json', 'examples/a.opf.json', 'spec/reference/font-policy.json']) assert.equal(isGoldenInput(file), true, file);
  for (const file of ['packages/render/test/a.mjs', 'packages/pptx/src/a.js', 'packages/editor/src/a.js', 'packages/cli/src/a.ts', 'docs/cli.md', 'packages/javascript/test/a.mjs']) assert.equal(isGoldenInput(file), false, file);
});

test('changedFiles lists the paths of the pull request (three-dot), both sides of a rename and odd file names', () => {
  const root = makeRepo();
  try {
    git(root, 'checkout', '-q', '-B', 'feature', 'origin/main');
    write(path.join(root, 'packages/editor/src/with space.js'), 'a\n');
    mkdirSync(path.join(root, 'docs', 'programs'), { recursive: true });
    git(root, 'mv', 'packages/render/src/index.js', 'docs/programs/moved.js');
    git(root, 'add', '-A');
    git(root, 'commit', '-qm', 'feature');
    // main moves on after the branch point: the three-dot diff must not list main's own change.
    git(root, 'checkout', '-q', '-B', 'main', 'origin/main');
    write(path.join(root, 'scripts/other.mjs'), 'x\n');
    git(root, 'add', '-A');
    git(root, 'commit', '-qm', 'main moved');
    git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    git(root, 'checkout', '-q', 'feature');
    assert.deepEqual(changedFiles('origin/main', 'HEAD', root).sort(), ['docs/programs/moved.js', 'packages/editor/src/with space.js', 'packages/render/src/index.js']);
    const decision = scope({ files: changedFiles('origin/main', 'HEAD', root), graph: TARGET_GRAPH });
    assert.deepEqual(decision.changed, ['render', 'editor'], 'moving a renderer file out of the package still selects the renderer');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('run: --files, formats, GitHub outputs and the fail-closed fallback when the diff cannot be read', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'ci-scope-run-'));
  try {
    const output = path.join(root, 'output.txt');
    const summary = path.join(root, 'summary.md');
    const env = { GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary };
    const { decision, text } = run(['--files', 'packages/render/src/a.js', 'spec/README.md', '--github-output', '--summary', '--graph', 'target'], env);
    assert.deepEqual(decision.changed, ['core', 'render']);
    assert.equal(decision.graph, 'target');
    assert.deepEqual(JSON.parse(text).changed, ['core', 'render']);
    const lines = Object.fromEntries(readFileSync(output, 'utf8').trim().split('\n').map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
    assert.equal(lines.tier, 'core');
    assert.deepEqual(JSON.parse(lines.changed), ['core', 'render']);
    assert.deepEqual(JSON.parse(lines.jobs), decision.jobs);
    assert.deepEqual(JSON.parse(lines.matrix), decision.matrix);
    assert.deepEqual(JSON.parse(lines.legs), decision.legs);
    assert.equal(lines.forced, 'false');
    assert.match(readFileSync(summary, 'utf8'), /\| render \| full \|/);
    assert.match(run(['--files', 'spec/README.md', '--format', 'text'], {}).text, /^ci-scope: 1 changed path, class core/);
    assert.match(renderText(decision), /jobs:/);
    assert.match(renderMarkdown(decision), /^### ci-scope \(shadow\)/);
    // A base that does not exist: the diff cannot be read, so everything runs.
    const failed = run(['--base', 'no-such-ref', '--head', 'HEAD'], {}, root).decision;
    assert.equal(failed.forced, true);
    assert.equal(failed.tier, 'all');
    assert.match(failed.reasons[0], /could not list the changed paths/);
    assert.equal(run(['--files', 'spec/README.md', '--event', ''], { GITHUB_EVENT_NAME: 'push' }).decision.event, 'push', 'an empty --event falls back to the workflow event');
    assert.equal(run(['--files', 'spec/README.md'], {}).decision.event, 'pull_request', 'a local run is a pull request');
    assert.throws(() => run(['--frobnicate'], {}), /unknown argument/);
    assert.throws(() => run(['--format', 'yaml'], {}), /--format must be/);
    assert.throws(() => run(['--base'], {}), /needs a value/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the command line prints JSON and exits 2 on a bad argument', () => {
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ci-scope.mjs');
  const ok = spawnSync(process.execPath, [script, '--files', 'packages/cli/src/a.ts'], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.deepEqual(JSON.parse(ok.stdout).changed, ['cli']);
  const bad = spawnSync(process.execPath, [script, '--nope'], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /unknown argument/);
});
