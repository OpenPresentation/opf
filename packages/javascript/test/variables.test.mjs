import assert from 'node:assert/strict';
import {test} from 'node:test';
import { OPFVariableError, coerceVariableValue, formatVariableNumber, isTemplate, listVariables, resolveVariables, validate } from '../dist/index.js';
import { errorsOf, warningsOf } from './support/validation.mjs';

// The format findings and every variable rule, with the findings split by severity as `errors` and `warnings`.
const VARIABLE_RULES = ['opf/variable-unfilled', 'opf/variable-unknown', 'opf/variable-unknown-value', 'opf/variable-unused', 'opf/variable-reference-unknown'];
const checked = (document, options = {}) => {
  const report = validate(document, { only: ['format', ...VARIABLE_RULES], ...options });
  return { ...report, errors: errorsOf(report), warnings: warningsOf(report) };
};

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};
const clone = (value) => JSON.parse(JSON.stringify(value));
// A literal backslash, spelled out so no shell or editor re-escapes it.
const BS = String.fromCharCode(92);

const template = () => ({
  template: true,
  name: 'QBR for {{client-name}}',
  variables: {
    'client-name': {type: 'text', label: 'Client', example: 'Acme Corp'},
    revenue: {type: 'number', format: '$#,##0', example: 1250000},
    'review-date': {type: 'date', example: '2026-10-01'},
    wins: {type: 'list', example: ['Faster onboarding', 'Lower churn']},
    logo: {type: 'image', example: 'asset:placeholder-logo'},
    site: {type: 'url', required: false},
    risk: '#B42318',
  },
  assets: {'placeholder-logo': './assets/logo.svg'},
  slides: [
    {id: 'cover', title: 'Quarterly review: {{client-name}}', subtitle: 'Held {{review-date}}', image: 'var:logo'},
    {id: 'wins', title: 'Wins', bullets: ['Revenue {{revenue}}', 'var:wins', 'Done']},
    {id: 'chart', title: 'Revenue', chart: {type: 'column', data: {columns: ['Quarter', 'Revenue'], rows: [['Q3', 'var:revenue']]}}},
    {id: 'link', title: 'More', text: [{text: 'Visit {{site}}', link: 'var:site'}]},
  ],
});

const values = {
  'client-name': 'Globex',
  revenue: '1234567',
  'review-date': '2026-10-01',
  wins: ['Shipped v2', 'Won renewal'],
  logo: 'asset:globex',
};

const handWritten = () => ({
  name: 'QBR for Globex',
  variables: {risk: '#B42318'},
  assets: {'placeholder-logo': './assets/logo.svg'},
  slides: [
    {id: 'cover', title: 'Quarterly review: Globex', subtitle: 'Held October 1, 2026', image: 'asset:globex'},
    {id: 'wins', title: 'Wins', bullets: ['Revenue $1,234,567', 'Shipped v2', 'Won renewal', 'Done']},
    {id: 'chart', title: 'Revenue', chart: {type: 'column', data: {columns: ['Quarter', 'Revenue'], rows: [['Q3', 1234567]]}}},
    {id: 'link', title: 'More', text: [{text: 'Visit '}]},
  ],
});

test('a template plus values resolves to the hand-written deck and never mutates its input', () => {
  const input = deepFreeze(template());
  const result = resolveVariables(input, values);
  assert.equal(result.complete, true);
  assert.deepEqual(result.unfilled, []);
  assert.equal('template' in result.presentation, false);
  assert.deepEqual(result.presentation, handWritten());
  assert.equal(checked(result.presentation).valid, true, JSON.stringify(errorsOf(checked(result.presentation))));
  // Idempotent: a resolved deck declares no content variables, so resolving it again is a no-op.
  const again = resolveVariables(result.presentation, {});
  assert.deepEqual(again.presentation, result.presentation);
  assert.equal(again.presentation, result.presentation);
});

test('decks without content variables resolve by identity and keep color variables working', () => {
  const plain = {variables: {risk: '#B42318', 'brand-blue': {type: 'color', value: '#0F4C81'}}, slides: [{id: 's', text: 'a {{b}} c', code: undefined}].map(clone)};
  const result = resolveVariables(plain);
  assert.equal(result.presentation, plain);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(checked(plain).valid, true);
  // Literal braces in a deck that never declared content variables are plain text to the references check.
  assert.equal(validate(plain, {only: ['references']}).findings.length, 0);
  // The format check notes a token that looks like scaffolding (opf/variable-unfilled), as a warning that never makes the deck invalid.
  assert.deepEqual(checked(plain).warnings.map((entry) => [entry.ruleId, entry.path]), [['opf/variable-unfilled', '/slides/0/text']]);
  // A value for a color variable overrides it while keeping the 'var:' references valid.
  const recolored = resolveVariables(plain, {risk: '#112233'});
  assert.deepEqual(recolored.presentation.variables.risk, {type: 'color', value: '#112233'});
  assert.equal(recolored.presentation.slides, plain.slides);
});

