#!/usr/bin/env node
// RR-100: the release-prep fast path of the merge queue.
//
// A release-prep pull request (`release-train.mjs prep`) changes only versions, the changelogs, dependency ranges and the
// lockfile, and its CI already ran in full on the pull request. The queue run of such a change re-tests a tree that differs
// from the last green main commit by a version number, so for it the required checks only need to prove that the release
// files are consistent. `scope` decides whether a merge_group run is such a change; `check` is the minimal job's version and
// changelog check. Every other change, and every case this script cannot classify, runs the full queue unchanged.
//
//   node scripts/release-prep.mjs scope    # merge_group only: writes release_prep=true|false (+ package, version) to $GITHUB_OUTPUT
//   node scripts/release-prep.mjs check    # env RELEASE_PREP_PACKAGE (core|cli), RELEASE_PREP_VERSION
//
// The fast path is taken only when ALL of these hold (fail closed: anything else is "full"):
//   1. the event is merge_group and GITHUB_SHA, HEAD and merge_group.head_sha are one commit;
//   2. the diff from merge_group.base_sha to that commit is non-empty and touches only files a release-prep PR may touch:
//        - packages/javascript/package.json and packages/cli/package.json, changed in `version` and in the ranges of
//          `@openpresentation/*` dependencies only (and the deletion of opf.requiresUnreleasedCore); any other change to them,
//          such as a script, a file list, an engine or a third-party dependency, is not release-prep;
//        - CHANGELOG.md and packages/cli/CHANGELOG.md, with added lines only;
//        - pnpm-lock.yaml;
//        - changes/<slug>.md fragments, deleted or rewritten exactly as the assembler does (`withoutPackage`);
//      no file is added, renamed or deleted besides those fragments;
//   3. the pull request of the queue entry exists, is from a branch of this repository named codex/release-<core|cli>-X-Y-Z
//      into main, carries the marker release-train.mjs prep writes into its body (`prepMarker`) for the same package and
//      version, and the diff sets that package's manifest to that version.
// The diff is the guard (1 and 2 cannot be satisfied by a code change); the marker (3) ties the entry to the train.
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractReleaseNotes } from './release-notes.mjs';
import { loadConfig, readFragments, selectFragments, withoutPackage } from './changelog-fragments.mjs';

/** The packages of this repository's release train: manifest, changelog and the changelog target of `changes/config.json`. */
export const PREP_PACKAGES = {
  core: { name: '@openpresentation/opf', manifest: 'packages/javascript/package.json', changelog: 'CHANGELOG.md', target: 'opf', titleNames: ['core', 'opf', '@openpresentation/opf'] },
  cli: { name: '@openpresentation/cli', manifest: 'packages/cli/package.json', changelog: 'packages/cli/CHANGELOG.md', target: 'cli', titleNames: ['cli', '@openpresentation/cli'] },
};
const LOCKFILE = 'pnpm-lock.yaml';
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const ECOSYSTEM = '@openpresentation/';
const RANGE = /^[\^~>=]*\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const BRANCH = /^codex\/release-(core|cli)-(\d+)-(\d+)-(\d+)$/;
const QUEUE_REF = /^(?:refs\/heads\/)?gh-readonly-queue\/[^/]+\/pr-(\d+)-[0-9a-f]{40}$/;

/** The line `release-train.mjs prep` writes into the pull request body; the fast path reads it back. */
export const prepMarker = (key, version) => `<!-- release-train-prep: ${key} ${version} -->`;

/** { key, version } of the one marker in a pull request body, or null (none, several, or a package that is not core or cli). */
export function parsePrepMarker(body) {
  const found = [...String(body ?? '').matchAll(/<!-- release-train-prep: (\S+) (\S+) -->/g)];
  if (found.length !== 1) return null;
  const [, key, version] = found[0];
  return key in PREP_PACKAGES && VERSION.test(version) ? { key, version } : null;
}

/** The pull request number of a merge-queue branch (gh-readonly-queue/main/pr-760-<sha>), or null. */
export const queuePullNumber = (headRef) => Number(QUEUE_REF.exec(String(headRef ?? ''))?.[1]) || null;

const sorted = (value) => (Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])])) : value);
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

/**
 * Why a manifest change is not a release-prep change, or null when it is one: only `version`, the ranges of existing
 * `@openpresentation/*` dependencies and the deletion of `opf.requiresUnreleasedCore` may differ.
 */
export function manifestProblem(baseText, headText) {
  let base;
  let head;
  try {
    base = JSON.parse(baseText);
    head = JSON.parse(headText);
  } catch {
    return 'is not valid JSON';
  }
  if (!base || !head || typeof base !== 'object' || typeof head !== 'object') return 'is not a JSON object';
  if (typeof head.version !== 'string' || !VERSION.test(head.version)) return 'has no release version';
  delete base.version;
  delete head.version;
  for (const field of DEPENDENCY_FIELDS) {
    const before = base[field];
    const after = head[field];
    if (before === undefined && after === undefined) continue;
    if (!before || !after || typeof before !== 'object' || typeof after !== 'object' || !same(Object.keys(before).sort(), Object.keys(after).sort())) return `changes which packages ${field} names`;
    for (const name of Object.keys(before)) {
      if (!name.startsWith(ECOSYSTEM)) continue;
      if (before[name] !== after[name] && !(typeof after[name] === 'string' && RANGE.test(after[name]))) return `sets ${field} ${name} to something other than a version range`;
      delete before[name];
      delete after[name];
    }
  }
  for (const manifest of [base, head]) {
    if (manifest.opf && typeof manifest.opf === 'object') {
      delete manifest.opf.requiresUnreleasedCore;
      if (!Object.keys(manifest.opf).length) delete manifest.opf;
    }
  }
  return same(base, head) ? null : 'changes more than its version and its @openpresentation dependency ranges';
}

