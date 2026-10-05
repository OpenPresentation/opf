#!/usr/bin/env node
// RR-45 (opf#368, item 5): build a package once per CI job. `Verify OPF packages` used to run the core build (generate,
// tsup, copy-spec) about eight times and the CLI's tsup four times: every `pnpm test`, `pack:dry-run`, `prepack` and
// packed-install test rebuilds the same unchanged sources. A package build script runs
//   node ../../scripts/reuse-build.mjs check || (<the build> && node ../../scripts/reuse-build.mjs stamp)
// `check` succeeds (and the build is skipped) only when OPF_REUSE_BUILD is set and this package's last build in this
// checkout wrote the same token. CI sets the token to the run, attempt and job, so a build is reused only within the job
// that made it, never across jobs, runs or a local checkout. Without OPF_REUSE_BUILD (every local run, every other
// workflow) `check` always fails, so the build always runs, exactly as before; `stamp` then removes any old stamp.
//   node scripts/reuse-build.mjs check [package-directory]   exit 0: reuse this job's build; exit 1: build
//   node scripts/reuse-build.mjs stamp [package-directory]   record a successful build for this job
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// The stamp lives in the package's node_modules: never packed, never committed, gone with a clean install.
export const stampPath = (directory) => path.join(directory, 'node_modules', '.opf-build-stamp');

// The build's entry point must still be there: a `clean` between two steps forces a build.
const builtEntry = (directory) => path.join(directory, 'dist', 'index.js');

export function canReuse(directory, token) {
  if (!token) return false;
  if (!existsSync(builtEntry(directory))) return false;
  try {
    return readFileSync(stampPath(directory), 'utf8') === token;
  } catch {
    return false;
  }
}

export function stamp(directory, token) {
  const file = stampPath(directory);
  if (!token) {
    rmSync(file, { force: true });
    return false;
  }
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, token);
  return true;
}

function main(argv) {
  const [command, directoryArgument] = argv;
  const directory = path.resolve(directoryArgument ?? process.cwd());
  const token = process.env.OPF_REUSE_BUILD ?? '';
  const name = path.basename(directory);
  if (command === 'check') {
    if (canReuse(directory, token)) {
      console.log(`reuse-build: ${name} was built earlier in this CI job (OPF_REUSE_BUILD); reusing dist/`);
      return 0;
    }
    return 1;
  }
  if (command === 'stamp') {
    stamp(directory, token);
    return 0;
  }
  console.error('Usage: reuse-build.mjs check|stamp [package-directory]');
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) process.exitCode = main(process.argv.slice(2));
