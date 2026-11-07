// The corpus of finding-text-rules.test.mjs: for every `opf/*` rule, a document (or a text) that makes `validate` report it, so the plain-words text
// is checked against the findings core really emits. A rule that needs more than a cheap deck (a measurement engine, a layout record the checker
// cannot reach any more) has a hand-built finding whose message copies the emission site's sentence. Not a test: it lives below test/ so that
// scripts/run-tests.mjs (which runs test/*.mjs only) never runs it.
import { gallery } from '@openpresentation/gallery';
import { validate } from '../../dist/index.js';

const deck = (slides, extra = {}) => ({ name: 'Fixture', language: 'en-US', ...extra, slides });
// LH-14: an embedded icon set, so the icon rules run without loading a registered set.
const iconSet = { name: 'Brand', license: 'MIT', copyright: 'Copyright (c) 2026 Example', viewBox: [0, 0, 24, 24], style: 'stroke', icons: { star: 'M12 3l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L3 10l6-1z' } };
const white = { background: { type: 'solid', color: '#FFFFFF' } };
const chartData = { columns: ['Q', 'V'], rows: [['Q1', 1]] };
const roadmap = { name: 'Roadmap split', regions: [{ name: 'title' }, { direction: 'row', regions: [{ name: 'timeline', accepts: ['timeline'], max: 1 }, { name: 'notes', accepts: ['text', 'list'], flow: 'column' }] }] };
const timeline = { timeline: { events: [{ when: 'Q1', what: 'Pilot' }, { when: 'Q2', what: 'Launch' }] } };
const record = (extra = {}) => ({ name: 'Arc', duration: { min: 10, max: 20 }, beats: [{ id: 'hook', name: 'Hook', type: 'text' }, { id: 'proof', name: 'Proof', type: 'chart' }, { id: 'ask', name: 'Ask', type: 'list' }], ...extra });
const narrativeDeck = (extra = {}) => ({ name: 'D', narrative: 'arc', duration: 15, catalogs: { custom: { narratives: { arc: record() } } }, slides: [{ title: 'One', beat: 'hook' }, { title: 'Two', beat: ['proof'] }], ...extra });
const layoutDeck = (layoutRecord) => deck([{ title: 'T', text: 'x', layout: 'mine' }], { catalogs: { custom: { layouts: { mine: layoutRecord } } } });
const png = (width, height) => {
	const bytes = Buffer.alloc(33);
	Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
	bytes.writeUInt32BE(13, 8);
	bytes.write('IHDR', 12, 'ascii');
	bytes.writeUInt32BE(width, 16);
	bytes.writeUInt32BE(height, 20);
	return `data:image/png;base64,${bytes.toString('base64')}`;
};
const person = (n) => ({ blocks: [{ image: { src: `https://example.com/${n}.png`, alt: `Person ${n}` } }, { text: `Person ${n}` }], composition: { mode: 'column' } });
const withGallery = { catalogs: [gallery] };
const longItems = [
	'Enterprise renewals slipped by three weeks in the northern region after the pricing change',
	'Two of the five largest accounts asked for a phased rollout before they commit to the upgrade',
	'Support tickets about the migration tool doubled once the self-serve flow went live in May',
	'The partner channel closed fewer deals than planned because enablement started a quarter late',
	'Hiring for the platform team is behind plan, and two senior roles have been open since March',
	'Cloud spend rose faster than usage, mostly from idle staging environments left running overnight',
];
const footer = { left: { text: 'A footer that keeps going and going and going and going and going and going and going and going and going and going and going and going' }, center: { text: 'Centre' }, right: { text: '{{slide.number}}' } };

