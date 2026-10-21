// MR-10: the materializer skips, touching nothing, once packages/gallery is the real gallery package. The script is copied
// alone into a scratch tree, so the test also shows that the guard runs before the package imports (nothing else exists there).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'materialize-gallery-catalog.mjs');
const temp = mkdtempSync(path.join(tmpdir(), 'opf-materialize-'));
after(() => rmSync(temp, { recursive: true, force: true }));

function tree(dir) {
  const out = {};
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out[path.relative(dir, full)] = readFileSync(full, 'utf8');
    }
  };
  walk(dir);
  return out;
}

test('with packages/gallery/package.json present it exits 0 and leaves every file, marker or not, untouched', () => {
  const root = path.join(temp, 'with-package');
  mkdirSync(path.join(root, 'scripts'), { recursive: true });
  mkdirSync(path.join(root, 'packages/gallery/catalog/layouts'), { recursive: true });
  copyFileSync(script, path.join(root, 'scripts/materialize-gallery-catalog.mjs'));
  writeFileSync(path.join(root, 'packages/gallery/package.json'), '{"name":"@openpresentation/gallery"}\n');
  writeFileSync(path.join(root, 'packages/gallery/catalog/layouts/hero.json'), '{"tracked":true}\n');
  writeFileSync(path.join(root, 'packages/gallery/.generated-from-openpresentation-gallery'), 'a stale marker from an earlier install\n');
  const before = tree(root);
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/materialize-gallery-catalog.mjs')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /nothing to materialize/);
  assert.deepEqual(tree(root), before);
});
