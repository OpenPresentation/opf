// CE-01: the validators generated at build time (scripts/validators-codegen.mjs) give the same verdicts and the same errors as
// Ajv compiling the schemas at runtime, and they are what the worker conditions (and `@openpresentation/opf/precompiled`) load.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { schemas } from '../dist/schemas.js';
import { schemaEngine as ajvEngine } from '../dist/schema-engine-ajv.js';
import { schemaEngine as precompiledEngine } from '../dist/schema-engine-precompiled.js';
import { corpus } from './support/edge-corpus.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ajv = ajvEngine();
const precompiled = precompiledEngine();

/** The comparable part of Ajv's verbose errors: everything but the schema objects, which differ in identity between the engines. */
const comparable = (errors) => (errors ?? []).map(({ keyword, instancePath, schemaPath, params, message, data }) => ({ keyword, instancePath, schemaPath, params, message, data }));

/** Every object of `value`, depth first. */
function* objects(value) {
	if (value && typeof value === 'object') {
		yield value;
		for (const child of Object.values(value)) yield* objects(child);
	}
}

/** The oneOf and anyOf branches of the schemas: { branch, rootId }. A map of named schemas (`properties`, `$defs`) is not a schema itself. */
function* unions(node, rootId, isMap = false) {
	if (!node || typeof node !== 'object') return;
	if (!isMap && !Array.isArray(node)) for (const keyword of ['oneOf', 'anyOf']) if (Array.isArray(node[keyword])) for (const branch of node[keyword]) if (branch && typeof branch === 'object') yield { branch, rootId };
	for (const [key, child] of Object.entries(node)) {
		if (!isMap && ['enum', 'const', 'examples', 'default'].includes(key)) continue;
		yield* unions(child, rootId, !isMap && ['properties', '$defs', 'definitions', 'patternProperties', 'dependentSchemas'].includes(key));
	}
}

