#!/usr/bin/env node
// RR-46: runs the Node tests of one package (run it from the package directory: `node ../../scripts/run-tests.mjs`).
// A new test touches only its own file; there is no list in package.json.
//   1. every test/*.test.mjs, in one `node --test` batch (what scripts/run-node-tests.mjs always did);
//   2. every other test/*.mjs, in name order, one `node <file>` each, stopping at the first failure.
// test/suites.json says what the glob does not run:
//   exclude   helpers, fixtures and checks that CI runs in their own step (for example packed-install tests)
//   include   files whose name looks like a browser suite (see BROWSER) but that are plain Node tests
// Browser suites are named `*-browser*.mjs` and run through scripts/quarantine.mjs and test/browser-suites.json (RR-47).
//   node ../../scripts/run-tests.mjs           run the tests
//   node ../../scripts/run-tests.mjs --list    print the commands, one per line, and run nothing
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const BROWSER = /(^|-)browser(-|\.)/;

// files: names in test/ (not paths). Returns { batch: [names], scripts: [names] } in run order; throws on a stale
// or contradictory suites.json so that a rename can never silently drop a test.
export function selectTests(files, suites) {
  const { exclude = [], include = [] } = suites;
  const present = new Set(files);
  for (const [key, names] of Object.entries({ exclude, include })) {
    if (new Set(names).size !== names.length) throw new Error(`test/suites.json ${key} lists a file twice`);
    for (const name of names) if (!present.has(name)) throw new Error(`test/suites.json ${key} names ${name}, which is not in test/`);
  }
  for (const name of include) {
    if (!BROWSER.test(name)) throw new Error(`test/suites.json include names ${name}, which the browser pattern does not skip`);
    if (exclude.includes(name)) throw new Error(`test/suites.json lists ${name} in both include and exclude`);
  }
  const sorted = [...files].sort();
  const batch = sorted.filter((name) => name.endsWith('.test.mjs'));
  const scripts = sorted.filter(
    (name) => !name.endsWith('.test.mjs') && !exclude.includes(name) && (!BROWSER.test(name) || include.includes(name)),
  );
  return { batch, scripts };
}

function main(argv) {
  const root = process.cwd();
  const suitesFile = path.join(root, 'test', 'suites.json');
  const suites = existsSync(suitesFile) ? JSON.parse(readFileSync(suitesFile, 'utf8')) : {};
  const files = readdirSync(path.join(root, 'test'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.mjs'))
    .map((entry) => entry.name);
  const { batch, scripts } = selectTests(files, suites);
  if (!batch.length && !scripts.length) throw new Error('No tests found in test/.');
  if (argv.includes('--list')) {
    const lines = [...batch.map((name) => `node --test test/${name}`), ...scripts.map((name) => `node test/${name}`)];
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
    console.log(`[${index}/${scripts.length}] node test/${name}`);
    const result = spawnSync(process.execPath, [`test/${name}`], { cwd: root, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      console.error(`run-tests: test/${name} failed (exit ${result.status ?? result.signal}); ${scripts.length - index} test(s) not run`);
      return result.status || 1;
    }
  }
  console.log(`run-tests: ${batch.length} node:test files and ${scripts.length} scripts passed`);
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
