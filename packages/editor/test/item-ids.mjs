// FR-02 (CR 6): ids on list items, bullets, timeline events and table rows survive the editor's edits. The rules: edit, move and reorder keep
// an id; a copy inside the document gets a new one; paste from another document keeps a free id and replaces a taken one; a slide split keeps
// each id on the part that holds it and a merge keeps the first slide's id.
import assert from 'node:assert/strict';
import {gallery} from '@openpresentation/gallery';
import {validate} from '@openpresentation/opf';
import {createEditorSession} from '../dist/index.js';
import {prepareDeleteRows, prepareGridCells, prepareInsertRows, prepareMoveRows, prepareSortRows} from '../dist/grid-model.js';
import {describeTableCell, parseTableCellPath, prepareTableMerge} from '../dist/table-options.js';
import {prepareMoveOutlineItem, prepareShiftOutlineItem, prepareRemoveOutlineItem, readOutline} from '../dist/outline.js';
import {prepareDuplicateSlides} from '../dist/slides.js';
import {prepareBlockDuplicate} from '../dist/blocks.js';
import {prepareOpfImport} from '../dist/transfer.js';
import {prepareSplitSlide, prepareMergeSlides} from '../dist/content-actions.js';
import {findMatches, replaceAll} from '../dist/find-replace.js';

const catalogs = [gallery];
const deck = () => ({
  name: 'Ids',
  slides: [
    {id: 'one', title: 'One', blocks: [
      {id: 'wins', items: [{id: 'it-1', text: 'Signed the pilot'}, {id: 'it-2', text: 'Expanded to EMEA'}, {id: 'it-3', text: 'Hired a lead'}]},
      {id: 'regions', table: {columns: ['Region', 'Revenue'], rows: [{id: 'r-1', cells: ['EMEA', 8.2]}, {id: 'r-2', cells: ['APAC', 5.1]}, {id: 'r-3', cells: ['AMER', 12.4]}]}},
      {id: 'plan', timeline: [{id: 'e-1', when: 'Q1', what: 'Pilot'}, {id: 'e-2', when: 'Q2', what: 'Rollout'}]},
    ]},
    {id: 'two', title: 'Two', bullets: [{id: 'b-1', text: 'One'}, {id: 'b-2', text: 'Two'}]},
  ],
});
const rowIds = (presentation, block = 1) => presentation.slides[0].blocks[block].table.rows.map((row) => (Array.isArray(row) ? null : row.id ?? null));
const allIds = (value, out = []) => {
  if (Array.isArray(value)) value.forEach((child) => allIds(child, out));
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) { if (key === 'id' && typeof child === 'string') out.push(child); else allIds(child, out); }
  return out;
};
const valid = (presentation) => assert.deepEqual(validate(presentation, {catalogs}).findings.filter((finding) => finding.severity === 'error'), []);

// Edit: a cell's value and an item's text keep the id.
{
  const editor = createEditorSession(deck(), {catalogs});
  editor.set('slides.0.blocks.1.table.rows.1.cells.1', 99);
  editor.set('slides.0.blocks.0.items.1.text', 'Expanded to EMEA and APAC');
  editor.set('slides.0.blocks.2.timeline.0.what', 'Pilot, done');
  assert.deepEqual(rowIds(editor.presentation), ['r-1', 'r-2', 'r-3']);
  assert.equal(editor.presentation.slides[0].blocks[0].items[1].id, 'it-2');
  assert.equal(editor.presentation.slides[0].blocks[2].timeline[0].id, 'e-1');
  valid(editor.presentation);
  editor.undo(); editor.undo(); editor.undo();
  assert.deepEqual(editor.presentation, deck());
}

