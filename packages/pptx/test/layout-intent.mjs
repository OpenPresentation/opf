import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';
import {validatePresentation, validateCatalogRecord, catalogs} from '@openpresentation/opf';
import {renderSvgDeck} from '@openpresentation/opf-render';

// FF-29: slide layout intent (layout id, type, composition, composition hints
// and the inline catalogs.layouts record) is part of each OPF_SLIDE_V1 record.
// Import restores it with the document record (FF-32) and without it, for
// example after a slide is pasted into another deck.
const enc = new TextEncoder(), dec = new TextDecoder();
const base = catalogs.layouts.find(record => record.id === 'title-subtitle');
const heroA = {...structuredClone(base), id: 'gallery-hero', name: 'Gallery Hero'};
const heroB = {...structuredClone(heroA), name: 'Gallery Hero (other deck)'};
const sideB = {...structuredClone(base), id: 'gallery-side', name: 'Gallery Side'};
const deckA = {
  $schema: 'https://openpresentation.org/schema/opf/v1', name: 'Deck A', narrative: 'problem-solution',
  design: {contentAlignment: 'center'}, catalogs: {layouts: {records: [heroA]}},
  slides: [
    {layout: 'gallery-hero', title: 'Hello', subtitle: 'World', composition: {mode: 'column'}, design: {titleAlignment: 'center', contentBox: false}},
    {layout: 'title-subtitle', title: 'Two', subtitle: 'Bundled'}
  ]
};
const deckB = {
  $schema: 'https://openpresentation.org/schema/opf/v1', name: 'Deck B', catalogs: {layouts: {records: [heroB, sideB]}},
  slides: [{layout: 'gallery-hero', title: 'From B', subtitle: 'Different record'}, {layout: 'gallery-side', title: 'Side', subtitle: 'Only in B'}]
};
for (const deck of [deckA, deckB]) assert.equal(validatePresentation(deck).valid, true, JSON.stringify(validatePresentation(deck).errors));
const exportedA = await toPptx(structuredClone(deckA)), exportedB = await toPptx(structuredClone(deckB));

const read = async bytes => {
  const issues = [];
  const deck = await fromPptx(bytes, {onDiagnostic: issue => issues.push(issue)});
  assert.equal(validatePresentation(deck).valid, true);
  // Every restored layout id resolves, so the imported document always renders.
  assert.equal(renderSvgDeck(deck).length, deck.slides.length);
  return {deck, provenance: issues.filter(issue => /provenance|reference|slide-id/.test(issue.code)).map(issue => [issue.code, issue.path])};
};
const modify = (bytes, mutate) => { const entries = unzipSync(bytes); mutate(entries); return zipSync(entries); };
const text = (entries, path, mutate) => { entries[path] = enc.encode(mutate(dec.decode(entries[path]))); };
const tagValue = bytes => JSON.parse(Buffer.from(dec.decode(bytes).match(/\bval="([^"]+)"/)[1], 'hex').toString('utf8'));
const stripDocument = entries => text(entries, 'ppt/presentation.xml', xml => xml.replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/, ''));
const intent = slide => ({layout: slide.layout, type: slide.type, composition: slide.composition, titleAlignment: slide.design?.titleAlignment, contentBox: slide.design?.contentBox});
const expectedA = [
  {layout: 'gallery-hero', type: undefined, composition: {mode: 'column'}, titleAlignment: 'center', contentBox: false},
  {layout: 'title-subtitle', type: undefined, composition: undefined, titleAlignment: undefined, contentBox: undefined}
];
// Paste slide `index` of another package after the last slide, as PowerPoint
// does: the slide keeps its own OPF_SLIDE_V1 tag, the host keeps its document tag.
const paste = (target, source, index) => modify(target, entries => {
  const from = unzipSync(source);
  const count = Object.keys(entries).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path)).length, n = count + 1;
  entries[`ppt/slides/slide${n}.xml`] = from[`ppt/slides/slide${index}.xml`];
  entries[`ppt/tags/opfPasted${n}.xml`] = from[`ppt/tags/opfSlide${index}.xml`];
  entries[`ppt/slides/_rels/slide${n}.xml.rels`] = enc.encode(dec.decode(from[`ppt/slides/_rels/slide${index}.xml.rels`])
    .replace(`../tags/opfSlide${index}.xml`, `../tags/opfPasted${n}.xml`).replace(/<Relationship [^>]*notesSlide[^>]*\/>/, ''));
  text(entries, '[Content_Types].xml', xml => xml.replace('</Types>', `<Override PartName="/ppt/slides/slide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/tags/opfPasted${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tags+xml"/></Types>`));
  text(entries, 'ppt/_rels/presentation.xml.rels', xml => xml.replace('</Relationships>', `<Relationship Id="rIdPasted${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${n}.xml"/></Relationships>`));
  text(entries, 'ppt/presentation.xml', xml => xml.replace('</p:sldIdLst>', `<p:sldId id="${500 + n}" r:id="rIdPasted${n}"/></p:sldIdLst>`));
});
let cases = 0;

