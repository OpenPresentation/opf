#!/usr/bin/env node
// MR-21 (monorepo plan, section 3): the history import of the four old repositories, as a deterministic, scratch-only
// rehearsal. For each old repository it makes a pristine clone, a fresh working clone and runs `git filter-repo` on the
// working clone once, in one pass:
//   1. every path moves to packages/<name>/ (so history, tags and `git blame` use the new paths);
//   2. every bare "#N" in a commit message becomes "OpenPresentation/<old-repo>#N" (N is a number without a leading zero, not
//      after a word character, "/" or "#", so "opf#298", "owner/repo#N", URLs and spreadsheet formats like "$#,##0" stay); with the contextual pass (default) "core #N" and "opf #N" become
//      OpenPresentation/opf#N and "opf-render #N" and so on OpenPresentation/opf-render#N first;
//   3. a closing keyword directly before the reference gets the word "issue" inserted ("Fixes #186" becomes "Fixes issue
//      OpenPresentation/opf-render#186"), which GitHub does not read as a closing keyword, so an imported commit on the
//      default branch can close nothing anywhere;
//   4. tags keep their names, except that a package may carry a tag prefix (gallery: v1.0.0 becomes gallery-v1.0.0, so an
//      old tag cannot be mistaken for, or trigger, a new vX.Y.Z release tag).
// filter-repo also rewrites old commit hashes inside messages to the new ones (its default; the commit map keeps both).
// With --merge it then merges the rewritten histories into a scratch clone of core on branch monorepo/import with
// `git merge --allow-unrelated-histories --no-ff`, one merge per package (the MR-22 shape; core is not rewritten).
//
// Nothing here talks to a remote beyond reading: it clones (HTTPS or a local path) and never pushes. The merged clone's
// push URL is set to an invalid one so a stray `git push` fails. Run it only in a scratch directory; it refuses a scratch
// directory inside a git working tree. The real push (MR-22) is the owner's, under a ruleset bypass.
//
//   node scripts/monorepo-import.mjs <scratch-dir> [options]
//     --spec <name>:<repo>[:<tag-prefix>]  a package to import (repeatable; default: render:opf-render, pptx:opf-pptx,
//                                          editor:opf-editor, gallery:gallery:gallery-)
//     --base <url|dir>    where the old repositories live: <base>/<repo>.git (default https://github.com/OpenPresentation;
//                         a directory may also hold <repo> without .git)
//     --source <repo>=<url|dir>  one repository from somewhere else (repeatable)
//     --no-context-refs   skip the contextual "core #N" / "opf-render #N" pass
//     --refresh           re-clone the pristine copies even when they exist (default: reuse them, so a re-run is offline)
//     --merge             also merge the rewritten histories into <scratch>/merged (a clone of core)
//     --core <url|dir>    core to clone for --merge (default https://github.com/OpenPresentation/opf.git)
//     --core-ref <ref>    its branch (default main)
//     --identity "Name <email>"  author and committer of the import merge commits (default: git config, else a fixed one)
//     --date <iso>        author and committer date of the merge commits (default: now; give both for identical SHAs)
//   Layout under <scratch-dir>: orig/<repo> (pristine, never rewritten), work/<repo> (rewritten), commit-map/<repo>.txt
//   (old SHA to new SHA), merged/ (with --merge), import-manifest.json (what scripts/verify-import.mjs reads).
// Needs git >= 2.30 and git-filter-repo (`python3 -m venv v && v/bin/pip install git-filter-repo`, then put v/bin on PATH, or
// set OPF_GIT_FILTER_REPO to the git-filter-repo executable).
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULT_BASE = 'https://github.com/OpenPresentation';
export const DEFAULT_CORE = 'https://github.com/OpenPresentation/opf.git';
export const DEFAULT_SPECS = [
  { name: 'render', repo: 'opf-render', tagPrefix: '' },
  { name: 'pptx', repo: 'opf-pptx', tagPrefix: '' },
  { name: 'editor', repo: 'opf-editor', tagPrefix: '' },
  { name: 'gallery', repo: 'gallery', tagPrefix: 'gallery-' },
];
const SPEC_NAME = /^[a-z][a-z0-9-]*$/;
const REPO_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const TAG_PREFIX = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const FALLBACK_IDENTITY = 'OPF monorepo import <noreply@openpresentation.org>';

