// RR-34: footnotes, citations and captions. Schema and semantic validation, deck numbering,
// marker fragments, the footnote area, caption bands, referencesSlide and pagination; decks
// without the new fields keep their geometry.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { composeSlide, validatePresentation, collectCitations, slideCitations, referencesSlide, walkCitationRuns, CITATION_MARKER_SCALE, CITATION_MARKER_RAISE, fitRichText, fitList, captionSettings } from '../dist/index.js';
import { lintPresentation } from '../dist/lint.js';
import { paginateSlide } from '../dist/pagination.js';
import { examples } from '../dist/examples.js';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9V3iWggAAAAASUVORK5CYII=';
const references = [
  { id: 'gartner', text: 'Gartner, Market Guide, 2026', url: 'https://example.com/gartner' },
  { id: 'annual', text: ['Annual report ', { text: '2025', bold: true }] },
  { id: 'spare', text: 'Never cited' },
];
const deck = () => ({
  name: 'Citations',
  references: structuredClone(references),
  slides: [
    { title: 'Intro', text: [{ text: 'Growth was strong', cite: 'gartner' }, ' and margins held', { text: '.', cite: ['gartner', 'annual'] }, { text: ' Note', footnote: 'An inline note.' }] },
    { title: 'Plain', text: 'No markers here' },
    { title: 'Again', blocks: [{ bullets: [[{ text: 'Second use', cite: 'annual' }]] }, { items: [{ text: ['Item ', { text: 'cited', cite: 'gartner' }], description: [{ text: 'described', footnote: 'Second note' }] }] }], design: { footer: { center: { text: 'Footer' } } } },
  ],
});
const geometry = (slide, presentation, slideIndex = 0, extra = {}) => composeSlide(slide, { presentation, slideIndex, layout: { id: 'blank' }, ...extra });
const markers = item => item.text.richLines.flatMap(line => line.fragments.filter(fragment => fragment.kind === 'marker'));
const strip = value => JSON.parse(JSON.stringify(value));

