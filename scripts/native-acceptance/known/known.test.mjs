// NT-03: the known-differences data validates, its ids and references are well formed, and the skill table is generated from it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadKnown, markedText, renderSkillTable, replaceMarkedText, SKILL_FILE, validateKnown } from './known.mjs';

const known = loadKnown('keynote');
const { records } = known;

test('keynote.json validates against known.schema.json', () => {
  assert.deepEqual(validateKnown(known), []);
  assert.equal(known.target, 'keynote');
});

test('ids are unique and stable in form; findings are not recorded twice', () => {
  const ids = records.map((record) => record.id);
  for (const id of ids) assert.match(id, /^kn-[a-z0-9-]+$/);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  const findings = records.flatMap((record) => (record.finding ? [record.finding] : []));
  assert.equal(new Set(findings).size, findings.length, 'one record per finding');
});

test('every place names a deck and a positive slide; only a scoped or unlocated record has none', () => {
  for (const record of records) {
    for (const place of record.where) {
      assert.ok(typeof place.deck === 'string' && place.deck.length > 0, `${record.id}: deck`);
      assert.ok(Number.isInteger(place.slide) && place.slide > 0, `${record.id}: slide ${place.slide}`);
    }
    if (record.where.length === 0) assert.ok(record.scope || record.located === false, `${record.id}: where is empty without scope or located: false`);
    if (record.located === false) assert.equal(record.where.length, 0, `${record.id}: located: false lists no place`);
  }
});

test('every issue is an OPF issue reference', () => {
  for (const record of records) if (record.issue !== null) assert.match(record.issue, /^OpenPresentation\/opf#[1-9]\d*$/, record.id);
});

test('the schema refuses a record without a place, scope or located: false', () => {
  const broken = structuredClone(known);
  broken.records[0].where = [];
  assert.notDeepEqual(validateKnown(broken), []);
  broken.records[0].located = false;
  assert.deepEqual(validateKnown(broken), []);
  broken.records[0].where = [{ deck: 'x', slide: 1 }];
  assert.notDeepEqual(validateKnown(broken), [], 'located: false with a place');
  broken.records[0].where = [{ deck: 'x', slide: 0 }];
  delete broken.records[0].located;
  assert.notDeepEqual(validateKnown(broken), [], 'slide 0');
});

test('the table between the markers in skills/opf-export/SKILL.md is generated from the records', () => {
  const generated = renderSkillTable(records);
  assert.equal(markedText(readFileSync(SKILL_FILE, 'utf8'), 'keynote'), generated, 'run pnpm build:native-known');
  const rows = generated.split('\n').filter((line) => line.startsWith('| ') && !line.startsWith('| What') && !line.startsWith('| ---'));
  assert.equal(rows.length, records.filter((record) => record.skill).length);
  assert.match(generated, /^These rows were seen in Keynote [\d. and,]+, opening the PPTX export of OPF /);
});

test('replaceMarkedText rewrites only the text between the markers', () => {
  const text = 'before\n<!-- native-known:keynote:start -->\nold\n<!-- native-known:keynote:end -->\nafter\n';
  const next = replaceMarkedText(text, 'new');
  assert.equal(next, 'before\n<!-- native-known:keynote:start -->\nnew\n<!-- native-known:keynote:end -->\nafter\n');
  assert.equal(markedText(next), 'new');
  assert.throws(() => replaceMarkedText('no markers', 'new'));
});
