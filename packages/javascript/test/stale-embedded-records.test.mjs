// OPF 0.35: embedded copies of built-in layout records from before 0.35 (what `opf embed` wrote into a self-contained deck) fail the 0.35
// layout schema. catalogs.default mirrors the built-in records, so validation names the cause and offers one safe fix, use-current-record
// (or rename-layout for a layout 0.35 removed), marked changesDrawing; embed() replaces each copy with the current record whatever release
// wrote it and whether it was edited; a slide on an embedded record that fails its schema is not told the record is missing; a 0.34
// region pin of a built-in layout names its 0.35 region.
// Fixtures (test/fixtures/stale-0.34-*): pptx.gallery's how-to-create-title-slides deck, the release supervisor's probe decks and
// openpresentation.org's story-and-evidence tutorial, trimmed; the chart and flow copies are the v0.34.2 gallery records.
import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { applyPatch, embed, resolveSlideContext, validate } from '../dist/index.js';
import { composeSlide } from '../dist/composition.js';
import { describeFinding } from '../dist/source.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const catalogs = [gallery];
const findingsOf = (deck, options = { catalogs }) => validate(deck, options).findings;
const at = (findings, path) => findings.filter((finding) => finding.path === path);
const fixIds = (finding) => (finding.fixes ?? []).map((fix) => `${fix.id}${fix.safe ? '' : ' (not safe)'}${fix.changesDrawing ? ' (changes the drawing)' : ''}`);
const fix = (finding, id) => finding.fixes.find((entry) => entry.id === id);
const errors = (deck, options) => findingsOf(deck, options).filter((finding) => finding.severity === 'error');
const current = (id) => Object.fromEntries(Object.entries(gallery.layouts[id]).filter(([key]) => key !== '$schema' && key !== 'id' && !key.startsWith('x-')));
// Geometry and text of a slide's composition; region names and provenance change on purpose.
const drop = new Set(['provenance', 'diagnostics', 'layout', 'region', 'regions', 'binding', 'decisions', 'rules', 'trace']);
const drawing = (deck, index) => {
  const context = resolveSlideContext(deck, index, { catalogs });
  return JSON.stringify(composeSlide(context.slide, context.options), (key, value) => (drop.has(key) ? undefined : typeof value === 'number' ? Math.round(value * 100) / 100 : value));
};

describe('a copy of an earlier release (pptx.gallery how-to deck)', () => {
  const deck = fixture('stale-0.34-cover.opf.json');

  test('the record finding names the cause; use-current-record is its one fix, safe and marked changesDrawing', () => {
    const findings = findingsOf(deck);
    const [flow] = at(findings, '/catalogs/default/layouts/cover/regions/1/flow');
    assert.equal(flow.ruleId, 'opf/catalog-record');
    assert.match(flow.message, /^catalogs\.default\.layouts\.cover is a copy of the built-in layout 'cover' from before OPF 0\.35: /);
    assert.match(flow.help, /^catalogs\.default\.layouts\.cover is a copy of the built-in layout 'cover' from before OPF 0\.35; 0\.35 changed the keys/);
    assert.match(flow.help, /catalogs\.default mirrors the built-in records \(keep a customized layout in catalogs\.custom\)/);
    assert.match(flow.help, /OPF 0\.35 removed flow "none"/);
    assert.deepEqual(fixIds(flow), ['use-current-record (changes the drawing)']);
    assert.deepEqual(fix(flow, 'use-current-record').patch, [{ op: 'replace', path: '/catalogs/default/layouts/cover', value: current('cover') }]);
  });

  test('the slide finding says the record is embedded but invalid, never that it is not embedded', () => {
    const [slide] = at(findingsOf(deck), '/slides/0/layout');
    assert.equal(slide.ruleId, 'opf/unresolved-reference');
    assert.equal(slide.message, "Layout 'cover' is embedded in catalogs.default, but the record fails the layout schema: see the opf/catalog-record findings at /catalogs/default/layouts/cover.");
    assert.doesNotMatch(`${slide.message} ${slide.help}`, /not embedded|resolves nowhere/);
    assert.deepEqual(fixIds(slide), ['use-current-record (changes the drawing)']);
    assert.equal(slide.suggestions, undefined);
    assert.deepEqual(describeFinding(slide, { document: deck, format: 'json' }), { message: 'Layout `cover` is embedded, but the record is invalid.', next: 'take the current record (the fix does, as do `opf fix -i` and `opf embed -i`).' });
  });

  test('without a registered catalog there is no current record: the copy is checked as any record, with the fix of each key', () => {
    const [flow] = at(findingsOf(deck, { catalogs: [] }), '/catalogs/default/layouts/cover/regions/1/flow');
    assert.doesNotMatch(flow.help, /copy of the built-in layout/);
    assert.deepEqual(fixIds(flow), ['use-max-1']);
  });

  test('embed() replaces the copy with the current record: valid, marked changesDrawing, idempotent', () => {
    const result = embed(deck, { catalogs });
    assert.deepEqual(result.refreshed, [{ group: 'default', kind: 'layouts', id: 'cover', source: 'https://www.pptx.gallery', how: 'current', changesDrawing: true, references: [] }]);
    assert.deepEqual(result.document.catalogs.default.layouts.cover, current('cover'));
    assert.deepEqual(errors(result.document), []);
    assert.deepEqual(result.document.slides, deck.slides, 'the slides are kept');
    assert.deepEqual(embed(result.document, { catalogs }).refreshed, []);
    assert.deepEqual(deck.catalogs.default.layouts.cover.regions[1].flow, 'none', 'the input is not mutated');
  });
});

