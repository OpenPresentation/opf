// OPF 0.35 step 8: fix() migrates the 0.34 slide keys that placed content in the cells of a slide's grid. A slide without a layout gets
// blocks that name the cells (cells-to-blocks). A slide that also has a layout keeps it: each cell key's content moves into a block
// without region, which binds to the layout's regions by kind (cells-to-layout-blocks, safe and marked changesDrawing: the 0.35 engine
// draws the slide on its layout).
import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { fix, validate } from '../dist/index.js';

const catalogs = [gallery];
const chart = { type: 'column', data: { columns: ['Quarter', 'Revenue'], rows: [['Q1', 12], ['Q2', 15], ['Q3', 19], ['Q4', 24]] } };
const deck = (...slides) => ({ name: 'Quarterly review', language: 'en-US', slides });
const applied = (result) => result.applied.map((entry) => `${entry.round} ${entry.path} ${entry.fix}${entry.changesDrawing ? ' (changes the drawing)' : ''}`);

describe('fix: cells', () => {
  test('legacy auto keeps both grid pins unless a catalog supplies an actual layout named auto', () => {
    const input = deck({layout: 'auto', 'top:start': {text: 'First'}, 'bottom:end': {text: 'Last'}});
    const automatic = fix(input, {catalogs}).document.slides[0];
    assert.deepEqual(automatic, {blocks: [{region: 'top:start', text: 'First'}, {region: 'bottom:end', text: 'Last'}]});
    const registered = {...gallery, layouts: {...gallery.layouts, auto: gallery.layouts.text}};
    const named = fix(input, {catalogs: [registered]}).document.slides[0];
    assert.deepEqual(named, {layout: 'auto', blocks: [{text: 'First'}, {text: 'Last'}]});
  });

  test('an embedded layout "auto" that fails its schema is the removed layout for the cell repair too: the pins stay', () => {
    // The validator offers remove-layout-auto for it (the record is embedded but invalid); the cell repair must not keep the layout and
    // drop the cells, or the two fixes together lose the positions.
    const input = {...deck({layout: 'auto', 'top:start': {text: 'First'}, 'bottom:end': {text: 'Last'}}), catalogs: {custom: {layouts: {auto: {name: 'Auto', regions: 'not regions'}}}}};
    const findings = validate(input, {catalogs}).findings;
    assert.ok(findings.some((item) => item.fixes?.some((entry) => entry.id === 'remove-layout-auto')), JSON.stringify(findings.map((item) => item.ruleId)));
    const slide = fix(input, {catalogs}).document.slides[0];
    assert.deepEqual(slide.blocks, [{region: 'top:start', text: 'First'}, {region: 'bottom:end', text: 'Last'}]);
    assert.equal(slide.layout, undefined);
  });

  test('a slide in cells without a layout: one block per key in reading order of the cells, each payload as written', () => {
    const input = deck({ id: 'snapshot', title: 'Operating snapshot', 'center+end': { id: 'trend', chart }, start: { text: 'Revenue grew.' } });
    const result = fix(input, { catalogs });
    assert.equal(result.stopped, 'stable');
    assert.deepEqual(applied(result), ['1 /slides/0/center+end cells-to-blocks']);
    assert.deepEqual(result.document.slides[0], { id: 'snapshot', title: 'Operating snapshot', blocks: [{ region: 'start', text: 'Revenue grew.' }, { id: 'trend', region: 'center+end', chart }] });
    assert.equal('layoutWithCells' in result, false);
    assert.deepEqual(result.findings.filter((finding) => finding.severity === 'error'), []);
  });

  test('with the other 0.35 fixes: the cells in the first round, a 0.34 region pin (reported once the schema is clean) in the second', () => {
    const input = deck(
      { title: 'Operating snapshot', start: { text: 'Revenue grew.' }, 'center+end': { chart } },
      { title: 'Start with a focused pilot', layout: 'metrics', blocks: [{ text: 'Learn what works before scaling.', region: 'note' }, { metric: { value: 24, label: 'teams in the pilot' }, region: 'metrics' }] },
    );
    const result = fix(input, { catalogs });
    assert.deepEqual(applied(result), ['1 /slides/0/start cells-to-blocks', '2 /slides/1/blocks/0/region rename-region', '2 /slides/1/blocks/1/region rename-region']);
    assert.equal(result.rounds, 2);
    assert.equal(result.stopped, 'stable');
    const once = fix(input, { catalogs, maxRounds: 1 });
    assert.equal(once.stopped, 'max-rounds');
    assert.deepEqual(applied(once), ['1 /slides/0/start cells-to-blocks']);
  });

  test('beside a layout: one safe fix keeps the layout and moves the content into blocks that bind to its regions by kind', () => {
    const input = deck(
      { title: 'Revenue by quarter', layout: 'chart', start: { text: 'Every quarter beat the one before.' }, 'center+end': { chart } },
      { title: 'What changed', layout: 'section', top: { text: 'Three things changed this year.' }, bottom: { items: ['Pricing moved to seats', 'Two new regions'] } },
      { title: 'In their words', layout: 'quote', start: { text: 'Support answered within the hour.' }, 'center+end': { chart } },
    );
    const finding = validate(input, { catalogs }).findings.find((entry) => entry.path === '/slides/2/start');
    assert.deepEqual(finding.fixes.map((entry) => [entry.id, entry.safe, entry.changesDrawing]), [['cells-to-layout-blocks', true, true]]);
    assert.match(finding.help, /This slide also has a layout, and a cell word names no region of a layout: the fix keeps the layout/);
    const result = fix(input, { catalogs });
    assert.equal(result.stopped, 'stable');
    assert.deepEqual(applied(result), ['1 /slides/0/start cells-to-layout-blocks (changes the drawing)', '1 /slides/1/top cells-to-layout-blocks (changes the drawing)', '1 /slides/2/start cells-to-layout-blocks (changes the drawing)']);
    assert.deepEqual(result.document.slides, [
      { title: 'Revenue by quarter', layout: 'chart', blocks: [{ text: 'Every quarter beat the one before.' }, { chart }] },
      { title: 'What changed', layout: 'section', blocks: [{ text: 'Three things changed this year.' }, { items: ['Pricing moved to seats', 'Two new regions'] }] },
      { title: 'In their words', layout: 'quote', blocks: [{ text: 'Support answered within the hour.' }, { chart }] },
    ]);
    assert.deepEqual(result.findings.filter((entry) => entry.severity === 'error'), []);
  });

  test('a slide that names an unresolved layout keeps it too: the reference keeps its own finding', () => {
    const input = deck({ title: 'Unresolved', layout: 'custom:missing', top: { text: 'A layout that resolves nowhere.' } });
    const result = fix(input, { catalogs });
    assert.deepEqual(applied(result), ['1 /slides/0/top cells-to-layout-blocks (changes the drawing)']);
    assert.deepEqual(result.document.slides[0], { title: 'Unresolved', layout: 'custom:missing', blocks: [{ text: 'A layout that resolves nowhere.' }] });
    assert.deepEqual(result.findings.filter((entry) => entry.path === '/slides/0/layout').map((entry) => entry.ruleId), ['opf/undeclared-catalog']);
  });
});