describe('validation', () => {
  test('a deck with references, citations, footnotes and captions is valid', () => {
    const document = deck();
    document.slides.push({ title: 'Captions', blocks: [{ image: png, caption: 'Figure 1' }, { chart: { type: 'bar', data: { columns: ['a', 's'], rows: [['x', 1]] } }, caption: { text: ['Rich ', { text: 'caption', italic: true }], position: 'above', align: 'center' } }, { table: { columns: ['A'], rows: [[1]] }, caption: [{ text: 'runs' }] }, { video: 'https://example.com/v.mp4', caption: 'Clip' }] });
    document.slides.push({ title: 'Root caption', image: png, caption: 'Root figure' });
    const result = validatePresentation(document);
    assert.deepEqual(result.errors, []);
    assert.equal(result.valid, true);
  });
  test('an unknown cited id is a cite-unknown-reference error at the cite field', () => {
    const document = deck();
    document.slides[0].text[0].cite = 'missing';
    document.slides[0].text[2].cite = ['gartner', 'gone'];
    const errors = validatePresentation(document).errors;
    assert.deepEqual(errors.map(error => [error.path, error.params.code, error.params.id]), [
      ['/slides/0/text/0/cite', 'cite-unknown-reference', 'missing'],
      ['/slides/0/text/2/cite/1', 'cite-unknown-reference', 'gone'],
    ]);
  });
  test('reference ids must be unique and reference text cannot cite', () => {
    const document = deck();
    document.references.push({ id: 'gartner', text: [{ text: 'dup', cite: 'annual' }] });
    const codes = validatePresentation(document).errors.map(error => `${error.params.code} ${error.path}`);
    assert.deepEqual(codes, ['reference-id-duplicate /references/3/id', 'cite-unsupported-location /references/3/text/0']);
  });
  test('cite and footnote outside text, bullets and list items are cite-unsupported-location errors', () => {
    const document = deck();
    document.slides[1] = { title: 'Table', blocks: [{ table: { columns: [[{ text: 'H', cite: 'gartner' }]], rows: [[{ value: [{ text: 'c', footnote: 'n' }] }]] }, caption: [{ text: 'cap', cite: 'gartner' }] }] };
    document.slides[0].text[3].footnote = [{ text: 'nested', cite: 'gartner' }];
    const paths = validatePresentation(document).errors.filter(error => error.params.code === 'cite-unsupported-location').map(error => error.path).sort();
    assert.deepEqual(paths, ['/slides/0/text/3/footnote/0', '/slides/1/blocks/0/caption/0', '/slides/1/blocks/0/table/columns/0/0', '/slides/1/blocks/0/table/rows/0/0/value/0']);
  });
  test('a caption needs exactly one image, chart, table or video payload', () => {
    const cases = [
      [{ title: 'text', text: 'body', caption: 'no' }, '/slides/0/caption'],
      [{ title: 'group', blocks: [{ blocks: [{ text: 'a' }], caption: 'no' }] }, '/slides/0/blocks/0/caption'],
      [{ title: 'two', image: png, chart: { type: 'bar', data: { columns: ['a', 's'], rows: [['x', 1]] } }, caption: 'which' }, '/slides/0/caption'],
      [{ title: 'quote', blocks: [{ quote: 'q', caption: 'no' }] }, '/slides/0/blocks/0/caption'],
    ];
    for (const [slide, path] of cases) {
      const errors = validatePresentation({ slides: [slide] }).errors.filter(error => error.params.code === 'caption-unsupported-payload');
      assert.deepEqual(errors.map(error => error.path), [path], JSON.stringify(slide));
    }
  });
  test('schema rejects an empty cite list, an empty footnote, a bad caption position and unknown reference fields', () => {
    for (const slide of [
      { text: [{ text: 'a', cite: [] }] },
      { text: [{ text: 'a', footnote: '' }] },
      { image: png, caption: { text: 'c', position: 'left' } },
    ]) assert.equal(validatePresentation({ slides: [{ title: 't', ...slide }] }).valid, false, JSON.stringify(slide));
    assert.equal(validatePresentation({ references: [{ id: 'a', text: 'b', extra: 1 }], slides: [{ title: 't' }] }).valid, false);
    assert.equal(validatePresentation({ references: [{ id: 'a' }], slides: [{ title: 't' }] }).valid, false);
  });
  test('lint reports an unused reference as a warning and keeps semantic codes as rule ids', () => {
    const document = deck();
    const report = lintPresentation(document);
    assert.equal(report.valid, true);
    assert.deepEqual(report.diagnostics.map(d => [d.ruleId, d.severity, d.path]), [['opf/unused-reference', 'warning', '/references/2']]);
    document.slides[0].text[0].cite = 'nope';
    const bad = lintPresentation(document);
    assert.equal(bad.valid, false);
    assert.ok(bad.diagnostics.some(d => d.ruleId === 'opf/cite-unknown-reference' && d.path === '/slides/0/text/0/cite' && d.severity === 'error'));
    delete document.references;
    assert.deepEqual(lintPresentation({ ...document, slides: [{ title: 'plain', text: 'x' }] }).diagnostics, []);
  });
});

