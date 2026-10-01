import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {XMLParser, XMLValidator} from 'fast-xml-parser';
import {toPptx, fromPptx} from '../dist/index.js';
import {DEFAULT_SECTION, nativeSections, readSectionList, sectionId, sectionRuns, writeSectionList} from '../dist/sections.js';

// Spec-gap closure P1: slide `section` labels become PowerPoint's native
// section list (p14:sectionLst in ppt/presentation.xml) and import reads it
// back; the list wins over the stored OPF_SLIDE_V1 value and over footer text.
const enc = new TextEncoder(), dec = new TextDecoder();
const EXPORT = {timestamp: '2026-01-01T00:00:00Z', seed: 1, date: '2026-09-30'};
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: false, parseTagValue: false, trimValues: false});
const read = async (bytes, {filter = /section|provenance|reference/} = {}) => {
  const issues = [];
  const deck = await fromPptx(bytes, {onDiagnostic: issue => issues.push(issue)});
  return {deck, issues, provenance: issues.filter(issue => filter.test(issue.code))};
};
const modify = (bytes, mutate) => { const entries = unzipSync(bytes); mutate(entries); return zipSync(entries); };
const text = (entries, path, mutate) => { entries[path] = enc.encode(mutate(dec.decode(entries[path]))); };
const presentation = bytes => dec.decode(unzipSync(bytes)['ppt/presentation.xml']);
const sections = xml => [[parser.parse(xml)['p:presentation']['p:extLst']['p:ext']].flat().find(ext => ext['p14:sectionLst'])['p14:sectionLst']['p14:section']].flat()
  .map(section => ({name: section.name, id: section.id, slides: [section['p14:sldIdLst']['p14:sldId']].flat().map(slide => slide.id)}));
// Every tag stripped: the closest local stand-in for a deck not made by OPF.
const stripTags = bytes => modify(bytes, entries => {
  for (const path of Object.keys(entries)) {
    if (/^ppt\/tags\//.test(path)) { delete entries[path]; continue; }
    if (/\.xml$/.test(path) && !/Content_Types/.test(path)) text(entries, path, xml => xml.replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g, ''));
  }
});

const deck = {name: 'Sections', slides: [
  {title: 'One'}, {title: 'Two'}, {title: 'Three', section: 'Intro'}, {title: 'Four', section: 'Intro'}, {title: 'Five', section: 'R&D <2026> "plan"'}, {title: 'Six'}, {title: 'Seven', section: 'Close'}]};
const exported = await toPptx(structuredClone(deck), EXPORT);

