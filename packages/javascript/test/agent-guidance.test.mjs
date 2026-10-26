// Agent guidance in the findings: the Chart.js/ECharts chart shape gets one finding that shows the author's own values as OPF data, a made-up
// catalog id lists the nearest real ids, and every schema carries the version marker of docs/schema-versioning.md.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { schemaEntries, validate } from '../dist/index.js';
import { describeFinding } from '../dist/source.js';

const chartDeck = (chart) => ({ name: 'Decks', language: 'en-US', slides: [{ title: 'Decks', chart }] });
const schemaFindings = (report) => report.findings.filter((finding) => finding.ruleId === 'opf/schema');

test('a Chart.js chart gets one finding that converts the authors own values to data columns and rows', () => {
	const deck = chartDeck({ type: 'bar', categories: ['Q1', 'Q2', 'Q3'], series: [{ name: 'Decks', values: [3, 8, 21] }] });
	const report = validate(deck);
	const found = schemaFindings(report);
	assert.equal(found.length, 1, JSON.stringify(found.map((entry) => entry.message)));
	const [finding] = found;
	assert.equal(finding.path, '/slides/0/chart');
	assert.match(finding.message, /Chart\.js and ECharts/);
	assert.ok(finding.help.includes('"columns": ["Category","Decks"]'), finding.help);
	assert.ok(finding.help.includes('"rows": [["Q1",3],["Q2",8],["Q3",21]]'), finding.help);
	assert.ok(finding.help.includes('"data": { "columns", "rows" }'), finding.help);
	assert.ok(finding.help.includes('https://openpresentation.org/schema/opf/v1#/$defs/Chart'), finding.help);
	assert.equal(finding.validation.keyword, 'required', 'the raw schema issue stays');
	assert.equal(report.valid, false);
	// The patch repairs the deck.
	const [fix] = finding.fixes;
	assert.equal(fix.kind, 'patch');
	assert.deepEqual(fix.patch.map((operation) => `${operation.op} ${operation.path}`), ['add /slides/0/chart/data', 'remove /slides/0/chart/categories', 'remove /slides/0/chart/series']);
	const repaired = structuredClone(deck);
	repaired.slides[0].chart.data = fix.patch[0].value;
	delete repaired.slides[0].chart.categories;
	delete repaired.slides[0].chart.series;
	assert.equal(validate(repaired, { only: ['format'] }).valid, true);
});

test('the ECharts and Chart.js labels and datasets form is recognized, long data is shortened in the help, and other unknown keys stay reported', () => {
	const labels = ['A', 'B', 'C', 'D', 'E'];
	const report = validate(chartDeck({ type: 'line', labels, datasets: [{ label: 'One', data: [1, 2, 3, 4, 5] }, { label: 'Two', data: [5, 4, 3, 2, 1] }], options: {} }));
	const found = schemaFindings(report);
	const required = found.find((entry) => entry.validation.keyword === 'required');
	assert.ok(required.help.includes('"columns": ["Category","One","Two"]'), required.help);
	assert.ok(required.help.includes('["A",1,5],["B",2,4],["C",3,3],...]'), required.help);
	assert.deepEqual(
		found.filter((entry) => entry.validation.keyword === 'additionalProperties').map((entry) => entry.path),
		['/slides/0/chart/options'],
		'only the foreign keys the finding explains are collapsed',
	);
});

test('values that are not a plain list of categories and series get the generic form and no patch', () => {
	const report = validate(chartDeck({ type: 'bar', categories: ['Q1', 'Q2'], series: [{ name: 'Decks', values: [3] }] }));
	const [finding, ...rest] = schemaFindings(report);
	assert.equal(rest.length, 0);
	assert.ok(finding.help.includes('"columns": ["Category", "Series name"]'), finding.help);
	assert.equal(finding.fixes?.some((fix) => fix.id === 'convert-chart-data') ?? false, false, 'nothing is converted that cannot be converted');
});

