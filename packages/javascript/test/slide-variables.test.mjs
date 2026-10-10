// FA-31: the slide-scoped built-ins {{slide.number}}, {{slide.section}} and {{deck.slideCount}} in any string,
// header and footer text included (docs/programs/format-audit/fa-31-slide-variables.md).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SLIDE_SCOPED_BUILTINS, listBuiltinVariables, paginate, resolveSlideContext, resolveSlideVariables, resolveVariables } from '../dist/index.js';
import { composeSlide } from '../dist/composition.js';
import { fromMarkdown, toMarkdown } from '../dist/markdown.js';
import { check, errorsOf, warningsOf } from './support/validation.mjs';

const BS = String.fromCharCode(92);
const deck = (extra = {}) => ({
  name: 'Review',
  organization: { id: 'acme', name: 'Acme' },
  design: { header: { left: { text: '{{slide.section}}' } }, footer: { left: { text: '{{organization.name}}' }, right: { text: '{{slide.number}} / {{deck.slideCount}}' } } },
  slides: [
    { id: 'one', section: 'Intro', title: 'Slide {{slide.number}} of {{deck.slideCount}}', text: 'Section: {{slide.section}}', notes: 'Say {{slide.number}}' },
    { id: 'two', section: 'Plan', title: 'Plan', bullets: ['Point {{slide.number}}'] },
  ],
  ...extra,
});
const furnitureText = (geometry, path) => geometry.furniture.parts.find((part) => part.path === path);
const item = (geometry, field) => geometry.items.find((entry) => entry.field === field);

test('the slide-scoped built-ins are listed with a slide scope', () => {
  assert.deepEqual([...SLIDE_SCOPED_BUILTINS], ['slide.number', 'slide.section', 'deck.slideCount']);
  const list = listBuiltinVariables(deck());
  const slide = list.filter((entry) => entry.scope === 'slide' && entry.kind === 'text');
  // The organization logos are slide-scoped images (RR-71).
  assert.ok(list.filter((entry) => entry.scope === 'slide' && entry.kind === 'image').every((entry) => entry.name.startsWith('organization.') && !('value' in entry)));
  assert.deepEqual(slide.map((entry) => [entry.name, entry.kind, entry.label, entry.available, 'value' in entry]), [
    ['slide.number', 'text', 'Slide number', true, false],
    ['slide.section', 'text', 'Section', true, false],
    ['deck.slideCount', 'text', 'Slide count', true, false],
  ]);
  assert.ok(list.filter((entry) => entry.scope === 'deck').every((entry) => !entry.name.startsWith('slide.') && entry.name !== 'deck.slideCount'));
  const number = slide[0];
  assert.deepEqual(number.uses.map((use) => use.path), ['/design/footer/right/text', '/slides/0/title', '/slides/0/notes', '/slides/1/bullets/0']);
  const sectionless = listBuiltinVariables({ slides: [{ title: '{{slide.section}}' }] }).find((entry) => entry.name === 'slide.section');
  assert.equal(sectionless.available, false);
});

test('resolveVariables leaves slide-scoped tokens as written, also on a complete pass, and keeps their escapes', () => {
  const source = deck({ variables: { client: { type: 'text', value: 'Globex' } } });
  source.slides[0].subtitle = `For {{client}} ${BS}{{client}} ${BS}{{slide.number}} ${BS}{{ deck.slideCount }}`;
  const result = resolveVariables(source);
  assert.equal(result.complete, true);
  assert.deepEqual(result.diagnostics, []);
  const [first, second] = result.presentation.slides;
  assert.equal(first.title, 'Slide {{slide.number}} of {{deck.slideCount}}');
  assert.equal(first.text, 'Section: {{slide.section}}');
  assert.equal(second.bullets[0], 'Point {{slide.number}}');
  // A user escape is consumed; the escape in front of a slide-scoped token stays for the per-slide pass.
  assert.equal(first.subtitle, `For Globex {{client}} ${BS}{{slide.number}} ${BS}{{ deck.slideCount }}`);
  assert.equal(result.presentation.design.footer.left.text, 'Acme');
  assert.equal(result.presentation.design.footer.right.text, '{{slide.number}} / {{deck.slideCount}}');
  // Idempotent: resolving the result again changes nothing.
  assert.deepEqual(resolveVariables(result.presentation).presentation, result.presentation);
  // A template and a partial pass never report them either.
  const template = resolveVariables({ ...source, template: true, variables: { client: { type: 'text' } } }, {}, { partial: true });
  assert.ok(template.diagnostics.every((entry) => !entry.id.startsWith('slide.') && entry.id !== 'deck.slideCount'));
});

