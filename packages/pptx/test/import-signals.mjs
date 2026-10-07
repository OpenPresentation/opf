import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {rebuildContent} from '../dist/content-topology.js';
import PptxGenJS from '../vendor/pptxgenjs/pptxgen.es.js';
import {buildThirdPartyDeck} from './signals-deck.mjs';
const {fromPptx, toPptx, DEFAULT_SIGNAL_LIMITS, SIGNALS_VERSION, isMonospaceFamily, runtimePolicy} = await import(process.env.OPF_TEST_PPTX_MODULE ?? '../dist/index.js');

const diagnostics = [];
const importWith = async (bytes, options = {}) => fromPptx(bytes, {signals: true, onDiagnostic: item => diagnostics.push(item), ...options});
const byName = (slide, name) => slide.shapes.find(shape => shape.name === name);
const at = (document, path) => path.split('.').reduce((value, key) => value?.[key], document);
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 0.011, `${message}: ${actual} vs ${expected}`);
let cases = 0;
const check = async (name, run) => { cases += 1; try { await run(); } catch (error) { error.message = `${name}: ${error.message}`; throw error; } };

// ---------------------------------------------------------------------------
// A real-world-style deck without any OPF tags.

const deck = buildThirdPartyDeck();
const deckCopy = new Uint8Array(deck);
const imported = await importWith(deck);
const {presentation: document, signals} = imported;
assert.deepEqual(deck, deckCopy, 'The source bytes stay intact');

await check('default import output is unchanged', async () => {
  const plain = await fromPptx(deck);
  assert.deepEqual(plain, document, 'signals: true returns the same document');
  assert.equal(JSON.stringify(plain), JSON.stringify(document));
  assert.equal(Object.hasOwn(plain, 'signals'), false);
  for (const off of [undefined, false, null]) assert.deepEqual(await fromPptx(deck, {signals: off}), plain);
  // The same holds for a tagged export and for a generator deck.
  const exported = await toPptx({slides: [{title: 'T', blocks: [{type: 'group', blocks: [{type: 'text', text: 'A'}, {type: 'list', items: ['x', 'y']}]}]}]});
  assert.deepEqual((await fromPptx(exported, {signals: true})).presentation, await fromPptx(exported));
});

await check('the signals value is deterministic JSON', async () => {
  const again = (await importWith(deck)).signals;
  assert.equal(JSON.stringify(again), JSON.stringify(signals));
  assert.deepEqual(JSON.parse(JSON.stringify(signals)), signals, 'plain JSON: nothing is lost by a round trip');
  assert.equal(signals.version, SIGNALS_VERSION);
  assert.deepEqual(signals.limits, {...DEFAULT_SIGNAL_LIMITS});
  assert.equal(signals.slides.length, 4);
  assert.equal(JSON.stringify(signals).includes('base64'), false, 'no image bytes are embedded');
  assert.equal(JSON.stringify(signals).includes('undefined'), false);
  assert.ok(JSON.stringify(signals).length < 30000, `bounded: ${JSON.stringify(signals).length}`);
  for (const slide of signals.slides) for (const shape of slide.shapes) assert.equal(shape.unreadable, undefined, `${slide.index}/${shape.id}`);
});

await check('deck facts: dimensions, theme, provenance', async () => {
  assert.deepEqual(signals.deck.dimensions, {widthEmu: 12192000, heightEmu: 6858000, widthPx: 1280, heightPx: 720});
  assert.equal(signals.deck.referencePxPerInch, 96);
  assert.equal(signals.deck.slideCount, 4);
  assert.equal(signals.deck.theme.majorFont, 'Segoe UI Semibold');
  assert.equal(signals.deck.theme.minorFont, 'Segoe UI');
  assert.equal(signals.deck.theme.colorSchemeName, 'Contoso');
  assert.equal(signals.deck.theme.colors.accent1, '#2563EB');
  assert.deepEqual(signals.deck.provenance, {opfTaggedSlides: 0, opf: false});
  assert.deepEqual(signals.slides.map(slide => slide.provenance), ['untagged', 'untagged', 'untagged', 'untagged']);
});

await check('slide, layout and master names', async () => {
  assert.deepEqual(signals.slides.map(slide => slide.layout.name), ['Title Slide', 'Title and Content', 'Blank', 'Blank']);
  assert.deepEqual(signals.slides.map(slide => slide.layout.type), ['title', 'obj', 'blank', 'blank']);
  assert.equal(signals.slides[1].layout.part, 'ppt/slideLayouts/slideLayout2.xml');
  assert.equal(signals.slides[1].master.part, 'ppt/slideMasters/slideMaster1.xml');
  assert.equal(signals.slides[1].master.theme, 'Contoso Review');
  assert.equal(signals.slides[1].part, 'ppt/slides/slide2.xml');
});

