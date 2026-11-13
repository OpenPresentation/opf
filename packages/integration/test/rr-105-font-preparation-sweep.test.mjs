// RR-105: a deck's prepared faces cover every face its real-metrics composition, drawing and export measure.
// `loadFonts({presentation})` and `fonts.ensure(presentation)` prepare only the faces the font analysis reports. The analysis
// once measured every string as almost nothing, so a branch that only real widths take (a title that wraps and splits at its
// colon, text that overflows into another arrangement or a continuation slide) could measure a face nobody prepared, and the
// export failed with `font-unavailable` (0.34.0 candidate: "Preset shapes 49 to 60: notchedRightArrow to leftRightArrowCallout"
// beside a shape). The sweep converts a matrix of decks with a demand-loaded handle, as the CLI does, and any font
// preparation error is a failure. Run it as a script with OPF_SWEEP_REPORT=1 to print the counts.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {gallery} from '@openpresentation/gallery';
import {convert} from '@openpresentation/opf';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {lazyFacesNeeded, presentationFaces} from '@openpresentation/opf-render/fonts-browser';

const renderOptions = {catalogs: [gallery]}, date = '2026-11-12';
const handle = presentation => loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation, renderOptions});
const fontFailure = error => /font-unavailable|font-preparation-unsettled|not prepared/.test(`${error?.code ?? ''} ${error?.message ?? ''} ${JSON.stringify(error?.findings ?? error?.details ?? '')}`);

const words = n => Array.from({length: n}, (_, i) => ['quarterly', 'revenue', 'pipeline', 'adoption', 'retention', 'operating', 'margin', 'forecast'][i % 8]).join(' ');
const TITLES = {
  short: 'Quarterly review',
  long: 'Preset shapes 49 to 60: notchedRightArrow to leftRightArrowCallout',
  wrapping: `The ${words(14)} plan for the coming year`,
  veryLong: `${words(40)}: what the ${words(20)} means for the plan`,
};
const BLOCKS = {
  text: {text: 'Revenue grew twelve percent on renewals.'},
  bullets: {bullets: ['Close the evidence gaps', 'Name the owner', 'Publish the rhythm']},
  table: {table: {columns: ['Workstream', 'Owner', 'Status'], rows: [['Compliance', 'Program lead', 'On track'], ['Data', 'Analytics', 'Watch']]}},
  chart: {chart: {type: 'column', data: {columns: ['Quarter', 'Current'], rows: [['Q1', 26], ['Q2', 30], ['Q3', 33]]}}},
  quote: {quote: {text: 'The payload model stays predictable.', attribution: 'OPF fixture'}},
  code: {code: {source: 'const score = urgency * confidence;', language: 'ts'}},
  metric: {metric: {value: '99.9%', label: 'Validation pass rate', delta: '+2.1 pts', trend: 'up'}},
  timeline: {timeline: {events: [{when: 'May', what: 'Baseline'}, {when: 'Jun', what: 'Pilot'}, {when: 'Jul', what: 'Rollout'}]}},
  diagram: {diagram: 'flowchart LR\n  A[Request] --> B[Build]\n  B --> C[Release]'},
  shape: {shape: 'rect'},
  longText: {text: `${words(160)}.`},
  longBullets: {bullets: Array.from({length: 14}, (_, i) => `${words(10 + i)} item ${i + 1}`)},
};
const SHAPE = {shape: 'rect'};

/** Each block kind alone and beside a text-less shape, under each title length, with and without a subtitle (the full matrix). */
function matrix(fontScheme, {titles = Object.keys(TITLES), blocks = Object.keys(BLOCKS), bodies = [false, true]} = {}) {
  const decks = [];
  for (const titleName of titles)
    for (const blockName of blocks)
      for (const beside of [false, true])
        for (const body of bodies) {
          const title = TITLES[titleName], block = BLOCKS[blockName];
          if (beside && blockName === 'shape') continue;
          const blocks = beside ? [block, SHAPE] : [block];
          const slide = {title, ...(body && !('text' in block) ? {subtitle: 'Prepared for the operating review'} : {}), blocks};
          decks.push({name: `${fontScheme ?? 'default'}/${titleName}/${blockName}${beside ? '+shape' : ''}${body ? '+body' : ''}`,
            deck: {...(fontScheme ? {design: {fontScheme}} : {}), slides: [slide]}});
        }
  return decks;
}

async function sweep(decks, formats) {
  const failures = [];
  for (const {name, deck} of decks) {
    let fonts;
    try { fonts = await handle(deck); } catch (error) { failures.push({name, step: 'loadFonts', error}); continue; }
    for (const [format, extra] of formats) {
      try { await convert(deck, {...renderOptions, date, format, fonts, ...extra}); }
      catch (error) { failures.push({name, step: `${format}${extra.typefaces ? `/${extra.typefaces}` : ''}`, error}); }
    }
    const pending = fonts.pending(deck, renderOptions);
    if (pending.length) failures.push({name, step: 'pending', error: new Error(`pending after convert: ${pending.join(', ')}`)});
  }
  return failures;
}

