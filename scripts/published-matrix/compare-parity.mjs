// RR-04 (FF-10, FF-38): cross-OS comparison of the installed parity audit (installed-parity.mjs).
//
//   node scripts/published-matrix/compare-parity.mjs <directory> [--out file] [--markdown file]
//
// <directory> holds one sub-directory per operating system (the uploaded `installed-parity-<os>` artifacts), each with
// parity-results.json and installed.json. The same packages, the same snippets and the same harness must give the same
// result on every OS: the same values, the same class (perfect, near, mismatch) and the same outcome of every check,
// fact, diff and diagnostic. Nothing is allow-listed: any difference is a finding and fails the run.
import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const argv = process.argv.slice(2);
const option = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const root = path.resolve(argv.find((arg, index) => !arg.startsWith('--') && !['--out', '--markdown'].includes(argv[index - 1])) ?? '.');
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));

// Every leaf of a JSON value as a "path -> JSON text" entry, so two results compare field by field.
export function leaves(value, prefix = '', into = new Map()) {
  if (value !== null && typeof value === 'object') {
    const keys = Array.isArray(value) ? value.map((_, index) => index) : Object.keys(value).sort();
    if (keys.length === 0) into.set(prefix, Array.isArray(value) ? '[]' : '{}');
    for (const key of keys) leaves(value[key], prefix ? `${prefix}.${key}` : String(key), into);
  } else into.set(prefix, JSON.stringify(value));
  return into;
}
export const keyOf = (result) => `${result.dimension}/${result.variant}/${result.id}`;

export function compareParity(hosts) {
  const names = Object.keys(hosts).sort();
  const reference = names[0];
  const differences = [];
  const note = (scope, field, values) => {
    if (new Set(Object.values(values)).size > 1) differences.push({scope, field, values});
  };

  // The run itself: everything in meta except the clock.
  const metas = Object.fromEntries(names.map((name) => [name, leaves({...hosts[name].results.meta, generatedAt: undefined})]));
  for (const field of new Set(names.flatMap((name) => [...metas[name].keys()]))) {
    note('meta', field, Object.fromEntries(names.map((name) => [name, metas[name].get(field) ?? null])));
  }

  const byKey = Object.fromEntries(names.map((name) => [name, new Map(hosts[name].results.results.map((result) => [keyOf(result), result]))]));
  for (const name of names) assert.equal(byKey[name].size, hosts[name].results.results.length, `${name}: value keys are unique`);
  const keys = [...new Set(names.flatMap((name) => [...byKey[name].keys()]))].sort();
  for (const key of keys) {
    const present = Object.fromEntries(names.map((name) => [name, byKey[name].has(key)]));
    if (new Set(Object.values(present)).size > 1) { differences.push({scope: key, field: '(value present)', values: Object.fromEntries(names.map((name) => [name, String(present[name])]))}); continue; }
    const flat = Object.fromEntries(names.map((name) => [name, leaves(byKey[name].get(key))]));
    for (const field of new Set(names.flatMap((name) => [...flat[name].keys()]))) {
      note(key, field, Object.fromEntries(names.map((name) => [name, flat[name].get(field) ?? null])));
    }
  }

  const counts = {};
  for (const name of names) {
    const results = hosts[name].results.results;
    const tally = (list) => Object.fromEntries(['perfect', 'near', 'mismatch'].map((cls) => [cls, list.filter((result) => result.class === cls).length]));
    const checks = {};
    for (const result of results) {
      for (const [check, outcome] of Object.entries(result.checks ?? {})) {
        checks[check] ??= {};
        checks[check][outcome] = (checks[check][outcome] ?? 0) + 1;
      }
    }
    const dimensions = {};
    for (const dimension of new Set(results.map((result) => result.dimension))) dimensions[dimension] = {values: results.filter((result) => result.dimension === dimension).length, ...tally(results.filter((result) => result.dimension === dimension))};
    counts[name] = {values: results.length, ...tally(results), checks, dimensions};
  }

  // The heads the harness recorded must be the registry commits of the installed packages (not, say, the HEAD of the repository the work directory sits in).
  for (const name of names) {
    for (const [head, pkg] of [['opf', '@openpresentation/opf'], ['opf-render', '@openpresentation/opf-render'], ['opf-pptx', '@openpresentation/opf-pptx']]) {
      const recorded = hosts[name].results.meta.heads?.[head] ?? null;
      const installed = hosts[name].installed.packages?.[pkg]?.gitHead ?? null;
      if (recorded !== installed) differences.push({scope: name, field: `meta.heads.${head} is not the installed gitHead`, values: {recorded, installed}});
    }
  }

  // The installed set: the four packages must be the same versions at the same commits; transitive dependencies are listed when they differ
  // (the platform builds of sharp and resvg legitimately have different names), but they do not decide the comparison.
  const installedDifferences = [];
  const packages = Object.fromEntries(names.map((name) => [name, leaves(hosts[name].installed.packages)]));
  for (const field of new Set(names.flatMap((name) => [...packages[name].keys()]))) {
    const values = Object.fromEntries(names.map((name) => [name, packages[name].get(field) ?? null]));
    if (new Set(Object.values(values)).size > 1) differences.push({scope: 'installed', field, values});
  }
  const modules = Object.fromEntries(names.map((name) => [name, hosts[name].installed.dependencies]));
  for (const dependency of new Set(names.flatMap((name) => Object.keys(modules[name])))) {
    const values = Object.fromEntries(names.map((name) => [name, modules[name][dependency] ?? null]));
    if (new Set(Object.values(values)).size > 1) installedDifferences.push({dependency, values});
  }
  return {hosts: names, reference, values: keys.length, counts, differences, installedDifferences};
}