test('a chart that has data, or no foreign key, is reported as before', () => {
	const missing = schemaFindings(validate(chartDeck({ type: 'bar' })));
	assert.equal(missing.length, 1);
	assert.equal(missing[0].message, "must have required property 'data'");
	const extra = schemaFindings(validate(chartDeck({ type: 'bar', data: { columns: ['a', 'b'], rows: [['x', 1]] }, series: [] })));
	assert.equal(extra.length, 1);
	assert.equal(extra[0].validation.keyword, 'additionalProperties');
});

test('describeFinding words the chart shape from the same text', () => {
	const deck = chartDeck({ type: 'bar', categories: ['Q1', 'Q2'], series: [{ name: 'Decks', values: [3, 8] }] });
	const [finding] = schemaFindings(validate(deck));
	const text = describeFinding(finding, { document: deck });
	assert.match(text.message, /Chart\.js and ECharts shape/);
	assert.ok(text.next.includes('"columns": ["Category","Decks"]'), text.next);
});

test('the Chart and ChartData descriptions state the shape with a one-line example', () => {
	const schema = JSON.parse(readFileSync(new URL('../../../spec/schemas/opf.schema.json', import.meta.url), 'utf8'));
	for (const name of ['Chart', 'ChartData']) {
		const description = schema.$defs[name].description;
		assert.match(description, /"columns"/, name);
		assert.match(description, /"rows"/, name);
		assert.match(description, /categories/, name);
	}
	assert.match(schema.$defs.Chart.description, /`\{ "type": "column", "data": \{ "columns": \["Quarter", "Decks"\]/);
});

const layoutDeck = (layout) => ({ name: 'Decks', language: 'en-US', slides: [{ title: 'Hello', layout, text: 'Body' }] });
const references = (report) => report.findings.filter((finding) => finding.ruleId === 'opf/unresolved-reference');

test('an unresolved layout id names the nearest layouts of the registered catalog', () => {
	const near = references(validate(layoutDeck('two-colum'), { catalogs: [gallery] }));
	assert.equal(near.length, 1);
	assert.ok(near[0].help.startsWith("Did you mean 'two-column'? "), near[0].help);
	assert.equal(near[0].severity, 'warning');
	const far = references(validate(layoutDeck('totally-made-up'), { catalogs: [gallery] }));
	assert.equal(far.length, 1);
	const named = /^The nearest layouts that exist: ('[a-z0-9-]+'(?:, '[a-z0-9-]+'){2})\. /.exec(far[0].help);
	assert.ok(named, far[0].help);
	for (const id of named[1].replaceAll("'", '').split(', ')) assert.ok(gallery.layouts[id], `${id} is a layout of the default catalog`);
});

test('without a catalog the help stays as it was, and a made-up layout never makes the deck invalid', () => {
	const report = validate(layoutDeck('two-colum'), { catalogs: [] });
	assert.equal(report.valid, true);
	const [finding] = references(report);
	assert.ok(finding.help.startsWith('Embed the layout record'), finding.help);
});

test('every schema carries the version marker', () => {
	const directory = new URL('../../../spec/schemas/', import.meta.url);
	const files = readdirSync(directory).filter((name) => name.endsWith('.schema.json'));
	assert.ok(files.length >= schemaEntries.length);
	for (const file of files) {
		const schema = JSON.parse(readFileSync(new URL(file, directory), 'utf8'));
		assert.equal(typeof schema.$comment, 'string', file);
		assert.match(schema.$comment, /pre-1\.0 line/, file);
		assert.match(schema.$comment, /any 0\.x minor release/, file);
		assert.match(schema.$comment, /version of the @openpresentation\/opf package/, file);
		assert.match(schema.$comment, /docs\/schema-versioning\.md/, file);
	}
	for (const entry of schemaEntries) assert.equal(typeof entry.schema.$comment, 'string', entry.name);
});
