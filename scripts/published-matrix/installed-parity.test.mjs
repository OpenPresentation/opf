// The installed-parity harness copies each published package and links the consumer's node_modules beside it. A package that npm nested a
// dependency into (opf-render 0.13.1 ships its own pako 1.0.11) made the whole-directory link fail with EEXIST (RR-20, opf#425).
import assert from 'node:assert/strict';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {linkModules} from './link-modules.mjs';

function pkg(directory, name, version) {
  mkdirSync(path.join(directory, ...name.split('/')), {recursive: true});
  writeFileSync(path.join(directory, ...name.split('/'), 'package.json'), JSON.stringify({name, version}));
}
const versionAt = (directory, ...segments) => JSON.parse(readFileSync(path.join(directory, ...segments, 'package.json'), 'utf8')).version;

function layout() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'opf-link-modules-'));
  const modules = path.join(root, 'consumer', 'node_modules');
  pkg(modules, 'pako', '3.0.2');
  pkg(modules, 'fflate', '0.8.3');
  pkg(modules, '@scope/shared', '2.0.0');
  pkg(modules, '@scope/other', '1.0.0');
  mkdirSync(path.join(modules, '.bin'), {recursive: true});
  return {root, modules, copy: path.join(root, 'sources', 'parity-copy')};
}

test('a package copy without node_modules gets the consumer node_modules as one link', async () => {
  const {root, modules, copy} = layout();
  try {
    mkdirSync(copy, {recursive: true});
    await linkModules(modules, path.join(copy, 'node_modules'));
    assert.equal(realpathSync(path.join(copy, 'node_modules')), realpathSync(modules));
    assert.equal(versionAt(copy, 'node_modules', 'pako'), '3.0.2');
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('a nested node_modules keeps its own versions and receives every other consumer entry, twice over without EEXIST', async () => {
  const {root, modules, copy} = layout();
  try {
    const nested = path.join(copy, 'node_modules');
    pkg(nested, 'pako', '1.0.11');
    pkg(nested, '@scope/shared', '1.5.0');
    for (let run = 0; run < 2; run += 1) {
      await linkModules(modules, nested);
      assert.equal(versionAt(nested, 'pako'), '1.0.11', 'the nested unscoped dependency wins');
      assert.equal(versionAt(nested, '@scope', 'shared'), '1.5.0', 'the nested scoped dependency wins');
      assert.equal(versionAt(nested, 'fflate'), '0.8.3', 'an entry the package does not nest resolves to the consumer');
      assert.equal(realpathSync(path.join(nested, 'fflate')), realpathSync(path.join(modules, 'fflate')));
      assert.equal(versionAt(nested, '@scope', 'other'), '1.0.0', 'a sibling in a scope the package nests is linked');
      assert.equal(realpathSync(path.join(nested, '@scope', 'other')), realpathSync(path.join(modules, '@scope', 'other')));
    }
    assert.equal(existsSync(path.join(nested, '.bin')), false, 'dot entries are not linked');
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