// The grid edits rows that carry ids: edit, move, sort and delete keep the ids of the rows that remain; an inserted row has none.
{
  const path = 'slides.0.blocks.1.table';
  const edited = prepareGridCells(deck(), path, [{section: 'body', row: 1, column: 1, value: '7'}]);
  assert.deepEqual(rowIds(edited.presentation), ['r-1', 'r-2', 'r-3']);
  assert.deepEqual(edited.presentation.slides[0].blocks[1].table.rows[1], {id: 'r-2', cells: ['APAC', '7']});
  const moved = prepareMoveRows(deck(), path, 0, 2);
  assert.deepEqual([...rowIds(moved.presentation)].sort(), ['r-1', 'r-2', 'r-3']);
  assert.notDeepEqual(rowIds(moved.presentation), ['r-1', 'r-2', 'r-3'], 'the order changed');
  assert.deepEqual(moved.presentation.slides[0].blocks[1].table.rows.map((row) => row.cells[0]).sort(), ['AMER', 'APAC', 'EMEA']);
  const sorted = prepareSortRows(deck(), path, 0);
  assert.deepEqual(sorted.presentation.slides[0].blocks[1].table.rows.map((row) => [row.id, row.cells[0]]), [['r-3', 'AMER'], ['r-2', 'APAC'], ['r-1', 'EMEA']]);
  const removed = prepareDeleteRows(deck(), path, [1]);
  assert.deepEqual(rowIds(removed.presentation), ['r-1', 'r-3']);
  const inserted = prepareInsertRows(deck(), path, 1);
  assert.deepEqual(rowIds(inserted.presentation), ['r-1', null, 'r-2', 'r-3']);
  for (const result of [edited, moved, sorted, removed, inserted]) valid(result.presentation);
}

// Cell styles and merges work through a row object (the path of a cell inside it names `cells`).
{
  assert.deepEqual(parseTableCellPath('slides.0.blocks.1.table.rows.1.cells.1'), {tablePath: 'slides.0.blocks.1.table', cell: {section: 'body', row: 1, column: 1}});
  assert.deepEqual(parseTableCellPath('slides.0.blocks.1.table.rows.1.1'), {tablePath: 'slides.0.blocks.1.table', cell: {section: 'body', row: 1, column: 1}});
  assert.equal(describeTableCell(deck().slides[0].blocks[1].table, {section: 'body', row: 1, column: 0}).value, 'APAC');
  const merged = prepareTableMerge(deck(), 'slides.0.blocks.1.table', {section: 'body', row: 0, column: 0}, {colSpan: 2}, {join: true});
  assert.deepEqual(rowIds(merged.presentation), ['r-1', 'r-2', 'r-3']);
  assert.equal(merged.presentation.slides[0].blocks[1].table.rows[0].cells[0].colSpan, 2);
}

// Find and replace reaches the cells of a row object and keeps its id.
{
  const found = findMatches(deck(), 'APAC');
  assert.equal(found.matches.length, 1);
  assert.ok(JSON.stringify(found.matches).includes('rows.1.cells.0'), 'the cell of the row object is searched');
  const editor = createEditorSession(deck(), {catalogs});
  const result = replaceAll(editor, 'APAC', 'ASIA');
  assert.equal(result.count, 1);
  assert.equal(editor.presentation.slides[0].blocks[1].table.rows[1].cells[0], 'ASIA');
  assert.equal(editor.presentation.slides[0].blocks[1].table.rows[1].id, 'r-2');
}

// Move and reorder in the outline keep the item ids; nesting and removal keep the others.
{
  const rows = readOutline(deck()).rows.filter((row) => row.kind === 'item' && row.listPath === 'slides.0.blocks.0.items');
  assert.equal(rows.length, 3);
  const moved = prepareMoveOutlineItem(deck(), rows[0], 1);
  assert.deepEqual(moved.presentation.slides[0].blocks[0].items.map((item) => item.id), ['it-2', 'it-1', 'it-3']);
  const nested = prepareShiftOutlineItem(deck(), rows[1], 1);
  assert.deepEqual(nested.presentation.slides[0].blocks[0].items[1], {id: 'it-2', text: 'Expanded to EMEA', level: 1});
  const removed = prepareRemoveOutlineItem(deck(), rows[1]);
  assert.deepEqual(removed.presentation.slides[0].blocks[0].items.map((item) => item.id), ['it-1', 'it-3']);
  for (const result of [moved, nested, removed]) valid(result.presentation);
}

