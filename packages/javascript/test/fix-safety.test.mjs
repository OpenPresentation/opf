// OPF 0.35: what fix() promises. By default it applies only the fixes of the checks that repair the document (an audit's fix, such as a
// language tag's case, needs `audits`); it never recolors text (use-readable-color is not safe); every fix applied says whether it can
// change how a slide draws; a removed design key never leaves an empty `design`; and a fix that is not a patch is never applied nor
// counted. The drawing marks follow 0.34.2-against-0.35 compositions (the PR's evidence); this file pins the marks themselves.
import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { FIX_REPAIR_CATEGORIES, embed, fix, isSafePatch, validate } from '../dist/index.js';

const catalogs = [gallery];
const marks = (result) => Object.fromEntries(result.applied.map((entry) => [`${entry.fix} ${entry.path}`, entry.changesDrawing]));
const fixOf = (findings, id) => findings.flatMap((finding) => finding.fixes ?? []).find((entry) => entry.id === id);
const record = (regions, extra = {}) => ({ name: 'Mine', direction: 'column', regions: [{ name: 'title' }, ...regions], ...extra });
const custom = (layouts) => ({ custom: { layouts } });
const paragraphs = [{ text: 'First paragraph of the slide that is reasonably long.' }, { text: 'Second paragraph also of decent length here.' }];
const chart = { type: 'bar', data: { columns: ['k', 'v'], rows: [['a', 1], ['b', 2]] }, alt: 'Values a and b' };

describe('fix: the default scope is the repair checks', () => {
  const faint = { name: 'Faint', language: 'en-US', design: { background: '#FFFFFF' }, slides: [{ title: 'Faint run', text: ['Readable and ', { text: 'faint', color: '#CCCCCC' }] }] };

  test('a contrast finding keeps its color: use-readable-color is offered but not safe, with or without audits', () => {
    const contrast = validate(faint, { catalogs }).findings.find((finding) => finding.ruleId === 'opf/text-contrast');
    const offered = contrast.fixes.find((entry) => entry.id === 'use-readable-color');
    assert.deepEqual([offered.kind, offered.safe, isSafePatch(offered)], ['patch', false, false]);
    for (const audits of [false, true]) {
      const result = fix(faint, { catalogs, audits });
      assert.deepEqual(result.applied, []);
      assert.equal(result.document.slides[0].text[1].color, '#CCCCCC', 'the author\'s color stays');
      assert.ok(result.findings.some((finding) => finding.ruleId === 'opf/text-contrast'));
    }
  });

  test('an audit\'s safe fix (a language tag in the wrong case) waits for audits: true; the repair fixes apply either way', () => {
    const deck = { name: 'Case', language: 'EN-us', slides: [{ title: 'Auto', layout: 'auto' }] };
    const repair = fix(deck, { catalogs });
    assert.deepEqual(repair.applied.map((entry) => entry.fix), ['remove-layout-auto']);
    assert.equal(repair.document.language, 'EN-us');
    const tag = repair.findings.find((finding) => finding.ruleId === 'opf/language-tag');
    assert.ok(tag && !FIX_REPAIR_CATEGORIES.includes(tag.category) && tag.fixes.some(isSafePatch), 'the finding stays, with its safe fix');
    const all = fix(deck, { catalogs, audits: true });
    assert.deepEqual(all.applied.map((entry) => entry.fix).sort(), ['remove-layout-auto', 'use-canonical-tag']);
    assert.equal(all.document.language, 'en-US');
    assert.deepEqual(FIX_REPAIR_CATEGORIES, ['format', 'references', 'policy', 'layout']);
  });

  test('a focus fix (focus-language, focus-alt) is safe for an editor to show but never applied nor counted', () => {
    const deck = { name: 'No language', slides: [{ title: 'Picture', image: 'https://example.com/a.png' }] };
    const result = fix(deck, { catalogs, audits: true });
    assert.deepEqual([result.applied, result.rounds, result.stopped], [[], 0, 'stable']);
    const language = fixOf(result.findings, 'focus-language');
    assert.deepEqual([language.kind, language.safe, isSafePatch(language)], ['focus', true, false]);
    assert.equal(isSafePatch(fixOf(result.findings, 'focus-alt')), false);
    assert.deepEqual(result.document, deck);
  });
});

