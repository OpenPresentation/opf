// RR-105: the format-coverage walker (check-format-coverage.mjs) on small schemas, and the property that matters: a key or
// enum value added to the presentation schema is reported until a deck uses it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { addLayouts, collectLocations, corpusDecks, defaultLayoutIds, evaluate, label, walkDocuments } from './check-format-coverage.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const schema = {
  $id: 'https://example.com/test',
  type: 'object',
  additionalProperties: false,
  properties: {
    background: { oneOf: [{ type: 'string', pattern: '^#' }, { $ref: '#/$defs/Gradient' }] },
    items: { type: 'array', items: { anyOf: [{ type: 'string' }, { $ref: '#/$defs/Item' }] } },
    vars: { type: 'object', propertyNames: { pattern: '^[a-z]+$' }, additionalProperties: { type: 'number' } },
    socials: { type: 'object', propertyNames: { enum: ['x', 'github'] }, additionalProperties: { type: 'string' } },
    kind: { type: 'string', enum: ['a', 'b'] },
    picture: { type: 'string', dependentSchemas: {} },
  },
  dependentSchemas: { picture: { anyOf: [{ required: ['kind'] }, { required: ['items'] }] } },
  // if/then written as JSON: a literal object with a then key would be a thenable.
  allOf: [JSON.parse('{"if": {"required": ["kind"], "properties": {"kind": {"const": "a"}}}, "then": {"properties": {"hidden": {"type": "boolean"}}}}')],
  $defs: {
    Gradient: { type: 'object', additionalProperties: false, properties: { type: { const: 'gradient' }, angle: { type: 'number' } } },
    Item: { type: 'object', additionalProperties: false, properties: { text: { type: 'string' }, level: { type: 'integer' } } },
  },
};

test('format coverage: locations are keys, enum and const values and vocabulary branches, not constraints', () => {
  const locations = collectLocations(schema);
  const labels = [...locations.keys()].map(label).sort();
  assert.ok(labels.includes('background'));
  assert.ok(labels.includes('background.oneOf[1]'), 'a oneOf alternative is a branch');
  assert.ok(labels.includes('Gradient.type = "gradient"'), 'a const is a value, reached through $ref');
  assert.ok(labels.includes('Item.level'), 'a property of a referenced definition is a key');
  assert.ok(labels.includes('vars.*'), 'a map counts its "any other key"');
  assert.ok(labels.includes('socials.<key> = "github"'), 'an enumerated key name is a value');
  assert.ok(labels.includes('kind = "b"'));
  assert.ok(!labels.some((name) => name.includes('hidden')), 'a property declared in then is a constraint, not vocabulary');
  assert.ok(!labels.some((name) => name.includes('dependentSchemas')), 'required-only alternatives are not branches');
  assert.equal(locations.get('#/properties/background/oneOf/1').kind, 'branch');
});

test('format coverage: the walk follows $ref, oneOf, anyOf, arrays and maps, and records what a document uses', () => {
  const used = walkDocuments(schema, [{ background: { type: 'gradient', angle: 45 }, items: ['plain', { text: 'object' }], vars: { width: 3 }, socials: { github: 'opf' }, kind: 'a' }]);
  for (const id of ['#/properties/background', '#/properties/background/oneOf/1', '#/$defs/Gradient/properties/angle', '#/$defs/Gradient/properties/type="gradient"', '#/properties/items/items/anyOf/0', '#/properties/items/items/anyOf/1', '#/$defs/Item/properties/text', '#/properties/vars/additionalProperties', '#/properties/socials/propertyNames="github"', '#/properties/kind="a"']) {
    assert.ok(used.has(id), id);
  }
  for (const id of ['#/properties/background/oneOf/0', '#/$defs/Item/properties/level', '#/properties/kind="b"', '#/properties/socials/propertyNames="x"']) assert.ok(!used.has(id), id);
});

test('format coverage: what no document uses is missing, and the allowlist is exact', () => {
  const locations = collectLocations(schema);
  const used = walkDocuments(schema, [{ kind: 'b', background: '#fff' }]);
  const plain = evaluate(locations, used, []);
  assert.ok(plain.missing.some((entry) => entry.label === 'Item.level'));
  assert.equal(plain.problems.length, 0);
  const allowed = evaluate(locations, used, [{ location: 'Item.level', reason: 'not drawn by any engine' }]);
  assert.ok(!allowed.missing.some((entry) => entry.label === 'Item.level'));
  assert.equal(allowed.totals.key.allowed, 1);
  const stale = evaluate(locations, used, [{ location: 'kind = "b"', reason: 'covered now' }, { location: 'Nothing.here', reason: 'gone' }, { location: 'Item.text' }]);
  assert.equal(stale.problems.length, 3, stale.problems.join('\n'));
  assert.match(stale.problems.join('\n'), /covers/);
  assert.match(stale.problems.join('\n'), /does not have/);
  assert.match(stale.problems.join('\n'), /reason/);
});

test('format coverage: a key or enum value added to the presentation schema is reported until a deck uses it', () => {
  const real = JSON.parse(readFileSync(path.join(root, 'spec/schemas/opf.schema.json'), 'utf8'));
  real.$defs.TextRun.oneOf[1].properties.sparkle = { type: 'boolean' };
  real.$defs.Metric.properties.trend.enum.push('sideways');
  const documents = corpusDecks().decks.map((file) => JSON.parse(readFileSync(path.join(root, file), 'utf8')));
  const locations = collectLocations(real);
  const used = walkDocuments(real, documents);
  addLayouts(locations, used, defaultLayoutIds(), documents);
  const { missing } = evaluate(locations, used, JSON.parse(readFileSync(path.join(root, 'scripts/format-coverage-allowlist.json'), 'utf8')).entries);
  assert.deepEqual(missing.map((entry) => entry.label).sort(), ['Metric.trend = "sideways"', 'TextRun.oneOf[1].sparkle']);
});

test('format coverage: every default catalog layout is a location', () => {
  const locations = new Map();
  const used = new Set();
  addLayouts(locations, used, ['cover', 'venn'], [{ slides: [{ layout: 'venn' }, { title: 'x' }] }]);
  assert.deepEqual([...locations.keys()].map(label), ['Slide.layout = "cover"', 'Slide.layout = "venn"']);
  assert.deepEqual([...used].map(label), ['Slide.layout = "venn"']);
  assert.ok(defaultLayoutIds().includes('cover'));
});
