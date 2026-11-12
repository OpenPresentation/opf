// RR-111: the precompiled validators build each error with one helper function (scripts/validators-codegen.mjs, `opfError`)
// instead of an object literal at every site. This checks that the errors are the very errors Ajv's runtime build reports, more
// strictly than test/precompiled-validators.test.mjs: every property, in Ajv's order (including `propertyName`), `schema` and
// `parentSchema` the same objects of the bundled schemas, and `data` equal, for every registered schema over the example corpus,
// the invalid fixtures and three mutants of each document.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { schemas } from '../dist/schemas.js';
import { schemaEngine as ajvEngine } from '../dist/schema-engine-ajv.js';
import { schemaEngine as precompiledEngine } from '../dist/schema-engine-precompiled.js';
import { qualifyBranch } from '../scripts/validators-codegen.mjs';
import { corpus } from './support/edge-corpus.mjs';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const ajv = ajvEngine();
const precompiled = precompiledEngine();

const documents = [
	...corpus({ mutants: 3, records: 6 }).filter((document) => document.filename.endsWith('.json')).map((document) => ({ id: document.id, value: JSON.parse(document.text) })),
	...readdirSync(fixtures).filter((name) => name.endsWith('.json')).map((name) => ({ id: `fixtures/${name}`, value: JSON.parse(readFileSync(path.join(fixtures, name), 'utf8')) })),
];

test('the precompiled validators report exactly the errors of Ajv, property by property', () => {
	let errors = 0;
	let propertyNames = 0;
	const keywords = new Set();
	for (const name of Object.keys(schemas)) {
		const expected = ajv.root(name);
		const actual = precompiled.root(name);
		for (const { id, value } of documents) {
			const verdict = expected(structuredClone(value));
			assert.equal(actual(structuredClone(value)), verdict, `${name} on ${id}`);
			const want = expected.errors ?? [];
			const got = actual.errors ?? [];
			assert.equal(got.length, want.length, `${name} on ${id}: error count`);
			for (const [index, error] of got.entries()) {
				const reference = want[index];
				const where = `${name} on ${id}, error ${index} (${reference.schemaPath})`;
				assert.deepEqual(Object.keys(error), Object.keys(reference), `${where}: properties`);
				for (const key of Object.keys(reference)) {
					if (key === 'schema' || key === 'parentSchema') {
						// The same object of the bundled schemas, or the same value for a keyword's scalar or `false`.
						assert.ok(error[key] === reference[key], `${where}: ${key} is not the schema object Ajv reports`);
					} else assert.deepEqual(error[key], reference[key], `${where}: ${key}`);
				}
				if ('propertyName' in reference) propertyNames++;
				keywords.add(reference.keyword);
				errors++;
			}
		}
	}
	assert.ok(errors > 2000, `the corpus should reach the error paths (${errors} errors)`);
	assert.ok(propertyNames > 0, 'the corpus should reach an error with a propertyName');
	// Each form of error the generator writes (opfTypeError, opfPatternError, opfRequiredError, opfKeywordError, opfError).
	for (const keyword of ['type', 'pattern', 'required', 'additionalProperties', 'enum', 'const', 'oneOf', 'anyOf', 'not', 'if', 'propertyNames', 'minItems'])
		assert.ok(keywords.has(keyword), `the corpus should reach a ${keyword} error (reached ${[...keywords].sort().join(', ')})`);
});

/** The oneOf and anyOf branches of a schema (as test/precompiled-validators.test.mjs finds them). */
function* unions(node, isMap = false) {
	if (!node || typeof node !== 'object') return;
	if (!isMap && !Array.isArray(node)) for (const keyword of ['oneOf', 'anyOf']) if (Array.isArray(node[keyword])) for (const branch of node[keyword]) if (branch && typeof branch === 'object') yield branch;
	for (const [key, child] of Object.entries(node)) {
		if (!isMap && ['enum', 'const', 'examples', 'default'].includes(key)) continue;
		yield* unions(child, !isMap && ['properties', '$defs', 'definitions', 'patternProperties', 'dependentSchemas'].includes(key));
	}
}

function* objects(value) {
	if (value && typeof value === 'object') {
		yield value;
		for (const child of Object.values(value)) yield* objects(child);
	}
}

test('the precompiled branch validators report the errors of Ajv, property by property', () => {
	// Ajv's branch validators compile a copy of the branch, so `schema` and `parentSchema` are equal objects here, not the same.
	const values = [null, true, 0, 1.5, 'text', '', [], {}, { type: 'unknown' }];
	for (const { value } of documents) for (const node of objects(value)) if (values.length < 1500) values.push(node);
	let errors = 0;
	for (const [name, schema] of Object.entries(schemas)) {
		for (const branch of unions(schema)) {
			const expected = ajv.branch(branch, schema.$id);
			const actual = precompiled.branch(branch, schema.$id);
			for (const value of values) {
				assert.equal(actual(structuredClone(value)), expected(structuredClone(value)), name);
				const want = expected.errors ?? [];
				const got = actual.errors ?? [];
				assert.equal(got.length, want.length, `${name}: error count`);
				for (const [index, error] of got.entries()) {
					assert.deepEqual(Object.keys(error), Object.keys(want[index]), `${name}: ${want[index].schemaPath}: properties`);
					// The precompiled validators report the bundled schema objects; Ajv, within the branch itself, its copy with absolute
					// references (and the bundled objects within an inlined definition). Compared with absolute references on both sides.
					const qualified = (entry) => ({ ...entry, schema: qualifyBranch(entry.schema, schema.$id), parentSchema: qualifyBranch(entry.parentSchema, schema.$id) });
					assert.deepEqual(qualified(error), qualified(want[index]), `${name}: ${want[index].schemaPath}`);
					errors++;
				}
			}
		}
	}
	assert.ok(errors > 2000, `${errors} branch errors`);
});
