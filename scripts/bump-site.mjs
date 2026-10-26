#!/usr/bin/env node
// MR-52 (docs/programs/monorepo/README.md, section 6, D17 and D19): bump a site repository to a release of the seven packages.
//
// The three sites (Data-Advantage/openpresentation-site, pptx-gallery, pptx-dev) pin the packages they use: exact versions for most,
// a caret range for the gallery. After a stable release `bump-sites.yml` checks a site out and runs this script, which tells the
// workflow how big the bump is (a patch bump, the same major and minor, is `auto-merge`, anything else `needs-review`, D19), makes the
// bump, and reports whether anything changed.
//
// WHAT a bump touches is the site's own business, because only the site knows which of its files derive from the packages (a release
// history, a pin mirror, preview fonts, a vendored editor bundle, a homepage manifest). Each site therefore owns ONE script,
// `pnpm opf:bump <X.Y.Z> [--opf <checkout of OpenPresentation/opf that has the tag vX.Y.Z>]` (scripts/opf-bump.mjs of the site), that
// does everything the site needs deterministically: its pins, its lockfile, every generated file and the checks of its own CI that read
// them, so that a bump pull request needs no human edit to be green. It takes release facts (publication times, summaries) from the
// registry and from the GitHub release of the tag, and the editor bundle from `scripts/vendor-gallery-editor.mjs` of the checkout.
// A site without that script gets the generic bump below: every declared pin set, the lockfile refreshed, nothing else.
//
//   node scripts/bump-site.mjs bump --site <dir> --version X.Y.Z [--write] [--opf-checkout <opf checkout>] [--refresh-lockfile] [--json] [--github-output <file>] [--body-file <file>]
//   node scripts/bump-site.mjs published <X.Y.Z> [--wait <minutes>]
//
// `bump` without `--write` only prints the plan and never runs anything. With `--write` it runs the site's `opf:bump` (the site's
// dependencies are installed without lifecycle scripts by that script; only trusted, default-branch code of the site runs), or, for a
// site without one, edits the pins and (with `--refresh-lockfile`) refreshes the lockfile with `pnpm install --lockfile-only
// --ignore-scripts` or the npm equivalent. `changed` is what Git sees in the site afterwards. A bump that changes nothing but
// regenerated files (the pins were already at the version) is never merged automatically: nobody reviewed it.
// `published` checks that all seven packages are on the registry at the version (a bounded wait, for registry propagation only).
// Plain Node, no dependencies.
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PUBLISHED, parseWorkspaceYaml } from './workspace-packages.mjs';

export const NAMES = PUBLISHED.map(({ name }) => name);
export const SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies'];
/** JSON files a site keeps beside its manifest that mirror the pins (pptx-dev's opf-reference-layer-pins.json). */
export const MIRRORS = [{ file: 'opf-reference-layer-pins.json', key: 'packages' }];
export const LABELS = { patch: 'auto-merge', minor: 'needs-review', major: 'needs-review' };
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const SPECIFIER = /^([\^~]?)(\d+\.\d+\.\d+)$/;

export const isVersion = (value) => VERSION.test(value ?? '');
const parts = (version) => version.split('.').map(Number);

/**
 * How big moving a pin from `from` to `to` is, in the vocabulary of the plan: `none` (equal), `patch` (the same major and minor,
 * a higher patch), `minor` (a different minor of the same major: a breaking change in 0.x) or `major` (a different major, and
 * any move to a lower version, which is how the gallery's 5.0.0 joins the shared 0.26 line).
 */
export function bumpKind(from, to) {
  const [fromMajor, fromMinor, fromPatch] = parts(from);
  const [toMajor, toMinor, toPatch] = parts(to);
  if (fromMajor === toMajor && fromMinor === toMinor && fromPatch === toPatch) return 'none';
  if (toMajor < fromMajor) return 'major';
  if (toMajor > fromMajor) return 'major';
  if (toMinor !== fromMinor) return toMinor < fromMinor ? 'major' : 'minor';
  return toPatch > fromPatch ? 'patch' : 'major';
}