describe('the precompiled schema engine', () => {
	const documents = corpus({ mutants: 1, records: 3 }).map((document) => ({ ...document, value: document.filename.endsWith('.json') ? JSON.parse(document.text) : undefined })).filter((document) => document.value);

	test('has a validator for every registered schema, and it agrees with Ajv on the corpus', () => {
		let invalid = 0;
		for (const name of Object.keys(schemas)) {
			const expected = ajv.root(name);
			const actual = precompiled.root(name);
			assert.equal(typeof actual, 'function', `no precompiled validator for ${name}`);
			for (const { id, value } of documents) {
				const verdict = expected(structuredClone(value));
				assert.equal(actual(structuredClone(value)), verdict, `${name} on ${id}`);
				assert.deepEqual(comparable(actual.errors), comparable(expected.errors), `${name} on ${id}`);
				if (!verdict) invalid++;
			}
		}
		assert.ok(invalid > 100, `the corpus should exercise the error paths (${invalid} invalid)`);
	});

	test('reports the schema objects validate knows, so a finding finds its definition', () => {
		const known = new Set([...Object.values(schemas)].flatMap((schema) => [...objects(schema)]));
		const check = precompiled.root('presentation');
		let seen = 0;
		for (const { value } of documents) {
			check(structuredClone(value));
			for (const error of check.errors ?? []) {
				assert.ok(known.has(error.parentSchema), `${error.schemaPath}: parentSchema is not an object of the bundled schemas`);
				if (Array.isArray(error.schema) || (error.schema && typeof error.schema === 'object')) assert.ok(known.has(error.schema), `${error.schemaPath}: schema is not an object of the bundled schemas`);
				seen++;
			}
		}
		assert.ok(seen > 100, `${seen} errors seen`);
	});

	test('has a validator for every oneOf and anyOf branch, with the verdicts and errors of Ajv', () => {
		// Values to try each branch on: every object and array of the corpus, plus scalars and the empty forms.
		const values = [null, true, 0, 1.5, 'text', '', [], {}, { type: 'unknown' }];
		for (const { value } of documents) for (const node of objects(value)) if (values.length < 1500) values.push(node);
		let branches = 0;
		let rejected = 0;
		for (const [name, schema] of Object.entries(schemas)) {
			for (const { branch, rootId } of unions(schema, schema.$id)) {
				const actual = precompiled.branch(branch, rootId);
				assert.equal(typeof actual, 'function', `${name}: no precompiled validator for a branch ${JSON.stringify(branch).slice(0, 80)}`);
				const expected = ajv.branch(branch, rootId);
				branches++;
				for (const value of values) {
					const verdict = expected(structuredClone(value));
					assert.equal(actual(structuredClone(value)), verdict, `${name}: ${JSON.stringify(branch).slice(0, 80)} on ${JSON.stringify(value).slice(0, 80)}`);
					assert.deepEqual(comparable(actual.errors), comparable(expected.errors), `${name}: ${JSON.stringify(branch).slice(0, 80)} on ${JSON.stringify(value).slice(0, 80)}`);
					if (!verdict) rejected++;
				}
			}
		}
		assert.ok(branches >= 200, `${branches} branches`);
		assert.ok(rejected > 1000, `${rejected} rejected values`);
	});

	test('has the definitions validate checks on their own', () => {
		for (const definition of ['ColorVariable', 'TextVariable', 'DatasetRef', 'ChartData', 'StyledTableCell', 'DataColumn']) {
			const actual = precompiled.definition('presentation', definition);
			assert.equal(typeof actual, 'function', definition);
			assert.equal(typeof ajv.definition('presentation', definition), 'function', definition);
		}
		assert.equal(precompiled.definition('presentation', 'NoSuchDefinition'), undefined);
	});

	test('compiles nothing: the engine and its generated validators contain no code generation', () => {
		const source = readFileSync(path.join(root, 'dist', 'schema-engine-precompiled.js'), 'utf8');
		assert.doesNotMatch(source, /\bnew Function\b|\beval\s*\(|\bFunction\s*\(/);
		assert.doesNotMatch(source, /\brequire\(/);
	});
});

describe('the engine a host gets', { concurrency: true }, () => {
	const directory = mkdtempSync(path.join(tmpdir(), 'opf-edge-'));
	const NO_CODEGEN = '--disallow-code-generation-from-strings';
	const execute = promisify(execFile);
	const run = async (name, flags, args = [], env = {}) => {
		const out = path.join(directory, `${name}.json`);
		try {
			await execute(process.execPath, [...flags, path.join(root, 'test', 'support', 'edge-run.mjs'), out, ...args], { encoding: 'utf8', maxBuffer: 1 << 26, env: { ...process.env, ...env } });
			return { status: 0, stderr: '', results: JSON.parse(readFileSync(out, 'utf8')) };
		} catch (error) {
			return { status: error.code ?? 1, stderr: String(error.stderr ?? error.message) };
		}
	};
	const expected = run('ajv', []);

	test('the default build compiles with Ajv, and a host that forbids code generation cannot run it', async () => {
		assert.equal((await expected).status, 0, (await expected).stderr.slice(0, 2000));
		const denied = await run('denied', [NO_CODEGEN], [], { OPF_EDGE_LIMIT: '3' });
		assert.equal(denied.status, 0, denied.stderr.slice(0, 2000));
		const messages = Object.values(denied.results).map((entry) => entry.error ?? '');
		assert.equal(messages.length, 3);
		assert.ok(messages.every((message) => /Code generation from strings disallowed/.test(message)), `validate with Ajv should fail on code generation, got ${JSON.stringify(messages).slice(0, 500)}`);
	});

	for (const [name, flags, args] of [
		['workerd', ['--conditions=workerd'], []],
		['worker', ['--conditions=worker'], []],
		['edge-light', ['--conditions=edge-light'], []],
		['the precompiled import', [], ['precompiled']],
	]) {
		test(`${name}: validates the examples with no code generation, with the verdicts and findings of Ajv`, async () => {
			const result = await run(name.replaceAll(' ', '-'), [NO_CODEGEN, ...flags], args);
			assert.equal(result.status, 0, result.stderr.slice(0, 2000));
			const want = (await expected).results;
			assert.deepEqual(Object.keys(result.results), Object.keys(want));
			for (const id of Object.keys(want)) assert.deepEqual(result.results[id], want[id], id);
			assert.ok(Object.values(result.results).some((entry) => entry.report && entry.report.schemaValid === false), 'the corpus has invalid documents');
		});
	}

	test.after(() => rmSync(directory, { recursive: true, force: true }));
});