/** Parse "name:repo[:tag-prefix]" into a spec. */
export function parseSpec(text) {
  const [name, repo, tagPrefix = '', ...extra] = String(text).split(':');
  if (extra.length || !name || !repo) throw new Error(`--spec wants <name>:<repo>[:<tag-prefix>], not ${text}`);
  if (!SPEC_NAME.test(name)) throw new Error(`--spec name ${name} must be lowercase letters, digits and dashes`);
  if (!REPO_NAME.test(repo)) throw new Error(`--spec repository ${repo} is not a valid repository name`);
  if (tagPrefix !== '' && !TAG_PREFIX.test(tagPrefix)) throw new Error(`--spec tag prefix ${tagPrefix} is not valid`);
  return { name, repo, tagPrefix };
}

export function parseArgs(argv) {
  const options = { specs: [], sources: {}, contextRefs: true, refresh: false, merge: false, core: DEFAULT_CORE, coreRef: 'main', base: DEFAULT_BASE };
  const positional = [];
  const value = (index, flag) => {
    if (index + 1 >= argv.length || argv[index + 1].startsWith('--')) throw new Error(`${flag} needs a value`);
    return argv[index + 1];
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--spec') options.specs.push(parseSpec(value(index++, arg)));
    else if (arg === '--base') options.base = value(index++, arg);
    else if (arg === '--source') {
      const [repo, ...rest] = value(index++, arg).split('=');
      if (!repo || rest.join('=') === '') throw new Error('--source wants <repo>=<url|dir>');
      options.sources[repo] = rest.join('=');
    } else if (arg === '--no-context-refs') options.contextRefs = false;
    else if (arg === '--refresh') options.refresh = true;
    else if (arg === '--merge') options.merge = true;
    else if (arg === '--core') options.core = value(index++, arg);
    else if (arg === '--core-ref') options.coreRef = value(index++, arg);
    else if (arg === '--identity') options.identity = value(index++, arg);
    else if (arg === '--date') options.date = value(index++, arg);
    else if (arg.startsWith('--')) throw new Error(`Unknown option ${arg}`);
    else positional.push(arg);
  }
  if (positional.length !== 1) throw new Error('usage: monorepo-import.mjs <scratch-dir> [options]');
  options.scratch = path.resolve(positional[0]);
  if (options.specs.length === 0) options.specs = DEFAULT_SPECS.map((spec) => ({ ...spec }));
  const names = options.specs.map((spec) => spec.name);
  const repos = options.specs.map((spec) => spec.repo);
  if (new Set(names).size !== names.length) throw new Error('--spec names must be unique');
  if (new Set(repos).size !== repos.length) throw new Error('--spec repositories must be unique');
  return options;
}

/**
 * The Python source of filter-repo's --message-callback for one old repository. `message` is bytes; the body returns the new
 * message. Exported (and tested with plain python3) so the tests exercise exactly what the import runs.
 */
export function messageCallbackSource({ repo, contextRefs = true }) {
  if (!REPO_NAME.test(repo)) throw new Error(`Invalid repository name ${repo}`);
  return `old = b'${repo}'
context = ${contextRefs ? 'True' : 'False'}
text = message
if context:
    text = re.sub(rb'(?i)\\b(core|opf)((?:\\s+(?:PR|pull request|issue))?\\s+)#(\\d+)\\b', lambda m: m.group(1) + m.group(2) + b'OpenPresentation/opf#' + m.group(3), text)
    text = re.sub(rb'(?i)\\b(opf-(?:render|pptx|editor))((?:\\s+(?:PR|pull request|issue))?\\s+)#(\\d+)\\b', lambda m: m.group(1) + m.group(2) + b'OpenPresentation/' + m.group(1).lower() + b'#' + m.group(3), text)
text = re.sub(rb'(?<![\\w/#])#([1-9]\\d*)\\b', b'OpenPresentation/' + old + rb'#\\1', text)
text = re.sub(rb'(?i)\\b(close[sd]?|fix(?:e[sd])?|resolve[sd]?)(:?\\s+)(OpenPresentation/[\\w.-]+#\\d+)', rb'\\1\\2issue \\3', text)
return text
`;
}

/** Where a repository is cloned from: an explicit --source, else <base>/<repo>.git (a directory base may omit .git). */
export function sourceFor(options, repo) {
  if (options.sources[repo]) return options.sources[repo];
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(options.base) || /^[^/\\]+@[^:]+:/.test(options.base)) {
    return `${options.base.replace(/\/+$/, '')}/${repo}.git`;
  }
  const withGit = path.join(options.base, `${repo}.git`);
  return existsSync(withGit) ? withGit : path.join(options.base, repo);
}

