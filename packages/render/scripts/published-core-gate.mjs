#!/usr/bin/env node
// RR-55: lets a pull request that needs an unreleased OPF core skip only the "packed install against published
// dependencies" step of CI. A package declares the core it needs in package.json:
//
//   "opf": { "requiresUnreleasedCore": "0.14.0" }
//
// While the published @openpresentation/opf that `npm ci` installed is lower than that version, this script says
// `skip=true` and the workflow skips `npm run test:packed` (which installs the packed package against the registry and so
// cannot work yet). Every linked-ecosystem step (link, typecheck, tests, goldens, browser) still runs. With no field, or
// with an installed core at or above it, nothing changes. The field is for pull requests: the release-prep PR deletes it
// (core's scripts/release-train.mjs prep) and the release workflows run this script with --forbid.
//
//   node scripts/published-core-gate.mjs            report; with $GITHUB_OUTPUT set, write skip=true|false and, when
//                                                   skipping, a ::notice::
//   node scripts/published-core-gate.mjs --forbid   exit 1 when package.json declares the field (release workflows)
//   --root <dir>                                    the package to read (default: this repository; used by the test)
//
// Identical in the sibling repositories (opf-render, opf-pptx, opf-editor).
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const CORE = '@openpresentation/opf';

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/** { major, minor, patch, pre: string[] } for a semver 2.0.0 version, or null (build metadata is ignored). */
export function parseVersion(text) {
  const match = typeof text === 'string' ? SEMVER.exec(text) : null;
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), pre: match[4] ? match[4].split('.') : [] };
}

/** Semver precedence: -1, 0 or 1. A prerelease is lower than its release (0.14.0-rc.1 < 0.14.0). */
export function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) throw new Error(`not a semver version: ${JSON.stringify(x ? b : a)}`);
  for (const key of ['major', 'minor', 'patch']) if (x[key] !== y[key]) return x[key] < y[key] ? -1 : 1;
  if (!x.pre.length || !y.pre.length) return x.pre.length === y.pre.length ? 0 : x.pre.length ? -1 : 1;
  for (let i = 0; i < Math.min(x.pre.length, y.pre.length); i += 1) {
    const p = x.pre[i];
    const q = y.pre[i];
    if (p === q) continue;
    const numericP = /^\d+$/.test(p);
    const numericQ = /^\d+$/.test(q);
    if (numericP && numericQ) return Number(p) < Number(q) ? -1 : 1;
    if (numericP !== numericQ) return numericP ? -1 : 1;
    return p < q ? -1 : 1;
  }
  return x.pre.length === y.pre.length ? 0 : x.pre.length < y.pre.length ? -1 : 1;
}

/** The declared `opf.requiresUnreleasedCore` of a manifest, or null. A value that is not a version is an error. */
export function declaredFloor(manifest) {
  const value = manifest?.opf?.requiresUnreleasedCore;
  if (value === undefined) return null;
  if (!parseVersion(value)) throw new Error(`package.json opf.requiresUnreleasedCore must be a version such as "0.14.0", not ${JSON.stringify(value)}`);
  return value;
}

/**
 * Whether to skip the published-dependency check. `declared` is the field (or null), `installed` the version of the
 * published core `npm ci` installed. Skips only when the field is set and the installed core is lower than it.
 */
export function decide({ declared, installed }) {
  if (declared === null || declared === undefined) return { skip: false };
  if (!parseVersion(installed)) throw new Error(`cannot read the installed ${CORE} version (${JSON.stringify(installed)}); run npm ci first`);
  if (compareVersions(installed, declared) >= 0) return { skip: false, note: `the installed published ${CORE} ${installed} already satisfies opf.requiresUnreleasedCore ${declared}; the packed install runs` };
  return {
    skip: true,
    message: `RR-55: package.json declares opf.requiresUnreleasedCore ${declared} and the installed published ${CORE} is ${installed}, so the packed install against published dependencies (npm run test:packed) is skipped. Every linked-ecosystem step still runs. The release-prep PR deletes the field.`,
  };
}

/** The version of the published core installed under `root` (the nearest node_modules that has it), or null. */
export function installedCoreVersion(root) {
  for (let dir = path.resolve(root); ; dir = path.dirname(dir)) {
    const file = path.join(dir, 'node_modules', ...CORE.split('/'), 'package.json');
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')).version ?? null;
    if (path.dirname(dir) === dir) return null;
  }
}

/** Runs the gate for the package at `root`: { skip, message?, note?, declared }. */
export function gate(root, { forbid = false } = {}) {
  const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const declared = declaredFloor(manifest);
  if (forbid) {
    if (declared !== null) throw new Error(`package.json declares opf.requiresUnreleasedCore ${declared}; the field is for pull requests and must be deleted before a release (core's release-train prep does this)`);
    return { skip: false, declared };
  }
  return { ...decide({ declared, installed: declared === null ? null : installedCoreVersion(root) }), declared };
}

function main(argv, env = process.env) {
  const rootFlag = argv.indexOf('--root');
  const root = rootFlag === -1 ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') : path.resolve(argv[rootFlag + 1]);
  const result = gate(root, { forbid: argv.includes('--forbid') });
  if (result.skip) console.log(`::notice::${result.message}`);
  else if (result.note) console.log(result.note);
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `skip=${result.skip}\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