await check('placeholders inherit box, type and text style from layout and master', async () => {
  const [title, subtitle] = signals.slides[0].shapes;
  assert.deepEqual(title.placeholder, {type: 'ctrTitle'});
  assert.deepEqual(subtitle.placeholder, {type: 'subTitle', idx: 1});
  // No own xfrm: the layout's, in reference px and EMU.
  assert.equal(title.box.source, 'layout');
  assert.deepEqual(title.box.px, {x: 134.4, y: 182.4, w: 1008, h: 172.8});
  assert.deepEqual(title.box.emu, {x: 1280160, y: 1737360, w: 9601200, h: 1645920});
  const run = title.text.paragraphs[0].runs[0];
  assert.equal(run.size, 54, 'layout list style');
  assert.equal(run.font, 'Segoe UI Semibold', 'master titleStyle +mj-lt resolved through the theme');
  assert.equal(run.weight, 600, 'the family names its own weight');
  assert.equal(run.bold, undefined, 'defaults are omitted');
  assert.equal(run.italic, undefined);
  assert.equal(run.monospace, undefined);
  assert.equal(run.color, '#111827');
  assert.equal(run.colorRef, 'tx1');
  assert.equal(title.text.paragraphs[0].align, 'center');
  assert.equal(title.text.anchor, 'bottom', 'master bodyPr');
  assert.equal(title.text.autofit, 'shrink');
  assert.equal(subtitle.text.paragraphs[0].runs[0].size, 24);
  assert.equal(subtitle.text.paragraphs[0].bullet, undefined, 'layout buNone');
  assert.equal(signals.slides[0].shapes.length, 2);
  // A layout placeholder with no box falls through to the master's.
  const body = signals.slides[1].shapes.find(shape => shape.placeholder?.idx === 1);
  assert.equal(body.box.source, 'master');
  assert.deepEqual(body.box.px, {x: 86.4, y: 182.4, w: 1104, h: 441.6});
  assert.equal(body.placeholder.type, 'obj');
});

await check('paragraph level, bullets, spacing and the slide-number field', async () => {
  const body = signals.slides[1].shapes.find(shape => shape.placeholder?.idx === 1);
  assert.deepEqual(body.text.paragraphs.map(paragraph => paragraph.level ?? 0), [0, 1, 0, 0]);
  assert.deepEqual(body.text.paragraphs.map(paragraph => paragraph.bullet), [{kind: 'char', char: '•'}, {kind: 'char', char: '–'}, {kind: 'char', char: '•'}, {kind: 'char', char: '•'}]);
  assert.deepEqual(body.text.paragraphs.map(paragraph => paragraph.runs[0].size), [28, 24, 28, 28]);
  assert.equal(body.text.paragraphs[0].marginLeftPx, 36);
  assert.equal(body.text.paragraphs[0].indentPx, -36);
  assert.equal(body.text.paragraphs[0].spaceBeforePt, 10);
  assert.equal(body.text.paragraphs[0].lineSpacingPct, 100);
  assert.equal(body.text.bulletedParagraphs, 4);
  assert.equal(body.text.paragraphCount, 4);
  const number = signals.slides[1].shapes.find(shape => shape.placeholder?.type === 'sldNum');
  assert.equal(number.text.paragraphs[0].runs[0].field, 'slidenum');
  assert.equal(number.text.paragraphs[0].align, 'right');
  assert.equal(number.text.paragraphs[0].runs[0].colorRef, 'tx2', 'layout-less master list style');
  assert.equal(number.text.paragraphs[0].runs[0].size, 12);
});

