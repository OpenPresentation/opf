#!/usr/bin/env node
// RR-20: working evidence stays out of the source tree (AGENTS.md, "Evidence stays out of main"). Against the merge base
// with origin/main (or --base <ref>), a branch may not
//   1. add a file under docs/evidence/ or packages/*/docs/evidence/;
//   2. add an archive, saved deck, image, PDF, log or patch under docs/ or packages/*/docs/ (docs/images/ and
//      docs/brand/, the guides' own pictures, are exempt);
//   3. add anything but Markdown under docs/handoff/;
//   4. grow docs/ and packages/*/docs/ by more than LIMIT_BYTES (new files plus the growth of changed ones).
// Files that already exist in the base tree are allowed as they are, also when they move (a new path whose bytes equal a
// file of a base docs tree): the allowlist is the base tree itself, not a list.
// Committed, uncommitted and untracked changes all count. Without a resolvable base (a shallow checkout) it reports
// that and passes.
//   node scripts/check-evidence-size.mjs [--base <ref>]
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LIMIT_BYTES = 5 * 1024 * 1024;
export const EVIDENCE_TYPES = /\.(zip|gz|tgz|tar|7z|rar|pptx|potx|ppsx|xlsx|docx|key|pdf|png|jpe?g|gif|webp|bmp|tiff?|mp4|mov|webm|log|raw|patch|diff|stderr|stdout|etl|dmp)$/iu;
const IMAGE_DIRECTORIES = ['docs/images/', 'docs/brand/'];

/** The docs tree a path belongs to ("docs/" or "packages/<name>/docs/"), or null. */
export function docsTree(file) {
  if (file.startsWith('docs/')) return 'docs/';
  const match = /^packages\/[^/]+\/docs\//u.exec(file);
  return match ? match[0] : null;
}

/**
 * changes: [{file, before, after, moved}] with byte sizes; before is null for a file the base tree does not have, after
 * is null for a deleted file, and moved is true for a new path whose bytes are a file of a base docs tree. Returns
 * {problems: [string], added: bytes}.
 */
export function evaluate(changes, limit = LIMIT_BYTES) {
  const problems = [];
  let added = 0;
  for (const { file, before, after, moved } of changes) {
    const tree = docsTree(file);
    if (!tree || after === null || moved) continue;
    added += Math.max(0, after - (before ?? 0));
    if (before !== null) continue;
    const inside = file.slice(tree.length);
    if (inside.startsWith('evidence/')) problems.push(`${file}: new file under ${tree}evidence/`);
    else if (EVIDENCE_TYPES.test(file) && !IMAGE_DIRECTORIES.some((prefix) => file.startsWith(prefix))) problems.push(`${file}: archive, deck, image or log under ${tree}`);
    else if (file.startsWith('docs/handoff/') && !/\.md$/iu.test(file)) problems.push(`${file}: only Markdown notes go under docs/handoff/`);
  }
  if (added > limit) problems.push(`docs/ grows by ${(added / 1048576).toFixed(2)} MB, more than the ${(limit / 1048576).toFixed(0)} MB limit`);
  return { problems, added };
}

const git = (args, input) => execFileSync('git', args, { cwd: root, input, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['pipe', 'pipe', 'ignore'] });
const tryGit = (args) => { try { return git(args).trim(); } catch { return null; } };
const split = (text) => text.split('\0').filter(Boolean);

function resolveBase(ref) {
  for (const candidate of ref ? [ref] : ['origin/main', 'main']) {
    const base = tryGit(['merge-base', candidate, 'HEAD']);
    if (base) return base;
  }
  if (ref) throw new Error(`Cannot resolve base ${JSON.stringify(ref)} against HEAD`);
  return null;
}

/**
 * In a blob-less checkout (CI checks out with `filter: blob:none`) `git cat-file` downloads each blob it is asked about in a round
 * trip of its own. One fetch of the base blobs this check reads replaces them. Found 2026-11-13: with the 14,467 evidence files
 * RR-20 deleted, the check downloaded them one by one until the job's 20-minute limit.
 */