const RANK = { none: 0, patch: 1, minor: 2, major: 3 };
export const largest = (kinds) => kinds.reduce((best, kind) => (RANK[kind] > RANK[best] ? kind : best), 'none');

/** The specifier for `version` in the style of `specifier`, or null when the style is not one this script rewrites. */
export function specifierFor(specifier, version) {
  const match = SPECIFIER.exec(specifier);
  return match ? `${match[1]}${version}` : null;
}

/** The manifests of a site: the root one and every member the pnpm-workspace.yaml `packages` list names (no globs). */
export function manifestsOf(siteDir) {
  const files = ['package.json'];
  const workspace = path.join(siteDir, 'pnpm-workspace.yaml');
  if (existsSync(workspace)) {
    for (const member of parseWorkspaceYaml(readFileSync(workspace, 'utf8')).packages) {
      const dir = String(member).replace(/^\.\//, '');
      if (!dir || dir === '.' || /[*?!]/.test(dir)) continue;
      const file = path.posix.join(dir.replace(/\/$/, ''), 'package.json');
      if (existsSync(path.join(siteDir, file))) files.push(file);
    }
  }
  return files;
}

/**
 * The plan for a site, without writing: { changes: [{ file, section, name, from, to }], unsupported: [...], kind, files }.
 * `kind` is the largest bump over all the changes (and `none` when nothing changes).
 */
export function planBump(siteDir, version) {
  if (!isVersion(version)) throw new Error(`'${version}' is not X.Y.Z (a bump follows a stable release)`);
  const changes = [];
  const unsupported = [];
  for (const file of manifestsOf(siteDir)) {
    const manifest = JSON.parse(readFileSync(path.join(siteDir, file), 'utf8'));
    for (const section of SECTIONS) {
      for (const name of NAMES) {
        const specifier = manifest[section]?.[name];
        if (specifier === undefined) continue;
        const next = specifierFor(specifier, version);
        if (next === null) {
          unsupported.push({ file, section, name, specifier });
          continue;
        }
        if (next === specifier) continue;
        changes.push({ file, section, name, from: specifier, to: next, kind: bumpKind(SPECIFIER.exec(specifier)[2], version) });
      }
    }
  }
  for (const { file, key } of MIRRORS) {
    const mirror = existsSync(path.join(siteDir, file)) ? JSON.parse(readFileSync(path.join(siteDir, file), 'utf8')) : null;
    for (const name of NAMES) {
      const specifier = mirror?.[key]?.[name];
      if (typeof specifier !== 'string' || specifier === version) continue;
      const next = specifierFor(specifier, version);
      if (next === null) unsupported.push({ file, section: key, name, specifier });
      else if (next !== specifier) changes.push({ file, section: key, name, from: specifier, to: next, kind: bumpKind(SPECIFIER.exec(specifier)[2], version) });
    }
  }
  const files = [...new Set(changes.map((change) => change.file))];
  return { version, changes, unsupported, files, kind: largest(changes.map((change) => change.kind)) };
}

/** Rewrites the specifiers in place with the smallest text edit, so a manifest's formatting and key order survive. */
export function writeBump(siteDir, plan) {
  for (const file of plan.files) {
    const target = path.join(siteDir, file);
    let text = readFileSync(target, 'utf8');
    for (const change of plan.changes.filter((entry) => entry.file === file)) {
      const pattern = new RegExp(`("${change.name.replace(/[/.-]/g, '\\$&')}"\\s*:\\s*")${change.from.replace(/[.^~]/g, '\\$&')}(")`, 'g');
      const next = text.replace(pattern, `$1${change.to}$2`);
      if (next === text) throw new Error(`${file}: could not rewrite ${change.name} ${change.from}`);
      text = next;
    }
    writeFileSync(target, text);
  }
}

/** The package manager of a site from its lockfile, and the command that refreshes that lockfile without installing. */
export function lockfileCommand(siteDir) {
  if (existsSync(path.join(siteDir, 'pnpm-lock.yaml'))) return ['pnpm', ['install', '--lockfile-only', '--ignore-scripts']];
  if (existsSync(path.join(siteDir, 'package-lock.json'))) return ['npm', ['install', '--package-lock-only', '--ignore-scripts']];
  throw new Error(`${siteDir}: no pnpm-lock.yaml or package-lock.json; this script refreshes only those lockfiles`);
}

export function refreshLockfile(siteDir, exec = (command, args, options) => spawnSync(command, args, { ...options, stdio: 'inherit', shell: process.platform === 'win32' })) {
  const [command, args] = lockfileCommand(siteDir);
  const result = exec(command, args, { cwd: siteDir });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed in ${siteDir} (${result.status})`);
}

/** The script a site owns for a bump (package.json `scripts.opf:bump`), or null for a site that has none. */
export const SITE_SCRIPT = 'opf:bump';
export function siteScript(siteDir) {
  const manifest = path.join(siteDir, 'package.json');
  if (!existsSync(manifest)) return null;
  return JSON.parse(readFileSync(manifest, 'utf8')).scripts?.[SITE_SCRIPT] ?? null;
}

/** The command that runs the site's script: `pnpm run opf:bump <version> [--opf <checkout>]`, as [command, args]. */
export function siteScriptCommand({ version, checkout }) {
  if (!isVersion(version)) throw new Error(`'${version}' is not X.Y.Z (a bump follows a stable release)`);
  return ['pnpm', ['run', SITE_SCRIPT, version, ...(checkout ? ['--opf', path.resolve(checkout)] : [])]];
}

export function runSiteScript({ site, version, checkout }, exec = (command, args, options) => spawnSync(command, args, { ...options, stdio: 'inherit', shell: process.platform === 'win32' && command === 'pnpm' })) {
  const [command, args] = siteScriptCommand({ version, checkout });
  const result = exec(command, args, { cwd: site, env: { ...process.env, ...(checkout ? { OPF_CHECKOUT: path.resolve(checkout) } : {}) } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed in ${site} (${result.status})`);
}

