// The release qualification corpus (qualification/): the manifest names existing decks and known checks, every feature points at a
// deck and variant the build exports, and the grader reads a probe the way the Windows runner writes it. Office-free.
// NT-05a: the run tiers and the per-application expectations (targets) are data the native runner reads (qualification/tiers.mjs).
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { OBJECT_KINDS, OUTCOMES, TARGETS } from './core/result/result.mjs';
import { loadManifest, parseArgs, pptxName } from './qualification/build.mjs';
import { gradeCheck, slideFacts } from './qualification/evaluate.mjs';
import { decksForTier, expectationsFor, NOT_APPLICABLE, sourcesForTier, TIERS } from './qualification/tiers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = loadManifest();

test('qualification: every deck exists and parses, ids are unique', () => {
  const ids = manifest.decks.map((deck) => deck.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const deck of manifest.decks) {
    const file = path.join(root, deck.source);
    assert.ok(existsSync(file), deck.source);
    if (file.endsWith('.json')) assert.ok(Array.isArray(JSON.parse(readFileSync(file, 'utf8')).slides), deck.source);
    for (const variant of deck.variants ?? []) assert.ok(Array.isArray(variant.flags ?? []) && variant.name, `${deck.id} variant`);
  }
});

test('qualification: every feature names a deck, a variant and checks the manifest defines', () => {
  const decks = new Map(manifest.decks.map((deck) => [deck.id, deck]));
  const ids = manifest.features.map((feature) => feature.id);
  assert.equal(new Set(ids).size, ids.length, 'feature ids are unique');
  for (const feature of manifest.features) {
    const deck = decks.get(feature.deck);
    assert.ok(deck, `${feature.id}: deck ${feature.deck}`);
    const variants = (deck.variants ?? [{ name: 'default' }]).map((variant) => variant.name);
    assert.ok(variants.includes(feature.variant ?? 'default'), `${feature.id}: variant ${feature.variant}`);
    for (const check of feature.checks) assert.ok(check in manifest.checks, `${feature.id}: check ${check}`);
    for (const slide of feature.slides ?? []) assert.ok(Number.isInteger(slide) && slide > 0, `${feature.id}: slide ${slide}`);
  }
});

test('qualification: build arguments and file names', () => {
  assert.throws(() => parseArgs([]), /--out/);
  assert.deepEqual([...parseArgs(['--out', 'x', '--only', 'a,b']).only], ['a', 'b']);
  assert.equal(pptxName({ id: 'smartart' }, { name: 'default' }), 'smartart.pptx');
  assert.equal(pptxName({ id: 'smartart' }, { name: 'shapes' }), 'smartart~shapes.pptx');
});

test('qualification: the grader reads a probed slide', () => {
  const slide = {
    shapes: [
      { name: 'SmartArt', type: 24, smartArt: { layout: 'Basic Pyramid', layoutId: 'urn:x/pyramid1', nodes: 3, texts: ['A', 'B', 'C'], sizes: [24, 24, 24] }, children: [{ name: 'node', type: 1, text: { text: 'A', overflow: ['right'], autoSize: 0 } }] },
      { name: 'Line', type: 1, text: { text: 'Too wide', overflow: ['right'], autoSize: 0, bound: [0, 0, 10, 10] }, box: [0, 0, 5, 10] },
      { name: 'Connector', type: 1, connector: { type: 1, begin: true, end: true } },
      { name: 'Chart', type: 3, chart: { type: 51, series: 1 } },
    ],
    smartArtEdits: [{ sizesKept: true, framesKept: true, sizesBefore: [24], sizesAfter: [24] }],
    footer: { footer: true, slideNumber: true, date: false },
  };
  const facts = [slideFacts(slide)];
  assert.equal(facts[0].overflow.length, 1, 'text inside SmartArt is PowerPoint\'s own layout, not an overflow');
  const probe = { opened: true, slideCount: 1, previewSlides: 1, openSeconds: 1 };
  assert.equal(gradeCheck('opens', {}, probe, facts).status, 'pass');
  assert.equal(gradeCheck('noOverflow', {}, probe, facts).status, 'fail');
  assert.equal(gradeCheck('smartArt', { slides: [1], expect: { nodes: [3], layouts: ['pyramid'] } }, probe, facts).status, 'pass');
  assert.equal(gradeCheck('smartArt', { slides: [1], expect: { nodes: [4] } }, probe, facts).status, 'fail');
  assert.equal(gradeCheck('noSmartArt', { slides: [1] }, probe, facts).status, 'fail');
  assert.equal(gradeCheck('connectors', { slides: [1] }, probe, facts).status, 'pass');
  assert.equal(gradeCheck('nativeChart', { slides: [1] }, probe, facts).status, 'pass');
  assert.equal(gradeCheck('footer', { slides: [1], expect: { footer: [{ footer: true, date: true }] } }, probe, facts).status, 'fail');
  assert.equal(gradeCheck('slides', {}, { ...probe, slideCount: 2 }, facts).status, 'fail');
  assert.equal(gradeCheck('noOverflow', {}, { opened: false }, facts).status, 'not-run');
});


