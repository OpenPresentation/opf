#!/usr/bin/env node
// RR-46: runs every Node test in test/*.mjs, in name order, stopping at the first failure (as the `&&` chain did).
// A new test touches only its own file. test/suites.json says what the glob does not run:
//   exclude   files that are not Node tests of this runner: helpers and fixtures, harnesses that need a browser, Windows
//             or PowerPoint, and checks that CI runs in their own step
//   include   files whose name looks like a browser suite (see BROWSER) but that are plain Node tests
//   nodeTest  files that use node:test and run as `node --test <file>`
// Browser suites are named `*-browser.mjs` and run through scripts/quarantine.mjs and test/browser-suites.json (RR-47).
// RR-53, the contract suite: core's pull-request tier runs `--suite contract` (npm run test:contract), core's merge
// queue, pushes to main and nightly run the full suite. The contract is the full suite minus `contractExclude` in
// test/suites.json: tests that exercise this package's own machinery and not core's APIs, each with its reason. A new
// test is therefore in the contract until someone excludes it on purpose, so the default errs towards running it.
//   node scripts/run-tests.mjs                     run the full suite
//   node scripts/run-tests.mjs --suite contract    run the contract suite
//   node scripts/run-tests.mjs --list              print the commands, one per line, and run nothing
// Identical in the sibling repositories.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const BROWSER = /(^|-)browser(-|\.)/;

// files: names in test/ (not paths). Returns [{file, args}] in run order; throws on a stale or contradictory suites.json.
export function selectTests(files, suites, suite = 'full') {
  if (suite !== 'full' && suite !== 'contract') throw new Error(`Unknown suite ${suite}; expected full or contract`);
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
  for (const name of nodeTest) if (exclude.includes(name)) throw new Error(`test/suites.json lists ${name} in both nodeTest and exclude`);
  const full = [...files].sort().filter((name) => !exclude.includes(name) && (!BROWSER.test(name) || include.includes(name)));
  for (const [name, reason] of Object.entries(contractExclude)) {
    if (!full.includes(name)) throw new Error(`test/suites.json contractExclude names ${name}, which the full suite does not run`);
    if (typeof reason !== 'string' || !reason.trim()) throw new Error(`test/suites.json contractExclude needs a reason for ${name}`);
  }
  return full
    .filter((name) => suite === 'full' || !Object.hasOwn(contractExclude, name))
    .map((name) => ({ file: `test/${name}`, args: nodeTest.includes(name) ? ['--test'] : [] }));
}

function main(argv) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const suitesFile = path.join(root, 'test', 'suites.json');
  const suites = existsSync(suitesFile) ? JSON.parse(readFileSync(suitesFile, 'utf8')) : {};
  const files = readdirSync(path.join(root, 'test'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.mjs'))
    .map((entry) => entry.name);
  const suiteFlag = argv.indexOf('--suite');
  const suite = suiteFlag === -1 ? 'full' : argv[suiteFlag + 1];
  const tests = selectTests(files, suites, suite);
  if (!tests.length) throw new Error('No tests found in test/.');
  if (argv.includes('--list')) {
    console.log(tests.map(({ file, args }) => ['node', ...args, file].join(' ')).join('\n'));
    return 0;
  }
  let index = 0;
  for (const { file, args } of tests) {
    index += 1;
    console.log(`[${index}/${tests.length}] node ${[...args, file].join(' ')}`);
    const result = spawnSync(process.execPath, [...args, file], { cwd: root, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      console.error(`run-tests: ${file} failed (exit ${result.status ?? result.signal}); ${tests.length - index} test(s) not run`);
      return result.status || 1;
    }
  }
  console.log(`run-tests: ${tests.length} ${suite === 'full' ? '' : `${suite} `}tests passed`);
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
