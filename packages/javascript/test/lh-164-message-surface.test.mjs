// LH-164: a slide whose whole body is one display message takes the accent surface (never two in a row, never over a surface the author set);
// LH-163: its bold words draw in a lighter tint of the primary where the primary itself does not read. Left to right and right to left.
import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colorContrast, composeSlide, SHORT_MESSAGE_WORDS } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

const words = {
  en: {
    title: 'Catalog Overrides',
    message: 'Document-local catalog records can be referenced by id from the same OPF document.',
    long: Array.from({ length: SHORT_MESSAGE_WORDS + 5 }, (_, index) => `word${index}`).join(' '),
    statement: 'Reliability is the feature customers pay for',
    support: 'Every roadmap decision in 2027 starts with one question: does it make the service more dependable?',
    emphasis: ['Customers do not buy software. ', { text: 'They buy fewer bad Mondays.', bold: true }],
  },
  ar: {
    title: 'تجاوزات الفهرس',
    message: 'يمكن الإشارة إلى سجلات الفهرس المحلية في المستند بمعرفها من المستند نفسه.',
    long: Array.from({ length: SHORT_MESSAGE_WORDS + 5 }, (_, index) => `كلمة${index}`).join(' '),
    statement: 'الموثوقية هي الميزة التي يدفع العملاء ثمنها',
    support: 'كل قرار في خطة العام القادم يبدأ بسؤال واحد: هل يجعل الخدمة أكثر اعتمادية؟',
    emphasis: ['العملاء لا يشترون البرمجيات. ', { text: 'إنهم يشترون أياما أقل سوءا.', bold: true }],
  },
};
const context = (deck, index) => resolveSlideContext(deck, index, { catalogs: [gallery] });
const surface = (deck, index) => context(deck, index).resolved.messageSurface;
const deckOf = (slides, design, language = 'en-US') => ({ name: 'Surfaces', language, ...(design ? { design } : {}), slides });
const accentOf = (deck) => context(deck, 0).resolved.roles.accents[0];

