#!/usr/bin/env node
// RR-20: every engines.node is an open-ended range (">=22"), never a closed one ("24.x", "^24", ">=22 <27").
//
// npm's manifest picker skips a dist-tag version whose engines.node does not match the running Node and silently
// installs the highest version that does. With "24.x", `npm i @openpresentation/cli @openpresentation/opf-render
// @openpresentation/opf-pptx` on Node 26 or 22 installed the 0.7.0 packages (no `export` or `render` command) instead of
// the latest release. This check fails on:
//   - a tracked package.json (any workspace package, the published-matrix consumer, a script package) whose
//     engines.node is not ">=<version>", or a published package whose range differs from the root's;
//   - a tracked package-lock.json whose root entry is closed, or that locks an @openpresentation package released after
//     the last closed-range releases (CLOSED_RANGE_RELEASES) with a closed range: the published-matrix consumer and the
//     coordinated locks then prove the registry artifacts carry the open range;
//   - the same @openpresentation entries in pnpm-lock.yaml;
//   - a workflow `node-version:` / `NODE_VERSION:` below the range's minimum (CI must run inside the declared range).
// Evidence and fixtures record history and are not checked.
//
// Usage: node scripts/check-engines-range.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The last releases of each package that declared "24.x" (published 2026-09-29 .. 2026-10-05). They are immutable on
// the registry, so a lockfile may still pin them; any later version must carry the open range.
export const CLOSED_RANGE_RELEASES = {
  '@openpresentation/opf': '0.12.1',
  '@openpresentation/cli': '0.10.0',
  '@openpresentation/opf-render': '0.12.0',
  '@openpresentation/opf-pptx': '0.12.3',
  '@openpresentation/opf-editor': '0.11.2',
};

// Workspace packages published to npm: their range must equal the root package.json's.
export const PUBLISHED_MANIFESTS = ['packages/javascript/package.json', 'packages/cli/package.json'];

const IGNORED = [/^docs\/evidence\//, /(^|\/)fixtures\//, /(^|\/)node_modules\//, /^artifacts\//];

const OPEN_RANGE = /^>=\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/;

/** The minimum major of an open range (">=22.12" -> 22), or null when the range is not open-ended. */
export function openRangeMinimum(range) {
  const match = OPEN_RANGE.exec(String(range ?? '').trim());
  return match ? Number(match[1]) : null;
}

function compareVersions(a, b) {
  const pa = String(a).split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0);
  const pb = String(b).split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < 3; i += 1) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

/** True when a lockfile may record a closed range for this package version (released before the fix). */
export function closedRangeAllowed(name, version) {
  const last = CLOSED_RANGE_RELEASES[name];
  return last !== undefined && compareVersions(version, last) <= 0;
}

/** Findings for one package.json: its engines.node, when present, must be open-ended. */
export function checkManifest(file, manifest) {
  const range = manifest?.engines?.node;
  if (range === undefined) return [];
  if (openRangeMinimum(range) === null) {
    return [`${file}: engines.node is "${range}"; use an open-ended range such as ">=22" (a closed range makes npm silently install an old release on other Node versions)`];
  }
  return [];
}

/** Findings for one package-lock.json (lockfileVersion 2 or 3). */
export function checkPackageLock(file, lock) {
  const findings = [];
  for (const [key, entry] of Object.entries(lock?.packages ?? {})) {
    const range = entry?.engines?.node;
    if (range === undefined) continue;
    if (key === '') {
      if (openRangeMinimum(range) === null) findings.push(`${file}: the root entry's engines.node is "${range}"; regenerate the lock after opening the range`);
      continue;
    }
    const name = key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length);
    if (!name.startsWith('@openpresentation/')) continue;
    if (openRangeMinimum(range) === null && !closedRangeAllowed(name, entry.version)) {
      findings.push(`${file}: ${name}@${entry.version} is locked with engines.node "${range}"; a release after the RR-20 fix must declare an open-ended range`);
    }
  }
  return findings;
}

