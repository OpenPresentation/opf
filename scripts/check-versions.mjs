#!/usr/bin/env node
// MR-10 (monorepo plan D14, section 1 "One version"): the six published packages carry ONE version.
//
// Checked for the workspace members among core, cli, render, pptx, editor and gallery (a package directory that exists
// but is not listed in pnpm-workspace.yaml is inert, so an imported gallery still at its last independent version 5.0.0
// is not compared until its wire-up, MR-23, lists it and sets the shared version; D16: the gallery goes backwards from 5.0.0
// to the shared line, which npm allows with an explicit --tag latest). Private packages (packages/integration) are not
// part of the set. `scripts/release.mjs prepare` sets the version; this check fails when they differ.
//
// Usage: node scripts/check-versions.mjs [root]
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadWorkspace, SIX } from './workspace-packages.mjs';

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** Findings for members: [{dir, manifest}]. */
export function checkVersions(members) {
  const published = new Set(SIX.map(({ name }) => name));
  const set = members.filter(({ manifest }) => published.has(manifest.name));
  const problems = [];
  for (const { dir, manifest } of set) {
    if (!SEMVER.test(String(manifest.version))) problems.push(`${dir}: version ${JSON.stringify(manifest.version)} is not a semver version`);
  }
  const versions = new Set(set.map(({ manifest }) => manifest.version));
  if (versions.size > 1) {
    problems.push(`the published packages must share one version, found ${[...versions].sort().join(', ')}: ${set.map(({ dir, manifest }) => `${dir} ${manifest.version}`).join(', ')}`);
  }
  return problems;
}

function main() {
  const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
  const { members } = loadWorkspace(root);
  const problems = checkVersions(members);
  if (problems.length) {
    console.error(`check:versions FAILED (${problems.length})\n  - ${problems.join('\n  - ')}`);
    process.exit(1);
  }
  const set = members.filter(({ manifest }) => SIX.some(({ name }) => name === manifest.name));
  console.log(`check:versions ok: ${set.length} published packages at ${set[0]?.manifest.version ?? 'n/a'}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
