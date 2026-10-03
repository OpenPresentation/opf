#!/usr/bin/env node
// RR-46: changelog fragments. One file per change in `changes/<slug>.md` instead of an edit to the shared
// `## Unreleased` block, so two pull requests never conflict on CHANGELOG.md. A release-prep pull request runs
// `assemble`, which moves the fragments into a new release section and deletes them.
//
//   node scripts/changelog-fragments.mjs check                         validate every fragment (CI)
//   node scripts/changelog-fragments.mjs assemble --version X.Y.Z      move the fragments into CHANGELOG.md
//        [--package <name>] [--date YYYY-MM-DD] [--summary "<text>"] [--dry-run]
//   node scripts/changelog-fragments.mjs warn-missing --base <ref>     warn (never fail) when code changed
//                                                                      and the pull request has no fragment
//
// Fragment format (changes/README.md):
//   ---
//   type: added | changed | fixed
//   packages: [opf]            (only in a repository with several changelogs; see changes/config.json)
//   ---
//   RR-17 (what and why): the text of one CHANGELOG bullet, without the leading "- ".
//
// This file is identical in the four public repositories. Plain Node, no dependencies.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const TYPES = ['added', 'changed', 'fixed'];
const DEFAULT_CONFIG = { default: '', targets: { '': 'CHANGELOG.md' }, codePaths: ['src/'] };
const KEYS = new Set(['type', 'packages']);

export function loadConfig(root) {
  const file = path.join(root, 'changes', 'config.json');
  if (!existsSync(file)) return DEFAULT_CONFIG;
  const config = JSON.parse(readFileSync(file, 'utf8'));
  return { ...DEFAULT_CONFIG, ...config };
}

// Parses `---` front matter of `type` and `packages` (a flow list) and returns the entry text.
export function parseFragment(name, text, config = DEFAULT_CONFIG) {
  const fail = (message) => {
    throw new Error(`changes/${name}: ${message}`);
  };
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if (!match) fail('missing front matter (--- type: added|changed|fixed ---)');
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const pair = /^([a-z]+):\s*(.*?)\s*$/.exec(line);
    if (!pair || !KEYS.has(pair[1])) fail(`unknown front matter line "${line}" (allowed keys: ${[...KEYS].join(', ')})`);
    if (pair[1] in meta) fail(`duplicate key "${pair[1]}"`);
    meta[pair[1]] = pair[2];
  }
  if (!TYPES.includes(meta.type)) fail(`type must be one of ${TYPES.join(', ')} (got "${meta.type ?? ''}")`);
  let packages = [];
  if ('packages' in meta) {
    const list = /^\[(.*)\]$/.exec(meta.packages);
    if (!list) fail('packages must be a list such as [opf] or []');
    packages = list[1].split(',').map((entry) => entry.trim()).filter(Boolean);
  }
  const known = Object.keys(config.targets);
  if (known.length === 1 && known[0] === '') {
    if (packages.length) fail('this repository has one changelog; drop "packages"');
  } else {
    for (const pkg of packages) if (!known.includes(pkg)) fail(`unknown package "${pkg}" (known: ${known.join(', ')})`);
    if (new Set(packages).size !== packages.length) fail('duplicate package');
  }
  const body = match[2].replace(/^\s*\n/, '').replace(/\s+$/, '');
  if (!body.trim()) fail('empty entry');
  if (/^\s*[-*]\s/.test(body)) fail('write the entry text without the leading "- "');
  return { slug: name.replace(/\.md$/, ''), type: meta.type, packages, body };
}

export function readFragments(root, config = loadConfig(root)) {
  const dir = path.join(root, 'changes');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md') && name.toLowerCase() !== 'readme.md')
    .sort()
    .map((name) => ({ file: path.join(dir, name), ...parseFragment(name, readFileSync(path.join(dir, name), 'utf8'), config) }));
}

// Entries for one target: fragments naming it, plus (for the default target) fragments naming no package.
export function selectFragments(fragments, pkg, config) {
  return fragments.filter((f) => f.packages.includes(pkg) || (f.packages.length === 0 && pkg === config.default));
}