for (const [direction, text, language] of [['ltr', words.en, 'en-US'], ['rtl', words.ar, 'ar']]) {
  const message = { title: text.title, text: text.message };

  test(`LH-164 (${direction}): a title over one short text takes the accent surface, reported as the reason`, () => {
    const deck = deckOf([message], undefined, language);
    const { resolved, options, slide } = context(deck, 0);
    assert.equal(resolved.messageSurface?.kind, 'display-message');
    assert.deepEqual(resolved.messageSurface.variant, { background: 'accent1' });
    assert.deepEqual(resolved.layoutVariant, resolved.messageSurface.variant, 'the engines read the variant the way they read a layout');
    assert.equal(resolved.roles.background.toUpperCase(), accentOf(deck).toUpperCase(), 'the slide is the accent');
    assert.ok(colorContrast(resolved.roles.text, resolved.roles.background) >= 4.5, 'the text follows the surface');
    assert.equal(options.darkBackground, resolved.roles.dark);
    assert.deepEqual(composeSlide(slide, options).surface, resolved.messageSurface, 'composition reports it');
    assert.equal(composeSlide(slide, { ...options, messageSurface: undefined }).surface, undefined, 'and only when it was asked for');
  });

  test(`LH-164 (${direction}): only a body that is one message takes it`, () => {
    const cases = {
      'a long text': { title: text.title, text: text.long },
      'two blocks': { title: text.title, blocks: [{ text: text.message }, { text: text.message }] },
      'a text and a list': { title: text.title, text: text.message, items: ['One', 'Two'] },
      'a metric': { title: text.title, metric: { value: '14', label: text.title } },
      'a subtitle': { title: text.title, subtitle: text.title, text: text.message },
      'a cited text': { title: text.title, text: [{ text: text.message, cite: 'source' }] },
      'a title only': { title: text.title },
    };
    for (const [name, slide] of Object.entries(cases)) assert.equal(surface(deckOf([slide], undefined, language), 0), undefined, name);
    for (const layout of ['pillars', 'three-column', 'comparison', 'cover', 'image']) assert.equal(surface(deckOf([{ layout, ...message }], undefined, language), 0), undefined, `${layout} asks for more than one message`);
    // A title-less short text is the message itself; a block of the same text does as well.
    assert.equal(surface(deckOf([{ text: text.message }], undefined, language), 0)?.kind, 'display-message');
    assert.equal(surface(deckOf([{ title: text.title, blocks: [{ text: text.message }] }], undefined, language), 0)?.kind, 'display-message');
  });

  test(`LH-164 (${direction}): a statement's message takes it, a statement's metric keeps the plain surface`, () => {
    const deck = deckOf([
      { layout: 'statement', title: text.statement, blocks: [{ region: 'message', text: text.support }] },
      { layout: 'statement', title: text.title, blocks: [{ region: 'message', metric: { value: '14', label: text.title } }] },
    ], undefined, language);
    assert.equal(surface(deck, 0)?.kind, 'statement-message');
    assert.equal(context(deck, 0).resolved.roles.background.toUpperCase(), accentOf(deck).toUpperCase(), 'the accent replaces the statement\'s own surface');
    assert.equal(surface(deck, 1), undefined);
    assert.notEqual(context(deck, 1).resolved.roles.background.toUpperCase(), accentOf(deck).toUpperCase(), "the metric keeps the statement record's surface");
  });

  test(`LH-164 (${direction}): never two accent surfaces on consecutive slides`, () => {
    const content = { title: text.title, items: ['One', 'Two'] };
    const deck = deckOf([message, message, message, content, message, { layout: 'section', title: text.title }, message, message], undefined, language);
    assert.deepEqual(deck.slides.map((_, index) => surface(deck, index) !== undefined), [true, false, true, false, true, false, false, true],
      'a run alternates; a message after a content slide starts one; after a section (the accent its layout names) the message keeps the plain surface');
    assert.equal(context(deck, 5).resolved.layoutVariant?.background, 'accent1', 'the section keeps its own');
  });

  test(`LH-164 (${direction}): the author's surface and a fixed deck background win`, () => {
    const own = [{ ...message, design: { variant: 'dark1' } }, { ...message, design: { background: '#112233' } }, { ...message, design: { background: 'light2' } }];
    const deck = deckOf(own, undefined, language);
    for (const index of own.keys()) assert.equal(surface(deck, index), undefined, `slide ${index + 1} sets its own surface`);
    for (const background of ['#0B1020', { type: 'solid', color: '#7A1F3D' }, { type: 'solid', color: 'var:brand' }, 'https://example.com/bg.jpg']) {
      const fixed = { ...deckOf([message], { background }, language), variables: { brand: '#5B2333' } };
      assert.equal(surface(fixed, 0), undefined, `a fixed deck background (${JSON.stringify(background)})`);
    }
    for (const background of [{ type: 'solid', color: 'accent2' }, { type: 'solid', color: 'primary' }]) assert.equal(surface(deckOf([message], { background }, language), 0), undefined, `a chosen scheme color (${JSON.stringify(background)})`);
    // The neutral theme slots are the deck's plain surface: they yield, as they do to a layout's variant (LH-103).
    for (const background of ['light1', 'light2', { type: 'theme', slot: 'light1' }]) assert.equal(surface(deckOf([message], { background }, language), 0)?.kind, 'display-message', JSON.stringify(background));
  });

  test(`LH-164 (${direction}): a deliberately dark deck keeps its background`, () => {
    for (const design of [{ background: 'dark1' }, { background: 'dark2' }, { background: { type: 'theme', slot: 'dark1' } }, { variant: 'dark1' }, { theme: 'minimal' }]) assert.equal(surface(deckOf([message], design, language), 0), undefined, JSON.stringify(design));
    // The engine default (no theme, no background) is no choice of the deck's; a light theme and a light deck take it.
    assert.equal(surface(deckOf([message], undefined, language), 0)?.kind, 'display-message');
    assert.equal(surface(deckOf([message], { theme: 'classic' }, language), 0)?.kind, 'display-message');
  });

  test(`LH-164 (${direction}): an accent too bright or too saturated to fill a slide keeps the plain surface`, () => {
    const verdicts = { 'cool-horizon': true, 'forest-green': true, 'steel-blue': true, luxury: true, 'bold-red': true, 'deep-purple': true, boost: false, 'corporate-blue': false, vibes: false, 'burnt-orange': false, 'golden-yellow': false, 'pastel-red': false, 'slate-gray': false };
    for (const [colorScheme, takes] of Object.entries(verdicts)) assert.equal(surface(deckOf([message], { background: 'light1', colorScheme }, language), 0) !== undefined, takes, colorScheme);
  });

  test(`LH-164 (${direction}): a layout that names its own variant keeps it`, () => {
    const deck = deckOf([{ layout: 'section', title: text.title, text: text.message }, { layout: 'closing', title: text.title, text: text.message }], undefined, language);
    assert.equal(surface(deck, 0), undefined);
    assert.equal(surface(deck, 1), undefined);
  });

  test(`LH-164 (${direction}): a theme without a usable accent keeps the plain surface`, () => {
    const colorScheme = { name: 'Pale', light1: '#FFFFFF', dark1: '#303030', light2: '#F2EFE9', dark2: '#2B3A4A', accent1: '#808080', accent2: '#F4D35E', accent3: '#707070', accent4: '#8E44AD', accent5: '#F39C12', accent6: '#16A085', hyperlink: '#0563C1', followedHyperlink: '#954F72' };
    const deck = { ...deckOf([message], { colorScheme: 'local:pale' }, language), catalogs: { local: { source: 'https://example.com/local', colorSchemes: { pale: colorScheme } } } };
    const { resolved } = resolveSlideContext(deck, 0, { catalogs: [gallery] });
    // #808080 reaches 4.5:1 with neither the light nor the dark text: the accent cannot carry the message.
    assert.ok(Math.max(colorContrast('#FFFFFF', '#808080') ?? 0, colorContrast('#303030', '#808080') ?? 0) < 4.5);
    assert.equal(resolved.messageSurface, undefined);
  });

  test(`LH-163 (${direction}): the bold words draw in a lighter tint of the primary where the primary does not read`, () => {
    const colors = (result) => result.items.find((entry) => entry.field === 'text').text.richLines.flatMap((line) => line.fragments.map((fragment) => fragment.run.color));
    const options = { direction };
    const on = (roles) => composeSlide({ title: text.title, text: text.emphasis }, { ...options, roles });
    const navy = { text: '#FFFFFF', textSecondary: '#DDE6F0', primary: '#2874A6', background: '#001840' };
    const tinted = colors(on(navy)).find((color) => typeof color === 'string' && color.startsWith('#'));
    assert.ok(tinted, 'a tint of the primary, where #2874A6 reads only 3.6:1 on navy');
    assert.ok(colorContrast(tinted, navy.background) >= 4.5, `${tinted} reads 4.5:1`);
    assert.ok(colorContrast('#2874A6', navy.background) < 4.5);
    assert.ok(colors(on(navy)).includes(undefined), 'the rest of the message keeps the text color');
    // On the accent surface the primary is the surface itself.
    const accent = { text: '#FFFFFF', textSecondary: '#EEEEEE', primary: '#2874A6', background: '#2874A6' };
    const onAccent = colors(on(accent)).find((color) => typeof color === 'string' && color.startsWith('#'));
    assert.ok(onAccent && colorContrast(onAccent, accent.background) >= 4.5, 'a lighter tint on the accent surface');
    // Where the primary reads it stays the role (LH-09); a light surface gets no tint.
    assert.ok(colors(on({ text: '#000000', textSecondary: '#444444', primary: '#1F4E99', background: '#FFFFFF' })).includes('primary'));
    assert.ok(!colors(on({ text: '#000000', textSecondary: '#444444', primary: '#E8E04A', background: '#FFFFFF' })).some((color) => color !== undefined), 'no tint on a light surface');
    const value = on(navy).items.find((entry) => entry.field === 'text').value;
    assert.deepEqual(value, text.emphasis, 'the document is unchanged');
  });
}

