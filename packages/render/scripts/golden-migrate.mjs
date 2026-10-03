// RR-52: migrate the single-file renderer goldens (test/golden/<name>.sha256.json) to one baseline directory per
// manifest with one file per deck, and prove the migration lossless.
//
//   node scripts/golden-migrate.mjs migrate [--ref <git ref of the old layout>] [--remove]
//       Reads every test/golden/*.sha256.json from <ref> (default HEAD), writes test/golden/<name>/ and, with
//       --remove, deletes the working-tree copy of the old file.
//   node scripts/golden-migrate.mjs verify --ref <git ref of the old layout>
//       Reassembles every baseline directory and compares it to the old file at <ref>: the reassembled manifest
//       must equal the old bytes exactly (same hashes, same sizes, same order, same header).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleBaseline, serialize, writeBaseline } from '../test/golden-store.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [command = 'verify', ...rest] = process.argv.slice(2);
const option = name => { const index = rest.indexOf(name); return index < 0 ? undefined : rest[index + 1]; };
const ref = option('--ref') ?? 'HEAD';
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const legacy = git('ls-tree', '--name-only', ref, 'test/golden/').split('\n')
  .filter(file => file.endsWith('.sha256.json') && !file.slice('test/golden/'.length).includes('/'));
assert.ok(legacy.length > 0, `No single-file goldens at ${ref}:test/golden/`);

let decks = 0, slides = 0;
for (const file of legacy) {
  const text = git('show', `${ref}:${file}`);
  const manifest = JSON.parse(text);
  assert.equal(serialize(manifest), text, `${file}: old file is not canonical JSON, byte-for-byte reassembly would not be possible`);
  const directory = path.join(root, file.slice(0, -'.sha256.json'.length));
  if (command === 'migrate') {
    const result = writeBaseline(directory, manifest);
    console.log(`${path.relative(root, directory)}: ${result.written.length} files written, ${result.unchanged} unchanged`);
    if (rest.includes('--remove') && existsSync(path.join(root, file))) rmSync(path.join(root, file));
  }
  const reassembled = assembleBaseline(directory);
  assert.equal(serialize(reassembled), text, `${file}: reassembled manifest differs from the old file`);
  assert.deepEqual(Object.keys(reassembled.entries), Object.keys(manifest.entries), `${file}: entry order`);
  decks += new Set(Object.keys(manifest.entries).map(key => key.slice(0, key.lastIndexOf('#')))).size;
  slides += Object.keys(manifest.entries).length;
  console.log(`${file}: ${Object.keys(manifest.entries).length} entries reassemble byte-for-byte`);
}
console.log(`Lossless: ${legacy.length} manifests, ${decks} deck files, ${slides} slide hashes identical to ${ref}.`);
