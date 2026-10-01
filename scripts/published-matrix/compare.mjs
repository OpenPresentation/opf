// FF-10: cross-OS comparison of the published-package matrix (RR-04).
//
//   node scripts/published-matrix/compare.mjs <directory> [--allowlist file] [--out file]
//
// <directory> holds one sub-directory per operating system (the uploaded `published-matrix-<os>` artifacts), each with
//   digests.json            the full matrix: PPTX, SVG and PNG digests of every verified state
//   consumer.json           the TypeScript consumer's output
//   installed.json          the installed package versions and integrity hashes
//   determinism.json        the FF-11 grid manifest (ICU, Unicode and tz versions, controls, scenarios)
// Every digest must be identical on every OS. A difference passes only when allowlist.json names it with a reason; an
// allow-list entry that matches nothing fails, so the list cannot go stale.
import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const option = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const root = path.resolve(argv.find((arg, index) => !arg.startsWith('--') && !['--allowlist', '--out'].includes(argv[index - 1])) ?? '.');
const allowlistPath = path.resolve(option('--allowlist', path.join(here, 'allowlist.json')));
const outPath = option('--out', undefined);

const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const hosts = {};
for (const entry of readdirSync(root, {withFileTypes: true})) {
  if (!entry.isDirectory()) continue;
  const dir = path.join(root, entry.name);
  const find = (name) => [path.join(dir, name), path.join(dir, 'out', name), path.join(dir, 'determinism', name)].find((candidate) => existsSync(candidate));
  const digests = find('digests.json');
  if (!digests) continue;
  hosts[entry.name.replace(/^published-matrix-/, '')] = {digests: read(digests), consumer: find('consumer.json') ? read(find('consumer.json')) : null, installed: find('installed.json') ? read(find('installed.json')) : null, determinism: find('determinism.json') ? read(find('determinism.json')) : null};
}
const names = Object.keys(hosts).sort();
assert.ok(names.length >= 2, `need at least two operating systems under ${root}, found ${names.join(', ') || 'none'}`);
const allowlist = existsSync(allowlistPath) ? read(allowlistPath) : {entries: []};
const used = new Map(allowlist.entries.map((entry) => [entry.id, 0]));
const reference = names[0];

const differences = [];
const allowed = [];
const matches = (entry, difference) => (entry.pattern === undefined || new RegExp(entry.pattern).test(difference.key)) && (entry.fields === undefined || entry.fields.includes(difference.field)) && (entry.hosts === undefined || difference.hosts.every((host) => entry.hosts.includes(host)));
function record(key, field, values) {
  const groups = new Map();
  for (const [host, value] of Object.entries(values)) groups.set(JSON.stringify(value), [...(groups.get(JSON.stringify(value)) ?? []), host]);
  if (groups.size === 1) return;
  const difference = {key, field, hosts: Object.keys(values), groups: [...groups.values()]};
  const entry = allowlist.entries.find((candidate) => matches(candidate, difference));
  if (entry) {
    used.set(entry.id, used.get(entry.id) + 1);
    allowed.push({...difference, allowedBy: entry.id, reason: entry.reason});
  } else differences.push(difference);
}

// Environment: the same Node, ICU, Unicode and tz data, and the same package bytes.
for (const field of ['node', 'icu', 'unicode', 'tzdata', 'graphemeSignature']) record('environment', field, Object.fromEntries(names.filter((name) => hosts[name].determinism).map((name) => [name, hosts[name].determinism[field]])));
for (const name of names) assert.equal(hosts[name].determinism?.passed, true, `${name}: the determinism grid passed on its own host`);
for (const field of Object.keys(hosts[reference].installed?.packages ?? {})) record(`installed ${field}`, 'integrity', Object.fromEntries(names.map((name) => [name, hosts[name].installed?.packages[field]?.integrity])));

// Every digest of every state.
const labels = new Set(names.flatMap((name) => Object.keys(hosts[name].digests.digests)));
for (const label of [...labels].sort()) {
  for (const field of ['pptx', 'svg', 'slides', 'png']) {
    const values = Object.fromEntries(names.map((name) => [name, hosts[name].digests.digests[label]?.[field] ?? null]));
    if (Object.values(values).every((value) => value === null)) continue;
    record(label, field, values);
  }
}
for (const field of ['svg', 'png', 'pptx']) record('consumer', field, Object.fromEntries(names.map((name) => [name, hosts[name].consumer?.[field] ?? null])));
record('matrix', 'states', Object.fromEntries(names.map((name) => [name, hosts[name].digests.states])));

const stale = [...used].filter(([id, count]) => count === 0 && !allowlist.entries.find((entry) => entry.id === id)?.optional).map(([id]) => id);
const summary = {
  hosts: names.map((name) => ({os: name, node: hosts[name].determinism?.node, platform: hosts[name].determinism?.platform, arch: hosts[name].determinism?.arch, icu: hosts[name].determinism?.icu, states: hosts[name].digests.states})),
  states: labels.size,
  digestsCompared: [...labels].length * 4,
  identical: differences.length === 0,
  allowed,
  differences,
  staleAllowlistEntries: stale
};
if (outPath) writeFileSync(path.resolve(outPath), `${JSON.stringify(summary, null, 1)}\n`);
console.log(`Compared ${labels.size} states across ${names.join(', ')}: ${differences.length} unexplained differences, ${allowed.length} allow-listed, ${stale.length} stale allow-list entries.`);
for (const difference of differences.slice(0, 40)) console.log(`DIFFERENT ${difference.key}.${difference.field}: ${difference.groups.map((group) => group.join('+')).join(' | ')}`);
for (const item of allowed.slice(0, 20)) console.log(`allowed   ${item.key}.${item.field} (${item.allowedBy}): ${item.reason}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [`### Cross-OS comparison of the published packages`, '', `${labels.size} states compared across ${names.join(', ')}: **${differences.length} unexplained differences**, ${allowed.length} allow-listed.`, ''];
  for (const host of summary.hosts) lines.push(`- ${host.os}: Node ${host.node}, ICU ${host.icu}, ${host.states} states`);
  if (differences.length) lines.push('', '#### Unexplained differences', ...differences.slice(0, 40).map((difference) => `- \`${difference.key}.${difference.field}\`: ${difference.groups.map((group) => group.join('+')).join(' vs ')}`));
  if (allowed.length) lines.push('', '#### Allow-listed', ...[...new Map(allowed.map((item) => [item.allowedBy, item])).values()].map((item) => `- \`${item.allowedBy}\`: ${item.reason}`));
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, {flag: 'a'});
}
assert.deepEqual(stale, [], `allow-list entries that match nothing (delete them): ${stale.join(', ')}`);
assert.equal(differences.length, 0, `${differences.length} differences across operating systems are not explained by the allow-list`);