test('LH-164: the surface reaches the engines through the slide context (layoutVariant), and a slide on it composes with its roles', () => {
  const deck = deckOf([{ title: words.en.title, text: words.en.message }]);
  const { slide, options, resolved } = context(deck, 0);
  assert.equal(options.roles.background.toUpperCase(), resolved.roles.background.toUpperCase());
  const result = composeSlide(slide, options);
  assert.deepEqual(result.diagnostics.filter((entry) => ['text-overflow', 'small-cell', 'layout-unplaced'].includes(entry.code)), []);
});

test('LH-164: on the accent surface a color the author set for a run that does not read draws in one that does, the document unchanged', () => {
  const authored = ['Tandem BioSystems should focus on ', { text: 'close audit evidence gaps', bold: true, color: '#1B49CB' }, ' before the assessment.'];
  const deck = deckOf([{ title: 'Why This Matters', text: authored }]);
  const { slide, options } = context(deck, 0);
  assert.ok(options.messageSurface, 'a message surface');
  const result = composeSlide(slide, options), shown = result.items.find((entry) => entry.field === 'text');
  const colors = shown.text.richLines.flatMap((line) => line.fragments.map((fragment) => fragment.run.color)).filter((color) => color !== undefined);
  assert.ok(colors.length && colors.every((color) => colorContrast(color, options.roles.background) >= 4.5), `${colors} read on ${options.roles.background}`);
  assert.deepEqual(shown.value, authored);
  // Off the surface the author's color is left alone.
  const plain = composeSlide(slide, { ...options, messageSurface: undefined, roles: { ...options.roles, background: '#FFFFFF', text: '#000000' } });
  assert.ok(plain.items.find((entry) => entry.field === 'text').text.richLines.some((line) => line.fragments.some((fragment) => fragment.run.color === '#1B49CB')));
});

test('LH-164: a color named by a role, a scheme slot or a variable that does not read on the surface is drawn in one that does', () => {
  for (const color of ['accent1', 'secondary', 'accent', 'var:brand']) {
    const authored = ['Focus on ', { text: 'the named color', bold: true, color }, ' while making the tradeoffs clear.'];
    const deck = { ...deckOf([{ title: 'Why This Matters', text: authored }]), variables: { brand: '#2874A7' } };
    const { slide, options } = context(deck, 0);
    const shown = composeSlide(slide, options).items.find((entry) => entry.field === 'text');
    const colors = shown.text.richLines.flatMap((line) => line.fragments.map((fragment) => fragment.run.color)).filter((value) => value !== undefined);
    assert.ok(colors.length && colors.every((value) => colorContrast(options.resolveRunColor(value) ?? value, options.roles.background) >= 4.5), `${color}: ${colors}`);
    assert.deepEqual(shown.value, authored);
  }
});
