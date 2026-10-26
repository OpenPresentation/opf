#!/usr/bin/env node
// MR-10 (monorepo plan, section 1 "Guards"): the workspace dependency graph stays acyclic and shaped as designed.
//
// pnpm only warns about cyclic workspace dependencies, and a cycle makes `pnpm --filter "...[origin/main]"` over-select
// (spike S4/S5: a renderer change then selects core). The cycle can come back from a manifest edit (E1: core gets
// `workspace:*` devDependencies on render and pptx), from a peer that is not the workspace version (E2), or from one config
// line (E3: `link-workspace-packages=true` links the registry pins that happen to equal the workspace versions).
//
// Findings, for the workspace members (the packages listed in pnpm-workspace.yaml; an imported directory that is not listed
// is inert):
//   - pnpm-workspace.yaml lists packages explicitly (no glob: it breaks the frozen install once imported manifests exist);
//   - the graph of workspace:/link:/file: edges (dependencies, devDependencies, optionalDependencies) has no cycle;
//   - gallery has no edge to any member; core has edges to gallery only (its optional peers on render and pptx are peers,
//     not edges, and it has no devDependency pins on them: the engine tests live in packages/integration);
//   - a dependency on a member is `workspace:^`, a devDependency `workspace:*`; a registry specifier for a member's name is a
//     finding; a peer on a member is `workspace:^` when the package also has the `workspace:*` devDependency that installs it
//     (`pnpm pack` resolves a workspace: peer through node_modules), and the concrete range `^<member version>` when it cannot
//     have one: core's optional peers on render and pptx, whose devDependencies would close the cycle core -> pptx -> core;
//   - `linkWorkspacePackages: false` is set in pnpm-workspace.yaml (not .npmrc, which npm warns about for pnpm-only keys);
//     it is never true or deep there, and a legacy `link-workspace-packages` in .npmrc is not true or deep either;
//   - a `link:` between members in a pnpm-lock.yaml importer is declared by that importer's manifest and obeys the same
//     edge rules.
// Transitional state (until all seven packages are members, MR-23): the one registry specifier that exists today,
// `@openpresentation/cli` depending on `@openpresentation/opf` as `^X.Y.Z`, is accepted while a pnpm-workspace.yaml
// override maps it to `workspace:*`. Once all seven are members the override is no longer accepted.
//
// Usage: node scripts/check-workspace-graph.mjs [root]
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CORE, EDGE_FIELDS, GALLERY, loadWorkspace, PUBLISHED } from './workspace-packages.mjs';

const isWorkspaceSpec = (spec) => typeof spec === 'string' && /^(workspace:|link:|file:)/.test(spec);

