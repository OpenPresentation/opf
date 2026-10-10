import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { selectChecks } from './run-checks.mjs';
import { biomeBatches, buildPlan, formatTable, matches, referencedPaths, runCommand, selectChangedChecks, selectPackageTests, splitPaths } from './check-changed.mjs';

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
  assert.deepEqual(docs, ['check:changes', 'check:text']);
  const schema = selectChangedChecks(['spec/schemas/opf.schema.json'], scripts, config);
  for (const name of ['check:schema-docs', 'check:core-golden', 'check:registry-golden', 'check:spec']) assert.ok(schema.includes(name), name);
  const catalog = selectChangedChecks(['spec/catalogs/layouts/index.json'], scripts, config);
  assert.ok(catalog.includes('check:catalog'));
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

test('buildPlan: a docs-only change runs the text checks only; a .ts change adds the type check and the package tests', () => {
  const docs = buildPlan(['docs/agent-skills.md'], env);
  assert.deepEqual(docs.map((step) => step.name), ['biome', 'pnpm run check:changes', 'pnpm run check:text', 'typecheck']);
  assert.equal(docs[0].skip, true);
  assert.equal(docs.at(-1).skip, true);

  const code = buildPlan(['packages/javascript/src/index.ts'], env);
  assert.deepEqual(code.map((step) => step.name), ['biome', 'pnpm run check:browser-safe', 'pnpm run check:catalog-free', 'pnpm run check:changes', 'pnpm run check:font-hotlinks', 'pnpm run check:text', 'typecheck', 'tests opf']);
  const typecheck = code.find((step) => step.name === 'typecheck');
  assert.ok(typecheck.heavy && typecheck.commands[0].argv.some((part) => part.endsWith('agent-slot.mjs')));
  assert.equal(code.find((step) => step.name === 'biome').biome[0], 'packages/javascript/src/index.ts');

  assert.equal(buildPlan(['x.md'], { ...env, needsInstall: true })[0].name, 'install');
  assert.equal(buildPlan(['gone.mjs'], { ...env, exists: () => false })[0].skip, true, 'a deleted file is not given to Biome');
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
  assert.match(pnpm.text.trim(), /^\d+\.\d+\.\d+/);
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
