import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { instrumentedValidator } from './support/upstream-validator.mjs';
let api;
before(async () => { api = await instrumentedValidator(); });
after(async () => { await api?.close(); });
const clone = value => structuredClone(value);
const body = id => ({ id, title: `Topic ${id}`, blocks: [{ text: 'A useful first point.' }, { text: 'A distinct second point.' }] });
const deck = () => ({
  name: 'Upstream review', language: 'en-US', design: { theme: 'classic', fontScheme: 'roboto' },
  slides: [{ id: 'intro', layout: 'cover', section: 'Opening', title: 'Introduction', subtitle: 'A short introduction.' }, body('second'), body('third')],
});
const options = () => ({ catalogs: [gallery] });
function warm(document, config = options()) {
  const checker = api.createValidator();
  const first = api.audit(checker, document, config);
  assert.equal(first.report.schemaValid, true);
  assert.equal(checker.cache.entries, document.slides.length, 'every genuine finished composition is retained');
  const second = api.audit(checker, clone(document), config);
  assert.deepEqual(second.compute, document.slides.map(() => 0), 'real cache computations are absent when unchanged');
  return { checker, config, first };
}
const allComputed = result => result.compute.every(count => count > 0);

// Actual source counters, no elapsed-time threshold and no substitute composition. Every audit compares the complete cold report.
test('plain cover title changes recompose only the owner, on the same mutable object', () => {
  const document = deck();
  document.slides[2].blocks[0].text = [{ text: 'Authored link label', link: 'https://example.org/intro' }];
  const { checker, config } = warm(document);
  document.slides[0].title = 'Revised cover title';
  const changed = api.audit(checker, document, config);
  assert.deepEqual(changed.compute, [1, 0, 0]);
  assert.deepEqual(changed.compose, [1, 0, 0], 'neither later slide calls actual composeSlide');
  assert.equal(document.slides[2].blocks[0].text[0].text, 'Authored link label');
  document.slides[0].notes = 'Changed speaker notes';
  assert.deepEqual(api.audit(checker, document, config).compute, [1, 0, 0]);
  document.slides[0].title = 'Introduction';
  assert.deepEqual(api.audit(checker, document, config).compute, [1, 0, 0], 'undo-like content restoration remains local');
});

test('rich heading citations, marker order, footnotes and locations invalidate downstream numbering', () => {
  const document = deck();
  document.references = [{ id: 'a', text: 'Reference A' }, { id: 'b', text: 'Reference B' }];
  document.slides[2].blocks[0].text = [{ text: 'Later citation', cite: 'b' }];
  const { checker, config } = warm(document);
  const mutations = [
    d => { d.slides[0].title = [{ text: 'Earlier citation', cite: 'a' }]; },
    d => { d.slides[0].title = [{ text: 'Earlier footnote', footnote: [{ text: 'Footnote body', bold: true }] }]; },
    d => { d.slides[0].title = [{ text: 'Earlier citations', cite: ['b', 'a'] }]; },
    d => { d.slides[0].title = [{ text: 'Unmarked prefix' }, { text: 'Moved citation', cite: 'a' }]; },
    d => { d.slides[0].title = 'No earlier marker'; },
  ];
  for (const mutate of mutations) { mutate(document); assert.ok(allComputed(api.audit(checker, document, config)), 'the ordered shared citation walker invalidates all later compositions'); }
});

test('section stays an exact conservative dependency; no boolean/title-derived section is invented', () => {
  const document = deck();
  document.design.footer = { start: { text: '{{slide.section}}' } };
  const { checker, config } = warm(document);
  document.slides[0].section = 'Changed section';
  assert.ok(allComputed(api.audit(checker, document, config)));
  document.slides[0].section = true;
  assert.equal(api.audit(checker, document, config).report.schemaValid, false);
  assert.equal(checker.cache.entries, 0);
  document.slides[0].section = 'Opening';
  assert.ok(allComputed(api.audit(checker, document, config)));
});