/** How many paths differ from HEAD in the site's Git work tree (untracked files included, ignored ones not). */
export function changedPaths(site, exec = (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8' })) {
  const result = exec('git', ['status', '--porcelain'], { cwd: site });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git status failed in ${site}: ${String(result.stderr ?? '').trim()}`);
  return String(result.stdout ?? '').split('\n').filter(Boolean).length;
}

/** The pull request body: what moved, what happens next, and where the notes are. */
export function pullRequestBody(plan, { repository = 'OpenPresentation/opf', generated = false, files = 0 } = {}) {
  const label = LABELS[plan.kind] ?? 'needs-review';
  const rows = plan.changes.map((change) => `| \`${change.name}\` | \`${change.from}\` | \`${change.to}\` | \`${change.file}\` |`);
  return [
    `Bumps the \`@openpresentation/*\` pins of this site to **v${plan.version}** (opened by \`bump-sites.yml\` after the release was verified).`,
    '',
    `Release notes: https://github.com/${repository}/releases/tag/v${plan.version}`,
    '',
    '| Package | From | To | File |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    ...(generated ? [`Everything this site derives from the release was regenerated by its own \`pnpm opf:bump ${plan.version}\` (${files} changed paths: pins, lockfile, generated data, previews, vendored files and the checks that read them). Run the same command on the default branch to reproduce this pull request.`, ''] : []),
    plan.kind === 'none'
      ? `The pins were already at this version; only generated files changed (label \`${label}\`): review it, then merge it by hand.`
      : plan.kind === 'patch'
      ? `This is a **patch** bump (label \`${label}\`): this site's \`opf-bump-merge.yml\` merges it once its \`build-and-smoke\` check has passed.`
      : `This is a **${plan.kind}** bump (label \`${label}\`): a minor or major bump of the shared 0.x line can break a site, so it is not merged automatically. Review it, then merge it by hand.`,
    '',
    'The lockfile was refreshed with the site\'s own package manager from the registry. Nothing was deployed.',
  ].join('\n');
}

/** Are all seven packages on the registry at `version`? Returns the packages still missing. */
export function missingFromRegistry(version, exec) {
  const missing = [];
  for (const name of NAMES) {
    const result = exec('npm', ['view', `${name}@${version}`, 'version', '--json']);
    let found = null;
    try {
      found = result.status === 0 ? JSON.parse(result.stdout || 'null') : null;
    } catch {
      found = null;
    }
    if (found !== version) missing.push(name);
  }
  return missing;
}