/**
 * Whether every change of the diff is one a release-prep PR may make. `changes` is [{ status, file, added, deleted }] (git
 * name-status, --no-renames, with the numstat line counts); `read(ref, file)` returns a file's text at `base` or `head`.
 * Returns { ok, problems }.
 */
export function classifyChanges(changes, read, { fragmentTargets = Object.values(PREP_PACKAGES).map((pkg) => pkg.target) } = {}) {
  const problems = [];
  if (changes.length === 0) problems.push('the diff is empty');
  const manifests = new Set(Object.values(PREP_PACKAGES).map((pkg) => pkg.manifest));
  const changelogs = new Set(Object.values(PREP_PACKAGES).map((pkg) => pkg.changelog));
  for (const { status, file, deleted } of changes) {
    if (manifests.has(file)) {
      if (status !== 'M') problems.push(`${file} is ${status === 'A' ? 'added' : status === 'D' ? 'deleted' : `changed as ${status}`}, not modified`);
      else {
        const problem = manifestProblem(read('base', file) ?? '', read('head', file) ?? '');
        if (problem) problems.push(`${file} ${problem}`);
      }
    } else if (changelogs.has(file)) {
      if (status !== 'M' || deleted !== 0) problems.push(`${file} must only gain lines (${status}, ${deleted} removed)`);
    } else if (file === LOCKFILE) {
      if (status !== 'M') problems.push(`${file} is ${status}, not modified`);
    } else if (/^changes\/(?!README\.md$)[^/]+\.md$/.test(file)) {
      if (status === 'M') {
        const before = read('base', file) ?? '';
        const after = read('head', file);
        if (!fragmentTargets.some((target) => withoutPackage(before, target) === after)) problems.push(`${file} was edited, not consumed by the changelog assembler`);
      } else if (status !== 'D') problems.push(`${file} is added; a release-prep PR only consumes fragments`);
    } else problems.push(`${file} is not a release-prep file`);
  }
  return { ok: problems.length === 0, problems };
}

/** { package, version } the pull request announces, or a { reason }: its branch, body marker and title must agree. */
export function checkPull(pull, repository) {
  const branch = BRANCH.exec(pull?.head?.ref ?? '');
  if (!branch) return { reason: `the pull request branch ${pull?.head?.ref} is not codex/release-<core|cli>-X-Y-Z` };
  if (pull.head?.repo?.full_name !== repository || pull.base?.ref !== 'main') return { reason: 'the pull request is not from a branch of this repository into main' };
  const marker = parsePrepMarker(pull.body);
  if (!marker) return { reason: 'the pull request body has no release-train prep marker' };
  const version = `${branch[2]}.${branch[3]}.${branch[4]}`;
  if (marker.key !== branch[1] || marker.version !== version) return { reason: `the marker (${marker.key} ${marker.version}) and the branch (${branch[1]} ${version}) disagree` };
  const names = PREP_PACKAGES[marker.key].titleNames.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  if (!new RegExp(`\\brelease\\s+(?:${names})\\s+v?${version.replaceAll('.', '\\.')}(?![\\w.-])`, 'i').test(pull.title ?? '')) return { reason: `the pull request title does not announce release ${marker.key} ${version}` };
  return { package: marker.key, version };
}

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });

