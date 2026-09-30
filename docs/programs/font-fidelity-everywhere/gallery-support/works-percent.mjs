// Prints how many gallery configurations have pipeline status `works`, overall and per dimension,
// from support-status.json (the FF-23 presence audits). This is the internal progress measure for the
// "every gallery config works (100%)" goal (FF-47); it is never shown on pptx.gallery.
//
//   node works-percent.mjs                 overall and per-dimension table
//   node works-percent.mjs --reasons       plus the most common reasons behind each non-works dimension
//   node works-percent.mjs --json          the same numbers as JSON
//   node works-percent.mjs --file <path>   read another support-status.json (default: the one beside this script)
//
// `works` here is the audit's own classifier (gallery-support.md#status-legend); this script only counts.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Counts items by dimension and status. Pure, so it is unit-tested. */
export function summarize(status) {
  const dims = new Map();
  for (const item of status.items) {
    if (typeof item.dimension !== 'string' || typeof item.status !== 'string') throw new Error(`item without dimension/status: ${JSON.stringify(item).slice(0, 80)}`);
    const d = dims.get(item.dimension) ?? { dimension: item.dimension, total: 0, works: 0, byStatus: {} };
    d.total += 1;
    if (item.status === 'works') d.works += 1;
    d.byStatus[item.status] = (d.byStatus[item.status] ?? 0) + 1;
    dims.set(item.dimension, d);
  }
  const dimensions = [...dims.values()];
  const total = dimensions.reduce((n, d) => n + d.total, 0);
  const works = dimensions.reduce((n, d) => n + d.works, 0);
  const byStatus = {};
  for (const d of dimensions) for (const [s, n] of Object.entries(d.byStatus)) byStatus[s] = (byStatus[s] ?? 0) + n;
  return { total, works, percent: total ? (100 * works) / total : 0, byStatus, dimensions };
}

/** Most common reasons among non-works items of a dimension, with digits and parentheticals collapsed. */
export function topReasons(status, dimension, limit = 5) {
  const counts = new Map();
  for (const item of status.items) {
    if (item.dimension !== dimension || item.status === 'works') continue;
    const seen = new Set();
    for (const reason of item.reasons ?? []) {
      const key = reason.replace(/\([^)]*\)/g, '()').replace(/\d+/g, 'N').replace(/(font-unavailable:|writes ).*/, '$1...').slice(0, 120);
      if (seen.has(key)) continue;
      seen.add(key);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
}

const pct = (n, total) => (total ? `${((100 * n) / total).toFixed(1)}%` : '-');

export function format(summary, status, { reasons = false } = {}) {
  const lines = [];
  const heads = status.audits?.b?.heads ?? {};
  lines.push(`works: ${summary.works} of ${summary.total} gallery configs (${pct(summary.works, summary.total)})`);
  lines.push(`statuses: ${Object.entries(summary.byStatus).map(([s, n]) => `${s} ${n}`).join(', ')}`);
  if (Object.keys(heads).length) lines.push(`measured on: ${Object.entries(heads).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  lines.push('');
  const width = Math.max(9, ...summary.dimensions.map((d) => d.dimension.length));
  lines.push(`${'dimension'.padEnd(width)}  works  total      %  not works`);
  for (const d of [...summary.dimensions].sort((a, b) => a.works / a.total - b.works / b.total || a.dimension.localeCompare(b.dimension))) {
    const rest = Object.entries(d.byStatus).filter(([s]) => s !== 'works').map(([s, n]) => `${s} ${n}`).join(', ');
    lines.push(`${d.dimension.padEnd(width)}  ${String(d.works).padStart(5)}  ${String(d.total).padStart(5)}  ${pct(d.works, d.total).padStart(6)}  ${rest || '-'}`);
    if (reasons) for (const [reason, n] of topReasons(status, d.dimension)) lines.push(`${' '.repeat(width)}    ${String(n).padStart(4)} x ${reason}`);
  }
  return lines.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf('--file');
  const file = fileIdx >= 0 ? path.resolve(args[fileIdx + 1] ?? '') : path.join(here, 'support-status.json');
  const status = JSON.parse(await readFile(file, 'utf8'));
  const summary = summarize(status);
  if (args.includes('--json')) console.log(JSON.stringify(summary, null, 2));
  else console.log(format(summary, status, { reasons: args.includes('--reasons') }));
}
