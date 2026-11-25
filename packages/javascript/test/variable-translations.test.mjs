import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fill, listVariables, pickTranslation, resolveVariables, validate } from '../dist/index.js';
import { fromMarkdown, toMarkdown } from '../dist/markdown.js';
import { fromYaml, toYaml } from '../dist/yaml.js';

// FR-10 part 1 (CR 15): a variable carries translations, and the language where it is drawn (the slide's declared language, else the deck's)
// selects one: the exact tag, then the tag without its last subtag, else the value.

const bilingual = () => ({
  name: 'Bilingual event',
  language: 'de',
  template: false,
  variables: {
    cta: { type: 'text', value: 'Book a demo', translations: { de: { value: 'Demo buchen' }, fr: { value: 'Réserver une démo' } } },
    'event-date': { type: 'date', value: '2026-03-05', translations: { fr: { format: 'EEEE d MMMM yyyy' } } },
  },
  slides: [
    { title: 'Am {{event-date}} in Berlin', text: '{{cta}}' },
    { language: 'fr', title: 'Le {{event-date}} à Paris', text: '{{cta}}' },
  ],
});
const drawn = (document, values, options) => resolveVariables(document, values, options).presentation;
const rules = (document, options = {}) => validate(document, { only: ['references', 'format'], ...options }).findings.map((finding) => [finding.ruleId, finding.severity, finding.path]);
const clone = (value) => JSON.parse(JSON.stringify(value));

test('the slide language selects the translation: the exact tag, then the tag without its last subtag, else the value', () => {
  const deck = bilingual();
  const result = drawn(deck);
  assert.equal(result.slides[0].text, 'Demo buchen');
  assert.equal(result.slides[1].text, 'Réserver une démo');
  const regional = { ...deck, slides: [{ language: 'de-CH', text: '{{cta}}' }, { language: 'DE-at', text: '{{cta}}' }, { language: 'fr-CA-u-nu-latn', text: '{{cta}}' }, { language: 'it', text: '{{cta}}' }] };
  assert.deepEqual(drawn(regional).slides.map((slide) => slide.text), ['Demo buchen', 'Demo buchen', 'Réserver une démo', 'Book a demo']);
  // The most specific entry wins, whatever the key's case and order.
  const specific = clone(deck);
  specific.variables.cta.translations = { de: { value: 'Demo buchen' }, 'DE-ch': { value: 'Demo reservieren' } };
  specific.slides = [{ language: 'de-CH', text: '{{cta}}' }, { language: 'de-AT', text: '{{cta}}' }];
  assert.deepEqual(drawn(specific).slides.map((slide) => slide.text), ['Demo reservieren', 'Demo buchen']);
  assert.equal(pickTranslation([{ tag: 'zh', n: 1 }, { tag: 'zh-Hant', n: 2 }], 'zh-Hant-TW').n, 2);
  assert.equal(pickTranslation([{ tag: 'zh', n: 1 }, { tag: 'zh-Hant', n: 2 }], 'zh-Hans').n, 1);
  assert.equal(pickTranslation([{ tag: 'zh' }], undefined), undefined);
});

test('the deck language applies where a slide declares none, and a deck with no declared language always draws the value', () => {
  const deck = bilingual();
  deck.slides = [{ text: '{{cta}}' }];
  assert.equal(drawn(deck).slides[0].text, 'Demo buchen');
  const none = clone(deck);
  delete none.language;
  assert.equal(drawn(none).slides[0].text, 'Book a demo');
  // A language read from the text (v0.35) selects nothing: only a declared one does.
  none.slides = [{ text: '{{cta}} Dies ist ein deutscher Satz über die Zusammenarbeit der Teams in diesem Jahr.' }];
  assert.match(drawn(none).slides[0].text, /^Book a demo /);
});