describe('fix: each applied fix says whether it changes the drawing', () => {
  test('the removed layouts: agenda-split and flow can draw differently, vertical-flow and auto draw the same', () => {
    const deck = {
      name: 'Layouts',
      language: 'en-US',
      slides: [
        { title: 'Agenda', layout: 'agenda-split', items: ['Intro', 'Plan', 'Close'] },
        { title: 'Steps', layout: 'flow', items: ['Plan', 'Build', 'Ship'] },
        { title: 'Down', layout: 'vertical-flow', items: ['One', 'Two', 'Three'] },
        { title: 'Auto', layout: 'auto', text: 'Composed automatically.' },
      ],
    };
    assert.deepEqual(marks(fix(deck, { catalogs })), {
      'rename-layout /slides/0/layout': true,
      'rename-layout /slides/1/layout': true,
      'rename-layout /slides/2/layout': false,
      'remove-layout-auto /slides/3/layout': false,
    });
    const offered = validate(deck, { catalogs }).findings.map((finding) => finding.fixes?.[0]).filter(Boolean);
    assert.deepEqual(offered.map((entry) => entry.changesDrawing), [true, true, undefined, undefined], 'the finding\'s fix carries the mark only when true');
  });

  test('a deck 0.34.2 made self-contained: rename-layout of its agenda-split copy is marked, use-current-record of its cover is not; so is embed()', () => {
    const deck = JSON.parse(readFileSync(new URL('./fixtures/stale-0.34-agenda-split.opf.json', import.meta.url), 'utf8'));
    const result = fix(deck, { catalogs });
    assert.equal(result.stopped, 'stable');
    assert.deepEqual(Object.fromEntries(result.applied.map((entry) => [entry.fix, entry.changesDrawing])), { 'rename-layout': true, 'use-current-record': false });
    assert.equal(result.document.slides[1].layout, 'agenda');
    const { refreshed } = embed(deck, { catalogs });
    assert.deepEqual(Object.fromEntries(refreshed.map((entry) => [entry.id, [entry.how, entry.changesDrawing]])), { cover: ['current', undefined], 'agenda-split': ['renamed', true] });
  });

  test('removed design keys: contentDirection and chartPrimary are marked, except chartPrimary in a layout record (it never applied there)', () => {
    const deck = {
      name: 'Keys',
      language: 'en-US',
      design: { contentDirection: 'vertical', titleAlignment: 'center' },
      slides: [
        { title: 'Chart', design: { chartPrimary: 'start' }, blocks: [{ chart }, { text: 'Note on the chart.' }] },
        { title: 'Mine', layout: 'custom:mine', blocks: paragraphs },
      ],
      catalogs: custom({ mine: record([{ name: 'body', accepts: ['text', 'chart'] }], { design: { chartPrimary: 'start', contentDirection: 'horizontal' } }) }),
    };
    assert.deepEqual(marks(fix(deck, { catalogs })), {
      'remove:contentDirection /design/contentDirection': true,
      'remove:chartPrimary /slides/0/design/chartPrimary': true,
      'remove:chartPrimary /catalogs/custom/layouts/mine/design/chartPrimary': false,
      'remove:contentDirection /catalogs/custom/layouts/mine/design/contentDirection': true,
    });
  });

  test('custom records: listColumns other than a list region\'s "auto" is marked; flow none, sequence, pyramidDirection and the flow arrangement are not', () => {
    const many = Array.from({ length: 16 }, (_, index) => `Entry ${index + 1}`);
    const deck = {
      name: 'Records',
      language: 'en-US',
      slides: ['one', 'auto', 'text', 'seq', 'pyr', 'arr', 'single'].map((id) => ({ title: id, layout: `custom:${id}`, items: many.slice(0, 3) })),
      catalogs: custom({
        one: record([{ name: 'body', accepts: ['list', 'text'], listColumns: 1 }]),
        auto: record([{ name: 'body', accepts: ['list', 'text'], listColumns: 'auto' }]),
        text: record([{ name: 'body', accepts: ['text', 'list'], listColumns: 'auto' }]),
        seq: record([{ name: 'body', accepts: ['list'], sequence: 'steps' }]),
        pyr: record([{ name: 'body', accepts: ['list'], arrangement: 'pyramid', pyramidDirection: 'down' }]),
        arr: record([{ name: 'body', accepts: ['list'], arrangement: 'flow' }]),
        single: record([{ name: 'body', accepts: ['list'], flow: 'none' }]),
      }),
    };
    const result = fix(deck, { catalogs });
    assert.equal(result.stopped, 'stable');
    assert.deepEqual(marks(result), {
      'remove:listColumns /catalogs/custom/layouts/one/regions/1/listColumns': true,
      'remove:listColumns /catalogs/custom/layouts/auto/regions/1/listColumns': false,
      'remove:listColumns /catalogs/custom/layouts/text/regions/1/listColumns': true,
      'use-arrangement /catalogs/custom/layouts/seq/regions/1/sequence': false,
      'use-inverted-pyramid /catalogs/custom/layouts/pyr/regions/1/pyramidDirection': false,
      'rename-arrangement /catalogs/custom/layouts/arr/regions/1/arrangement': false,
      'use-max-1 /catalogs/custom/layouts/single/regions/1/flow': false,
    });
  });

  test('region renames and cells moved into blocks keep the drawing', () => {
    const deck = {
      name: 'Pins',
      language: 'en-US',
      slides: [
        { title: 'Chart', layout: 'chart-beside', blocks: [{ chart }, { text: 'The takeaway.', region: 'notes' }] },
        { title: 'Cells', 'top:start': { text: 'Top left.' }, 'bottom:end': { items: ['One', 'Two'] } },
      ],
    };
    assert.deepEqual(marks(fix(deck, { catalogs })), { 'rename-region /slides/0/blocks/1/region': false, 'cells-to-blocks /slides/1/top:start': false });
  });
});