function prefetchBaseBlobs(base, files) {
  if (tryGit(['config', '--get', 'remote.origin.promisor']) !== 'true') return;
  const wanted = new Set(files), ids = [];
  for (const line of git(['ls-tree', '-r', base, '--', 'docs', 'packages']).split('\n')) {
    const [meta, file] = line.split('\t');
    if (file && wanted.has(file)) ids.push(meta.split(' ')[2]);
  }
  if (!ids.length) return;
  try {
    const present = execFileSync('git', ['cat-file', '--batch-check=%(objectname) %(objecttype)'], { cwd: root, input: `${ids.join('\n')}\n`, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['pipe', 'pipe', 'ignore'], env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } });
    const missing = present.split('\n').filter((line) => line.endsWith(' missing')).map((line) => line.split(' ')[0]);
    // The fetch git itself runs for a missing object of a promisor remote, with every object in one request.
    if (missing.length) git(['-c', 'fetch.negotiationAlgorithm=noop', 'fetch', 'origin', '--no-tags', '--no-write-fetch-head', '--recurse-submodules=no', '--filter=blob:none', '--stdin'], `${missing.join('\n')}\n`);
  } catch { /* cat-file below still fetches what it needs, one object at a time */ }
}

function baseSizes(base, files) {
  if (!files.length) return new Map();
  prefetchBaseBlobs(base, files);
  const lines = git(['cat-file', '--batch-check=%(objecttype) %(objectsize)'], files.map((file) => `${base}:${file}`).join('\n') + '\n').split('\n');
  return new Map(files.map((file, index) => {
    const [type, size] = (lines[index] ?? '').split(' ');
    return [file, type === 'blob' ? Number(size) : null];
  }));
}

export function collect(base) {
  const changed = [...new Set([
    ...split(git(['diff', '--name-only', '--no-renames', '-z', base])),
    ...split(git(['ls-files', '--others', '--exclude-standard', '-z'])),
  ])].filter(docsTree).sort();
  // Only a file that still exists is measured against the base: a deleted file never counts (evaluate skips it), and asking git
  // for its base size would download its blob in a blob-less checkout.
  const existing = changed.filter((file) => existsSync(path.join(root, file)));
  const before = baseSizes(base, existing);
  const fresh = existing.filter((file) => before.get(file) === null);
  const baseBlobs = new Set();
  if (fresh.length) {
    for (const line of git(['ls-tree', '-r', base, '--', 'docs', 'packages']).split('\n')) {
      const [meta, file] = line.split('\t');
      if (file && docsTree(file)) baseBlobs.add(meta.split(' ')[2]);
    }
  }
  const hashes = fresh.length ? git(['hash-object', '--stdin-paths'], `${fresh.join('\n')}\n`).split('\n') : [];
  const moved = new Set(fresh.filter((_, index) => baseBlobs.has(hashes[index])));
  return changed.map((file) => {
    const absolute = path.join(root, file);
    return { file, before: before.get(file) ?? null, after: existsSync(absolute) ? statSync(absolute).size : null, moved: moved.has(file) };
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flag = process.argv.indexOf('--base');
  const base = resolveBase(flag === -1 ? undefined : process.argv[flag + 1]);
  if (!base) {
    console.log('check-evidence-size: no merge base with origin/main or main in this checkout; nothing to compare');
  } else {
    const { problems, added } = evaluate(collect(base));
    if (problems.length) {
      console.error(`check-evidence-size: ${problems.length} problem(s) since ${base.slice(0, 9)}. Raw evidence goes on an evidence-only branch that is never merged; the pull request links it by commit (AGENTS.md, "Evidence stays out of main").`);
      for (const problem of problems) console.error(`  ${problem}`);
      process.exit(1);
    }
    console.log(`check-evidence-size: docs/ grows by ${(added / 1048576).toFixed(2)} MB since ${base.slice(0, 9)} (limit ${LIMIT_BYTES / 1048576} MB); no evidence files added`);
  }
}
