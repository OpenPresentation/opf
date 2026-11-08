#!/usr/bin/env node
// RR-107: a checked MCPB and its SHA-256 travel from build to the GitHub release as one artifact. This script never publishes
// npm packages or edits release notes. Reruns preserve existing assets, verify their pair, and upload only missing files.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isVersion } from './release-registry.mjs';

export function bundleNames(version) {
  if (!isVersion(version ?? '')) throw new Error('The MCP bundle needs an exact release version.');
  const bundle = `opf-${version}.mcpb`;
  return { bundle, checksum: `${bundle}.sha256` };
}
const digest = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const checksumText = (file, name) => `${digest(file)}  ${name}\n`;

export function writeChecksum(version, directory) {
  const { bundle, checksum } = bundleNames(version);
  const file = path.join(directory, checksum);
  writeFileSync(file, checksumText(path.join(directory, bundle), bundle));
  return file;
}

function checkPair(directory, { bundle, checksum }) {
  const expected = checksumText(path.join(directory, bundle), bundle);
  if (readFileSync(path.join(directory, checksum), 'utf8') !== expected) throw new Error(`SHA-256 does not match ${bundle}; refusing to attach inconsistent release assets.`);
}

export function attachBundle(version, directory, { gh = (args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }), log = console.log } = {}) {
  const names = bundleNames(version);
  const tag = `v${version}`;
  // Validate the downloaded build artifact before touching GitHub, including a rerun that might already have both assets.
  checkPair(directory, names);
  const release = JSON.parse(gh(['release', 'view', tag, '--json', 'assets']));
  const present = new Set(release.assets.map(({ name }) => name));
  const temporary = mkdtempSync(path.join(os.tmpdir(), 'opf-release-mcpb-'));
  try {
    // Existing bundles may have different zip timestamps on a rebuild. Their checksum must describe the existing bytes,
    // never the new local bundle. Download only the two exact asset names; no wildcard, overwrite or release-note operation.
    for (const name of Object.values(names)) {
      if (present.has(name)) gh(['release', 'download', tag, '--pattern', name, '--dir', temporary]);
    }
    const missing = Object.values(names).filter((name) => !present.has(name));
    if (present.has(names.bundle)) {
      if (present.has(names.checksum)) checkPair(temporary, names);
      else writeChecksum(version, temporary);
    } else if (present.has(names.checksum)) {
      if (readFileSync(path.join(temporary, names.checksum), 'utf8') !== checksumText(path.join(directory, names.bundle), names.bundle)) {
        throw new Error(`Existing ${names.checksum} does not describe the new bundle; preserving it and refusing an inconsistent upload.`);
      }
    }
    if (missing.length) {
      const files = missing.map((name) => path.join(name === names.checksum && present.has(names.bundle) ? temporary : directory, name));
      gh(['release', 'upload', tag, ...files]);
      log(`Attached ${missing.join(', ')} to ${tag}.`);
    } else log(`Release ${tag} already has the verified MCP bundle and checksum; preserving both.`);
    return missing;
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

export function main(argv = process.argv.slice(2)) {
  const [command, version, option, directory, ...extra] = argv;
  if (!['checksum', 'attach'].includes(command) || option !== '--dir' || !directory || extra.length) {
    throw new Error('usage: release-mcpb.mjs checksum|attach <X.Y.Z> --dir <artifact directory>');
  }
  if (command === 'checksum') return writeChecksum(version, path.resolve(directory));
  return attachBundle(version, path.resolve(directory));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error.message ?? error); process.exitCode = 1; }
}
