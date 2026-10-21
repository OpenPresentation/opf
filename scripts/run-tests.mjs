#!/usr/bin/env node
// RR-46: runs the Node tests of one package (run it from the package directory: `node ../../scripts/run-tests.mjs`, or from
// anywhere with `--dir <package directory>`). A new test touches only its own file; there is no list in package.json.
//   1. every test/*.test.mjs, in one `node --test` batch (what scripts/run-node-tests.mjs always did);
//   2. every other test/*.mjs, in name order, one `node <file>` each, stopping at the first failure.
// test/suites.json says what the glob does not run:
//   exclude   helpers, fixtures and checks that CI runs in their own step (for example packed-install tests)
//   include   files whose name looks like a browser suite (see BROWSER) but that are plain Node tests
//   nodeTest  files that are not named *.test.mjs but use node:test: they run as `node --test <file>` in the name-order pass
// Browser suites are named `*-browser*.mjs` and run through scripts/quarantine.mjs and test/browser-suites.json (RR-47).
// RR-53, the contract suite: the full suite minus `contractExclude` in test/suites.json, tests that exercise the package's
// own machinery and not core's APIs, each with its reason. A new test is therefore in the contract until someone excludes
// it on purpose, so the default errs towards running it.
//   node ../../scripts/run-tests.mjs                     run the full suite
//   node ../../scripts/run-tests.mjs --suite contract    run the contract suite
//   node ../../scripts/run-tests.mjs --list              print the commands, one per line, and run nothing
//   node scripts/run-tests.mjs --dir packages/render     the same for another package directory (default: the current one)
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const BROWSER = /(^|-)browser(-|\.)/;
export const SUITES = ['full', 'contract'];

// files: names in test/ (not paths). Returns { batch: [names], scripts: [names] } in run order; throws on a stale
// or contradictory suites.json so that a rename can never silently drop a test.
export function selectTests(files, suites, suite = 'full') {
  if (!SUITES.includes(suite)) throw new Error(`Unknown suite ${suite}; expected ${SUITES.join(' or ')}`);
  const { exclude = [], include = [], nodeTest = [], contractExclude = {} } = suites;
  const present = new Set(files);
  for (const [key, names] of Object.entries({ exclude, include, nodeTest })) {
    if (new Set(names).size !== names.length) throw new Error(`test/suites.json ${key} lists a file twice`);
    for (const name of names) if (!present.has(name)) throw new Error(`test/suites.json ${key} names ${name}, which is not in test/`);
  }
  for (const name of include) {
    if (!BROWSER.test(name)) throw new Error(`test/suites.json include names ${name}, which the browser pattern does not skip`);
    if (exclude.includes(name)) throw new Error(`test/suites.json lists ${name} in both include and exclude`);
  }
  for (const name of nodeTest) {
    if (name.endsWith('.test.mjs')) throw new Error(`test/suites.json nodeTest names ${name}, which already runs in the node:test batch`);
    if (exclude.includes(name)) throw new Error(`test/suites.json lists ${name} in both nodeTest and exclude`);
  }
  const sorted = [...files].sort();
  const batch = sorted.filter((name) => name.endsWith('.test.mjs'));
  const scripts = sorted.filter(
    (name) => !name.endsWith('.test.mjs') && !exclude.includes(name) && (!BROWSER.test(name) || include.includes(name)),
  );
  const full = new Set([...batch, ...scripts]);
  for (const [name, reason] of Object.entries(contractExclude)) {
    if (!full.has(name)) throw new Error(`test/suites.json contractExclude names ${name}, which the full suite does not run`);
    if (typeof reason !== 'string' || !reason.trim()) throw new Error(`test/suites.json contractExclude needs a reason for ${name}`);
  }
  const inSuite = (name) => suite === 'full' || !Object.hasOwn(contractExclude, name);
  return { batch: batch.filter(inSuite), scripts: scripts.filter(inSuite) };
}

// The arguments `node` gets for one name-order test: `--test` for a node:test file that is not named *.test.mjs.
export const nodeArgs = (name, suites) => [...((suites.nodeTest ?? []).includes(name) ? ['--test'] : []), `test/${name}`];

function main(argv) {
  const option = (flag) => {
    const at = argv.indexOf(flag);
    if (at === -1) return undefined;
    if (!argv[at + 1] || argv[at + 1].startsWith('--')) throw new Error(`${flag} needs a value`);
    return argv[at + 1];
  };
  const root = path.resolve(option('--dir') ?? process.cwd());
  const suitesFile = path.join(root, 'test', 'suites.json');
  const suites = existsSync(suitesFile) ? JSON.parse(readFileSync(suitesFile, 'utf8')) : {};
  const files = readdirSync(path.join(root, 'test'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.mjs'))
    .map((entry) => entry.name);
  const suite = option('--suite') ?? 'full';
  const { batch, scripts } = selectTests(files, suites, suite);
  if (!batch.length && !scripts.length) throw new Error('No tests found in test/.');
  if (argv.includes('--list')) {
    const lines = [...batch.map((name) => `node --test test/${name}`), ...scripts.map((name) => ['node', ...nodeArgs(name, suites)].join(' '))];
    console.log(lines.join('\n'));
    return 0;
  }
  if (batch.length) {
    console.log(`[node:test] ${batch.length} files`);
    const result = spawnSync(process.execPath, ['--test', ...batch.map((name) => `test/${name}`)], { cwd: root, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status ?? 1;
  }
  let index = 0;
  for (const name of scripts) {
    index += 1;
    const args = nodeArgs(name, suites);
    console.log(`[${index}/${scripts.length}] node ${args.join(' ')}`);
    const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      console.error(`run-tests: test/${name} failed (exit ${result.status ?? result.signal}); ${scripts.length - index} test(s) not run`);
      return result.status || 1;
    }
  }
  console.log(`run-tests: ${batch.length} node:test files and ${scripts.length} scripts passed${suite === 'full' ? '' : ` (${suite} suite)`}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