describe('numbering', () => {
  test('markers are numbered per deck in reading order; a reference keeps its number, footnotes take new ones', () => {
    const result = collectCitations(deck());
    assert.deepEqual(result.notes.map(note => [note.number, note.kind, note.id ?? note.text, note.sourcePath]), [
      [1, 'reference', 'gartner', 'references.0'],
      [2, 'reference', 'annual', 'references.1'],
      [3, 'footnote', 'An inline note.', 'slides.0.text.3'],
      [4, 'footnote', 'Second note', 'slides.2.blocks.1.items.0.description.0'],
    ]);
    assert.deepEqual(result.references.map(note => note.id), ['gartner', 'annual']);
    assert.deepEqual(result.unused, ['spare']);
    assert.deepEqual([...result.slides.keys()], [0, 2]);
    assert.deepEqual(result.slides.get(0).marked.map(marker => [marker.path, marker.text]), [['slides.0.text.0', '1'], ['slides.0.text.2', '1,2'], ['slides.0.text.3', '3']]);
    assert.deepEqual(result.slides.get(0).notes.map(note => note.number), [1, 2, 3]);
    assert.deepEqual(result.slides.get(2).marked.map(marker => [marker.path, marker.text]), [['slides.2.blocks.0.bullets.0.0', '2'], ['slides.2.blocks.1.items.0.text.1', '1'], ['slides.2.blocks.1.items.0.description.0', '4']]);
    assert.deepEqual(result.slides.get(2).notes.map(note => note.number), [1, 2, 4]);
  });
  test('reading order is regions (sorted keys), then blocks, then the root payload', () => {
    const paths = [];
    walkCitationRuns({ 'top:right': { text: [{ text: 'r', cite: 'a' }] }, left: { blocks: [{ bullets: [{ text: [{ text: 'b', cite: 'a' }] }] }] } }, 'slides.0', entry => paths.push(entry.path));
    assert.deepEqual(paths, ['slides.0.left.blocks.0.bullets.0.text.0', 'slides.0.top:right.text.0']);
  });
  test('slideCitations continues the deck numbering for a slide object that is not the document slide', () => {
    const document = deck();
    const page = structuredClone(document.slides[2]);
    const result = slideCitations(page, 2, document);
    assert.deepEqual(result.notes.map(note => note.number), [1, 2, 4]);
    assert.equal(slideCitations(document.slides[1], 1, document), undefined);
    const alone = slideCitations(document.slides[2], 0);
    assert.deepEqual(alone.notes.map(note => [note.number, note.resolved, note.text]), [[1, false, 'annual'], [2, false, 'gartner'], [3, true, 'Second note']]);
  });
});

describe('markers in fits', () => {
  test('a cited run gets a superscript marker fragment after its text with no source range', () => {
    const document = deck();
    const slide = geometry(document.slides[0], document);
    const item = slide.items.find(item => item.field === 'text');
    const found = markers(item);
    assert.deepEqual(found.map(fragment => [fragment.text, fragment.runIndex, fragment.start, fragment.end]), [['1', 0, 17, 17], ['1,2', 2, 1, 1], ['3', 3, 5, 5]]);
    const body = item.text.richLines[0].fragments;
    for (const marker of found) {
      const previous = body[body.indexOf(marker) - 1];
      assert.equal(previous.runIndex, marker.runIndex);
      assert.ok(Math.abs(previous.x + previous.width - marker.x) < 1e-6, 'marker follows its run');
      // The exporter writes the marked run's size; PowerPoint draws 2/3 of it (native probe 2026-10-01); the raise is 0.30 of the nominal size.
      assert.ok(Math.abs(marker.nominalSize - previous.fontSize) < 1e-9, 'the nominal size is the marked run size');
      assert.ok(Math.abs(marker.fontSize - previous.fontSize * CITATION_MARKER_SCALE) <= 1 / 75 / 2 + 1e-9, 'glyph is 2/3 of the nominal size on the 0.01 pt grid');
      assert.ok(Math.abs(marker.fontSize * 75 - Math.round(marker.fontSize * 75)) < 1e-6, 'glyph size sits on the grid');
      assert.ok(Math.abs(marker.baselineShift + marker.nominalSize * CITATION_MARKER_RAISE) < 1e-9);
      assert.ok(marker.width > 0);
    }
    // Run indexes and offsets of the text fragments are those of the authored runs.
    assert.deepEqual(body.filter(fragment => !fragment.kind).map(fragment => [fragment.runIndex, fragment.start, fragment.end]), [[0, 0, 17], [1, 0, 17], [2, 0, 1], [3, 0, 5]]);
    assert.deepEqual(item.text.lines, ['Growth was strong and margins held. Note']);
    const width = body.reduce((sum, fragment) => sum + fragment.width, 0);
    assert.ok(Math.abs(item.text.richLines[0].width - width) < 1e-6, 'line width includes the markers');
  });
  test('markers wrap with their word', () => {
    const style = { fontFamily: 'sans-serif', fontWeight: 400, path: 'slides.0.text' };
    const runs = ['Alpha beta gamma delta epsilon ', { text: 'zeta', cite: 'a' }];
    const plain = fitRichText(runs, { x: 0, y: 0, width: 300, height: 400 }, 25, 16, { style });
    const marked = fitRichText(runs, { x: 0, y: 0, width: 300, height: 400 }, 25, 16, { style, citationMarker: path => path === 'slides.0.text.1' ? '12,13' : undefined });
    assert.equal(marked.fontSize, plain.fontSize);
    const last = marked.richLines.at(-1).fragments;
    assert.equal(last.at(-1).kind, 'marker');
    assert.equal(last.at(-2).text, 'zeta');
    for (const line of marked.richLines) assert.ok(line.width <= 300 + 0.01);
    assert.ok(markers({ text: marked }).length === 1);
  });
  test('list and bullet runs carry markers through fitList', () => {
    const fit = fitList([{ text: ['A ', { text: 'cited', cite: 'a' }], description: [{ text: 'desc', footnote: 'n' }] }, [{ text: 'bullet', cite: 'b' }]], { x: 0, y: 0, width: 600, height: 400 }, 25, 16, { style: { fontFamily: 'sans-serif', fontWeight: 400, path: 'slides.0.items' }, citationMarker: path => ({ 'slides.0.items.0.text.1': '1', 'slides.0.items.0.description.0': '2', 'slides.0.items.1.0': '3' })[path] });
    assert.deepEqual(fit.listEntries.map(entry => [markers({ text: entry.text }).map(m => m.text), entry.description ? markers({ text: entry.description }).map(m => m.text) : null]), [[['1'], ['2']], [['3'], null]]);
  });
  test('a run without a path, or an empty run, gets no marker', () => {
    const fit = fitRichText([{ text: '', cite: 'a' }, { text: 'x', cite: 'a' }], { x: 0, y: 0, width: 300, height: 100 }, 25, 16, { style: { fontFamily: 'sans-serif', fontWeight: 400 }, citationMarker: () => '1' });
    assert.equal(markers({ text: fit }).length, 0);
  });
});