test('all lone-text bodies retain full upstream dependencies across candidate, length and background changes', () => {
  const document = deck();
  document.slides[0] = { id: 'intro', title: 'A decision', text: 'One concise message.' };
  const { checker, config } = warm(document);
  const mutations = [
    d => { d.slides[0].title = 'A different decision'; },
    d => { d.slides[0].text = 'A long message with supporting details. '.repeat(10); },
    d => { d.slides[0].text = 'One concise message.'; d.slides[0].subtitle = 'Subtitle prevents an actual message surface'; },
    d => { d.slides[0].design = { background: { type: 'solid', color: '#FFFFFF' } }; },
    d => { delete d.slides[0].text; },
    d => { d.slides[0].text = 'A message again'; },
  ];
  for (const mutate of mutations) { mutate(document); assert.ok(allComputed(api.audit(checker, document, config)), 'potential surface changes keep the old full-raw suffix policy'); }
});

for (const [language, title, message, word] of [
  ['en-US', 'Catalog Overrides', 'Document-local catalog records can be referenced by id from the same OPF document.', 'word'],
  ['ar', 'تجاوزات الفهرس', 'يمكن الإشارة إلى سجلات الفهرس المحلية في المستند بمعرفها من المستند نفسه.', 'كلمة'],
]) test(`actual downstream message surfaces remain exact after local and upstream edits (${language})`, () => {
  const profiles = [];
  const measurement = { measure: (text, size) => text.length * size * 0.5, forScripts(profile) { profiles.push(profile); return { measure: (text, size) => text.length * size * 0.5 }; } };
  const document = { name: 'Real downstream alternation', language, slides: [
    { id: 'cover', layout: 'cover', title: 'Opening' },
    { id: 'message-a', title, text: message },
    { id: 'message-b', title, text: message },
  ] };
  const { checker, config, first } = warm(document, { catalogs: [gallery], fonts: { textMeasurement: measurement } });
  const surfaces = result => result.geometry.map(item => item?.surface?.kind ?? null);
  const backgrounds = () => document.slides.map((_, index) => api.resolveSlideContext(document, index, { catalogs: config.catalogs }).resolved.roles.background);
  const originalBackgrounds = backgrounds();
  assert.deepEqual(surfaces(first), [null, 'display-message', null], 'the real later messages alternate');
  const grown = first.geometry[1].items.find(item => item.field === 'text').text.fontSize;
  assert.ok(grown / (Math.min(first.geometry[1].width, first.geometry[1].height) / 720) > api.LONE_DISPLAY_SIZES.text, 'the message actually grows past the surface threshold');
  assert.ok(profiles.some(profile => profile.rtl === (language === 'ar')), 'the real per-script planner received the expected direction');

  document.slides[0].title = 'A local cover title edit';
  const local = api.audit(checker, document, config);
  assert.deepEqual(local.compute, [1, 0, 0], 'real later-message cache computations are reused');
  assert.deepEqual(surfaces(local), surfaces(first));

  document.slides[0].layout = 'section';
  const layoutAccent = api.audit(checker, document, config);
  assert.ok(allComputed(layoutAccent));
  assert.deepEqual(surfaces(layoutAccent), [null, null, 'display-message'], 'a real prior layout accent flips both later surfaces');
  assert.notEqual(backgrounds()[1], originalBackgrounds[1], 'the next slide really changes its resolved background');
  assert.notEqual(backgrounds()[2], originalBackgrounds[2], 'the following slide also changes its resolved background');
  assert.notDeepEqual(layoutAccent.geometry[1], local.geometry[1]);

  document.slides[0].layout = 'cover'; document.slides[0].design = { variant: 'accent1' };
  const designAccent = api.audit(checker, document, config);
  assert.deepEqual(surfaces(designAccent), [null, null, 'display-message'], 'a real prior authored accent also suppresses the next message');
  assert.ok(allComputed(designAccent));

  delete document.slides[0].design; delete document.slides[0].layout;
  document.slides[0].title = title; document.slides[0].text = message;
  const candidate = api.audit(checker, document, config);
  assert.deepEqual(surfaces(candidate), ['display-message', null, 'display-message'], 'a newly eligible prior body changes downstream alternation');
  assert.ok(allComputed(candidate));
  document.slides[0].text = Array.from({ length: api.SHORT_MESSAGE_WORDS + 5 }, (_, index) => `${word}${index}`).join(' ');
  const long = api.audit(checker, document, config);
  assert.deepEqual(surfaces(long), [null, 'display-message', null], 'a prior long body loses the real surface and restores later alternation');
  assert.ok(allComputed(long));
  document.slides[0].text = message;
  const short = api.audit(checker, document, config);
  assert.deepEqual(surfaces(short), ['display-message', null, 'display-message']);
  document.slides[0].title = `${title} `.repeat(30);
  const longTitle = api.audit(checker, document, config);
  assert.ok(allComputed(longTitle), 'a potential message title retains the complete raw prefix');
  assert.notDeepEqual(longTitle.geometry[0], short.geometry[0], 'title wrapping/growth really changed');
});