test('resolveSlideVariables substitutes every string of the slide except extensions and its own header and footer', () => {
  const slide = {
    id: 's', section: 'Results', title: '{{slide.number}}/{{deck.slideCount}}', text: [{ text: 'Run {{slide.section}}', bold: true }],
    table: { columns: ['N'], rows: [['{{ slide.number }}']] }, notes: 'n{{slide.number}}',
    design: { footer: { right: { text: '{{slide.number}}' } }, background: '#ffffff' },
    extensions: { vendor: { keep: '{{slide.number}}' } },
  };
  const before = structuredClone(slide);
  const out = resolveSlideVariables(slide, { slideNumber: 4, slideCount: 9 });
  assert.deepEqual(slide, before, 'the input is never mutated');
  assert.equal(out.title, '4/9');
  assert.deepEqual(out.text, [{ text: 'Run Results', bold: true }]);
  assert.equal(out.table.rows[0][0], '4');
  assert.equal(out.notes, 'n4');
  assert.equal(out.design.footer.right.text, '{{slide.number}}', 'layoutFurniture resolves header and footer text');
  assert.equal(out.extensions.vendor.keep, '{{slide.number}}');
  // Unchanged input is returned as is; a slide without a section resolves {{slide.section}} to nothing.
  const plain = { title: 'Plain', text: '{{client}}' };
  assert.equal(resolveSlideVariables(plain, { slideNumber: 1, slideCount: 1 }), plain);
  assert.equal(resolveSlideVariables({ title: '[{{slide.section}}]' }, { slideNumber: 1, slideCount: 1 }).title, '[]');
  // Unknown slide tokens stay; without a slide count {{deck.slideCount}} stays.
  assert.equal(resolveSlideVariables({ title: '{{slide.other}} {{deck.slideCount}}' }, { slideNumber: 1 }).title, '{{slide.other}} {{deck.slideCount}}');
  assert.throws(() => resolveSlideVariables(plain, { slideNumber: 0, slideCount: 1 }), RangeError);
  assert.throws(() => resolveSlideVariables(plain, { slideNumber: 1, slideCount: 1.5 }), RangeError);
});

test('an escaped {{slide.number}} draws as the literal token in body text and furniture', () => {
  const source = {
    variables: { client: { type: 'text', value: 'Globex' } },
    design: { footer: { right: { text: `${BS}{{slide.number}} is {{slide.number}}` } } },
    slides: [{ title: 'For {{client}}', text: `Write ${BS}{{slide.number}} to get {{slide.number}}.` }],
  };
  const { presentation } = resolveVariables(source);
  const context = resolveSlideContext(presentation, 0, { slideNumber: 3, slideCount: 3 });
  assert.equal(context.slide.text, 'Write {{slide.number}} to get 3.');
  const geometry = composeSlide(context.slide, context.options);
  assert.equal(item(geometry, 'text').value, 'Write {{slide.number}} to get 3.');
  const footer = furnitureText(geometry, 'design.footer.right.text');
  assert.equal(footer.text, '{{slide.number}} is 3');
  assert.deepEqual(footer.fields, [{ type: 'slideNumber', start: 20, end: 21 }]);
});

test('resolveSlideContext returns the substituted slide for its slide number and count', () => {
  const { presentation } = resolveVariables(deck());
  const context = resolveSlideContext(presentation, 1, { slideNumber: 7, slideCount: 12 });
  assert.equal(context.slide.bullets[0], 'Point 7');
  assert.equal(context.options.slideNumber, 7);
  const defaults = resolveSlideContext(presentation, 0);
  assert.equal(defaults.slide.title, 'Slide 1 of 2');
  assert.equal(defaults.slide.text, 'Section: Intro');
  const geometry = composeSlide(defaults.slide, defaults.options);
  assert.equal(furnitureText(geometry, 'design.header.left.text').text, 'Intro');
  assert.equal(furnitureText(geometry, 'design.footer.left.text').text, 'Acme');
  const numbered = furnitureText(geometry, 'design.footer.right.text');
  assert.equal(numbered.text, '1 / 2');
  assert.deepEqual(numbered.fields, [{ type: 'slideNumber', start: 0, end: 1 }]);
  assert.equal(numbered.field, 'text');
  // A slide with no token is shared as is.
  const plain = { slides: [{ title: 'Plain' }] };
  assert.equal(resolveSlideContext(plain, 0).slide, plain.slides[0]);
});