/** The decision for one merge_group run. `fetchPull(number)` returns the pull request JSON; everything else is local git. */
export async function releasePrepScope({ event, eventName, sha, repository, cwd = process.cwd(), fetchPull, run = git }) {
  const full = (reason) => ({ releasePrep: false, reason });
  if (eventName !== 'merge_group') return full(`${eventName || 'local'} runs always run in full`);
  const group = event?.merge_group;
  if (!group || !/^[0-9a-f]{40}$/.test(group.base_sha ?? '') || !/^[0-9a-f]{40}$/.test(group.head_sha ?? '')) return full('the merge group event has no base and head commit');
  try {
    const head = run(['rev-parse', 'HEAD^{commit}'], cwd).trim();
    if (head !== group.head_sha || sha !== group.head_sha) return full('the checkout is not the merge group head commit');
    if (head === group.base_sha) return full('the merge group has no changes');
    try {
      run(['cat-file', '-e', `${group.base_sha}^{commit}`], cwd);
    } catch {
      run(['fetch', '--no-tags', '--depth=1', 'origin', group.base_sha], cwd);
    }
    const names = run(['diff', '--name-status', '--no-renames', '-z', group.base_sha, head], cwd).split('\0').filter(Boolean);
    const counts = new Map(run(['diff', '--numstat', '--no-renames', '-z', group.base_sha, head], cwd).split('\0').filter(Boolean).map((entry) => {
      const [added, deleted, ...file] = entry.split('\t');
      return [file.join('\t'), { added: Number(added), deleted: Number(deleted) }];
    }));
    const changes = [];
    for (let i = 0; i + 1 < names.length; i += 2) changes.push({ status: names[i], file: names[i + 1], ...(counts.get(names[i + 1]) ?? { added: 0, deleted: 0 }) });
    const read = (side, file) => {
      try {
        return run(['show', `${side === 'base' ? group.base_sha : head}:${file}`], cwd);
      } catch {
        return null;
      }
    };
    const verdict = classifyChanges(changes, read);
    if (!verdict.ok) return full(`not a release-prep diff: ${verdict.problems.slice(0, 3).join('; ')}${verdict.problems.length > 3 ? '; ...' : ''}`);
    const number = queuePullNumber(group.head_ref);
    if (!number) return full(`the merge queue branch ${group.head_ref} names no pull request`);
    const announced = checkPull(await fetchPull(number), repository);
    if (announced.reason) return full(announced.reason);
    const manifest = PREP_PACKAGES[announced.package].manifest;
    let version;
    let before;
    try {
      version = JSON.parse(read('head', manifest) ?? '').version;
      before = JSON.parse(read('base', manifest) ?? '').version;
    } catch {
      return full(`${manifest} is not readable on both sides of the diff`);
    }
    if (version !== announced.version || before === version) return full(`the diff does not set ${manifest} to ${announced.version} (base ${before}, head ${version})`);
    return { releasePrep: true, package: announced.package, version, reason: `${changes.length} changed files, all release-prep files; pull request ${number} announces ${announced.package} ${version}` };
  } catch (error) {
    return full(`could not classify the merge group (${String(error.message).split('\n')[0]})`);
  }
}

/** The version and changelog checks of the minimal job (the head checkout only). Returns the problems; none means pass. */
export function checkRelease({ key, version, root = process.cwd() }) {
  const pkg = PREP_PACKAGES[key];
  if (!pkg) return [`RELEASE_PREP_PACKAGE must be one of ${Object.keys(PREP_PACKAGES).join(', ')}`];
  if (!VERSION.test(version ?? '')) return ['RELEASE_PREP_VERSION is not a release version'];
  const problems = [];
  const manifest = JSON.parse(readFileSync(path.join(root, pkg.manifest), 'utf8'));
  if (manifest.version !== version) problems.push(`${pkg.manifest} carries ${manifest.version}, not ${version}`);
  if (manifest.name !== pkg.name) problems.push(`${pkg.manifest} is ${manifest.name}, not ${pkg.name}`);
  if (!extractReleaseNotes(readFileSync(path.join(root, pkg.changelog), 'utf8'), version)) problems.push(`${pkg.changelog} has no non-empty "## ${version}" section`);
  const config = loadConfig(root);
  const left = selectFragments(readFragments(root, config), pkg.target, config);
  if (left.length) problems.push(`fragments for ${pkg.target} are left in changes/: ${left.map((fragment) => fragment.slug).join(', ')}`);
  return problems;
}

async function githubPull({ repository, token, number, fetchImpl = globalThis.fetch }) {
  const response = await fetchImpl(`${process.env.GITHUB_API_URL || 'https://api.github.com'}/repos/${repository}/pulls/${number}`, { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!response.ok) throw new Error(`GET pulls/${number} failed with HTTP ${response.status}`);
  return response.json();
}

export async function main(argv, env = process.env, log = console.log) {
  const [command] = argv;
  if (command === 'scope') {
    let event = null;
    try {
      event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
    } catch {}
    const repository = env.GITHUB_REPOSITORY;
    const decision = await releasePrepScope({ event, eventName: env.GITHUB_EVENT_NAME, sha: env.GITHUB_SHA, repository, fetchPull: (number) => githubPull({ repository, token: env.GITHUB_TOKEN, number }) });
    log(`Release-prep fast path: ${decision.releasePrep ? 'taken' : 'not taken'} (${decision.reason}).`);
    if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `release_prep=${decision.releasePrep}\n${decision.releasePrep ? `package=${decision.package}\nversion=${decision.version}\n` : ''}`);
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `Release-prep fast path: **${decision.releasePrep ? 'taken' : 'not taken'}** (${decision.reason}).\n`);
    return 0;
  }
  if (command === 'check') {
    const problems = checkRelease({ key: env.RELEASE_PREP_PACKAGE, version: env.RELEASE_PREP_VERSION });
    for (const problem of problems) log(`release-prep: ${problem}`);
    if (!problems.length) log(`release-prep: ${env.RELEASE_PREP_PACKAGE} ${env.RELEASE_PREP_VERSION}: manifest version, changelog section and fragments are consistent.`);
    return problems.length ? 1 : 0;
  }
  log('Usage: node scripts/release-prep.mjs scope | check');
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => { console.error(error.message); process.exitCode = 1; });
}
