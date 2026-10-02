// Prints the release-readiness (RR) program's progress from burndown.md: counts by status, the open items and the
// work queue (what is being worked on now, by whom, what blocks it and the next action). Internal tracking only; it
// is never shown on a site.
//
//   node report.mjs                 counts by status, the open items and the work queue
//   node report.mjs --now           only the work queue, one block per open item
//   node report.mjs --live          like --now, plus the live state of every pull request the queue links
//                                   (asks GitHub through the `gh` CLI; the only mode that touches the network)
//   node report.mjs --json          the same numbers as JSON (with --live: plus the pull request states)
//   node report.mjs --file <path>   read another burndown (default: the one beside this script)
//
// The default and --json outputs also carry one line from the gallery tracker (gallery-tracker.json beside this script,
// built by `pnpm build:gallery-tracker`): records, addressed, and the unaddressed records by item type.
import { execFileSync } from 'node:child_process';
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

/**
 * Parses the optional Now table (`| ID | Owner | Working on | Blocked by | Next action |`), the work queue: one row per
 * open item that someone is working on. Returns [] when the table is absent. Throws on a malformed row.
 */
export function parseNow(markdown) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => /^\|\s*ID\s*\|\s*Owner\s*\|\s*Working on\s*\|\s*Blocked by\s*\|\s*Next action\s*\|/.test(l));
  if (start < 0) return [];
  const rows = [];
  const seen = new Set();
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith('|')) break;
    const c = cells(line);
    if (c.length !== 5) throw new Error(`burndown: Now table expects 5 columns, got ${c.length}: ${line.slice(0, 80)}`);
    const [id, owner, working, blocked, next] = c;
    if (!/^RR-\d{2}$/.test(id)) throw new Error(`burndown: Now table has bad item id "${id}"`);
    if (seen.has(id)) throw new Error(`burndown: Now table lists ${id} twice`);
    seen.add(id);
    rows.push({ id, owner, working, blocked, next });
  }
  return rows;
}

/** Pull request references (`owner/repo#N` links to github.com/.../pull/N) in a markdown cell, in order, deduplicated. */
export function pullRequests(text) {
  const out = [];
  for (const m of String(text).matchAll(/https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)/g)) {
    const ref = `${m[1]}#${m[2]}`;
    if (!out.includes(ref)) out.push(ref);
  }
  return out;
}

/** Counts items by status and joins the work queue. Pure, so it is unit-tested. */
export function summarize(items, now = []) {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const i of items) byStatus[i.status] += 1;
  const total = items.length;
  const closed = byStatus.done + byStatus.descoped;
  const ids = new Set(items.map((i) => i.id));
  for (const r of now) if (!ids.has(r.id)) throw new Error(`burndown: Now table lists unknown item ${r.id}`);
  const queue = new Map(now.map((r) => [r.id, r]));
  return {
    total,
    byStatus,
    closed,
    percent: total ? (100 * closed) / total : 0,
    open: items
      .filter((i) => OPEN.has(i.status))
      .map(({ id, item, status, depends }) => {
        const q = queue.get(id);
        return q ? { id, item, status, depends, owner: q.owner, working: q.working, blocked: q.blocked, next: q.next, pulls: pullRequests(`${q.working} ${q.blocked} ${q.next}`) } : { id, item, status, depends };
      }),
    // a closed item left in the work queue is a stale row
    stale: now.filter((r) => !items.some((i) => i.id === r.id && OPEN.has(i.status))).map((r) => r.id),
  };
}

/**
 * One line from the gallery tracker's summary (gallery-tracker.json, RR-41): total records, addressed, and the
 * unaddressed records by item type. Pure; throws on a summary that is not the tracker's shape.
 */
export function gallerySummary(tracker) {
  const s = tracker?.summary;
  if (!s || !Number.isInteger(s.records) || !Number.isInteger(s.addressed) || !s.byType) throw new Error('gallery tracker: summary missing or malformed');
  const types = Object.entries(s.byType);
  if (types.reduce((n, [, t]) => n + t.records, 0) !== s.records) throw new Error('gallery tracker: per-type records do not add up to the total');
  const unaddressed = types.filter(([, t]) => t.unaddressed > 0).map(([type, t]) => ({ type, count: t.unaddressed }));
  const done = s.byStatus?.done ?? 0;
  const line = `gallery tracker: ${s.records} records in ${types.length} item types (${done} done), ${s.addressed} addressed, ${s.records - s.addressed} unaddressed${unaddressed.length ? ` (${unaddressed.map((u) => `${u.type} ${u.count}`).join(', ')})` : ''}`;
  return { records: s.records, types: types.length, done, addressed: s.addressed, unaddressed: s.records - s.addressed, unaddressedByType: Object.fromEntries(unaddressed.map((u) => [u.type, u.count])), asOf: tracker.asOf ?? null, line };
}

