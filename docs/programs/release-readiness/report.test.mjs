import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { format, gallerySummary, parseBurndown, parseNow, pullRequests, STATUSES, summarize } from './report.mjs';

const HEAD = '| ID | Item | Repos | Depends | Status | Evidence |\n| --- | --- | --- | --- | --- | --- |\n';
const NOW = '| ID | Owner | Working on | Blocked by | Next action |\n| --- | --- | --- | --- | --- |\n';

test('parses rows, counts statuses and lists open items', () => {
  const md = `intro\n\n${HEAD}| RR-01 | A \`x|y\` [l](u) | core | none | done | e |\n| RR-02 | B | core | RR-01 | todo | |\n| RR-03 | C | core | none | descoped | #1 |\n\nafter\n`;
  const items = parseBurndown(md);
  assert.equal(items.length, 3);
  assert.equal(items[0].item, 'A `x|y` [l](u)');
  const s = summarize(items);
  assert.deepEqual(s.byStatus, { todo: 1, 'in-progress': 0, review: 0, done: 1, descoped: 1 });
  assert.equal(s.closed, 2);
  assert.deepEqual(s.open.map((o) => o.id), ['RR-02']);
  assert.match(format(s), /2 of 3 items closed/);
});

test('rejects malformed tables', () => {
  assert.throws(() => parseBurndown('no table'), /header not found/);
  assert.throws(() => parseBurndown(`${HEAD}| RR-01 | A | core | none | finished | |\n`), /unknown status/);
  assert.throws(() => parseBurndown(`${HEAD}| RR-01 | A | core | none | done |\n`), /6 columns/);
  assert.throws(() => parseBurndown(`${HEAD}| X-1 | A | core | none | done | |\n`), /bad item id/);
  assert.throws(() => parseBurndown(`${HEAD}| RR-01 | A | core | none | done | |\n| RR-01 | A | core | none | done | |\n`), /duplicate/);
});