describe('footnote area', () => {
  test('the area sits above the footer band and the content area shrinks by exactly its height', () => {
    const document = deck();
    const marked = geometry(document.slides[0], document, 0);
    const plain = geometry({ ...document.slides[0], text: 'Growth was strong and margins held. Note' }, document, 0);
    assert.ok(marked.footnotes, 'footnote area present');
    const { box, entries, rule, fontSize } = marked.footnotes;
    assert.equal(marked.footnotes.path, 'slides.0');
    assert.deepEqual(entries.map(entry => [entry.number, entry.kind, entry.value, entry.sourcePath]), [
      [1, 'reference', '1 Gartner, Market Guide, 2026', 'references.0'],
      [2, 'reference', ['2 ', 'Annual report ', { text: '2025', bold: true }], 'references.1'],
      [3, 'footnote', '3 An inline note.', 'slides.0.text.3'],
    ]);
    assert.equal(entries[0].url, 'https://example.com/gartner');
    assert.equal(fontSize, 16);
    // Bottom edge: the bottom padding (no footer on this slide); x and width: the content area.
    assert.ok(Math.abs(box.y + box.height - (720 - 57.6)) < 1e-6);
    assert.equal(box.x, plain.contentBox.x);
    assert.equal(box.width, plain.contentBox.width);
    assert.deepEqual(rule, { x: box.x, y: box.y, width: box.width, thickness: 1 });
    // Entries stack inside the area in number order.
    let cursor = box.y + rule.thickness;
    for (const entry of entries) { assert.ok(entry.box.y >= cursor - 1e-6); cursor = entry.box.y + entry.box.height; assert.ok(entry.box.x === box.x && entry.box.width === box.width); assert.equal(entry.overflow, false); }
    assert.ok(cursor <= box.y + box.height + 1e-6);
    // The content area loses the area plus half a gap; nothing else moves.
    const gap = 720 / 30;
    assert.ok(Math.abs(plain.contentBox.height - marked.contentBox.height - box.height - gap / 2) < 1e-6);
    assert.equal(marked.contentBox.y, plain.contentBox.y);
    assert.deepEqual(marked.items.find(item => item.field === 'title').box, plain.items.find(item => item.field === 'title').box);
    assert.deepEqual(marked.diagnostics, []);
  });
  test('with a footer the area sits directly above the footer band', () => {
    const document = deck();
    const slide = geometry(document.slides[2], document, 2);
    const footerTop = slide.furniture.footerTop;
    assert.ok(Math.abs(slide.footnotes.box.y + slide.footnotes.box.height - (footerTop - 12)) < 1e-6);
    assert.deepEqual(slide.footnotes.entries.map(entry => entry.number), [1, 2, 4]);
    assert.ok(slide.contentBox.y + slide.contentBox.height <= slide.footnotes.box.y);
  });
  test('an unresolved reference lists its id and reports unresolved-content; long notes report text-overflow and cap the area', () => {
    const alone = composeSlide({ title: 't', text: [{ text: 'x', cite: 'ghost' }] });
    assert.equal(alone.footnotes.entries[0].value, '1 ghost');
    assert.deepEqual(alone.diagnostics.map(d => [d.code, d.path]), [['unresolved-content', 'slides.0.text.0']]);
    const long = 'A very long footnote that goes on and on. '.repeat(40);
    const slide = composeSlide({ title: 't', text: [{ text: 'x', footnote: long }, { text: 'y', footnote: long }, { text: 'z', footnote: long }] });
    assert.ok(slide.footnotes.overflow);
    assert.ok(slide.diagnostics.some(d => d.code === 'text-overflow' && d.path === 'slides.0.text.2'));
    assert.ok(slide.footnotes.box.height <= (720 - 2 * 57.6) * 0.35 + 1);
    assert.ok(slide.contentBox.height > 100, 'content keeps most of the slide');
  });
  test('slides without markers have no footnote area and unchanged geometry', () => {
    const document = deck();
    const withReferences = geometry(document.slides[1], document, 1);
    const without = geometry(document.slides[1], { ...document, references: undefined }, 1);
    assert.equal(withReferences.footnotes, undefined);
    assert.deepEqual(strip(withReferences), strip(without));
    for (const { deck: example } of examples) for (const [index, slide] of example.slides.entries()) {
      const composed = composeSlide(slide, { presentation: example, slideIndex: index });
      assert.equal(composed.footnotes, undefined);
      assert.ok(composed.items.every(item => item.caption === undefined));
    }
  });
  test('a paginated slide carries the footnote area only on pages that show markers', () => {
    const items = Array.from({ length: 40 }, (_, index) => index === 0 ? [{ text: `Point ${index}`, cite: 'gartner' }] : `Point ${index}`);
    const document = { references: structuredClone(references), slides: [{ title: 'Long', items }] };
    const result = paginateSlide(document.slides[0], { presentation: document, slideIndex: 0 });
    assert.ok(result.slides.length > 1);
    const pages = result.slides.map((slide, index) => composeSlide(slide, { presentation: { ...document, slides: result.slides }, slideIndex: index }));
    assert.ok(pages[0].footnotes && pages[0].footnotes.entries[0].number === 1);
    assert.ok(pages.slice(1).every(page => page.footnotes === undefined));
  });
});

