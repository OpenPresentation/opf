#!/usr/bin/env node
// MR-21 (monorepo plan, section 3): proves a rewrite made by scripts/monorepo-import.mjs. The old repositories' histories
// must arrive intact under packages/<name>/, so the verifier compares each pristine clone (<scratch>/orig/<repo>) with its
// rewrite (<scratch>/work/<repo>) through the commit map and checks, per package:
//   - tree hashes: the subtree packages/<name> of the new commit equals the old root tree at main, at every tag and at every
//     commit (so file contents, modes and names are exactly the old ones, and nothing was dropped or added);
//   - commits: equal counts; the commit map is complete and one to one; author, committer, both dates and the parent shape of
//     every commit are preserved;
//   - tags: the old names with the package's tag prefix (gallery: gallery-v1.0.0), equal object types, annotated-tag bodies
//     and taggers; every tag of the source repository was cloned (a tag outside main's history would be dropped silently);
//   - messages: no bare "#N" left; the only differences from the old messages are the "#N" qualification, rewritten commit
//     hashes and the "issue" word inserted after a closing keyword; no closing keyword directly before a reference; with the
//     contextual pass, "core #N" / "opf-render #N" point at the right repository;
//   - nothing outside packages/<name>/ in any commit of any ref; the blob set is identical (nothing changed or dropped);
//   - blame: `git blame` of a sample of files (the most-changed and a pseudo-random set; --blame all checks every file) is the
//     same line by line (commit through the commit map, author mail, content), and `git log -- <path>` finds the same number
//     of commits without --follow;
//   - optionally (--determinism) a second rewrite into a scratch directory gives byte-identical commit maps and tips.
// When the manifest records a merged clone (import --merge) it also checks the merge: core's main is an ancestor, core's own
// tags are unchanged, every imported tag is present and nothing collides, the imported subtrees in HEAD equal the rewrites,
// nothing outside the imported directories changed, the counts add up and each merge's second parent is the rewrite's tip.
//
//   node scripts/verify-import.mjs <scratch-dir> [options]
//     --package <name>     verify only this package (repeatable; default: every package in the manifest)
//     --blame <n|all>      files per sample (n most-changed plus n pseudo-random; default 25) or every file
//     --determinism        also rewrite again into <scratch>/determinism and compare
//     --offline            skip the checks that read the source repositories (current main, tag completeness)
//     --commit-maps <dir>  also require <dir>/<repo>.txt to equal the generated commit maps (the committed copies)
//     --report <file>      write the results as Markdown (the import-verification.md shape)
// Read-only apart from --determinism and --report. Exit 1 on any failed check, 64 on bad arguments.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { filterRepoCommand, importPackage } from './monorepo-import.mjs';