/** Findings for pnpm-lock.yaml: @openpresentation package entries with a closed engines range. */
export function checkPnpmLock(file, text) {
  const findings = [];
  const entry = /^ {2}'?(@openpresentation\/[a-z0-9-]+)@(\d+\.\d+\.\d+[^'(:\s]*)[^\n]*:\n((?: {4}[^\n]*\n)*)/gm;
  for (const match of text.matchAll(entry)) {
    const engines = /^ {4}engines: \{node: '?([^}']+)'?\}/m.exec(match[3]);
    if (!engines) continue;
    const range = engines[1].trim();
    if (openRangeMinimum(range) === null && !closedRangeAllowed(match[1], match[2])) {
      findings.push(`${file}: ${match[1]}@${match[2]} is locked with engines.node "${range}"; a release after the RR-20 fix must declare an open-ended range`);
    }
  }
  return findings;
}

/** Findings for one workflow: every literal Node version must lie inside the declared range. */
export function checkWorkflow(file, text, minimum) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const match = /^\s*(?:-\s+)?(node-version|NODE_VERSION)\s*:\s*['"]?v?(\d+)(?:\.[\dx]+)*['"]?\s*(?:#.*)?$/.exec(lines[i]);
    if (match && Number(match[2]) < minimum) {
      findings.push(`${file}:${i + 1}: ${match[1]} ${match[2]} is below the declared engines.node minimum ${minimum}`);
    }
    const list = /^\s*node(?:-version)?\s*:\s*\[([^\]]*)\]/.exec(lines[i]);
    if (list) {
      for (const item of list[1].split(',')) {
        const major = Number.parseInt(item.replace(/['"\sv]/g, ''), 10);
        if (Number.isFinite(major) && major < minimum) findings.push(`${file}:${i + 1}: Node ${major} in the matrix is below the declared engines.node minimum ${minimum}`);
      }
    }
  }
  return findings;
}

export function checkRepo(root) {
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    .split('\0')
    .filter((file) => file && !IGNORED.some((re) => re.test(file)));
  const read = (file) => readFileSync(path.join(root, file), 'utf8');
  const findings = [];

  const rootManifest = JSON.parse(read('package.json'));
  const rootRange = rootManifest.engines?.node;
  const minimum = openRangeMinimum(rootRange);
  if (rootRange === undefined) findings.push('package.json: the root must declare engines.node (an open-ended range such as ">=22")');

  for (const file of tracked.filter((name) => path.posix.basename(name) === 'package.json')) {
    findings.push(...checkManifest(file, JSON.parse(read(file))));
  }
  for (const file of PUBLISHED_MANIFESTS) {
    const range = JSON.parse(read(file)).engines?.node;
    if (range === undefined) findings.push(`${file}: a published package must declare engines.node (the root declares "${rootRange}")`);
    else if (range !== rootRange) findings.push(`${file}: engines.node "${range}" differs from the root's "${rootRange}"; keep one range for every package`);
  }
  for (const file of tracked.filter((name) => path.posix.basename(name) === 'package-lock.json')) {
    findings.push(...checkPackageLock(file, JSON.parse(read(file))));
  }
  for (const file of tracked.filter((name) => path.posix.basename(name) === 'pnpm-lock.yaml')) {
    findings.push(...checkPnpmLock(file, read(file)));
  }
  if (minimum !== null) {
    for (const file of tracked.filter((name) => /^\.github\/(workflows|actions)\/.+\.ya?ml$/.test(name))) {
      findings.push(...checkWorkflow(file, read(file), minimum));
    }
  }
  return { range: rootRange, findings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { range, findings } = checkRepo(root);
  if (findings.length) {
    console.error(`check-engines-range: ${findings.length} finding(s):\n${findings.map((line) => `  ${line}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`check-engines-range: every engines.node is open-ended (${range}); locks and workflows agree`);
}
