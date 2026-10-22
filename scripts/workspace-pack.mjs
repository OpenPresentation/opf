// MR-23e: pack workspace packages the way they publish, for the packed-install and packed-bundle checks of render, pptx and
// the editor (and any later one). `pnpm pack` writes the registry ranges into the packed manifest (`workspace:^` becomes
// `^<version>`, `workspace:*` the exact version; core's concrete peer ranges stay as they are), so a check that installs the
// tarballs into an isolated npm consumer reads the PACKED manifest, never a `workspace:` spec from a source package.json, and
// installs the packed siblings itself because the version under development is not on the registry yet.
//
// There is no fallback: every workspace package packs with `pnpm pack` as it is (core's optional peers are concrete ranges, so
// nothing is left to resolve; check:workspace-graph).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { packageManagerInvocation } from './package-manager.mjs';
import { DEPENDENCY_FIELDS, SIX } from './workspace-packages.mjs';

export const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** npm name -> directory (relative to the repository root) of the six published packages. */
export const PACKAGE_DIRECTORIES = Object.fromEntries(SIX.map(({ dir, name }) => [name, `packages/${dir}`]));

/** The regular files of a .tgz (npm layout: every path under `package/`) as a Map of path -> Buffer, in archive order. */
export function readTarball(file) {
  const bytes = gunzipSync(readFileSync(file));
  const entries = new Map();
  const string = (buffer) => buffer.subarray(0, buffer.indexOf(0) < 0 ? buffer.length : buffer.indexOf(0)).toString('utf8');
  for (let offset = 0; offset + 512 <= bytes.length;) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every((value) => value === 0)) break;
    const name = [string(header.subarray(345, 500)), string(header.subarray(0, 100))].filter(Boolean).join('/');
    const size = Number.parseInt(string(header.subarray(124, 136)).trim(), 8);
    if (header[156] === 0 || header[156] === 48) {
      assert.ok(name.startsWith('package/'), `unexpected tar member ${name}`);
      entries.set(name.slice('package/'.length), bytes.subarray(offset + 512, offset + 512 + size));
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

/** The manifest inside a packed tarball. */
export const packedManifest = (tarball) => {
  const bytes = readTarball(tarball).get('package.json');
  assert.ok(bytes, `${tarball} has no package.json`);
  return JSON.parse(bytes.toString('utf8'));
};

/** Fails when a manifest still holds a `workspace:` (or `catalog:`) specifier: a published package must not. */
export function assertNoWorkspaceSpecs(manifest, label = manifest.name) {
  for (const field of DEPENDENCY_FIELDS) {
    for (const [name, range] of Object.entries(manifest[field] ?? {})) {
      assert.ok(!/^(workspace|catalog):/.test(range), `${label}: ${field} ${name} is still ${range} in the packed manifest`);
    }
  }
}

/**
 * `pnpm pack` in `directory` (the prepack lifecycle runs). Returns { filename (absolute), files: [{ path }] } from pnpm's JSON.
 * Throws with pnpm's output when it fails; there is no fallback.
 */
export function pnpmPack(directory, destination) {
  const invocation = packageManagerInvocation('pnpm', ['pack', '--json', '--pack-destination', destination]);
  const result = spawnSync(invocation.command, invocation.args, { cwd: directory, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.equal(result.status, 0, `pnpm pack failed in ${directory}\n${result.stdout}${result.stderr}`);
  // The prepack script prints before the JSON object, which starts on a line of its own.
  const start = result.stdout.search(/^\{$/m);
  assert.ok(start >= 0, `pnpm pack printed no JSON in ${directory}\n${result.stdout}`);
  return JSON.parse(result.stdout.slice(start));
}

/**
 * Packs `name` (a key of PACKAGE_DIRECTORIES) into `destination` and returns { name, version, tarball, filename (basename),
 * integrity (sha512, as npm prints it), sha256, files: [{ path }], entries (Map path -> Buffer), manifest }, where manifest is
 * the manifest INSIDE the tarball. Fails when it still holds a `workspace:` spec.
 */
export function packWorkspacePackage(name, destination) {
  const directory = path.join(REPOSITORY_ROOT, PACKAGE_DIRECTORIES[name] ?? assert.fail(`unknown workspace package ${name}`));
  const tarball = pnpmPack(directory, destination).filename;
  const archive = readFileSync(tarball);
  const entries = readTarball(tarball);
  const manifest = JSON.parse(entries.get('package.json').toString('utf8'));
  assert.equal(manifest.name, name);
  assertNoWorkspaceSpecs(manifest);
  return {
    name,
    version: manifest.version,
    tarball,
    filename: path.basename(tarball),
    manifest,
    integrity: `sha512-${createHash('sha512').update(archive).digest('base64')}`,
    sha256: createHash('sha256').update(archive).digest('hex'),
    files: [...entries.keys()].map((file) => ({ path: file })),
    entries,
  };
}

/** The lockstep rule: a packed sibling range names exactly the version of the sibling packed beside it. */
export function assertLockstep(consumerPackage, sibling) {
  const range = ['dependencies', 'peerDependencies', 'optionalDependencies'].map((section) => consumerPackage.manifest[section]?.[sibling.name]).find(Boolean);
  assert.equal(range, `^${sibling.version}`, `${consumerPackage.name} packs ${sibling.name}@${range}; the workspace packs ${sibling.version}`);
}