const BARE_REFERENCE = /(?<![\w/#])#[1-9]\d*\b/;
const CLOSING_KEYWORD = /\b(close[sd]?|fix(?:e[sd])?|resolve[sd]?):?\s+(?:OpenPresentation\/[\w.-]+)?#\d+/i;
const TEXT_FILE = /\.(m?js|cjs|json|md|css|html|ya?ml|ts|tsx|txt|mjs)$/;
const MAX_BLAME_BYTES = 1 << 20;

function git(dir, args, { input, allowFail = false } = {}) {
  const result = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8', maxBuffer: 1 << 30, input });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFail) throw new Error(`git ${args.slice(0, 3).join(' ')} failed in ${dir}: ${(result.stderr || '').trim()}`);
  return allowFail ? result : result.stdout;
}

/** Object ids for many revision expressions in one process: id, or null when the expression does not resolve. */
export function resolveAll(dir, expressions) {
  if (expressions.length === 0) return [];
  const out = git(dir, ['cat-file', '--batch-check=%(objectname)'], { input: `${expressions.join('\n')}\n`, allowFail: true });
  const lines = (out.stdout ?? '').split('\n');
  // --batch-check prints "<expression> missing" for an expression that does not resolve and the bare id otherwise.
  return expressions.map((_, index) => (/^[0-9a-f]{40}$/.test(lines[index] ?? '') ? lines[index] : null));
}

export function readCommitMap(file) {
  const rows = readFileSync(file, 'utf8').trim().split('\n').slice(1).map((line) => line.split(' '));
  return new Map(rows);
}

function tagInfo(dir, rename) {
  return git(dir, ['for-each-ref', 'refs/tags', '--format=%(refname:short)\t%(objecttype)\t%(if:equals=tag)%(objecttype)%(then)%(taggername) %(taggeremail) %(taggerdate:raw)\n%(contents)%(end)\x02'])
    .split('\x02\n')
    .filter(Boolean)
    .map((row) => {
      const [name, type, ...rest] = row.split('\t');
      return { name: rename(name), type, body: rest.join('\t') };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

const messages = (dir) => git(dir, ['log', '--format=%H%x01%B%x02', 'HEAD']).split('\x02\n').filter((entry) => entry.trim()).map((entry) => {
  const [hash, body] = entry.split('\x01');
  return [hash.trim(), body];
});

/**
 * An independent JavaScript statement of the message rewrite (the import runs it as Python inside filter-repo): what a new
 * message must be, apart from the commit hashes filter-repo rewrites. The verifier compares every message with it exactly.
 */
export function expectedMessage(text, { repo, contextRefs = true }) {
  let out = text;
  if (contextRefs) {
    out = out.replace(/\b(core|opf)((?:\s+(?:PR|pull request|issue))?\s+)#(\d+)\b/gi, (_, name, gap, number) => `${name}${gap}OpenPresentation/opf#${number}`);
    out = out.replace(/\b(opf-(?:render|pptx|editor))((?:\s+(?:PR|pull request|issue))?\s+)#(\d+)\b/gi, (_, name, gap, number) => `${name}${gap}OpenPresentation/${name.toLowerCase()}#${number}`);
  }
  out = out.replace(/(?<![\w/#])#([1-9]\d*)\b/g, `OpenPresentation/${repo}#$1`);
  return out.replace(/\b(close[sd]?|fix(?:e[sd])?|resolve[sd]?)(:?\s+)(OpenPresentation\/[\w.-]+#\d+)/gi, '$1$2issue $3');
}

const maskHashes = (text) => text.replace(/\b[0-9a-f]{7,40}\b/g, 'H');

/** How an old message may legitimately differ from the new one. */
export function normalizeMessage(text) {
  return text
    .replace(/(?:OpenPresentation\/[\w.-]+)?#(\d+)\b/g, '#$1')
    .replace(/\bissue (?=#\d)/gi, '')
    .replace(/\b[0-9a-f]{7,40}\b/g, 'H')
    .trim();
}

function blameLines(dir, file, mapper) {
  return git(dir, ['blame', '-w', '-e', '--line-porcelain', 'HEAD', '--', file])
    .split('\n')
    .filter((line) => /^[0-9a-f]{40} \d+ \d+/.test(line) || line.startsWith('author-mail') || line.startsWith('\t'))
    .map((line) => (/^[0-9a-f]{40} /.test(line) ? mapper(line.slice(0, 40)) + line.slice(40) : line))
    .join('\n');
}

function pickBlameFiles(orig, sample) {
  const files = git(orig, ['ls-tree', '-r', '-l', 'HEAD']).trim().split('\n').filter(Boolean).map((line) => {
    const match = line.match(/^\d+ blob \w+\s+(\d+)\t(.*)$/);
    return match && { size: Number(match[1]), path: match[2] };
  }).filter((file) => file && file.size > 0 && file.size < MAX_BLAME_BYTES && TEXT_FILE.test(file.path));
  if (sample === 'all') return files;
  const churn = new Map();
  for (const file of git(orig, ['log', '--name-only', '--format=', 'HEAD']).split('\n').filter(Boolean)) churn.set(file, (churn.get(file) ?? 0) + 1);
  const hot = files
    .filter((file) => !file.path.includes('/evidence/') && !file.path.endsWith('package-lock.json'))
    .sort((a, b) => (churn.get(b.path) ?? 0) - (churn.get(a.path) ?? 0) || a.path.localeCompare(b.path))
    .slice(0, sample);
  const rest = files
    .filter((file) => !hot.includes(file))
    .sort((a, b) => createHash('sha1').update(a.path).digest('hex').localeCompare(createHash('sha1').update(b.path).digest('hex')))
    .slice(0, sample);
  return [...hot, ...rest];
}

export function verifyPackage(context, entry, results) {
  const { scratch, blame, offline, contextRefs } = context;
  const label = entry.repo;
  const check = (name, ok, detail = '') => results.push({ package: label, name, ok, detail });
  const info = (name, detail) => results.push({ package: label, name, ok: null, detail });
  const orig = path.join(scratch, 'orig', entry.repo);
  const work = path.join(scratch, 'work', entry.repo);
  const sub = entry.dir;
  const rename = (name) => `${entry.tagPrefix}${name}`;
  const mapFile = path.join(scratch, 'commit-map', `${entry.repo}.txt`);
  if (!existsSync(path.join(orig, '.git')) || !existsSync(path.join(work, '.git')) || !existsSync(mapFile)) {
    check('pristine clone, rewritten clone and commit map exist', false, `${orig}, ${work}, ${mapFile}`);
    return;
  }
  const started = Date.now();

  // The pristine clone is the source's current main, and every source tag was cloned.
  if (!offline) {
    const remote = spawnSync('git', ['ls-remote', entry.source], { encoding: 'utf8' });
    if (remote.status === 0) {
      const refs = remote.stdout.trim().split('\n').filter(Boolean).map((line) => line.split('\t'));
      const mainTip = refs.find(([, ref]) => ref === 'refs/heads/main')?.[0];
      check('pristine clone is at the source repository\'s main', mainTip === git(orig, ['rev-parse', 'HEAD']).trim(), `${mainTip?.slice(0, 8)} vs ${git(orig, ['rev-parse', 'HEAD']).trim().slice(0, 8)}`);
      const sourceTags = [...new Set(refs.map(([, ref]) => ref).filter((ref) => ref.startsWith('refs/tags/')).map((ref) => ref.slice(10).replace(/\^\{\}$/, '')))];
      const cloned = new Set(git(orig, ['tag', '--list']).split('\n').filter(Boolean));
      const missing = sourceTags.filter((tag) => !cloned.has(tag));
      check(`all ${sourceTags.length} source tags are in the pristine clone (none outside main's history)`, missing.length === 0, missing.slice(0, 5).join(', '));
    } else {
      info('source repository not readable; main and tag completeness not checked', entry.source);
    }
  }

  // Tree hashes at main and every tag.
  const tags = git(orig, ['tag', '--list']).split('\n').filter(Boolean);
  const oldTrees = resolveAll(orig, ['HEAD^{tree}', ...tags.map((tag) => `refs/tags/${tag}^{tree}`)]);
  const newTrees = resolveAll(work, [`HEAD:${sub}`, ...tags.map((tag) => `refs/tags/${rename(tag)}^{commit}:${sub}`)]);
  const badRefs = ['HEAD', ...tags].filter((_, index) => oldTrees[index] === null || oldTrees[index] !== newTrees[index]);
  check(`tree hash of ${sub} equals the old root tree at main and ${tags.length} tags`, badRefs.length === 0, badRefs.slice(0, 5).join(', '));

  // Tags: names (with the prefix), types, annotated bodies and taggers.
  const oldTags = tagInfo(orig, rename);
  const newTags = tagInfo(work, (name) => name);
  const tagsEqual = JSON.stringify(oldTags) === JSON.stringify(newTags);
  check(`tags: ${tags.length} names${entry.tagPrefix ? ` renamed with the prefix ${entry.tagPrefix}` : ' unchanged'}, types, annotated bodies and taggers equal`, tagsEqual,
    tagsEqual ? '' : `${oldTags.length} expected, ${newTags.length} found`);
  const peeledOld = resolveAll(orig, tags.map((tag) => `refs/tags/${tag}^{commit}`));
  const peeledNew = resolveAll(work, tags.map((tag) => `refs/tags/${rename(tag)}^{commit}`));
  const map = readCommitMap(mapFile);

  // Commits: counts, map completeness and one-to-one, and every commit's metadata.
  const oldCount = Number(git(orig, ['rev-list', '--count', 'HEAD']).trim());
  const newCount = Number(git(work, ['rev-list', '--count', 'HEAD']).trim());
  check('commit counts equal', oldCount === newCount, `${oldCount} vs ${newCount}`);
  check('tags point at the mapped commits', tags.every((_, index) => peeledOld[index] && map.get(peeledOld[index]) === peeledNew[index]));
  const format = '%H|%T|%an|%ae|%aI|%cn|%ce|%cI|%P';
  const oldRows = git(orig, ['log', '--topo-order', `--format=${format}`, 'HEAD']).trim().split('\n').filter(Boolean).map((line) => line.split('|'));
  const newRows = new Map(git(work, ['log', '--topo-order', `--format=${format}`, 'HEAD']).trim().split('\n').filter(Boolean).map((line) => [line.split('|')[0], line.split('|')]));
  const mapped = oldRows.map((row) => map.get(row[0]));
  check('commit map covers every old commit and is one to one', mapped.every(Boolean) && new Set(mapped).size === oldRows.length && mapped.every((hash) => newRows.has(hash)), `${map.size} entries`);
  const subtrees = resolveAll(work, mapped.map((hash) => `${hash}:${sub}`));
  let treeBad = 0;
  let rowBad = 0;
  oldRows.forEach((row, index) => {
    const newRow = newRows.get(mapped[index]);
    if (!newRow) { rowBad += 1; return; }
    if (subtrees[index] !== row[1]) treeBad += 1;
    const sameMetadata = [2, 3, 4, 5, 6, 7].every((column) => row[column] === newRow[column]);
    const parents = row[8] ? row[8].split(' ').map((parent) => map.get(parent)).join(' ') : '';
    if (!sameMetadata || parents !== newRow[8]) rowBad += 1;
  });
  check('every commit: subtree hash equals the old root tree', treeBad === 0, `${oldRows.length} commits, ${treeBad} differ`);
  check('every commit: author, committer, both dates and parent shape preserved', rowBad === 0, `${rowBad} differ`);

  // Messages.
  const newMessages = messages(work);
  const oldByNew = new Map(messages(orig).map(([hash, body]) => [map.get(hash), body]));
  const bare = newMessages.filter(([, body]) => BARE_REFERENCE.test(body));
  check('no bare #N in any imported message', bare.length === 0, `${bare.length} commits`);
  const diverged = newMessages.filter(([hash, body]) => normalizeMessage(oldByNew.get(hash) ?? '') !== normalizeMessage(body));
  check('messages differ only by #N qualification, hash rewriting and the "issue" insertion', diverged.length === 0, `${diverged.length} commits`);
  const inexact = newMessages.filter(([hash, body]) => maskHashes(expectedMessage(oldByNew.get(hash) ?? '', { repo: entry.repo, contextRefs })) !== maskHashes(body));
  check('every message equals the independent rewrite of its old message (apart from rewritten commit hashes)', inexact.length === 0, `${inexact.length} commits`);
  const closing = newMessages.filter(([, body]) => CLOSING_KEYWORD.test(body));
  check('no GitHub closing keyword directly before a reference', closing.length === 0, `${closing.length} commits`);
  if (contextRefs) {
    const wrong = newMessages.filter(([hash, body]) => {
      const before = oldByNew.get(hash) ?? '';
      const expectOpf = [...before.matchAll(/\b(core|opf)(?:\s+(?:PR|pull request|issue))?\s+#(\d+)\b/gi)].some(([, , number]) => !body.includes(`OpenPresentation/opf#${number}`));
      const expectEngine = [...before.matchAll(/\b(opf-(?:render|pptx|editor))(?:\s+(?:PR|pull request|issue))?\s+#(\d+)\b/gi)].some(([, repo, number]) => !body.includes(`OpenPresentation/${repo.toLowerCase()}#${number}`));
      return expectOpf || expectEngine;
    });
    check('contextual references ("core #N", "opf-render #N") name their own repository', wrong.length === 0, `${wrong.length} commits`);
  }
  info('messages changed', `${newMessages.filter(([hash, body]) => oldByNew.get(hash) !== body).length} of ${newMessages.length}`);

  // Nothing outside packages/<name>/, and the blob set is unchanged.
  const outside = git(work, ['log', '-m', '--name-only', '--format=', '--all']).split('\n').filter((file) => file && !file.startsWith(`${sub}/`));
  const topLevel = git(work, ['ls-tree', '--name-only', 'HEAD']).trim();
  check(`no path outside ${sub}/ in any commit of any ref, and HEAD has only packages/`, outside.length === 0 && topLevel === 'packages', outside.slice(0, 3).join(', '));
  const blobs = (dir) => git(dir, ['cat-file', '--batch-all-objects', '--batch-check=%(objecttype) %(objectname)']).split('\n').filter((line) => line.startsWith('blob ')).sort();
  const oldBlobs = blobs(orig);
  const newBlobs = blobs(work);
  check('blob set identical (no content changed, none dropped)', oldBlobs.join() === newBlobs.join(), `${oldBlobs.length} blobs`);

  // Blame and path history.
  const files = pickBlameFiles(orig, blame);
  const blameBad = [];
  for (const file of files) {
    try {
      const before = blameLines(orig, file.path, (hash) => map.get(hash) ?? `UNMAPPED:${hash}`);
      const after = blameLines(work, `${sub}/${file.path}`, (hash) => hash);
      if (before !== after) blameBad.push(file.path);
    } catch {
      blameBad.push(file.path); // blame failed on one side (a missing path, for instance)
    }
  }
  check(`blame equal (commit through the map, author mail, line content) on ${files.length} ${blame === 'all' ? 'files (all text files under 1 MiB)' : 'sampled files'}`, blameBad.length === 0, blameBad.slice(0, 3).join(', '));
  const probe = pickBlameFiles(orig, 1)[0]?.path;
  if (probe) {
    const before = git(orig, ['log', '--format=%H', '--', probe]).trim().split('\n').filter(Boolean).length;
    const after = git(work, ['log', '--format=%H', '--', `${sub}/${probe}`]).trim().split('\n').filter(Boolean).length;
    check(`git log -- ${sub}/${probe} (no --follow) finds the same commit count`, before === after, `${before} vs ${after}`);
  }

  // The committed commit map equals the generated one.
  if (context.commitMaps) {
    const committed = path.join(context.commitMaps, `${entry.repo}.txt`);
    check(`committed commit map ${path.relative(process.cwd(), committed) || committed} equals the generated one`, existsSync(committed) && readFileSync(committed, 'utf8') === readFileSync(mapFile, 'utf8'));
  }

  // Determinism.
  if (context.determinism) {
    const again = path.join(scratch, 'determinism', entry.repo);
    const againMap = path.join(scratch, 'determinism', `${entry.repo}.commit-map.txt`);
    const filter = filterRepoCommand();
    const rerun = importPackage({ ...context.importOptions, scratch, refresh: false }, { name: entry.name, repo: entry.repo, tagPrefix: entry.tagPrefix }, filter, () => {}, { workDir: again, commitMapFile: againMap });
    check('a second rewrite gives the same tip and a byte-identical commit map', rerun.workHead === entry.workHead && readFileSync(againMap, 'utf8') === readFileSync(mapFile, 'utf8'), `${rerun.workHead.slice(0, 8)} vs ${entry.workHead.slice(0, 8)}`);
    rmSync(path.join(scratch, 'determinism'), { recursive: true, force: true });
  }
  info('verification time', `${((Date.now() - started) / 1000).toFixed(1)}s`);
}

export function verifyMerged(context, manifest, entries, results) {
  const { scratch } = context;
  const check = (name, ok, detail = '') => results.push({ package: 'merged', name, ok, detail });
  const info = (name, detail) => results.push({ package: 'merged', name, ok: null, detail });
  const merged = path.join(scratch, 'merged');
  const core = manifest.core;
  if (!core || !existsSync(path.join(merged, '.git'))) return;
  const head = git(merged, ['rev-parse', 'HEAD']).trim();
  check('merged HEAD is the head the import recorded', head === core.head, head.slice(0, 8));
  check('core\'s main is an ancestor of the merged HEAD', git(merged, ['merge-base', '--is-ancestor', core.base, 'HEAD'], { allowFail: true }).status === 0, core.base.slice(0, 8));
  const coreCommits = Number(git(merged, ['rev-list', '--count', core.base]).trim());
  const imported = entries.reduce((sum, entry) => sum + entry.commits, 0);
  const total = Number(git(merged, ['rev-list', '--count', 'HEAD']).trim());
  // The import merges are the merges on the first-parent line above core's main (the imported histories hang off the second parents);
  // a re-sync in the freeze window adds one more merge for the package that gained commits.
  const importMerges = git(merged, ['log', '--first-parent', '--merges', '--format=%s', `${core.base}..HEAD`]).split('\n').filter(Boolean);
  check('commit count = core + imported + the import merges', total === coreCommits + imported + importMerges.length, `${total} = ${coreCommits} + ${imported} + ${importMerges.length}`);
  const subjects = entries.map((entry) => `MR-22: import ${entry.repo} history under ${entry.dir}`);
  check('every first-parent commit above core\'s main is an MR-22 import merge, and every package has one', importMerges.every((subject) => subjects.includes(subject)) && subjects.every((subject) => importMerges.includes(subject)), importMerges.length ? '' : 'no import merges');
  const noTip = entries.filter((entry) => git(merged, ['merge-base', '--is-ancestor', git(path.join(scratch, 'work', entry.repo), ['rev-parse', 'HEAD']).trim(), 'HEAD'], { allowFail: true }).status !== 0);
  check('each rewrite\'s tip is an ancestor of the merged HEAD', noTip.length === 0, noTip.map((entry) => entry.repo).join(', '));

  // Tags: core's tags unchanged, imported tags present, no collision, all reachable.
  const tagSha = (dir) => new Map(git(dir, ['for-each-ref', 'refs/tags', '--format=%(refname:short) %(objectname)']).trim().split('\n').filter(Boolean).map((line) => line.split(' ')));
  const mergedTags = tagSha(merged);
  const coreSource = spawnSync('git', ['ls-remote', '--tags', core.source], { encoding: 'utf8' });
  if (coreSource.status === 0 && !context.offline) {
    const sourceTags = new Map(coreSource.stdout.trim().split('\n').filter(Boolean).map((line) => line.split('\t')).filter(([, ref]) => !ref.endsWith('^{}')).map(([sha, ref]) => [ref.slice(10), sha]));
    const changed = [...sourceTags].filter(([name, sha]) => mergedTags.get(name) !== sha);
    check(`core's ${sourceTags.size} tags resolve to the same objects`, changed.length === 0, changed.slice(0, 3).map(([name]) => name).join(', '));
  } else {
    info('core tags not compared with the source (offline or unreadable)', core.source);
  }
  let importedTags = 0;
  const lost = [];
  for (const entry of entries) {
    const work = tagSha(path.join(scratch, 'work', entry.repo));
    for (const [name, sha] of work) {
      importedTags += 1;
      if (mergedTags.get(name) !== sha) lost.push(name);
    }
  }
  check(`all ${importedTags} imported tags are in the merged repository with the same objects (no collision)`, lost.length === 0, lost.slice(0, 3).join(', '));
  const coreTagCount = git(merged, ['tag', '--merged', core.base]).split('\n').filter(Boolean).length;
  check('tag count = core + imported', mergedTags.size === coreTagCount + importedTags, `${mergedTags.size} = ${coreTagCount} + ${importedTags}`);
  const unreachable = git(merged, ['tag', '--no-merged', 'HEAD']).split('\n').filter(Boolean);
  check('every tag is reachable from the merged HEAD', unreachable.length === 0, unreachable.slice(0, 3).join(', '));

  // Trees: the imported subtrees equal the rewrites, and core's tree outside them is unchanged.
  const dirs = entries.map((entry) => entry.dir);
  const subtreeInMerged = resolveAll(merged, dirs.map((dir) => `HEAD:${dir}`));
  const subtreeInWork = entries.map((entry) => resolveAll(path.join(scratch, 'work', entry.repo), [`HEAD:${entry.dir}`])[0]);
  check('imported subtrees in the merged HEAD equal the rewrites\' (no edits in the merge)', subtreeInMerged.every((sha, index) => sha && sha === subtreeInWork[index]));
  const changedPaths = git(merged, ['diff', '--name-only', core.base, 'HEAD']).split('\n').filter(Boolean);
  const stray = changedPaths.filter((file) => !dirs.some((dir) => file.startsWith(`${dir}/`)));
  check('nothing outside the imported directories differs from core\'s main (workspace list, lockfile, scripts untouched)', stray.length === 0, stray.slice(0, 3).join(', '));

  const pushUrl = git(merged, ['remote', 'get-url', '--push', 'origin']).trim();
  check('the merged clone cannot push (push URL disabled)', pushUrl.startsWith('no-push://'), pushUrl);
}

export function verifyImport(options) {
  const manifestFile = path.join(options.scratch, 'import-manifest.json');
  if (!existsSync(manifestFile)) throw new Error(`${manifestFile} is missing; run scripts/monorepo-import.mjs first`);
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  const names = options.packages.length ? options.packages : manifest.packages.map((entry) => entry.name);
  const entries = names.map((name) => {
    const entry = manifest.packages.find((candidate) => candidate.name === name);
    if (!entry) throw new Error(`${name} is not in the manifest (${manifest.packages.map((candidate) => candidate.name).join(', ')})`);
    return entry;
  });
  const context = {
    scratch: options.scratch,
    blame: options.blame,
    offline: options.offline,
    determinism: options.determinism,
    commitMaps: options.commitMaps,
    contextRefs: manifest.contextRefs,
    importOptions: {
      specs: manifest.packages.map(({ name, repo, tagPrefix }) => ({ name, repo, tagPrefix })),
      sources: Object.fromEntries(manifest.packages.map((entry) => [entry.repo, entry.source])),
      base: '',
      contextRefs: manifest.contextRefs,
    },
  };
  const results = [];
  for (const entry of entries) verifyPackage(context, entry, results);
  if (!options.packages.length) verifyMerged(context, manifest, entries, results);
  return { manifest, results, failed: results.filter((result) => result.ok === false).length };
}

export function renderReport({ manifest, results }) {
  const lines = [`# Import verification`, '', `Generated by \`scripts/verify-import.mjs\`; ${manifest.git}, git-filter-repo ${manifest.filterRepo}, contextual references ${manifest.contextRefs ? 'on' : 'off'}.`, ''];
  lines.push('| Package | Source main | Rewritten tip | Commits | Tags | Rewrite time |', '| --- | --- | --- | --- | --- | --- |');
  for (const entry of manifest.packages) lines.push(`| ${entry.repo} to ${entry.dir} | \`${entry.origHead.slice(0, 8)}\` | \`${entry.workHead.slice(0, 8)}\` | ${entry.commits} | ${entry.tags}${entry.tagPrefix ? ` (prefix \`${entry.tagPrefix}\`)` : ''} | ${entry.filterSeconds.toFixed(1)} s |`);
  if (manifest.core) lines.push('', `Merged into core \`${manifest.core.base.slice(0, 8)}\`: ${manifest.core.commits} commits, ${manifest.core.tags} tags, head \`${manifest.core.head.slice(0, 8)}\`.`);
  for (const group of [...new Set(results.map((result) => result.package))]) {
    lines.push('', `## ${group}`, '', '| Result | Check | Detail |', '| --- | --- | --- |');
    for (const result of results.filter((candidate) => candidate.package === group)) lines.push(`| ${result.ok === null ? 'info' : result.ok ? 'pass' : '**FAIL**'} | ${result.name.replaceAll('|', '\\|')} | ${String(result.detail ?? '').replaceAll('|', '\\|')} |`);
  }
  const failed = results.filter((result) => result.ok === false).length;
  lines.push('', failed ? `**${failed} check(s) FAILED.**` : `All ${results.filter((result) => result.ok !== null).length} checks passed.`, '');
  return lines.join('\n');
}

export function parseArgs(argv) {
  const options = { packages: [], blame: 25, determinism: false, offline: false };
  const value = (index, flag) => {
    if (index + 1 >= argv.length || argv[index + 1].startsWith('--')) throw new Error(`${flag} needs a value`);
    return argv[index + 1];
  };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--package') options.packages.push(value(index++, arg));
    else if (arg === '--blame') {
      const text = value(index++, arg);
      options.blame = text === 'all' ? 'all' : Number(text);
      if (options.blame !== 'all' && (!Number.isInteger(options.blame) || options.blame < 1)) throw new Error('--blame wants a positive integer or all');
    } else if (arg === '--determinism') options.determinism = true;
    else if (arg === '--offline') options.offline = true;
    else if (arg === '--commit-maps') options.commitMaps = path.resolve(value(index++, arg));
    else if (arg === '--report') options.report = path.resolve(value(index++, arg));
    else if (arg.startsWith('--')) throw new Error(`Unknown option ${arg}`);
    else positional.push(arg);
  }
  if (positional.length !== 1) throw new Error('usage: verify-import.mjs <scratch-dir> [options]');
  options.scratch = path.resolve(positional[0]);
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(64);
  }
  try {
    const outcome = verifyImport(options);
    for (const result of outcome.results) console.log(`${result.ok === null ? 'INFO' : result.ok ? 'PASS' : 'FAIL'}  [${result.package}] ${result.name}${result.detail ? `  (${result.detail})` : ''}`);
    if (options.report) writeFileSync(options.report, renderReport(outcome));
    console.log(outcome.failed ? `\n${outcome.failed} check(s) FAILED` : '\nall checks passed');
    process.exit(outcome.failed ? 1 : 0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

