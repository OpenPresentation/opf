// MR-23c: packs workspace packages the way they publish (`pnpm pack` rewrites `workspace:^` to `^<version>`), for the packed
// install and packed browser checks. They install the tarball into an isolated npm consumer, so they must read the PACKED
// manifest (never the source `workspace:` specs) and, because a lockstep version is not on the registry while it is being
// tested, install the packed siblings it depends on from their own tarballs.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { packageManagerInvocation } from '../../../../scripts/package-manager.mjs';

export const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
export const PACKAGE_DIRECTORIES = {
  '@openpresentation/opf': 'packages/javascript',
  '@openpresentation/gallery': 'packages/gallery',
  '@openpresentation/opf-render': 'packages/render',
  '@openpresentation/opf-pptx': 'packages/pptx',
};

/** The regular files of a .tgz (npm layout: every path under `package/`) as { path: Buffer }, in archive order. */
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

/**
 * Packs `name` (one of PACKAGE_DIRECTORIES) into `destination` and returns { name, version, tarball, filename, integrity,
 * sha256, files, entries, manifest }, where manifest is the manifest INSIDE the tarball. Fails when it still holds a `workspace:` spec.
 */
export function packWorkspacePackage(name, destination) {
  const directory = path.join(REPOSITORY_ROOT, PACKAGE_DIRECTORIES[name] ?? assert.fail(`unknown workspace package ${name}`));
  const filename = packWithPnpm(name, directory, destination) ?? packStaged(name, directory, destination);
  const archive = readFileSync(filename);
  const entries = readTarball(filename);
  const manifest = JSON.parse(entries.get('package.json').toString('utf8'));
  assert.equal(manifest.name, name);
  assert.ok(!JSON.stringify(manifest).includes('workspace:'), `${name}: the packed manifest must not hold a workspace: spec`);
  return {
    name, version: manifest.version, tarball: filename, filename: path.basename(filename), manifest,
    integrity: `sha512-${createHash('sha512').update(archive).digest('base64')}`,
    sha256: createHash('sha256').update(archive).digest('hex'),
    files: [...entries.keys()].map((file) => ({ path: file })), entries,
  };
}

function packWithPnpm(name, directory, destination) {
  const invocation = packageManagerInvocation('pnpm', ['pack', '--json', '--pack-destination', destination]);
  const result = spawnSync(invocation.command, invocation.args, { cwd: directory, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status === 0) {
    // The prepack lifecycle prints before the JSON object, which starts on a line of its own.
    return JSON.parse(result.stdout.slice(result.stdout.search(/^\{$/m))).filename;
  }
  // pnpm cannot resolve a workspace: spec whose package is not installed in this package's node_modules (core's optional
  // peers on opf-pptx and opf-render are not installed there: autoInstallPeers is off, MR-23a). Stage the pack below instead.
  if (!/CANNOT_RESOLVE_WORKSPACE_PROTOCOL/.test(result.stdout + result.stderr)) assert.fail(`pnpm pack failed for ${name}: ${result.stdout}${result.stderr}`);
  console.warn(`pnpm pack cannot resolve the workspace: specs of ${name}; packing a staged copy with them resolved to the workspace versions.`);
  return null;
}

/** `npm pack` of a copy of the package (its `files` list, README and LICENSE) whose workspace: specs are resolved the way pnpm resolves them. */
function packStaged(name, directory, destination) {
  const manifest = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const versions = Object.fromEntries(Object.entries(PACKAGE_DIRECTORIES).map(([sibling, where]) => [sibling, JSON.parse(readFileSync(path.join(REPOSITORY_ROOT, where, 'package.json'), 'utf8')).version]));
  const resolve = (sibling, spec) => {
    if (!spec.startsWith('workspace:')) return spec;
    const range = spec.slice('workspace:'.length), version = versions[sibling] ?? assert.fail(`${name}: no workspace package ${sibling}`);
    return range === '^' || range === '~' ? `${range}${version}` : range === '*' ? version : range;
  };
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [dependency, spec] of Object.entries(manifest[section] ?? {})) manifest[section][dependency] = resolve(dependency, spec);
  }
  const stage = mkdtempSync(path.join(tmpdir(), 'opf-pack-stage-'));
  try {
    for (const entry of new Set([...(manifest.files ?? []), 'README.md', 'LICENSE'])) {
      if (existsSync(path.join(directory, entry))) cpSync(path.join(directory, entry), path.join(stage, entry), { recursive: true });
    }
    writeFileSync(path.join(stage, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    const invocation = packageManagerInvocation('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', destination]);
    const output = execFileSync(invocation.command, invocation.args, { cwd: stage, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return path.join(destination, JSON.parse(output)[0].filename);
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

/** The lockstep rule: a packed sibling range names exactly the version of the sibling packed beside it. */
export function assertLockstep(consumerPackage, sibling) {
  const sections = ['dependencies', 'peerDependencies', 'optionalDependencies'];
  const range = sections.map((section) => consumerPackage.manifest[section]?.[sibling.name]).find(Boolean);
  assert.equal(range, `^${sibling.version}`, `${consumerPackage.name} packs ${sibling.name}@${range}; the workspace packs ${sibling.version}`);
}