describe('copies of the 0.34 release, edited or not', () => {
  const deck = fixture('stale-0.34-copies.opf.json');
  const chartPatch = [{ op: 'replace', path: '/slides/0/blocks/0/region', value: 'body' }, { op: 'replace', path: '/slides/0/blocks/1/region', value: 'aside' }];

  test('use-current-record replaces the copy and renames the pins of its slides', () => {
    const [flow] = at(findingsOf(deck), '/catalogs/default/layouts/chart/regions/2/flow');
    assert.match(flow.help, /is a copy of the built-in layout 'chart' from before OPF 0\.35/);
    assert.deepEqual(fixIds(flow), ['use-current-record (changes the drawing)']);
    const patch = fix(flow, 'use-current-record').patch;
    assert.deepEqual(patch, [{ op: 'replace', path: '/catalogs/default/layouts/chart', value: current('chart') }, ...chartPatch]);
    const fixed = applyPatch(deck, patch);
    assert.deepEqual(at(findingsOf(fixed), '/catalogs/default/layouts/chart/regions/2/flow'), []);
    assert.equal(findingsOf(fixed).filter((finding) => finding.ruleId === 'opf/region-unknown').length, 0);
  });

  test('an edited copy is replaced too: catalogs.default mirrors the built-ins, and embed() drops the edit', () => {
    const edited = structuredClone(deck);
    edited.catalogs.default.layouts.chart.name = 'Our chart';
    const [flow] = at(findingsOf(edited), '/catalogs/default/layouts/chart/regions/2/flow');
    assert.deepEqual(fixIds(flow), ['use-current-record (changes the drawing)']);
    const result = embed(edited, { catalogs });
    const chart = result.refreshed.find((entry) => entry.id === 'chart');
    assert.equal(chart.how, 'current');
    assert.deepEqual(result.document.catalogs.default.layouts.chart, current('chart'));
    assert.deepEqual(result.document.slides[0].blocks.map((block) => block.region), ['body', 'aside'], 'the pins name the 0.35 regions');
    assert.deepEqual(errors(result.document), []);
  });

  test('a copy of a layout 0.35 removed: rename-layout on the record, and on the last slide that uses it, drops the copy', () => {
    const findings = findingsOf(deck);
    const [arrangement] = at(findings, '/catalogs/default/layouts/flow/regions/1/arrangement');
    assert.match(arrangement.help, /'flow' from before OPF 0\.35, which 0\.35 removed \(use 'process'\)/);
    assert.deepEqual(fixIds(arrangement), ['rename-layout (changes the drawing)']);
    assert.deepEqual(fix(arrangement, 'rename-layout').patch, [
      { op: 'replace', path: '/slides/1/layout', value: 'process' },
      { op: 'replace', path: '/slides/2/layout', value: 'process' },
      { op: 'replace', path: '/slides/2/blocks/0/region', value: 'body' },
      { op: 'remove', path: '/catalogs/default/layouts/flow' },
      { op: 'add', path: '/catalogs/default/layouts/process', value: current('process') },
    ]);
    // Two slides use the copy, so the first slide's own rename keeps it; the last one drops it with its rename.
    const [first] = at(findings, '/slides/1/layout');
    assert.deepEqual(first.fixes[0].patch, [{ op: 'replace', path: '/slides/1/layout', value: 'process' }]);
    assert.equal(first.fixes[0].changesDrawing, true);
    const once = applyPatch(deck, first.fixes[0].patch);
    const [last] = at(findingsOf(once), '/slides/2/layout');
    assert.deepEqual(last.fixes[0].patch.map((operation) => `${operation.op} ${operation.path}`), ['replace /slides/2/layout', 'remove /catalogs/default/layouts/flow', 'add /catalogs/default/layouts/process']);
  });

  test('embed() takes the current chart record, moves the flow slides to process and drops the flow copy', () => {
    const result = embed(deck, { catalogs });
    assert.deepEqual(result.refreshed.map(({ id, how, renamedTo, changesDrawing, references }) => ({ id, how, renamedTo, changesDrawing, references })), [
      { id: 'chart', how: 'current', renamedTo: undefined, changesDrawing: true, references: ['/slides/0/blocks/0/region', '/slides/0/blocks/1/region'] },
      { id: 'flow', how: 'renamed', renamedTo: 'process', changesDrawing: true, references: ['/slides/1/layout', '/slides/2/layout', '/slides/2/blocks/0/region'] },
    ]);
    assert.deepEqual(Object.keys(result.document.catalogs.default.layouts).sort(), ['chart', 'process']);
    assert.deepEqual(result.document.slides.map((slide) => slide.layout), ['chart', 'process', 'process']);
    assert.deepEqual(findingsOf(result.document).filter((finding) => finding.severity !== 'info'), []);
  });
});