test('validation treats a template as an incomplete deck and a normal deck as an error', () => {
  const asTemplate = checked(template());
  assert.equal(asTemplate.valid, true, JSON.stringify(errorsOf(asTemplate)));
  assert.equal(asTemplate.template, true);
  assert.deepEqual(asTemplate.unfilledVariables, ['client-name', 'revenue', 'review-date', 'wins', 'logo']);
  // A template reports its unfilled variables as warnings (a normal deck reports them as errors, below).
  assert.deepEqual(asTemplate.warnings.map((entry) => [entry.ruleId, entry.path]), asTemplate.unfilledVariables.map((id) => ['opf/variable-unfilled', `/variables/${id}`]));
  assert.equal(isTemplate(template()), true);

  const normal = template();
  delete normal.template;
  const asDeck = checked(normal);
  assert.equal(asDeck.valid, false);
  assert.equal(asDeck.template, false);
  assert.deepEqual(asDeck.errors.map((error) => error.path), ['/variables/client-name', '/variables/revenue', '/variables/review-date', '/variables/wins', '/variables/logo']);
  assert.match(asDeck.errors[0].message, /required variable 'client-name' has no value/);
  // Optional and valued variables are never unfilled.
  assert.equal(asDeck.errors.some((error) => error.path.endsWith('/site') || error.path.endsWith('/risk')), false);

  // The validate options override the marker, and values fill the deck before it is checked.
  assert.equal(checked(normal, {template: true}).valid, true);
  assert.equal(checked(normal, {values}).valid, true);
  assert.equal(checked(template(), {template: false}).valid, false);
});

test('a filled variable in a typed position is checked as the value it becomes, with source paths', () => {
  const deck = template();
  delete deck.template;
  Object.assign(deck.variables['client-name'], {value: 'Acme'});
  Object.assign(deck.variables.revenue, {value: 'not a number'});
  const result = checked(deck, {values: {revenue: 'abc', 'review-date': '2026-10-01', wins: ['a'], logo: 'asset:x'}});
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.path === '/variables/revenue' && /number/.test(error.message)), JSON.stringify(errorsOf(result)));
});

test('variable declaration errors name the declared kind only', () => {
  const bad = checked({variables: {n: {type: 'number', value: 'text'}, o: {type: 'sparkle'}, d: {type: 'date', value: '10/01/2026'}}, slides: [{id: 's', title: 'x'}]});
  assert.equal(bad.valid, false);
  const paths = bad.errors.map((error) => error.path);
  assert.ok(paths.includes('/variables/n/value'));
  assert.ok(paths.includes('/variables/o/type'));
  assert.ok(paths.includes('/variables/d/value'));
  assert.ok(bad.errors.length === 3, JSON.stringify(errorsOf(bad)));
  assert.ok(bad.errors.every((error) => error.validation.keyword !== 'oneOf'), JSON.stringify(errorsOf(bad)));
  const unknown = bad.errors.find((error) => error.path === '/variables/o/type');
  assert.match(unknown.message, /color, text, number, date, image, url, list/);
  // Hex shorthand and the original color object stay valid.
  assert.equal(checked({variables: {a: '#fff', b: {type: 'color', value: '#112233', description: 'x'}}, slides: [{id: 's', title: 'x'}]}).valid, true);
});

test('previews of a template use examples, never invent content, and mark what was used', () => {
  const result = resolveVariables(template(), {}, {examples: true});
  assert.equal(result.complete, true);
  assert.deepEqual(result.examplesUsed, ['client-name', 'revenue', 'review-date', 'wins', 'logo']);
  const slides = result.presentation.slides;
  assert.equal(slides[0].title, 'Quarterly review: Acme Corp');
  assert.deepEqual(slides[1].bullets, ['Revenue $1,250,000', 'Faster onboarding', 'Lower churn', 'Done']);
  assert.equal(slides[2].chart.data.rows[0][1], 1250000);
  // A variable with no example stays visibly unfilled instead of receiving made-up text.
  const bare = {template: true, variables: {who: {type: 'text'}}, slides: [{id: 's', title: 'Hi {{who}}'}]};
  const preview = resolveVariables(bare, {}, {examples: true});
  assert.equal(preview.presentation.slides[0].title, 'Hi {{who}}');
  assert.deepEqual(preview.unfilled, ['who']);
  assert.equal(preview.presentation.template, true);
  assert.deepEqual(Object.keys(preview.presentation.variables), ['who']);
});

