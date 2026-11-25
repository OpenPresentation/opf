import assert from 'node:assert/strict';
import {test} from 'node:test';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {gallery} from '@openpresentation/gallery';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {toPptx, fromPptx} from '../dist/index.js';
import {alignEntries, entryIdRecord, restoreEntryIds, validateEntryIdRecord} from '../dist/entry-ids.js';

// FR-02 (CR 6): the ids of list items, bullets, timeline events and table rows survive a PPTX round trip while their entries are still
// recognizable; a deck without them exports what it always did.

const deck = () => ({
  name: 'Ids',
  slides: [
    {id: 's1', title: 'Wins', blocks: [
      {id: 'wins', items: [{id: 'it-1', text: 'Signed the pilot'}, {id: 'it-2', text: 'Expanded to EMEA'}, 'Plain']},
      {id: 'regions', table: {columns: ['Region', 'Revenue'], rows: [{id: 'r-1', cells: ['EMEA', 8.2]}, ['APAC', 5.1], {id: 'r-3', cells: ['AMER', 12.4]}]}},
    ]},
    {id: 's2', title: 'Plan', timeline: [{id: 'e-1', when: 'Q1', what: 'Pilot'}, {id: 'e-2', when: 'Q2', what: 'Rollout'}]},
    {id: 's3', title: 'Points', bullets: [{id: 'b-1', text: 'One'}, {id: 'b-2', text: 'Two'}]},
  ],
});
const withoutIds = value => JSON.parse(JSON.stringify(value, (key, item) => (key === 'id' && typeof item === 'string' && /^(it|r|e|b)-\d$/.test(item) ? undefined : item)));

const exportDeck = async source => toPptx(source, {catalogs: [gallery], fonts: await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation: source})});
const importDeck = async (bytes, diagnostics = []) => fromPptx(bytes, {catalogs: [gallery], onDiagnostic: d => diagnostics.push(d)});
const editPart = (bytes, part, change) => {
  const parts = unzipSync(bytes), before = strFromU8(parts[part]), after = change(before);
  assert.notEqual(after, before, `${part} changed`);
  parts[part] = strToU8(after);
  return zipSync(parts);
};
const slideTags = bytes => Object.entries(unzipSync(bytes)).filter(([name]) => /^ppt\/tags\/opfSlide\d+\.xml$/.test(name)).map(([, data]) => {
  const hex = /val="([0-9A-Fa-f]+)"/.exec(strFromU8(data))[1];
  return JSON.parse(Buffer.from(hex, 'hex').toString('utf8'));
});

test('every id returns on items, bullets, events and rows', async () => {
  const diagnostics = [];
  const back = await importDeck(await exportDeck(deck()), diagnostics);
  assert.deepEqual(back.slides[0].blocks[0].items.map(entry => entry.id ?? null), ['it-1', 'it-2', null]);
  assert.deepEqual(back.slides[0].blocks[1].table.rows.map(row => (Array.isArray(row) ? null : row.id)), ['r-1', null, 'r-3']);
  assert.deepEqual(back.slides[1].timeline.map(event => event.id), ['e-1', 'e-2']);
  assert.deepEqual(back.slides[2].bullets.map(entry => entry.id), ['b-1', 'b-2']);
  assert.deepEqual(diagnostics.filter(d => d.code === 'entry-ids-not-restored'), []);
});

test('the ids are identity only: every part but the tags is the export without them', async () => {
  const plain = unzipSync(await exportDeck(withoutIds(deck())));
  const tagged = unzipSync(await exportDeck(deck()));
  const names = Object.keys(plain).filter(name => !name.startsWith('ppt/tags/'));
  assert.deepEqual(Object.keys(tagged).filter(name => !name.startsWith('ppt/tags/')), names);
  for (const name of names) {
    if (/^(ppt\/slides\/slide\d+\.xml|docProps\/.*|ppt\/presentation\.xml)$/.test(name)) continue;
    assert.deepEqual(tagged[name], plain[name], name);
  }
  // The slide XML differs only where a tag relationship id or custom data points at a record (none of the shapes move or change text).
  for (let n = 1; n <= 3; n += 1) assert.equal(strFromU8(tagged[`ppt/slides/slide${n}.xml`]), strFromU8(plain[`ppt/slides/slide${n}.xml`]), `slide ${n}`);
});

