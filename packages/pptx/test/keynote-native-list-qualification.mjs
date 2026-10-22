import assert from 'node:assert/strict';
import {bodyDeck} from '../scripts/keynote-qualification/fixtures.mjs';
import {nativeBodyNoopListFindings} from '../scripts/keynote-qualification/pack.mjs';

const source = bodyDeck('data:image/png;base64,AA=='), items = source.slides[16].items;
const context = {fixture: 'body-17', mode: 'native', route: 'no-op'};
const document = content => ({slides: [{title: 'K17 Flat bullet body', ...content}]});
const list = {type: 'list', items: structuredClone(items)};
assert.deepEqual(nativeBodyNoopListFindings(document({blocks: [list]}), source, context), []);
assert.deepEqual(nativeBodyNoopListFindings(document({items}), source, context), [], 'Compact current semantic items are accepted');
assert.deepEqual(nativeBodyNoopListFindings(document({blocks: [{...list, items: [{text: items[0], level: 0}, [{text: 'Bold flat item', bold: true, fontSize: 24}], items[2]]}, {type: 'text', text: 'Keynote qualification'}]}), source, context), [], 'Run style changes and the separately reported footer gap do not flatten list semantics');

// Matches the real Keynote no-op import: all three words survive in one rich text block, but no semantic list does.
const flattened = document({blocks: [{type: 'text', text: [{text: 'KN_ORIGINAL_FLAT_LIST', fontSize: 24}, '\n', {text: 'Bold flat item', bold: true, fontSize: 24}, '\n', {text: 'Final flat item.', fontSize: 24}]}]});
assert.ok(nativeBodyNoopListFindings(flattened, source, context).some(value => value.includes('words in a text block are insufficient')));
assert.ok(nativeBodyNoopListFindings(document({}), source, context).length, 'Missing list fails');
assert.ok(nativeBodyNoopListFindings(document({blocks: [{type: 'text', items}]}), source, context).length, 'Items hidden on a text object do not count as list semantics');
for (const wrong of [items.slice(0, 2), [...items].reverse(), [items[0], {text: 'Bold flat item', level: 1}, items[2]], [items[0], {text: 'Bold flat item', description: 'extra description'}, items[2]], [items[0], items[1], 'Changed final words.']]) {
  assert.ok(nativeBodyNoopListFindings(document({blocks: [{type: 'list', items: wrong}]}), source, context).length, 'Missing, reordered, nested/mixed or changed current items fail');
}
assert.ok(nativeBodyNoopListFindings(document({blocks: [list, structuredClone(list)]}), source, context).length, 'Duplicated lists fail');
assert.ok(nativeBodyNoopListFindings(document({blocks: [{...list, numbering: 'decimal'}]}), source, context).length, 'A numbered list does not preserve the flat character-bullet control');
const cacheOnly = document({text: 'ordinary current text'}); cacheOnly.extensions = {source: {blocks: [list]}};
assert.ok(nativeBodyNoopListFindings(cacheOnly, source, context).length, 'Cached/provenance lists are not current slide payload');
const elsewhere = {slides: [{title: 'K17 Flat bullet body', text: 'ordinary current text'}, {title: 'K02 Different slide', blocks: [list]}]};
assert.ok(nativeBodyNoopListFindings(elsewhere, source, context).length, 'Another slide cannot satisfy K17');
for (const other of [{...context, mode: 'measured'}, {...context, fixture: 'baseline-16'}, {...context, route: 'content-edits'}, {...context, route: 'layout-structure'}, {}]) assert.deepEqual(nativeBodyNoopListFindings(flattened, source, other), [], 'Only explicit native body-17 no-op promises this semantic subset');
console.log('Native body qualification: K17 requires exactly three current semantic flat-list entries in order; missing/mixed/reordered/changed/duplicated lists, same-word flattened text and cached/other-slide lists fail. Measured/baseline/other routes remain outside this assertion.');