export function orderFragments(fragments) {
  const rank = (f) => TYPES.indexOf(f.type);
  return [...fragments].sort((a, b) => rank(a) - rank(b) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

// Splits a section body into bullets (a "- " at column 0 starts one); the rest is kept inside its bullet.
export function splitBullets(body) {
  const bullets = [];
  let intro = '';
  for (const line of body.split('\n')) {
    if (line.startsWith('- ')) bullets.push(line.slice(2));
    else if (bullets.length) bullets[bullets.length - 1] += `\n${line}`;
    else intro += `${line}\n`;
  }
  return { intro: intro.trim(), bullets: bullets.map((b) => b.replace(/\s+$/, '')) };
}

// Takes the changelog text and returns { text, leftover }: a new release section sits under `## Unreleased`,
// which stays as an empty heading; bullets someone still wrote under Unreleased by hand go into the new section.
export function assembleChangelog(text, { version, date, summary = '', entries }) {
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error(`"${version}" is not a semantic version`);
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const heading = /^## (.*)$/;
  const sections = [];
  lines.forEach((line, index) => {
    const m = heading.exec(line);
    if (m) sections.push({ title: m[1].trim(), index });
  });
  if (sections.some((s) => s.title === version || s.title.startsWith(`${version} `))) {
    throw new Error(`CHANGELOG already has a section for ${version}`);
  }
  const unreleased = sections.findIndex((s) => /^unreleased$/i.test(s.title));
  let head;
  let leftoverBody = '';
  let rest;
  if (unreleased >= 0) {
    const start = sections[unreleased].index;
    const end = sections[unreleased + 1]?.index ?? lines.length;
    head = lines.slice(0, start);
    leftoverBody = lines.slice(start + 1, end).join('\n').trim();
    rest = lines.slice(end);
  } else {
    const first = sections[0]?.index ?? lines.length;
    head = lines.slice(0, first);
    rest = lines.slice(first);
  }
  const { intro, bullets: leftover } = splitBullets(leftoverBody);
  if (intro) throw new Error('text under ## Unreleased that is not a bullet; move it into a fragment or pass --summary');
  const previous = rest.join('\n').split(/\n## /)[0];
  const loose = /^- .*\n\n- /m.test(previous);
  const bullets = [...leftover, ...entries.map((e) => e.body)];
  if (!bullets.length) throw new Error('nothing to assemble: no fragments and nothing under ## Unreleased');
  const title = `## ${version}${date ? ` (${date})` : ''}`;
  const section = [title, '', ...(summary ? [summary.trim(), ''] : []), bullets.map((b) => `- ${b}`).join(loose ? '\n\n' : '\n')];
  const trimmedHead = head.join('\n').replace(/\s+$/, '');
  const base = `${trimmedHead}\n\n## Unreleased`;
  const tail = rest.join('\n').replace(/^\n+/, '');
  return { text: `${base}\n\n${section.join('\n')}\n${tail ? `\n${tail}` : ''}`.replace(/\n*$/, '\n'), leftover: leftover.length };
}

// Rewrites a fragment so it no longer names `pkg`; returns null when nothing is left to assemble.
export function withoutPackage(fragmentText, pkg) {
  const match = /^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n[\s\S]*)$/.exec(fragmentText);
  let remaining = 0;
  const meta = match[2].replace(/^packages:\s*\[(.*)\]\s*$/m, (_, list) => {
    const rest = list.split(',').map((x) => x.trim()).filter((x) => x && x !== pkg);
    remaining = rest.length;
    return `packages: [${rest.join(', ')}]`;
  });
  return remaining ? `${match[1]}${meta}${match[3]}` : null;
}

export function assemble(root, options, write = true) {
  const config = loadConfig(root);
  const pkg = options.package ?? config.default;
  if (!(pkg in config.targets)) throw new Error(`unknown package "${pkg}" (known: ${Object.keys(config.targets).join(', ')})`);
  const fragments = readFragments(root, config);
  const picked = orderFragments(selectFragments(fragments, pkg, config));
  const file = path.join(root, config.targets[pkg]);
  const { text, leftover } = assembleChangelog(readFileSync(file, 'utf8'), { ...options, entries: picked });
  if (write) {
    writeFileSync(file, text);
    for (const fragment of picked) {
      const left = fragment.packages.length > 1 ? withoutPackage(readFileSync(fragment.file, 'utf8'), pkg) : null;
      if (left) writeFileSync(fragment.file, left);
      else unlinkSync(fragment.file);
    }
  }
  return { file, text, fragments: picked.length, leftover };
}

// True when a changed file is package code the changelog should mention.
export function needsFragment(changedFiles, config = DEFAULT_CONFIG) {
  const touchesCode = changedFiles.some((f) => config.codePaths.some((prefix) => f.startsWith(prefix)));
  const hasFragment = changedFiles.some((f) => /^changes\/(?!README\.md$)[^/]+\.md$/i.test(f));
  const touchesChangelog = changedFiles.some((f) => Object.values(config.targets).includes(f));
  return touchesCode && !hasFragment && !touchesChangelog;
}

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) out._.push(arg);
    else if (arg === '--dry-run') out.dryRun = true;
    else out[arg.slice(2)] = argv[++i];
  }
  return out;
}

function main(argv) {
  const root = process.cwd();
  const [command] = argv;
  const options = args(argv.slice(1));
  const config = loadConfig(root);
  if (command === 'check') {
    const fragments = readFragments(root, config);
    console.log(`changes/: ${fragments.length} fragment(s) valid`);
    return 0;
  }
  if (command === 'assemble') {
    if (!options.version) throw new Error('Usage: assemble --version X.Y.Z [--package <name>] [--date YYYY-MM-DD] [--summary "<text>"] [--dry-run]');
    const date = options.date ?? new Date().toISOString().slice(0, 10);
    const result = assemble(root, { version: options.version, date, summary: options.summary ?? '', package: options.package }, !options.dryRun);
    console.log(`${options.dryRun ? 'would assemble' : 'assembled'} ${result.fragments} fragment(s) and ${result.leftover} Unreleased bullet(s) into ${path.relative(root, result.file)} ${options.version}`);
    if (options.dryRun) console.log(result.text.split('\n## ')[2] ? `## ${result.text.split('\n## ')[2]}` : '');
    return 0;
  }
  if (command === 'warn-missing') {
    if (!options.base) throw new Error('Usage: warn-missing --base <ref>');
    const changed = execFileSync('git', ['diff', '--name-only', `${options.base}...HEAD`], { encoding: 'utf8' }).split('\n').filter(Boolean);
    if (needsFragment(changed, config)) {
      console.log('::warning title=No changelog fragment::This pull request changes package code but adds no changes/<slug>.md. Add a fragment if the change is user-facing (see changes/README.md); ignore this for internal changes.');
    } else {
      console.log('changelog fragment check: nothing to warn about');
    }
    return 0;
  }
  throw new Error('Usage: changelog-fragments.mjs check | assemble --version X.Y.Z | warn-missing --base <ref>');
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
// Keeps the module path available to tests that spawn the CLI.
export const SCRIPT = fileURLToPath(import.meta.url);
