#!/usr/bin/env node
// RR-46: runs the repository-level checks of `pnpm test` without a list in package.json. A root script is a check of
// `pnpm test` when its name starts with `check:` (or is named in `include`), unless scripts/checks.json lists it in
// `exclude`. Adding a check:* script therefore touches only its own line. Checks run in name order and stop at the
// first failure, as the `&&` chain did.
//   node scripts/run-checks.mjs           run the checks
//   node scripts/run-checks.mjs --list    print the commands, one per line, and run nothing
import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// scripts: the root package.json "scripts" object; config: scripts/checks.json. Returns the script names to run.
export function selectChecks(scripts, config) {
  const { exclude = [], include = [] } = config;
  for (const [key, names] of Object.entries({ exclude, include })) {
    if (new Set(names).size !== names.length) throw new Error(`scripts/checks.json ${key} lists a script twice`);
    for (const name of names) if (!(name in scripts)) throw new Error(`scripts/checks.json ${key} names ${name}, which is not a root script`);
  }
  for (const name of exclude) {
    if (!name.startsWith('check:')) throw new Error(`scripts/checks.json exclude names ${name}, which is not a check: script`);
  }
  for (const name of include) {
    if (name.startsWith('check:')) throw new Error(`scripts/checks.json include names ${name}; check: scripts run without being listed`);
  }
  return Object.keys(scripts)
    .filter((name) => (name.startsWith('check:') && !exclude.includes(name)) || include.includes(name))
    .sort();
}

function main(argv) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const scripts = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
  const config = JSON.parse(readFileSync(path.join(root, 'scripts', 'checks.json'), 'utf8'));
  const names = selectChecks(scripts, config);
  if (argv.includes('--list')) {
    console.log(names.map((name) => `pnpm run ${name}`).join('\n'));
    return 0;
  }
  let index = 0;
  for (const name of names) {
    index += 1;
    console.log(`[${index}/${names.length}] pnpm run ${name}`);
    const result = spawnSync('pnpm', ['run', name], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      console.error(`run-checks: ${name} failed (exit ${result.status ?? result.signal}); ${names.length - index} check(s) not run`);
      return result.status || 1;
    }
  }
  console.log(`run-checks: ${names.length} checks passed`);
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
