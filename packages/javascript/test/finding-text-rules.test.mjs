// The plain-words text of the opf/* rules (describeFinding) and explain(): every rule of the registry has a message and a next line that read well,
// the sentences are checked word for word for representative rules, and every explain() example is run through validate.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { explain as rootExplain, findValidationRule, validate, validationRules } from '../dist/index.js';
import { describeFinding, explain } from '../dist/source.js';
import { CASES, HAND_BUILT, casesFindings, documentOf } from './support/finding-text-corpus.mjs';

const RULE_IDS = validationRules.map((info) => info.id);
const describeAll = () =>
	[
		...CASES.flatMap((testCase) => casesFindings(testCase).map((finding) => ({ name: testCase.name, rule: testCase.rule, finding, document: documentOf(testCase) }))),
		...HAND_BUILT.map((entry) => ({ name: entry.name, rule: entry.finding.ruleId, finding: entry.finding, document: entry.document })),
	];

/** name -> [message, next] of the first finding of the case. */
const GOLDEN = {
  "json-syntax": ["The list `\"slides\": [` on line 1 is never closed.", "add `]` after its last item."],
  "duplicate-key": ["`name` appears twice at the top level. JSON keeps only the last value, so the earlier one is ignored.", "keep one of them, or merge their values into one."],
  "schema-type": ["`items` should be a list, but it is text (`One string`).", "write [\"One string\"]."],
  "reference-id-duplicate": ["Two references use the id `a` (references 1 and 2).", "give the later one another id (for example `a-2`); runs cite references by id."],
  "cite-unknown-reference": ["`cite: \"smth\"` names a reference that does not exist.", "did you mean `smith`? Or add a reference with the id `smth` under `references`."],
  "cite-unsupported-location": ["`cite` and `footnote` are drawn only in titles, text, bullets, list items and quotes, not in table cells.", "move the cited run into a text block, or remove the citation here."],
  "caption-unsupported-payload": ["A `caption` belongs to one image, chart, table or video; this block is text.", "put the `caption` on the image, chart, table or video it describes, or remove it."],
  "image-option-unsupported-payload": ["`fit` only applies to pictures; this block is a chart.", "remove `fit`, or move it onto an image."],
  "image-placement-invalid": ["Blocks 1 and 2 are both placed on the left edge, and a slide edge takes one placed image.", "move one of them to another edge, or remove its `placement`."],
  "dataset-unknown": ["`dataset: \"sale\"` does not exist. Datasets in this deck: sales.", "did you mean `sales`? Or add `datasets.sale`."],
  "dataset-field-unknown": ["`regon` is not a column of `sales`. Columns: region, revenue.", "did you mean `region`?"],
  "data-column-duplicate": ["Two columns are named `region`. Series and mappings address columns by name.", "rename the second one (for example `region-2`)."],
  "chart-mapping-unknown-column": ["The chart mapping names column `Profit`, which the data does not have. Columns: Q, R, S.", "pick one of `Q`, `R` or `S`."],
  "number-format-invalid": ["`%` is not a number format OPF can read. It needs a numeric part of '#' and '0' characters.", "write a format such as `0.0`, `#,##0`, `0%` or `$#,##0.00`."],
  "variable-unknown-builtin": ["`{{deck.nmae}}` is not a built-in variable.", "did you mean `deck.name`?"],
  "chart-highlight-unknown-name-series": ["`highlight: \"Foo\"` matches no series. Available: Q, Rev.", "pick one of `Q` or `Rev`."],
  "variable-unfilled-declared": ["Required variable `who` has no value, so `{{who}}` would show literally.", "give it a `value`, or mark the deck `template: true`."],
  "variable-unfilled-token": ["`{{name}}` is still in the text, so it would show literally.", "declare `name` under `variables` and give it a value, or replace the token with the real text."],
  "run-color-unrecognized": ["`color: \"accnt1\"` is not a hex color, a scheme color or a `var:` reference, so the theme color is used.", "did you mean `accent1`?"],
  "undeclared-catalog": ["`acme:hero` uses catalog group `acme`, which `catalogs` does not declare, so it can never resolve.", "declare `catalogs.acme`, or write `hero`."],
  "asset-reference": ["`asset:lgog` is not in `assets`. Assets: logo.", "did you mean `asset:logo`? Or add `assets.lgog`."],
  "asset-cycle": ["Asset `a` points back to itself through `b`.", "give one link a real source (an https:// address or embedded data) instead of an `asset:` reference."],
  "catalog-record": ["The embedded theme `custom` is invalid: `background` should be an object, but it is text (`light1`).", "write an object."],
  "layout-region-reserved": ["Region name `left` is reserved, so it can't name a body region of layout `mine`. Reserved names: title, subtitle, tag, auto, left, center, right, top, middle, bottom.", "rename it, for example `left-area`."],
  "unresolved-reference-layout": ["Layout `pilars` is not embedded or in a registered catalog, so the slide is laid out automatically.", "did you mean `pillars`?"],
  "unresolved-reference-theme": ["Theme `minimall` is not embedded or in a registered catalog, so the engine default is used.", "did you mean `minimal`?"],
  "catalog-record-not-in-source": ["`my-special` says it comes from https://www.pptx.gallery, but that catalog has no such record. It is treated as your own.", "move it to `catalogs.custom`, or use an id that the catalog publishes."],
  "unused-reference": ["Reference `a` is never cited.", "cite it from a text, bullet or list item (`cite: \"a\"`), or remove it."],
  "unused-dataset": ["Dataset `sales` is not used by any chart or table.", "point a chart or table at it with `dataset: \"sales\"`, or remove it."],
  "unknown-beat": ["Slide 1 names beat `zzz`, which narrative `classic-story` does not define. Its beats include hero, plan, closing, context, despair.", "use one of `hero`, `plan`, `closing`, `context` or `despair`, or remove `beat`."],
  "variable-unknown": ["`{{nmae}}` is not declared under `variables`.", "did you mean `name`? Or declare `nmae` under `variables`."],
  "variable-unused": ["Variable `name` is declared but never used.", "use it as `{{name}}` or `var:name` where it belongs, or remove its declaration."],
  "contract": ["`layout` is `cover`, which this host's policy does not allow. Allowed: text, title.", "pick one of `text` or `title`."],
  "text-contrast": ["Text `#CCCCCC` on `#FFFFFF` has contrast 1.61:1; WCAG needs 3:1 for large text.", "use `text`, the slide's text color, which is readable here."],
  "missing-alt-text": ["This image has no alt text.", "describe it in `alt`, or write `alt: \"\"` if it is only decoration."],
  "poor-alt-text": ["Alt text `IMG_2041.png` looks like a file name, so it doesn't describe the picture.", "describe what the picture shows, in plain words and without a leading \"image of\"."],
  "missing-slide-title": ["Slide 2 (`intro`) has no title, and screen reader users find slides by title.", "write a `title` for it."],
  "duplicate-slide-title": ["Slides 1 and 3 share the title `results`.", "give one of them a title that tells it apart, so people can find each slide by title."],
  "link-text": ["The link text `click here` doesn't say where it goes.", "say what is at https://example.com/report, for example the page or file name."],
  "chart-colors-adjusted-contrast": ["Chart color 2 (`#7B241C`) has 1.7:1 contrast against the chart panel (`#011842`), so it is drawn lighter or darker to reach 3:1.", "pick a color with at least 3:1 contrast against `#011842`, or remove `colors` to use the palette."],
  "chart-text-alternative": ["The chart on slide 1 has no text alternative.", "write the message it carries in `alt`, or add text beside it that states what it shows."],
  "missing-language": ["The deck doesn't declare its language.", "add `\"language\": \"en-US\"` (or the language the text is written in) to the deck."],
  "chart-option-adapted": ["`dataLabels.position` isn't supported by a pie chart and is adapted. The type's default position is used.", "remove `dataLabels.position`, or choose a chart type that can show it."],
  "text-overflow": ["Text on slide 1 doesn't fit at the smallest allowed size.", "shorten it, split the slide, or choose a roomier layout."],
  "min-font-size-run": ["A text run on slide 1 is set to 8 pt, below the 11 pt readable minimum.", "raise `fontSize` to at least 11."],
  "region-unknown": ["Block pinned to region `timelin`; layout `r` has timeline and notes.", "did you mean `timeline`? Or remove `region`."],
  "region-kind": ["Region `timeline` doesn't take text content (it takes timeline).", "remove `region` so OPF places the block by its kind, or pin it to a region that takes text."],
  "region-full": ["Region `timeline` already holds 1 block, which is all it takes.", "pin the block to another region with room, or remove `region`."],
  "furniture-wraps": ["The footer left text wraps onto 3 lines (2 at most); headers and footers should be short.", "shorten it, or move part of it to another zone."],
  "font-outside-scheme": ["`Comic Sans MS` isn't in this deck's font scheme (Aptos Display / Aptos), so it won't follow a scheme change.", "remove `fontFamily` to use the scheme font, or add the font to the font scheme."],
  "image-resolution": ["This image is 100×100 px, shown at about 8 ppi; 96 are needed to look sharp.", "use a file of about 1162×519 px or larger, or show it smaller."],
  "chart-value-not-numeric": ["`about 12` is text, so it is plotted as a gap.", "write a number (12, -3.5, 1e6) and put units, currency or percent in the column `format`."],
  "code-highlight-out-of-range": ["Highlight line 7 is past the last line (3), so it marks nothing.", "change it to a line from 1 to 3, or remove the entry."],
  "code-highlight-range-reversed": ["Highlight 3–1 ends before it starts, so it marks no line.", "write [1, 3]."],
  "duration-outside-narrative": ["A 5-minute deck is outside the 10-20 minutes that narrative `arc` suits.", "change `duration`, or choose a narrative that suits 5 minutes."],
  "placeholder-text": ["`Lorem ipsum dolor sit amet` looks like placeholder text (lorem ipsum).", "replace it with the real text."],
  "empty-slide": ["Slide 2 (`blank-one`) has no content.", "add content or a `title`, remove the slide, or give it the `blank` layout if it is meant to be empty."],
  "language-tag": ["`fr-UK` is not a valid tag: `UK` is not an assigned region.", "did you mean `fr-GB`?"],
  "unused-beat": ["Beat `ask` (3 of 3) of narrative `arc` has no slide.", "give a slide `beat: \"ask\"`, or ignore this if the beat is optional."],
  "layout-failed": ["Slide 1 (layout `broken`) couldn't be laid out: Invalid composition.padding, so the geometry checks were skipped.", "fix the composition setting or content named above."],
  "reading-order-differs": ["`blocks.0` is read at position 1 but appears at position 2 on slide 2, so a screen reader reads the slide out of order.", "reorder the blocks so the reading order follows what people see, or pin them to layout regions."],
  "schema-without-keyword": ["must NOT be valid.", "inspect this schema constraint and preserve unrelated content."],
};

