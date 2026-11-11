import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { instrumentedValidator } from './support/upstream-validator.mjs';

let api;
before(async () => { api = await instrumentedValidator(); });
after(async () => { await api?.close(); });
const clone = value => structuredClone(value);
const deck = (language = 'en-US') => ({
  name: 'Original name', language, design: { fontScheme: 'roboto' },
  slides: [
    { id: 'cover', layout: 'cover', subtitle: 'Authored subtitle, without an implicit title' },
    { id: 'one', title: 'One', blocks: [{ text: 'First useful point.' }, { text: 'Second distinct point.' }] },
    { id: 'two', title: 'Two', blocks: [{ text: 'Another useful point.' }, { text: 'A final distinct point.' }] },
  ],
});
const options = () => ({ catalogs: [gallery] });
function warm(document, config = options()) {
  const checker = api.createValidator(), first = api.audit(checker, document, config);
  assert.equal(first.report.schemaValid, true);
  assert.equal(checker.cache.entries, document.slides.length);
  assert.deepEqual(api.audit(checker, clone(document), config).compute, [0, 0, 0]);
  return { checker, config, first };
}
const allComputed = result => result.compute.every(count => count > 0);

for (const language of ['en-US', 'ar-SA']) test(`unreferenced root names reuse actual complete geometry without an inferred cover heading (${language})`, () => {
  const document = deck(language), { checker, config, first } = warm(document);
  assert.equal(api.hasContentVariables(document), false);
  assert.ok(!first.geometry[0].items.some(item => item.field === 'title'), 'core did not invent a cover title from name');
  for (const name of ['Revised name', 'اسم جديد', 'Quoted " name\twith\\slashes\n', '\uD800 lone high / \uDC00 lone low / \uD83D\uDE00 pair', '', undefined]) {
    if (name === undefined) delete document.name; else document.name = name;
    const result = api.audit(checker, document, config);
    assert.deepEqual(result.compute, [0, 0, 0]);
    assert.deepEqual(result.compose, [0, 0, 0], 'actual composeSlide is never called for the unchanged slides');
    assert.deepEqual(result.geometry, first.geometry);
  }
  document.slides[1].blocks[0].text = 'A genuine local content edit after the rename';
  assert.deepEqual(api.audit(checker, document, config).compute, [0, 1, 0], 'own raw slide data remains exact');
});

for (const language of ['en-US', 'ar-SA']) test(`unrelated owner builtin kinds retain their real work reuse (${language})`, () => {
  const document = deck(language);
  document.organization = { id: 'organization', name: 'Organization', tagline: 'A tagline' };
  document.speaker = { id: 'speaker', name: 'Speaker' };
  document.design.footer = { start: { text: '{{organization.name}} · {{organization.tagline}}' }, end: { text: '{{slide.number}} / {{deck.slideCount}}' } };
  document.slides[2].blocks[0].text = 'By {{speaker.name}} · {{organization.tagline}}';
  assert.equal(api.hasContentVariables(document), true, 'these are genuine content-variable uses');
  assert.equal(api.dependency(document).used, false, 'the actual shared transitive walk proves no deck.name use');
  const { checker, config, first } = warm(document), resolvedChecker = api.createValidator();
  const resolvedFirst = api.audit(resolvedChecker, api.resolveVariables(document).presentation, config);
  document.name = 'A changed unused root name';
  const changed = api.audit(checker, document, config);
  assert.deepEqual(changed.compute, [0, 0, 0]); assert.deepEqual(changed.compose, [0, 0, 0]);
  assert.deepEqual(changed.geometry, first.geometry);
  const resolvedChanged = api.audit(resolvedChecker, api.resolveVariables(document).presentation, config);
  assert.deepEqual(resolvedChanged.compute, [0, 0, 0]);
  assert.deepEqual(resolvedChanged.geometry, resolvedFirst.geometry, 'actual resolved organization/speaker/footer content also remains exact');
});

test('fresh policy findings and source locations still observe current names', () => {
  const document = deck(); document.name = 'Accepted';
  const config = { ...options(), contracts: [{ path: '/name', allowedValues: ['Accepted'] }] };
  const { checker } = warm(document, config);
  document.name = 'Rejected with a longer current value';
  const result = api.audit(checker, document, config);
  assert.deepEqual(result.compute, [0, 0, 0]);
  assert.ok(result.report.findings.some(finding => finding.ruleId === 'opf/contract' && finding.path === '/name'));
  const source = JSON.stringify(document, null, 2), actual = checker.validate(source, config);
  assert.deepEqual(actual, api.validate(source, config), 'full fresh locations, findings, counts and fixes equal cold');
  const finding = actual.findings.find(item => item.ruleId === 'opf/contract');
  assert.ok(finding.location && source.slice(finding.location.offset).startsWith('"Rejected with a longer current value"'));
});