// Package shape: the inline record travels with its slide; bundled ids carry none.
{
  const entries = unzipSync(exportedA);
  const [one, two] = [1, 2].map(index => tagValue(entries[`ppt/tags/opfSlide${index}.xml`]));
  assert.deepEqual({layout: one.layout, type: one.type, composition: one.composition, layoutRecord: one.layoutRecord, design: one.design},
    {layout: 'gallery-hero', type: undefined, composition: {mode: 'column'}, layoutRecord: heroA, design: {titleAlignment: 'center', contentBox: false}});
  assert.equal(two.layout, 'title-subtitle');
  assert.equal(two.layoutRecord, undefined, 'Bundled layouts need no stored record.');
  assert.deepEqual(tagValue(entries['ppt/tags/opfDocument.xml']).catalogs, {layouts: {records: [heroA]}});
  assert.equal(Object.keys(entries).some(path => /opfLayout/i.test(path)), false, 'No separate layout tag part.');
  const refs = unzipSync(await toPptx(structuredClone(deckA), {provenance: 'references-only'}));
  assert.deepEqual(tagValue(refs['ppt/tags/opfSlide1.xml']).layoutRecord, heroA, 'A layout record without sources is a reference.');
  const none = unzipSync(await toPptx(structuredClone(deckA), {provenance: false}));
  assert.equal(Object.keys(none).some(path => /^ppt\/tags\/opf(Document|Slide)/.test(path)), false);
  cases++;
}

// With the document record (FF-32): every layout intent returns, and re-export writes the same records.
{
  const {deck, provenance} = await read(exportedA);
  assert.deepEqual(provenance, []);
  assert.deepEqual(deck.slides.map(intent), expectedA);
  assert.deepEqual(deck.catalogs, {layouts: {records: [heroA]}});
  assert.equal(deck.narrative, 'problem-solution');
  const again = unzipSync(await toPptx(deck)), before = unzipSync(exportedA);
  for (const index of [1, 2]) {
    const {native: _a, ...x} = tagValue(before[`ppt/tags/opfSlide${index}.xml`]), {native: _b, ...y} = tagValue(again[`ppt/tags/opfSlide${index}.xml`]);
    assert.deepEqual(y, x, `slide ${index} provenance is idempotent`);
  }
  cases++;
}