const describe = failures => failures.map(({name, step, error}) => `${name} [${step}]: ${error?.code ?? ''} ${error?.message}`).join('\n');
const FORMATS = [['pptx', {}], ['pptx', {typefaces: 'safe'}], ['svg', {text: 'paths'}]];
const SCHEMES = [undefined, 'aptos', 'calibri', 'georgia', 'montserrat', 'garamond', 'segoe-ui-light', 'open-sans'];
const report = process.env.OPF_SWEEP_REPORT === '1';
// The full matrix (every scheme, title, block, subtitle and format: 1,288 decks) takes about 25 minutes. CI runs a cut that
// keeps every block and title for the default scheme and the wrapping titles for the others; OPF_SWEEP_FULL=1 runs it all.
const full = process.env.OPF_SWEEP_FULL === '1';
const PLAN = full
  ? SCHEMES.map(scheme => [scheme, matrix(scheme), scheme === undefined ? FORMATS : FORMATS.slice(0, 1)])
  : [[undefined, matrix(undefined, {bodies: [false]}), [FORMATS[0], FORMATS[2]]],
    ...SCHEMES.slice(1).map(scheme => [scheme, matrix(scheme, {titles: ['long', 'wrapping'], blocks: ['text', 'bullets', 'code', 'shape'], bodies: [false]}), FORMATS.slice(0, 1)])];

test('the regression deck converts with a demand-loaded handle (split title beside a shape)', async () => {
  const deck = {slides: [{title: TITLES.long, blocks: [{shape: 'rect'}]}]};
  const fonts = await handle(deck);
  for (const [format, extra] of FORMATS) await convert(deck, {...renderOptions, date, format, fonts, ...extra});
  // The split's qualifier is set in the body role (Intos 400) next to the Intos Display heading.
  assert.ok(fonts.registry.describeFaces().some(face => face.family === 'Intos' && face.weight === 400 && !face.italic));
  assert.deepEqual(fonts.pending(deck, renderOptions), []);
});

test('the browser analysis reports the real-metrics faces too', async () => {
  // The browser handle shares this analysis (lazyFacesNeeded with the registry's measurement). Hold only what the narrow pass
  // finds for the regression deck, and the real-metrics pass must still ask for the qualifier's body face.
  const deck = {slides: [{title: TITLES.long, blocks: [{shape: 'rect'}]}]};
  const whole = await loadFonts({pack: 'office', substitutionPolicy: 'visual'});
  const narrow = presentationFaces(deck, renderOptions, {faces: whole.registry.describeFaces(), policy: 'visual'});
  const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual', presentation: {slides: [{title: 'Quarterly review'}]}, renderOptions});
  const held = fonts.registry.describeFaces({selection: true});
  assert.ok(narrow.every(face => held.some(h => h.family === face.family && h.weight === face.weight && h.italic === face.italic)), 'the narrow faces are held');
  const lazy = whole.registry.describeFaces().filter(face => !held.some(h => h.family === face.family && h.weight === face.weight && h.italic === face.italic))
    .map(face => ({...face, file: `${face.family}-${face.weight}-${face.italic}`}));
  const args = {lazy, held, policy: 'visual'};
  assert.deepEqual(lazyFacesNeeded(deck, renderOptions, args).map(face => face.family), [], 'without metrics the narrow pass needs nothing');
  const needed = lazyFacesNeeded(deck, renderOptions, {...args, metrics: fonts.registry.textMeasurement});
  assert.deepEqual(needed.map(({family, weight, italic}) => ({family, weight, italic})), [{family: 'Intos', weight: 400, italic: false}]);
});

test('no block kind, title length or font scheme measures an unprepared face', {timeout: 30 * 60_000}, async () => {
  const failures = [];
  for (const [scheme, decks, formats] of PLAN) {
    // The default scheme runs more formats; the other schemes run the native PPTX export, the path that failed.
    const found = await sweep(decks, formats);
    failures.push(...found);
    if (report) console.log(`${scheme ?? 'default'}: ${decks.length} decks, ${found.filter(f => fontFailure(f.error)).length} font failures, ${found.filter(f => !fontFailure(f.error)).length} other`);
  }
  if (report) console.log(describe(failures));
  assert.equal(failures.filter(f => fontFailure(f.error)).length, 0, describe(failures.filter(f => fontFailure(f.error))));
  assert.equal(failures.length, 0, describe(failures));
});
