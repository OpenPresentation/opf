import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { selectChecks } from './run-checks.mjs';
import { PACKAGES, biomeBatches, buildPlan, changedFiles, formatTable, matches, phases, referencedPaths, reuseToken, runCommand, selectChangedChecks, selectPackageTests, splitPaths } from './check-changed.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scripts = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
const config = JSON.parse(readFileSync(path.join(root, 'scripts', 'checks.json'), 'utf8'));
const opf = { id: 'opf', dir: 'packages/javascript', filter: '@openpresentation/opf' };
const packages = { opf: { suites: { exclude: ['diff-support.mjs'] }, present: ['a.test.mjs', 'b.mjs', 'diff-support.mjs', 'x-browser.mjs'], distExists: true }, cli: { suites: {}, present: [], distExists: true } };
const env = { scripts, config, needsInstall: false, packages, exists: () => true };

test('check:changed is not one of the checks of pnpm test, and the checks.json rules name real scripts', () => {
  assert.equal(selectChecks(scripts, config).includes('check:changed'), false);
  assert.ok(selectChecks(scripts, config).includes('check:agent-tools'));
  for (const rule of config.changed.rules) for (const name of rule.run) assert.ok(name in scripts, `${name} is a root script`);
  for (const name of config.changed.always) assert.ok(name in scripts, `${name} is a root script`);
});

test('splitPaths, matches and referencedPaths', () => {
  assert.deepEqual(splitPaths('a/b.mjs\0c.md\0'), ['a/b.mjs', 'c.md']);
  assert.equal(matches('spec/schemas/x.json', 'spec/schemas/'), true);
  assert.equal(matches('spec/schemas', 'spec/schemas/'), false);
  assert.equal(matches('package.json', 'package.json'), true);
  assert.equal(matches('packages/cli/package.json', 'package.json'), false);
  assert.deepEqual(referencedPaths('node --test scripts/a.test.mjs && node scripts/a.mjs --check'), ['scripts/a.test.mjs', 'scripts/a.mjs']);
});

test('selectChangedChecks maps changed paths to checks', () => {
  const docs = selectChangedChecks(['docs/agent-skills.md'], scripts, config);
  assert.deepEqual(docs, ['check:changes', 'check:skill-commands', 'check:text']);
  const schema = selectChangedChecks(['spec/schemas/opf.schema.json'], scripts, config);
  for (const name of ['check:schema-docs', 'check:registry-golden', 'check:spec']) assert.ok(schema.includes(name), name);
  const catalog = selectChangedChecks(['spec/schemas/layout.schema.json'], scripts, config);
  assert.ok(catalog.includes('check:spec'));
  // A check whose command names the changed file runs, with no rule needed.
  assert.ok(selectChangedChecks(['scripts/check-text-integrity.mjs'], scripts, config).includes('check:text'));
  assert.ok(selectChangedChecks(['scripts/quarantine.test.mjs'], scripts, config).includes('check:quarantine'));
  assert.throws(() => selectChangedChecks(['x/'], scripts, { changed: { always: ['check:nope'] } }), /not a root script/);
});

test('selectPackageTests runs the whole package for code and only the changed files for test-only changes', () => {
  assert.equal(selectPackageTests(opf, ['docs/x.md'], packages.opf), null);
  assert.equal(selectPackageTests(opf, ['packages/javascript/README.md'], packages.opf), null);
  assert.deepEqual(selectPackageTests(opf, ['packages/javascript/src/index.ts'], packages.opf), { ...opf, scope: 'all', build: true });
  assert.deepEqual(selectPackageTests(opf, ['packages/javascript/test/a.test.mjs', 'packages/javascript/test/b.mjs'], packages.opf), { ...opf, scope: 'files', files: ['a.test.mjs', 'b.mjs'], build: false });
  assert.equal(selectPackageTests(opf, ['packages/javascript/test/diff-support.mjs'], packages.opf).scope, 'all');
  assert.equal(selectPackageTests(opf, ['packages/javascript/test/x-browser.mjs'], packages.opf).scope, 'none');
  assert.equal(selectPackageTests(opf, ['packages/javascript/test/b.mjs'], { ...packages.opf, distExists: false }).build, true);
});