test('the same selection applies to inline tokens and whole var: fields, notes, rich text, lists, links and images', () => {
  const deck = {
    name: 'Kinds',
    language: 'en-US',
    variables: {
      head: { type: 'text', value: [{ text: 'Hello ', bold: true }, { text: 'world' }], translations: { de: { value: [{ text: 'Hallo ', bold: true }, { text: 'Welt' }] } } },
      points: { type: 'list', value: ['one', 'two'], translations: { de: { value: ['eins', 'zwei', 'drei'] } } },
      page: { type: 'url', value: 'https://example.com/en', translations: { de: { value: 'https://example.com/de' } } },
      shot: { type: 'image', value: 'https://example.com/en.png', translations: { de: { value: { src: 'https://example.com/de.png', alt: 'Bild' } } } },
    },
    slides: [
      { title: 'var:head', items: 'var:points', notes: 'Say {{head}}: {{points}}', links: [{ text: 'Site', url: 'var:page' }] },
      { language: 'de', title: 'var:head', items: 'var:points', notes: 'Sage {{head}}: {{points}}', links: [{ text: 'Seite', url: 'var:page' }] },
    ],
  };
  const slides = drawn(deck).slides;
  assert.deepEqual(slides[0].title, [{ text: 'Hello ', bold: true }, { text: 'world' }]);
  assert.deepEqual(slides[1].title, [{ text: 'Hallo ', bold: true }, { text: 'Welt' }]);
  assert.deepEqual(slides[0].items, ['one', 'two']);
  assert.deepEqual(slides[1].items, ['eins', 'zwei', 'drei']);
  assert.equal(slides[0].notes, 'Say Hello world: one, two');
  assert.equal(slides[1].notes, 'Sage Hallo Welt: eins, zwei, drei');
  assert.equal(slides[0].links[0].url, 'https://example.com/en');
  assert.equal(slides[1].links[0].url, 'https://example.com/de');
  const image = { name: 'Image', language: 'en', variables: deck.variables, slides: [{ image: 'var:shot' }, { language: 'de', image: 'var:shot' }] };
  assert.deepEqual(drawn(image).slides.map((slide) => slide.image), ['https://example.com/en.png', { src: 'https://example.com/de.png', alt: 'Bild' }]);
});

test('a date translation sets the pattern per language; a pipe format on the token wins over it', () => {
  const deck = bilingual();
  const result = drawn(deck);
  // Part 2 draws the names in the slide language; here the pattern is the point: the French slide uses its own.
  assert.match(result.slides[1].title, /^Le .+ 5 .+ 2026 à Paris$/);
  assert.equal(result.slides[0].title, `Am ${result.slides[0].title.slice(3, -10)} in Berlin`);
  const piped = clone(deck);
  piped.slides = [{ language: 'fr', title: '{{event-date|yyyy}}' }];
  assert.equal(drawn(piped).slides[0].title, '2026');
});

test('a variable with translations and no value is filled where the language selects one, and unfilled where none does', () => {
  const deck = {
    name: 'Only translations',
    language: 'de',
    variables: { greeting: { type: 'text', translations: { de: { value: 'Hallo' } } } },
    slides: [{ title: '{{greeting}}' }, { language: 'fr', title: '{{greeting}}' }],
  };
  const result = resolveVariables(deck);
  assert.deepEqual(result.unfilled, ['greeting']);
  assert.equal(result.complete, false);
  assert.deepEqual(result.presentation.slides.map((slide) => slide.title), ['Hallo', '{{greeting}}']);
  assert.ok(result.diagnostics.some((entry) => entry.code === 'variable-unfilled' && entry.severity === 'error' && /fr/.test(entry.message)));
  // Every place selects one: filled.
  const filled = clone(deck);
  filled.slides = [{ title: '{{greeting}}' }, { language: 'de-AT', title: '{{greeting}}' }];
  const ok = resolveVariables(filled);
  assert.equal(ok.complete, true);
  assert.deepEqual(ok.presentation.slides.map((slide) => slide.title), ['Hallo', 'Hallo']);
  // Optional: a place that selects none is empty.
  const optional = clone(deck);
  optional.variables.greeting.required = false;
  assert.deepEqual(resolveVariables(optional).presentation.slides.map((slide) => slide.title), ['Hallo', '']);
  // A template is told, not failed.
  assert.equal(resolveVariables({ ...deck, template: true }).diagnostics.find((entry) => entry.code === 'variable-unfilled').severity, 'info');
});