function nativeSyntaxCoverage(sourceManifest, readDeck) {
  const covered = new Set();
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (value.diagram && typeof value.diagram.source === 'string') covered.add(value.diagram.syntax ?? 'mermaid');
    for (const child of Object.values(value)) visit(child);
  };
  for (const feature of sourceManifest.features) {
    if (!['visual', 'shapes', 'roundtrip'].every((check) => feature.checks.includes(check))) continue;
    const deck = sourceManifest.decks.find((candidate) => candidate.id === feature.deck);
    if (!deck.source.endsWith('.json')) continue;
    const document = readDeck(deck.source);
    if (feature.slides) {
      for (const ordinal of feature.slides) {
        assert.ok(Number.isInteger(ordinal) && ordinal > 0 && ordinal <= document.slides.length, 'selected qualification slide exists');
        visit(document.slides[ordinal - 1]);
      }
    } else visit(document.slides);
  }
  return covered;
}

test('qualification: every schema-supported diagram syntax has native visual and saved-import coverage', () => {
  const schema = JSON.parse(readFileSync(path.join(root, 'spec/schemas/opf.schema.json'), 'utf8'));
  const definition = Object.values(schema.$defs ?? schema.definitions).find((value) => value?.properties?.syntax?.enum?.includes('mermaid'));
  assert.ok(definition, 'authoritative diagram syntax definition exists');
  const covered = nativeSyntaxCoverage(manifest, (source) => JSON.parse(readFileSync(path.join(root, source), 'utf8')));
  for (const syntax of definition.properties.syntax.enum) assert.ok(covered.has(syntax), `${syntax}: missing native diagram qualification`);
});

test('qualification: syntax on an unselected slide cannot certify native coverage', () => {
  const document = {slides: [{text: 'ordinary'}, {diagram: {syntax: 'dot', source: 'digraph {A -> B}'}}, {diagram: {syntax: 'plantuml', source: '@startuml\nA -> B\n@enduml'}}]};
  const feature = {deck: 'selection', slides: [1], checks: ['visual', 'shapes', 'roundtrip']};
  const fixture = {decks: [{id: 'selection', source: 'selection.json'}], features: [feature]};
  const covered = () => nativeSyntaxCoverage(fixture, () => document);
  assert.deepEqual([...covered()], [], 'DOT and PlantUML outside selected native slides are not covered');
  feature.slides = [2];
  assert.deepEqual([...covered()], ['dot']);
  feature.slides = [3];
  assert.deepEqual([...covered()], ['plantuml']);
  delete feature.slides;
  assert.deepEqual([...covered()], ['dot', 'plantuml'], 'no selection qualifies the whole deck');
  feature.checks = ['visual', 'shapes'];
  assert.deepEqual([...covered()], [], 'a deck without saved-import checks cannot certify coverage');
  feature.checks.push('roundtrip');
  feature.slides = [99];
  assert.throws(covered, /selected qualification slide exists/);
});

// ---- NT-05a: tiers and targets --------------------------------------------------------------------------------------------