await check('z-order and group nesting with child transforms', async () => {
  const slide = signals.slides[2];
  assert.deepEqual(slide.shapes.map(shape => shape.zOrder), slide.shapes.map((_, index) => index), 'document order is z-order, back to front');
  assert.deepEqual(slide.shapes.map(shape => shape.name), ['TextBox 1', 'Code panel', 'Metric card', 'Card background', 'Metric value', 'Metric label', 'Scaled card', 'Scaled background', 'Inner group', 'Scaled label', 'Arrow 11', 'Source note']);
  const card = byName(slide, 'Metric card');
  assert.equal(card.kind, 'group');
  assert.deepEqual(card.children, [byName(slide, 'Card background').id, byName(slide, 'Metric value').id, byName(slide, 'Metric label').id]);
  assert.equal(byName(slide, 'Metric value').parent, card.id);
  assert.equal(byName(slide, 'Metric value').depth, 1);
  assert.equal(card.parent, null);
  // 1:1 group: the child box is the slide box.
  assert.deepEqual(byName(slide, 'Metric value').box.px, {x: 105.6, y: 336, w: 307.2, h: 96});
  // A group that draws its children at half scale, around a non-zero origin, with a nested group.
  const scaled = byName(slide, 'Scaled card');
  assert.deepEqual(scaled.box.px, {x: 518.4, y: 326.4, w: 345.6, h: 172.8});
  assert.deepEqual(byName(slide, 'Scaled background').box.px, {x: 518.4, y: 326.4, w: 345.6, h: 172.8});
  const inner = byName(slide, 'Inner group'), label = byName(slide, 'Scaled label');
  assert.equal(inner.parent, scaled.id);
  assert.equal(label.parent, inner.id);
  assert.equal(label.depth, 2);
  assert.deepEqual(label.box.px, {x: 566.4, y: 374.4, w: 192, h: 48});
  assert.equal(label.box.approximate, undefined, 'no rotation or flip: exact');
  // Position is independent of the importer's own (reflowed) block order.
  assert.deepEqual(slide.shapes.filter(shape => shape.parent === null).map(shape => shape.name), ['TextBox 1', 'Code panel', 'Metric card', 'Scaled card', 'Arrow 11', 'Source note']);
});

await check('text runs: font, size, weight, italic, colour, monospace, link', async () => {
  const slide = signals.slides[2];
  const code = byName(slide, 'Code panel');
  assert.deepEqual(code.text.paragraphs.map(paragraph => paragraph.text), ['def deploy(env):', '    build()', '    push(env)']);
  assert.ok(code.text.paragraphs.every(paragraph => paragraph.runs.every(run => run.font === 'Consolas' && run.monospace === true && run.size === 14 && run.color === '#1F2937')));
  assert.equal(code.text.monospaceShare, 1);
  assert.equal(code.text.dominantFont, 'Consolas');
  assert.deepEqual(code.fill, {kind: 'solid', color: '#F2F2F2'});
  assert.deepEqual(code.outline, {kind: 'solid', color: '#D1D5DB', widthPt: 1});
  assert.equal(code.geometry, 'rect');
  assert.equal(code.text.autofit, 'resize');
  const heading = byName(slide, 'TextBox 1').text.paragraphs[0].runs[0];
  assert.deepEqual([heading.size, heading.bold, heading.weight, heading.monospace, heading.font], [28, true, 700, undefined, 'Segoe UI']);
  const value = byName(slide, 'Metric value').text.paragraphs[0].runs[0];
  assert.deepEqual([value.text, value.size, value.bold, value.color, value.colorRef], ['98.7%', 54, true, '#FFFFFF', 'bg1']);
  assert.equal(byName(slide, 'Card background').fill.colorRef, 'accent1');
  assert.equal(byName(slide, 'Card background').fill.color, '#2563EB');
  assert.equal(byName(slide, 'Card background').kind, 'shape');
  assert.equal(byName(slide, 'Card background').geometry, 'roundRect');
  assert.equal(byName(slide, 'Card background').outline.kind, 'none');
  const label = byName(slide, 'Scaled label').text.paragraphs[0].runs[0];
  assert.deepEqual([label.italic, label.size], [true, 28]);
  const source = byName(slide, 'Source note').text.paragraphs[0];
  assert.deepEqual(source.runs.map(run => run.text), ['Source: ', 'status page']);
  assert.equal(source.runs[0].link, undefined);
  assert.equal(source.runs[1].link, 'https://status.example.com/');
  const quote = signals.slides[3].shapes[0];
  assert.deepEqual(quote.text.paragraphs.map(paragraph => [paragraph.runs[0].italic, paragraph.runs[0].font, paragraph.align ?? 'left']), [[true, 'Georgia', 'left'], [undefined, 'Segoe UI', 'right']]);
});

await check('connector, picture, table and hidden shape', async () => {
  const arrow = byName(signals.slides[2], 'Arrow 11');
  assert.equal(arrow.kind, 'connector');
  assert.deepEqual(arrow.outline, {kind: 'solid', color: '#374151', colorRef: 'tx2', widthPt: 1.5, tailArrow: 'triangle'});
  assert.equal(arrow.geometry, 'straightConnector1');
  const [, picture, table, helper] = signals.slides[3].shapes;
  assert.equal(picture.kind, 'picture');
  assert.equal(picture.alt, 'Four colour swatches');
  assert.equal(picture.rotation, 90);
  assert.deepEqual(picture.box.px, {x: 768, y: 76.8, w: 288, h: 288}, 'the frame before rotation');
  assert.deepEqual(picture.picture, {part: 'ppt/media/image1.png', mediaType: 'image/png', bytes: picture.picture.bytes, naturalPx: {w: 2, h: 2}, crop: {l: 10, t: 5, r: 0, b: 0}});
  assert.ok(picture.picture.bytes > 0);
  assert.equal(table.kind, 'table');
  assert.deepEqual(table.table, {rows: 3, columns: 2, columnWidthsPx: [307.2, 307.2], firstRow: true, firstColumn: false, bandedRows: true, cells: [['Region', 'ARR'], ['EMEA', '$4.1M'], ['APAC', '$2.7M']]});
  assert.equal(helper.hidden, true);
  assert.equal(helper.kind, 'shape');
  assert.deepEqual(helper.fill, {kind: 'solid', color: '#10B981', colorRef: 'accent3'});
  assert.equal(helper.geometry, 'ellipse');
});

