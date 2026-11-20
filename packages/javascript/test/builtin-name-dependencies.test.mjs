import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { instrumentedValidator } from './support/upstream-validator.mjs';

let api;
before(async () => { api = await instrumentedValidator(); });
after(async () => { await api?.close(); });
const sample = text => ({ name: 'Current deck', slides: [{ title: 'An authored title', text }] });
const once = result => assert.ok(Object.values(result.sources).every(count => count === 1), 'every actual transitive builtin source lookup occurs at most once');

test('every owner builtin remains available without inventing a deck.name dependency', () => {
  const source = {
    name: 'Unreferenced name', organization: { name: 'Company', tagline: 'Tagline' }, speaker: { name: 'Speaker' },
    design: { footer: { start: { text: '{{organization.name}} · {{organization.tagline}}' }, end: { text: '{{slide.number}} / {{deck.slideCount}}' } } },
    slides: [{ title: 'Authored title', text: 'By {{speaker.name}} · {{organization.tagline}}' }],
  };
  const before = JSON.stringify(source), expanded = api.resolveVariables(source), listing = api.listBuiltinVariables(source);
  const result = api.dependency(source); once(result);
  assert.equal(result.used, false);
  for (const name of ['organization.name', 'organization.tagline', 'speaker.name', 'slide.number', 'deck.slideCount']) {
    assert.ok(listing.find(item => item.name === name).uses.length > 0, `${name} has a genuine public resolver use`);
  }
  assert.equal(expanded.presentation.design.footer.start.text, 'Company · Tagline');
  assert.equal(expanded.presentation.slides[0].text, 'By Speaker · Tagline');
  assert.equal(expanded.presentation.design.footer.end.text, '{{slide.number}} / {{deck.slideCount}}');
  assert.deepEqual(api.resolveVariables(source), expanded, 'normal expansion is unchanged after the internal trace');
  assert.deepEqual(api.listBuiltinVariables(source), listing, 'public picker values, paths and diagnostics remain unchanged');
  assert.equal(JSON.stringify(source), before, 'the dependency mode never rewrites source');
});

test('direct, embedded, whole-field and formatted references use the actual shared grammar', () => {
  for (const text of ['{{deck.name}}', 'Prefix {{ deck.name }} suffix', 'var:deck.name', '{{deck.name|unused-format}}']) {
    const source = sample(text), before = api.resolveVariables(source), listing = api.listBuiltinVariables(source);
    const result = api.dependency(source); once(result);
    assert.equal(result.used, true, text);
    assert.deepEqual(api.resolveVariables(source), before);
    assert.deepEqual(api.listBuiltinVariables(source), listing);
  }
});

test('hidden recursive organization/speaker/id-addressed sources cannot hide name dependencies', () => {
  const sources = [
    { ...sample('{{organization.name}}'), organization: { name: 'For {{speaker.name}}' }, speaker: { name: 'By {{deck.name}}' } },
    { ...sample('var:speaker.name'), speaker: { name: '{{organization.company.tagline}}' }, organization: [{ id: 'company', name: 'Company', tagline: '{{deck.name}}' }] },
    { ...sample('{{speaker.guest.bio}}'), speaker: [{ id: 'guest', name: 'Guest', bio: '{{organization.tagline}}' }], organization: { name: 'Company', tagline: '{{deck.name}}' } },
    { ...sample('No visible metadata reference'), organization: { name: 'Company', tagline: '{{deck.name}}' } },
  ];
  for (const source of sources) {
    const before = api.resolveVariables(source), listing = api.listBuiltinVariables(source);
    const result = api.dependency(source); once(result);
    assert.equal(result.used, true);
    assert.deepEqual(api.resolveVariables(source), before);
    assert.deepEqual(api.listBuiltinVariables(source), listing);
  }
});

test('cycles and repeated transitive branches visit each builtin source only once without expanded strings', () => {
  const source = {
    ...sample('{{organization.name}} '.repeat(200)),
    organization: { name: '{{speaker.name}} {{speaker.name}}' },
    speaker: { name: '{{organization.name}} {{organization.name}}' },
  };
  const before = JSON.stringify(source), expanded = api.resolveVariables(source), listing = api.listBuiltinVariables(source);
  const result = api.dependency(source); once(result);
  assert.equal(result.used, false);
  assert.deepEqual(Object.keys(result.sources).sort(), ['organization.name', 'speaker.name']);
  assert.equal(JSON.stringify(source), before);
  assert.deepEqual(api.resolveVariables(source), expanded);
  assert.deepEqual(api.listBuiltinVariables(source), listing);
  source.organization.name += ' {{deck.name}}';
  const changed = api.dependency(source); once(changed); assert.equal(changed.used, true);

  // Deliberately do not expand this branching input with the public resolver: this control is about bounded dependency work.
  const count = 18, chain = { ...sample('{{organization.item-0.name}}'), organization: [] };
  for (let index = 0; index < count; index++) chain.organization.push({ id: `item-${index}`, name: index === count - 1 ? 'Leaf' : `{{organization.item-${index + 1}.name}} {{organization.item-${index + 1}.name}}` });
  const chainBefore = JSON.stringify(chain), traced = api.dependency(chain); once(traced);
  assert.equal(traced.used, false); assert.equal(Object.keys(traced.sources).length, count);
  assert.equal(JSON.stringify(chain), chainBefore);
  chain.organization.at(-1).name = '{{deck.name}}';
  const named = api.dependency(chain); once(named); assert.equal(named.used, true);
  assert.equal(Object.keys(named.sources).length, count + 1);
});

test('escapes, malformed forms and skipped opaque author data keep actual resolution semantics', () => {
  for (const text of ['\\{{deck.name}}', '{{deck.name', '{{Deck.name}}', '{{deck.name.extra}}', 'literal deck.name', 'prefix var:deck.name']) {
    const source = sample(text), expanded = api.resolveVariables(source), listing = api.listBuiltinVariables(source);
    const result = api.dependency(source); once(result); assert.equal(result.used, false, text);
    assert.deepEqual(api.resolveVariables(source), expanded); assert.deepEqual(api.listBuiltinVariables(source), listing);
  }
  const source = {
    ...sample('Ordinary authored content'),
    extensions: { literal: '{{deck.name}}', nested: { literal: 'var:deck.name' } },
    catalogs: { custom: { themes: { opaque: { name: '{{deck.name}}', description: 'var:deck.name' } } } },
  };
  const expanded = api.resolveVariables(source), listing = api.listBuiltinVariables(source);
  assert.equal(api.dependency(source).used, false, 'the same walker skips extensions and catalog records');
  assert.deepEqual(api.resolveVariables(source), expanded); assert.deepEqual(api.listBuiltinVariables(source), listing);
  source.slides[0].extensions = { literal: '{{deck.name}}' };
  assert.equal(api.dependency(source).used, false, 'nested extensions remain opaque too');
});