describe('records of the deck\'s own (catalogs.custom)', () => {
  const deck = fixture('stale-0.34-custom.opf.json');

  test('each removed 0.34 key names its replacement and carries its fix', () => {
    const findings = findingsOf(deck);
    const region = (index, key) => at(findings, `/catalogs/custom/layouts/mine/regions/${index}/${key}`)[0];
    assert.match(region(0, 'sequence').help, /replaced the region key sequence with arrangement/);
    assert.deepEqual(region(0, 'sequence').fixes[0].patch, [{ op: 'move', from: '/catalogs/custom/layouts/mine/regions/0/sequence', path: '/catalogs/custom/layouts/mine/regions/0/arrangement' }]);
    assert.deepEqual(fixIds(region(0, 'sequence')), ['use-arrangement']);
    assert.deepEqual(fixIds(region(0, 'role')), ['change-to:supporting (not safe)', 'change-to:primary (not safe)']);
    assert.deepEqual(fixIds(region(1, 'flow')), ['use-max-1']);
    assert.match(region(1, 'arrangement').help, /renamed the arrangement "flow" to "process"/);
    assert.deepEqual(fixIds(region(1, 'arrangement')), ['rename-arrangement']);
    assert.match(region(2, 'pyramidDirection').help, /"inverted-pyramid"/);
    assert.deepEqual(region(2, 'pyramidDirection').fixes[0].patch, [{ op: 'remove', path: '/catalogs/custom/layouts/mine/regions/2/pyramidDirection' }, { op: 'replace', path: '/catalogs/custom/layouts/mine/regions/2/arrangement', value: 'inverted-pyramid' }]);
    assert.ok(findings.every((finding) => !/Review "(sequence|pyramidDirection)" against/.test(finding.help ?? '')));
    // No cause and no use-current-record: a custom record is the deck's own.
    assert.ok(findings.filter((finding) => finding.path.startsWith('/catalogs/custom/')).every((finding) => !/copy of/.test(finding.help ?? '') && !fixIds(finding).some((id) => id.startsWith('use-current-record'))));
  });

  test('a pyramidDirection "up" drops the key; a sequence beside an arrangement has no fix', () => {
    const variant = structuredClone(deck);
    const regions = variant.catalogs.custom.layouts.mine.regions;
    regions[2].pyramidDirection = 'up';
    regions[0].arrangement = 'matrix';
    const findings = findingsOf(variant);
    assert.deepEqual(at(findings, '/catalogs/custom/layouts/mine/regions/2/pyramidDirection')[0].fixes[0].patch, [{ op: 'remove', path: '/catalogs/custom/layouts/mine/regions/2/pyramidDirection' }]);
    const sequence = at(findings, '/catalogs/custom/layouts/mine/regions/0/sequence')[0];
    assert.equal(sequence.fixes, undefined);
    assert.match(sequence.help, /also has "arrangement": "matrix"/);
  });

  test('a slide on an invalid custom record is told it is embedded, not that it is not in catalogs.custom', () => {
    const [slide] = at(findingsOf(deck), '/slides/1/layout');
    assert.equal(slide.message, "Layout 'custom:story-and-evidence' is embedded in catalogs.custom, but the record fails the layout schema: see the opf/catalog-record findings at /catalogs/custom/layouts/story-and-evidence.");
    assert.equal(slide.fixes, undefined);
  });

  test('the fixes make both records valid; embed() leaves custom records alone', () => {
    assert.deepEqual(embed(deck, { catalogs }).refreshed, []);
    assert.deepEqual(embed(deck, { catalogs }).document.catalogs.custom, deck.catalogs.custom);
    let current = deck;
    for (let round = 0; round < 10; round++) {
      const next = findingsOf(current).filter((finding) => finding.path.startsWith('/catalogs/custom/')).flatMap((finding) => finding.fixes ?? [])[0];
      if (!next) break;
      current = applyPatch(current, next.patch);
    }
    assert.deepEqual(errors(current), []);
    assert.deepEqual(findingsOf(current).filter((finding) => finding.ruleId === 'opf/unresolved-reference'), []);
  });
});

