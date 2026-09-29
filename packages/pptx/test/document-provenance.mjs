import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {unzipSync, zipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {XMLParser} from 'fast-xml-parser';
import {toPptx, fromPptx} from '../dist/index.js';
import {restoreDocumentProvenance} from '../dist/document-provenance.js';
import {validatePresentation, catalogs} from '@openpresentation/opf';

// FF-32: catalog references, slide layout ids and authoring metadata survive
// export -> import while the native evidence they produced is unchanged, and a
// specific diagnostic replaces a silent loss after an edit.
const enc = new TextEncoder(), dec = new TextDecoder();
const png = await readFile(new URL('fixtures/images/wide.png', import.meta.url));
const pngUri = `data:image/png;base64,${png.toString('base64')}`;
const logo = 'https://example.com/acme-logo.png';
const layoutRecord = {...structuredClone(catalogs.layouts.find(record => record.id === 'title-subtitle')), id: 'hero-title', name: 'Hero Title'};
const unused = {...structuredClone(layoutRecord), id: 'never-used'};
const source = {
  $schema: 'https://openpresentation.org/schema/opf/v1', name: 'Provenance deck',
  organization: [{id: 'acme', name: 'Acme', role: 'primary', logo: 'asset:acme-logo'}, {id: 'beta', name: 'Beta', role: 'partner'}],
  speaker: {id: 'alice', name: 'Alice Chen', title: 'VP', organizationId: 'acme'},
  audience: ['executives', {id: 'board', name: 'Board of directors'}], purpose: 'decide', language: 'japanese', tone: 'formal',
  narrative: 'problem-solution', takeaway: ['Ship it'], duration: 20, tags: ['gallery:test'],
  variables: {risk: '#C0392B'},
  assets: {'acme-logo': {src: logo, alt: 'Acme logo'}, unrelated: 'https://example.com/unused.png'},
  design: {theme: 'bold', colorScheme: 'boost', fontScheme: 'arial', dimensions: {preset: '16:9'}, background: {type: 'solid', color: '#FAFAFA'},
    contentAlignment: 'center'},
  catalogs: {layouts: {records: [layoutRecord, unused]}},
  slides: [
    {id: 'intro', beat: 'problem', layout: 'hero-title', title: 'Hello', subtitle: 'World', design: {titleAlignment: 'center', contentBox: false}},
    {id: 'body', layout: 'title-subtitle', title: 'Second', subtitle: 'Slide', design: {background: {type: 'solid', color: '#102030'}}},
    {layout: 'title-subtitle', title: 'Third', subtitle: 'Inherits'}
  ]
};
assert.equal(validatePresentation(source).valid, true, JSON.stringify(validatePresentation(source).errors));

const exported = await toPptx(structuredClone(source));
assert.deepEqual(await toPptx(structuredClone(source)), exported, 'Export stays deterministic.');
const read = async bytes => {
  const issues = [];
  const deck = await fromPptx(bytes, {onDiagnostic: issue => issues.push(issue)});
  assert.equal(validatePresentation(deck).valid, true);
  return {deck, issues, provenance: issues.filter(issue => /provenance|reference|slide-id/.test(issue.code))};
};
const modify = (bytes, mutate) => { const entries = unzipSync(bytes); mutate(entries); return zipSync(entries); };
const text = (entries, path, mutate) => { entries[path] = enc.encode(mutate(dec.decode(entries[path]))); };
const tagValue = xml => JSON.parse(Buffer.from(xml.match(/\bval="([^"]+)"/)[1], 'hex').toString('utf8'));

// Package shape: standard customer-data tags, schema-ordered, typed, related.
{
  const entries = unzipSync(exported);
  const presentation = dec.decode(entries['ppt/presentation.xml']);
  assert.equal(XMLValidator.validate(presentation), true);
  assert.match(presentation, /<p:notesSz [^>]*\/><p:custDataLst><p:tags r:id="rIdOpfDocument"\/><\/p:custDataLst><p:defaultTextStyle>/);
  assert.match(dec.decode(entries['ppt/_rels/presentation.xml.rels']), /Id="rIdOpfDocument" Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/tags" Target="tags\/opfDocument\.xml"/);
  const types = dec.decode(entries['[Content_Types].xml']);
  for (const part of ['opfDocument', 'opfSlide1', 'opfSlide2', 'opfSlide3']) {
    assert.ok(types.includes(`<Override PartName="/ppt/tags/${part}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tags+xml"/>`), part);
    assert.equal(XMLValidator.validate(dec.decode(entries[`ppt/tags/${part}.xml`])), true);
  }
  const documentXml = dec.decode(entries['ppt/tags/opfDocument.xml']);
  assert.match(documentXml, /<p:tag name="OPF_DOCUMENT_V1" val="[0-9A-F]+"\/>/);
  const document = tagValue(documentXml);
  assert.deepEqual(document.design, source.design);
  assert.deepEqual(Object.keys(document.metadata).sort(), ['audience', 'duration', 'language', 'narrative', 'organization', 'purpose', 'speaker', 'tags', 'takeaway', 'tone', 'variables']);
  assert.deepEqual(Object.keys(document.assets), ['acme-logo'], 'Only assets referenced by metadata are stored.');
  assert.deepEqual(document.catalogs.layouts.records.map(record => record.id), ['hero-title'], 'Only referenced inline records are stored.');
  assert.equal(document.native.size.cx, '12192000');
  assert.deepEqual(Object.keys(document.native.colors), ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink']);
  assert.equal(document.native.fonts.major.latin, 'Arial Black');
  const slide = dec.decode(entries['ppt/slides/slide1.xml']);
  assert.match(slide, /<\/p:spTree><p:custDataLst><p:tags r:id="rIdOpfSlide"\/><\/p:custDataLst><\/p:cSld>/);
  const record = tagValue(dec.decode(entries['ppt/tags/opfSlide1.xml']));
  assert.deepEqual({id: record.id, beat: record.beat, layout: record.layout, design: record.design}, {id: 'intro', beat: 'problem', layout: 'hero-title', design: {titleAlignment: 'center', contentBox: false}});
  for (const key of ['structure', 'background', 'style']) assert.match(record.native[key], /^[0-9a-f]{14}$/);
  // Tags carry no typeface attribute, so package font inventories are unchanged.
  for (const part of Object.keys(entries).filter(path => path.startsWith('ppt/tags/'))) assert.doesNotMatch(dec.decode(entries[part]), /typeface=/);
}

// Unchanged package: every reference and metadata value returns.
{
  const {deck, provenance} = await read(exported);
  assert.deepEqual(provenance, []);
  assert.deepEqual(deck.design, source.design);
  for (const key of ['organization', 'speaker', 'audience', 'purpose', 'language', 'tone', 'narrative', 'takeaway', 'duration', 'tags', 'variables']) assert.deepEqual(deck[key], source[key], key);
  assert.deepEqual(deck.assets, {'acme-logo': source.assets['acme-logo']});
  assert.deepEqual(deck.catalogs, {layouts: {records: [layoutRecord]}});
  assert.deepEqual(deck.slides.map(slide => [slide.id, slide.beat, slide.layout]), [['intro', 'problem', 'hero-title'], ['body', undefined, 'title-subtitle'], [undefined, undefined, 'title-subtitle']]);
  assert.deepEqual(deck.slides.map(slide => slide.design), [{titleAlignment: 'center', contentBox: false}, {background: {type: 'solid', color: '#102030'}}, undefined],
    'Inherited backgrounds are not repeated as slide overrides; local ones return as authored.');
  // The reimported document exports again and keeps its references.
  const again = await read(await toPptx(deck));
  assert.deepEqual(again.provenance, []);
  assert.deepEqual(again.deck.design, source.design);
  assert.deepEqual(again.deck.slides.map(slide => slide.layout), ['hero-title', 'title-subtitle', 'title-subtitle']);
}

// Benign rewrites an editor performs on save do not count as edits.
{
  const rewritten = modify(exported, entries => {
    text(entries, 'ppt/theme/theme1.xml', xml => xml.replace(/lastClr="[0-9A-F]{6}"/g, 'lastClr="123456"'));
    for (const index of [1, 2, 3]) text(entries, `ppt/slides/slide${index}.xml`, xml => xml.replace(/<a:srgbClr val="([0-9A-F]{6})"><\/a:srgbClr>/g, '<a:srgbClr val="$1"/>')
      .replace(/(<p:sp>[\s\S]*?<\/p:sp>)(<p:sp>[\s\S]*?<\/p:sp>)/, '$2$1'));
  });
  const {deck, provenance} = await read(rewritten);
  assert.deepEqual(provenance, [], 'System color refresh, empty-element form and stacking order are not structural edits.');
  assert.deepEqual(deck.design, source.design);
}

// Theme colors changed: the color scheme and the theme bundle stay observed.
{
  const {deck, provenance} = await read(modify(exported, entries => text(entries, 'ppt/theme/theme1.xml', xml => xml.replace(/<a:accent1>[\s\S]*?<\/a:accent1>/, '<a:accent1><a:srgbClr val="00FF00"/></a:accent1>'))));
  // Stored references win only while the theme matches; FF-24's recovered scheme is the observed fallback.
  assert.deepEqual(deck.design.colorScheme, {id: 'boost', accent1: '#00FF00'});
  assert.notEqual(deck.design.theme, 'bold');
  assert.equal(deck.design.fontScheme, 'arial');
  assert.deepEqual(provenance.map(issue => [issue.code, issue.path]), [['design-reference-changed', 'design.theme'], ['design-reference-changed', 'design.colorScheme']]);
  assert.match(provenance[1].message, /accent1/);
  assert.match(provenance[1].message, /'boost'/);
}

// Theme fonts changed: the font scheme stays observed.
{
  const {deck, provenance} = await read(modify(exported, entries => text(entries, 'ppt/theme/theme1.xml', xml => xml.replace(/(<a:majorFont><a:latin typeface=")[^"]*"/, '$1Georgia"'))));
  assert.notEqual(deck.design.fontScheme, 'arial');
  assert.equal(deck.design.colorScheme, 'boost');
  assert.deepEqual(provenance.map(issue => [issue.code, issue.path]), [['design-reference-changed', 'design.theme'], ['design-reference-changed', 'design.fontScheme']]);
  assert.match(provenance[1].message, /major font/);
}

// Slide size changed: observed dimensions stay.
{
  const {deck, provenance} = await read(modify(exported, entries => text(entries, 'ppt/presentation.xml', xml => xml.replace('<p:sldSz cx="12192000" cy="6858000"/>', '<p:sldSz cx="9144000" cy="6858000"/>'))));
  assert.deepEqual(deck.design.dimensions, {widthInches: 10, heightInches: 7.5});
  assert.deepEqual(provenance.map(issue => [issue.code, issue.path]), [['design-reference-changed', 'design.dimensions']]);
}

// A moved object changes that slide's layout structure only.
{
  const {deck, provenance} = await read(modify(exported, entries => text(entries, 'ppt/slides/slide1.xml', xml => xml.replace(/(<p:sp>[\s\S]*?<a:off x=")(\d+)"/, (_, before, x) => `${before}${Number(x) + 12700}"`))));
  assert.deepEqual(deck.slides.map(slide => slide.layout), [undefined, 'title-subtitle', 'title-subtitle']);
  assert.equal(deck.slides[0].id, 'intro', 'Identity and beat do not depend on arrangement.');
  assert.equal(deck.slides[0].beat, 'problem');
  assert.equal(deck.design.contentAlignment, undefined, 'Deck composition defaults need every slide unchanged.');
  assert.deepEqual(provenance.map(issue => [issue.code, issue.path]), [
    ['layout-reference-changed', 'slides.0.layout'], ['design-reference-changed', 'slides.0.design.titleAlignment'],
    ['design-reference-changed', 'slides.0.design.contentBox'], ['design-reference-changed', 'design.contentAlignment']]);
  assert.deepEqual(deck.catalogs, undefined, 'An unrestored layout id does not keep its inline record.');
}

// Background edits: an edited inheriting slide keeps a local override; editing
// every inheriting slide leaves the deck background unrestored.
{
  const recolor = (entries, index) => text(entries, `ppt/slides/slide${index}.xml`, xml => xml.replace(/<p:bg>[\s\S]*?<\/p:bg>/, '<p:bg><p:bgPr><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>'));
  const one = await read(modify(exported, entries => recolor(entries, 1)));
  assert.deepEqual(one.deck.design.background, source.design.background);
  assert.deepEqual(one.deck.slides[0].design.background, {type: 'solid', color: '#FF0000'});
  assert.equal(one.deck.slides[2].design, undefined);
  assert.deepEqual(one.provenance.map(issue => [issue.code, issue.path]), [['design-reference-changed', 'slides.0.design.background']]);
  const all = await read(modify(exported, entries => { recolor(entries, 1); recolor(entries, 3); recolor(entries, 2); }));
  assert.equal(all.deck.design.background, undefined);
  assert.deepEqual(all.deck.slides.map(slide => slide.design?.background?.color), ['#FF0000', '#FF0000', '#FF0000']);
  assert.deepEqual(all.provenance.map(issue => [issue.code, issue.path]), [['design-reference-changed', 'slides.1.design.background'], ['design-reference-changed', 'design.background']]);
}

// Duplicated slide (PowerPoint copies slide tags): layout returns, the id stays unique.
{
  const duplicated = modify(exported, entries => {
    entries['ppt/slides/slide4.xml'] = entries['ppt/slides/slide1.xml'];
    entries['ppt/slides/_rels/slide4.xml.rels'] = enc.encode(dec.decode(entries['ppt/slides/_rels/slide1.xml.rels']).replace(/opfSlide1\.xml/, 'opfSlide4.xml').replace(/notesSlide1\.xml/, 'notesSlide1.xml'));
    entries['ppt/tags/opfSlide4.xml'] = entries['ppt/tags/opfSlide1.xml'];
    text(entries, '[Content_Types].xml', xml => xml.replace('</Types>', '<Override PartName="/ppt/slides/slide4.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/tags/opfSlide4.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tags+xml"/></Types>'));
    text(entries, 'ppt/_rels/presentation.xml.rels', xml => xml.replace('</Relationships>', '<Relationship Id="rIdCopy" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide4.xml"/></Relationships>'));
    text(entries, 'ppt/presentation.xml', xml => xml.replace('</p:sldIdLst>', '<p:sldId id="400" r:id="rIdCopy"/></p:sldIdLst>'));
  });
  const {deck, provenance} = await read(duplicated);
  assert.deepEqual(deck.slides.map(slide => [slide.id, slide.layout]), [['intro', 'hero-title'], ['body', 'title-subtitle'], [undefined, 'title-subtitle'], [undefined, 'hero-title']]);
  assert.deepEqual(provenance.map(issue => [issue.code, issue.path]), [['duplicate-slide-id', 'slides.3.id'], ['design-reference-changed', 'design.contentAlignment']]);
}

// Stripped tags are an ordinary foreign deck; damaged or invalid ones fall back with a diagnostic.
{
  // Without the document tag, deck references, metadata and slide ids are gone,
  // but each slide tag still restores its layout intent and inline layout record (FF-29).
  const stripped = await read(modify(exported, entries => text(entries, 'ppt/presentation.xml', xml => xml.replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/, ''))));
  assert.deepEqual(stripped.provenance, []);
  assert.equal(stripped.deck.narrative, undefined);
  assert.deepEqual(stripped.deck.slides.map(slide => [slide.id, slide.layout]), [[undefined, 'hero-title'], [undefined, 'title-subtitle'], [undefined, 'title-subtitle']]);
  assert.deepEqual([stripped.deck.slides[0].design.titleAlignment, stripped.deck.slides[0].design.contentBox], ['center', false]);
  assert.deepEqual(stripped.deck.catalogs, {layouts: {records: [layoutRecord]}});
  // With no customer data at all it is an ordinary foreign deck.
  const foreign = await read(modify(exported, entries => {
    for (const path of Object.keys(entries).filter(path => /^ppt\/(presentation|slides\/slide\d+)\.xml$/.test(path))) text(entries, path, xml => xml.replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g, ''));
  }));
  assert.deepEqual(foreign.provenance, []);
  assert.equal(foreign.deck.slides[0].layout, undefined);
  assert.equal(foreign.deck.catalogs, undefined);

  const damaged = await read(modify(exported, entries => text(entries, 'ppt/tags/opfDocument.xml', xml => xml.replace(/val="[0-9A-F]{8}/, 'val="ZZZZZZZZ'))));
  assert.deepEqual(damaged.provenance.map(issue => [issue.code, issue.path]), [['invalid-document-provenance', '']]);
  assert.equal(damaged.deck.narrative, undefined);

  const invalid = await read(modify(exported, entries => text(entries, 'ppt/tags/opfDocument.xml', xml => {
    const value = tagValue(xml);
    value.metadata.duration = -5;
    return xml.replace(/val="[0-9A-F]+"/, `val="${Buffer.from(JSON.stringify(value)).toString('hex').toUpperCase()}"`);
  })));
  // Only the invalid field is dropped; every other restore still applies.
  assert.deepEqual(invalid.provenance.map(issue => [issue.code, issue.path]), [['invalid-document-provenance', 'duration']]);
  assert.equal(invalid.deck.duration, undefined);
  assert.equal(invalid.deck.narrative, 'problem-solution');
  assert.deepEqual(invalid.deck.design, source.design);
  assert.equal(invalid.deck.slides[0].layout, 'hero-title');
  const invalidSlide = await read(modify(exported, entries => text(entries, 'ppt/tags/opfSlide1.xml', xml => {
    const value = tagValue(xml);
    value.layout = 42;
    return xml.replace(/val="[0-9A-F]+"/, `val="${Buffer.from(JSON.stringify(value)).toString('hex').toUpperCase()}"`);
  })));
  assert.deepEqual(invalidSlide.provenance.map(issue => [issue.code, issue.path]), [['invalid-document-provenance', 'slides.0.layout']]);
  assert.equal(invalidSlide.deck.slides[0].layout, undefined);
  assert.equal(invalidSlide.deck.slides[0].id, 'intro');
  assert.equal(invalidSlide.deck.narrative, 'problem-solution');

  const unknown = await read(modify(exported, entries => text(entries, 'ppt/tags/opfDocument.xml', xml => {
    const value = tagValue(xml);
    value.metadata.script = 'x';
    const json = JSON.stringify(value).replace('"script":"x"', '"__proto__":{"polluted":true}');
    return xml.replace(/val="[0-9A-F]+"/, `val="${Buffer.from(json).toString('hex').toUpperCase()}"`);
  })));
  assert.deepEqual(unknown.provenance.map(issue => issue.code), ['invalid-document-provenance']);
  assert.equal({}.polluted, undefined);
}

// Furniture already owns a slide tag list; both records share it.
{
  const deck = {name: 'Footer deck', organization: {id: 'acme', name: 'Acme'}, design: {fontScheme: 'arial', footer: {left: {organization: true}, right: {slideNumber: true}}},
    slides: [{layout: 'title-subtitle', title: 'One', subtitle: 'Two'}]};
  const bytes = await toPptx(deck);
  const entries = unzipSync(bytes);
  const tags = dec.decode(entries['ppt/tags/opfFurnitureSlide0.xml']);
  assert.match(tags, /<p:tag name="OPF_FURNITURE_V1" val="[0-9A-F]+"\/><p:tag name="OPF_SLIDE_V1" val="[0-9A-F]+"\/><\/p:tagLst>/);
  assert.equal(entries['ppt/tags/opfSlide1.xml'], undefined);
  assert.match(dec.decode(entries['ppt/slides/slide1.xml']), /<\/p:spTree><p:custDataLst><p:tags r:id="rIdOpfFurnitureSlide"\/><\/p:custDataLst><\/p:cSld>/, 'One slide-level tag list.');
  const {deck: imported, issues} = await read(bytes);
  assert.equal(issues.some(issue => issue.code === 'invalid-furniture-provenance'), false);
  assert.deepEqual(imported.design.footer, deck.design.footer);
  assert.deepEqual(imported.organization, deck.organization);
  assert.equal(imported.slides[0].layout, 'title-subtitle');
  // The current organization name shown in the footer wins over the stored one.
  const renamed = await read(modify(bytes, entries => text(entries, 'ppt/slides/slide1.xml', xml => xml.replace('>Acme<', '>Acme Corp<'))));
  assert.deepEqual(renamed.deck.organization, {id: 'acme', name: 'Acme Corp'});
}

// Documents that state nothing keep their package unchanged; oversized metadata is reported, not stored.
{
  const plain = unzipSync(await toPptx({name: 'Plain', slides: [{title: 'Only text'}]}));
  assert.equal(Object.keys(plain).some(path => /opfDocument|opfSlide/.test(path)), false);
  assert.doesNotMatch(dec.decode(plain['ppt/presentation.xml']), /custDataLst/);
  const issues = [];
  const bytes = await toPptx({name: 'Large', speaker: {id: 'bio', name: 'Long', bio: 'x'.repeat(300 * 1024)}, tone: 'formal', slides: [{title: 'One'}]}, {onDiagnostic: issue => issues.push(issue)});
  assert.deepEqual(issues.filter(issue => issue.code === 'document-provenance-omitted').map(issue => issue.path), ['speaker']);
  const {deck} = await read(bytes);
  assert.equal(deck.speaker, undefined);
  assert.equal(deck.tone, 'formal');
}

// Asset-backed backgrounds: the tag references the exported media part instead
// of copying the bytes, and the restored asset re-exports the same picture.
{
  const deck = {name: 'Asset background', assets: {bg: {src: pngUri, alt: 'Backdrop'}}, design: {fontScheme: 'arial', background: {type: 'image', image: {src: 'asset:bg'}}},
    slides: [{layout: 'title-subtitle', title: 'One', subtitle: 'Two'}, {layout: 'title-subtitle', title: 'Three', subtitle: 'Four'}]};
  const bytes = await toPptx(deck);
  const entries = unzipSync(bytes);
  const documentXml = dec.decode(entries['ppt/tags/opfDocument.xml']);
  const stored = tagValue(documentXml);
  assert.deepEqual(stored.design.background, deck.design.background);
  assert.match(stored.assets.bg.src.$opfMedia, /^ppt\/media\/[^/]+$/);
  assert.deepEqual(entries[stored.assets.bg.src.$opfMedia], new Uint8Array(png), 'The referenced media part holds the asset bytes.');
  assert.ok(!JSON.stringify(stored).includes(png.toString('base64').slice(0, 40)), 'No embedded bytes in the tag.');
  assert.ok(documentXml.length < 8192);
  const {deck: imported, provenance} = await read(bytes);
  assert.deepEqual(provenance, []);
  assert.deepEqual(imported.design.background, deck.design.background);
  assert.deepEqual(imported.assets, {bg: {src: pngUri, alt: 'Backdrop'}});
  assert.deepEqual(imported.slides.map(slide => slide.design), [undefined, undefined]);
  const again = unzipSync(await toPptx(imported));
  assert.match(dec.decode(again['ppt/slides/slide1.xml']), /<p:bg><p:bgPr><a:blipFill/, 'Re-export keeps the picture background.');
  // A media reference that no longer resolves never restores a bare asset reference.
  const broken = await read(modify(bytes, parts => text(parts, 'ppt/tags/opfDocument.xml', xml => {
    const value = tagValue(xml);
    value.assets.bg.src.$opfMedia = 'ppt/media/missing.png';
    return xml.replace(/val="[0-9A-F]+"/, `val="${Buffer.from(JSON.stringify(value)).toString('hex').toUpperCase()}"`);
  })));
  assert.deepEqual(broken.provenance.map(issue => [issue.code, issue.path]), [['unresolved-asset-reference', 'design.background']]);
  assert.equal(broken.deck.design.background, undefined);
  assert.equal(broken.deck.assets, undefined);
  assert.equal(broken.deck.slides[0].design.background.type, 'image', 'The observed native picture stays.');
  assert.match(dec.decode(unzipSync(await toPptx(broken.deck))['ppt/slides/slide1.xml']), /<p:bg><p:bgPr><a:blipFill/, 'Re-export is not a white slide.');
  // An embedded source that is not an exported media part is never copied into a tag.
  const report = [];
  const unused = await toPptx({name: 'Logo', organization: {id: 'acme', name: 'Acme', logo: 'asset:logo'}, assets: {logo: pngUri}, tone: 'formal', slides: [{title: 'One'}]}, {onDiagnostic: issue => report.push(issue)});
  assert.deepEqual(report.filter(issue => issue.code === 'document-provenance-omitted').map(issue => issue.path), ['assets.logo']);
  const logoImport = await read(unused);
  assert.deepEqual(logoImport.deck.organization, {id: 'acme', name: 'Acme'}, 'The dangling logo reference is left out.');
  assert.deepEqual(logoImport.provenance.map(issue => [issue.code, issue.path]), [['document-provenance-omitted', 'assets.logo'], ['unresolved-asset-reference', 'organization.logo']]);
  assert.equal(logoImport.deck.tone, 'formal');
}

// Size limits: oversized design and slide values are reported and recorded as
// omitted; import then keeps observed values instead of treating them as unstated.
{
  const issues = [];
  const bytes = await toPptx({name: 'Sizes', design: {fontScheme: 'arial', colorScheme: {id: 'boost', name: 'x'.repeat(300 * 1024)}},
    slides: [{layout: 'title-subtitle', beat: ['y'.repeat(300 * 1024)], title: 'One', subtitle: 'Two'}]}, {onDiagnostic: issue => issues.push(issue)});
  assert.deepEqual(issues.filter(issue => issue.code === 'document-provenance-omitted').map(issue => issue.path), ['design.colorScheme', 'slides.0.beat']);
  const entries = unzipSync(bytes);
  assert.deepEqual(tagValue(dec.decode(entries['ppt/tags/opfDocument.xml'])).omitted, ['design.colorScheme']);
  assert.deepEqual(tagValue(dec.decode(entries['ppt/tags/opfSlide1.xml'])).omitted, ['beat']);
  const {deck, provenance} = await read(bytes);
  assert.deepEqual(provenance.map(issue => [issue.code, issue.path]), [['document-provenance-omitted', 'design.colorScheme'], ['document-provenance-omitted', 'slides.0.beat']]);
  assert.equal(deck.design.fontScheme, 'arial');
  assert.equal(deck.slides[0].layout, 'title-subtitle');
  // Many referenced assets would exceed the import limit: they are shed with a warning, never silently.
  const many = Object.fromEntries(Array.from({length: 48}, (_, index) => [`a${index}`, `https://example.com/${'z'.repeat(200 * 1024)}/${index}.png`]));
  const shedIssues = [];
  const shed = await toPptx({name: 'Many', tags: Object.keys(many).map(id => `asset:${id}`), assets: many, slides: [{title: 'One'}]}, {onDiagnostic: issue => shedIssues.push(issue)});
  assert.deepEqual(shedIssues.filter(issue => issue.code === 'document-provenance-omitted').map(issue => issue.path), ['assets']);
  assert.equal(tagValue(dec.decode(unzipSync(shed)['ppt/tags/opfDocument.xml'])).metadata.tags.length, 48);
  const shedImport = await read(shed);
  assert.deepEqual(shedImport.deck.tags, [], 'Every tag referred to an unavailable asset and was pruned.');
}

// Provenance modes: false writes nothing; 'references-only' keeps catalog references and no personal metadata.
{
  const none = unzipSync(await toPptx(structuredClone(source), {provenance: false}));
  assert.equal(Object.keys(none).some(path => /opfDocument|opfSlide/.test(path)), false);
  assert.doesNotMatch(dec.decode(none['ppt/presentation.xml']), /custDataLst/);
  const refs = unzipSync(await toPptx({...structuredClone(source), audience: ['executives', 'Series B investors']}, {provenance: 'references-only'}));
  const document = tagValue(dec.decode(refs['ppt/tags/opfDocument.xml']));
  assert.deepEqual(document.design, source.design);
  assert.deepEqual(document.metadata, {narrative: 'problem-solution', tone: 'formal', purpose: 'decide', language: 'japanese'});
  assert.equal(document.assets, undefined);
  assert.deepEqual(document.catalogs.layouts.records.map(record => record.id), ['hero-title']);
  const slide = tagValue(dec.decode(refs['ppt/tags/opfSlide1.xml']));
  assert.deepEqual({id: slide.id, beat: slide.beat, layout: slide.layout}, {id: undefined, beat: 'problem', layout: 'hero-title'});
  for (const secret of ['Alice', 'Acme', 'Ship it', 'Series B']) assert.ok(!JSON.stringify([document, slide]).includes(secret), secret);
  const imageOnly = unzipSync(await toPptx({slides: [{title: 'One', layout: 'title', design: {background: {type: 'image', image: {src: pngUri}}}}]}, {provenance: 'references-only'}));
  assert.equal(tagValue(dec.decode(imageOnly['ppt/tags/opfSlide1.xml'])).design, undefined, 'references-only stores no image sources');
  await assert.rejects(toPptx(structuredClone(source), {provenance: 'everything'}), {code: 'invalid-provenance-option'});
}

// Per-slide layout contract for layout-structure recovery (FF-29).
{
  const entries = unzipSync(exported);
  const xmlParser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
  const rels = part => {
    const map = new Map(), base = part.slice(0, part.lastIndexOf('/') + 1);
    for (const rel of [xmlParser.parse(dec.decode(entries[`${base}_rels/${part.slice(base.length)}.rels`])).Relationships.Relationship].flat()) {
      const path = rel.Target.startsWith('../') ? `ppt/${rel.Target.slice(3)}` : base + rel.Target;
      map.set(rel.Id, {type: rel.Type, targetMode: rel.TargetMode ?? 'Internal', path});
    }
    return map;
  };
  const presentationRoot = xmlParser.parse(dec.decode(entries['ppt/presentation.xml']))['p:presentation'];
  const paths = [1, 2, 3].map(index => `ppt/slides/slide${index}.xml`);
  const slides = paths.map(path => ({path, root: xmlParser.parse(dec.decode(entries[path]))['p:sld'], relationships: rels(path)}));
  const imported = {name: 'x', slides: [{}, {}, {}]};
  const before = structuredClone(imported);
  const result = restoreDocumentProvenance(imported, {entries, presentationRoot, presentationRels: rels('ppt/presentation.xml'), slides}, () => {});
  assert.deepEqual(imported, before, 'Reading provenance does not modify the document.');
  assert.deepEqual(result.slides.map(slide => [slide.layout, slide.structure]), [['hero-title', 'match'], ['title-subtitle', 'match'], ['title-subtitle', 'match']]);
  assert.deepEqual(result.slides[0].record.design, {titleAlignment: 'center', contentBox: false});
  assert.equal(result.slides[0].record.native, undefined);
  assert.deepEqual(result.slides[0].catalogRecord, layoutRecord);
  assert.equal(result.slides[1].catalogRecord, undefined, 'Bundled layouts need no stored record.');
}

console.log('Document provenance passed: package shape, full reference/metadata/layout round trip and re-export, benign rewrites, theme color/font, size, arrangement and background edits with specific diagnostics, duplicated slides, stripped/damaged/invalid tags and per-field fallback, shared furniture tag lists, asset-backed backgrounds via media parts, size limits and omitted-field records, provenance modes and the per-slide layout contract.');
