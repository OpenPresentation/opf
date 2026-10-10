// FA-29: opf/language-tag, the warning for a language tag that is malformed, names an unassigned region or is not canonical.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { validate } from '../dist/index.js';

const only = (document) => validate(document, { only: ['language-tag'] }).findings;
const clean = (tag) => only(deck({ language: tag })).length === 0;
const deck = (extra = {}, slide = { title: 'T', text: 'x' }) => ({ name: 'Tags', language: 'en-US', ...extra, slides: [slide] });

test('well-formed canonical tags are not reported', () => {
	for (const tag of ['en', 'en-US', 'en-GB', 'es-419', 'zh-Hans', 'zh-Hant-TW', 'sr-Latn-ME', 'pt-BR', 'ja', 'x-private', 'en-XA', 'fil', 'tlh'])
		assert.ok(clean(tag), tag);
	assert.deepEqual(only(deck()), []);
	assert.deepEqual(only({ name: 'No language', slides: [{ title: 'T' }] }), []);
});

test('an underscore form never reaches the rule: the schema pattern rejects it first', () => {
	const found = validate(deck({ language: 'en_US' })).findings;
	assert.ok(found.some((entry) => entry.ruleId === 'opf/schema' && entry.path === '/language'));
	assert.ok(!found.some((entry) => entry.ruleId === 'opf/language-tag'));
});

test('a region that is not assigned is reported, and UK suggests GB', () => {
	const [uk] = only(deck({ language: { bcp47: 'fr-UK' } }));
	assert.equal(uk.path, '/language/bcp47');
	assert.match(uk.message, /not an assigned region/);
	assert.equal(uk.fixes[0].patch[0].value, 'fr-GB');
	assert.equal(uk.fixes[0].safe, false);
	const [other] = only(deck({ language: 'en-QQ'.replace('QQ', 'ZY') }));
	assert.match(other.message, /'ZY'/);
	assert.equal(other.fixes, undefined);
	assert.deepEqual(only(deck({ language: 'es-419' })), [], 'a UN M.49 area is a region');
	assert.deepEqual(only(deck({ language: 'kmr' })), [], 'a macrolanguage the locale data folds is still a legitimate tag');
	assert.deepEqual(only(deck({ language: 'iw' })), [], 'a deprecated language subtag is left alone');
	const [deprecated] = only(deck({ language: 'en-BU' }));
	assert.match(deprecated.message, /deprecated; use 'MM'/);
	assert.equal(deprecated.fixes[0].patch[0].value, 'en-MM');
	assert.deepEqual(only(deck({ language: 'en-XK' })), [], 'Kosovo has a user-assigned code in CLDR');
});

test('en-UK as the deck language is the schema rule, not reported twice; a run is still reported', () => {
	const result = validate(deck({ language: 'en-UK' }), { only: ['language-tag', 'schema'] });
	assert.deepEqual(result.findings.map((entry) => entry.ruleId).filter((id) => id === 'opf/language-tag'), []);
	const run = only(deck({}, { title: 'T', text: ['The ', { text: 'colour', lang: 'en-UK' }] }));
	assert.equal(run.length, 1);
	assert.equal(run[0].path, '/slides/0/text/1/lang');
	assert.equal(run[0].fixes[0].patch[0].value, 'en-GB');
});

test('wrong case is a spelling-only suggestion of the canonical form', () => {
	const [finding] = only(deck({}, { title: [{ text: 'Bonjour', lang: 'FR-ca' }] }));
	assert.equal(finding.path, '/slides/0/title/0/lang');
	assert.match(finding.message, /canonical form is 'fr-CA'/);
	assert.equal(finding.fixes[0].safe, true);
	assert.deepEqual(only(deck({ language: 'EN-us' })).map((entry) => entry.fixes[0].patch[0].value), ['en-US']);
});

test('a tag that is not well formed has no suggestion', () => {
	const [finding] = only(deck({}, { title: 'T', items: [['a ', { text: 'b', lang: 'en-a' }]] }));
	assert.equal(finding.path, '/slides/0/items/0/1/lang');
	assert.match(finding.message, /not a well-formed BCP 47/);
	assert.equal(finding.fixes, undefined);
});

test('runs in lists, tables, quotes and blocks are checked, and slides report their own path', () => {
	const bad = (text) => ({ text, lang: 'en-UK' });
	const found = only(
		deck(
			{},
			{
				title: 'T',
				blocks: [
					{ bullets: [{ text: [bad('a')] }] },
					{ table: { columns: [[bad('H')]], rows: [[[bad('c')]]] } },
					{ quote: { text: [bad('q')] } },
				],
			},
		),
	);
	assert.deepEqual(
		found.map((entry) => entry.path).sort(),
		['/slides/0/blocks/0/bullets/0/text/0/lang', '/slides/0/blocks/1/table/columns/0/0/lang', '/slides/0/blocks/1/table/rows/0/0/0/lang', '/slides/0/blocks/2/quote/text/0/lang'],
	);
});

test('the rule is registered, can be switched off and sits in the content category', () => {
	const report = validate(deck({ language: 'en-ZY' }));
	assert.ok(report.findings.some((entry) => entry.ruleId === 'opf/language-tag'));
	assert.ok(!validate(deck({ language: 'en-ZY' }), { ignore: ['language-tag'] }).findings.some((entry) => entry.ruleId === 'opf/language-tag'));
	assert.ok(!validate(deck({ language: 'en-ZY' }), { only: ['accessibility'] }).findings.some((entry) => entry.ruleId === 'opf/language-tag'));
});

test('every bcp47 of the bundled language catalog records is a clean tag', () => {
	const root = new URL('../../../', import.meta.url);
	const dir = new URL('packages/gallery/catalog/languages/', root);
	for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
		const record = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
		if (typeof record.bcp47 === 'string') assert.ok(clean(record.bcp47), `${file}: ${record.bcp47}`);
	}
});