// Without document provenance: slide tags alone restore layout intent and records.
{
  const stripped = await read(modify(exportedA, stripDocument));
  assert.deepEqual(stripped.provenance, []);
  assert.deepEqual(stripped.deck.slides.map(intent), expectedA);
  assert.deepEqual(stripped.deck.catalogs, {layouts: {records: [heroA]}});
  assert.equal(stripped.deck.narrative, undefined, 'Deck metadata needs the document record.');
  assert.equal(stripped.deck.design?.contentAlignment, undefined, 'Deck defaults need the document record.');
  const damaged = await read(modify(exportedA, entries => text(entries, 'ppt/tags/opfDocument.xml', xml => xml.replace(/val="[0-9A-F]{8}/, 'val="ZZZZZZZZ'))));
  assert.deepEqual(damaged.provenance, [['invalid-document-provenance', '']]);
  assert.deepEqual(damaged.deck.slides.map(intent), expectedA);
  assert.deepEqual(damaged.deck.catalogs, {layouts: {records: [heroA]}});
  cases++;
}

// A pasted slide brings the record the host document lacks.
{
  const {deck, provenance} = await read(paste(exportedA, exportedB, 2));
  assert.deepEqual(deck.slides.map(slide => slide.layout), ['gallery-hero', 'title-subtitle', 'gallery-side']);
  assert.deepEqual(deck.catalogs, {layouts: {records: [heroA, sideB]}});
  // The deck default is not restored once slides were added (FF-32).
  assert.deepEqual(provenance, [['design-reference-changed', 'design.contentAlignment']]);
  const stripped = await read(modify(paste(exportedA, exportedB, 2), stripDocument));
  assert.deepEqual(stripped.provenance, []);
  assert.deepEqual(stripped.deck.slides.map(slide => slide.layout), ['gallery-hero', 'title-subtitle', 'gallery-side']);
  assert.deepEqual(stripped.deck.catalogs, {layouts: {records: [heroA, sideB]}});
  cases++;
}

// A pasted slide whose record disagrees for the same id keeps its content without the layout id.
{
  const {deck, provenance} = await read(paste(exportedA, exportedB, 1));
  assert.deepEqual(deck.slides.map(slide => slide.layout), ['gallery-hero', 'title-subtitle', undefined]);
  assert.equal(deck.slides[2].title, 'From B');
  assert.deepEqual(deck.catalogs, {layouts: {records: [heroA]}});
  assert.deepEqual(provenance, [['layout-reference-changed', 'slides.2.layout'], ['design-reference-changed', 'design.contentAlignment']]);
  const stripped = await read(modify(paste(exportedA, exportedB, 1), stripDocument));
  assert.deepEqual(stripped.deck.slides.map(slide => slide.layout), ['gallery-hero', 'title-subtitle', undefined]);
  assert.deepEqual(stripped.deck.catalogs, {layouts: {records: [heroA]}});
  assert.deepEqual(stripped.provenance, [['layout-reference-changed', 'slides.2.layout']]);
  cases++;
}

// Tampering and edits report the specific field; the rest of the slide intent is unaffected.
{
  const retag = (entries, mutate) => text(entries, 'ppt/tags/opfSlide1.xml', xml => {
    const value = JSON.parse(Buffer.from(xml.match(/\bval="([^"]+)"/)[1], 'hex').toString('utf8'));
    mutate(value);
    return xml.replace(/val="[0-9A-F]+"/, `val="${Buffer.from(JSON.stringify(value)).toString('hex').toUpperCase()}"`);
  });
  // A tampered record is ignored; with no other record the id cannot resolve, so it is not restored.
  const mismatched = await read(modify(exportedA, entries => { stripDocument(entries); retag(entries, value => { value.layoutRecord.id = 'other'; }); }));
  assert.deepEqual(mismatched.provenance, [['invalid-document-provenance', 'slides.0.layoutRecord'], ['unresolved-layout-reference', 'slides.0.layout']]);
  assert.deepEqual(mismatched.deck.slides.map(slide => slide.layout), [undefined, 'title-subtitle']);
  assert.equal(mismatched.deck.catalogs, undefined);
  assert.equal(mismatched.deck.slides[0].composition?.mode, 'column', 'The rest of the intent still returns.');
  // With the document record the same tampered slide still resolves through the document.
  const documented = await read(modify(exportedA, entries => retag(entries, value => { value.layoutRecord.id = 'other'; })));
  assert.deepEqual(documented.provenance, [['invalid-document-provenance', 'slides.0.layoutRecord']]);
  assert.equal(documented.deck.slides[0].layout, 'gallery-hero');
  assert.deepEqual(documented.deck.catalogs, {layouts: {records: [heroA]}});
  const malformed = await read(modify(exportedA, entries => { stripDocument(entries); retag(entries, value => { value.layoutRecord = 'gallery-hero'; }); }));
  assert.deepEqual(malformed.provenance, [['invalid-document-provenance', 'slides.0']]);
  assert.equal(malformed.deck.slides[0].layout, undefined);
  assert.equal(malformed.deck.slides[1].layout, 'title-subtitle');
  const moved = await read(modify(exportedA, entries => { stripDocument(entries); text(entries, 'ppt/slides/slide1.xml', xml => xml.replace(/(<p:sp>[\s\S]*?<a:off x=")(\d+)"/, (_, before, x) => `${before}${Number(x) + 12700}"`)); }));
  assert.deepEqual(moved.provenance, [['layout-reference-changed', 'slides.0.layout'], ['slide-reference-changed', 'slides.0.composition'],
    ['design-reference-changed', 'slides.0.design.titleAlignment'], ['design-reference-changed', 'slides.0.design.contentBox']]);
  assert.deepEqual(moved.deck.slides.map(slide => slide.layout), [undefined, 'title-subtitle']);
  assert.equal(moved.deck.catalogs, undefined);
  cases++;
}

// Catalog objects are not checked by validatePresentation. Untrusted slide and
// document records must pass the companion layout schema before restoration.
{
  const retag = (entries, part, mutate) => text(entries, part, xml => {
    const value = tagValue(enc.encode(xml));
    mutate(value);
    return xml.replace(/val="[0-9A-F]+"/, `val="${Buffer.from(JSON.stringify(value)).toString('hex').toUpperCase()}"`);
  });
  const malformedRecords = [
    {id: 'gallery-hero', placeholders: [null]},
    {...structuredClone(heroA), placeholders: [{type: 'not-a-placeholder'}]},
    {...structuredClone(heroA), $schema: 'https://example.com/untrusted-layout'}
  ];
  for (const record of malformedRecords) {
    assert.equal(validateCatalogRecord('layouts', record).valid, false);
    // This deliberately passes the presentation schema: it is the regression.
    assert.equal(validatePresentation({...deckA, catalogs: {layouts: {records: [record]}}}).valid, true);
    const corruptSlide = entries => retag(entries, 'ppt/tags/opfSlide1.xml', value => { value.layoutRecord = record; });
    const corruptDocument = entries => retag(entries, 'ppt/tags/opfDocument.xml', value => { value.catalogs.layouts.records[0] = record; });
    const standalone = await read(modify(exportedA, entries => { stripDocument(entries); corruptSlide(entries); }));
    assert.deepEqual(standalone.provenance, [['invalid-document-provenance', 'slides.0.layoutRecord'], ['unresolved-layout-reference', 'slides.0.layout']]);
    assert.equal(standalone.deck.slides[0].layout, undefined);
    assert.equal(standalone.deck.slides[0].title, 'Hello');
    assert.equal(standalone.deck.slides[0].subtitle, 'World');
    assert.equal(standalone.deck.slides[0].composition.mode, 'column');
    assert.equal(standalone.deck.catalogs, undefined);
    // A valid document record still supplies the layout when only the slide copy is invalid.
    const documented = await read(modify(exportedA, corruptSlide));
    assert.deepEqual(documented.provenance, [['invalid-document-provenance', 'slides.0.layoutRecord']]);
    assert.equal(documented.deck.slides[0].layout, 'gallery-hero');
    assert.deepEqual(documented.deck.catalogs, {layouts: {records: [heroA]}});
    // Conversely, a valid slide copy can replace an invalid document copy.
    const recovered = await read(modify(exportedA, corruptDocument));
    assert.deepEqual(recovered.provenance, [['invalid-document-provenance', 'catalogs.layouts.records.0']]);
    assert.equal(recovered.deck.slides[0].layout, 'gallery-hero');
    assert.deepEqual(recovered.deck.catalogs, {layouts: {records: [heroA]}});
    // Neither invalid copy is retained; native content and other slides survive.
    const both = await read(modify(exportedA, entries => { corruptDocument(entries); corruptSlide(entries); }));
    assert.deepEqual(both.provenance, [['invalid-document-provenance', 'catalogs.layouts.records.0'],
      ['invalid-document-provenance', 'slides.0.layoutRecord'], ['unresolved-layout-reference', 'slides.0.layout']]);
    assert.deepEqual(both.deck.slides.map(slide => slide.layout), [undefined, 'title-subtitle']);
    assert.equal(both.deck.slides[0].title, 'Hello');
    assert.equal(both.deck.slides[0].subtitle, 'World');
    assert.equal(both.deck.catalogs, undefined);
  }
  cases++;
}

// Decks exported before FF-29 carry no layoutRecord on their slides.
{
  const legacy = entries => { for (const index of [1, 2]) text(entries, `ppt/tags/opfSlide${index}.xml`, xml => {
    const value = JSON.parse(Buffer.from(xml.match(/\bval="([^"]+)"/)[1], 'hex').toString('utf8'));
    delete value.layoutRecord;
    return xml.replace(/val="[0-9A-F]+"/, `val="${Buffer.from(JSON.stringify(value)).toString('hex').toUpperCase()}"`);
  }); };
  const withDocument = await read(modify(exportedA, legacy));
  assert.deepEqual(withDocument.provenance, []);
  assert.deepEqual(withDocument.deck.slides.map(slide => slide.layout), ['gallery-hero', 'title-subtitle']);
  assert.deepEqual(withDocument.deck.catalogs, {layouts: {records: [heroA]}});
  // Without the document tag the inline-only id has no record anywhere: it is reported, not restored; bundled ids still return.
  const stripped = await read(modify(exportedA, entries => { legacy(entries); stripDocument(entries); }));
  assert.deepEqual(stripped.provenance, [['unresolved-layout-reference', 'slides.0.layout']]);
  assert.deepEqual(stripped.deck.slides.map(slide => slide.layout), [undefined, 'title-subtitle']);
  assert.equal(stripped.deck.catalogs, undefined);
  assert.equal(stripped.deck.slides[0].composition?.mode, 'column');
  cases++;
}

// A slide record that overrides a built-in layout id never changes other slides' layouts.
{
  const override = {...structuredClone(base), name: 'Overridden title-subtitle', placeholders: [{type: 'title'}]};
  const deckC = {$schema: 'https://openpresentation.org/schema/opf/v1', name: 'Deck C', catalogs: {layouts: {records: [override]}},
    slides: [{layout: 'title-subtitle', title: 'Override one', subtitle: 'C'}, {layout: 'title-subtitle', title: 'Override two', subtitle: 'C'}]};
  assert.equal(validatePresentation(deckC).valid, true);
  const exportedC = await toPptx(structuredClone(deckC));
  assert.deepEqual(tagValue(unzipSync(exportedC)['ppt/tags/opfSlide1.xml']).layoutRecord, override);
  // Pasted into deck A, whose slide 2 uses the built-in title-subtitle.
  const pasted = await read(paste(exportedA, exportedC, 1));
  assert.deepEqual(pasted.deck.slides.map(slide => slide.layout), ['gallery-hero', 'title-subtitle', undefined]);
  assert.equal(pasted.deck.slides[2].title, 'Override one');
  assert.deepEqual(pasted.deck.catalogs, {layouts: {records: [heroA]}}, 'The override is not added to the host catalog.');
  assert.deepEqual(pasted.provenance, [['layout-reference-changed', 'slides.2.layout'], ['design-reference-changed', 'design.contentAlignment']]);
  const pastedStripped = await read(modify(paste(exportedA, exportedC, 1), stripDocument));
  assert.deepEqual(pastedStripped.deck.slides.map(slide => slide.layout), ['gallery-hero', 'title-subtitle', undefined]);
  assert.deepEqual(pastedStripped.deck.catalogs, {layouts: {records: [heroA]}});
  assert.deepEqual(pastedStripped.provenance, [['layout-reference-changed', 'slides.2.layout']]);
  // Deck C on its own: with its document the override is the document's record; without it, every slide agrees on it.
  for (const bytes of [exportedC, modify(exportedC, stripDocument)]) {
    const own = await read(bytes);
    assert.deepEqual(own.provenance, []);
    assert.deepEqual(own.deck.slides.map(slide => slide.layout), ['title-subtitle', 'title-subtitle']);
    assert.deepEqual(own.deck.catalogs, {layouts: {records: [override]}});
  }
  // If its document copy is invalid, agreeing valid slide copies still restore
  // this deliberate override; they never override a host's valid record.
  const damagedDocument = await read(modify(exportedC, entries => text(entries, 'ppt/tags/opfDocument.xml', xml => {
    const value = tagValue(enc.encode(xml));
    value.catalogs.layouts.records[0] = {id: 'title-subtitle', placeholders: [null]};
    return xml.replace(/val="[0-9A-F]+"/, `val="${Buffer.from(JSON.stringify(value)).toString('hex').toUpperCase()}"`);
  })));
  assert.deepEqual(damagedDocument.provenance, [['invalid-document-provenance', 'catalogs.layouts.records.0']]);
  assert.deepEqual(damagedDocument.deck.slides.map(slide => slide.layout), ['title-subtitle', 'title-subtitle']);
  assert.deepEqual(damagedDocument.deck.catalogs, {layouts: {records: [override]}});
  cases++;
}

// Privacy: layout records never pull asset registry entries into the tags; references-only stores no source at all.
{
  const privateUrl = 'https://intranet.example.com/private/preview.png';
  const withPreview = {...structuredClone(heroA), preview: {src: 'asset:private-preview'}};
  const deckP = {...structuredClone(deckA), assets: {'private-preview': privateUrl}, catalogs: {layouts: {records: [withPreview]}}};
  assert.equal(validatePresentation(deckP).valid, true);
  const parse = xml => [...xml.matchAll(/ val="([0-9A-F]+)"/g)].map(match => JSON.parse(Buffer.from(match[1], 'hex').toString('utf8')));
  const tagsOf = async provenance => { const entries = unzipSync(await toPptx(structuredClone(deckP), {provenance})); return Object.keys(entries).filter(path => /^ppt\/tags\/opf(Document|Slide)/.test(path)).map(path => dec.decode(entries[path])); };
  for (const provenance of ['full', 'references-only']) {
    const parts = await tagsOf(provenance);
    assert.ok(parts.length > 0);
    assert.ok(!parts.some(xml => JSON.stringify(parse(xml)).includes('intranet.example.com')), `${provenance}: no asset URL in provenance tags`);
    assert.ok(!parts.some(xml => parse(xml).some(value => value.assets !== undefined)), `${provenance}: no assets stored for a layout record`);
  }
  const refs = await tagsOf('references-only');
  assert.ok(refs.flatMap(parse).filter(value => value.slide !== undefined).every(value => value.layoutRecord === undefined), 'references-only stores no slide layout record that names a source.');
  cases++;
}

console.log(`Layout intent passed: ${cases} groups; OPF_SLIDE_V1 carries the layout record, and import restores layout, type, composition, hints and records with and without document provenance, for pasted slides, conflicting records, tampering and edits.`);