export function markdown(summary) {
  const lines = ['### Installed parity audit across operating systems', ''];
  lines.push(`${summary.values} values on ${summary.hosts.join(', ')}: **${summary.differences.length} differences**.`, '');
  lines.push('| OS | values | perfect | near | mismatch |', '| --- | --- | --- | --- | --- |');
  for (const name of summary.hosts) lines.push(`| ${name} | ${summary.counts[name].values} | ${summary.counts[name].perfect} | ${summary.counts[name].near} | ${summary.counts[name].mismatch} |`);
  if (summary.differences.length) {
    lines.push('', '#### Differences (first 40)');
    for (const difference of summary.differences.slice(0, 40)) lines.push(`- \`${difference.scope}\` \`${difference.field}\`: ${Object.entries(difference.values).map(([os, value]) => `${os} ${String(value).slice(0, 80)}`).join(' | ')}`);
  }
  if (summary.installedDifferences.length) lines.push('', `${summary.installedDifferences.length} installed dependencies differ in name or version across systems (platform builds); see the JSON.`);
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const hosts = {};
  for (const entry of readdirSync(root, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);
    if (!existsSync(path.join(dir, 'parity-results.json'))) continue;
    hosts[entry.name.replace(/^installed-parity-/, '')] = {results: read(path.join(dir, 'parity-results.json')), installed: read(path.join(dir, 'installed.json'))};
  }
  assert.ok(Object.keys(hosts).length >= 2, `need at least two operating systems under ${root}, found ${Object.keys(hosts).join(', ') || 'none'}`);
  const summary = compareParity(hosts);
  if (option('--out')) writeFileSync(path.resolve(option('--out')), `${JSON.stringify(summary, null, 1)}\n`);
  const text = markdown(summary);
  if (option('--markdown')) writeFileSync(path.resolve(option('--markdown')), text);
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, text, {flag: 'a'});
  console.log(text);
  assert.equal(summary.differences.length, 0, `${summary.differences.length} differences across ${summary.hosts.join(', ')}`);
}
