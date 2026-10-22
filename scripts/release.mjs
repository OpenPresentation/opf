#!/usr/bin/env node
// MR-40 (monorepo plan, section 5 "Release: one click"): the release script of the six published packages. One version for all
// six, one tag `vX.Y.Z`, one publisher workflow (`.github/workflows/npm-publish.yml`). The workflows call these commands:
//
//   node scripts/release.mjs prepare <version|patch|minor> [--previous V] [--stability file | --no-stability] [--date D]
//                            [--no-lockfile] [--dry-run] [--github-output file] [--dir root]
//       Sets the six package versions, core's peer ranges and PEER_RANGES (src/node/peers.ts), assembles every changes/ fragment
//       into its package changelog (a package without one gets "No package changes; released with the set."), deletes the
//       consumed fragments, refreshes the lockfile and re-checks check:versions. Before it writes anything it applies the
//       gallery stability gate (scripts/gallery-stability.mjs gateVersion: a declared drawing change, a removed record id or a
//       CATALOG_SCHEMA change needs a minor, never a patch) and the version rules below. --dry-run writes nothing.
//   node scripts/release.mjs pack <version> --commit <sha> --out <dir>
//       `pnpm pack` of the six (the build already ran), gitHead stamped into each tarball (scripts/stamp-githead.mjs),
//       <dir>/release-manifest.json with the name, file and sha512 of each.
//   node scripts/release.mjs smoke <version> (--dir <tarballs> | --registry)
//       Installs the six tarballs together in a clean project, renders the quickstart deck with the renderer and the gallery,
//       resolves every entry point and runs the CLI: the packed shape of the release, before anything is published (--registry: the same from npm, after).
//   node scripts/release.mjs check-publish <version> [--tag latest|next]
//       The pre-publish gate: each package's version is above its registry `latest` (the gallery: above the shared line, never
//       against its own 5.0.0), a stable version goes to `latest` and a prerelease to a different tag.
//   node scripts/release.mjs publish <version> --dir <tarballs> [--tag latest|next] [--dry-run]
//       check-publish, then `npm publish <tarball> --access public --provenance --tag <tag>` in dependency order (gallery, core,
//       render, pptx, editor, cli). The tag is explicit for all six (the gallery needs it, D16). A version already on npm is
//       skipped, so a re-run continues where the last one stopped. --dry-run passes npm's --dry-run (no provenance: it needs
//       the OIDC token of a real run).
//   node scripts/release.mjs verify <version> [--tag latest|next] [--commit sha] [--wait minutes] [--json] [--no-audit]
//       For all six: registry manifest, gitHead and provenance source commit = the release commit, provenance workflow
//       npm-publish.yml on refs/tags/vX.Y.Z, dist-tag, lockstep ranges, signatures, the changelog section.
//   node scripts/release.mjs notes <version> [--out file]
//       The GitHub release body: each package's changelog section, grouped by package.
//   node scripts/release.mjs order
//       The publish order, one npm name per line.
//
// Version rules (prepare): X.Y.Z or X.Y.Z-<prerelease> (the canary 0.26.0-rc.0 goes to `next`), or `patch` / `minor` of the
// shared line. "Previous" is the shared line's last release: the highest `latest` of the five packages that were never above it
// (core, CLI, renderer, PPTX, editor), not the gallery, whose 5.0.0 is above the shared 0.x line (D16). Nothing is published
// from here: the workflows do that.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assemble, loadConfig, readFragments, selectFragments } from './changelog-fragments.mjs';
import { checkPeerRanges, checkVersions } from './check-versions.mjs';
import { gateVersion } from './gallery-stability.mjs';
import { compareVersions, formatVerify, highest, isPrerelease, isVersion, npmRegistry, parseVersion, run, verifyPackage } from './release-registry.mjs';
import { extractReleaseNotes } from './release-notes.mjs';
import { stampGitHead } from './stamp-githead.mjs';
import { CORE, GALLERY, SIX } from './workspace-packages.mjs';