await check('every link names an OPF path that exists in the document', async () => {
  const roles = new Set();
  for (const slide of signals.slides) for (const shape of slide.shapes) {
    if (shape.opf === null) continue;
    roles.add(shape.opf.role);
    if (shape.opf.path === undefined) continue;
    assert.notEqual(at(document, shape.opf.path), undefined, `${slide.index}/${shape.id}: ${shape.opf.path}`);
    if (shape.opf.role === 'block') assert.equal(at(document, shape.opf.path).type, shape.opf.blockType, shape.opf.path);
  }
  assert.ok(['title', 'subtitle', 'block'].every(role => roles.has(role)));
  assert.equal(signals.slides[0].shapes[0].opf.path, 'slides.0.title');
  assert.equal(document.slides[0].title, 'Acme Analytics Platform');
  assert.equal(signals.slides[0].shapes[1].opf.path, 'slides.0.subtitle');
  const body = signals.slides[1].shapes.find(shape => shape.placeholder?.idx === 1);
  assert.equal(body.opf.role, 'block');
  assert.equal(at(document, body.opf.path).type, 'text');
  const picture = signals.slides[3].shapes[1];
  assert.equal(at(document, picture.opf.path).type, 'image');
  const table = signals.slides[3].shapes[2];
  assert.equal(at(document, table.opf.path).type, 'table');
  // Shapes inside one group that feed one block make the group link there too.
  const slide = signals.slides[2];
  assert.equal(byName(slide, 'Inner group').opf?.path, byName(slide, 'Scaled label').opf?.path);
  // A connector became nothing: the signals say so.
  assert.equal(byName(slide, 'Arrow 11').opf, null);
});

await check('importing with signals reports the same diagnostics as without', async () => {
  const withSignals = [], without = [];
  await fromPptx(deck, {signals: true, onDiagnostic: item => withSignals.push(item)});
  await fromPptx(deck, {onDiagnostic: item => without.push(item)});
  assert.deepEqual(withSignals, without);
  assert.ok(without.length > 0);
});

// ---------------------------------------------------------------------------
// OPF's own exports: links follow the rebuilt structure.

await check('tagged exports link to groups, regions and root payloads', async () => {
  const opf = {$schema: 'https://openpresentation.org/schema/opf/v1', name: 'T', slides: [
    {title: 'Grouped', blocks: [{type: 'group', id: 'g1', blocks: [{type: 'text', text: 'Alpha'}, {type: 'list', items: ['a', 'b']}]}, {type: 'text', text: 'Omega'}]},
    {title: 'Regions', left: {type: 'text', text: 'L'}, right: {type: 'list', items: ['x', 'y']}},
    {title: 'Root', text: 'Just text'},
    {title: 'Mixed', blocks: [{type: 'metric', metric: {value: '98%', label: 'Uptime'}}, {type: 'quote', quote: {text: 'Q', attribution: 'A'}}, {type: 'code', code: {source: 'a = 1', language: 'python'}}]}
  ]};
  const result = await fromPptx(await toPptx(opf), {signals: true});
  assert.deepEqual(result.signals.slides.map(slide => slide.provenance), ['match', 'match', 'match', 'match']);
  assert.equal(result.signals.deck.provenance.opf, true);
  assert.equal(result.signals.deck.provenance.opfTaggedSlides, 4);
  const paths = slide => slide.shapes.filter(shape => shape.opf?.path).map(shape => `${shape.opf.path}:${shape.opf.blockType ?? shape.opf.role}`);
  assert.deepEqual([...new Set(paths(result.signals.slides[0]))], ['slides.0.title:title', 'slides.0.blocks.0.blocks.0:text', 'slides.0.blocks.0.blocks.1:list', 'slides.0.blocks.1:text']);
  assert.deepEqual([...new Set(paths(result.signals.slides[1]))], ['slides.1.title:title', 'slides.1.left:text', 'slides.1.right:list']);
  assert.deepEqual([...new Set(paths(result.signals.slides[2]))], ['slides.2.title:title', 'slides.2.text:text']);
  assert.deepEqual([...new Set(paths(result.signals.slides[3]))], ['slides.3.title:title', 'slides.3.blocks.0:metric', 'slides.3.blocks.1:quote', 'slides.3.blocks.2:code']);
  for (const slide of result.signals.slides) for (const shape of slide.shapes) if (shape.opf?.path) assert.notEqual(at(result.presentation, shape.opf.path), undefined, shape.opf.path);
  assert.ok(result.signals.slides[3].shapes.some(shape => shape.opfTagged === true), 'OPF tagged shapes are marked');
  assert.ok(result.signals.slides[3].shapes.some(shape => shape.opf?.role === 'metric' && shape.opf.path === undefined), 'members of a tagged group without a block of their own keep a role');
});

