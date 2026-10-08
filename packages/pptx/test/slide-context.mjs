import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {resolveSlideContext as coreResolveSlideContext} from '@openpresentation/opf';
import {defaultCatalog} from '@openpresentation/opf/catalog';
import {toPptx as exportPptx} from '../dist/index.js';

// OPF 0.15: the font schemes this deck names come from the gallery snapshot, which a host registers explicitly; the
// exporter and core's context get the same catalogs.
const catalogs = [defaultCatalog];
const resolveSlideContext = (presentation, index) => coreResolveSlideContext(presentation, index, {catalogs});
const toPptx = (presentation, options = {}) => exportPptx(presentation, {catalogs, ...options});

// RR-55: the exporter composes every slide with the options of core's resolveSlideContext, so the deck's resolved font
// families (slide design, then deck design, then theme, then the engine default) are the ones the layout is measured in.
// A composeSlide option the engine does not know is ignored without an error, so the failure this test guards is silent:
// composition falling back to the default families while the package names the chosen ones.

const textSlide = {title: 'Heading text', subtitle: 'Subtitle text', text: 'Body copy of the slide.', items: ['One', 'Two']};
const deck = {
  name: 'Slide context',
  design: {fontScheme: 'roboto'},
  slides: [
    {id: 'inherits', ...textSlide},
    {id: 'own-scheme', ...textSlide, design: {fontScheme: 'georgia'}},
    {id: 'code', layout: 'code-1x', title: 'Code', code: {source: 'const x = 1;', language: 'ts'}},
  ],
};

// A measurement provider that records the family of every style the layout asks about.
const measuring = () => {
  const families = new Set();
  let calls = 0;
  return {families, calls: () => calls, textMeasurement: {measure: (text, size, style) => { calls++; families.add(style.fontFamily); return text.length * size * 0.5; }}};
};

for (const [index, slide] of deck.slides.entries()) {
  const expected = resolveSlideContext(deck, index).options.fontFamilies;
  const probe = measuring();
  const bytes = await toPptx({...deck, slides: [slide]}, {fonts: {textMeasurement: probe.textMeasurement}, strictAssets: true});
  assert.ok(probe.calls() > 0, `${slide.id}: the exporter measures with the fonts handle`);
  const allowed = new Set([expected.heading, expected.body, expected.code, expected.accent].filter(Boolean));
  assert.deepEqual([...probe.families].filter(family => !allowed.has(family)), [], `${slide.id}: layout is measured only in the deck's resolved families`);
  assert.ok(probe.families.has(expected.body), `${slide.id}: the body family ${expected.body} is measured`);
  // The package names the same families.
  const entries = unzipSync(bytes);
  const faces = new Set(Object.entries(entries).filter(([name]) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .flatMap(([, value]) => [...strFromU8(value).matchAll(/<a:latin typeface="([^"]*)"/g)].map(match => match[1])));
  assert.deepEqual([...faces].filter(family => !allowed.has(family)), [], `${slide.id}: the package names only the resolved families`);
}

// The families are the scheme's, not the default (Aptos) the engine uses when it is not told: roboto for the deck,
// georgia for the slide that sets its own scheme.
assert.equal(resolveSlideContext(deck, 0).options.fontFamilies.body, 'Roboto');
assert.notEqual(resolveSlideContext(deck, 1).options.fontFamilies.body, 'Roboto');
const georgia = measuring();
await toPptx({...deck, slides: [deck.slides[1]]}, {fonts: {textMeasurement: georgia.textMeasurement}});
assert.ok(!georgia.families.has('Aptos') && !georgia.families.has('Roboto'), 'a slide that sets its own scheme is not measured in the deck or default families');

// Without a fonts handle the layout uses core's portable estimate and the same families are named.
const estimated = unzipSync(await toPptx({...deck, slides: [deck.slides[1]]}));
assert.ok(strFromU8(estimated['ppt/slides/slide1.xml']).includes(`typeface="${resolveSlideContext(deck, 1).options.fontFamilies.body}"`));

// A reference that resolves nowhere is reported once per place it is written, from core's context, and never refuses the export.
{
  const diagnostics = [];
  const deck = {name: 'Unknown ids', design: {theme: 'no-such-theme', colorScheme: 'no-such-scheme'}, slides: [{layout: 'no-such-layout', title: 'One', text: 'a'}, {title: 'Two', text: 'b'}]};
  const bytes = await toPptx(deck, {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  const unresolved = diagnostics.filter(diagnostic => diagnostic.code === 'unresolved-reference').map(({kind, reference, path, fallback}) => ({kind, reference, path, fallback}));
  assert.deepEqual(unresolved, [
    {kind: 'themes', reference: 'no-such-theme', path: 'design.theme', fallback: 'engine-default'},
    {kind: 'colorSchemes', reference: 'no-such-scheme', path: 'design.colorScheme', fallback: 'engine-default'},
    {kind: 'layouts', reference: 'no-such-layout', path: 'slides.0.layout', fallback: 'automatic'},
  ]);
  // The fallbacks are the engine defaults (minimal's drawing fields, cool-horizon's slots): the second slide is the same as in a
  // deck that names those records.
  const named = await toPptx({...deck, design: {theme: 'minimal', colorScheme: 'cool-horizon'}});
  const slide = value => strFromU8(unzipSync(value)['ppt/slides/slide2.xml']);
  assert.equal(slide(bytes), slide(named), 'unknown theme and colour scheme export as the engine defaults');
}

// A layout-less slide is composed with no layout record: its package equals the one core's context describes (automatic composition).
{
  const context = resolveSlideContext({name: 'Cover', slides: [{title: 'Cover'}]}, 0);
  assert.equal(context.options.layout, undefined, 'core gives a layout-less slide no layout record');
}

console.log(JSON.stringify({test: 'slide-context', passed: true}));
