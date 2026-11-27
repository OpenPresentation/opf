// NT-12: the coverage units and the four corpus rules on a small made-up corpus (the real one is check:native-coverage's).
import assert from 'node:assert/strict';
import test from 'node:test';
import { analyze, checkBudgets, checkDominated, checkKnownPlaces, dominatedDecks, modeledSeconds, runChecks, slidesByUnit } from './coverage.mjs';
import { computeUnits, filesForTier, loadInputs, markdownSlides, scriptsOf, tierSize } from './units.mjs';

const schema = {
  type: 'object',
  properties: { title: { type: 'string' }, slides: { type: 'array', items: { $ref: '#/$defs/Slide' } } },
  $defs: {
    Slide: {
      type: 'object',
      properties: { layout: { type: 'string' }, kind: { enum: ['plain', 'chart'] }, text: { type: 'string' }, note: { type: 'string' } },
    },
  },
};
const decks = {
  'a.json': { title: 'A', slides: [{ kind: 'plain', text: 'Hello' }, { kind: 'chart', layout: 'cover', text: 'مرحبا' }] },
  'b.json': { slides: [{ kind: 'plain', text: 'Hi' }] },
  'c.json': { slides: [{ kind: 'plain', note: 'only here', text: '日本' }, { kind: 'plain' }, { kind: 'plain' }] },
};
const manifest = {
  tiers: { smoke: { variants: 'default', decks: [{ deck: 'a' }] }, release: { decks: 'all', variants: 'all' }, full: { decks: 'all', variants: 'all' } },
  decks: [
    { id: 'a', source: 'a.json', variants: [{ name: 'default' }, { name: 'native-body' }] },
    { id: 'b', source: 'b.json' },
    { id: 'c', source: 'c.json' },
  ],
  features: [
    { id: 'F-1', deck: 'a', slides: [2], targets: { keynote: { outcome: 'native' } } },
    { id: 'F-2', deck: 'c', targets: { keynote: { outcome: 'native' } } },
  ],
};
const record = (id, where, extra = {}) => ({ id, where, ...extra });
const known = {
  keynote: [
    record('kn-ok', [{ deck: 'a', variant: 'native', slide: 1 }]),
    record('kn-far', [{ deck: 'm-charts', slide: 3 }]),
    record('kn-past-end', [{ deck: 'b', slide: 2 }]),
    record('kn-no-variant', [{ deck: 'b', variant: 'static', slide: 1 }]),
    record('kn-scoped', [], { scope: 'every-deck' }),
  ],
};
const inputs = (overrides = {}) =>
  loadInputs({
    manifest,
    known,
    schema,
    layoutIds: ['cover', 'unused'],
    readDeck: (source) => ({ format: 'json', document: decks[source], slides: decks[source].slides }),
    ...overrides,
  });
const budgets = { models: { keynote: { perFile: 4.15, perSlide: 0.86 } }, budgets: { keynote: { smoke: 6, release: 25, full: 90 } } };

test('units: schema locations per slide and per deck, features, scripts, variants and known places', () => {
  const units = computeUnits(inputs());
  assert.deepEqual(
    units.files.map((file) => file.id),
    ['a~default', 'a~native-body', 'b~default', 'c~default'],
  );
  const [aDefault, aNative] = units.files;
  assert.ok(aDefault.fileUnits.has('schema:title') && aDefault.fileUnits.has('variant:default'));
  assert.ok(aDefault.slideUnits[1].has('schema:Slide.kind = "chart"'));
  assert.ok(aDefault.slideUnits[1].has('schema:Slide.layout = "cover"'));
  assert.ok(aDefault.slideUnits[1].has('script:Arabic') && aDefault.slideUnits[0].has('script:Latin'));
  assert.ok(aDefault.slideUnits[1].has('feature:F-1') && !aNative.slideUnits[1].has('feature:F-1'), 'a feature without a variant is on the default file');
  assert.ok(aNative.slideUnits[0].has('known:keynote:kn-ok') && !aDefault.slideUnits[0].has('known:keynote:kn-ok'), 'a place\'s "native" is the corpus\'s "native-body"');
  assert.ok(units.files[3].fileUnits.has('feature:F-2'), 'a feature without slides belongs to the file');
  assert.equal(units.locations.get('Slide.layout = "unused"'), 'layout');
});

