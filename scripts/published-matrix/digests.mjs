// Digest comparison shared by determinism.mjs (one OS, many environments) and compare.mjs (many OSes, one environment).
// A digest set maps a state label (`pairwise-07 A`, `chart:treemap`) to {pptx, svg, slides, png}.

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

/**
 * Compares the same keys across hosts. `hosts` maps a host name to {digests, consumer, installed, determinism}; an
 * allow-list entry {id, reason, pattern?, fields?, hosts?, optional?} explains a difference it matches. Returns the
 * unexplained differences, the explained ones and the entries that matched nothing (stale unless optional).
 */
export function compareHosts(hosts, allowlist = {entries: []}) {
  const names = Object.keys(hosts).sort();
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
  for (const field of Object.keys(hosts[names[0]].installed?.packages ?? {})) record(`installed ${field}`, 'integrity', Object.fromEntries(names.map((name) => [name, hosts[name].installed?.packages[field]?.integrity])));
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