// A copy inside the document gets new ids, in the one document-wide namespace.
{
  const duplicated = prepareDuplicateSlides(deck(), [0]);
  const ids = allIds(duplicated.presentation);
  assert.equal(new Set(ids).size, ids.length, 'every id is unique');
  assert.deepEqual(duplicated.presentation.slides[0], deck().slides[0], 'the original keeps its ids');
  assert.deepEqual(rowIds({slides: [duplicated.presentation.slides[1]]}), ['r-1-2', 'r-2-2', 'r-3-2']);
  valid(duplicated.presentation);
  const block = prepareBlockDuplicate(deck(), 'slides.0.blocks.1');
  const copy = block.presentation.slides[0].blocks[2].table.rows.map((row) => row.id);
  assert.deepEqual(copy, ['r-1-2', 'r-2-2', 'r-3-2']);
  assert.deepEqual(rowIds(block.presentation), ['r-1', 'r-2', 'r-3']);
  valid(block.presentation);
}

// Paste from another document: an id that is free stays, one that is taken is replaced.
{
  const target = deck();
  const incoming = {name: 'Other', slides: [{id: 'pasted', title: 'Pasted', items: [{id: 'it-1', text: 'taken'}, {id: 'fresh', text: 'free'}], table: {rows: [{id: 'r-9', cells: ['x']}, {id: 'r-1', cells: ['y']}]}}]};
  const result = prepareOpfImport(target, {presentation: incoming}, {mode: 'insert', slideIndex: 0, catalogs});
  const pasted = result.presentation.slides[result.slideIndex];
  assert.deepEqual(pasted.items.map((item) => item.id), ['it-1-2', 'fresh']);
  assert.deepEqual(pasted.table.rows.map((row) => row.id), ['r-9', 'r-1-2']);
  const ids = allIds(result.presentation);
  assert.equal(new Set(ids).size, ids.length);
  valid(result.presentation);
  // A block pasted over a selection: its free ids stay, a taken one is replaced, and ids of what it replaces are free again.
  const block = {id: 'plan', timeline: [{id: 'e-1', when: 'Q9', what: 'Replaced'}, {id: 'it-1', what: 'Clash'}]};
  const selected = prepareOpfImport(deck(), {value: block}, {mode: 'selection', path: 'slides.0.blocks.2'});
  assert.deepEqual(selected.presentation.slides[0].blocks[2].timeline.map((event) => event.id), ['e-1', 'it-1-2']);
  valid(selected.presentation);
}

// Split a slide: every id stays on the part that holds it, the first part keeps the slide id; merge keeps the first slide's id.
{
  const split = prepareSplitSlide(deck(), 0, {each: true});
  const parts = split.presentation.slides.slice(0, 3);
  assert.deepEqual(parts.map((slide) => slide.id), ['one', 'one--2', 'one--3']);
  assert.deepEqual(parts[0].blocks[0].items.map((item) => item.id), ['it-1', 'it-2', 'it-3']);
  assert.deepEqual(parts[1].blocks[0].table.rows.map((row) => row.id), ['r-1', 'r-2', 'r-3']);
  assert.deepEqual(parts[2].blocks[0].timeline.map((event) => event.id), ['e-1', 'e-2']);
  const rejoined = prepareMergeSlides(split.presentation, 0, 3);
  assert.equal(rejoined.presentation.slides[0].id, 'one');
  assert.deepEqual(allIds(rejoined.presentation.slides[0]).sort(), allIds(deck().slides[0]).sort().filter((id) => id !== 'one').concat('one').sort());
  valid(split.presentation);
  valid(rejoined.presentation);
}

// assignIds as one undoable edit, with entries on request.
{
  const editor = createEditorSession({name: 'D', slides: [{title: 'T', items: ['a', 'b'], table: {rows: [['x']]}}]}, {catalogs});
  const before = JSON.stringify(editor.presentation);
  const plain = editor.assignIds({});
  assert.deepEqual(editor.presentation.slides[0].items, ['a', 'b'], 'strings stay strings by default');
  assert.ok(plain === null || plain.changed !== false);
  editor.undo?.();
  const change = editor.assignIds({items: true});
  assert.deepEqual(editor.presentation.slides[0].items, [{id: 'item-1', text: 'a'}, {id: 'item-2', text: 'b'}]);
  assert.deepEqual(editor.presentation.slides[0].table.rows, [{id: 'row-1', cells: ['x']}]);
  assert.ok(change);
  editor.undo();
  assert.equal(JSON.stringify(editor.presentation).includes('item-1'), false);
  assert.ok(before.length > 0);
}
console.log('item-ids ok');
