// LH-19 and LH-31: the info findings that read the composed geometry and the slide sequence (opf/text-shrunk, opf/centered-body,
// opf/tight-spacing, opf/layout-monotony, opf/straight-quotes). Each rule fires on its fixture, stays quiet on the default layouts at
// their intended counts, and keeps its false-positive guards.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { validate } from '../dist/index.js';

const deck = (slides, extra = {}) => ({ name: 'Layout findings', language: 'en-US', ...extra, slides });
const findings = (document, rule, options = {}) => validate(document, { catalogs: [gallery], ...options, only: [rule] }).findings;
const LONG = [
	'Enterprise renewals slipped by three weeks in the northern region after the pricing change',
	'Two of the five largest accounts asked for a phased rollout before they commit to the upgrade',
	'Support tickets about the migration tool doubled once the self-serve flow went live in May',
	'The partner channel closed fewer deals than planned because enablement started a quarter late',
	'Hiring for the platform team is behind plan, and two senior roles have been open since March',
	'Cloud spend rose faster than usage, mostly from idle staging environments left running overnight',
];

test('opf/text-shrunk: one finding per slide at the block shrunk the most, with the role size and the ratio', () => {
	const [finding, ...rest] = findings(deck([{ title: 'Findings', blocks: [{ items: LONG }, { items: LONG }, { items: LONG }] }]), 'opf/text-shrunk');
	assert.equal(rest.length, 0);
	assert.equal(finding.severity, 'info');
	assert.equal(finding.category, 'layout');
	assert.equal(finding.measured.rolePx, 32);
	assert.ok(finding.measured.ratio < 0.7);
	assert.equal(finding.measured.blocks, 3);
	assert.match(finding.help, /opf paginate/);
	// The same content split over two slides is drawn near its role size.
	assert.deepEqual(findings(deck([{ title: 'Findings', items: LONG.slice(0, 3) }, { title: 'More', items: LONG.slice(3) }]), 'opf/text-shrunk'), []);
	// A size the author set on a run is a choice, not a shrink; text that overflows is opf/text-overflow's.
	assert.deepEqual(findings(deck([{ title: 'Findings', blocks: [0, 1, 2].map(() => ({ items: LONG.map((text) => [{ text, fontSize: 14 }]) })) }]), 'opf/text-shrunk'), []);
	assert.deepEqual(findings(deck([{ title: 'Wall', text: 'word '.repeat(1200) }]), 'opf/text-shrunk'), []);
});

test('opf/centered-body: long centred paragraphs and lists; titles, statements, metrics and short notes are exempt', () => {
	const centred = { contentAlignment: 'center' };
	const [list] = findings(deck([{ title: 'Why now', items: LONG.slice(0, 3), design: centred }]), 'opf/centered-body');
	assert.equal(list.path, '/slides/0/items');
	assert.ok(list.measured.lines > 2);
	// Two short lines are fine; a left-aligned list is fine.
	assert.deepEqual(findings(deck([{ title: 'Why now', items: ['Faster', 'Cheaper'], design: centred }]), 'opf/centered-body'), []);
	assert.deepEqual(findings(deck([{ title: 'Why now', items: LONG.slice(0, 3) }]), 'opf/centered-body'), []);
	// A lone statement may run three lines, and the statement layout centres it on purpose.
	const statement = 'We grew in every region this year, but the growth came from a handful of large accounts, and next year we need a broader base.';
	assert.deepEqual(findings(deck([{ title: 'The point', layout: 'statement', text: statement }]), 'opf/centered-body'), []);
	assert.deepEqual(findings(deck([{ title: 'Thank you', layout: 'closing', text: `${statement} ${statement}` }]), 'opf/centered-body'), []);
	// Several centred paragraphs side by side are one finding at the longest, which counts the rest.
	const [several] = findings(deck([{ title: 'Three views', design: centred, blocks: [{ text: statement }, { text: statement }, { text: `${statement} ${statement}` }] }]), 'opf/centered-body');
	assert.equal(several.path, '/slides/0/blocks/2/text');
	assert.equal(several.measured.blocks, 3);
	// Metrics centre by design and are never checked.
	assert.deepEqual(findings(deck([{ title: 'Numbers', layout: 'metrics', blocks: [{ metric: { value: '31%', label: 'Conversion', description: 'Up from 24% after the new onboarding flow shipped in May' } }] }]), 'opf/centered-body'), []);
});