function parseArgs(argv, valueFlags, booleanFlags) {
  const options = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) options._.push(arg);
    else if (booleanFlags.includes(arg.slice(2))) options[arg.slice(2)] = true;
    else if (valueFlags.includes(arg.slice(2))) {
      index += 1;
      if (argv[index] === undefined) throw new Error(`${arg} needs a value`);
      options[arg.slice(2)] = argv[index];
    } else throw new Error(`unknown option ${arg}`);
  }
  return options;
}

const npmExec = (command, args) => spawnSync(command, args, { encoding: 'utf8', shell: process.platform === 'win32' });

export async function main(argv = process.argv.slice(2), { log = (line) => process.stdout.write(`${line}\n`), exec = npmExec, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), siteExec, gitStatus } = {}) {
  const [command, ...rest] = argv;
  if (command === 'published') {
    const options = parseArgs(rest, ['wait'], []);
    const [version] = options._;
    if (!isVersion(version ?? '')) throw new Error('usage: bump-site.mjs published <X.Y.Z> [--wait minutes]');
    const deadline = Date.now() + Number(options.wait ?? 0) * 60_000;
    for (;;) {
      const missing = missingFromRegistry(version, exec);
      if (missing.length === 0) {
        log(`all ${NAMES.length} packages are published at ${version}`);
        return { ok: true };
      }
      if (Date.now() >= deadline) throw new Error(`not on the registry at ${version}: ${missing.join(', ')}`);
      await sleep(15_000);
    }
  }
  if (command === 'bump') {
    const options = parseArgs(rest, ['site', 'version', 'github-output', 'body-file', 'opf-checkout'], ['write', 'refresh-lockfile', 'json']);
    if (!options.site || !options.version) throw new Error('usage: bump-site.mjs bump --site <dir> --version X.Y.Z [--write] [--opf-checkout dir] [--refresh-lockfile] [--json] [--github-output file] [--body-file file]');
    const siteDir = path.resolve(options.site);
    const plan = planBump(siteDir, options.version);
    const ownScript = siteScript(siteDir) !== null;
    if (!ownScript && plan.unsupported.length > 0) {
      throw new Error(`cannot rewrite ${plan.unsupported.map((entry) => `${entry.file} ${entry.name} "${entry.specifier}"`).join(', ')}: only exact versions and ^ or ~ ranges are bumped`);
    }
    let changedFiles = plan.changes.length;
    if (options.write) {
      if (ownScript) {
        runSiteScript({ site: siteDir, version: options.version, checkout: options['opf-checkout'] }, siteExec);
        changedFiles = changedPaths(siteDir, gitStatus);
      } else if (plan.changes.length > 0) {
        writeBump(siteDir, plan);
        if (options['refresh-lockfile']) refreshLockfile(siteDir);
      }
    }
    // Pins already at the version but regenerated files differ (a re-run after a fix): nobody reviewed it, so it is not merged automatically.
    const changed = changedFiles > 0;
    const label = LABELS[plan.kind] ?? (changed ? 'needs-review' : '');
    if (options.json) log(JSON.stringify({ ...plan, label, changed, ownScript, changedFiles }, null, 2));
    else if (!changed) log(`${siteDir} is already at ${options.version}`);
    else {
      for (const change of plan.changes) log(`${change.file}: ${change.name} ${change.from} -> ${change.to} (${change.kind})`);
      if (ownScript && options.write) log(`${SITE_SCRIPT} ${options.version}: ${changedFiles} changed paths`);
    }
    if (options['github-output']) {
      appendFileSync(options['github-output'], `changed=${changed}\nkind=${plan.kind}\nlabel=${label}\n`);
    }
    if (options['body-file']) writeFileSync(options['body-file'], pullRequestBody(plan, { generated: ownScript, files: changedFiles }));
    return { ...plan, label, changed, ownScript, changedFiles };
  }
  throw new Error('usage: bump-site.mjs bump|published (see the header of scripts/bump-site.mjs)');
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