test('pagination numbers continuation pages consecutively, keeps the tokens and counts the final deck', () => {
  const sentence = 'Slide {{slide.number}} of {{deck.slideCount}} carries this sentence with enough detail. ';
  const input = { slides: [{ title: 'Long', text: sentence.repeat(90) }, { title: 'End', text: 'Last {{slide.number}}/{{deck.slideCount}}' }] };
  const before = structuredClone(input);
  const result = paginate(input, { minFontSize: 24 });
  assert.deepEqual(input, before);
  const slides = result.presentation.slides, total = slides.length;
  assert.ok(total > 2, 'the long slide splits');
  // The output is a source document: the tokens are kept, never cut, and the text is unchanged.
  assert.equal(slides.slice(0, -1).map((slide) => slide.text).join(''), input.slides[0].text);
  for (const slide of slides.slice(0, -1)) {
    assert.ok(slide.text.includes('{{slide.number}}'));
    assert.equal(slide.text.split('{{').length, slide.text.split('}}').length, 'no page break inside a token');
  }
  // Drawn per output slide, the numbers are consecutive and the count is the final page count.
  slides.forEach((_, index) => {
    const context = resolveSlideContext(result.presentation, index);
    assert.equal(context.options.slideNumber, index + 1);
    assert.equal(context.options.slideCount, total);
    const text = context.slide.text;
    assert.ok(!text.includes('{{slide.number}}') && !text.includes('{{deck.slideCount}}'));
    if (index === total - 1) assert.equal(text, `Last ${total}/${total}`);
    else assert.ok(text.startsWith(`Slide ${index + 1} of ${total} `), text);
  });
});

test('{{deck.slideCount}} in body text alone triggers the slide-count fixed point', () => {
  const measured = [];
  const textMeasurement = { measure: (text, size) => { if (/^\d+ slides$/.test(text)) measured.push(text); return [...text].length * size / 2; } };
  const input = { slides: [{ title: 'Long', text: 'Detail sentence for the pages. '.repeat(160) }, { title: 'Count', text: '{{deck.slideCount}} slides' }] };
  const result = paginate(input, { minFontSize: 24, fonts: { textMeasurement } });
  const total = result.presentation.slides.length;
  assert.ok(total > 2);
  assert.equal(result.presentation.slides.at(-1).text, '{{deck.slideCount}} slides');
  assert.ok(measured.includes(`${total} slides`), 'the last pass measures the final count');
});

test('validation: unknown slide paths and whole-field slide references are errors; a missing section warns per slide', () => {
  const unknown = check({ slides: [{ section: 'A', title: '{{slide.title}}', image: 'var:slide.number', subtitle: 'var:deck.slideCount' }] });
  assert.deepEqual(errorsOf(unknown).filter((entry) => entry.ruleId === 'opf/variable-unknown-builtin').map((entry) => entry.path).sort(), ['/slides/0/image', '/slides/0/subtitle', '/slides/0/title']);
  assert.match(errorsOf(unknown).find((entry) => entry.path === '/slides/0/image').message, /inline token/);
  // The deck-wide pass and variable-unfilled never report the known tokens.
  const ok = check(deck());
  assert.equal(ok.valid, true, JSON.stringify(errorsOf(ok)));
  assert.deepEqual(warningsOf(ok).filter((entry) => entry.ruleId?.startsWith('opf/variable-')), []);
  // Inherited header text: a slide without a section is warned at that slide; a slide that overrides the header is not.
  const missing = deck();
  missing.slides = [{ title: 'No section' }, { title: 'Own header', design: { header: { left: { text: 'Fixed' } } } }, { section: 'S', title: 'Has one' }, { title: 'Direct {{slide.section}}', design: { header: false } }];
  const report = check(missing, { only: ['format', 'content'] });
  assert.equal(report.valid, true);
  const warned = warningsOf(report).filter((entry) => entry.ruleId === 'opf/variable-builtin-missing');
  assert.deepEqual(warned.map((entry) => entry.path), ['/slides/0', '/slides/3']);
  // Removed 0.16 keys are invalid.
  for (const key of ['organization', 'speaker', 'section', 'slideNumber', 'slideNumberFormat']) {
    const old = deck();
    old.design.footer.right = { [key]: key === 'slideNumberFormat' ? '{current} / {total}' : true };
    assert.equal(check(old).valid, false, key);
  }
});

test('header, footer and body tokens round-trip through Markdown, escapes included', () => {
  const source = deck();
  source.slides[0].text = `Literal ${BS}{{slide.number}} and {{slide.number}} in {{slide.section}}`;
  const markdown = toMarkdown(source).markdown;
  assert.ok(markdown.includes('{{slide.number}} / {{deck.slideCount}}'));
  const back = fromMarkdown(markdown);
  assert.equal(back.valid, true, JSON.stringify(back.findings?.filter((entry) => entry.severity === 'error')));
  assert.deepEqual(back.presentation.design, source.design);
  assert.equal(back.presentation.slides[0].title, source.slides[0].title);
  assert.equal(back.presentation.slides[0].text, source.slides[0].text);
  assert.equal(back.presentation.slides[0].notes, source.slides[0].notes);
  assert.ok(JSON.stringify(back.presentation.slides[1]).includes('"Point {{slide.number}}"'));
  // Markdown to OPF to Markdown is stable.
  assert.equal(toMarkdown(back.presentation).markdown, markdown);
});