test('a deck without item ids stores no entry-id record', async () => {
  const records = slideTags(await exportDeck(withoutIds(deck())));
  assert.equal(records.length, 3);
  for (const record of records) assert.equal(record.entryIds, undefined);
  assert.equal(entryIdRecord({title: 'x', items: ['a', {text: 'b'}], table: {rows: [['a'], {cells: ['b']}]}, timeline: [{what: 'e'}]}), undefined);
});

test('a row object without an id exports exactly like the array row', async () => {
  const arrays = {name: 'T', slides: [{title: 'Table', table: {columns: ['A', 'B'], rows: [['x', 1], ['y', 2]]}}]};
  const objects = {name: 'T', slides: [{title: 'Table', table: {columns: ['A', 'B'], rows: [{cells: ['x', 1]}, {cells: ['y', 2]}]}}]};
  const a = unzipSync(await exportDeck(arrays)), b = unzipSync(await exportDeck(objects));
  assert.deepEqual(Object.keys(a), Object.keys(b));
  // The authored table is recorded as written (src/data-provenance.js), so only the tags can differ.
  for (const name of Object.keys(a).filter(name => !name.startsWith('ppt/tags/'))) assert.deepEqual(a[name], b[name], name);
});

test('text edited in PowerPoint keeps the entry and its id', async () => {
  const diagnostics = [];
  const edited = editPart(await exportDeck(deck()), 'ppt/slides/slide3.xml', xml => xml.replace('>Two<', '>Two, edited<'));
  const back = await importDeck(edited, diagnostics);
  assert.deepEqual(back.slides[2].bullets, [{id: 'b-1', text: 'One'}, {id: 'b-2', text: 'Two, edited'}]);
  assert.deepEqual(diagnostics.filter(d => d.code === 'entry-ids-not-restored'), []);
});

test('a row added in PowerPoint comes back without an id and the others keep theirs', async () => {
  const diagnostics = [];
  const edited = editPart(await exportDeck(deck()), 'ppt/slides/slide1.xml', xml => {
    const rows = xml.match(/<a:tr\b[\s\S]*?<\/a:tr>/g);
    assert.ok(rows && rows.length === 4, 'header and three rows');
    return xml.replace(rows[2], rows[2] + rows[2]);
  });
  const back = await importDeck(edited, diagnostics);
  const rows = back.slides[0].blocks[1].table.rows;
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map(row => (Array.isArray(row) ? null : row.id)), ['r-1', null, null, 'r-3']);
  assert.deepEqual(diagnostics.filter(d => d.code === 'entry-ids-not-restored'), [], 'a new row loses no id');
});

test('a row removed in PowerPoint drops its id and ONE finding says how many ids were not restored', async () => {
  const diagnostics = [];
  const edited = editPart(await exportDeck(deck()), 'ppt/slides/slide1.xml', xml => {
    const rows = xml.match(/<a:tr\b[\s\S]*?<\/a:tr>/g);
    return xml.replace(rows[3], '');
  });
  const back = await importDeck(edited, diagnostics);
  const rows = back.slides[0].blocks[1].table.rows;
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => (Array.isArray(row) ? null : row.id)), ['r-1', null]);
  const findings = diagnostics.filter(d => d.code === 'entry-ids-not-restored');
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /^1 /);
});

test('a slide whose objects moved restores no entry id, with one finding for the whole deck', async () => {
  const diagnostics = [];
  const moved = editPart(await exportDeck(deck()), 'ppt/slides/slide3.xml', xml => xml.replace(/<a:off x="(\d+)" y="(\d+)"\/>(<a:ext cx="\d+" cy="\d+"\/><\/a:xfrm><a:prstGeom prst="rect"><a:avLst><\/a:avLst><\/a:prstGeom><a:noFill\/><a:ln><\/a:ln><\/p:spPr><p:txBody><a:bodyPr wrap="none")/, (all, x, y, rest) => `<a:off x="${Number(x) + 91440}" y="${y}"/>${rest}`));
  const back = await importDeck(moved, diagnostics);
  assert.doesNotMatch(JSON.stringify(back.slides[2]), /b-1|b-2/);
  assert.deepEqual(back.slides[1].timeline.map(event => event.id), ['e-1', 'e-2'], 'other slides keep theirs');
  const findings = diagnostics.filter(d => d.code === 'entry-ids-not-restored');
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /^2 /);
});