test('unfilled required variables are errors for a deck, informational for a template, and strict mode throws', () => {
  const deck = {variables: {who: {type: 'text'}}, slides: [{id: 's', title: 'Hi {{who}}'}]};
  const result = resolveVariables(deck);
  assert.equal(result.complete, false);
  assert.equal(result.diagnostics[0].code, 'variable-unfilled');
  assert.equal(result.diagnostics[0].severity, 'error');
  assert.throws(() => resolveVariables(deck, {}, {strict: true}), (error) => error instanceof OPFVariableError && /who/.test(error.message));
  const lenient = resolveVariables(deck, {}, {template: true});
  assert.equal(lenient.diagnostics[0].severity, 'info');
  const partial = resolveVariables(deck, {}, {partial: true});
  assert.equal(partial.diagnostics[0].severity, 'info');
});

test('a partial fill keeps the unfilled declarations so a second pass completes the deck', () => {
  const input = {
    template: true,
    variables: {a: {type: 'text'}, b: {type: 'text'}},
    slides: [{id: 's', title: '{{a}} and {{b}}', text: BS + '{{b}} stays'}],
  };
  const first = resolveVariables(input, {a: 'one'});
  assert.equal(first.complete, false);
  assert.equal(first.presentation.template, true);
  assert.deepEqual(first.presentation.variables, {b: {type: 'text'}});
  assert.equal(first.presentation.slides[0].title, 'one and {{b}}');
  // The escape survives the partial pass, so it still means a literal brace on the next one.
  assert.equal(first.presentation.slides[0].text, BS + '{{b}} stays');
  const second = resolveVariables(first.presentation, {b: 'two'});
  assert.equal(second.complete, true);
  assert.equal(second.presentation.slides[0].title, 'one and two');
  assert.equal(second.presentation.slides[0].text, '{{b}} stays');
  assert.equal('template' in second.presentation, false);
});

test('optional variables disappear when unfilled', () => {
  const doc = {variables: {tag: {type: 'text', required: false}, pic: {type: 'image', required: false}}, slides: [{id: 's', title: 'Hi{{tag}}', image: 'var:pic', subtitle: 'x'}]};
  const result = resolveVariables(doc);
  assert.equal(result.complete, true);
  assert.deepEqual(result.presentation.slides[0], {id: 's', title: 'Hi', subtitle: 'x'});
  assert.equal(result.presentation.variables, undefined);
});

test('escapes, unknown tokens, formats, and code content', () => {
  const doc = {
    variables: {amount: {type: 'number', value: 0.256, format: '0.#%'}, when: {type: 'date', value: '2026-03-09'}, tags: {type: 'list', value: ['a', 'b', 'c']}, name: {type: 'text', value: 'Ada'}},
    slides: [{
      id: 's',
      title: '{{name}} {{ name }} ' + BS + '{{name}} {{missing}}',
      subtitle: '{{amount}} {{amount|0.00%}} {{when}} {{when|dd MMM yyyy}} {{when|EEEE}}',
      text: '{{tags}} / {{tags|; }}',
      code: {language: 'js', code: 'const x = {{name}};'},
    }],
  };
  const result = resolveVariables(doc);
  const slide = result.presentation.slides[0];
  assert.equal(slide.title, 'Ada Ada {{name}} {{missing}}');
  assert.equal(slide.subtitle, '25.6% 25.60% March 9, 2026 09 Mar 2026 Monday');
  assert.equal(slide.text, 'a, b, c / a; b; c');
  assert.equal(slide.code.code, 'const x = Ada;');
  const warning = result.diagnostics.find((entry) => entry.code === 'variable-unknown');
  assert.equal(warning.id, 'missing');
  assert.equal(warning.path, '/slides/0/title');
});