describe('0.34 region pins on built-in layouts', () => {
  const deck = fixture('stale-0.34-region-pins.opf.json');
  const expected = [['/slides/0/blocks/0/region', 'charts', 'body', 'chart'], ['/slides/0/blocks/1/region', 'note', 'aside', 'chart'], ['/slides/1/blocks/0/region', 'kpis', 'lead', 'dashboard'], ['/slides/1/blocks/1/region', 'charts', 'body', 'dashboard'], ['/slides/2/blocks/2/region', 'verdict', 'aside', 'comparison']];

  test('opf/region-unknown names the 0.35 region and offers rename-region, the foot-band verdict included', () => {
    const findings = findingsOf(deck).filter((finding) => finding.ruleId === 'opf/region-unknown');
    assert.deepEqual(findings.map((finding) => finding.path), expected.map(([path]) => path));
    for (const [path, old, next, layout] of expected) {
      const [finding] = at(findings, path);
      assert.equal(finding.help, `OPF 0.35 renamed region '${old}' of the built-in layout '${layout}' to '${next}' (the built-in layouts use the standard region names). Rename the pin (fix rename-region), which puts the block back in that region.`);
      assert.deepEqual(finding.fixes, [{ id: 'rename-region', title: `Pin to ${next}`, kind: 'patch', safe: true, patch: [{ op: 'replace', path, value: next }] }]);
      assert.deepEqual(describeFinding(finding, { document: deck, format: 'json' }), { message: `Block pinned to region \`${old}\`, which OPF 0.35 renamed \`${next}\` in layout \`${layout}\`.`, next: `pin it to \`${next}\` (the fix does).` });
    }
  });

  test('the renamed pins validate clean; checking the verdict pin draws nothing differently', () => {
    const fixed = applyPatch(deck, findingsOf(deck).filter((finding) => finding.ruleId === 'opf/region-unknown').flatMap((finding) => finding.fixes[0].patch));
    assert.deepEqual(findingsOf(fixed).filter((finding) => finding.severity !== 'info'), []);
    // The verdict text is drawn as the foot band either way.
    assert.equal(drawing(deck, 2), drawing(fixed, 2));
  });

  test('a custom layout of the same id keeps its own region names: no rename is offered', () => {
    const own = { ...deck, slides: [deck.slides[0]], catalogs: { custom: { layouts: { chart: { name: 'Chart', regions: [{ name: 'title' }, { name: 'body', accepts: ['chart', 'text'] }] } } } } };
    const [finding] = findingsOf(own).filter((entry) => entry.ruleId === 'opf/region-unknown');
    assert.equal(finding.fixes, undefined);
  });
});

test('every region rename of the migration note is offered, and names a region the current record has', () => {
  const note = readFileSync(new URL('../../../docs/migrations/0.35.md', import.meta.url), 'utf8');
  const table = note.slice(note.indexOf('### Region names of the built-in layouts'), note.indexOf('### Self-contained decks'));
  const rows = [...table.matchAll(/^\| (`[^|]+`)[^|]* \| ((?:`[a-z-]+`(?:, )?)+) \| `([a-z-]+)` \|$/gm)];
  assert.ok(rows.length >= 30, `the table has its rows (${rows.length})`);
  let checked = 0;
  for (const [, layoutCell, oldCell, next] of rows) {
    const layouts = [...layoutCell.matchAll(/`([a-z-]+)`/g)].map((match) => match[1]).filter((id) => Object.hasOwn(gallery.layouts, id));
    for (const layout of layouts)
      for (const old of [...oldCell.matchAll(/`([a-z-]+)`/g)].map((match) => match[1])) {
        const deck = { language: 'en-US', slides: [{ title: 'x', layout, blocks: [{ text: 'y', region: old }] }] };
        const finding = validate(deck, { catalogs }).findings.find((entry) => entry.ruleId === 'opf/region-unknown');
        assert.deepEqual(finding?.fixes?.[0]?.patch, [{ op: 'replace', path: '/slides/0/blocks/0/region', value: next }], `${layout}: ${old} -> ${next}`);
        checked++;
      }
  }
  assert.ok(checked >= 38, `checked ${checked} renames`);
});