test('scriptsOf skips ids, sources and colors and letters every script shares; markdownSlides ignores --- in code', () => {
  assert.deepEqual([...scriptsOf({ id: 'שלום', color: 'red', text: ['Δ', 'ー', 'ab'] })].sort(), ['Greek', 'Latin']);
  const text = ['---', 'name: x', '---', '', '# One', '```', '---', '```', '', '---', '', '# Two', ''].join('\n');
  assert.deepEqual(
    markdownSlides(text).map((slide) => slide.trim().split('\n')[0]),
    ['# One', '# Two'],
  );
});

test('(a) a known record needs a place the release tier runs; the pending list must match exactly', () => {
  const units = computeUnits(inputs());
  const pending = { records: [{ application: 'keynote', id: 'kn-far', reason: 'NT-10' }] };
  const { failing, problems } = checkKnownPlaces(units, inputs(), pending);
  assert.deepEqual(
    failing.map((item) => item.id),
    ['kn-far', 'kn-past-end', 'kn-no-variant'],
    'a missing deck, a slide past the end and a missing variant fail; a scoped record has no place to need',
  );
  assert.equal(problems.length, 2);
  assert.match(problems[0], /kn-past-end: no place the release tier runs \(b slide 2\)/u);
  const stale = checkKnownPlaces(units, inputs(), { records: [...pending.records, { application: 'keynote', id: 'kn-ok', reason: 'NT-10' }] });
  assert.ok(stale.problems.some((problem) => /kn-ok \(keynote\) now has a place/u.test(problem)));
});

test('(b) a schema location on no slide fails unless allowlisted', () => {
  const units = computeUnits(inputs());
  const analysis = analyze(units, inputs(), budgets);
  assert.deepEqual(
    analysis.gaps.map((gap) => gap.location),
    ['Slide.layout = "unused"'],
  );
  const result = runChecks(units, inputs(), { pending: { records: [] }, dominated: { decks: [] }, budgets });
  assert.ok(result.problems.some((problem) => problem.startsWith('schema location Slide.layout = "unused" (layout) is on no corpus slide')));
});

test('(c) a deck with no unit of its own needs a known record, a feature or a list entry', () => {
  const units = computeUnits(inputs());
  assert.deepEqual(dominatedDecks(units.files), ['b'], 'b shows only what a shows; c has Slide.note and Han');
  assert.deepEqual(checkDominated(units, inputs(), { decks: [] }).unearned, [], 'b is named by kn-past-end');
  const bare = inputs({ known: { keynote: [] } });
  const result = checkDominated(computeUnits(bare), bare, { decks: [] });
  assert.deepEqual(result.unearned, ['b']);
  assert.match(result.problems[0], /corpus deck b shows no schema location/u);
  assert.deepEqual(checkDominated(computeUnits(bare), bare, { decks: [{ deck: 'b', reason: 'kept on purpose' }] }).problems, []);
  assert.match(checkDominated(units, inputs(), { decks: [{ deck: 'b', reason: 'x' }] }).problems[0], /b, which now earns its place/u);
});

test('(d) modeled time per tier against the budget', () => {
  const units = computeUnits(inputs());
  assert.deepEqual(
    filesForTier(units, manifest, 'smoke').map((file) => file.id),
    ['a~default'],
  );
  assert.deepEqual(tierSize(units, inputs(), 'release'), { tier: 'release', files: 4, slides: 8, parts: [{ name: 'corpus', files: 4, slides: 8 }], notModeled: [] });
  assert.equal(modeledSeconds(budgets.models.keynote, 4, 8), 4 * 4.15 + 8 * 0.86);
  const analysis = analyze(units, inputs(), budgets);
  assert.deepEqual(checkBudgets(analysis, budgets).problems, []);
  const tight = { ...budgets, budgets: { keynote: { release: 0.1 } } };
  assert.match(checkBudgets(analysis, tight).problems[0], /keynote release: 4 files, 8 slides, 0\.4 modeled minutes, over the budget of 0\.1/u);
  assert.match(checkBudgets(analysis, { models: {}, budgets: { powerpoint: { smoke: 5 } } }).problems[0], /powerpoint has budgets but no time model/u);
});

test('units on one slide count a deck slide once across its variants', () => {
  const bySlide = slidesByUnit(computeUnits(inputs()).files);
  assert.deepEqual([...bySlide.get('schema:Slide.note')], ['c#1']);
  assert.deepEqual([...bySlide.get('schema:Slide.kind = "chart"')], ['a#2']);
  assert.equal(bySlide.get('schema:title').size, 2, 'a deck-level unit is on every slide of the deck');
});