for (const field of ['header', 'footer']) test(`actual ${field} deck.name expansion retains full-key invalidation`, () => {
  const document = deck(); document.design[field] = { start: { text: '{{deck.name}}' } };
  assert.equal(api.hasContentVariables(document), true);
  const { checker, config } = warm(document);
  const resolvedChecker = api.createValidator();
  const before = api.resolveVariables(document).presentation;
  const first = api.audit(resolvedChecker, before, config);
  assert.ok(first.geometry.every(geometry => geometry.furniture.parts.some(part => part.text === 'Original name')));
  document.name = 'Current visible name';
  assert.ok(allComputed(api.audit(checker, document, config)), 'raw built-in document conservatively keeps the whole name key');
  const resolved = api.resolveVariables(document).presentation;
  assert.equal(resolved.design[field].start.text, 'Current visible name');
  const changed = api.audit(resolvedChecker, resolved, config);
  assert.ok(allComputed(changed), 'already-resolved furniture changes the exact global design key');
  assert.ok(changed.geometry.every(geometry => geometry.furniture.parts.some(part => part.text === 'Current visible name')));
  assert.notDeepEqual(changed.geometry, first.geometry, 'the real composed furniture changed');
});

for (const title of ['{{deck.name}}', 'var:deck.name']) test(`cover built-in ${title} stays conservative before and exact after resolution`, () => {
  const document = deck(); document.slides[0].title = title;
  const { checker, config } = warm(document);
  const resolvedChecker = api.createValidator(), before = api.resolveVariables(document).presentation;
  const first = api.audit(resolvedChecker, before, config);
  document.name = 'A substantially different visible cover heading';
  assert.ok(allComputed(api.audit(checker, document, config)));
  const resolved = api.resolveVariables(document).presentation;
  assert.equal(resolved.slides[0].title, document.name);
  const changed = api.audit(resolvedChecker, resolved, config);
  assert.deepEqual(changed.compute, [1, 0, 0], 'only the actual resolved own heading changed');
  assert.notDeepEqual(changed.geometry[0], first.geometry[0]);
});

test('recursive built-ins, declarations and every explicit template/value mode keep the full name key', () => {
  const recursive = deck(); recursive.organization = { id: 'organization', name: 'For {{deck.name}}' };
  recursive.slides[1].title = '{{organization.name}}';
  const variants = [
    [recursive, {}],
    [{ ...deck(), speaker: { id: 'speaker', name: '{{organization.company.tagline}}' }, organization: [{ id: 'company', name: 'Company', tagline: '{{deck.name}}' }] }, {}],
    [{ ...deck(), speaker: [{ id: 'guest', name: 'Guest', bio: '{{organization.name}}' }], organization: { id: 'organization', name: '{{deck.name}}' } }, {}],
    [{ ...deck(), variables: {} }, {}],
    [{ ...deck(), variables: { color: { type: 'color', value: '#123456' } } }, {}],
    [{ ...deck(), variables: { heading: { type: 'text', value: '{{deck.name}}' } } }, {}],
    [{ ...deck(), template: true }, {}], [{ ...deck(), template: false }, {}],
    [deck(), { values: {} }], [deck(), { template: false }], [deck(), { template: true }],
  ];
  for (const [document, mode] of variants) {
    const { checker, config } = warm(document, { ...options(), ...mode });
    document.name = 'A conservative rename';
    assert.ok(allComputed(api.audit(checker, document, config)));
  }
});

test('all other global metadata and eligible/ineligible transitions retain exact keys', () => {
  const document = deck(), { checker, config } = warm(document);
  for (const change of [
    d => { d.description = 'Changed description'; },
    d => { d.author = 'Changed author'; },
    d => { d.language = 'ar-SA'; },
    d => { d.design.footer = { start: { text: '{{deck.name}}' } }; },
    d => { delete d.design.footer; },
  ]) { change(document); assert.ok(allComputed(api.audit(checker, document, config))); }
  document.name = 'Plain again';
  assert.deepEqual(api.audit(checker, document, config).compute, [0, 0, 0]);
});

