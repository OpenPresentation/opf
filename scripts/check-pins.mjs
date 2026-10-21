#!/usr/bin/env node
// MR-10 (monorepo plan, section 1 and spike S1 finding 7): exact pins are literals, and they agree.
//
// Fonts (`@expo-google-fonts/*`) and the devDependencies that mirror an optional peer (`sharp`, `@resvg/resvg-js`, `pdf-lib`)
// are exact versions in package.json, not `catalog:` entries, because scripts and tests read them as literals. Two ways
// they can go wrong once six manifests share a lockfile, both caught here, for the root manifest and the workspace members:
//   - the same package pinned to two different exact versions in two manifests (dependencies, devDependencies and
//     optionalDependencies; a peer pin is compared with the devDependency that mirrors it, below);
//   - a package whose exact peer pin differs from, or has no, matching devDependency in the same manifest (the peer
//     contract would then be untested, or promise a version nobody installs).
// Specifiers that are ranges, tags, `catalog:` or `workspace:` are not pins. Workspace package names are skipped (their
// versions are check:versions' business).
//
// Usage: node scripts/check-pins.mjs [root]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { EDGE_FIELDS, loadWorkspace, SIX } from './workspace-packages.mjs';

const EXACT = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** Findings for manifests: [{dir, manifest}]. */
export function checkPins(manifests) {
  const workspaceNames = new Set(SIX.map(({ name }) => name));
  const problems = [];
  const pins = new Map(); // dependency name -> Map(version -> [where])
  for (const { dir, manifest } of manifests) {
    for (const field of EDGE_FIELDS) {
      for (const [name, spec] of Object.entries(manifest[field] ?? {})) {
        if (workspaceNames.has(name) || !EXACT.test(spec)) continue;
        const versions = pins.get(name) ?? new Map();
        versions.set(spec, [...(versions.get(spec) ?? []), `${dir} ${field}`]);
        pins.set(name, versions);
      }
    }
    for (const [name, spec] of Object.entries(manifest.peerDependencies ?? {})) {
      if (workspaceNames.has(name) || !EXACT.test(spec)) continue;
      const dev = manifest.devDependencies?.[name];
      if (dev === undefined) problems.push(`${dir}: peer ${name} ${spec} has no devDependency pin, so nothing tests it`);
      else if (dev !== spec) problems.push(`${dir}: peer ${name} is pinned ${spec} but its devDependency is ${dev}`);
    }
  }
  for (const [name, versions] of [...pins].sort(([a], [b]) => a.localeCompare(b))) {
    if (versions.size > 1) {
      problems.push(`${name} is pinned to different exact versions: ${[...versions].map(([version, where]) => `${version} (${where.join(', ')})`).join('; ')}`);
    }
  }
  return problems;
}

function main() {
  const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
  const { members } = loadWorkspace(root);
  const manifests = [{ dir: '.', manifest: JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) }, ...members];
  const problems = checkPins(manifests);
  if (problems.length) {
    console.error(`check:pins FAILED (${problems.length})\n  - ${problems.join('\n  - ')}`);
    process.exit(1);
  }
  console.log(`check:pins ok: ${manifests.length} manifests`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