test('rich text is kept by a whole-field reference and flattened inline', () => {
  const runs = [{text: 'Hello ', bold: true}, 'world'];
  const doc = {variables: {greeting: {type: 'text', value: runs}}, slides: [{id: 's', text: 'var:greeting', subtitle: 'Say: {{greeting}}', bullets: [{text: 'var:greeting'}]}]};
  const result = resolveVariables(doc);
  assert.deepEqual(result.presentation.slides[0].text, runs);
  assert.notEqual(result.presentation.slides[0].text, runs);
  assert.equal(result.presentation.slides[0].subtitle, 'Say: Hello world');
  assert.deepEqual(result.presentation.slides[0].bullets, [{text: runs}]);
  assert.ok(result.diagnostics.some((entry) => entry.code === 'variable-rich-flattened'));
  assert.equal(checked(result.presentation).valid, true);
});

test('values are coerced per kind and rejected with a precise diagnostic', () => {
  assert.deepEqual(coerceVariableValue('number', ' 12.5 '), {ok: true, value: 12.5});
  assert.equal(coerceVariableValue('number', '1,000').ok, false);
  assert.equal(coerceVariableValue('number', Infinity).ok, false);
  assert.deepEqual(coerceVariableValue('date', '2026-10-01T09:00:00Z'), {ok: true, value: '2026-10-01'});
  assert.equal(coerceVariableValue('date', '2026-02-30').ok, false);
  assert.deepEqual(coerceVariableValue('list', 'a\r\n b \n\nc'), {ok: true, value: ['a', 'b', 'c']});
  assert.deepEqual(coerceVariableValue('list', [1, 'x']), {ok: true, value: ['1', 'x']});
  assert.equal(coerceVariableValue('url', 'ftp://x').ok, false);
  assert.equal(coerceVariableValue('url', 'mailto:a@b.co').ok, true);
  assert.equal(coerceVariableValue('image', {src: ''}).ok, false);
  assert.equal(coerceVariableValue('color', '#12').ok, false);
  assert.deepEqual(coerceVariableValue('text', 42), {ok: true, value: '42'});

  const doc = {variables: {n: {type: 'number', value: 1}, extra: {type: 'text', value: 'x'}}, slides: [{id: 's', title: '{{n}} {{extra}}'}]};
  const result = resolveVariables(doc, {n: 'abc', nope: 1});
  // A rejected value falls back to the declaration; the diagnostics say why.
  assert.equal(result.presentation.slides[0].title, '1 x');
  assert.deepEqual(result.diagnostics.map((entry) => `${entry.code}:${entry.id}`).sort(), ['variable-invalid-value:n', 'variable-unknown-value:nope']);
  assert.throws(() => resolveVariables(doc, {n: 'abc'}, {strict: true}), OPFVariableError);
  // Blank cells mean "not provided" for every kind except text.
  const blank = resolveVariables(doc, {n: '', extra: ''});
  assert.equal(blank.presentation.slides[0].title, '1 ');
});

test('number formats', () => {
  const f = (value, pattern) => formatVariableNumber(value, pattern).text;
  assert.equal(f(1234.5), '1234.5');
  assert.equal(f(1234567, '#,##0'), '1,234,567');
  assert.equal(f(1234.5, '#,##0.00'), '1,234.50');
  assert.equal(f(1234.5, '#,##0.##'), '1,234.5');
  assert.equal(f(1.005, '0.00'), '1.01');
  assert.equal(f(-1234.567, '$#,##0.0'), '-$1,234.6');
  assert.equal(f(0.5, '#.00'), '.50');
  assert.equal(f(0.5, '0'), '1');
  assert.equal(f(7, '000'), '007');
  assert.equal(f(12.3456, '0.0M'), '12.3M');
  assert.equal(f(0.256, '0%'), '26%');
  assert.equal(f(-0.0001, '0.0'), '0.0');
  assert.equal(f(1e21, '#,##0'), '1,000,000,000,000,000,000,000');
  assert.equal(f(0, '#'), '0');
  assert.ok('error' in formatVariableNumber(1, 'abc'));
  assert.ok('error' in formatVariableNumber(NaN, '0'));
});