test('unknown catalog callables keep the complete name key without invoking them', () => {
  const document = deck(); let calls = 0;
  const catalog = { ...gallery, iconSets: { opaque: () => { calls++; throw Error('Unknown loader must not execute'); } } };
  const { checker, config } = warm(document, { catalogs: [catalog] });
  document.name = 'Conservatively invalidated';
  assert.ok(allComputed(api.audit(checker, document, config)));
  assert.equal(calls, 0);
});

test('known font callback inputs remain stable; resource clear and identity changes invalidate', () => {
  const document = deck(), received = []; let scale = .5;
  const provider = { measure: (text, size) => text.length * size * scale };
  const perIndex = (...args) => { received.push(args); return provider; };
  const { checker, config } = warm(document, { ...options(), fonts: { textMeasurement: perIndex } });
  document.name = 'Name unused by measured content';
  assert.deepEqual(api.audit(checker, document, config).compute, [0, 0, 0]);
  assert.ok(received.length > 0 && received.every(args => args.length === 1 && Number.isInteger(args[0])), 'the known callback receives only its documented index, never the name/deck');
  scale = .6; checker.clear();
  assert.ok(allComputed(api.audit(checker, document, config)), 'changed backing resources require the documented explicit clear');
  config.fonts.textMeasurement = { measure: (text, size) => text.length * size * .7 };
  assert.ok(allComputed(api.audit(checker, document, config)), 'new actual measurement identity invalidates');
});

test('full raw name guards and original byte budgets run before the comparison projection', () => {
  for (const mutate of [
    d => { d.name = 'x'.repeat(1100000); },
    d => { Object.defineProperty(d, 'name', { value: 'Hidden current name', enumerable: false }); },
    d => { Object.defineProperty(d, 'name', { get: () => 'Accessor name', enumerable: true }); },
    d => { d[Symbol('opaque')] = 'A root symbol'; },
  ]) {
    const document = deck(), checker = api.createValidator(); mutate(document);
    api.audit(checker, document, options());
    assert.equal(checker.cache.entries, 0);
    assert.equal(checker.cache.bytes, 0);
  }
  const document = deck(), { checker, config } = warm(document);
  document.name = 42;
  assert.equal(api.audit(checker, document, config).report.schemaValid, false);
  assert.equal(checker.cache.entries, 0);
});

test('otherwise unkeyed unused datasets cannot bypass the full dependency-walk bound', () => {
  const document = deck();
  document.datasets = { unused: { columns: ['Literal'], rows: [['x'.repeat(1100000)]] } };
  const { checker, config } = warm(document);
  document.name = 'An unproven dependency-domain rename';
  assert.ok(allComputed(api.audit(checker, document, config)), 'large unused data keeps the full original name comparison without weakening existing cache budgets');
});

test('new-domain preflight refuses large strings/counts and opaque data without stringifying or invoking getters', () => {
  const large = 'x'.repeat(1100000), originalStringify = JSON.stringify;
  let copies = 0, getters = 0, enumerations = 0;
  const accessor = Object.defineProperty({}, 'value', { enumerable: true, get() { getters++; return 'A getter value'; } });
  const cycle = {}; cycle.self = cycle;
  const many = new Proxy(Array(300000), { ownKeys() { enumerations++; throw Error('Oversized array must refuse before key enumeration'); } });
  const opaque = Object.create({ inherited: true }); opaque.value = 'Opaque prototype';
  const arrayImpostor = Object.create(Array.prototype); arrayImpostor.value = 'Not an actual array';
  JSON.stringify = (...args) => { copies++; return originalStringify(...args); };
  try {
    for (const input of [{ unused: large }, { [large]: 'A large key' }, accessor, cycle, many, opaque, arrayImpostor, { [Symbol('opaque')]: 'A symbol' }]) {
      assert.equal(api.testBoundedDependencyInput(input), false);
    }
  } finally { JSON.stringify = originalStringify; }
  assert.equal(copies, 0, 'no escaped/serialized copy is made during the raw preflight');
  assert.equal(getters, 0); assert.equal(enumerations, 0);
  assert.equal(api.testBoundedDependencyInput({ text: 'Quotes " and \\ and \uD800', rows: [['ordinary', 1, true, null]] }), true);
});