export const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const NO_CHANGES = 'No package changes; released with the set.';
export const DIST_TAGS = ['latest', 'next'];
const PEERS_FILE = 'packages/javascript/src/node/peers.ts';

/**
 * The six packages in publish order: dependency order, spelled out and not left to pnpm's (spike S4, F7). The gallery goes first
 * (core depends on it, and a misconfigured trusted-publisher entry then fails before anything else is published, MR-41), then
 * core, the renderer and PPTX (PPTX reads the renderer), the editor (reads both) and the CLI (depends on core, peers on the
 * renderer and PPTX). `key` is the name of its changelog in changes/config.json.
 */
export const PACKAGES = [
  { key: 'gallery', dir: 'gallery', name: GALLERY },
  { key: 'opf', dir: 'javascript', name: CORE },
  { key: 'render', dir: 'render', name: '@openpresentation/opf-render' },
  { key: 'pptx', dir: 'pptx', name: '@openpresentation/opf-pptx' },
  { key: 'editor', dir: 'editor', name: '@openpresentation/opf-editor' },
  { key: 'cli', dir: 'cli', name: '@openpresentation/cli' },
];
export const NAMES = PACKAGES.map((pkg) => pkg.name);
/** The five packages that were never above the shared line; the gallery is compared against them. */
export const SHARED_LINE = PACKAGES.filter((pkg) => pkg.name !== GALLERY);
export const tagOf = (version) => `v${version}`;

for (const { name } of SIX) if (!NAMES.includes(name)) throw new Error(`release.mjs does not list ${name}`);

// ---------------------------------------------------------------------------------------------------------------------
// Pure text edits

/** `text` (a package.json) with its top-level version replaced; the rest of the file is untouched. */
export function setVersionText(text, version) {
  const pattern = /^(\s{2}"version":\s*)"[^"]*"/m;
  if (!pattern.test(text)) throw new Error('package.json has no top-level "version"');
  return text.replace(pattern, `$1"${version}"`);
}

/** Core's package.json with every peer on one of the six set to `^<version>` (the optional peers are concrete ranges, D12). */
export function setPeerRangesText(text, version) {
  const block = /("peerDependencies"\s*:\s*\{)([^}]*)(\})/;
  if (!block.test(text)) return text;
  return text.replace(block, (_, open, body, close) => `${open}${body.replace(/("@openpresentation\/[^"]+"\s*:\s*)"[^"]*"/g, (entry, key) => (NAMES.includes(/"([^"]+)"/.exec(key)[1]) ? `${key}"^${version}"` : entry))}${close}`);
}

/** src/node/peers.ts with every range of PEER_RANGES set to `^<version>`. */
export function setPeerHintsText(text, version) {
  const block = /(PEER_RANGES\s*=\s*\{)([^}]*)(\})/;
  if (!block.test(text)) throw new Error('PEER_RANGES not found in src/node/peers.ts');
  return text.replace(block, (_, open, body, close) => `${open}${body.replace(/"[^"]*"/g, `"^${version}"`)}${close}`);
}

/** `version` as given, or the next patch or minor of `current` for the keywords `patch` and `minor`. */
export function resolveVersion(input, current) {
  if (input === 'patch' || input === 'minor') {
    const v = parseVersion(current);
    if (v.pre) throw new Error(`${current} is a prerelease; name the version (X.Y.Z), not "${input}"`);
    return input === 'patch' ? `${v.major}.${v.minor}.${v.patch + 1}` : `${v.major}.${v.minor + 1}.0`;
  }
  if (!isVersion(input)) throw new Error(`"${input}" is not X.Y.Z, X.Y.Z-<prerelease>, patch or minor (build metadata is not allowed in a release tag)`);
  return input;
}

/** The dist-tag a version belongs on unless the caller names one: `latest` for a release, `next` for a prerelease. */
export const defaultTag = (version) => (isPrerelease(version) ? 'next' : 'latest');

