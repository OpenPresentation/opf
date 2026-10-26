// CE-01: core runs in the real `workerd` runtime. Cloudflare Workers refuse code generation from strings while they handle a
// request, and Ajv compiles every schema with `new Function`, so a Worker can validate only with validators generated at build time.
// The package's export conditions (`workerd`, `worker`) route a Worker to them. This test bundles the package the way Wrangler does,
// runs the bundle in workerd with no Cloudflare account, validates every example deck of examples/ (and mutants of them, which reach
// the error paths), and requires the findings to equal the ones Node produces with Ajv.
//
// It also proves the lane can fail: a Worker bundled without the worker conditions runs Ajv, and workerd must refuse it. If the
// default validators went back to runtime compilation (the `#schema-engine` map in package.json, `src/schema-engine-*.ts`), the
// first test would fail with workerd's "Code generation from strings disallowed" in place of the findings.
//
// Run it with `pnpm --filter @openpresentation/opf run test:workerd`. CI runs it in the core job; OPF_REQUIRE_WORKERD=1 (set there)
// turns "no workerd binary for this platform" from a skip into a failure.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import * as opf from '../dist/browser.js';
import { corpus } from './support/edge-corpus.mjs';
import { evaluate } from './support/edge-evaluate.mjs';
import { startWorker, workerd } from './support/workerd.mjs';

const available = workerd() !== undefined;
if (!available && process.env.OPF_REQUIRE_WORKERD) throw new Error('OPF_REQUIRE_WORKERD is set, but the workerd package has no binary for this platform.');

// What crosses the wire: JSON, which leaves out `undefined` properties.
const wire = (value) => JSON.parse(JSON.stringify(value));

const post = async (worker, documents) => {
	const response = await fetch(worker.url, { method: 'POST', body: JSON.stringify(documents) });
	const body = await response.text();
	assert.equal(response.status, 200, body.slice(0, 2000));
	return JSON.parse(body);
};

describe('core in workerd', { skip: !available && 'the workerd package has no binary for this platform' }, () => {
	const documents = corpus({ mutants: 1, records: 3 });

	describe('with the worker conditions', () => {
		let worker;
		before(async () => {
			worker = await startWorker({ conditions: ['workerd', 'worker', 'browser'] });
		});
		after(async () => worker?.stop());

		test('validates every example deck with the verdicts and findings Node gives with Ajv', async () => {
			const got = await post(worker, documents);
			const decks = documents.filter((document) => /^examples\//.test(document.id) && !document.id.includes('#'));
			assert.ok(decks.length >= 100, `${decks.length} example decks`);
			let invalid = 0;
			let alternatives = 0;
			for (const document of documents) {
				const want = wire(evaluate(opf, document));
				assert.equal(got[document.id]?.error, undefined, `${document.id}: ${got[document.id]?.error}`);
				assert.deepEqual(got[document.id], want, document.id);
				if (want.report?.schemaValid === false) invalid++;
				alternatives += JSON.stringify(want).split('alternatives').length - 1;
			}
			assert.ok(invalid > 50, `${invalid} invalid documents: the corpus should reach the error paths`);
			assert.ok(alternatives > 20, `${alternatives} union alternatives: the corpus should reach the best match of a oneOf`);
			// The examples are valid OPF, in Node and in workerd.
			for (const deck of decks) assert.equal(got[deck.id].report.schemaValid, true, `${deck.id} is valid OPF`);
		});

		test('serves repeated requests from the same precompiled validators', async () => {
			const [first] = documents;
			const again = await post(worker, [first, first, first]);
			assert.deepEqual(again, { [first.id]: wire(evaluate(opf, first)) });
		});
	});

	describe('control: a Worker bundled without the worker conditions', () => {
		let worker;
		before(async () => {
			// Only `browser`: the package routes this to Ajv, which compiles schemas with `new Function`.
			worker = await startWorker({ conditions: ['browser'] });
		});
		after(async () => worker?.stop());

		test('cannot validate: workerd refuses runtime code generation', async () => {
			const [first] = documents;
			const got = await post(worker, [first]);
			assert.match(got[first.id].error ?? '', /Code generation from strings disallowed/, JSON.stringify(got[first.id]).slice(0, 500));
		});
	});
});