// ---------------------------------------------------------------------------
// A generator deck: chart, shapes, notes.

await check('PptxGenJS deck: charts, shapes, outline', async () => {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  const slide = pptx.addSlide();
  slide.addText('Chart slide', {x: 0.5, y: 0.3, w: 8, h: 0.8, fontSize: 32});
  slide.addChart(pptx.charts.BAR, [{name: 'Revenue', labels: ['Q1', 'Q2', 'Q3'], values: [10, 20, 30]}, {name: 'Cost', labels: ['Q1', 'Q2', 'Q3'], values: [5, 6, 7]}], {x: 0.5, y: 1.5, w: 6, h: 4, showTitle: true, title: 'Revenue vs cost', barDir: 'col'});
  slide.addChart(pptx.charts.PIE, [{name: 'Share', labels: ['A', 'B'], values: [60, 40]}], {x: 7, y: 1.5, w: 5, h: 4});
  slide.addShape(pptx.ShapeType.rect, {x: 0.5, y: 5.8, w: 3, h: 0.8, fill: {color: 'FF0000'}, line: {color: '000000', width: 2}});
  const generated = new Uint8Array(await pptx.write({outputType: 'uint8array'}));
  const result = await fromPptx(generated, {signals: true});
  assert.deepEqual(result.presentation, await fromPptx(generated));
  const shapes = result.signals.slides[0].shapes;
  const [bar, pie] = shapes.filter(shape => shape.kind === 'chart');
  assert.deepEqual(bar.chart, {extended: false, part: bar.chart.part, chartTypes: ['bar'], seriesCount: 2, pointCount: 3, barDirection: 'col', grouping: 'clustered', title: 'Revenue vs cost'});
  assert.deepEqual([pie.chart.chartTypes, pie.chart.seriesCount, pie.chart.pointCount], [['pie'], 1, 2]);
  assert.equal(at(result.presentation, bar.opf.path).type, 'chart');
  const rect = shapes.find(shape => shape.fill?.color === '#FF0000');
  assert.equal(rect.kind, 'shape');
  assert.equal(rect.outline.widthPt, 2);
  assert.equal(rect.outline.color, '#000000');
  assert.equal(shapes[0].text.paragraphs[0].runs[0].size, 32);
});

// ---------------------------------------------------------------------------
// Bounds and options

await check('limits bound the output and are reported', async () => {
  const small = await importWith(deck, {signals: {maxShapesPerSlide: 3, maxSlides: 2, maxTextCharsPerShape: 10, maxParagraphsPerShape: 2, maxGroupDepth: 1}});
  assert.equal(small.signals.slides.length, 2);
  assert.deepEqual(small.signals.truncated, {slides: 2});
  assert.equal(small.signals.deck.slideCount, 4);
  assert.equal(small.signals.limits.maxShapesPerSlide, 3);
  assert.equal(small.presentation.slides.length, 4, 'the document is never truncated');
  const [first, second] = small.signals.slides;
  assert.equal(first.shapes.length, 2);
  assert.equal(second.shapes.length, 3);
  assert.deepEqual(second.truncated, {text: 2, paragraphs: 2});
  assert.equal(second.shapes[1].text.paragraphs.length, 2);
  assert.ok(second.shapes[1].text.paragraphs.every(paragraph => paragraph.text.length <= 10));
  assert.equal(second.shapes[1].text.paragraphs[0].truncated, true);
  assert.equal(second.shapes[1].text.paragraphCount, 4, 'the real count is still reported');
  const crowded = (await importWith(deck, {signals: {maxShapesPerSlide: 3}})).signals.slides[2];
  assert.equal(crowded.shapes.length, 3);
  assert.equal(crowded.truncated.shapes, 9);
  assert.deepEqual(crowded.shapes.map(shape => shape.id), ['s0', 's1', 's2'], 'ids are stable under a lower limit');
  const flat = (await importWith(deck, {signals: {maxGroupDepth: 1}})).signals.slides[2];
  assert.equal(flat.shapes.filter(shape => shape.kind === 'group').length, 2);
  assert.equal(flat.truncated.depth, 2);
  assert.equal(flat.shapes.some(shape => shape.name === 'Metric value'), false);
  const total = (await importWith(deck, {signals: {maxTotalShapes: 6}})).signals.slides;
  assert.deepEqual(total.map(slide => slide.shapes.length), [2, 3, 1, 0]);
  assert.deepEqual([total[2].truncated.shapes, total[3].truncated.shapes], [11, 4], 'the deck-wide shape budget is shared');
  const budget = (await importWith(deck, {signals: {maxTextCharsTotal: 30}})).signals;
  assert.equal(budget.truncated.text, true);
  const emitted = budget.slides.flatMap(slide => slide.shapes).flatMap(shape => shape.text?.paragraphs ?? []).reduce((sum, paragraph) => sum + paragraph.text.length, 0);
  assert.ok(emitted <= 30, `text budget: ${emitted}`);
});

