// The light rule-metadata module (src/validation-rule-info.ts) against the rule implementations (src/validation-rules.ts): the two
// registries cannot drift, explain() and the registry lookups agree for every rule, and the `source` entry bundles no implementation.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { FORBIDDEN_INPUTS, measure, problems } from '../../../scripts/check-catalog-free.mjs';
import { explain as rootExplain, findValidationRule, validationRules } from '../dist/index.js';
import { explain } from '../dist/source.js';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** src/validation-rules.ts bundled on its own: the implementations and the light module they import, as one ES module. */
async function bundledRegistry() {
  const { build } = createRequire(createRequire(path.join(packageRoot, 'package.json')).resolve('tsup'))('esbuild');
  const result = await build({ entryPoints: [path.join(packageRoot, 'src', 'validation-rules.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
}

test('the light registry equals the registry built from the rule implementations', async () => {
  const { ruleImplementations, validationRules: light, findValidationRule: find } = await bundledRegistry();
  const fromImplementations = ruleImplementations.flatMap((entry) => [entry.info, ...(entry.also ?? [])]);
  assert.ok(fromImplementations.length > 0);
  const ids = new Set(fromImplementations.map((info) => info.id));
  assert.equal(ids.size, fromImplementations.length, 'an implementation reports a rule twice');
  // Within the implemented rules the registry order is category order, then report order (`also` after its rule).
  const categories = ['format', 'references', 'policy', 'accessibility', 'layout', 'content'];
  const expected = fromImplementations
    .map((info, index) => ({ info, index }))
    .sort((a, b) => categories.indexOf(a.info.category) - categories.indexOf(b.info.category) || a.index - b.index)
    .map(({ info }) => info);
  assert.deepEqual(light.filter((info) => ids.has(info.id)), expected);
  // The rules that have no implementation are the format, references, policy and data rules, in the registry's order; none is implemented twice.
  assert.equal(light.length, new Set(light.map((info) => info.id)).size);
  for (const info of expected) assert.equal(find(info.id), light.find((entry) => entry.id === info.id));
  // The bundled copy and the published one are the same registry, field for field.
  assert.deepEqual(JSON.parse(JSON.stringify(light)), JSON.parse(JSON.stringify(validationRules)));
});

test('explain and findValidationRule agree with the registry for every rule', () => {
  assert.ok(validationRules.length > 60);
  for (const info of validationRules) {
    assert.equal(findValidationRule(info.id), info, info.id);
    assert.equal(findValidationRule(info.name), info, info.name);
    const explained = explain(info.id);
    assert.ok(explained, info.id);
    assert.equal(explained.id, info.id);
    assert.equal(explained.name, info.name);
    assert.equal(explained.category, info.category);
    assert.equal(explained.severity, info.severity);
    assert.equal(explained.docs, `https://github.com/OpenPresentation/opf/blob/main/docs/validate.md#${info.id.replace('/', '')}`);
    assert.ok(explained.summary && explained.rationale && explained.fix, info.id);
    assert.deepEqual(explain(info.name), explained, `${info.name} reads like ${info.id}`);
    assert.deepEqual(rootExplain(info.id), explained, `the root and /source explain ${info.id} alike`);
  }
  assert.equal(explain('opf/no-such-rule'), undefined);
});

test('the source entry bundles the rule metadata and no rule implementation', async () => {
  const { source } = await measure(['source']);
  assert.ok(source.inputs.some((input) => input.endsWith('src/validation-rule-info.ts')), 'explain reads the light module');
  assert.ok(source.inputs.some((input) => input.endsWith('src/explain.ts')));
  assert.deepEqual(problems({ source }, { entries: { source: source.gzip } }), []);
  for (const input of ['src/rules-accessibility.ts', 'src/rules-layout-content.ts', 'src/rules-language.ts', 'src/validation-rules.ts', 'src/validator.ts', 'src/composition.ts'])
    assert.equal(source.inputs.includes(input), false, `${input} must not be in the source entry`);
  // The rule that makes the check fail, on a made-up result.
  const bad = { ...source, inputs: [...source.inputs, 'src/rules-accessibility.ts'] };
  assert.match(problems({ source: bad }, { entries: { source: source.gzip } })[0], /source: bundles src\/rules-accessibility\.ts/);
  assert.ok(FORBIDDEN_INPUTS.source.patterns.length > 0);
});
