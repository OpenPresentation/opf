// Digest comparison shared by determinism.mjs (one OS, many environments) and compare.mjs (many OSes, one environment).
// A digest set maps a state label (`pairwise-07 A`, `chart:treemap`) to {pptx, svg, slides, png}.

import assert from 'node:assert/strict';

export const FIELDS = ['pptx', 'svg', 'slides', 'png'];

/** Differences between two digest sets, as `label.field` strings. `ignore` names fields that are only recorded. */
export function diffDigests(baseline, other, {ignore = []} = {}) {
  const differing = [];
  const informational = [];
  for (const label of new Set([...Object.keys(baseline), ...Object.keys(other)])) {
    const a = baseline[label];
    const b = other[label];
    if (!a || !b) {
      differing.push(`${label}: missing in ${a ? 'the other run' : 'the baseline'}`);
      continue;
    }
    for (const field of FIELDS) {
      if (JSON.stringify(a[field]) === JSON.stringify(b[field])) continue;
      (ignore.includes(field) ? informational : differing).push(`${label}.${field}`);
    }
  }
  return {differing, informational};
}

// Validate producer reports before comparing: identical missing evidence is not parity.
function assertHostReports(name, host) {
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const digest = (value, length = 64) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`, 'i').test(value);
  assert.ok(record(host?.digests) && record(host.digests.digests), `${name}: digests report is required`);
  const states = Object.entries(host.digests.digests);
  assert.ok(states.length > 0 && host.digests.states === states.length, `${name}: nonempty digests must match the declared state count`);
  for (const [label, state] of states) {
    assert.ok(label && record(state) && digest(state.pptx) && digest(state.svg), `${name}/${label}: PPTX and SVG SHA-256 digests are required`);
    // Chart-only states deliberately omit slide and raster digests. Present fields must be complete.
    for (const [field, length] of [['slides', 16], ['png', 64]]) {
      if (state[field] !== undefined) assert.ok(Array.isArray(state[field]) && state[field].length > 0 && state[field].every(value => digest(value, length)), `${name}/${label}: invalid ${field} digests`);
    }
  }
  assert.ok(record(host.consumer), `${name}: consumer report is required`);
  for (const field of ['svg', 'png', 'pptx']) assert.ok(digest(host.consumer[field]), `${name}: consumer ${field} SHA-256 is required`);
  assert.ok(record(host.installed?.packages), `${name}: installed package report is required`);
  for (const pkg of ['@openpresentation/opf', '@openpresentation/opf-render', '@openpresentation/opf-pptx', '@openpresentation/opf-editor']) assert.ok(record(host.installed.packages[pkg]), `${name}: installed ${pkg} is required`);
  for (const [pkg, entry] of Object.entries(host.installed.packages)) assert.ok(record(entry) && typeof entry.integrity === 'string' && /^sha512-[A-Za-z0-9+/]+={0,2}$/.test(entry.integrity), `${name}: installed ${pkg} integrity is required`);
  assert.ok(record(host.determinism) && host.determinism.passed === true, `${name}: passed determinism report is required`);
  for (const field of ['node', 'icu', 'unicode', 'tzdata', 'graphemeSignature']) assert.ok(typeof host.determinism[field] === 'string' && host.determinism[field].length > 0, `${name}: determinism ${field} is required`);
}

/**
 * Compares the same keys across hosts. `hosts` maps a host name to {digests, consumer, installed, determinism}; an
 * allow-list entry {id, reason, pattern?, fields?, hosts?, optional?} explains a difference it matches. Returns the
 * unexplained differences, the explained ones and the entries that matched nothing (stale unless optional).
 */
export function compareHosts(hosts, allowlist = {entries: []}) {
  const names = Object.keys(hosts).sort();
  assert.ok(names.length >= 2, 'At least two host reports are required');
  for (const name of names) assertHostReports(name, hosts[name]);
  const used = new Map(allowlist.entries.map((entry) => [entry.id, 0]));
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
  for (const field of new Set(names.flatMap(name => Object.keys(hosts[name].installed.packages)))) record(`installed ${field}`, 'integrity', Object.fromEntries(names.map((name) => [name, hosts[name].installed?.packages[field]?.integrity])));
  // Every digest of every state.
  const labels = new Set(names.flatMap((name) => Object.keys(hosts[name].digests.digests)));
  for (const label of [...labels].sort()) {
    for (const field of FIELDS) {
      const values = Object.fromEntries(names.map((name) => [name, hosts[name].digests.digests[label]?.[field] ?? null]));
      if (Object.values(values).every((value) => value === null)) continue;
      record(label, field, values);
    }
  }
  for (const field of ['svg', 'png', 'pptx']) record('consumer', field, Object.fromEntries(names.map((name) => [name, hosts[name].consumer?.[field] ?? null])));
  record('matrix', 'states', Object.fromEntries(names.map((name) => [name, hosts[name].digests.states])));
  const stale = [...used].filter(([id, count]) => count === 0 && !allowlist.entries.find((entry) => entry.id === id)?.optional).map(([id]) => id);
  return {names, states: labels.size, differences, allowed, stale};
}