test('the limits of FR-09 apply to every translation and report its path', () => {
  const deck = {
    name: 'Limits',
    language: 'de',
    template: true,
    variables: { cta: { type: 'text', value: 'Book', maxLength: 10, translations: { de: { value: 'Jetzt eine Demo buchen' }, fr: { value: 'Réserver' } } }, steps: { type: 'list', value: ['a'], maxItems: 2, translations: { fr: { value: ['a', 'b', 'c'] } } } },
    slides: [{ title: '{{cta}}', items: 'var:steps' }],
  };
  const found = validate(deck, { only: ['variable-overflow'] }).findings.filter((finding) => finding.ruleId === 'opf/variable-overflow');
  assert.deepEqual(found.map((finding) => finding.path).sort(), ['/variables/cta/translations/de/value', '/variables/steps/translations/fr/value']);
  assert.deepEqual(found.find((finding) => finding.path.includes('/cta/')).measured, { characters: 22, maxLength: 10 });
});

test('maxLines reads the translation drawn on each slide', () => {
  const long = 'Eine sehr lange Überschrift, die weit über den Platz hinausgeht, den die Vorlage für sie vorsieht, und deshalb in mehreren Zeilen umbricht';
  const deck = {
    name: 'Lines',
    language: 'en-US',
    template: true,
    variables: { headline: { type: 'text', value: 'Short', maxLines: 1, translations: { de: { value: long } } } },
    slides: [{ title: '{{headline}}' }, { language: 'de', title: '{{headline}}' }],
  };
  const found = validate(deck, { only: ['variable-overflow'] }).findings.filter((finding) => finding.ruleId === 'opf/variable-overflow');
  assert.deepEqual(found.map((finding) => finding.path), ['/slides/1/title']);
});

test('two keys that differ only in case are a warning, and a translation no language selects is a warning', () => {
  const dupe = bilingual();
  dupe.variables.cta.translations = { 'de-AT': { value: 'Buchen' }, 'de-at': { value: 'Bestellen' }, de: { value: 'Demo buchen' } };
  dupe.slides = [{ language: 'de-AT', text: '{{cta}}' }];
  assert.deepEqual(rules(dupe).filter(([id, , path]) => id.includes('translation') && path.includes('/cta/')), [['opf/variable-translation-duplicate', 'warning', '/variables/cta/translations'], ['opf/variable-translation-unused', 'warning', '/variables/cta/translations/de-at']]);
  assert.equal(drawn(dupe).slides[0].text, 'Buchen');
  const unused = bilingual();
  unused.slides = [{ text: '{{cta}}' }];
  assert.deepEqual(rules(unused).filter(([id]) => id.includes('translation')), [['opf/variable-translation-unused', 'warning', '/variables/cta/translations/fr'], ['opf/variable-translation-unused', 'warning', '/variables/event-date/translations/fr']]);
  // No language declared anywhere: no translation is ever drawn.
  const none = bilingual();
  delete none.language;
  none.slides = [{ text: '{{cta}}' }];
  assert.deepEqual(rules(none).filter(([id]) => id.includes('translation')).map(([, , path]) => path), ['/variables/cta/translations/de', '/variables/cta/translations/fr', '/variables/event-date/translations/fr']);
  assert.deepEqual(rules(bilingual()).filter(([id]) => id.includes('translation')), []);
});