test('an id another entry of the document already uses is not restored twice (a duplicated slide)', () => {
  const record = entryIdRecord({items: [{id: 'it-1', text: 'One'}, {id: 'it-2', text: 'Two'}]});
  const imported = {items: ['One', 'Two']};
  const taken = new Set(['it-1']);
  assert.equal(restoreEntryIds(imported, record, {changed: false, taken}), 1);
  assert.deepEqual(imported.items, ['One', {id: 'it-2', text: 'Two'}]);
  assert.ok(taken.has('it-2'));
  const second = {items: ['One', 'Two']};
  assert.equal(restoreEntryIds(second, record, {changed: false, taken}), 2, 'the copy of the slide gets none');
  assert.deepEqual(second.items, ['One', 'Two']);
});

test('the record is validated as untrusted input', () => {
  const good = [['', 'items', ['0123abcd', '4567ef01'], ['a', null]]];
  assert.equal(validateEntryIdRecord(good), good);
  for (const bad of [
    [], 'x', [['', 'items', ['0123abcd'], ['a', 'b']]], [['', 'cells', ['0123abcd'], ['a']]], [['x', 'items', ['0123abcd'], ['a']]],
    [['', 'items', ['nothex!!'], ['a']]], [['', 'items', ['0123abcd'], [null]]], [['', 'items', ['0123abcd', '0123abcd'], ['a', 'a']]], [['', 'items', ['0123abcd'], ['']]],
    [['', 'items', ['0123abcd'], ['a']], ['', 'items', ['0123abcd'], ['b']]],
  ]) assert.throws(() => validateEntryIdRecord(bad), undefined, JSON.stringify(bad));
});

test('alignment: equal entries anchor, an equal gap pairs by position, an unequal gap pairs nothing', () => {
  assert.deepEqual(alignEntries(['a', 'b', 'c'], ['a', 'b', 'c']), [0, 1, 2]);
  assert.deepEqual(alignEntries(['a', 'b', 'c'], ['a', 'x', 'c']), [0, 1, 2], 'edited in place');
  assert.deepEqual(alignEntries(['a', 'b', 'c'], ['a', 'c']), [0, 2], 'removed');
  assert.deepEqual(alignEntries(['a', 'b', 'c'], ['a', 'n', 'b', 'c']), [0, -1, 1, 2], 'added');
  assert.deepEqual(alignEntries(['a', 'b', 'c'], ['x', 'y', 'z', 'q']), [-1, -1, -1, -1], 'unrelated and a different count');
  assert.deepEqual(alignEntries(['a', 'b', 'c'], ['c', 'b', 'a']).filter(index => index >= 0).length, 1, 'a reorder keeps one anchor');
});

// A 0.36.0 importer reads a slide record it did not write: its validateSlide checks the keys it knows and has no allowlist for the others (the
// document record's supplement section is the one that throws on an unknown key, and entryIds is not in it), and its restore code only reads the
// keys it knows. So entryIds is ignored and everything else restores. This pins the placement that makes that true.
test('entryIds is a top-level key of the slide record, outside supplement and native, so a 0.36.0 importer ignores it', async () => {
  // The keys 0.36.0 wrote for the same slide without ids: the vocabulary an older importer knows.
  const [plain] = slideTags(await exportDeck({name: 'D', slides: [{id: 's', title: 'T', items: ['x', 'y']}]}));
  const known036 = new Set(Object.keys(plain));
  const [record] = slideTags(await exportDeck({name: 'D', slides: [{id: 's', title: 'T', items: [{id: 'a', text: 'x'}, 'y']}]}));
  assert.ok(record.entryIds, 'the record stores the ids');
  assert.equal(record.supplement?.metadata?.entryIds, undefined);
  assert.equal(record.native.entryIds, undefined);
  const extra = Object.keys(record).filter(key => !known036.has(key));
  assert.deepEqual(extra, ['entryIds'], 'entryIds is the only key a 0.36.0 importer has not seen');
});
