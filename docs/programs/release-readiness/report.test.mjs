import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { format, parseBurndown, STATUSES, summarize } from './report.mjs';

const HEAD = '| ID | Item | Repos | Depends | Status | Evidence |\n| --- | --- | --- | --- | --- | --- |\n';

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

test('the committed burndown parses and covers RR-01 to RR-39', async () => {
  const items = parseBurndown(await readFile(fileURLToPath(new URL('./burndown.md', import.meta.url)), 'utf8'));
  assert.deepEqual(items.map((i) => i.id).sort(), Array.from({ length: 39 }, (_, n) => `RR-${String(n + 1).padStart(2, '0')}`));
  for (const i of items) assert.ok(STATUSES.includes(i.status));
  for (const i of items) for (const dep of i.depends.match(/RR-\d{2}/g) ?? []) assert.ok(items.some((o) => o.id === dep), `${i.id} depends on unknown ${dep}`);
});
