// MR-23b: packing and installing the workspace packages from this package's scripts and tests. The workspace has no registry copy of
// the version under development, so a check that installs this package the way a consumer does packs it (and the workspace packages
// it depends on) with `pnpm pack`, which writes the registry ranges into the packed manifests (`workspace:^` becomes `^<version>`),
// and installs the tarballs with npm, the client consumers use. Nothing reads a `workspace:` specifier from a source package.json.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { packageManagerInvocation } from '../../../scripts/package-manager.mjs';

export const packageRoot = fileURLToPath(new URL('../', import.meta.url));
export const repositoryRoot = path.resolve(packageRoot, '../..');

/** Runs `npm` or `pnpm` (on Windows through its JavaScript entrypoint, never a shell) and returns its stdout. */
export function run(command, args, cwd) {
  const invocation = packageManagerInvocation(command, args);
  return execFileSync(invocation.command, invocation.args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}
export const npm = (args, cwd) => run('npm', args, cwd);

/** `pnpm pack` in `directory`: { name, version, filename (absolute), files: [{ path }], integrity (sha512, as npm prints it) }. */
export function pack(directory, destination) {
  // `pnpm pack --json` prints the lifecycle (prepack build) output first; the JSON object starts on a line of its own.
  const output = run('pnpm', ['pack', '--json', '--pack-destination', destination], directory), start = output.search(/^\{/m);
  assert.ok(start >= 0, `pnpm pack printed no JSON in ${directory}`);
  const result = JSON.parse(output.slice(start));
  return { ...result, integrity: `sha512-${createHash('sha512').update(readFileSync(result.filename)).digest('base64')}` };
}

/** One file of a (gzipped ustar) tarball, so the packed manifest is read from the artifact and never from the source package.json. */
export function tarEntry(tarball, name) {
  const bytes = gunzipSync(readFileSync(tarball));
  for (let offset = 0; offset + 512 <= bytes.length && bytes[offset] !== 0;) {
    const header = bytes.subarray(offset, offset + 512), size = Number.parseInt(header.subarray(124, 136).toString('latin1').replace(/\0.*$/, '').trim() || '0', 8);
    if (header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '') === name) return bytes.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  throw new Error(`${name} is not in ${tarball}`);
}

/** The manifest inside a packed tarball. */
export const packedManifest = (tarball) => JSON.parse(tarEntry(tarball, 'package/package.json').toString('utf8'));

/** Packs this package, core and the gallery (core's dependency): the set a consumer install needs before the release is published. */
export function packWithDependencies(destination) {
  return {
    self: pack(packageRoot, destination),
    core: pack(path.join(repositoryRoot, 'packages/javascript'), destination),
    gallery: pack(path.join(repositoryRoot, 'packages/gallery'), destination),
  };
}
