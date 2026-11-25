#!/usr/bin/env node
// NT-01: `pnpm check:native` runs every *.test.mjs under scripts/native-acceptance/core, apps and known (the shared native
// result format, the drivers' pure parts, the known differences). A file walk instead of a glob in package.json: the
// same on every Node version and shell CI uses, and a folder that does not exist yet simply has no tests.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const FOLDERS = ['core', 'apps', 'known'];

function tests(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : tests(file);
      return entry.name.endsWith('.test.mjs') ? [file] : [];
    });
}

const files = FOLDERS.flatMap((folder) => tests(path.join(here, folder)));
if (files.length === 0) {
  console.log('check:native: no tests under scripts/native-acceptance/{core,apps,known}');
  process.exit(0);
}
const { status, error } = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
if (error) throw error;
process.exit(status ?? 1);