describe('fix: a removed design key never leaves an empty design', () => {
  test('the slide, deck, theme and layout design go when the fix empties them, alone or with another removed key', () => {
    const deck = {
      name: 'Empty',
      language: 'en-US',
      design: { contentDirection: 'vertical' },
      theme: undefined,
      slides: [
        { title: 'One key', design: { contentDirection: 'vertical' }, blocks: paragraphs },
        { title: 'Two keys', design: { contentDirection: 'horizontal', chartPrimary: 'start' }, blocks: paragraphs },
        { title: 'Kept', design: { contentDirection: 'vertical', titleAlignment: 'center' }, blocks: paragraphs },
        { title: 'Mine', layout: 'custom:mine', blocks: paragraphs },
      ],
      catalogs: { custom: { layouts: { mine: record([{ name: 'body', accepts: ['text'] }], { design: { contentDirection: 'horizontal' } }) }, themes: { brand: { name: 'Brand', colorScheme: 'cool-horizon', fontScheme: 'aptos', design: { contentDirection: 'vertical' } } } } },
    };
    delete deck.theme;
    deck.design.theme = 'custom:brand';
    const result = fix(deck, { catalogs });
    assert.equal(result.stopped, 'stable');
    const { document } = result;
    assert.deepEqual(document.design, { theme: 'custom:brand' });
    assert.deepEqual(document.slides.map((slide) => slide.design), [undefined, undefined, { titleAlignment: 'center' }, undefined]);
    assert.equal(Object.hasOwn(document.catalogs.custom.layouts.mine, 'design'), false);
    assert.equal(Object.hasOwn(document.catalogs.custom.themes.brand, 'design'), false);
    assert.deepEqual(result.findings.filter((finding) => finding.severity === 'error'), []);
    // The second removed key of one design takes the emptied design with it, and the applied patch says so.
    const both = result.applied.filter((entry) => entry.path.startsWith('/slides/1/design/'));
    assert.equal(both.length, 2);
    assert.deepEqual(both.at(-1).patch.at(-1), { op: 'remove', path: '/slides/1/design' });
    // The finding's own fix removes the design when the key is all it holds, so an editor applying one fix leaves no {} either.
    const offered = fixOf(validate(deck, { catalogs }).findings.filter((finding) => finding.path === '/slides/0/design/contentDirection'), 'remove:contentDirection');
    assert.deepEqual(offered.patch, [{ op: 'remove', path: '/slides/0/design' }]);
  });

  test('an empty design the author wrote is left alone', () => {
    const deck = { name: 'Authored', language: 'en-US', design: {}, slides: [{ title: 'Auto', layout: 'auto', design: {} }] };
    const result = fix(deck, { catalogs });
    assert.deepEqual([result.document.design, result.document.slides[0].design], [{}, {}]);
  });
});
