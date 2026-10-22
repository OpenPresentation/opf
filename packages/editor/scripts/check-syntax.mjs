#!/usr/bin/env node
// RR-46: `node --check` every .js, .mjs and .cjs file under the directories named on the command line
// (default: src test scripts), so adding a file never edits a list in package.json.
//   node scripts/check-syntax.mjs [--list] [dir...]
// Skipped: node_modules, fixtures, golden, artifacts and dist directories. Identical in the sibling repositories.
import { spawn } from 'node:child_process';
import { readdirSync, realpathSync } from 'node:fs';
import { cpus } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SKIPPED = new Set(['node_modules', 'fixtures', 'golden', 'artifacts', 'dist']);
const EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);

// Returns the files under `dir` (relative to `root`, "/" separators), sorted by code unit so the order is stable.
export function listSources(root, dir) {
  const found = [];
  const walk = (relative) => {
    for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const child = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!SKIPPED.has(entry.name)) walk(child);
      } else if (EXTENSIONS.has(path.extname(entry.name))) {
        found.push(child);
      }
    }
  };
  walk(dir.replace(/\/+$/, ''));
  return found.sort();
}

function check(root, file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--check', file], { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code) => resolve({ file, code, stderr }));
  });
}

async function main(argv) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const list = argv.includes('--list');
  const dirs = argv.filter((arg) => !arg.startsWith('--'));
  const files = (dirs.length ? dirs : ['src', 'test', 'scripts']).flatMap((dir) => listSources(root, dir));
  if (list) {
    console.log(files.map((file) => `node --check ${file}`).join('\n'));
    return 0;
  }
  const failures = [];
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(8, cpus().length)) }, async () => {
    while (next < files.length) {
      const result = await check(root, files[next++]);
      if (result.code !== 0) failures.push(result);
    }
  });
  await Promise.all(workers);
  for (const failure of failures.sort((a, b) => (a.file < b.file ? -1 : 1))) {
    console.error(`syntax error in ${failure.file}\n${failure.stderr}`);
  }
  console.log(`${files.length} files checked, ${failures.length} failed`);
  return failures.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  process.exit(await main(process.argv.slice(2)));
}