await check('table cells are bounded', async () => {
  const limited = (await importWith(deck, {signals: {maxTableCells: 4, maxTableCellChars: 3}})).signals.slides[3].shapes.find(shape => shape.kind === 'table');
  // The deck-wide text budget is a hard bound for table cells too.
  const tight = (await importWith(deck, {signals: {maxTextCharsTotal: 8}})).signals;
  const spent = tight.slides.flatMap(slide => slide.shapes).reduce((sum, shape) => sum + (shape.text?.paragraphs ?? []).reduce((n, paragraph) => n + paragraph.text.length, 0) + (shape.table?.cells ?? []).flat().reduce((n, cell) => n + cell.length, 0), 0);
  assert.ok(spent <= 8, `budget: ${spent}`);
  assert.equal(limited.table.truncated, true);
  assert.deepEqual(limited.table.cells, [['Reg', 'ARR'], ['EME', '$4.'], ['', '']]);
  assert.equal(limited.table.rows, 3);
});

await check('invalid options fail before any work', async () => {
  for (const bad of ['yes', 1, [], {maxSlides: 0}, {maxSlides: 1.5}, {maxSlides: 'a'}, {unknown: 1}, {maxShapesPerSlide: 5001}]) {
    await assert.rejects(() => fromPptx(deck, {signals: bad}), error => error.code === 'invalid-signals-option', JSON.stringify(bad));
  }
  await assert.rejects(() => fromPptx(deck, {signals: {maxSlides: 0}}), error => error.path === 'options.signals.maxSlides');
});

await check('a large deck stays bounded and quick', async () => {
  // 150 slides of 40 shapes each, in one package: only the bound and the time are checked.
  const base = unzipSync(deck);
  const slideXml = new TextDecoder().decode(base['ppt/slides/slide2.xml']);
  const filler = Array.from({length: 40}, (_, index) => `<p:sp><p:nvSpPr><p:cNvPr id="${100 + index}" name="Filler ${index}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${(index % 10) * 900000}" y="${Math.floor(index / 10) * 900000}"/><a:ext cx="800000" cy="400000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="1000"/><a:t>${'word '.repeat(20)}${index}</a:t></a:r></a:p></p:txBody></p:sp>`).join('');
  const big = {...base};
  const ids = [], rels = [];
  const slidesEntries = [];
  for (let n = 5; n < 155; n += 1) {
    big[`ppt/slides/slide${n}.xml`] = new TextEncoder().encode(slideXml.replace('</p:spTree>', `${filler}</p:spTree>`));
    big[`ppt/slides/_rels/slide${n}.xml.rels`] = base['ppt/slides/_rels/slide2.xml.rels'];
    ids.push(`<p:sldId id="${300 + n}" r:id="rIdBig${n}"/>`);
    rels.push(`<Relationship Id="rIdBig${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${n}.xml"/>`);
    slidesEntries.push(`<Override PartName="/ppt/slides/slide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`);
  }
  const text = path => new TextDecoder().decode(base[path]);
  big['ppt/presentation.xml'] = new TextEncoder().encode(text('ppt/presentation.xml').replace('</p:sldIdLst>', `${ids.join('')}</p:sldIdLst>`));
  big['ppt/_rels/presentation.xml.rels'] = new TextEncoder().encode(text('ppt/_rels/presentation.xml.rels').replace('</Relationships>', `${rels.join('')}</Relationships>`));
  big['[Content_Types].xml'] = new TextEncoder().encode(text('[Content_Types].xml').replace('</Types>', `${slidesEntries.join('')}</Types>`));
  const bytes = zipSync(big);
  const started = performance.now();
  const result = await fromPptx(bytes, {signals: {maxSlides: 100, maxShapesPerSlide: 30}});
  const elapsed = performance.now() - started;
  assert.equal(result.signals.slides.length, 100);
  assert.equal(result.signals.truncated.slides, 54);
  assert.ok(result.signals.slides.slice(4).every(slide => slide.shapes.length === 30 && slide.truncated.shapes === 13));
  assert.ok(JSON.stringify(result.signals).length < 2500000, `size: ${JSON.stringify(result.signals).length}`);
  assert.ok(elapsed < 60000, `time: ${elapsed}`);
});