/** Problems with a dist-tag choice: a prerelease must not take `latest`, and a release must. */
export function checkTag(version, tag) {
  if (!DIST_TAGS.includes(tag)) return [`--tag ${tag}: one of ${DIST_TAGS.join(', ')}`];
  if (isPrerelease(version) && tag === 'latest') return [`${version} is a prerelease and would become \`latest\`; publish it with --tag next`];
  if (!isPrerelease(version) && tag !== 'latest') return [`${version} is a release; --tag ${tag} would leave \`latest\` behind (use a prerelease version for ${tag})`];
  return [];
}

// ---------------------------------------------------------------------------------------------------------------------
// Registry state

/** `{ [name]: latest version | undefined }` for the six. */
export async function latestVersions(registry) {
  const entries = await Promise.all(PACKAGES.map(async ({ name }) => [name, (await registry.distTags(name)).latest]));
  return Object.fromEntries(entries);
}

/**
 * The shared line's last release: the highest `latest` below `version` among the five packages that never left the 0.x line.
 * A `latest` at or above `version` is a package this release already published (a re-run) or a mistake the per-package rule of
 * `checkPublish` reports, so it does not move the line.
 */
export function sharedLine(latest, version) {
  return highest(SHARED_LINE.map(({ name }) => latest[name]).filter((entry) => entry && compareVersions(entry, version) < 0));
}

/**
 * The pre-publish gate. `registry` is { distTags, manifest }. Returns { problems, skip: [names already on npm], previous, latest }.
 * Each package not yet on npm must be above its own `latest`; the gallery must be above the shared line instead (its own `latest`
 * is a 5.0.0 that stays published and keeps the shared 0.x version "below" it, D16).
 */
export async function checkPublish(registry, version, tag) {
  const problems = checkTag(version, tag);
  const latest = await latestVersions(registry);
  const skip = [];
  for (const { name } of PACKAGES) if (await registry.manifest(name, version)) skip.push(name);
  const previous = sharedLine(latest, version);
  for (const { name } of PACKAGES) {
    if (skip.includes(name)) continue;
    const reference = name === GALLERY ? previous : latest[name];
    const label = name === GALLERY ? `the shared line (${previous ?? 'none'})` : `its \`latest\` ${reference ?? 'none'}`;
    if (name === GALLERY && !previous) problems.push(`${name}: no shared line to compare ${version} with (no other package has a \`latest\` below it)`);
    else if (reference && compareVersions(version, reference) <= 0) problems.push(`${name}@${version} is not above ${label}`);
  }
  return { problems, skip, previous, latest };
}

// ---------------------------------------------------------------------------------------------------------------------
// prepare

function readText(root, file) {
  return readFileSync(path.join(root, file), 'utf8');
}

/**
 * Computes everything `prepare` changes: `{ version, previous, bump, reasons, writes: [{ file, text }], removes: [files], notes }`.
 * Touches nothing and uses no network of its own: `registry` ({ distTags, manifest }) and `stability` (a gallery-stability result,
 * or undefined) are arguments, so a test runs it on a fixture.
 */