test('buildPlan: a docs-only change runs the text and skill-command checks only; a .ts change adds the type check and the package tests', () => {
  const docs = buildPlan(['docs/agent-skills.md'], env);
  assert.deepEqual(docs.map((step) => step.name), ['build', 'biome', 'pnpm run check:changes', 'pnpm run check:skill-commands', 'pnpm run check:text', 'typecheck']);
  assert.equal(docs.find((step) => step.name === 'biome').skip, true);
  assert.equal(docs.at(-1).skip, true);

  const code = buildPlan(['packages/javascript/src/index.ts'], env);
  assert.deepEqual(code.map((step) => step.name), ['build', 'biome', 'pnpm run check:browser-safe', 'pnpm run check:catalog-free', 'pnpm run check:changes', 'pnpm run check:font-hotlinks', 'pnpm run check:text', 'typecheck', 'tests opf']);
  const typecheck = code.find((step) => step.name === 'typecheck');
  assert.ok(typecheck.heavy && typecheck.commands[0].argv.some((part) => part.endsWith('agent-slot.mjs')));
  assert.equal(code.find((step) => step.name === 'biome').biome[0], 'packages/javascript/src/index.ts');

  assert.deepEqual(buildPlan(['x.md'], { ...env, needsInstall: true }).slice(0, 3).map((step) => step.name), ['install', 'build', 'biome'], 'the build follows the install');
  assert.equal(buildPlan(['x.md'], { ...env, needsInstall: true })[0].name, 'install');
  assert.equal(buildPlan(['gone.mjs'], { ...env, exists: () => false }).find((step) => step.name === 'biome').skip, true, 'a deleted file is not given to Biome');
});

// MR-23f: the checks import dist/, which a fresh worktree does not have, and two checks that built it ran side by side
// (tsup cleans dist/): check:skill-commands, check:stability, check:browser-safe and check:native-acceptance failed inside
// `pnpm check:changed` and passed alone after a build. One build runs first, and the rest reuses it.
test('MR-23f: one build step runs after the install and before every check, the type check and the package tests', () => {
  const plan = buildPlan(['packages/javascript/src/index.ts', 'packages/cli/src/index.ts', 'scripts/gallery-stability.mjs', 'scripts/check-skill-commands.mjs'], { ...env, needsInstall: true });
  const builds = plan.filter((step) => step.build);
  assert.equal(builds.length, 1, 'exactly one build step');
  const argv = builds[0].commands[0].argv;
  assert.deepEqual(argv.slice(-3), ['pnpm', 'run', 'build:packages']);
  assert.ok(argv.some((part) => part.endsWith('agent-slot.mjs')), 'the build waits for a machine slot like the other heavy commands');
  const order = phases(plan);
  assert.equal(order.install.length, 1);
  assert.equal(order.build.length, 1);
  assert.ok(order.light.length > 3 && order.heavy.length >= 2, 'checks and heavy steps are in the plan');
  const start = (list) => Math.min(...list);
  const end = (list) => Math.max(...list);
  const names = plan.map((step) => step.name);
  for (const name of ['pnpm run check:skill-commands', 'pnpm run check:stability', 'pnpm run check:browser-safe']) assert.ok(order.light.includes(names.indexOf(name)), name);
  // The phases run one after another (install, build, the cheap checks, the heavy steps), so none overlaps another.
  assert.ok(end(order.install) < start(order.build));
  assert.ok(end(order.build) < start(order.light));
  // Every step belongs to exactly one phase, so none is dropped or run twice.
  const all = [...order.install, ...order.build, ...order.light, ...order.heavy].sort((a, b) => a - b);
  assert.deepEqual(all, plan.map((_step, index) => index));
});

