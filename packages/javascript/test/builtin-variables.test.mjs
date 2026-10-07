import assert from 'node:assert/strict';
import {test} from 'node:test';
import { hasContentVariables, listBuiltinVariables, resolveVariables } from '../dist/index.js';
import {composeSlide} from '../dist/composition.js';
import { check, errorsOf, warningsOf } from './support/validation.mjs';

const BS = String.fromCharCode(92);

const deck = (extra = {}) => ({
  name: 'Q4 Review',
  description: 'Quarterly business review',
  author: ['Bob Lee', 'Carla Diaz'],
  speaker: [
    {id: 'ada', name: 'Ada Lovelace', title: 'CTO', email: 'ada@acme.com', phone: '+14155551234', bio: 'Wrote the first program.', photo: 'asset:ada-photo', organizationId: 'acme'},
    {id: 'grace', name: 'Grace Hopper', title: 'Rear Admiral', organizationId: 'beta'},
  ],
  organization: [
    {id: 'beta', name: 'Beta Industries', tagline: 'Second', domain: 'beta.io'},
    {id: 'acme', name: 'Acme Corp', role: 'primary', legalName: 'Acme Corporation, Inc.', tagline: 'Build the future', domain: 'acme.com', email: 'hello@acme.com', phone: '+14155550000', logo: {src: 'asset:acme-logo', alt: 'Acme'}},
  ],
  assets: {'ada-photo': './ada.png', 'acme-logo': './logo.svg'},
  slides: [{id: 'cover', title: 'Hello'}],
  ...extra,
});
const withSlide = (slide, extra = {}) => deck({slides: [{id: 'cover', ...slide}], ...extra});
const resolved = (document, values = {}, options = {}) => resolveVariables(document, values, options);
const first = (result) => result.presentation.slides[0];

test('every built-in text field resolves from its source', () => {
  const result = resolved(withSlide({
    title: '{{deck.name}} | {{deck.description}} | {{deck.author}}',
    subtitle: '{{speaker.name}}|{{speaker.title}}|{{speaker.email}}|{{speaker.phone}}|{{speaker.bio}}',
    text: '{{organization.name}}|{{organization.legalName}}|{{organization.tagline}}|{{organization.domain}}|{{organization.email}}|{{organization.phone}}',
  }));
  assert.equal(first(result).title, 'Q4 Review | Quarterly business review | Bob Lee, Carla Diaz');
  assert.equal(first(result).subtitle, 'Ada Lovelace|CTO|ada@acme.com|+14155551234|Wrote the first program.');
  assert.equal(first(result).text, 'Acme Corp|Acme Corporation, Inc.|Build the future|acme.com|hello@acme.com|+14155550000');
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.complete, true);
});

test('deck.author accepts a single string', () => {
  assert.equal(first(resolved(withSlide({title: '{{deck.author}}'}, {author: 'Solo'}))).title, 'Solo');
});

test('speaker and organization images resolve as whole fields and inline sources', () => {
  const result = resolved(withSlide({image: 'var:speaker.photo', logo: 'var:organization.logo', text: '{{speaker.photo}} {{organization.logo}}'}));
  assert.equal(first(result).image, 'asset:ada-photo');
  assert.deepEqual(first(result).logo, {src: 'asset:acme-logo', alt: 'Acme'});
  assert.equal(first(result).text, 'asset:ada-photo asset:acme-logo');
});

test('the primary organization is role primary, else the first one, and a single object works', () => {
  assert.equal(first(resolved(withSlide({title: '{{organization.name}}'}))).title, 'Acme Corp');
  const none = deck({organization: [{id: 'a', name: 'First'}, {id: 'b', name: 'Second'}]});
  none.slides = [{id: 'cover', title: '{{organization.name}}'}];
  assert.equal(first(resolved(none)).title, 'First');
  const single = deck({organization: {id: 'only', name: 'Only Co'}, speaker: {id: 'solo', name: 'Solo Speaker'}});
  single.slides = [{id: 'cover', title: '{{organization.name}} {{speaker.name}}'}];
  assert.equal(first(resolved(single)).title, 'Only Co Solo Speaker');
});

test('speaker.<id>.<field> and organization.<id>.<field> address an entry by id', () => {
  const result = resolved(withSlide({
    title: '{{speaker.grace.name}} ({{speaker.grace.title}}), {{organization.beta.name}}',
    image: 'var:speaker.ada.photo',
    text: '{{organization.beta.tagline}} / {{organization.acme.legalName}}',
  }));
  assert.equal(first(result).title, 'Grace Hopper (Rear Admiral), Beta Industries');
  assert.equal(first(result).image, 'asset:ada-photo');
  assert.equal(first(result).text, 'Second / Acme Corporation, Inc.');
  assert.deepEqual(result.diagnostics, []);
});

test('the speakers list joins every name inline and splices as a whole array element', () => {
  const result = resolved(withSlide({subtitle: 'By {{speakers}}', bullets: ['First', 'var:speakers', 'Last'], text: '{{speakers|; }}'}));
  assert.equal(first(result).subtitle, 'By Ada Lovelace, Grace Hopper');
  assert.deepEqual(first(result).bullets, ['First', 'Ada Lovelace', 'Grace Hopper', 'Last']);
  assert.equal(first(result).text, 'Ada Lovelace; Grace Hopper');
});

