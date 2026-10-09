import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { validate } from '../dist/index.js';
import { defaultCatalog } from '../dist/catalog.js';

// opf#485: validate measured script text in the one face a style names (Arabic in the Latin title face) and reported
// opf/layout-failed, while the engines plan each script run in its script slot's face. A fonts handle whose measurement
// can plan (`forScripts`, the renderer's loadFonts() measurement) is now asked for the slide's plan, as the engines do.

const catalogs = [defaultCatalog];
const arabic = /[؀-ۿ]/u;
const arabicTitle = 'مراجعة ربع سنوية للمنتج';
const arabicBody = 'بدأ العمل على المنصة الجديدة في مطلع العام، وقد شمل ذلك إعادة تصميم تجربة المستخدم بالكامل.';

/**
 * A small font registry in the shape of the renderer's: `resolveStyle` maps a family to the loaded face that draws it,
 * `measure` throws `missing-glyph` for a character that face lacks, and `forScripts(profile)` plans each Arabic run in
 * the profile's complexScript slot (heading or body by the style's latin family). `naskh: false` leaves the Arabic face
 * out, so the complexScript family falls back to the Latin face that cannot draw it.
 */
function registry({ naskh = true, planner = true } = {}) {
	const faces = { 'Latin Display': (character) => !arabic.test(character), 'Latin Sans': (character) => !arabic.test(character), ...(naskh ? { Naskh: () => true } : {}) };
	const routes = { 'aptos display': 'Latin Display', aptos: 'Latin Sans', ...(naskh ? { 'arabic typesetting': 'Naskh' } : {}) };
	const faceOf = (family) => (faces[family] ? family : (routes[String(family).toLowerCase()] ?? 'Latin Sans'));
	const profiles = [];
	const measurement = {
		resolveStyle: (style) => ({ ...style, fontFamily: faceOf(style.fontFamily) }),
		measure(text, size, style) {
			const face = faceOf(style.fontFamily);
			for (const character of text) {
				if (!faces[face](character)) throw Object.assign(new Error(`Font '${face}' cannot display U+${character.codePointAt(0).toString(16).toUpperCase()}.`), { code: 'missing-glyph' });
			}
			return [...text].length * size * 0.5;
		},
	};
	if (planner)
		measurement.forScripts = (profile) => {
			profiles.push(profile);
			const slotsOf = (style) => (faceOf(style.fontFamily) === faceOf(profile.heading.latin) ? profile.heading : profile.body);
			return {
				...measurement,
				measure(text, size, style) {
					const runs = [];
					for (const character of text) {
						const script = arabic.test(character) ? 'cs' : /[\p{L}\p{N}]/u.test(character) ? 'latin' : (runs.at(-1)?.script ?? 'latin');
						if (runs.at(-1)?.script === script) runs.at(-1).text += character;
						else runs.push({ script, text: character });
					}
					return runs.reduce((width, run) => width + measurement.measure(run.text, size, run.script === 'cs' ? { ...style, fontFamily: slotsOf(style).complexScript } : style), 0);
				},
			};
		};
	return { fonts: { textMeasurement: measurement }, profiles };
}

const layoutFailures = (report) => report.findings.filter((finding) => finding.ruleId === 'opf/layout-failed');
const arabicDeck = { name: 'Arabic deck', language: 'ar-SA', slides: [{ title: arabicTitle, text: arabicBody }] };
const runInEnglish = {
	name: 'Arabic run in an English deck',
	language: 'en-US',
	slides: [
		{ title: ['Quarterly review: ', { text: 'مراجعة ربع سنوية', lang: 'ar-SA' }], text: ['The Arabic phrase ', { text: arabicTitle, lang: 'ar-SA', bold: true }, ' sits inside this English paragraph.'] },
	],
};

describe('validate measures script text with the fonts handle\'s script faces (opf#485)', () => {
	test('an ar-SA deck composes with the Arabic script face: no opf/layout-failed', () => {
		const { fonts, profiles } = registry();
		const report = validate(arabicDeck, { catalogs, fonts });
		assert.deepEqual(layoutFailures(report), []);
		assert.equal(report.checks.layout, 'measured');
		// The slide's profile names the language's complex-script family for both roles, as the engines' profile does.
		assert.equal(profiles[0].bcp47, 'ar-SA');
		assert.equal(profiles[0].rtl, true);
		assert.deepEqual(profiles[0].heading, { latin: 'Aptos Display', eastAsian: 'Aptos Display', complexScript: 'Arabic Typesetting' });
		assert.deepEqual(profiles[0].body, { latin: 'Aptos', eastAsian: 'Aptos', complexScript: 'Arabic Typesetting' });
	});

	test('an ar-SA run in an en-US deck is planned with its own language\'s profile: no opf/layout-failed', () => {
		const { fonts, profiles } = registry();
		const report = validate(runInEnglish, { catalogs, fonts });
		assert.deepEqual(layoutFailures(report), []);
		// The deck profile keeps the Latin family in the complex-script slot; the run's own profile names the Arabic one.
		assert.equal(profiles[0].bcp47, 'en-US');
		assert.equal(profiles[0].body.complexScript, 'Aptos');
		const own = profiles.find((profile) => profile.bcp47 === 'ar-SA');
		assert.ok(own, 'the ar-SA run asks for its own profile');
		assert.equal(own.languageSource, 'option');
		assert.equal(own.body.complexScript, 'Arabic Typesetting');
	});

	test('without the Arabic face a real missing glyph is still reported', () => {
		for (const document of [arabicDeck, runInEnglish]) {
			const report = validate(document, { catalogs, fonts: registry({ naskh: false }).fonts });
			const failures = layoutFailures(report);
			assert.equal(failures.length, 1);
			assert.equal(failures[0].path, '/slides/0');
			assert.match(failures[0].message, /^Layout failed: Font 'Latin (Display|Sans)' cannot display U\+6/);
		}
	});

	test('a measurement that cannot plan scripts measures as before', () => {
		const report = validate(arabicDeck, { catalogs, fonts: registry({ planner: false }).fonts });
		assert.equal(layoutFailures(report).length, 1);
		assert.match(layoutFailures(report)[0].message, /cannot display U\+6/);
		// Core's portable estimate needs no faces.
		assert.deepEqual(layoutFailures(validate(arabicDeck, { catalogs })), []);
	});
});
