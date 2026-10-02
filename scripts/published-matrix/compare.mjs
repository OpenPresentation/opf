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
import {compareHosts} from './digests.mjs';

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
for (const name of names) assert.equal(hosts[name].determinism?.passed, true, `${name}: the determinism grid passed on its own host`);
const {states, differences, allowed, stale} = compareHosts(hosts, allowlist);
const summary = {
  hosts: names.map((name) => ({os: name, node: hosts[name].determinism?.node, platform: hosts[name].determinism?.platform, arch: hosts[name].determinism?.arch, icu: hosts[name].determinism?.icu, states: hosts[name].digests.states})),
  states,
  digestsCompared: states * 4,
  identical: differences.length === 0,
  allowed,
  differences,
  staleAllowlistEntries: stale
};
if (outPath) writeFileSync(path.resolve(outPath), `${JSON.stringify(summary, null, 1)}\n`);
console.log(`Compared ${states} states across ${names.join(', ')}: ${differences.length} unexplained differences, ${allowed.length} allow-listed, ${stale.length} stale allow-list entries.`);
for (const difference of differences.slice(0, 40)) console.log(`DIFFERENT ${difference.key}.${difference.field}: ${difference.groups.map((group) => group.join('+')).join(' | ')}`);
for (const item of allowed.slice(0, 20)) console.log(`allowed   ${item.key}.${item.field} (${item.allowedBy}): ${item.reason}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [`### Cross-OS comparison of the published packages`, '', `${states} states compared across ${names.join(', ')}: **${differences.length} unexplained differences**, ${allowed.length} allow-listed.`, ''];
  for (const host of summary.hosts) lines.push(`- ${host.os}: Node ${host.node}, ICU ${host.icu}, ${host.states} states`);
  if (differences.length) lines.push('', '#### Unexplained differences', ...differences.slice(0, 40).map((difference) => `- \`${difference.key}.${difference.field}\`: ${difference.groups.map((group) => group.join('+')).join(' vs ')}`));
  if (allowed.length) lines.push('', '#### Allow-listed', ...[...new Map(allowed.map((item) => [item.allowedBy, item])).values()].map((item) => `- \`${item.allowedBy}\`: ${item.reason}`));
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, {flag: 'a'});
}
assert.deepEqual(stale, [], `allow-list entries that match nothing (delete them): ${stale.join(', ')}`);
assert.equal(differences.length, 0, `${differences.length} differences across operating systems are not explained by the allow-list`);