describe('captions', () => {
  const block = (payload, caption) => ({ title: 'Caption', blocks: [{ ...payload, caption }] });
  const payloads = { image: { image: png }, chart: { chart: { type: 'bar', data: { columns: ['a', 's'], rows: [['x', 1], ['y', 2]] } } }, table: { table: { columns: ['A', 'B'], rows: [[1, 2]] } }, video: { video: 'https://example.com/v.mp4' } };
  test('a caption band is reserved below the media inside the block region, in every captionable payload', () => {
    for (const [field, payload] of Object.entries(payloads)) {
      const plain = composeSlide(block(payload)), captioned = composeSlide(block(payload, 'Figure 1. Something'));
      const region = plain.items[1].box, item = captioned.items[1], caption = item.caption;
      assert.ok(caption, field);
      assert.equal(caption.path, 'slides.0.blocks.0.caption');
      assert.equal(caption.position, 'below');
      assert.equal(caption.alignment, 'left');
      assert.equal(caption.text, 'Figure 1. Something');
      assert.deepEqual(caption.mediaBox, item.box);
      assert.equal(item.box.x, region.x); assert.equal(item.box.width, region.width); assert.equal(item.box.y, region.y);
      assert.equal(caption.box.x, region.x); assert.equal(caption.box.width, region.width);
      assert.ok(Math.abs(caption.box.y + caption.box.height - (region.y + region.height)) < 1e-6, 'band ends at the region bottom');
      assert.ok(item.box.y + item.box.height < caption.box.y, 'media ends above the band');
      assert.equal(caption.fontSize, 16);
      assert.equal(caption.fit.lines.length, 1);
      assert.deepEqual(captioned.diagnostics, plain.diagnostics);
      assert.equal(caption.textStyle.fontFamily, 'sans-serif');
    }
  });
  test('position above puts the band at the top; align and rich text are kept', () => {
    const slide = composeSlide(block(payloads.image, { text: ['Rich ', { text: 'caption', italic: true }], position: 'above', align: 'center' }), { fonts: { body: 'Roboto' } });
    const item = slide.items[1], caption = item.caption;
    const region = composeSlide(block(payloads.image)).items[1].box;
    assert.equal(caption.position, 'above'); assert.equal(caption.alignment, 'center');
    assert.equal(caption.box.y, region.y);
    assert.ok(item.box.y > caption.box.y + caption.box.height);
    assert.ok(Math.abs(item.box.y + item.box.height - (region.y + region.height)) < 1e-6);
    assert.ok('richLines' in caption.fit);
    assert.equal(caption.textStyle.fontFamily, 'Roboto');
  });
  test('a root caption applies to the slide root payload; cards keep their frame', () => {
    const root = composeSlide({ title: 'Root', image: png, caption: 'Root figure' });
    assert.equal(root.items[1].caption.path, 'slides.0.caption');
    const card = composeSlide(block(payloads.table, 'Table 1'), { contentBox: true });
    const item = card.items[1];
    assert.ok(item.frameBox);
    assert.ok(item.caption.box.y + item.caption.box.height <= item.frameBox.y + item.frameBox.height);
  });
  test('a caption that cannot fit its band reports text-overflow at the caption path', () => {
    const slide = composeSlide({ title: 'Tiny', blocks: Array.from({ length: 6 }, () => ({ image: png, caption: 'A caption far too long for a small cell. '.repeat(12) })) });
    assert.ok(slide.diagnostics.some(d => d.code === 'text-overflow' && d.path === 'slides.0.blocks.0.caption'));
    for (const item of slide.items.filter(item => item.caption)) assert.ok(item.caption.box.height <= (item.caption.box.height + item.box.height) * 0.35 + 24);
  });
  test('captionSettings normalizes every caption form', () => {
    assert.deepEqual(captionSettings('a'), { text: 'a', position: 'below', align: 'left' });
    assert.deepEqual(captionSettings([{ text: 'a' }]), { text: [{ text: 'a' }], position: 'below', align: 'left' });
    assert.deepEqual(captionSettings({ text: 'a', position: 'above', align: 'right' }), { text: 'a', position: 'above', align: 'right' });
    assert.equal(captionSettings(undefined), undefined);
  });
});

describe('referencesSlide', () => {
  test('lists the cited references in marker order as n. text items with links', () => {
    const document = deck();
    const slide = referencesSlide(document);
    assert.deepEqual(slide, { title: 'References', items: [
      ['1. ', 'Gartner, Market Guide, 2026', ' ', { text: 'https://example.com/gartner', link: 'https://example.com/gartner' }],
      ['2. ', 'Annual report ', { text: '2025', bold: true }],
    ] });
    assert.equal(validatePresentation({ ...document, slides: [...document.slides, slide] }).valid, true);
    assert.deepEqual(referencesSlide({ ...document, slides: [document.slides[1]] }, { title: 'Sources' }), { title: 'Sources' });
    assert.deepEqual(referencesSlide({ references: [{ id: 'a', text: 'Plain' }], slides: [{ text: [{ text: 'x', cite: 'a' }] }] }).items, ['1. Plain']);
  });
});