test('built-ins resolve with no declared variables and leave the input untouched', () => {
  const input = withSlide({title: '{{speaker.name}}'});
  const snapshot = structuredClone(input);
  assert.equal(hasContentVariables(input), true);
  assert.equal(hasContentVariables(deck()), false);
  resolved(input);
  assert.deepEqual(input, snapshot);
  // A document that never uses one is shared untouched.
  const plain = deck();
  assert.equal(resolved(plain).presentation, plain);
});

test('a built-in works beside user variables and inside a built-in text that carries a token', () => {
  const document = withSlide({title: '{{deck.name}} for {{client}}', text: '{{client}}: {{speaker.name}}'}, {
    name: 'Review for {{client}}',
    variables: {client: {type: 'text', example: 'Acme'}},
  });
  const result = resolved(document, {client: 'Globex'});
  assert.equal(first(result).title, 'Review for Globex for Globex');
  assert.equal(result.presentation.name, 'Review for Globex');
  assert.equal(first(result).text, 'Globex: Ada Lovelace');
});

test('escapes and cycles stay literal and terminate', () => {
  const escaped = resolved(withSlide({title: `${BS}{{speaker.name}} and {{speaker.name}}`}));
  assert.equal(first(escaped).title, '{{speaker.name}} and Ada Lovelace');
  const cyclic = resolved(withSlide({title: '{{deck.name}}'}, {name: 'Loop {{deck.name}}'}));
  assert.equal(first(cyclic).title, 'Loop {{deck.name}}');
});

test('a missing source value resolves to nothing with a warning, and an optional reference is omitted', () => {
  const bare = withSlide({title: 'By {{speaker.name}}{{organization.tagline}}', image: 'var:speaker.photo', bullets: ['a', 'var:speakers']}, {speaker: undefined, organization: {id: 'x', name: 'X'}});
  delete bare.speaker;
  const result = resolved(bare);
  assert.equal(first(result).title, 'By ');
  assert.equal('image' in first(result), false);
  assert.deepEqual(first(result).bullets, ['a']);
  const codes = result.diagnostics.map((entry) => `${entry.code}:${entry.id}`);
  assert.deepEqual(codes.sort(), ['variable-builtin-missing:organization.tagline', 'variable-builtin-missing:speaker.name', 'variable-builtin-missing:speaker.photo', 'variable-builtin-missing:speakers']);
  assert.ok(result.diagnostics.every((entry) => entry.severity === 'warning'));
  const validation = check(bare, { only: ['format', 'content'] });
  assert.equal(validation.valid, true, JSON.stringify(errorsOf(validation)));
  assert.equal(warningsOf(validation).filter((entry) => entry.ruleId === 'opf/variable-builtin-missing').length, 4);
});

test('an unknown built-in path is an error and stays as written', () => {
  for (const [token, fragment] of [['speaker.nickname', "'nickname' is not a speaker field"], ['organization.slogan', "'slogan' is not a organization field"], ['deck.owner', 'deck.name'], ['speaker.nobody.name', "no speaker with id 'nobody'"], ['organization.acme.nope', "'nope' is not a organization field"], ['deck.name.extra', 'not a built-in']]) {
    const document = withSlide({title: `{{${token}}}`});
    const result = resolved(document);
    assert.equal(first(result).title, `{{${token}}}`);
    const entry = result.diagnostics.find((item) => item.code === 'variable-unknown-builtin');
    assert.ok(entry, token);
    assert.equal(entry.severity, 'error');
    assert.ok(entry.message.includes(fragment), `${token}: ${entry.message}`);
    const validation = check(document);
    assert.equal(validation.valid, false, token);
    assert.ok(errorsOf(validation).some((error) => error.ruleId === 'opf/variable-unknown-builtin' && error.path === '/slides/0/title'), token);
  }
  assert.throws(() => resolved(withSlide({image: 'var:speaker.mugshot'}), {}, {strict: true}), /not a speaker field/);
});

test('user variable ids keep their pattern, so a built-in can never collide; speakers is reserved', () => {
  const dotted = check(deck({variables: {'speaker.name': {type: 'text', value: 'x'}}}));
  assert.equal(dotted.valid, false);
  const reserved = check(deck({variables: {speakers: {type: 'text', value: 'x'}}}));
  assert.equal(reserved.valid, false);
  assert.ok(errorsOf(reserved).some((error) => error.path === '/variables/speakers' && /reserved/.test(error.message)));
  // A user variable named like a built-in root is fine: it has no dot.
  const plain = withSlide({title: '{{speaker}} / {{speaker.name}}'}, {variables: {speaker: {type: 'text', value: 'User value'}}});
  assert.equal(first(resolved(plain)).title, 'User value / Ada Lovelace');
});

