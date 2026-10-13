import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {lstatSync, readFileSync, readdirSync, realpathSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';

export const packageNames = ['opf', 'opf-render', 'opf-pptx', 'opf-editor', 'cli', 'gallery'].map(name => `@openpresentation/${name}`);
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export function fileIdentity(file) {
  assert.ok(lstatSync(file).isFile() && !lstatSync(file).isSymbolicLink(), `Expected regular file: ${file}`);
  const bytes = readFileSync(file);
  return {bytes: bytes.length, sha256: digest(bytes)};
}

export function runtimeIdentity(directory) {
  const files = [];
  function walk(relative) {
    const absolute = path.join(directory, relative);
    const stat = lstatSync(absolute);
    assert.ok(!stat.isSymbolicLink(), `Runtime symlink: ${relative}`);
    if (stat.isDirectory()) {
      for (const name of readdirSync(absolute).sort()) walk(path.join(relative, name));
    } else {
      files.push({path: relative.split(path.sep).join('/'), ...fileIdentity(absolute)});
    }
  }
  walk('package.json');
  walk('dist');
  return {sha256: digest(JSON.stringify(files)), files};
}

export function installedIdentity(consumer) {
  consumer = realpathSync(consumer);
  const require = createRequire(path.join(consumer, 'package.json'));
  const packages = packageNames.map(name => {
    const manifestFile = require.resolve(`${name}/package.json`);
    const directory = realpathSync(path.dirname(manifestFile));
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
    assert.equal(manifest.name, name);
    const runtime = runtimeIdentity(directory);
    return {name, version: manifest.version, directory, runtime};
  });
  // Every engine must actually resolve the same core/catalog runtime used by
  // the fixture generator. Recording top-level versions alone cannot prove it.
  for (const record of packages.filter(record => record.name !== '@openpresentation/gallery')) {
    const local = createRequire(path.join(record.directory, 'package.json'));
    for (const dependency of ['@openpresentation/opf', '@openpresentation/gallery']) {
      if (dependency === record.name) continue;
      const resolved = realpathSync(path.dirname(local.resolve(`${dependency}/package.json`)));
      assert.equal(resolved, packages.find(item => item.name === dependency).directory, `${record.name} resolves another ${dependency}`);
    }
  }
  return {consumer, packages, registryAcceptance: false};
}

export function repositoryIdentity(directory, files) {
  directory = realpathSync(directory);
  const git = args => execFileSync('git', ['-C', directory, ...args], {encoding: 'utf8'}).trim();
  return {
    directory,
    revision: git(['rev-parse', 'HEAD']),
    dirty: git(['status', '--porcelain', '--untracked-files=normal']) !== '',
    files: files.map(file => ({path: file, ...fileIdentity(path.join(directory, file))})),
  };
}