test('image variables supply a string or an Asset object, and list variables splice', () => {
  const doc = {
    variables: {hero: {type: 'image', value: {src: 'https://example.com/a.png', alt: 'A chart'}}, pts: {type: 'list', value: ['x', 'y']}, none: {type: 'list', value: []}},
    slides: [{id: 's', image: 'var:hero', bullets: ['first', 'var:pts', 'var:none', 'last'], items: 'var:pts', subtitle: '{{hero}}'}],
  };
  const slide = resolveVariables(doc).presentation.slides[0];
  assert.deepEqual(slide.image, {src: 'https://example.com/a.png', alt: 'A chart'});
  assert.deepEqual(slide.bullets, ['first', 'x', 'y', 'last']);
  assert.deepEqual(slide.items, ['x', 'y']);
  assert.equal(slide.subtitle, 'https://example.com/a.png');
  assert.equal(checked(resolveVariables(doc).presentation).valid, true);
});

test('listVariables reports kind, state and every use for fill forms', () => {
  const info = listVariables(template(), {'client-name': 'Globex'});
  const byId = Object.fromEntries(info.map((entry) => [entry.id, entry]));
  assert.equal(byId['client-name'].filled, true);
  assert.equal(byId['client-name'].value, 'Globex');
  assert.equal(byId['client-name'].label, 'Client');
  assert.equal(byId.revenue.filled, false);
  assert.equal(byId.revenue.format, '$#,##0');
  assert.deepEqual(byId['client-name'].uses.map((use) => use.path), ['/name', '/slides/0/title']);
  assert.deepEqual(byId.logo.uses, [{id: 'logo', path: '/slides/0/image', form: 'reference'}]);
  assert.equal(byId.risk.kind, 'color');
  assert.equal(byId.risk.filled, true);
  assert.equal(byId.site.required, false);
});

test('declared but unused content variables and undeclared tokens warn once the deck uses variables', () => {
  const doc = {variables: {unused: {type: 'text', value: 'x'}, used: {type: 'text', value: 'y'}}, slides: [{id: 's', title: '{{used}} {{ghost}}'}]};
  const result = checked(doc);
  assert.equal(result.valid, true);
  const messages = result.warnings.map((warning) => warning.message).join('\n');
  assert.match(messages, /'unused' is declared but never used/);
  assert.match(messages, /'{{ghost}}' names no declared variable/);
});

test('resolving is deterministic and does not depend on key order of values', () => {
  const a = resolveVariables(template(), values).presentation;
  const reordered = Object.fromEntries(Object.entries(values).reverse());
  const b = resolveVariables(template(), reordered).presentation;
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('the documented quarterly review template validates, fills, and previews from its examples', async () => {
  const {readFile} = await import('node:fs/promises');
  const read = async (name) => JSON.parse(await readFile(new URL(`../../../docs/fixtures/${name}`, import.meta.url), 'utf8'));
  const quarterly = await read('template-quarterly-review.opf.json');
  const data = await read('template-quarterly-review.values.json');
  const asTemplate = checked(quarterly);
  assert.equal(asTemplate.valid, true, JSON.stringify(errorsOf(asTemplate)));
  assert.deepEqual(asTemplate.unfilledVariables, ['client', 'headline', 'revenue', 'kickoff', 'wins']);
  assert.deepEqual(asTemplate.warnings.map((entry) => entry.ruleId), asTemplate.unfilledVariables.map(() => 'opf/variable-unfilled'), JSON.stringify(warningsOf(asTemplate)));

  const filled = resolveVariables(quarterly, data);
  assert.equal(filled.complete, true);
  assert.deepEqual(filled.diagnostics, []);
  const deck = filled.presentation;
  assert.equal(checked(deck).valid, true, JSON.stringify(errorsOf(checked(deck))));
  assert.equal(deck.name, 'Quarterly review for Globex');
  assert.equal(deck.slides[0].subtitle, 'Kickoff October 1, 2026');
  assert.equal('image' in deck.slides[0], false, 'an unfilled optional image omits its field');
  assert.deepEqual(deck.slides[1].text, data.headline);
  assert.deepEqual(deck.slides[2].bullets.slice(0, 3), ['Revenue $1,234,567, up 12.4%', 'Shipped v2', 'Won the renewal']);
  assert.equal(deck.slides[3].chart.data.rows[1][1], 1234567);
  assert.deepEqual(deck.slides[4].text, [{text: 'Visit https://globex.example', link: 'https://globex.example'}]);
  assert.deepEqual(deck.variables, {risk: '#B42318'});

  const preview = resolveVariables(quarterly, {}, {examples: true});
  assert.equal(preview.complete, true);
  assert.equal(preview.presentation.slides[0].title, 'Quarterly review: Acme Corp');
  assert.deepEqual(preview.presentation.slides[2].bullets[1], 'Faster onboarding');
  assert.equal(checked(preview.presentation).valid, true);
});