/** Real `validate` calls. `name` is unique; `rule` is the rule the case must trigger; `pick` chooses among several findings of that rule. */
export const CASES = [
	{ name: 'json-syntax', rule: 'opf/json-syntax', input: '{"slides":[}' },
	{ name: 'duplicate-key', rule: 'opf/duplicate-key', input: '{"slides":[],"name":"a","name":"b"}' },
	{ name: 'schema-type', rule: 'opf/schema', input: deck([{ title: 'T', text: ['a'], items: 'One string' }]), pick: (f) => f.validation?.keyword === 'type' },
	{ name: 'reference-id-duplicate', rule: 'opf/reference-id-duplicate', input: deck([{ title: 'T', text: [{ text: 'x', cite: 'a' }] }], { references: [{ id: 'a', text: 'A' }, { id: 'a', text: 'B' }] }) },
	{ name: 'cite-unknown-reference', rule: 'opf/cite-unknown-reference', input: deck([{ title: 'T', text: [{ text: 'x', cite: 'smth' }] }], { references: [{ id: 'smith', text: 'A' }] }) },
	{ name: 'cite-unsupported-location', rule: 'opf/cite-unsupported-location', input: deck([{ title: 'Table', blocks: [{ table: { columns: [[{ text: 'H', cite: 'a' }]], rows: [['c']] } }] }], { references: [{ id: 'a', text: 'A' }] }) },
	{ name: 'cite-unsupported-location-reference-text', rule: 'opf/cite-unsupported-location', input: deck([{ title: 'T', text: 'x' }], { references: [{ id: 'a', text: [{ text: 'dup', cite: 'a' }] }] }) },
	{ name: 'caption-unsupported-payload', rule: 'opf/caption-unsupported-payload', input: deck([{ title: 'T', blocks: [{ text: 'x', caption: 'c' }] }]) },
	{ name: 'image-option-unsupported-payload', rule: 'opf/image-option-unsupported-payload', input: deck([{ title: 'T', chart: { type: 'column', data: chartData }, fit: 'cover' }]) },
	{ name: 'shape-option-unsupported-payload', rule: 'opf/shape-option-unsupported-payload', input: deck([{ title: 'T', blocks: [{ text: 'x', fill: 'accent2' }] }]) },
	{ name: 'shape-adjust-unknown', rule: 'opf/shape-adjust-unknown', input: deck([{ title: 'T', blocks: [{ shape: 'roundRect', adjust: { adj1: 0.3 } }] }]) },
	{ name: 'shape-adjust-range', rule: 'opf/shape-adjust-range', input: deck([{ title: 'T', blocks: [{ shape: 'roundRect', adjust: { adj: 0.8 } }] }]) },
	{ name: 'shape-link-hidden', rule: 'opf/shape-link-hidden', input: deck([{ title: 'T', blocks: [{ shape: 'rect', text: 'x', link: 'https://example.com', hidden: true }] }]) },
	{ name: 'shape-anchor-missing', rule: 'opf/shape-anchor-missing', input: deck([{ title: 'T', blocks: [{ id: 'photo', text: 'x' }], shapes: [{ shape: 'ellipse', at: { block: 'phot', edge: 'top' } }] }]) },
	{ name: 'connector-end-missing', rule: 'opf/connector-end-missing', input: deck([{ title: 'T', blocks: [{ id: 'plan', text: 'a' }, { id: 'ship', text: 'b' }], shapes: [{ connector: { from: 'plan', to: 'shipping' } }] }]) },
	{ name: 'image-placement-invalid', rule: 'opf/image-placement-invalid', input: deck([{ title: 'T', blocks: [{ image: { src: 'https://e.com/a.png', alt: 'a' }, placement: { edge: 'left' } }, { image: { src: 'https://e.com/b.png', alt: 'b' }, placement: { edge: 'left' } }] }]) },
	{ name: 'image-placement-in-group', rule: 'opf/image-placement-invalid', input: deck([{ title: 'T', blocks: [{ blocks: [{ image: { src: 'https://e.com/a.png', alt: 'a' }, placement: { edge: 'left' } }, { text: 'x' }] }, { text: 'y' }] }]) },
	{ name: 'dataset-unknown', rule: 'opf/dataset-unknown', input: deck([{ title: 'T', chart: { type: 'column', data: { dataset: 'sale' } } }], { datasets: { sales: { columns: ['region', 'revenue'], rows: [['EMEA', 1]] } } }) },
	{ name: 'dataset-field-unknown', rule: 'opf/dataset-field-unknown', input: deck([{ title: 'T', table: { dataset: 'sales', fields: ['regon'] } }], { datasets: { sales: { columns: ['region', 'revenue'], rows: [['EMEA', 1]] } } }) },
	{ name: 'data-column-duplicate', rule: 'opf/data-column-duplicate', input: deck([{ title: 'T', chart: { type: 'column', data: { dataset: 'sales' } } }], { datasets: { sales: { columns: ['region', 'region'], rows: [['EMEA', 1]] } } }) },
	{ name: 'chart-mapping-unknown-column', rule: 'opf/chart-mapping-unknown-column', input: deck([{ title: 'T', chart: { type: 'column', data: { columns: ['Q', 'R', 'S'], rows: [['x', 1, 2]] }, mapping: { series: ['Profit'] } } }]) },
	{ name: 'number-format-invalid', rule: 'opf/number-format-invalid', input: deck([{ title: 'T', table: { columns: [{ name: 'a', format: '%' }], rows: [[1]] } }]) },
	{ name: 'variable-invalid-value', rule: 'opf/variable-invalid-value', input: { ...deck([{ title: '{{n}}', text: 'x' }]), variables: { n: { type: 'number', value: 1 } } }, options: { values: { n: 'abc' } } },
	{ name: 'variable-unknown-builtin', rule: 'opf/variable-unknown-builtin', input: deck([{ title: '{{deck.nmae}}', text: 'x' }]) },
	{ name: 'chart-highlight-unknown-name-series', rule: 'opf/chart-highlight-unknown-name', input: deck([{ title: 'T', chart: { type: 'column', highlight: { series: ['Foo'] }, data: { columns: ['Q', 'Rev'], rows: [['Q1', 1]] } } }]) },
	{ name: 'chart-highlight-unknown-name-category', rule: 'opf/chart-highlight-unknown-name', input: deck([{ title: 'T', chart: { type: 'column', highlight: { categories: ['Q9'] }, data: { columns: ['Q', 'Rev'], rows: [['Q1', 1]] } } }]) },
	{ name: 'variable-format', rule: 'opf/variable-format', input: { variables: { amount: { type: 'number', value: 1e308, format: '0%' } }, slides: [{ title: 'Value {{amount}}' }] } },
	{ name: 'variable-unfilled-declared', rule: 'opf/variable-unfilled', input: { ...deck([{ title: 'T', text: 'Hello {{who}}' }]), variables: { who: { type: 'text', label: 'Who' } } } },
	{ name: 'variable-unfilled-template', rule: 'opf/variable-unfilled', input: { ...deck([{ title: 'T', text: 'Hello {{who}}' }]), template: true, variables: { who: { type: 'text', label: 'Who' } } } },
	{ name: 'variable-unfilled-token', rule: 'opf/variable-unfilled', input: deck([{ title: 'Hello {{name}}', text: 'x' }]) },
	{ name: 'run-color-unrecognized', rule: 'opf/run-color-unrecognized', input: deck([{ title: 'T', text: [{ text: 'x', color: 'accnt1' }] }]) },
	{ name: 'numbering-start-ignored', rule: 'opf/numbering-start-ignored', input: deck([{ title: 'T', items: [{ text: 'a', start: 2 }] }]) },
	{ name: 'slide-size-out-of-range', rule: 'opf/slide-size-out-of-range', input: deck([{ title: 'T', text: 'x' }], { design: { dimensions: { widthInches: 0.5, heightInches: 60 } } }) },
	{ name: 'undeclared-catalog', rule: 'opf/undeclared-catalog', input: deck([{ title: 'T', layout: 'acme:hero' }]) },
	{ name: 'asset-reference', rule: 'opf/asset-reference', input: deck([{ title: 'T', image: 'asset:lgog' }], { assets: { logo: 'https://e.com/a.png' } }) },
	{ name: 'asset-cycle', rule: 'opf/asset-cycle', input: deck([{ title: 'T', image: 'asset:a' }], { assets: { a: 'asset:b', b: 'asset:a' } }) },
	{ name: 'catalog-record', rule: 'opf/catalog-record', input: deck([{ title: 'T', text: 'x' }], { catalogs: { custom: { themes: { custom: { name: 'C', background: 'light1' } } } } }) },
	{ name: 'layout-template', rule: 'opf/layout-template', input: layoutDeck({ name: 'M', direction: 'row', regions: [{ name: 'title' }, { name: 'a', accepts: ['text'], size: 'auto' }, { name: 'b', accepts: ['text'] }] }) },
	{ name: 'layout-region-reserved', rule: 'opf/layout-region', input: layoutDeck({ name: 'M', regions: [{ name: 'title' }, { name: 'left', accepts: ['text'] }] }) },
	{ name: 'layout-region-twice', rule: 'opf/layout-region', input: layoutDeck({ name: 'M', regions: [{ name: 'title' }, { name: 'a', accepts: ['text'] }, { name: 'a', accepts: ['list'] }] }) },
	{ name: 'unresolved-reference-layout', rule: 'opf/unresolved-reference', input: deck([{ title: 'T', layout: 'pilars' }]), options: withGallery },
	{ name: 'unresolved-reference-theme', rule: 'opf/unresolved-reference', input: deck([{ title: 'T', text: 'x' }], { design: { theme: 'minimall' } }), options: withGallery },
	{ name: 'catalog-record-not-in-source', rule: 'opf/catalog-record-not-in-source', input: deck([{ title: 'T', layout: 'my-special' }], { catalogs: { default: { source: gallery.source, layouts: { 'my-special': { name: 'Mine', regions: [{ name: 'title' }] } } } } }), options: withGallery },
	{ name: 'unused-reference', rule: 'opf/unused-reference', input: deck([{ title: 'T', text: 'x' }], { references: [{ id: 'a', text: 'A' }] }) },
	{ name: 'unused-dataset', rule: 'opf/unused-dataset', input: deck([{ title: 'T', text: 'x' }], { datasets: { sales: { columns: ['a'], rows: [[1]] } } }) },
	{ name: 'unknown-beat', rule: 'opf/unknown-beat', input: deck([{ title: 'T', beat: 'zzz' }], { narrative: 'classic-story' }), options: withGallery },
	{ name: 'slide-theme-dimensions', rule: 'opf/slide-theme-dimensions', input: deck([{ title: 'T', text: 'x', design: { theme: 'wide-a4' } }], { design: { theme: 'minimal' }, catalogs: { custom: { themes: { 'wide-a4': { name: 'A4', dimensions: 'a4' } } } } }), options: withGallery },
	{ name: 'variable-unknown', rule: 'opf/variable-unknown', input: { ...deck([{ title: '{{nmae}}', text: 'x' }]), variables: { name: { type: 'text', value: 'A' } } } },
	{ name: 'variable-unknown-value', rule: 'opf/variable-unknown-value', input: { ...deck([{ title: '{{name}}', text: 'x' }]), variables: { name: { type: 'text', value: 'A' } } }, options: { values: { nope: 1 } } },
	{ name: 'variable-unused', rule: 'opf/variable-unused', input: { ...deck([{ title: 'T', text: 'x' }]), variables: { name: { type: 'text', value: 'A' } } } },
	{ name: 'variable-reference-unknown', rule: 'opf/variable-reference-unknown', input: deck([{ title: 'T', text: [{ text: 'x', color: 'var:brand' }] }]) },
	{ name: 'contract', rule: 'opf/contract', input: deck([{ layout: 'cover', title: 'K' }]), options: { contracts: [{ path: '/slides/*/layout', allowedValues: ['text', 'title'] }], ...withGallery } },
	{ name: 'contract-host-message', rule: 'opf/contract', input: deck([{ layout: 'cover', title: 'K' }]), options: { contracts: [{ path: '/slides/*/layout', allowedValues: ['text'], message: 'Brand rules allow only {{allowed}} here.' }], ...withGallery } },
	{ name: 'text-contrast', rule: 'opf/text-contrast', input: deck([{ title: 'T', text: ['Readable and ', { text: 'faint', color: '#CCCCCC' }] }], { design: white }) },
	{ name: 'text-contrast-default', rule: 'opf/text-contrast', input: deck([{ title: 'Gradient', text: 'Body' }], { design: { background: { type: 'gradient', gradient: { angle: 0, stops: [{ color: '#000000', position: 0 }, { color: '#10103A', position: 1 }] } } } }) },
	{ name: 'text-on-image', rule: 'opf/text-on-image', input: deck([{ title: 'On a picture', design: { background: { type: 'image', src: 'https://example.com/hero.jpg' } } }], { design: white }) },
	{ name: 'missing-alt-text', rule: 'opf/missing-alt-text', input: deck([{ title: 'A', image: 'https://example.com/a.png' }]) },
	{ name: 'poor-alt-text', rule: 'opf/poor-alt-text', input: deck([{ title: 'A', image: { src: 'https://example.com/a.png', alt: 'IMG_2041.png' } }]) },
	{ name: 'poor-alt-text-chart', rule: 'opf/poor-alt-text', input: deck([{ title: 'Revenue', chart: { type: 'column', alt: 'bar chart', data: chartData } }]) },
	{ name: 'missing-slide-title', rule: 'opf/missing-slide-title', input: deck([{ title: 'Has one', text: 'x' }, { id: 'intro', text: 'No title' }]) },
	{ name: 'duplicate-slide-title', rule: 'opf/duplicate-slide-title', input: deck([{ title: 'Results', text: 'a' }, { title: 'Other', text: 'b' }, { title: ' results ', text: 'c' }]) },
	{ name: 'link-text', rule: 'opf/link-text', input: deck([{ title: 'T', text: ['See ', { text: 'click here', link: 'https://example.com/report' }] }]) },
	{ name: 'chart-color-only', rule: 'opf/chart-color-only', input: deck([{ title: 'T', chart: { type: 'line', data: { columns: ['Quarter', ...Array.from({ length: 14 }, (_, i) => `S${i + 1}`)], rows: [['Q1', ...Array.from({ length: 14 }, (_, i) => i + 1)]] } } }], { design: white }) },
	{ name: 'chart-colors-adjusted', rule: 'opf/chart-colors-adjusted', input: deck([{ title: 'T', chart: { type: 'column', data: chartData, colors: ['var:missing', '#7B241C'] } }]), pick: (f) => /resolved/.test(f.message) },
	{ name: 'chart-colors-adjusted-contrast', rule: 'opf/chart-colors-adjusted', input: deck([{ title: 'T', chart: { type: 'column', data: chartData, colors: ['var:missing', '#7B241C'] } }]), pick: (f) => /contrast/.test(f.message) },
	{ name: 'chart-text-alternative', rule: 'opf/chart-text-alternative', input: deck([{ title: 'Revenue', chart: { type: 'column', data: chartData } }]) },
	{ name: 'chart-text-alternative-decorative', rule: 'opf/chart-text-alternative', input: deck([{ title: 'Revenue', text: 'x', chart: { type: 'column', alt: '', data: chartData } }]) },
	{ name: 'missing-language', rule: 'opf/missing-language', input: { name: 'x', slides: [{ title: 'T', text: 'x' }] } },
	{ name: 'chart-option-adapted', rule: 'opf/chart-option-adapted', input: deck([{ title: 'Pie', chart: { type: 'pie', data: chartData, axisTitles: { value: 'Revenue' }, dataLabels: { position: 'above' } } }]), pick: (f) => f.path.endsWith('dataLabels/position') },
	{ name: 'text-overflow', rule: 'opf/text-overflow', input: deck([{ title: 'T', composition: { minFontSize: 16 }, blocks: [{ text: 'word '.repeat(600) }, { text: 'b', emphasis: false }] }]) },
	{ name: 'unresolved-content', rule: 'opf/unresolved-content', input: deck([{ title: 'T', items: ['a', 'b'] }], { design: { listBullet: 'image' } }) },
	{ name: 'layout-failed', rule: 'opf/layout-failed', input: deck([{ title: 'T', layout: 'broken', text: 'x' }]), options: { catalogs: [{ source: 'pkg:@host/layouts', layouts: { broken: { name: 'Broken', regions: [{ name: 'title', size: 1 }], composition: { padding: 5 } } } }] } },
	{ name: 'min-font-size-run', rule: 'opf/min-font-size', input: deck([{ title: 'T', text: [{ text: 'tiny', fontSize: 8 }, ' ok'] }]) },
	{ name: 'min-font-size-composed', rule: 'opf/min-font-size', input: deck([{ title: 'T', composition: { minFontSize: 8 }, blocks: [{ text: 'word '.repeat(1000) }, { text: 'b' }] }]) },
	{ name: 'region-unknown', rule: 'opf/region-unknown', input: deck([{ layout: 'r', blocks: [{ region: 'timelin', ...timeline }] }], { catalogs: { custom: { layouts: { r: roadmap } } } }) },
	{ name: 'region-kind', rule: 'opf/region-kind', input: deck([{ layout: 'r', blocks: [{ region: 'timeline', text: 'b' }] }], { catalogs: { custom: { layouts: { r: roadmap } } } }) },
	{ name: 'icon-unknown', rule: 'opf/icon-unknown', input: deck([{ title: 'T', items: [{ text: 'a', icon: 'brand:stra' }] }], { catalogs: { custom: { iconSets: { brand: iconSet } } } }) },
	{ name: 'icon-invalid', rule: 'opf/icon-invalid', input: deck([{ title: 'T', items: [{ text: 'a', icon: 'mark' }] }], { icons: { mark: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><script>alert(1)</script></svg>' } }) },
	{ name: 'icon-dropped', rule: 'opf/icon-dropped', input: deck([{ title: 'T', items: [{ text: 'a', icon: 'brand:star' }, { text: 'b' }], numbering: 'arabic' }], { catalogs: { custom: { iconSets: { brand: iconSet } } } }) },
	{ name: 'arrangement-adapted', rule: 'opf/arrangement-adapted', input: deck([{ layout: 'quad', title: 'T', items: ['North', 'South', 'East'] }], { catalogs: { custom: { layouts: { quad: { name: 'Quad', regions: [{ name: 'title' }, { name: 'quadrants', accepts: ['list'], flow: 'none', arrangement: 'matrix' }] } } } } }) },
	{ name: 'region-full', rule: 'opf/region-full', input: deck([{ layout: 'r', blocks: [{ region: 'timeline', ...timeline }, { region: 'timeline', ...timeline }] }], { catalogs: { custom: { layouts: { r: roadmap } } } }) },
	{ name: 'layout-unplaced', rule: 'opf/layout-unplaced', input: deck([{ layout: 'r', blocks: [{ region: 'timeline', ...timeline }, { region: 'timeline', ...timeline }] }], { catalogs: { custom: { layouts: { r: roadmap } } } }) },
	{ name: 'reading-order', rule: 'opf/reading-order', input: deck([{ title: 'Team', composition: { mode: 'row' }, blocks: [person(1), person(2)] }]) },
	{ name: 'furniture-wraps', rule: 'opf/furniture-wraps', input: { language: 'en-US', design: { footer }, slides: [{ title: 'Results', text: 'Revenue grew.' }] } },
	{ name: 'font-outside-scheme', rule: 'opf/font-outside-scheme', input: deck([{ title: 'T', text: [{ text: 'x', fontFamily: 'Comic Sans MS' }] }], { design: { fontScheme: 'aptos' } }) },
	{ name: 'image-resolution', rule: 'opf/image-resolution', input: deck([{ title: 'T', image: { src: png(100, 100), alt: 'x' } }]) },
	{ name: 'chart-value-not-numeric', rule: 'opf/chart-value-not-numeric', input: deck([{ title: 'T', chart: { type: 'column', data: { columns: ['Q', 'V'], rows: [['Q1', 'about 12']] } } }]) },
	{ name: 'chart-mapping-adapted', rule: 'opf/chart-mapping-adapted', input: deck([{ title: 'T', chart: { type: 'column', data: { columns: ['Quarter', 'Revenue', 'Costs'], rows: [['Q1', 1, 2]] }, mapping: { category: 'Quarter', x: 'Costs', series: ['Quarter', 'Revenue'] } } }]) },
	{ name: 'chart-series-dropped', rule: 'opf/chart-series-dropped', input: deck([{ title: 'T', chart: { type: 'treemap', data: { columns: ['Quarter', 'Revenue', 'Costs'], rows: [['Q1', 1, 2]] } } }]) },
	{ name: 'table-highlight-unknown-name', rule: 'opf/table-highlight-unknown-name', input: deck([{ title: 'T', table: { columns: ['Region', 'Change'], rows: [['Northeast', 'Hold'], ['Southeast', '+3%']], highlight: { rows: ['South'] } } }]) },
	{ name: 'chart-highlight-adapted', rule: 'opf/chart-highlight-adapted', input: deck([{ title: 'T', chart: { type: 'column', data: { columns: ['Quarter', 'Revenue', 'Costs'], rows: [['Q1', 1, 2]] }, highlight: { series: ['Quarter'] }, mapping: { series: ['Revenue'] } } }]) },
	{ name: 'code-highlight-out-of-range', rule: 'opf/code-highlight-out-of-range', input: deck([{ title: 'Code', code: { source: 'a\nb\nc', highlight: [2, 7, [3, 1]] } }]) },
	{ name: 'code-highlight-range-reversed', rule: 'opf/code-highlight-range-reversed', input: deck([{ title: 'Code', code: { source: 'a\nb\nc', highlight: [2, 7, [3, 1]] } }]) },
	{ name: 'variable-builtin-missing', rule: 'opf/variable-builtin-missing', input: deck([{ title: '{{speaker.name}}', text: 'x' }]) },
	{ name: 'duration-outside-narrative', rule: 'opf/duration-outside-narrative', input: narrativeDeck({ duration: 5 }) },
	{ name: 'narrative-duration-range', rule: 'opf/narrative-duration-range', input: narrativeDeck({ catalogs: { custom: { narratives: { arc: record({ duration: { min: 30, max: 10 } }) } } } }) },
	{ name: 'placeholder-text', rule: 'opf/placeholder-text', input: deck([{ title: 'T', text: 'Lorem ipsum dolor sit amet' }]) },
	{ name: 'empty-text', rule: 'opf/empty-text', input: deck([{ title: 'T', items: ['ok', ''] }]) },
	{ name: 'unused-beat', rule: 'opf/unused-beat', input: narrativeDeck({ slides: [{ title: 'One', beat: 'hook' }, { title: 'Two', beat: 'proof' }] }) },
	{ name: 'empty-slide', rule: 'opf/empty-slide', input: deck([{ title: 'T', text: 'x' }, { id: 'blank-one' }]) },
	{ name: 'language-tag', rule: 'opf/language-tag', input: deck([{ title: 'T', text: 'x' }], { language: { bcp47: 'fr-UK' } }) },
	{ name: 'text-shrunk', rule: 'opf/text-shrunk', input: deck([{ title: 'Findings', blocks: [{ items: longItems }, { items: longItems }, { items: longItems }] }]) },
	{ name: 'centered-body', rule: 'opf/centered-body', input: deck([{ title: 'Why now', items: longItems.slice(0, 3), design: { contentAlignment: 'center' } }]) },
	{ name: 'tight-spacing-gap', rule: 'opf/tight-spacing', input: deck([{ title: 'Two options', composition: { gap: 0.01 }, blocks: [{ text: 'Build it in house.' }, { text: 'Buy a hosted service.' }] }]) },
	{ name: 'tight-spacing-margin', rule: 'opf/tight-spacing', input: deck([{ title: 'Two options', composition: { padding: 0.02 }, blocks: [{ text: 'Build it in house.' }, { text: 'Buy a hosted service.' }] }]) },
	{ name: 'layout-monotony', rule: 'opf/layout-monotony', input: deck(['Hiring', 'Budget', 'Roadmap', 'Risks', 'Asks'].map((title) => ({ title, layout: 'list', items: ['One point', 'Another point'] }))), options: withGallery },
	{ name: 'chart-dual-axis', rule: 'opf/chart-dual-axis', input: deck([{ title: 'Revenue and margin', chart: { type: 'combo', alt: 'Revenue and margin', data: { columns: ['Quarter', 'Revenue', 'Margin'], rows: [['Q1', 12, 0.31], ['Q2', 15, 0.34]] }, line: ['Margin'], secondaryAxis: ['Margin'] } }]) },
	{ name: 'chart-pie-many-slices', rule: 'opf/chart-pie-many-slices', input: deck([{ title: 'Traffic sources', chart: { type: 'pie', alt: 'Traffic sources', data: { columns: ['Source', 'Visits'], rows: [['Search', 48], ['Direct', 22], ['Social', 12], ['Email', 8], ['Referral', 5], ['Ads', 3]] } } }]) },
	{ name: 'straight-quotes', rule: 'opf/straight-quotes', input: deck([{ title: 'What customers said', text: 'They called it "the easiest setup we’ve done".' }]) },
];

const finding = (ruleId, severity, category, path, message, extra = {}) => ({ ruleId, severity, category, scope: 'document', path, message, ...extra });

/**
 * Findings that `validate` cannot produce cheaply: `opf/layout-placeholder-group` (no layout record can reach it since v2 records), and the two
 * `opf/reading-order` sentences (they need a composed slide whose title is not first). Each message is copied from the emission site
 * (rules-accessibility.ts, validation-rules.ts).
 */
export const HAND_BUILT = [
	{
		name: 'layout-placeholder-group',
		finding: finding('opf/layout-placeholder-group', 'error', 'format', '/catalogs/custom/layouts/mine/placeholders/0', 'a placeholder group nests at most 3 levels'),
		document: deck([{ title: 'T', text: 'x' }]),
	},
	{
		name: 'reading-order-above-title',
		finding: finding('opf/reading-order', 'warning', 'accessibility', '/slides/0/text', 'Content "text" is drawn above the title but is read after it.', { slide: 0 }),
		document: deck([{ title: 'T', text: 'x' }]),
	},
	{
		name: 'reading-order-differs',
		finding: finding('opf/reading-order', 'warning', 'accessibility', '/slides/1/blocks/0', 'Reading order differs from visual order: "blocks.0" is read at position 1 but appears at position 2. Composed order: blocks.0, blocks.1; visual order: blocks.1, blocks.0.', { slide: 1, measured: { firstMismatch: 0, composed: 2 } }),
		document: deck([{ title: 'A', text: 'a' }, { title: 'B', blocks: [{ text: 'x' }, { text: 'y' }] }]),
	},
	{
		name: 'schema-without-keyword',
		finding: finding('opf/schema', 'error', 'format', '/slides/0', 'must NOT be valid', { help: 'Inspect this schema constraint and preserve unrelated content.' }),
		document: deck([{ title: 'T', text: 'x' }]),
	},
];

/** The findings of a corpus case: `validate` at the case's options, the rule's findings, narrowed by `pick`. */
export function casesFindings(testCase) {
	const report = validate(testCase.input, testCase.options ?? {});
	return report.findings.filter((entry) => entry.ruleId === testCase.rule && (testCase.pick ? testCase.pick(entry) : true));
}

/** The document a case's findings are read against (a text input is parsed by `JSON.parse` when it can be). */
export function documentOf(testCase) {
	if (typeof testCase.input !== 'string') return testCase.input;
	try {
		return JSON.parse(testCase.input);
	} catch {
		return undefined;
	}
}