export async function planPrepare({ root, input, previous: previousOption, stability, registry, date = new Date().toISOString().slice(0, 10) }) {
  const config = loadConfig(root);
  const manifests = PACKAGES.map((pkg) => ({ pkg, file: `packages/${pkg.dir}/package.json`, text: readText(root, `packages/${pkg.dir}/package.json`) }));
  const current = manifests.map(({ text }) => JSON.parse(text).version);
  const known = [...new Set(current)];
  const latest = registry ? await latestVersions(registry) : {};
  // `patch` and `minor` count from the shared line's last release (the registry, or --previous), not from the manifests: the
  // first shared train has them at 0.26.0 already (MR-23) while the line's last release is 0.25.0.
  const line = previousOption ?? highest(SHARED_LINE.map(({ name }) => latest[name]).filter(Boolean)) ?? (known.length === 1 ? known[0] : undefined);
  if ((input === 'patch' || input === 'minor') && !line) throw new Error(`"${input}" needs the shared line's last release: pass --previous X.Y.Z`);
  const version = resolveVersion(input, line);
  const previous = previousOption ?? sharedLine(latest, version);
  if (!previous) throw new Error("cannot tell the shared line's previous release: the registry has no `latest` for the packages below this version; pass --previous X.Y.Z");
  const problems = [];
  if (compareVersions(version, previous) <= 0) problems.push(`${version} is not above the previous release ${previous}`);
  if (registry) {
    for (const { name } of PACKAGES) if (await registry.manifest(name, version)) problems.push(`${name}@${version} is already on npm: a published version is never reused, fix forward with the next one`);
  }

  const fragments = readFragments(root, config);
  const gate = gateVersion({ previousVersion: previous, version, fragments, stability });
  if (!gate.ok) problems.push(gate.problem);
  if (stability && stability.verdictOk === false) problems.push('check:stability fails: an existing gallery record draws differently or was removed without a declaration');
  if (problems.length) {
    const error = new Error(`prepare ${version} refused:\n  - ${problems.join('\n  - ')}`);
    error.problems = problems;
    throw error;
  }

  const writes = [];
  for (const { pkg, file, text } of manifests) {
    let next = setVersionText(text, version);
    if (pkg.name === CORE) next = setPeerRangesText(next, version);
    writes.push({ file, text: next });
  }
  const peers = existsSync(path.join(root, PEERS_FILE)) ? setPeerHintsText(readText(root, PEERS_FILE), version) : null;
  if (peers !== null) writes.push({ file: PEERS_FILE, text: peers });

  // The result must satisfy check:versions: one version, core's peers and PEER_RANGES equal to it.
  const members = manifests.map(({ pkg }, index) => ({ dir: `packages/${pkg.dir}`, manifest: JSON.parse(writes[index].text) }));
  const left = [...checkVersions(members), ...checkPeerRanges(members, peers)];
  if (left.length) throw new Error(`prepare ${version} would leave check:versions failing:\n  - ${left.join('\n  - ')}`);

  const notes = [];
  for (const { key } of PACKAGES) {
    const target = config.targets[key];
    if (target === undefined) throw new Error(`changes/config.json has no changelog for "${key}"`);
    const picked = selectFragments(fragments, key, config);
    const result = assemble(root, { version, date, summary: picked.length ? '' : NO_CHANGES, package: key }, false);
    writes.push({ file: path.relative(root, result.file), text: result.text });
    notes.push(`${key}: ${picked.length ? `${picked.length} fragment(s)` : 'no fragment (released with the set)'}`);
  }
  const removes = fragments.map((fragment) => path.relative(root, fragment.file));
  return { version, previous, bump: gate.bump, reasons: gate.reasons, tag: tagOf(version), distTag: defaultTag(version), writes, removes, notes };
}

async function prepare(argv, deps) {
  const options = parseOptions(argv, { value: ['previous', 'stability', 'date', 'github-output', 'dir', 'baseline-version', 'baseline-dir', 'candidate-dir'], flag: ['no-stability', 'no-lockfile', 'dry-run', 'offline'] });
  const [input] = options._;
  if (!input) throw new Error('usage: release.mjs prepare <X.Y.Z|patch|minor> [--previous V] [--stability file | --no-stability] [--dry-run]');
  const root = path.resolve(options.dir ?? REPOSITORY_ROOT);
  const registry = deps.registry;
  let stability;
  if (options.stability) stability = stabilityOf(JSON.parse(readFileSync(options.stability, 'utf8')));
  else if (options['no-stability']) deps.log('warning: --no-stability: only the declared drawing changes count, a removed record id or a CATALOG_SCHEMA change is not looked for');
  else stability = stabilityOf(deps.runStability(root, options));
  const plan = await planPrepare({ root, input, previous: options.previous, stability, registry, date: options.date });
  deps.log(`${options['dry-run'] ? 'would prepare' : 'prepare'} ${plan.version} (previous ${plan.previous}, minimum bump ${plan.bump}${plan.reasons.length ? `: ${plan.reasons.join('; ')}` : ''}), dist-tag ${plan.distTag}`);
  for (const note of plan.notes) deps.log(`  changelog ${note}`);
  for (const { file } of plan.writes) deps.log(`  ${options['dry-run'] ? 'would write' : 'write'} ${file}`);
  for (const file of plan.removes) deps.log(`  ${options['dry-run'] ? 'would delete' : 'delete'} ${file}`);
  if (!options['dry-run']) {
    for (const { file, text } of plan.writes) writeFileSync(path.join(root, file), text);
    for (const file of plan.removes) unlinkSync(path.join(root, file));
    if (!options['no-lockfile']) {
      const result = deps.pnpm(['install', '--lockfile-only', '--ignore-scripts'], { cwd: root });
      if (result.status !== 0) throw new Error(`pnpm install --lockfile-only failed:\n${result.stdout}${result.stderr}`);
      deps.log('  lockfile refreshed');
    }
  }
  if (options['github-output']) {
    writeFileSync(options['github-output'], `version=${plan.version}\nprevious=${plan.previous}\ntag=${plan.tag}\ndist-tag=${plan.distTag}\nbump=${plan.bump}\ncommit-message=release ${plan.tag}\n`, { flag: 'a' });
  }
  return plan;
}