function run(file, args, { cwd, env, allowFail = false } = {}) {
  const result = spawnSync(file, args, { cwd, env: env ? { ...process.env, ...env } : process.env, encoding: 'utf8', maxBuffer: 1 << 30 });
  if (result.error) throw new Error(`${file} ${args.join(' ')}: ${result.error.message}`);
  if (result.status !== 0 && !allowFail) {
    throw new Error(`${file} ${args.slice(0, 4).join(' ')} failed (${result.status}) in ${cwd ?? '.'}\n${(result.stderr || result.stdout || '').trim()}`);
  }
  return result;
}
const git = (cwd, args, options) => run('git', args, { cwd, ...options }).stdout;

/** The filter-repo command (OPF_GIT_FILTER_REPO overrides `git filter-repo`); throws with install instructions when missing. */
export function filterRepoCommand(env = process.env) {
  const [file, prefix] = env.OPF_GIT_FILTER_REPO ? [env.OPF_GIT_FILTER_REPO, []] : ['git', ['filter-repo']];
  const probe = spawnSync(file, [...prefix, '--version'], { encoding: 'utf8', env });
  if (probe.error || probe.status !== 0) {
    throw new Error('git-filter-repo is not available. Install it in a scratch virtual environment ("python3 -m venv v && v/bin/pip install git-filter-repo") and put v/bin on PATH, or set OPF_GIT_FILTER_REPO to the git-filter-repo executable.');
  }
  return { file, prefix, version: probe.stdout.trim() };
}

export function filterRepoAvailable(env = process.env) {
  try {
    filterRepoCommand(env);
    return true;
  } catch {
    return false;
  }
}

function insideGitWorkTree(dir) {
  let current = dir;
  while (!existsSync(current)) current = path.dirname(current);
  const probe = spawnSync('git', ['-C', current, 'rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' });
  return probe.status === 0 && probe.stdout.trim() === 'true';
}

function identityEnv(options) {
  const configured = (key) => spawnSync('git', ['config', '--get', key], { encoding: 'utf8' }).stdout.trim();
  const text = options.identity ?? (configured('user.name') && configured('user.email') ? `${configured('user.name')} <${configured('user.email')}>` : FALLBACK_IDENTITY);
  const match = /^(.+?)\s*<([^<>]+)>$/.exec(text);
  if (!match) throw new Error(`--identity wants "Name <email>", not ${text}`);
  const env = { GIT_AUTHOR_NAME: match[1], GIT_AUTHOR_EMAIL: match[2], GIT_COMMITTER_NAME: match[1], GIT_COMMITTER_EMAIL: match[2] };
  if (options.date) Object.assign(env, { GIT_AUTHOR_DATE: options.date, GIT_COMMITTER_DATE: options.date });
  return env;
}

/** Clone, rewrite and record one package. Returns its manifest entry. `into` overrides the work directory (the verifier's determinism rerun). */
export function importPackage(options, spec, filter, log = () => {}, { workDir, commitMapFile } = {}) {
  const { scratch } = options;
  const source = sourceFor(options, spec.repo);
  const orig = path.join(scratch, 'orig', spec.repo);
  const work = workDir ?? path.join(scratch, 'work', spec.repo);
  if (options.refresh) rmSync(orig, { recursive: true, force: true });
  if (!existsSync(path.join(orig, '.git'))) {
    git(undefined, ['clone', '-q', '--no-local', '--single-branch', '--branch', 'main', source, orig]);
  }
  rmSync(work, { recursive: true, force: true });
  git(undefined, ['clone', '-q', '--no-local', orig, work]); // a fresh clone: filter-repo refuses a used one
  const started = Date.now();
  const args = [...filter.prefix, '--force', '--quiet', '--to-subdirectory-filter', `packages/${spec.name}`];
  if (spec.tagPrefix) args.push('--tag-rename', `:${spec.tagPrefix}`);
  args.push('--message-callback', messageCallbackSource({ repo: spec.repo, contextRefs: options.contextRefs }));
  run(filter.file, args, { cwd: work });
  const seconds = (Date.now() - started) / 1000;
  const mapFile = commitMapFile ?? path.join(scratch, 'commit-map', `${spec.repo}.txt`);
  mkdirSync(path.dirname(mapFile), { recursive: true });
  copyFileSync(path.join(work, '.git/filter-repo/commit-map'), mapFile);
  const entry = {
    name: spec.name,
    repo: spec.repo,
    dir: `packages/${spec.name}`,
    tagPrefix: spec.tagPrefix,
    source,
    origHead: git(orig, ['rev-parse', 'HEAD']).trim(),
    workHead: git(work, ['rev-parse', 'HEAD']).trim(),
    commits: Number(git(work, ['rev-list', '--count', 'HEAD']).trim()),
    tags: git(work, ['tag', '--list']).split('\n').filter(Boolean).length,
    filterSeconds: seconds,
  };
  log(`${spec.repo}: ${entry.origHead.slice(0, 8)} -> ${entry.workHead.slice(0, 8)}, ${entry.commits} commits, ${entry.tags} tags, rewritten in ${seconds.toFixed(1)}s`);
  return entry;
}