const plain = (s) => String(s ?? '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}...` : s);

export function format(summary, { queueOnly = false, live = null, gallery = null } = {}) {
  const lines = [];
  if (!queueOnly) {
    lines.push(`release readiness: ${summary.closed} of ${summary.total} items closed (done or descoped, ${summary.percent.toFixed(1)}%)`);
    if (gallery) lines.push(gallery.line);
    lines.push(`statuses: ${STATUSES.map((s) => `${s} ${summary.byStatus[s]}`).join(', ')}`, '', 'open items:');
    for (const o of summary.open) lines.push(`  ${o.id}  ${o.status.padEnd(11)}  ${clip(plain(o.item), 96)}`);
    lines.push('');
  }
  const queued = summary.open.filter((o) => o.owner);
  lines.push(`work queue (${queued.length} of ${summary.open.length} open items have a Now row):`);
  for (const o of queued) {
    lines.push(`  ${o.id}  ${o.status}  owner: ${plain(o.owner)}  -  ${clip(plain(o.item), 80)}`);
    lines.push(`         working on: ${plain(o.working) || '-'}`);
    lines.push(`         blocked by: ${plain(o.blocked) || '-'}`);
    lines.push(`         next:       ${plain(o.next) || '-'}`);
    if (live) for (const pr of o.pulls) lines.push(`         ${pr}: ${live[pr] ?? 'unknown'}`);
  }
  const missing = summary.open.filter((o) => !o.owner).map((o) => o.id);
  if (missing.length) lines.push(`  open items without a Now row: ${missing.join(', ')}`);
  if (summary.stale.length) lines.push(`  stale Now rows (item closed): ${summary.stale.join(', ')}`);
  return lines.join('\n');
}

/** The live state of one pull request via the gh CLI: merged, closed, or open with its mergeable state and checks. */
function liveState(ref) {
  const [repo, n] = ref.split('#');
  const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try {
    const [state, merged, mergeable, sha] = gh(['api', `repos/${repo}/pulls/${n}`, '--jq', '[.state, (.merged|tostring), .mergeable_state, .head.sha]|join(" ")']).split(' ');
    if (merged === 'true') return 'merged';
    if (state !== 'open') return state;
    const checks = gh(['api', `repos/${repo}/commits/${sha}/check-runs?per_page=100`, '--jq', '[.check_runs[]|select(.name!="Cursor Bugbot")] as $c | "\\($c|map(select(.conclusion=="success" or .conclusion=="skipped"))|length) passed, \\($c|map(select(.status!="completed"))|length) running, \\($c|map(select(.conclusion=="failure" or .conclusion=="cancelled" or .conclusion=="timed_out"))|length) failed"']);
    return `open, ${mergeable}, checks: ${checks}`;
  } catch {
    return 'unknown (gh failed)';
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf('--file');
  const file = fileIdx >= 0 ? path.resolve(args[fileIdx + 1] ?? '') : path.join(here, 'burndown.md');
  const markdown = await readFile(file, 'utf8');
  const summary = summarize(parseBurndown(markdown), parseNow(markdown));
  let gallery = null;
  try {
    gallery = gallerySummary(JSON.parse(await readFile(path.join(here, 'gallery-tracker.json'), 'utf8')));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const wantLive = args.includes('--live');
  const live = wantLive ? Object.fromEntries(summary.open.flatMap((o) => o.pulls ?? []).map((pr) => [pr, liveState(pr)])) : null;
  if (args.includes('--json')) console.log(JSON.stringify({ ...summary, ...(gallery ? { gallery } : {}), ...(live ? { live } : {}) }, null, 2));
  else console.log(format(summary, { queueOnly: args.includes('--now') || wantLive, live, gallery }));
}