test('MR-23f: a change Biome alone handles adds no build, and a skipped step is in no phase', () => {
  const plan = buildPlan(['x.md'], { ...env, config: { ...config, changed: {} }, scripts: {} });
  assert.deepEqual(plan.map((step) => step.name), ['biome', 'typecheck']);
  assert.equal(plan.some((step) => step.build), false);
  const order = phases(plan);
  assert.deepEqual([...order.install, ...order.build, ...order.light], []);
  assert.deepEqual(order.heavy, [0, 1], 'skipped steps still appear, as skipped, in the table');
});

test('MR-23f: a run reuses its own build and no other run reuses it', () => {
  assert.notEqual(reuseToken(1, 1), reuseToken(1, 2));
  assert.notEqual(reuseToken(1, 1), reuseToken(2, 1));
  assert.match(reuseToken(), /^check-changed-\d+-\d+$/);
});

test('MR-23f: --plan lists the build before the first check', () => {
  const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'check-changed.mjs'), '--plan', '--files', 'packages/javascript/src/index.ts'], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const lines = run.stdout.split('\n').filter((line) => line.startsWith('run '));
  const names = lines.map((line) => line.slice(5).trim());
  assert.ok(names.includes('build'));
  assert.ok(names.indexOf('build') < names.indexOf('pnpm run check:changes'));
  assert.ok(names.indexOf('build') < names.indexOf('typecheck'));
});

// MR-11, MR-23: the seven packages of the monorepo and the private packages/integration; a change in one selects that package's tests.
test('MR-11: PACKAGES lists the seven packages of the monorepo and the integration tests, each with its own directory, filter and script', () => {
  assert.deepEqual(PACKAGES.map((pkg) => pkg.id), ['opf', 'cli', 'mcp', 'render', 'pptx', 'editor', 'gallery', 'integration']);
  assert.deepEqual(PACKAGES.map((pkg) => pkg.dir), ['packages/javascript', 'packages/cli', 'packages/mcp', 'packages/render', 'packages/pptx', 'packages/editor', 'packages/gallery', 'packages/integration']);
  assert.deepEqual(PACKAGES.map((pkg) => pkg.filter), ['@openpresentation/opf', '@openpresentation/cli', '@openpresentation/mcp', '@openpresentation/opf-render', '@openpresentation/opf-pptx', '@openpresentation/opf-editor', '@openpresentation/gallery', '@openpresentation/integration']);
  assert.equal(new Set(PACKAGES.map((pkg) => pkg.dir)).size, PACKAGES.length);
  for (const pkg of PACKAGES) assert.ok(['test', 'test:contract'].includes(pkg.script), `${pkg.id} runs a whole-package script`);
});

test('MR-11: a change in render, pptx, editor or gallery selects that package (the contract tier for the engines) and nothing for docs or evidence', () => {
  const stepsFor = (file, extra = {}) => buildPlan([file], { ...env, ...extra }).filter((step) => step.name.startsWith('tests '));
  const render = stepsFor('packages/render/src/svg.js');
  assert.deepEqual(render.map((step) => step.name), ['tests render']);
  const argv = render[0].commands[0].argv;
  assert.deepEqual(argv.slice(argv.indexOf('pnpm')), ['pnpm', '--filter', '@openpresentation/opf-render', '--fail-if-no-match', 'test:contract']);
  assert.deepEqual(stepsFor('packages/pptx/src/index.js').map((step) => step.name), ['tests pptx']);
  assert.deepEqual(stepsFor('packages/editor/src/index.js').map((step) => step.name), ['tests editor']);
  const gallery = stepsFor('packages/gallery/catalog/layouts/hero.json');
  assert.deepEqual(gallery.map((step) => step.name), ['tests gallery']);
  assert.deepEqual(gallery[0].commands[0].argv.slice(-4), ['--filter', '@openpresentation/gallery', '--fail-if-no-match', 'test']);
  for (const file of ['packages/render/README.md', 'packages/render/docs/evidence/a/b.png', 'packages/pptx/AGENTS.md', 'packages/editor/CHANGELOG.md', 'packages/gallery/CONTRIBUTING.md']) {
    assert.deepEqual(stepsFor(file), [], `${file} needs no package tests`);
  }
  // A test-only change in an engine runs just that file (no build when dist exists), in the package directory.
  const present = { suites: {}, present: ['a.test.mjs', 'b.mjs', 'c-browser.mjs'], distExists: true };
  const only = buildPlan(['packages/pptx/test/a.test.mjs', 'packages/pptx/test/b.mjs'], { ...env, packages: { ...packages, pptx: present } }).filter((step) => step.name === 'tests pptx');
  assert.equal(only.length, 1);
  assert.equal(only[0].commands.length, 2);
  assert.ok(only[0].commands.every((command) => command.cwd.endsWith(path.join('packages', 'pptx'))));
  assert.equal(only[0].commands[0].argv.includes('build'), false);
  // Two packages in one change run in the order of PACKAGES.
  assert.deepEqual(buildPlan(['packages/editor/src/a.js', 'packages/javascript/src/a.ts', 'packages/render/src/a.js'], env).filter((step) => step.name.startsWith('tests ')).map((step) => step.name), ['tests opf', 'tests render', 'tests editor']);
});

