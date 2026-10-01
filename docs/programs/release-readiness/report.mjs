// Prints the release-readiness (RR) program's progress from burndown.md: counts by status and the open items.
// Internal tracking only; it is never shown on a site.
//
//   node report.mjs                 counts by status and the open items
//   node report.mjs --json          the same numbers as JSON
//   node report.mjs --file <path>   read another burndown (default: the one beside this script)
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const STATUSES = ['todo', 'in-progress', 'review', 'done', 'descoped'];
const OPEN = new Set(['todo', 'in-progress', 'review']);

/** Splits a markdown table row into trimmed cells, ignoring pipes inside backticks. */
function cells(line) {
  const out = [];
  let cell = '';
  let code = false;
  for (const ch of line.trim().replace(/^\|/, '').replace(/\|$/, '')) {
    if (ch === '`') code = !code;
    if (ch === '|' && !code) {
      out.push(cell.trim());
      cell = '';
    } else cell += ch;
  }
  out.push(cell.trim());
  return out;
}

/** Parses the Items table (`| ID | Item | Repos | Depends | Status | Evidence |`). Throws on anything malformed. */
export function parseBurndown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => /^\|\s*ID\s*\|\s*Item\s*\|\s*Repos\s*\|\s*Depends\s*\|\s*Status\s*\|\s*Evidence\s*\|/.test(l));
  if (start < 0) throw new Error('burndown: Items table header not found');
  const items = [];
  const seen = new Set();
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith('|')) break;
    const c = cells(line);
    if (c.length !== 6) throw new Error(`burndown: expected 6 columns, got ${c.length}: ${line.slice(0, 80)}`);
    const [id, item, repos, depends, status, evidence] = c;
    if (!/^RR-\d{2}$/.test(id)) throw new Error(`burndown: bad item id "${id}"`);
    if (seen.has(id)) throw new Error(`burndown: duplicate item ${id}`);
    if (!STATUSES.includes(status)) throw new Error(`burndown: ${id} has unknown status "${status}" (allowed: ${STATUSES.join(', ')})`);
    seen.add(id);
    items.push({ id, item, repos, depends, status, evidence });
  }
  if (!items.length) throw new Error('burndown: no items found');
  return items;
}

/** Counts items by status. Pure, so it is unit-tested. */
export function summarize(items) {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const i of items) byStatus[i.status] += 1;
  const total = items.length;
  const closed = byStatus.done + byStatus.descoped;
  return {
    total,
    byStatus,
    closed,
    percent: total ? (100 * closed) / total : 0,
    open: items.filter((i) => OPEN.has(i.status)).map(({ id, item, status, depends }) => ({ id, item, status, depends })),
  };
}

export function format(summary) {
  const lines = [`release readiness: ${summary.closed} of ${summary.total} items closed (done or descoped, ${summary.percent.toFixed(1)}%)`];
  lines.push(`statuses: ${STATUSES.map((s) => `${s} ${summary.byStatus[s]}`).join(', ')}`, '', 'open items:');
  for (const o of summary.open) {
    const text = o.item.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    lines.push(`  ${o.id}  ${o.status.padEnd(11)}  ${text.length > 96 ? `${text.slice(0, 95)}...` : text}`);
  }
  return lines.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf('--file');
  const file = fileIdx >= 0 ? path.resolve(args[fileIdx + 1] ?? '') : path.join(here, 'burndown.md');
  const summary = summarize(parseBurndown(await readFile(file, 'utf8')));
  console.log(args.includes('--json') ? JSON.stringify(summary, null, 2) : format(summary));
}