await check('formatting and unusual objects are read without failing', async () => {
  const parts = unzipSync(deck);
  const path = 'ppt/slides/slide4.xml';
  const extra = `<p:sp><p:nvSpPr><p:cNvPr id="20" name="No box"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" b="1" u="sng" strike="sngStrike" cap="all"><a:solidFill><a:srgbClr val="C00000"><a:alpha val="50000"/></a:srgbClr></a:solidFill></a:rPr><a:t>Marked</a:t></a:r><a:r><a:rPr lang="en-US" baseline="30000"/><a:t>2</a:t></a:r><a:br><a:rPr lang="en-US"/></a:br><a:fld id="{00000000-0000-0000-0000-000000000000}" type="datetime1"><a:rPr lang="en-US"/><a:t>10/1/2026</a:t></a:fld></a:p><a:p><a:pPr marL="285750" indent="-285750" algn="just"><a:lnSpc><a:spcPts val="1800"/></a:lnSpc><a:buAutoNum type="arabicPeriod" startAt="3"/></a:pPr><a:r><a:rPr lang="en-US"/><a:t>Numbered</a:t></a:r></a:p></p:txBody></p:sp>
<p:sp><p:nvSpPr><p:cNvPr id="21" name="Bad box"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="abc" y="0"/><a:ext cx="10" cy="10"/></a:xfrm></p:spPr></p:sp>
<p:sp><p:nvSpPr><p:cNvPr id="22" name="Rule"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm flipH="1"><a:off x="0" y="0"/><a:ext cx="914400" cy="0"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="38100"><a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="FF0000"/></a:gs><a:gs pos="100000"><a:srgbClr val="0000FF"/></a:gs></a:gsLst><a:lin ang="5400000"/></a:gradFill><a:prstDash val="dash"/></a:ln></p:spPr></p:sp>
<p:sp><p:nvSpPr><p:cNvPr id="23" name="Styled"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm rot="-1800000"><a:off x="0" y="914400"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom></p:spPr><p:style><a:lnRef idx="2"><a:schemeClr val="accent2"/></a:lnRef><a:fillRef idx="1"><a:schemeClr val="accent5"/></a:fillRef><a:effectRef idx="0"><a:schemeClr val="accent1"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef></p:style></p:sp>
<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="24" name="Diagram"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram"/></a:graphic></p:graphicFrame>
<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="25" name="Embedded object"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/presentationml/2006/ole"><p:oleObj progId="Excel.Sheet.12"/></a:graphicData></a:graphic></p:graphicFrame>
<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="26" name="Mystery"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></p:xfrm><a:graphic><a:graphicData uri="urn:example:unknown"/></a:graphic></p:graphicFrame>
<p:pic><p:nvPicPr><p:cNvPr id="27" name="Clip"/><p:cNvPicPr/><p:nvPr><a:videoFile r:link="rIdMissing"/></p:nvPr></p:nvPicPr><p:blipFill><a:blip r:embed="rIdMissing"/></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr></p:pic>`;
  parts[path] = new TextEncoder().encode(new TextDecoder().decode(parts[path]).replace('</p:spTree>', `${extra}</p:spTree>`));
  const result = await fromPptx(zipSync(parts), {signals: true});
  const slide = result.signals.slides[3];
  const named = name => slide.shapes.find(shape => shape.name === name);
  assert.ok(slide.shapes.every(shape => shape.unreadable === undefined));
  const marked = named('No box');
  assert.equal(marked.box, null, 'a non-placeholder with no box has none');
  const [first, second] = marked.text.paragraphs;
  assert.deepEqual(first.runs.map(run => run.text), ['Marked', '2', '\n', '10/1/2026']);
  assert.deepEqual([first.runs[0].bold, first.runs[0].underline, first.runs[0].strike, first.runs[0].caps, first.runs[0].color, first.runs[0].alpha], [true, true, true, 'all', '#C00000', 0.5]);
  assert.equal(first.runs[1].baseline, 'superscript');
  assert.equal(first.runs[2].lineBreak, true);
  assert.equal(first.runs[3].field, 'datetime1');
  assert.equal(first.text, 'Marked2\n10/1/2026');
  assert.deepEqual(second.bullet, {kind: 'number', scheme: 'arabicPeriod', startAt: 3});
  assert.deepEqual([second.align, second.marginLeftPx, second.indentPx, second.lineSpacingPt], ['justify', 30, -30, 18]);
  assert.equal(named('Bad box').box, null);
  const rule = named('Rule');
  assert.equal(rule.kind, 'line');
  assert.equal(rule.flipH, true);
  assert.deepEqual(rule.outline, {kind: 'gradient', widthPt: 3, dash: 'dash'});
  const styled = named('Styled');
  assert.equal(styled.rotation, -30);
  assert.deepEqual(styled.fill, {kind: 'style', source: 'style', styleIndex: 1, color: '#8B5CF6', colorRef: 'accent5'});
  assert.deepEqual(styled.outline, {kind: 'style', source: 'style', styleIndex: 2, widthPt: 1, color: '#F59E0B', colorRef: 'accent2'});
  assert.equal(named('Diagram').kind, 'smartart');
  assert.equal(named('Embedded object').kind, 'ole');
  assert.deepEqual([named('Mystery').kind, named('Mystery').graphicType], ['unknown', 'urn:example:unknown']);
  assert.deepEqual([named('Clip').kind, named('Clip').mediaKind, named('Clip').picture], ['media', 'video', {unresolved: true}]);
});