test('the schema takes a language tag as key and the kind\'s own entry, and rejects anything else', () => {
  const one = (variable) => validate({ name: 'S', variables: { field: variable }, slides: [{ title: '{{field}}' }] }, { only: ['format'] });
  assert.equal(one({ type: 'text', value: 'Book', translations: { de: { value: 'Buchen' }, 'zh-Hant': { value: '預訂' } } }).valid, true);
  for (const bad of [
    { type: 'text', value: 'Book', translations: { German: { value: 'Buchen' } } },
    { type: 'text', value: 'Book', translations: { de: 'Buchen' } },
    { type: 'text', value: 'Book', translations: { de: {} } },
    { type: 'text', value: 'Book', translations: { de: { value: 'Buchen', format: 'x' } } },
    { type: 'text', value: 'Book', translations: {} },
    { type: 'number', value: 0.12, translations: { de: { value: 0.12 } } },
    { type: 'color', value: '#000000', translations: { de: { value: '#000000' } } },
    { type: 'date', value: '2026-03-05', translations: { de: { value: '2026-03-05' } } },
    { type: 'list', value: ['a'], translations: { de: { value: 'a' } } },
    { type: 'url', value: 'https://example.com', translations: { de: { value: 'not a link' } } },
  ]) assert.equal(one(bad).valid, false, JSON.stringify(bad));
  assert.equal(one({ type: 'date', value: '2026-03-05', translations: { fr: { format: 'd MMMM yyyy' } } }).valid, true);
});

test('fill: a value without translations removes them and is reported; a record may give its own translations; a date keeps its formats', () => {
  const template = bilingual();
  template.template = true;
  const same = fill(template, { 'event-date': '2026-04-01' });
  assert.equal(same.translationsRemoved, undefined);
  const replaced = fill(template, { cta: 'Join us' });
  assert.deepEqual(replaced.translationsRemoved, [{ id: 'cta', records: [1] }]);
  assert.deepEqual(replaced.decks[0].presentation.slides.map((slide) => slide.text), ['Join us', 'Join us']);
  const own = fill(template, { cta: { value: 'Join us', translations: { de: { value: 'Mach mit' } } } });
  assert.equal(own.translationsRemoved, undefined);
  assert.deepEqual(own.decks[0].presentation.slides.map((slide) => slide.text), ['Mach mit', 'Join us']);
  const onlyTranslations = fill(template, { cta: { translations: { fr: { value: 'Rejoignez-nous' } } } });
  assert.deepEqual(onlyTranslations.decks[0].presentation.slides.map((slide) => slide.text), ['Book a demo', 'Rejoignez-nous']);
  const date = fill(template, { 'event-date': '2026-04-01' });
  assert.match(date.decks[0].presentation.slides[1].title, /^Le .+ 1 .+ 2026 à Paris$/);
  const bad = fill(template, { cta: { translations: { de: { value: 5 }, fr: 'x' } } });
  assert.ok(bad.diagnostics.some((entry) => entry.code === 'variable-invalid-value' && entry.path === '/variables/cta/translations/fr'));
  // A value for a variable with translations is the same everywhere in a partial fill's listing too.
  assert.equal(listVariables(template).find((entry) => entry.id === 'cta').translations.length, 2);
});

test('translations round-trip through Markdown and YAML, a text, a list and a date variable', () => {
  const deck = {
    name: 'Bilingual',
    language: 'de',
    template: true,
    variables: {
      cta: { type: 'text', value: 'Book a demo', translations: { de: { value: 'Demo buchen' }, 'fr-CA': { value: 'Réserver une démo' } } },
      steps: { type: 'list', value: ['One', 'Two'], translations: { de: { value: ['Eins', 'Zwei'] } } },
      day: { type: 'date', value: '2026-03-05', translations: { de: { format: 'd. MMMM yyyy' } } },
    },
    slides: [{ title: '{{cta}} am {{day}}', items: 'var:steps' }],
  };
  assert.deepEqual(fromYaml(toYaml(deck).yaml, { validate: false }).presentation, deck);
  assert.deepEqual(fromMarkdown(toMarkdown(deck).markdown, { validate: false }).presentation, deck);
});
