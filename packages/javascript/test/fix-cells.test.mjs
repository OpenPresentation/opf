// OPF 0.35 step 8: fix() migrates the 0.34 slide keys that placed content in the cells of a slide's grid. A slide without a layout gets
// blocks that name the cells. A slide that also has a layout (0.34 composed its cells and took only the layout's design, variant,
// composition and, for some records, rules that read its regions) loses the layout and keeps on its own design what the layout gave it,
// when it then composes exactly as before; otherwise it is left, with the reason, in FixResult.layoutWithCells. The drawing against
// the 0.34.2 engine itself is checked by packages/render/test/layout-cells-0342.mjs.
import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { applyPatch, fix, resolveSlideContext } from '../dist/index.js';
import { composeSlide } from '../dist/composition.js';

const catalogs = [gallery];
const chart = { type: 'column', data: { columns: ['Quarter', 'Revenue'], rows: [['Q1', 12], ['Q2', 15], ['Q3', 19], ['Q4', 24]] } };
const deck = (...slides) => ({ name: 'Quarterly review', language: 'en-US', slides });
const applied = (result) => result.applied.map((entry) => `${entry.round} ${entry.path} ${entry.fix}`);
const strip = (composition) => { const { sources: _s, paths: _p, ...design } = composition.design ?? {}; return { ...composition, design }; };

describe('fix: cells', () => {
  test('a slide in cells without a layout: one block per key in reading order of the cells, each payload as written', () => {
    const input = deck({ id: 'snapshot', title: 'Operating snapshot', 'center+end': { id: 'trend', chart }, start: { text: 'Revenue grew.' } });
    const result = fix(input, { catalogs });
    assert.equal(result.stopped, 'stable');
    assert.deepEqual(applied(result), ['1 /slides/0/center+end cells-to-blocks']);
    assert.deepEqual(result.document.slides[0], { id: 'snapshot', title: 'Operating snapshot', blocks: [{ region: 'start', text: 'Revenue grew.' }, { id: 'trend', region: 'center+end', chart }] });
    assert.deepEqual(result.layoutWithCells, []);
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

  test('beside a layout: the layout goes, what it gave the slide stays on its design, and the slide composes as the 0.34 slide did', () => {
    const input = deck(
      { title: 'Revenue by quarter', layout: 'chart', start: { text: 'Every quarter beat the one before.' }, 'center+end': { chart } },
      { title: 'What changed', layout: 'section', top: { text: 'Three things changed this year.' }, bottom: { items: ['Pricing moved to seats', 'Two new regions'] } },
      { title: 'Unresolved', layout: 'custom:missing', top: { text: 'A layout that resolves nowhere gave nothing.' } },
    );
    const result = fix(input, { catalogs });
    assert.equal(result.stopped, 'stable');
    assert.deepEqual(result.layoutWithCells, [
      { slide: 0, layout: 'chart', rewritten: true },
      { slide: 1, layout: 'section', rewritten: true, kept: ['design.titleAlignment', 'design.contentAlignment', 'design.variant'] },
      { slide: 2, layout: 'custom:missing', rewritten: true },
    ]);
    assert.deepEqual(result.document.slides[1].design, { titleAlignment: 'start', contentAlignment: 'start', variant: 'accent1' });
    for (const index of [0, 1, 2]) assert.equal(result.document.slides[index].layout, undefined);
    // On this engine: the fixed slide composes as its cells composed beside the layout record (0.34's way), on the same colors.
    for (const index of [0, 1]) {
      const before = resolveSlideContext(input, index, { catalogs });
      const old = { ...before.slide, blocks: result.document.slides[index].blocks };
      for (const key of ['layout', 'start', 'center+end', 'top', 'bottom']) delete old[key];
      const after = resolveSlideContext(result.document, index, { catalogs });
      assert.deepEqual(strip(composeSlide(after.slide, after.options)), strip(composeSlide(old, { ...before.options, [Symbol.for('opf.cellsBesideLayout')]: true })));
      assert.deepEqual(after.resolved.roles, before.resolved.roles);
    }
  });

  test('beside a layout whose regions shaped the cells: left, with both fixes for a person and the reason', () => {
    const input = deck({ title: 'In their words', layout: 'quote', start: { text: 'Support answered within the hour.' }, 'center+end': { chart } });
    const result = fix(input, { catalogs });
    assert.deepEqual(result.applied, []);
    assert.equal(result.stopped, 'stable');
    assert.equal(result.layoutWithCells.length, 1);
    const [left] = result.layoutWithCells;
    assert.deepEqual({ slide: left.slide, layout: left.layout, rewritten: left.rewritten }, { slide: 0, layout: 'quote', rewritten: false });
    assert.match(left.reason, /^the layout record's regions also shaped how its cells drew/);
    const finding = result.findings.find((entry) => entry.path === '/slides/0/start');
    assert.deepEqual(finding.fixes.map((entry) => [entry.id, entry.safe]), [['cells-to-blocks', false], ['cells-to-layout-blocks', false]]);
    assert.match(finding.help, /The fix that removes layout is not marked safe: the layout record's regions/);
    // The fix that keeps the layout moves the content into blocks without region (they bind to the layout's regions).
    const kept = applyPatch(input, finding.fixes[1].patch);
    assert.deepEqual(kept.slides[0], { title: 'In their words', layout: 'quote', blocks: [{ text: 'Support answered within the hour.' }, { chart }] });
  });

  test('a centered layout whose alignment a slide cannot say is left; with the deck setting the alignment it is rewritten', () => {
    const slide = { title: 'Pilot results', layout: 'metrics', 'top:start': { metric: { value: 24, label: 'teams' } }, 'top:end': { metric: { value: '98%', label: 'retention' } }, bottom: { text: 'Both measures beat the plan.' } };
    const plain = fix(deck(slide), { catalogs });
    assert.equal(plain.layoutWithCells[0].rewritten, false);
    assert.match(plain.layoutWithCells[0].reason, /^the layout's contentAlignment drew differently from the same key on the slide/);
    const aligned = fix({ ...deck(slide), design: { contentAlignment: 'start' } }, { catalogs });
    assert.deepEqual(aligned.layoutWithCells, [{ slide: 0, layout: 'metrics', rewritten: true }]);
  });

  test('a custom layout: its design and composition keys the slide does not set are kept', () => {
    const input = {
      ...deck({ title: 'Plan', layout: 'custom:plain', composition: { minFontSize: 18 }, top: { items: ['Hire', 'Build'] }, bottom: { text: 'Then ship.' } }),
      catalogs: { custom: { layouts: { plain: { name: 'Plain', design: { listBullet: 'none' }, composition: { minFontSize: 16, maxFontSize: 40 }, regions: [{ name: 'title' }, { name: 'body', accepts: ['text', 'items'] }] } } } },
    };
    const result = fix(input, { catalogs });
    assert.deepEqual(result.layoutWithCells, [{ slide: 0, layout: 'custom:plain', rewritten: true, kept: ['design.listBullet', 'composition.maxFontSize'] }]);
    assert.deepEqual(result.document.slides[0].design, { listBullet: 'none' });
    assert.deepEqual(result.document.slides[0].composition, { minFontSize: 18, maxFontSize: 40 });
  });
});