test('unique speaker and organization ids and a resolving organizationId are validation errors', () => {
  const duplicates = check(deck({speaker: [{id: 'a', name: 'A'}, {id: 'a', name: 'B'}], organization: [{id: 'o', name: 'O'}, {id: 'o', name: 'P'}]}));
  assert.deepEqual(errorsOf(duplicates).map((error) => error.path).sort(), ['/organization/1/id', '/speaker/1/id']);
  const dangling = check(deck({speaker: {id: 'a', name: 'A', organizationId: 'gone'}}));
  assert.deepEqual(errorsOf(dangling).map((error) => error.path), ['/speaker/organizationId']);
  assert.match(errorsOf(dangling)[0].message, /names no organization/);
  assert.equal(check(deck()).valid, true);
  // Speaker ids and organization ids are separate namespaces.
  assert.equal(check(deck({speaker: {id: 'acme', name: 'A', organizationId: 'acme'}})).valid, true);
});

test('template previews use the real document metadata and leave an absent built-in visible', () => {
  const template = withSlide({title: '{{speaker.name}} at {{client}}', subtitle: '{{organization.tagline}}', image: 'var:speaker.photo', text: '{{organization.slogan}}'}, {
    template: true,
    variables: {client: {type: 'text', example: 'Acme'}},
    organization: {id: 'acme', name: 'Acme'},
  });
  const preview = resolved(template, {}, {examples: true});
  assert.equal(first(preview).title, 'Ada Lovelace at Acme');
  assert.equal(first(preview).subtitle, '{{organization.tagline}}');
  assert.equal(first(preview).image, 'asset:ada-photo');
  assert.equal(first(preview).text, '{{organization.slogan}}');
  assert.ok(preview.diagnostics.some((entry) => entry.code === 'variable-builtin-missing' && entry.id === 'organization.tagline'));
  // Filling the template for real resolves an absent built-in to nothing.
  const filled = resolved(template, {client: 'Globex'});
  assert.equal(first(filled).subtitle, '');
  // A template validates; the unknown path is still an error.
  const validation = check(template);
  assert.equal(validation.template, true);
  assert.ok(errorsOf(validation).some((error) => error.ruleId === 'opf/variable-unknown-builtin'));
});

test('built-ins are listed with kind, availability and uses for pickers', () => {
  const document = withSlide({title: '{{speaker.name}}', image: 'var:organization.logo'}, {organization: {id: 'acme', name: 'Acme'}});
  const list = listBuiltinVariables(document);
  const byName = Object.fromEntries(list.map((entry) => [entry.name, entry]));
  assert.equal(byName['speaker.name'].kind, 'text');
  assert.equal(byName['speaker.name'].available, true);
  assert.equal(byName['speaker.name'].value, 'Ada Lovelace');
  assert.deepEqual(byName['speaker.name'].uses, [{id: 'speaker.name', path: '/slides/0/title', form: 'token'}]);
  assert.equal(byName['organization.logo'].kind, 'image');
  assert.equal(byName['organization.logo'].available, false);
  assert.equal(byName['organization.logo'].uses[0].form, 'reference');
  assert.equal(byName.speakers.kind, 'list');
  assert.deepEqual(byName.speakers.value, ['Ada Lovelace', 'Grace Hopper']);
  assert.ok(byName['speaker.grace.title']);
  assert.ok(byName['organization.acme.name']);
  assert.ok(list.every((entry) => entry.label));
  assert.deepEqual(listBuiltinVariables(null), []);
});

test('the speaker furniture field draws the first speaker name and title after organization', () => {
  const presentation = deck({design: {footer: {left: {organization: true, speaker: true}, right: {speaker: true}}}});
  const geometry = composeSlide({id: 'cover', title: 'Hello'}, {width: 1280, height: 720, presentation, slideIndex: 0});
  assert.deepEqual(geometry.diagnostics, []);
  const parts = geometry.furniture.parts;
  assert.deepEqual(parts.filter((part) => part.zone === 'left').map((part) => part.field), ['organization', 'speaker']);
  const speaker = parts.find((part) => part.field === 'speaker');
  assert.equal(speaker.text, 'Ada Lovelace, CTO');
  assert.equal(speaker.generated, true);
  assert.equal(speaker.sourcePath, 'speaker.0.name');
  assert.ok(speaker.box.y > parts.find((part) => part.field === 'organization').box.y);
  // No title: the name alone; a single speaker object keeps the unindexed path.
  const single = deck({speaker: {id: 'solo', name: 'Solo'}, design: {footer: {left: {speaker: true}}}});
  const part = composeSlide({id: 'cover'}, {width: 1280, height: 720, presentation: single}).furniture.parts[0];
  assert.equal(part.text, 'Solo');
  assert.equal(part.sourcePath, 'speaker.name');
  // No speaker: a diagnostic, no part.
  const absent = deck({design: {footer: {left: {speaker: true}}}});
  delete absent.speaker;
  const none = composeSlide({id: 'cover'}, {width: 1280, height: 720, presentation: absent});
  assert.equal(none.furniture.parts.length, 0);
  assert.ok(none.furniture.diagnostics.some((entry) => entry.code === 'unresolved-content' && entry.path === 'design.footer.left.speaker'));
  const validation = check(presentation);
  assert.equal(validation.valid, true, JSON.stringify(errorsOf(validation)));
});