const firstOf = (name) => {
	const testCase = CASES.find((entry) => entry.name === name);
	if (testCase) return { finding: casesFindings(testCase)[0], document: documentOf(testCase) };
	const hand = HAND_BUILT.find((entry) => entry.name === name);
	return { finding: hand.finding, document: hand.document };
};

test('every case of the corpus triggers its rule, and every one of the 77 rules has a case', () => {
	for (const testCase of CASES) assert.ok(casesFindings(testCase).length > 0, `${testCase.name} does not trigger ${testCase.rule}`);
	const covered = new Set(describeAll().map((entry) => entry.rule));
	assert.deepEqual(RULE_IDS.filter((id) => !covered.has(id)), []);
	assert.equal(RULE_IDS.length, 77);
});

test('the text tables have an entry for every rule of the registry and none for a rule that does not exist', () => {
	const keys = new Set();
	for (const file of ['finding-text-format.ts', 'finding-text-audit.ts']) {
		const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
		for (const found of source.matchAll(/^\s+"(opf\/[a-z0-9-]+)": [A-Za-z]+,$/gm)) keys.add(found[1]);
	}
	assert.deepEqual(RULE_IDS.filter((id) => !keys.has(id)), [], 'a rule without text');
	assert.deepEqual([...keys].filter((id) => !RULE_IDS.includes(id)), [], 'text for a rule that does not exist');
	const explainKeys = new Set();
	for (const file of ['format', 'references', 'audit', 'content']) {
		const source = readFileSync(new URL(`../src/finding-text-explain-${file}.ts`, import.meta.url), 'utf8');
		for (const found of source.matchAll(/^\s+"(opf\/[a-z0-9-]+)": ex\(/gm)) explainKeys.add(found[1]);
	}
	assert.deepEqual(RULE_IDS.filter((id) => !explainKeys.has(id)), [], 'a rule without a fix and example');
	assert.deepEqual([...explainKeys].filter((id) => !RULE_IDS.includes(id)), [], 'an explanation for a rule that does not exist');
});

test('describeFinding gives every rule a message and a next line in plain words', () => {
	for (const { name, finding, document } of describeAll()) {
		const text = describeFinding(finding, { document });
		assert.ok(text.message && text.message.trim() === text.message, `${name}: message`);
		assert.ok(text.next && text.next.trim() === text.next, `${name}: next`);
		assert.doesNotMatch(text.message, /\/(slides|design|catalogs|datasets|assets|references|variables)\//, `${name}: a JSON Pointer in "${text.message}"`);
		if (name !== 'contract-host-message' && name !== 'schema-without-keyword') assert.doesNotMatch(text.message, /\bmust\b|must NOT|should have|additional properties/, `${name}: Ajv phrase in "${text.message}"`);
		assert.doesNotMatch(`${text.message} ${text.next}`, /!|colour|Colour|^Next:/, `${name}: style in "${text.message} ${text.next}"`);
		assert.match(text.message, /[.?]$/, `${name}: message ends a sentence: ${text.message}`);
		assert.doesNotMatch(text.next, /^[A-Z]/, `${name}: next starts in lower case: ${text.next}`);
		assert.match(text.next, /[.?]$/, `${name}: next ends with . or ?: ${text.next}`);
		assert.doesNotMatch(text.next, /^Next:/i, name);
	}
});

test('describeFinding reads the same text without a document', () => {
	for (const { name, finding } of describeAll()) {
		const text = describeFinding(finding);
		assert.ok(text.message && text.next, `${name}: no document`);
		assert.match(text.next, /[.?]$/, name);
	}
});

test('describeFinding words for representative rules, exactly', () => {
	assert.ok(Object.keys(GOLDEN).length >= 25);
	for (const [name, [message, next]] of Object.entries(GOLDEN)) {
		const { finding, document } = firstOf(name);
		const text = describeFinding(finding, { document });
		assert.deepEqual([text.message, text.next], [message, next], name);
	}
});

test('a finding that is not the shape core emits keeps its message and still gets a next line', () => {
	for (const id of RULE_IDS.filter((rule) => rule !== 'opf/schema')) {
		const odd = { ruleId: id, severity: 'warning', category: 'content', scope: 'document', path: '/slides/9/zzz', message: 'Something odd happened in colour 3' };
		const text = describeFinding(odd, { document: {} });
		assert.ok(text.message && text.next, id);
		assert.match(text.next, /[.?]$/, id);
		assert.doesNotMatch(text.message, /colour/, id);
	}
	const other = describeFinding({ ruleId: 'acme/rule', severity: 'info', category: 'x', path: '', message: 'Their sentence.', help: 'Their hint. More.' });
	assert.deepEqual(other, { message: 'Their sentence.', next: 'their hint.' });
});

test('slide-scoped rules say which slide, and the slide id when the deck gives one', () => {
	const title = describeFinding(firstOf('missing-slide-title').finding, { document: firstOf('missing-slide-title').document });
	assert.match(title.message, /^Slide 2 \(`intro`\)/);
	assert.match(describeFinding(firstOf('text-overflow').finding).message, /slide 1/);
	assert.match(describeFinding(firstOf('empty-slide').finding).message, /^Slide 2/);
});

test('explain returns the registry entry with a fix and an example for every rule', () => {
	for (const info of validationRules) {
		const entry = explain(info.id);
		assert.ok(entry, info.id);
		assert.equal(entry.id, info.id);
		assert.equal(entry.name, info.name);
		assert.equal(entry.category, info.category);
		assert.equal(entry.severity, info.severity);
		assert.ok(entry.summary.length > 10 && entry.rationale.length > 20, info.id);
		assert.ok(entry.fix.length > 20 && /[.]$/.test(entry.fix), `${info.id}: fix`);
		assert.ok(entry.example?.problem && entry.example.fixed && entry.example.problem !== entry.example.fixed, `${info.id}: example`);
		assert.equal(entry.example.language, 'json');
		assert.doesNotMatch(`${entry.summary} ${entry.rationale} ${entry.fix}`, /colour/i, info.id);
		assert.equal(explain(info.name)?.id, info.id, 'the bare name works');
		assert.match(entry.docs, /docs\/validate\.md#opf/);
		assert.equal(entry.docs.slice(entry.docs.indexOf('#')), `#${info.id.replace('/', '')}`);
	}
	assert.equal(explain('opf/nope'), undefined);
	assert.equal(explain('acme/rule'), undefined);
	assert.equal(explain(''), undefined);
	assert.equal(explain(undefined), undefined);
	assert.equal(explain('yaml/not-in-the-table'), undefined);
});

test('explain.docs is the link the rule\'s findings carry', () => {
	for (const { finding, rule } of describeAll()) if (finding.definition?.includes('docs/validate.md')) assert.equal(explain(rule).docs, finding.definition);
});

test('explain is exported from the package root', () => {
	assert.equal(typeof rootExplain, 'function');
	assert.equal(rootExplain, explain);
	assert.equal(findValidationRule('text-contrast').id, rootExplain('text-contrast').id);
});

// The examples are real: the problem triggers its rule, the repaired side does not.
const NOT_RUNNABLE = new Set([
	'opf/layout-placeholder-group', // no layout record can reach this rule since records use regions
	'opf/variable-unknown-value', // the values are a host option, not a document field
	'opf/variable-invalid-value', // same: the schema reports a bad declared value, this rule a bad supplied one
]);
const DECK_BASE = { name: 'Example', language: 'en-US' };
function runExample(rule, text) {
	if (rule === 'opf/json-syntax' || rule === 'opf/duplicate-key') return validate(text, { catalogs: [gallery] }).findings;
	const parsed = JSON.parse(text);
	const base = rule === 'opf/missing-language' ? { name: 'Example' } : DECK_BASE;
	const document = Array.isArray(parsed.slides) ? { ...base, ...parsed } : { ...base, slides: [parsed] };
	return validate(document, { catalogs: [gallery], ...(rule === 'opf/contract' ? { contracts: [{ path: '/slides/*/layout', allowedValues: ['text'] }] } : {}) }).findings;
}

test('every explain example triggers its rule on the problem side and not on the repaired side', () => {
	for (const info of validationRules) {
		if (NOT_RUNNABLE.has(info.id)) continue;
		const { example } = explain(info.id);
		const before = runExample(info.id, example.problem).filter((finding) => finding.ruleId === info.id);
		assert.ok(before.length > 0, `${info.id}: the problem example does not trigger the rule`);
		const after = runExample(info.id, example.fixed).filter((finding) => finding.ruleId === info.id);
		assert.deepEqual(after.map((finding) => finding.message), [], `${info.id}: the repaired example still triggers the rule`);
	}
});