/** The importers of a pnpm-lock.yaml (v9): `{ 'packages/cli': { '@scope/name': 'link:../javascript' } }`, resolved version only. */
export function parseLockImporters(text) {
  const importers = {};
  let inImporters = false;
  let importer = null;
  let name = null;
  for (const line of text.split(/\r?\n/)) {
    if (/^\S/.test(line)) {
      inImporters = line.startsWith('importers:');
      continue;
    }
    if (!inImporters) continue;
    let match = /^ {2}(\S.*):\s*$/.exec(line);
    if (match) {
      importer = match[1].replace(/^['"]|['"]$/g, '');
      importers[importer] = {};
      continue;
    }
    match = /^ {6}(\S.*):\s*$/.exec(line);
    if (match) {
      name = match[1].replace(/^['"]|['"]$/g, '');
      continue;
    }
    match = /^ {8}version:\s*(\S.*)$/.exec(line);
    if (match && importer !== null && name !== null) importers[importer][name] = match[1];
  }
  return importers;
}

/**
 * Findings for a workspace. members: [{dir, manifest}], workspace: parseWorkspaceYaml output, npmrc: text or '', lock:
 * pnpm-lock.yaml text or null.
 */
export function checkWorkspaceGraph({ members, workspace, npmrc = '', lock = null }) {
  const problems = [];
  const byName = new Map(members.map((member) => [member.manifest.name, member]));
  const strict = PUBLISHED.every(({ name }) => byName.has(name));

  for (const entry of workspace.packages) {
    if (entry.includes('*')) problems.push(`pnpm-workspace.yaml: the packages list must name each package, not a glob (${entry}); a glob breaks pnpm install --frozen-lockfile once imported manifests exist`);
  }

  // Edges: manifests, plus the transitional pnpm override that turns a registry specifier into a workspace link.
  const overridden = (from, to) => [`${from}>${to}`, to].some((key) => String(workspace.overrides[key] ?? '').startsWith('workspace:'));
  const edges = new Map([...byName.keys()].map((name) => [name, new Set()]));
  for (const [from, { manifest }] of byName) {
    for (const field of EDGE_FIELDS) {
      for (const [to, spec] of Object.entries(manifest[field] ?? {})) {
        if (!byName.has(to)) continue;
        const expected = field === 'devDependencies' ? 'workspace:*' : 'workspace:^';
        if (isWorkspaceSpec(spec)) {
          edges.get(from).add(to);
          if (spec !== expected) problems.push(`${from}: ${field} ${to} must be ${expected} (found ${spec})`);
        } else if (!strict && overridden(from, to)) {
          edges.get(from).add(to); // transitional: a registry range that pnpm links to the workspace through an override
        } else {
          problems.push(`${from}: ${field} ${to} is the registry specifier ${spec}; a workspace package is ${expected}`);
        }
      }
    }
    for (const [to, spec] of Object.entries(manifest.peerDependencies ?? {})) {
      if (!byName.has(to)) continue;
      if (isWorkspaceSpec(manifest.devDependencies?.[to])) {
        if (spec !== 'workspace:^') problems.push(`${from}: peer ${to} must be workspace:^ (found ${spec})`);
      } else {
        // Nothing installs the peer, so `pnpm pack` could not resolve a workspace: range (ERR_PNPM_CANNOT_RESOLVE_WORKSPACE_PROTOCOL).
        const expected = `^${byName.get(to).manifest.version}`;
        if (spec !== expected) problems.push(`${from}: peer ${to} has no workspace devDependency (it would close a cycle), so it must be the concrete range ${expected}, the version of ${to} in this workspace (found ${spec})`);
      }
    }
  }

  // The lockfile: a link: between members must be declared by the importer's manifest and follow the same rules.
  if (lock !== null) {
    const nameOf = new Map(members.map((member) => [member.dir, member.manifest.name]));
    for (const [importerDir, deps] of Object.entries(parseLockImporters(lock))) {
      const from = nameOf.get(importerDir);
      if (!from) continue;
      for (const [to, version] of Object.entries(deps)) {
        if (!version.startsWith('link:')) continue;
        const target = path.posix.normalize(path.posix.join(importerDir, version.slice(5)));
        if (nameOf.get(target) !== to) continue;
        const declared = EDGE_FIELDS.some((field) => byName.get(from).manifest[field]?.[to] !== undefined);
        if (!declared) problems.push(`pnpm-lock.yaml: ${importerDir} links ${to} (${version}), which its package.json does not declare`);
        edges.get(from).add(to);
      }
    }
  }

  // 1. acyclic
  const state = new Map();
  const visit = (node, trail) => {
    if (state.get(node) === 2) return;
    if (state.get(node) === 1) {
      problems.push(`cycle: ${[...trail.slice(trail.indexOf(node)), node].join(' -> ')}`);
      return;
    }
    state.set(node, 1);
    for (const next of edges.get(node)) visit(next, [...trail, node]);
    state.set(node, 2);
  };
  for (const name of edges.keys()) visit(name, []);

  // 2. gallery has no edge; core has edges to gallery only
  if (edges.has(GALLERY) && edges.get(GALLERY).size) problems.push(`${GALLERY} must have no workspace dependencies (found ${[...edges.get(GALLERY)].join(', ')}): its engine-dependent checks run from packages/integration or the root`);
  if (edges.has(CORE)) {
    const extra = [...edges.get(CORE)].filter((name) => name !== GALLERY);
    if (extra.length) problems.push(`${CORE} must not depend on ${extra.join(', ')} through the workspace: render and pptx are optional peers, and the tests that need them live in packages/integration`);
  }

  // 3. linking of registry specifiers to workspace packages stays off
  if (/^\s*link-workspace-packages\s*=\s*(true|deep)\b/m.test(npmrc)) problems.push('.npmrc: link-workspace-packages must not be true');
  if (/^(true|deep)$/.test(workspace.scalars.linkWorkspacePackages ?? '')) problems.push('pnpm-workspace.yaml: linkWorkspacePackages must not be true');

  return problems;
}

function main() {
  const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
  const { workspace, members } = loadWorkspace(root);
  const read = (file) => (existsSync(path.join(root, file)) ? readFileSync(path.join(root, file), 'utf8') : null);
  if (workspace.scalars.linkWorkspacePackages !== 'false') {
    console.error('check:workspace-graph FAILED\n  - pnpm-workspace.yaml must set linkWorkspacePackages: false');
    process.exit(1);
  }
  const problems = checkWorkspaceGraph({ members, workspace, npmrc: read('.npmrc') ?? '', lock: read('pnpm-lock.yaml') });
  if (problems.length) {
    console.error(`check:workspace-graph FAILED (${problems.length})\n  - ${problems.join('\n  - ')}`);
    process.exit(1);
  }
  console.log(`check:workspace-graph ok: ${members.length} workspace packages (${members.map((member) => member.dir).join(', ')})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