/** Merge each rewritten history into a scratch clone of core (the MR-22 shape). Idempotent: a re-run fetches and merges only what is new. */
export function mergeIntoCore(options, entries, log = () => {}) {
  const { scratch } = options;
  const merged = path.join(scratch, 'merged');
  const identity = identityEnv(options);
  if (!existsSync(path.join(merged, '.git'))) {
    git(undefined, ['clone', '-q', '--no-local', '--single-branch', '--branch', options.coreRef, options.core, merged]);
    git(merged, ['checkout', '-q', '-b', 'monorepo/import']);
    // A rehearsal clone must never push: any push fails on this URL.
    git(merged, ['remote', 'set-url', '--push', 'origin', 'no-push://monorepo-import-rehearsal']);
  }
  const coreBase = git(merged, ['rev-parse', `origin/${options.coreRef}`]).trim();
  const merges = [];
  for (const entry of entries) {
    const remote = `import-${entry.name}`;
    const exists = git(merged, ['remote']).split('\n').includes(remote);
    git(merged, ['remote', exists ? 'set-url' : 'add', remote, path.join(scratch, 'work', entry.repo)]);
    git(merged, ['fetch', '-q', remote, 'main', '--tags']);
    const upToDate = run('git', ['merge-base', '--is-ancestor', `${remote}/main`, 'HEAD'], { cwd: merged, allowFail: true }).status === 0;
    if (!upToDate) {
      git(merged, ['-c', 'commit.gpgsign=false', 'merge', '-q', '--allow-unrelated-histories', '--no-ff', `${remote}/main`, '-m', `MR-22: import ${entry.repo} history under ${entry.dir}`], { env: identity });
    }
    merges.push({ name: entry.name, importMerge: upToDate ? null : git(merged, ['rev-parse', 'HEAD']).trim() });
  }
  const info = {
    source: options.core,
    ref: options.coreRef,
    base: coreBase,
    head: git(merged, ['rev-parse', 'HEAD']).trim(),
    commits: Number(git(merged, ['rev-list', '--count', 'HEAD']).trim()),
    tags: git(merged, ['tag', '--list']).split('\n').filter(Boolean).length,
    merges,
  };
  log(`merged into core ${coreBase.slice(0, 8)}: ${info.commits} commits, ${info.tags} tags, head ${info.head.slice(0, 8)}`);
  return info;
}

export function runImport(options, log = () => {}) {
  if (insideGitWorkTree(options.scratch)) {
    throw new Error(`${options.scratch} is inside a git working tree; use a scratch directory outside every checkout`);
  }
  const filter = filterRepoCommand();
  mkdirSync(path.join(options.scratch, 'orig'), { recursive: true });
  mkdirSync(path.join(options.scratch, 'work'), { recursive: true });
  const started = Date.now();
  const packages = options.specs.map((spec) => importPackage(options, spec, filter, log));
  const manifest = {
    schema: 1,
    git: git(undefined, ['--version']).trim(),
    filterRepo: filter.version,
    contextRefs: options.contextRefs,
    packages,
    core: options.merge ? mergeIntoCore(options, packages, log) : null,
    seconds: (Date.now() - started) / 1000,
  };
  writeFileSync(path.join(options.scratch, 'import-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (existsSync(options.scratch) && !statSync(options.scratch).isDirectory()) throw new Error(`${options.scratch} is not a directory`);
    const manifest = runImport(options, (line) => console.log(line));
    console.log(`import finished in ${manifest.seconds.toFixed(1)}s; manifest ${path.join(options.scratch, 'import-manifest.json')}`);
  } catch (error) {
    console.error(error.message);
    process.exit(error.message.startsWith('usage:') || error.message.startsWith('Unknown option') ? 64 : 1);
  }
}
