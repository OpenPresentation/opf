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
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CORE, loadWorkspace, SIX } from './workspace-packages.mjs';

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

/**
 * Core's optional peers on render and pptx are concrete ranges (`^<version>`, see check:workspace-graph) and its install hints,
 * `PEER_RANGES` in src/node/peers.ts, name the same ranges; `scripts/release.mjs prepare` sets all of them with the version, and
 * this fails when one is left behind. `hints` is the text of peers.ts (or null when it is not in the workspace).
 */
export function checkPeerRanges(members, hints) {
  const core = members.find(({ manifest }) => manifest.name === CORE);
  if (!core) return [];
  const problems = [];
  const expected = `^${core.manifest.version}`;
  for (const { name } of SIX.filter(({ name }) => core.manifest.peerDependencies?.[name] !== undefined)) {
    const peer = core.manifest.peerDependencies[name];
    const member = members.find((entry) => entry.manifest.name === name);
    if (member && peer !== `^${member.manifest.version}`) problems.push(`${core.dir}: peer ${name} is ${peer}, the workspace version of ${name} is ${member.manifest.version}`);
  }
  const ranges = hints === null ? null : /PEER_RANGES\s*=\s*\{([^}]*)\}/.exec(hints)?.[1];
  if (hints !== null && ranges === undefined) problems.push(`${core.dir}: PEER_RANGES not found in src/node/peers.ts`);
  for (const [, version] of ranges ? [...ranges.matchAll(/"([^"]+)"/g)] : []) {
    if (version !== expected) problems.push(`${core.dir}: PEER_RANGES in src/node/peers.ts has ${version}, core is ${core.manifest.version} (${expected})`);
  }
  return problems;
}

function main() {
  const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
  const { members } = loadWorkspace(root);
  const peers = path.join(root, 'packages/javascript/src/node/peers.ts');
  const problems = [...checkVersions(members), ...checkPeerRanges(members, existsSync(peers) ? readFileSync(peers, 'utf8') : null)];
  if (problems.length) {
    console.error(`check:versions FAILED (${problems.length})\n  - ${problems.join('\n  - ')}`);
    process.exit(1);
  }
  const set = members.filter(({ manifest }) => SIX.some(({ name }) => name === manifest.name));
  console.log(`check:versions ok: ${set.length} published packages at ${set[0]?.manifest.version ?? 'n/a'}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