/** The gallery-stability result a `--json` file holds ({ baseline, result, verdict, bump }), as `gateVersion` takes it. */
export function stabilityOf(file) {
  if (!file) return undefined;
  const result = file.result ?? file;
  return file.verdict ? { ...result, verdictOk: file.verdict.ok } : result;
}

/** Runs scripts/gallery-stability.mjs and returns its --json file. Exit 1 (an undeclared drawing change) still writes the file. */
export function runStability(root, options = {}, exec = run) {
  const out = path.join(mkdtempSync(path.join(os.tmpdir(), 'release-stability-')), 'stability.json');
  const args = [path.join(REPOSITORY_ROOT, 'scripts/gallery-stability.mjs'), '--dir', root, '--json', out];
  for (const name of ['baseline-version', 'baseline-dir', 'candidate-dir']) if (options[name]) args.push(`--${name}`, options[name]);
  if (options.offline) args.push('--offline');
  const result = exec(process.execPath, args, { cwd: root });
  if (!existsSync(out)) throw new Error(`scripts/gallery-stability.mjs wrote no result (exit ${result.status}):\n${result.stdout}${result.stderr}`);
  try {
    return JSON.parse(readFileSync(out, 'utf8'));
  } finally {
    rmSync(path.dirname(out), { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// pack and publish

const sha512 = (file) => `sha512-${createHash('sha512').update(readFileSync(file)).digest('base64')}`;

async function pack(argv, deps) {
  const options = parseOptions(argv, { value: ['commit', 'out', 'dir'] });
  const [version] = options._;
  if (!isVersion(version ?? '') || !/^[0-9a-f]{40}$/.test(options.commit ?? '') || !options.out) throw new Error('usage: release.mjs pack <X.Y.Z> --commit <40-hex sha> --out <dir>');
  const { packWorkspacePackage, assertLockstep } = await import('./workspace-pack.mjs');
  const out = path.resolve(options.out);
  mkdirSync(out, { recursive: true });
  const packed = PACKAGES.map(({ name }) => packWorkspacePackage(name, out));
  for (const entry of packed) {
    if (entry.version !== version) throw new Error(`${entry.name} packs version ${entry.version}, the release is ${version}: run prepare first`);
    for (const sibling of packed) if (sibling.name !== entry.name && ['dependencies', 'peerDependencies', 'optionalDependencies'].some((field) => entry.manifest[field]?.[sibling.name])) assertLockstep(entry, sibling);
  }
  const files = [];
  for (const entry of packed) {
    stampGitHead(entry.tarball, options.commit);
    files.push({ name: entry.name, version, filename: entry.filename, integrity: sha512(entry.tarball) });
    deps.log(`packed ${entry.name}@${version} (${entry.filename}), gitHead ${options.commit}`);
  }
  writeFileSync(path.join(out, 'release-manifest.json'), `${JSON.stringify({ version, tag: tagOf(version), commit: options.commit, packages: files }, null, 2)}\n`);
  return { version, files };
}

/** The tarballs of release-manifest.json, in publish order, each checked against its recorded digest. */
export function readReleaseManifest(dir, version) {
  const manifest = JSON.parse(readFileSync(path.join(dir, 'release-manifest.json'), 'utf8'));
  if (manifest.version !== version) throw new Error(`${dir}/release-manifest.json is for ${manifest.version}, not ${version}`);
  const names = manifest.packages.map((entry) => entry.name);
  if (names.join() !== NAMES.join()) throw new Error(`${dir}/release-manifest.json lists ${names.join(', ')}; the release publishes ${NAMES.join(', ')} in that order`);
  for (const entry of manifest.packages) {
    const file = path.join(dir, entry.filename);
    if (sha512(file) !== entry.integrity) throw new Error(`${entry.filename} differs from the digest recorded when it was packed: the artifact changed between build and publish`);
  }
  return manifest;
}

/** The `npm publish` arguments for one tarball. Provenance is on for a real publish only (a dry run has no OIDC token). */
export function publishArgs(tarball, tag, { dryRun = false } = {}) {
  return ['publish', tarball, '--access', 'public', ...(dryRun ? ['--dry-run'] : ['--provenance']), '--tag', tag];
}

async function publish(argv, deps) {
  const options = parseOptions(argv, { value: ['dir', 'tag'], flag: ['dry-run'] });
  const [version] = options._;
  if (!isVersion(version ?? '') || !options.dir) throw new Error('usage: release.mjs publish <X.Y.Z> --dir <tarballs> [--tag latest|next] [--dry-run]');
  const tag = options.tag ?? defaultTag(version);
  const manifest = readReleaseManifest(path.resolve(options.dir), version);
  const gate = await checkPublish(deps.registry, version, tag);
  if (gate.problems.length) throw new Error(`publish ${version} refused:\n  - ${gate.problems.join('\n  - ')}`);
  const results = [];
  for (const entry of manifest.packages) {
    if (gate.skip.includes(entry.name)) {
      deps.log(`skip ${entry.name}@${version}: already on npm`);
      results.push({ name: entry.name, status: 'skipped' });
      continue;
    }
    const args = publishArgs(path.resolve(options.dir, entry.filename), tag, { dryRun: options['dry-run'] });
    deps.log(`npm ${args.join(' ')}`);
    const result = deps.npm(args, { cwd: path.resolve(options.dir) });
    if (result.status !== 0) throw new Error(`npm publish of ${entry.name}@${version} failed (exit ${result.status}); the packages before it are on npm, re-run to continue:\n${result.stdout}${result.stderr}`);
    results.push({ name: entry.name, status: options['dry-run'] ? 'dry-run' : 'published' });
  }
  return results;
}

// ---------------------------------------------------------------------------------------------------------------------
// smoke

const SMOKE_SCRIPT = `
import { readFileSync } from 'node:fs';
import { gallery } from '@openpresentation/gallery';
import { toSvg } from '@openpresentation/opf-render';
import * as core from '@openpresentation/opf';
import * as pptx from '@openpresentation/opf-pptx';
const deck = JSON.parse(readFileSync('deck.opf.json', 'utf8'));
const svgs = toSvg(deck, { catalogs: [gallery] });
if (!Array.isArray(svgs) || !svgs.length || !String(svgs[0]).includes('<svg')) throw new Error('the renderer drew no SVG for the quickstart deck');
if (Object.keys(core).length === 0 || Object.keys(pptx).length === 0) throw new Error('an entry point exports nothing');
for (const name of ${JSON.stringify(NAMES)}) import.meta.resolve(name);
console.log('rendered ' + svgs.length + ' slide(s); six entry points resolve');
`;

/**
 * Installs the release in a clean project and exercises it. From tarballs (`dir`: the six installed together, with overrides so
 * their `^<version>` sibling ranges resolve to the tarballs, not to a registry that does not have the version yet) or, with
 * `registry: true`, from the registry at exactly `version` (the post-publish check). `exec` runs a command:
 * (command, args, { cwd }) -> { status, stdout, stderr }.
 */
export function smoke(dir, version, { deck, registry = false, exec = run, scratch = os.tmpdir() } = {}) {
  const manifest = registry ? undefined : readReleaseManifest(path.resolve(dir), version);
  const project = mkdtempSync(path.join(scratch, 'release-smoke-'));
  try {
    const dependencies = registry ? Object.fromEntries(NAMES.map((name) => [name, version])) : Object.fromEntries(manifest.packages.map((entry) => [entry.name, `file:${path.resolve(dir, entry.filename)}`]));
    const overrides = registry ? undefined : Object.fromEntries(NAMES.map((name) => [name, `$${name}`]));
    writeFileSync(path.join(project, 'package.json'), `${JSON.stringify({ name: 'release-smoke', private: true, type: 'module', dependencies, overrides }, null, 2)}\n`);
    writeFileSync(path.join(project, 'deck.opf.json'), readFileSync(deck ?? path.join(REPOSITORY_ROOT, 'docs/quickstart/developer-quickstart.opf.json')));
    writeFileSync(path.join(project, 'smoke.mjs'), SMOKE_SCRIPT);
    const steps = [
      ['npm', ['install', '--no-audit', '--no-fund', '--ignore-scripts']],
      [process.execPath, ['smoke.mjs']],
      [process.execPath, [path.join('node_modules', '@openpresentation', 'cli', 'dist', 'index.js'), '--version']],
    ];
    const log = [];
    for (const [command, args] of steps) {
      const result = exec(command, args, { cwd: project });
      if (result.status !== 0) throw new Error(`smoke: ${path.basename(command)} ${args.join(' ')} failed (exit ${result.status})\n${result.stdout}${result.stderr}`);
      log.push(`${path.basename(command)} ${args.join(' ')}: ${result.stdout.trim().split('\n').at(-1) ?? ''}`);
    }
    return log;
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// verify and notes

/** True when the package's changelog at `root` has a `## <version>` section (any content). */
export function changelogHas(root, config, pkg, version) {
  const file = path.join(root, config.targets[PACKAGES.find((entry) => entry.name === pkg.name).key]);
  return existsSync(file) && extractReleaseNotes(readFileSync(file, 'utf8'), version) !== '';
}

export async function verifyRelease(deps, version, { tag = defaultTag(version), commit, root = REPOSITORY_ROOT, waitMinutes = 0, pollSeconds = 30, audit = true } = {}) {
  const config = loadConfig(root);
  const results = [];
  for (const pkg of PACKAGES) {
    const result = await verifyPackage(deps, pkg, { version, commit, tag: tagOf(version), distTag: tag, siblings: NAMES, changelogHas: (entry, v) => changelogHas(root, config, entry, v) }, { auditSignatures: audit, waitMinutes, pollSeconds });
    deps.log(formatVerify(pkg, version, result));
    results.push({ name: pkg.name, ...result });
  }
  return { ok: results.every((entry) => entry.ok), results };
}

/** The GitHub release body: the package changelog sections grouped by package, then the packages released with no change. */
export function releaseNotes(root, version) {
  const config = loadConfig(root);
  const sections = [];
  const unchanged = [];
  for (const { key, name } of PACKAGES) {
    const file = path.join(root, config.targets[key]);
    const body = existsSync(file) ? extractReleaseNotes(readFileSync(file, 'utf8'), version) : '';
    if (!body) throw new Error(`${config.targets[key]} has no ${version} section: run prepare`);
    if (body.trim() === NO_CHANGES) unchanged.push(name);
    else sections.push(`## ${name}\n\n${body}`);
  }
  if (unchanged.length) sections.push(`Released with the set, no changes: ${unchanged.map((name) => `\`${name}\``).join(', ')}.`);
  return `${sections.join('\n\n')}\n`;
}

// ---------------------------------------------------------------------------------------------------------------------

/** { value: [names taking an argument], flag: [boolean names] } -> { _: [positional], name: value|true }. */
export function parseOptions(argv, { value = [], flag = [] } = {}) {
  const options = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) options._.push(arg);
    else if (flag.includes(arg.slice(2))) options[arg.slice(2)] = true;
    else if (value.includes(arg.slice(2))) {
      if (argv[i + 1] === undefined) throw new Error(`${arg} needs a value`);
      i += 1;
      options[arg.slice(2)] = argv[i];
    } else throw new Error(`unknown option ${arg}`);
  }
  return options;
}

export function defaultDeps(env = process.env) {
  return {
    registry: npmRegistry(),
    npm: (args, options) => run('npm', args, { ...options, env }),
    pnpm: (args, options) => run(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, { ...options, env }),
    runStability,
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log: (line) => process.stdout.write(`${line}\n`),
  };
}

export async function main(argv = process.argv.slice(2), deps = defaultDeps()) {
  const [command, ...rest] = argv;
  if (command === 'prepare') return prepare(rest, deps);
  if (command === 'pack') return pack(rest, deps);
  if (command === 'publish') return publish(rest, deps);
  if (command === 'smoke') {
    const options = parseOptions(rest, { value: ['dir', 'deck'], flag: ['registry'] });
    const [version] = options._;
    if (!isVersion(version ?? '') || !(options.dir || options.registry)) throw new Error('usage: release.mjs smoke <X.Y.Z> (--dir <tarballs> | --registry) [--deck file]');
    const log = smoke(options.dir, version, { deck: options.deck, registry: options.registry });
    for (const line of log) deps.log(line);
    return log;
  }
  if (command === 'check-publish') {
    const options = parseOptions(rest, { value: ['tag'] });
    const [version] = options._;
    if (!isVersion(version ?? '')) throw new Error('usage: release.mjs check-publish <X.Y.Z> [--tag latest|next]');
    const gate = await checkPublish(deps.registry, version, options.tag ?? defaultTag(version));
    if (gate.problems.length) throw new Error(`publish ${version} refused:\n  - ${gate.problems.join('\n  - ')}`);
    deps.log(`ok: ${version} may be published (shared line ${gate.previous}, ${gate.skip.length} of 6 already on npm)`);
    return gate;
  }
  if (command === 'verify') {
    const options = parseOptions(rest, { value: ['tag', 'commit', 'wait', 'poll', 'dir'], flag: ['json', 'no-audit'] });
    const [version] = options._;
    if (!isVersion(version ?? '')) throw new Error('usage: release.mjs verify <X.Y.Z> [--tag latest|next] [--commit sha] [--wait minutes] [--json] [--no-audit]');
    const root = path.resolve(options.dir ?? REPOSITORY_ROOT);
    const commit = options.commit ?? run('git', ['rev-parse', `${tagOf(version)}^{commit}`], { cwd: root }).stdout.trim();
    const result = await verifyRelease(deps, version, { tag: options.tag, commit, root, waitMinutes: Number(options.wait ?? 0), pollSeconds: Number(options.poll ?? 30), audit: !options['no-audit'] });
    if (options.json) deps.log(JSON.stringify(result, null, 2));
    if (!result.ok) throw new Error(`release ${version} is NOT verified (${result.results.filter((entry) => !entry.ok).map((entry) => entry.name).join(', ')})`);
    deps.log(`release ${version} verified: all ${PACKAGES.length} packages`);
    return result;
  }
  if (command === 'notes') {
    const options = parseOptions(rest, { value: ['out', 'dir'] });
    const [version] = options._;
    if (!isVersion(version ?? '')) throw new Error('usage: release.mjs notes <X.Y.Z> [--out file]');
    const body = releaseNotes(path.resolve(options.dir ?? REPOSITORY_ROOT), version);
    if (options.out) writeFileSync(options.out, body);
    else process.stdout.write(body);
    return body;
  }
  if (command === 'order') {
    for (const name of NAMES) deps.log(name);
    return NAMES;
  }
  throw new Error('usage: release.mjs prepare|pack|smoke|check-publish|publish|verify|notes|order (see the header of scripts/release.mjs)');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    () => {},
    (error) => {
      process.stderr.write(`${error.message ?? error}\n`);
      process.exitCode = 1;
    },
  );
}