test('prior explicit accents, own fonts/language and global RTL/catalog changes remain conservative', () => {
  const document = deck();
  const catalog = { source: gallery.source, themes: { ...gallery.themes }, fontSchemes: { ...gallery.fontSchemes }, layouts: { ...gallery.layouts }, colorSchemes: { ...gallery.colorSchemes } };
  const { checker, config } = warm(document, { catalogs: [catalog] });
  const changes = [
    d => { d.slides[0].design = { variant: 'accent1' }; },
    d => { d.slides[0].design.fontScheme = 'arial'; },
    d => { d.language = 'ar-SA'; },
    () => { catalog.layouts.cover = { ...catalog.layouts.cover, design: { variant: 'accent1' } }; },
  ];
  for (const mutate of changes) { mutate(document); assert.ok(allComputed(api.audit(checker, document, config))); }
});

test('shared dataset edits recompose both real consumers while an unrelated suffix stays cached', () => {
  const document = deck();
  document.datasets = { sales: { columns: ['Quarter', 'Value'], rows: [['Q1', 33], ['Q2', 44]] } };
  document.slides = [document.slides[0], { id: 'chart-a', title: 'A', chart: { type: 'line', data: { dataset: 'sales' } } }, body('plain'), { id: 'chart-b', title: 'B', chart: { type: 'column', data: { dataset: 'sales' } } }];
  const { checker, config } = warm(document);
  const hydrated = api.inlineDatasets(document);
  assert.deepEqual(document.slides.map(slide => api.lonePayload(slide)?.field), hydrated.slides.map(slide => api.lonePayload(slide)?.field), 'dataset hydration only replaces chart data/table fields, never the body-kind predicate');
  document.datasets.sales.rows[0][1] = 34;
  assert.deepEqual(api.audit(checker, document, config).compute, [0, 1, 0, 1]);
  document.slides[0].title = 'A local edit after the shared datum';
  assert.deepEqual(api.audit(checker, document, config).compute, [1, 0, 0, 0]);
});

test('declared rich variables and template/values modes conservatively retain the full raw prefix', () => {
  const document = deck();
  document.variables = { heading: { type: 'text', value: [{ text: 'Variable heading', bold: true }] } };
  document.slides[0].title = 'var:heading';
  const { checker, config } = warm(document);
  document.slides[0].title = 'A plain heading instead';
  assert.ok(allComputed(api.audit(checker, document, config)), 'no raw-slide approximation of rich variable expansion');
  for (const mode of [{ template: false }, { values: {} }]) {
    const plain = deck(), prepared = warm(plain, { catalogs: [gallery], ...mode });
    plain.slides[0].title = 'Explicit validation mode';
    assert.ok(allComputed(api.audit(prepared.checker, plain, prepared.config)));
  }
  const template = { ...deck(), template: true }, prepared = warm(template);
  template.slides[0].title = 'Template title';
  assert.ok(allComputed(api.audit(prepared.checker, template, prepared.config)));
});