test('MR-11: checks.json maps the imported packages to the root checks that read them', () => {
  const run = (file) => selectChangedChecks([file], scripts, config);
  for (const file of ['packages/render/src/a.js', 'packages/pptx/test/a.mjs', 'packages/editor/src/a.js', 'packages/gallery/scripts/build.mjs']) {
    assert.ok(run(file).includes('check:text'), `${file} runs check:text`);
    assert.ok(run(file).includes('check:font-hotlinks'), `${file} runs check:font-hotlinks`);
    assert.ok(run(file).includes('check:changes'), `${file} runs check:changes`);
  }
  for (const name of ['check:catalog', 'check:catalog-free', 'check:spec', 'check:schema-examples']) assert.ok(run('packages/gallery/catalog/layouts/hero.json').includes(name), name);
  for (const file of ['packages/render/package.json', 'packages/pptx/package.json', 'packages/editor/package.json', 'packages/gallery/package.json']) assert.ok(run(file).includes('check:engines-range'), `${file} runs check:engines-range`);
});

test('formatTable prints a row per step and a total', () => {
  const table = formatTable([{ name: 'biome', status: 'passed', seconds: 1.234, detail: '2 files' }, { name: 'typecheck', status: 'skipped', skip: true, seconds: 0, note: 'no .ts' }], 2.5);
  assert.match(table, /^step +status +time/);
  assert.match(table, /biome +passed +1\.2 s +2 files/);
  assert.match(table, /typecheck +skipped +- +no \.ts/);
  assert.match(table, /total +2\.5 s$/);
});

test('biomeBatches keeps every file, in order, within the command-line budget', () => {
  const files = Array.from({ length: 486 }, (_, i) => `packages/javascript/src/some/deeply/nested/module-${i}.ts`);
  const batches = biomeBatches(files);
  assert.ok(batches.length > 1, 'a long list is split');
  assert.deepEqual(batches.flat(), files, 'no file is lost or reordered');
  for (const batch of batches) assert.ok(batch.join(' ').length <= 6000, 'each batch fits the Windows cmd.exe limit');
  assert.deepEqual(biomeBatches(['a.ts', 'b.ts']), [['a.ts', 'b.ts']], 'a short list is one batch');
  assert.deepEqual(biomeBatches([]), [], 'no files, no batch');
  assert.deepEqual(biomeBatches(['x'.repeat(50)], 10), [['x'.repeat(50)]], 'an over-long single path still runs on its own');
});