test('opf/tight-spacing: gaps under 0.25 in and margins under 0.5 in; the default gap, padding and placed pictures are fine', () => {
	const two = [{ text: 'Build the platform in house.' }, { text: 'Buy a hosted service.' }];
	assert.deepEqual(findings(deck([{ title: 'Options', blocks: two }]), 'opf/tight-spacing'), []);
	const [gap] = findings(deck([{ title: 'Options', composition: { gap: 0.01 }, blocks: two }]), 'opf/tight-spacing');
	assert.equal(gap.measured.minimumGapInches, 0.25);
	assert.ok(gap.measured.gapInches < 0.25);
	const [margin] = findings(deck([{ title: 'Options', composition: { padding: 0.02 }, blocks: two }]), 'opf/tight-spacing');
	assert.equal(margin.measured.minimumMarginInches, 0.5);
	// A nested group with no gap of its own uses the engine's default (1/30 of its shorter side: about 0.03 in in a one-line row), which
	// is the engine's spacing, not the author's, so it is not reported; the same group with an explicit small gap is.
	for (const mode of ['row', 'column']) {
		const nested = (composition) => deck([{ title: 'A group', blocks: [{ text: 'Lead text before the group' }, { composition, blocks: [{ text: 'Left in the group' }, { text: 'Right in the group' }] }] }]);
		assert.deepEqual(findings(nested({ mode }), 'opf/tight-spacing'), [], `default ${mode} group`);
		const [tight] = findings(nested({ mode, gap: 0.01 }), 'opf/tight-spacing');
		assert.equal(tight?.path, '/slides/0/blocks/1/blocks/1', `${mode} group with gap 0.01`);
	}
	// A picture placed on an edge bleeds on purpose.
	const placed = deck([{ title: 'Site', blocks: [{ image: { src: 'https://example.com/site.png', alt: 'The site' }, placement: { edge: 'left' } }, { text: 'The new site opens in May.' }] }]);
	assert.deepEqual(findings(placed, 'opf/tight-spacing'), []);
	// The default layouts at their intended counts.
	const sampler = JSON.parse(readFileSync(new URL('../../../examples/technical/layout-sampler.opf.json', import.meta.url), 'utf8'));
	assert.deepEqual(findings(sampler, 'opf/tight-spacing'), [], 'the sampler (every layout record and its dynamic compositions) reports tight spacing');
});

test('opf/layout-monotony: four content slides in a row with one layout; framing slides, automatic slides and other layouts break a run', () => {
	const list = (title) => ({ title, layout: 'list', items: ['One point', 'Another point'] });
	const [run] = findings(deck([{ title: 'Deck', layout: 'cover' }, list('A'), list('B'), list('C'), list('D')]), 'opf/layout-monotony');
	assert.equal(run.path, '/slides/1/layout');
	assert.deepEqual([run.measured.first, run.measured.last, run.measured.slides], [2, 5, 4]);
	assert.equal(findings(deck([list('A'), list('B'), list('C')]), 'opf/layout-monotony').length, 0);
	assert.equal(findings(deck([list('A'), list('B'), { title: 'Part two', layout: 'section' }, list('C'), list('D')]), 'opf/layout-monotony').length, 0);
	assert.equal(findings(deck([list('A'), list('B'), { title: 'Auto', items: ['x'] }, list('C'), list('D')]), 'opf/layout-monotony').length, 0);
	// A catalog prefix names the same record; a hidden slide is skipped.
	assert.equal(findings(deck([list('A'), { ...list('B'), layout: 'default:list' }, { ...list('H'), layout: 'text', hidden: true }, list('C'), list('D')]), 'opf/layout-monotony').length, 1);
	// Two runs are two findings.
	assert.equal(findings(deck([...['A', 'B', 'C', 'D'].map(list), { title: 'Chart', layout: 'text', text: 'x' }, ...['E', 'F', 'G', 'H'].map(list)]), 'opf/layout-monotony').length, 2);
});

test('opf/straight-quotes: quotation marks, not apostrophes, inch and foot marks, code or data', () => {
	const quotes = (text, extra) => findings(deck([{ title: 'T', text }], extra), 'opf/straight-quotes');
	const [double] = quotes('They called it "the easiest setup" in the survey.');
	assert.equal(double.measured.double, 2);
	assert.deepEqual(double.fixes[0].patch, [{ op: 'replace', path: '/slides/0/text', value: 'They called it “the easiest setup” in the survey.' }]);
	assert.equal(quotes("The board said 'ship it' on Friday.")[0].measured.single, 2);
	assert.equal(quotes("The board said 'ship it' on Friday.")[0].fixes, undefined);
	for (const fine of ["We don't ship on Fridays.", "O'Brien's team", 'A 27" monitor and a 6\' 2" desk', "Revenue since the '90s", "The students' results improved.", 'Already “typographic” and ‘fine’.'])
		assert.deepEqual(quotes(fine), [], fine);
	// Code runs, code blocks and table cells are not prose.
	assert.deepEqual(findings(deck([{ title: 'T', text: ['Set ', { text: 'name="x"', code: true }, ' in the file.'] }]), 'opf/straight-quotes'), []);
	assert.deepEqual(findings(deck([{ title: 'T', code: 'print("hello")' }]), 'opf/straight-quotes'), []);
	assert.deepEqual(findings(deck([{ title: 'T', table: { columns: ['Key', 'Value'], rows: [['name', '"x"']] } }]), 'opf/straight-quotes'), []);
	// A run in a run array is patched at its own text; the marks follow the deck language.
	const [german] = findings(deck([{ title: 'T', text: ['Sie sagten ', { text: '"schnell"', bold: true }] }], { language: 'de-DE' }), 'opf/straight-quotes');
	assert.deepEqual(german.fixes[0].patch, [{ op: 'replace', path: '/slides/0/text/1/text', value: '„schnell“' }]);
	// The title and list items are prose too.
	assert.equal(findings(deck([{ title: 'The "best" plan', items: ['A "fast" start'] }]), 'opf/straight-quotes').length, 2);
});

test('the layout findings are info and never make an example deck invalid', () => {
	const sampler = JSON.parse(readFileSync(new URL('../../../examples/technical/layout-sampler.opf.json', import.meta.url), 'utf8'));
	const report = validate(sampler, { catalogs: [gallery], only: ['text-shrunk', 'centered-body', 'tight-spacing', 'layout-monotony', 'straight-quotes'] });
	assert.equal(report.valid, true);
	for (const finding of report.findings) assert.equal(finding.severity, 'info');
});