test('global metadata, variables, reference texts, IDs, order and count still invalidate exact context', () => {
  const document = deck();
  document.variables = { client: { type: 'text', value: 'Acme' } };
  document.references = [{ id: 'a', text: 'Reference A' }];
  const { checker, config } = warm(document);
  const mutations = [
    d => { d.name = 'New name'; },
    d => { d.variables.client.value = 'Other client'; },
    d => { d.references[0].text = 'Revised source'; },
    d => { d.slides[0].id = 'renamed'; },
    d => { d.slides.reverse(); },
    d => { d.slides.push(body('added')); },
  ];
  for (const mutate of mutations) { mutate(document); assert.ok(allComputed(api.audit(checker, document, config))); }
  document.slides[0].blocks[0].text = [{ text: 'No inferred target label', link: 'slide:renamed' }];
  assert.equal(api.audit(checker, document, config).report.schemaValid, false, 'internal slide links are not accepted by the current URL-only schema');
});

test('unknown catalog callables fall back to the full raw prefix without invoking loaders', () => {
  const document = deck(); let loaderCalls = 0;
  const loader = () => { loaderCalls++; throw Error('The prefix classifier must not execute a loader'); };
  const catalog = { source: gallery.source, ...gallery, iconSets: { unprepared: loader } };
  const { checker, config } = warm(document, { catalogs: [catalog] });
  document.slides[0].title = 'Conservative title change';
  assert.ok(allComputed(api.audit(checker, document, config)));
  assert.equal(loaderCalls, 0);
});

test('measurement changes still require and honor the existing explicit resource clear contract', () => {
  const document = deck(); let scale = 0.5;
  const measurement = { measure: (text, size) => text.length * size * scale };
  const { checker, config } = warm(document, { catalogs: [gallery], fonts: { textMeasurement: measurement } });
  document.slides[0].title = 'Local title with a stable provider';
  assert.deepEqual(api.audit(checker, document, config).compute, [1, 0, 0]);
  scale = 0.6; checker.clear();
  assert.ok(allComputed(api.audit(checker, document, config)));
});

test('the index measurement callback receives no prior slide or document input', () => {
  const document = deck(), received = [];
  const perIndex = (...args) => { received.push(args); return { measure: (text, size) => text.length * size * 0.5 }; };
  const { checker, config } = warm(document, { catalogs: [gallery], fonts: { textMeasurement: perIndex } });
  received.length = 0;
  document.slides[0].title = 'An own title edit';
  assert.deepEqual(api.audit(checker, document, config).compute, [1, 0, 0]);
  assert.ok(received.length > 0);
  assert.ok(received.every(args => args.length === 1 && Number.isInteger(args[0]) && args[0] >= 0 && args[0] < 3), 'the documented callback input is only a slide index');
});

test('opaque input and key budgets continue to decline caching', () => {
  for (const change of [
    d => { d[Symbol('private')] = 'opaque'; },
    d => { Object.defineProperty(d.slides[0], 'extra', { value: 'hidden', enumerable: false }); },
    d => { d.name = 'x'.repeat(1100000); },
  ]) {
    const document = deck(), checker = api.createValidator(); change(document);
    api.audit(checker, document, options());
    assert.equal(checker.cache.entries, 0);
    assert.equal(checker.cache.bytes, 0);
  }
});

test('reentrant validation cannot reuse another document under a projected prefix', () => {
  const document = deck(), other = deck(), checker = api.createValidator();
  other.slides[1].blocks[0].text = 'Foreign content';
  let nested = false;
  const config = { catalogs: [gallery], fonts: { textMeasurement: { measure(text, size) {
    if (!nested) { nested = true; checker.validate(other, options()); }
    return text.length * size * 0.5;
  } } } };
  api.audit(checker, document, config);
  assert.equal(nested, true);
  document.slides[0].title = 'Changed after reentrancy';
  api.audit(checker, document, config);
});