test('joins the Now work queue onto the open items and flags stale or missing rows', () => {
  const md =
    `${NOW}| RR-02 | agent: sites | adoption [b#1](https://github.com/a/b/pull/1) | [c#2](https://github.com/a/c/pull/2) | merge after the preview |\n` +
    `| RR-01 | supervisor | x | - | y |\n\n` +
    `${HEAD}| RR-01 | A | core | none | done | e |\n| RR-02 | B | core | RR-01 | in-progress | |\n| RR-03 | C | core | none | todo | |\n`;
  const now = parseNow(md);
  assert.deepEqual(now.map((r) => r.id), ['RR-02', 'RR-01']);
  const s = summarize(parseBurndown(md), now);
  const q = s.open.find((o) => o.id === 'RR-02');
  assert.equal(q.owner, 'agent: sites');
  assert.deepEqual(q.pulls, ['a/b#1', 'a/c#2']);
  assert.deepEqual(s.stale, ['RR-01']);
  const text = format(s, { live: { 'a/b#1': 'merged' } });
  assert.match(text, /work queue \(1 of 2 open items/);
  assert.match(text, /a\/b#1: merged/);
  assert.match(text, /a\/c#2: unknown/);
  assert.match(text, /without a Now row: RR-03/);
  assert.match(text, /stale Now rows \(item closed\): RR-01/);
});

test('the Now table is optional and validated', () => {
  assert.deepEqual(parseNow('no table'), []);
  assert.throws(() => parseNow(`${NOW}| RR-01 | a | b | c |\n`), /5 columns/);
  assert.throws(() => parseNow(`${NOW}| RR-01 | a | b | c | d |\n| RR-01 | a | b | c | d |\n`), /twice/);
  assert.throws(() => summarize(parseBurndown(`${HEAD}| RR-01 | A | core | none | done | |\n`), parseNow(`${NOW}| RR-09 | a | b | c | d |\n`)), /unknown item RR-09/);
  assert.deepEqual(pullRequests('see [x](https://github.com/o/r/pull/5), https://github.com/o/r/pull/5 and [i](https://github.com/o/r/issues/6)'), ['o/r#5']);
});

// Contiguous from RR-01 to the highest item, so adding the next item does not also edit this test.
test('the committed burndown parses and covers RR-01 to its highest item without gaps', async () => {
  const markdown = await readFile(fileURLToPath(new URL('./burndown.md', import.meta.url)), 'utf8');
  const items = parseBurndown(markdown);
  const last = Math.max(...items.map((i) => Number(i.id.slice(3))));
  assert.ok(last >= 53, `expected at least RR-53, found RR-${last}`);
  assert.deepEqual(items.map((i) => i.id).sort(), Array.from({ length: last }, (_, n) => `RR-${String(n + 1).padStart(2, '0')}`));
  for (const i of items) assert.ok(STATUSES.includes(i.status));
  for (const i of items) for (const dep of i.depends.match(/RR-\d{2}/g) ?? []) assert.ok(items.some((o) => o.id === dep), `${i.id} depends on unknown ${dep}`);
  // the work queue only names real items, and no closed item lingers in it
  const s = summarize(items, parseNow(markdown));
  assert.deepEqual(s.stale, []);
});

const TRACKER = (byType) => ({
  asOf: '2026-10-02',
  summary: {
    records: Object.values(byType).reduce((n, t) => n + t.records, 0),
    addressed: Object.values(byType).reduce((n, t) => n + t.addressed, 0),
    byStatus: { done: 2 },
    byType,
  },
});

test('the gallery tracker summary is one line with the unaddressed records by type', () => {
  const g = gallerySummary(TRACKER({ layouts: { records: 3, addressed: 1, unaddressed: 2 }, charts: { records: 2, addressed: 2, unaddressed: 0 }, fonts: { records: 1, addressed: 0, unaddressed: 1 } }));
  assert.equal(g.line, 'gallery tracker: 6 records in 3 item types (2 done), 3 addressed, 3 unaddressed (layouts 2, fonts 1)');
  assert.deepEqual(g.unaddressedByType, { layouts: 2, fonts: 1 });
  const all = gallerySummary(TRACKER({ layouts: { records: 3, addressed: 3, unaddressed: 0 } }));
  assert.equal(all.line, 'gallery tracker: 3 records in 1 item types (2 done), 3 addressed, 0 unaddressed');
  // the line sits under the headline, and only outside the queue-only modes
  const s = summarize(parseBurndown(`${HEAD}| RR-01 | A | core | none | done | e |\n`));
  assert.match(format(s, { gallery: g }).split('\n')[1], /^gallery tracker: 6 records/);
  assert.doesNotMatch(format(s, { queueOnly: true, gallery: g }), /gallery tracker/);
});

test('a malformed gallery tracker summary is rejected', () => {
  assert.throws(() => gallerySummary({}), /summary missing/);
  const bad = TRACKER({ layouts: { records: 3, addressed: 3, unaddressed: 0 } });
  bad.summary.records = 4;
  assert.throws(() => gallerySummary(bad), /do not add up/);
});

test('the committed gallery tracker summarizes', async () => {
  const tracker = JSON.parse(await readFile(fileURLToPath(new URL('./gallery-tracker.json', import.meta.url)), 'utf8'));
  const g = gallerySummary(tracker);
  assert.equal(g.records, tracker.records.length);
  assert.equal(g.addressed, tracker.records.filter((r) => r.addressed).length);
  // every RR item a gap links to exists in the burndown
  const ids = new Set(parseBurndown(await readFile(fileURLToPath(new URL('./burndown.md', import.meta.url)), 'utf8')).map((i) => i.id));
  for (const r of tracker.records) for (const gap of r.gaps) if (/^RR-/.test(gap.link ?? '')) assert.ok(ids.has(gap.link), `${r.type}/${r.id} links unknown ${gap.link}`);
});