// #525: check:changed spawned its steps through cmd.exe on Windows, which splits an unquoted "C:\Program Files\..." at the space.
test('#525: a step runs with a space in the executable, the script path, the arguments and the working directory', async (t) => {
  const parent = mkdtempSync(path.join(tmpdir(), 'opf-check-changed-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const dir = path.join(parent, 'a folder with spaces');
  mkdirSync(dir);
  const script = path.join(dir, 'print args.mjs');
  writeFileSync(script, 'process.stdout.write(JSON.stringify([process.cwd(), ...process.argv.slice(2)]));');
  const run = async (argv) => {
    const log = new PassThrough();
    let text = '';
    log.on('data', (chunk) => {
      text += chunk;
    });
    const status = await runCommand(argv, dir, log);
    return { status, text };
  };
  const printed = await run([process.execPath, script, 'one arg', 'two']);
  assert.equal(printed.status, 0, printed.text);
  assert.deepEqual(JSON.parse(printed.text), [realpathSync.native(dir), 'one arg', 'two']);
  const pnpm = await run(['pnpm', '--version']);
  assert.equal(pnpm.status, 0, pnpm.text);
  // pnpm can print configuration warnings first (npm-publish.yml's setup-node writes an .npmrc with ${NODE_AUTH_TOKEN},
  // which is unset before the publish step), so the version is the last line, not the whole output.
  assert.match(pnpm.text.trim().split(/\r?\n/).at(-1), /^\d+\.\d+\.\d+$/);
  const missing = await run([path.join(dir, 'no such program')]);
  assert.notEqual(missing.status, 0);
});

test('#525: the plan names pnpm bare, so the launcher (not a .cmd shim path) decides how to start it', () => {
  const plan = buildPlan(['packages/javascript/src/index.ts'], { ...env, needsInstall: true });
  const argvs = plan.flatMap((step) => (step.commands ?? []).map((command) => command.argv));
  assert.ok(argvs.some((argv) => argv[0] === 'pnpm'));
  assert.ok(argvs.some((argv) => argv.includes('pnpm') && argv.some((part) => part.endsWith('agent-slot.mjs'))));
  for (const argv of argvs) assert.ok(!argv.some((part) => /\.cmd$/i.test(part)), argv.join(' '));
});


test('changedFiles refuses an invalid explicit base and failed Git enumerations', (t) => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'opf-changed-base-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const runGit = (args) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    return result.status === 0 ? result.stdout : null;
  };
  const ok = (args) => assert.notEqual(runGit(args), null, args.join(' '));
  ok(['init', '-b', 'main']);
  ok(['config', 'user.name', 'Test']);
  ok(['config', 'user.email', 'test@example.invalid']);
  writeFileSync(path.join(cwd, 'a.txt'), 'base');
  ok(['add', '.']);
  ok(['commit', '-m', 'base']);
  const base = runGit(['rev-parse', 'HEAD']).trim();
  ok(['checkout', '-b', 'topic']);
  writeFileSync(path.join(cwd, 'a.txt'), 'changed');
  ok(['commit', '-am', 'change']);
  writeFileSync(path.join(cwd, 'untracked.txt'), 'new');
  assert.deepEqual(changedFiles(base, { cwd }), { base, files: ['a.txt', 'untracked.txt'] });
  assert.deepEqual(changedFiles(undefined, { cwd }), { base, files: ['a.txt', 'untracked.txt'] }, 'missing origin/main falls back to main');
  assert.throws(() => changedFiles('not-a-real-ref', { cwd }), /Cannot resolve changed-files base/);
  for (const ref of ['', '   ', null]) assert.throws(() => changedFiles(ref, { cwd }), /nonempty ref/);
  for (const command of ['diff', 'ls-files']) {
    assert.throws(() => changedFiles(base, { cwd, runGit: (args) => args[0] === command ? null : runGit(args) }), new RegExp(`git ${command}.*failed`));
  }
  ok(['branch', '-D', 'main']);
  assert.deepEqual(changedFiles(undefined, { cwd }), { base: null, files: ['untracked.txt'] }, 'no default base retains HEAD policy');
  const outside = mkdtempSync(path.join(tmpdir(), 'opf-changed-not-git-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  assert.throws(() => changedFiles(undefined, { cwd: outside }), /git diff.*failed/);
});


test('CLI --base requires its own nonempty value rather than default discovery', () => {
  for (const args of [['--base'], ['--base', ''], ['--base', '--plan'], ['--base', '--files', 'README.md']]) {
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/check-changed.mjs'), ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1, JSON.stringify(args));
    assert.match(result.stderr, /--base requires a nonempty ref value/);
    assert.ok(!result.stdout.includes('check-changed: passed'));
  }
});