// Package shape: one section per run, every slide covered, unsectioned runs
// named Default Section, deterministic ids, schema order kept with the
// provenance customer data (custDataLst before defaultTextStyle, extLst last).
{
  const xml = presentation(exported);
  assert.equal(XMLValidator.validate(xml), true);
  assert.match(xml, /<p:custDataLst><p:tags r:id="rIdOpfDocument"\/><\/p:custDataLst><p:defaultTextStyle>/);
  assert.match(xml, /<\/p:defaultTextStyle><p:extLst><p:ext uri="\{521415D9-36F7-43E2-AB2F-B90AF26B5E84\}"><p14:sectionLst xmlns:p14="http:\/\/schemas\.microsoft\.com\/office\/powerpoint\/2010\/main">[\s\S]*<\/p14:sectionLst><\/p:ext><\/p:extLst><\/p:presentation>$/);
  const list = sections(xml);
  assert.deepEqual(list.map(section => [section.name, section.slides]), [[DEFAULT_SECTION, ['256', '257']], ['Intro', ['258', '259']], ['R&D <2026> "plan"', ['260']], [DEFAULT_SECTION, ['261']], ['Close', ['262']]]);
  for (const section of list) assert.match(section.id, /^\{[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-8[0-9A-F]{3}-[0-9A-F]{12}\}$/);
  assert.equal(new Set(list.map(section => section.id)).size, list.length, 'Section ids are distinct, even for two Default Section runs.');
  assert.deepEqual(await toPptx(structuredClone(deck), EXPORT), exported, 'Export stays deterministic.');
  // The list is native data: written without provenance too.
  const plain = presentation(await toPptx(structuredClone(deck), {...EXPORT, provenance: false}));
  assert.doesNotMatch(plain, /custDataLst/);
  assert.deepEqual(sections(plain).map(section => section.name), list.map(section => section.name));
  // No sections, no list: the presentation part is unchanged.
  assert.doesNotMatch(presentation(await toPptx({name: 'None', slides: [{title: 'One'}, {title: 'Two'}]}, EXPORT)), /sectionLst|extLst/);
}

// Import: the native list restores every section; Default Section means none;
// a deck without tags still gets its sections; without a list the stored
// slide value is the fallback.
{
  const expected = [undefined, undefined, 'Intro', 'Intro', 'R&D <2026> "plan"', undefined, 'Close'];
  const own = await read(exported);
  assert.deepEqual(own.provenance, []);
  assert.deepEqual(own.deck.slides.map(slide => slide.section), expected);
  const foreign = await read(stripTags(exported));
  assert.deepEqual(foreign.provenance, []);
  assert.deepEqual(foreign.deck.slides.map(slide => slide.section), expected, 'Sections are native PowerPoint data.');
  const noList = await read(modify(exported, entries => text(entries, 'ppt/presentation.xml', xml => xml.replace(/<p:extLst>[\s\S]*<\/p:extLst>/, ''))));
  assert.deepEqual(noList.provenance, []);
  assert.deepEqual(noList.deck.slides.map(slide => slide.section), expected, 'The stored OPF_SLIDE_V1 section is the fallback.');
  const neither = await read(stripTags(modify(exported, entries => text(entries, 'ppt/presentation.xml', xml => xml.replace(/<p:extLst>[\s\S]*<\/p:extLst>/, '')))));
  assert.deepEqual(neither.deck.slides.map(slide => slide.section), expected.map(() => undefined));
  // The native list wins over the stored value: a section renamed or a slide moved in PowerPoint.
  const renamed = await read(modify(exported, entries => text(entries, 'ppt/presentation.xml', xml => xml.replace('name="Intro"', 'name="Opening"').replace('<p14:sldId id="262"/>', '').replace('<p14:sldId id="261"/>', '<p14:sldId id="261"/><p14:sldId id="262"/>'))));
  assert.deepEqual(renamed.provenance, []);
  assert.deepEqual(renamed.deck.slides.map(slide => slide.section), [undefined, undefined, 'Opening', 'Opening', 'R&D <2026> "plan"', undefined, undefined]);
  // A section named exactly Default Section is read as no section (documented, vetoable).
  const named = await read(modify(exported, entries => text(entries, 'ppt/presentation.xml', xml => xml.replace('name="Close"', `name="${DEFAULT_SECTION}"`))));
  assert.equal(named.deck.slides[6].section, undefined);
  // Re-export of the import writes the same list.
  assert.deepEqual(sections(presentation(await toPptx(own.deck, EXPORT))).map(section => [section.name, section.slides]), sections(presentation(exported)).map(section => [section.name, section.slides]));
}

// Footer section text: the list and the footer agree on export; after a rename
// in PowerPoint's sections pane the list wins and the footer keeps its text.
{
  const footer = {name: 'Footer', design: {footer: {left: {section: true}}}, slides: [{title: 'One', section: 'Intro'}, {title: 'Two', section: 'Intro'}, {title: 'Three', section: 'Close'}]};
  const bytes = await toPptx(structuredClone(footer), EXPORT);
  const same = await read(bytes);
  assert.deepEqual(same.provenance, []);
  assert.deepEqual(same.deck.slides.map(slide => slide.section), ['Intro', 'Intro', 'Close']);
  assert.deepEqual(same.deck.design.footer, footer.design.footer);
  const renamed = await read(modify(bytes, entries => text(entries, 'ppt/presentation.xml', xml => xml.replace('name="Intro"', 'name="Opening"'))));
  assert.deepEqual(renamed.deck.slides.map(slide => slide.section), ['Opening', 'Opening', 'Close']);
  assert.deepEqual(renamed.provenance.map(issue => [issue.code, issue.path]), [['section-reference-changed', 'slides.0.section'], ['section-reference-changed', 'slides.1.section']]);
  assert.match(renamed.provenance[0].message, /'Intro'.*'Opening'/);
  const stripped = await read(stripTags(bytes));
  assert.deepEqual(stripped.deck.slides.map(slide => slide.section), ['Intro', 'Intro', 'Close']);
}

// Section names are XML attribute values: the characters text runs reject are
// rejected with the same diagnostic; tab, LF and CR are written as spaces (an
// XML reader normalizes them anyway) and compare as spaces, so a re-saved list
// never disagrees with the authored label (F1).
{
  await assert.rejects(toPptx({name: 'Control', slides: [{title: 'One'}, {title: 'Two', section: 'Ctrl\u0001Char'}]}, EXPORT), error => error.code === 'invalid-text' && error.path === 'slides.1.section' && /U\+0001/.test(error.message));
  await assert.rejects(toPptx({name: 'Surrogate', slides: [{title: 'One', section: 'Lone\uD800'}]}, EXPORT), {code: 'invalid-text'});
  const bytes = await toPptx({name: 'Whitespace', design: {footer: {left: {section: true}}}, slides: [{title: 'One', section: 'Tab\tand\nline'}, {title: 'Two', section: 'Tab\tand\nline'}]}, EXPORT);
  const xml = presentation(bytes);
  assert.equal(XMLValidator.validate(xml), true);
  assert.deepEqual(sections(xml).map(section => section.name), ['Tab and line']);
  const {deck, provenance} = await read(bytes);
  assert.deepEqual(provenance, [], 'a normalized list agrees with the authored label');
  assert.deepEqual(deck.slides.map(slide => slide.section), ['Tab\tand\nline', 'Tab\tand\nline'], 'the authored label returns');
}

// Malformed lists count as none; the stored value then returns.
{
  const malformed = await read(modify(exported, entries => text(entries, 'ppt/presentation.xml', xml => xml.replace(/<p14:sectionLst[^>]*>[\s\S]*<\/p14:sectionLst>/, '<p14:sectionLst xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main"/>'))));
  assert.deepEqual(malformed.deck.slides.map(slide => slide.section), [undefined, undefined, undefined, undefined, undefined, undefined, undefined], 'An empty list covers no slide.');
  // Unit contract.
  assert.deepEqual(sectionRuns([undefined, 'A', 'A', undefined, 'B']), [{name: DEFAULT_SECTION, slides: [0]}, {name: 'A', slides: [1, 2]}, {name: DEFAULT_SECTION, slides: [3]}, {name: 'B', slides: [4]}]);
  assert.equal(sectionId(0, 'A'), sectionId(0, 'A'));
  assert.notEqual(sectionId(0, 'A'), sectionId(1, 'A'));
  const xml = '<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst><p:defaultTextStyle/></p:presentation>';
  assert.equal(writeSectionList(xml, [undefined, undefined]), xml);
  const written = writeSectionList(xml, ['A & B', undefined]);
  assert.match(written, /<p:defaultTextStyle\/><p:extLst><p:ext [^>]*><p14:sectionLst [^>]*><p14:section name="A &amp; B" id="\{[0-9A-F-]+\}"><p14:sldIdLst><p14:sldId id="256"\/><\/p14:sldIdLst><\/p14:section><p14:section name="Default Section" id="\{[0-9A-F-]+\}"><p14:sldIdLst><p14:sldId id="257"\/><\/p14:sldIdLst><\/p14:section><\/p14:sectionLst><\/p:ext><\/p:extLst><\/p:presentation>$/);
  assert.throws(() => writeSectionList(xml, ['A']), /slide id count/);
  const existing = writeSectionList(xml.replace('</p:presentation>', '<p:extLst><p:ext uri="{X}"/></p:extLst></p:presentation>'), ['A', 'A']);
  assert.match(existing, /<p:extLst><p:ext uri="\{X\}"\/><p:ext uri="\{521415D9[^"]*"><p14:sectionLst/);
  const root = parser.parse(written)['p:presentation'];
  assert.deepEqual([...readSectionList(root)], [['256', 'A & B'], ['257', DEFAULT_SECTION]]);
  assert.deepEqual(nativeSections(root, ['256', '257', '999']), ['A & B', undefined, undefined]);
  assert.equal(readSectionList(parser.parse(xml)['p:presentation']), null);
}

console.log('Sections passed: native p14:sectionLst with Default Section runs and deterministic ids, schema order with provenance customer data, import from the list (own export, stripped tags, renamed and moved slides), stored fallback without a list, footer agreement and section-reference-changed, malformed lists and the unit contract.');