await check('blocks that rejoin into one stored leaf all link to it', async () => {
  const at = y => ({x: 0, y, width: 100, height: 10});
  const placed = (topology, blocks, bounds) => { let map; const result = rebuildContent(topology, blocks, bounds, paths => { map = paths; }); assert.equal(result.reason, undefined); return [...map]; };
  // A soft-wrapped text exported as three native lines: all three flat blocks are the one root text.
  const lines = [{type: 'text', text: 'one '}, {type: 'text', text: 'two '}, {type: 'text', text: 'three'}];
  assert.deepEqual(placed({form: 'root', field: 'text', box: [0, 0, 100, 100], lines: 3}, lines, [at(0), at(10), at(20)]), [[0, 'text'], [1, 'text'], [2, 'text']]);
  assert.deepEqual(placed({form: 'blocks', blocks: [{t: 'leaf', k: 'text', box: [0, 0, 100, 100], lines: 3}]}, lines, [at(0), at(10), at(20)]), [[0, 'blocks.0'], [1, 'blocks.0'], [2, 'blocks.0']]);
  // A list whose native lines interleave with another object: both list blocks land on the list's path.
  const lists = [{type: 'list', items: ['a']}, {type: 'text', text: 'between'}, {type: 'list', items: ['b']}];
  const topology = {form: 'blocks', blocks: [{t: 'leaf', k: 'list', box: [0, 0, 100, 40]}, {t: 'leaf', k: 'text', box: [0, 50, 100, 20]}]};
  assert.deepEqual(placed(topology, lists, [at(0), at(50), at(20)]), [[0, 'blocks.0'], [2, 'blocks.0'], [1, 'blocks.1']]);
});

await check('no network, models or clock: the runtime policy is unchanged', async () => {
  assert.equal(runtimePolicy.requiredNetworkCalls, false);
  assert.equal(runtimePolicy.requiredAiDependency, false);
  assert.equal(runtimePolicy.deterministicLocalExecution, true);
  const realFetch = globalThis.fetch, realNow = Date.now;
  globalThis.fetch = () => { throw new Error('network used'); };
  Date.now = () => { throw new Error('clock used'); };
  try { await fromPptx(deck, {signals: true}); } finally { globalThis.fetch = realFetch; Date.now = realNow; }
});

await check('monospace families', async () => {
  for (const family of ['Consolas', 'Courier New', 'Menlo', 'SF Mono', 'JetBrains Mono', 'Source Code Pro', 'Roboto Mono', 'Lucida Console', 'Cascadia Code', 'IBM Plex Mono', 'Fira Code', 'Noto Sans Mono', 'Liberation Mono', 'DejaVu Sans Mono', 'Courier']) assert.equal(isMonospaceFamily(family), true, family);
  for (const family of ['Calibri', 'Arial', 'Segoe UI', 'Georgia', 'Helvetica Neue', 'Monotype Corsiva', 'Times New Roman', '', undefined]) assert.equal(isMonospaceFamily(family), false, String(family));
});

console.log(`import signals: ${cases} cases passed`);