const knownFor = (target) => {
  const file = path.join(root, 'scripts/native-acceptance/known', `${target}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).records : null;
};
const readDeck = (id) => {
  const source = manifest.decks.find((deck) => deck.id === id).source;
  return source.endsWith('.json') ? JSON.parse(readFileSync(path.join(root, source), 'utf8')) : null;
};
const smokeDecks = () => decksForTier(manifest, 'smoke');
/** The features the smoke tier runs: their deck is in the tier and their variant is one the tier exports. */
const smokeFeatures = () => {
  const decks = new Map(smokeDecks().map((entry) => [entry.deck, entry.variants]));
  return manifest.features.filter((feature) => decks.get(feature.deck)?.includes(feature.variant ?? 'default'));
};
const covers = (feature, slide) => !feature.slides || feature.slides.includes(slide);
const RTL = /^(ar|he|fa|ur|yi|ps|sd|ug|dv|ckb)(-|$)/i;
const rightToLeft = (language) => (typeof language === 'string' ? RTL.test(language) : language?.direction === 'rtl' || RTL.test(language?.bcp47 ?? ''));

test('qualification: the tiers are smoke, release and full, and every deck, variant and source they name exists', () => {
  assert.deepEqual(Object.keys(manifest.tiers).sort(), [...TIERS].sort());
  const ids = new Set(manifest.decks.map((deck) => deck.id));
  const smoke = manifest.tiers.smoke;
  assert.ok(Array.isArray(smoke.decks) && smoke.decks.length >= 8 && smoke.decks.length <= 14, 'about a dozen smoke decks');
  for (const entry of smoke.decks) {
    assert.ok(ids.has(entry.deck), `smoke: deck ${entry.deck}`);
    assert.ok(typeof entry.why === 'string' && entry.why.length > 20, `smoke: ${entry.deck} says why it is in`);
  }
  assert.equal(new Set(smoke.decks.map((entry) => entry.deck)).size, smoke.decks.length, 'smoke decks are unique');
  assert.deepEqual([manifest.tiers.release.decks, manifest.tiers.release.variants], ['all', 'all'], 'release is the whole corpus by rule');
  assert.deepEqual([manifest.tiers.full.decks, manifest.tiers.full.variants], ['all', 'all'], 'full starts from the whole corpus');
  for (const tier of TIERS) {
    assert.ok(['default', 'all'].includes(manifest.tiers[tier].variants), `${tier}: variants rule`);
    for (const source of sourcesForTier(manifest, tier)) assert.ok(source in manifest.sources, `${tier}: source ${source}`);
    assert.doesNotThrow(() => decksForTier(manifest, tier), `${tier}: every variant exists`);
  }
  assert.deepEqual(sourcesForTier(manifest, 'full'), ['examples', 'gallery-layouts', 'languages']);
});

test('qualification: decksForTier applies the variant rules', () => {
  const smoke = smokeDecks();
  assert.equal(smoke.length, manifest.tiers.smoke.decks.length);
  assert.deepEqual(smoke.find((entry) => entry.deck === 'footers').variants, ['default', 'static'], 'a smoke entry names its variants');
  assert.deepEqual(smoke.find((entry) => entry.deck === 'smartart').variants, ['default'], 'otherwise the tier rule: default only');
  const release = decksForTier(manifest, 'release');
  const corpus = manifest.decks.filter((deck) => !deck.group).map((deck) => deck.id);
  assert.deepEqual(release.slice(0, corpus.length).map((entry) => entry.deck), corpus, 'release starts with the corpus: every deck without a group');
  const fromSources = manifest.tiers.release.sources.flatMap((item) => item.decks.map((one) => [one.deck, one.variants ?? null]));
  assert.deepEqual(release.slice(corpus.length).map((entry) => entry.deck), fromSources.map(([deck]) => deck), 'then the source decks it names');
  assert.deepEqual(release.find((entry) => entry.deck === 'lang-cjk').variants, ['native-body'], 'a source deck entry names its variants');
  assert.deepEqual(release.find((entry) => entry.deck === 'diagrams').variants, ['default', 'picture']);
  assert.deepEqual(release.find((entry) => entry.deck === 'columns').variants, ['default']);
  assert.throws(() => decksForTier(manifest, 'nightly'), /unknown tier/);
  const fixture = { decks: [{ id: 'a' }], tiers: { smoke: { variants: 'default', decks: [{ deck: 'a', variants: ['native'] }] } } };
  assert.throws(() => decksForTier(fixture, 'smoke'), /no variant "native"/);
  assert.throws(() => decksForTier({ ...fixture, tiers: { smoke: { variants: 'default', decks: [{ deck: 'b' }] } } }, 'smoke'), /no deck "b"/);
});

test('qualification: every target expectation uses the shared vocabulary and names known records that exist', () => {
  const outcomes = new Set([...OUTCOMES.filter(Boolean), NOT_APPLICABLE]);
  const keys = new Set(['outcome', 'kind', 'known', 'note']);
  for (const feature of manifest.features) {
    if (feature.targets === undefined) continue;
    assert.ok(Object.keys(feature.targets).length > 0, `${feature.id}: targets is not empty`);
    for (const [target, expected] of Object.entries(feature.targets)) {
      const where = `${feature.id} ${target}`;
      assert.ok(TARGETS.includes(target), `${where}: a known target`);
      for (const key of Object.keys(expected)) assert.ok(keys.has(key), `${where}: key ${key}`);
      assert.ok(outcomes.has(expected.outcome), `${where}: outcome ${expected.outcome}`);
      if (expected.kind !== undefined) assert.ok(OBJECT_KINDS.includes(expected.kind), `${where}: kind ${expected.kind}`);
      if (expected.note !== undefined) assert.ok(typeof expected.note === 'string' && expected.note.length > 0, `${where}: note`);
      if (expected.known === undefined) continue;
      const records = knownFor(target);
      assert.ok(records, `${where}: known ids need scripts/native-acceptance/known/${target}.json`);
      assert.ok(Array.isArray(expected.known) && expected.known.length > 0, `${where}: known is a non-empty list`);
      for (const id of expected.known) assert.ok(records.some((record) => record.id === id), `${where}: known record ${id}`);
    }
  }
});

test('qualification: a feature may record no expectation for an application', () => {
  const fixture = {
    features: [
      { id: 'with', deck: 'smartart', slides: [1, 3], checks: [], targets: { keynote: { outcome: 'picture', kind: 'diagram', known: ['kn-smartart-picture-alt'] } } },
      { id: 'without', deck: 'smartart', checks: [] },
      { id: 'other-app', deck: 'footers', variant: 'static', checks: [], targets: { powerpoint: { outcome: 'native', kind: 'footer' } } },
    ],
  };
  assert.deepEqual(expectationsFor(fixture, 'keynote'), [
    { file: 'smartart~default', deck: 'smartart', variant: 'default', slide: 1, feature: 'with', outcome: 'picture', kind: 'diagram', known: ['kn-smartart-picture-alt'] },
    { file: 'smartart~default', deck: 'smartart', variant: 'default', slide: 3, feature: 'with', outcome: 'picture', kind: 'diagram', known: ['kn-smartart-picture-alt'] },
  ]);
  assert.deepEqual(expectationsFor(fixture, 'powerpoint'), [{ file: 'footers~static', deck: 'footers', variant: 'static', slide: null, feature: 'other-app', outcome: 'native', kind: 'footer' }]);
  assert.deepEqual(expectationsFor(fixture, 'impress'), []);
  assert.ok(manifest.features.some((feature) => !feature.targets), 'the manifest has features without targets');
  const keynote = expectationsFor(manifest, 'keynote');
  assert.ok(keynote.some((entry) => entry.file === 'smartart~default' && entry.slide === 1 && entry.outcome === 'picture'));
  assert.ok(keynote.every((entry, index) => index === 0 || keynote[index - 1].file <= entry.file));
});

test('qualification: the smoke tier shows every object kind, a hidden slide, a right-to-left slide, the chart families and the serious known differences', () => {
  const features = smokeFeatures();
  const kinds = new Set(features.flatMap((feature) => Object.values(feature.targets ?? {}).map((expected) => expected.kind)).filter(Boolean));
  // OPF writes no video or audio object, so no corpus deck has one: "media" is what an application reports of a file that
  // carries one, never what OPF exported.
  for (const kind of OBJECT_KINDS.filter((name) => name !== 'media')) assert.ok(kinds.has(kind), `smoke: a feature whose object is a ${kind}`);

  const slideOf = (feature, test) => {
    const deck = readDeck(feature.deck);
    return deck?.slides.some((slide, index) => covers(feature, index + 1) && feature.slides && test(slide, deck));
  };
  assert.ok(features.some((feature) => slideOf(feature, (slide) => slide.hidden === true)), 'smoke: a feature names a hidden slide');
  assert.ok(features.some((feature) => slideOf(feature, (slide) => rightToLeft(slide.language))), 'smoke: a feature names a right-to-left slide');

  // Known differences that name a corpus deck: every chart record Keynote has, and every open record of OPF's own file or
  // importer graded wrong, has a place a smoke feature covers. Variants are not compared: the round named the native-body
  // exports "native" (layout-sampler~native in known/keynote.json is the manifest's layout-sampler~native-body).
  const corpus = new Set(manifest.decks.map((deck) => deck.id));
  const records = knownFor('keynote').filter((record) => record.status === 'open' && (record.where ?? []).some((place) => corpus.has(place.deck)));
  const shown = (record) => record.where.some((place) => features.some((feature) => feature.deck === place.deck && covers(feature, place.slide)));
  const charts = records.filter((record) => record.feature === 'charts');
  const serious = records.filter((record) => record.grade === 'wrong' && ['opf-file', 'opf-importer'].includes(record.whose));
  assert.ok(charts.length >= 10 && serious.length >= 2, 'the known data has chart and serious records on corpus decks');
  for (const record of [...charts, ...serious]) assert.ok(shown(record), `smoke: no feature shows ${record.id}`);
});
