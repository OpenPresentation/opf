// opf-pptx#212: a full-provenance round trip of a list keeps inherited run formatting inherited. The export writes the list's
// size, family, weight and colour on every native run; OPF_SLIDE_V1.listRuns records that look per list (text and description
// lines), and import removes a run value still equal to it, so an untouched round trip is deep-equal to the source and adds no
// explicit styles. A run value edited in PowerPoint differs from the recorded look and comes back as observed (the absent-vs-
// native rule opf-pptx#211 applies to document defaults). Without the record (provenance false) runs are read as before.
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {gallery as defaultCatalog} from '@openpresentation/gallery';
import {fromPptx, toPptx} from '../dist/index.js';
import {validateListRuns} from '../dist/content-topology.js';

const edit = (bytes, transform) => {
  const parts = unzipSync(bytes);
  for (const name of Object.keys(parts)) if (/\.(xml|rels)$/.test(name)) parts[name] = strToU8(transform(name, strFromU8(parts[name])));
  return zipSync(parts);
};
const slideTag = bytes => {
  const xml = unzipSync(bytes)['ppt/tags/opfSlide1.xml'];
  return xml && JSON.parse(Buffer.from(strFromU8(xml).match(/\bval="([^"]+)"/)[1], 'hex').toString('utf8'));
};
// The shape of one native list line: `OPF list <path> line <n>`.
const lineShape = (xml, path, line, change) => xml.replace(new RegExp(`<p:sp><p:nvSpPr><p:cNvPr id="\\d+" name="OPF list ${path.replace(/\./g, '\\.')} line ${line}"[\\s\\S]*?</p:sp>`), change);
const read = async (bytes, options = {}) => {
  const diagnostics = [];
  const deck = await fromPptx(bytes, {...options, onDiagnostic: issue => diagnostics.push(issue)});
  return {deck, diagnostics};
};
let checks = 0;

const long = 'A list item long enough to wrap onto more than one native line of the measured export, so its lines join again on import';
// 1. Untouched round trips are deep-equal to the source: string and rich-run items, `items` and `bullets`, descriptions, levels,
// numbering, wrapped and hard-broken items, lists in blocks, with and without the default catalog registered.
const decks = {
  items: {slides: [{title: 'List', items: ['a']}]},
  bullets: {slides: [{title: 'List', bullets: ['a', 'b']}]},
  rich: {slides: [{title: 'List', items: [[{text: 'a', bold: true}, ' b'], 'c']}]},
  'own styles': {slides: [{title: 'List', items: [[{text: 'red', color: '#FF0000'}, ' then', {text: ' big', fontSize: 30}], [{text: 'link', link: 'https://example.com'}], [{text: 'it', italic: true}, ' and ', {text: 'mono', code: true}]]}]},
  descriptions: {slides: [{title: 'List', items: [{text: 'a', description: 'about a'}, {text: 'b', level: 1}, 'c', {text: [{text: 'x', bold: true}], description: [{text: 'y', italic: true}]}]}]},
  numbered: {slides: [{title: 'List', items: ['one', 'two'], numbering: 'arabic'}, {title: 'More', items: [[{text: 'B', bold: true}, ' rest'], 'two'], numbering: {style: 'alpha-upper', start: 3, suffix: 'paren'}}]},
  wrapped: {slides: [{title: 'List', items: [long, 'short']}]},
  'hard break': {slides: [{title: 'List', items: ['line one\nline two', 'x']}]},
  blocks: {slides: [{title: 'List', blocks: [{items: ['a', 'b']}, {text: 'Paragraph'}]}, {title: 'Two', blocks: [{bullets: ['a', 'b']}, {items: [[{text: 'c', bold: true}]]}]}]},
  'font scheme': {design: {fontScheme: 'arial'}, slides: [{title: 'List', items: ['a', [{text: 'b', underline: true}]]}]},
  // Run colour references (OPF_SLIDE_V1 colors) keep their slots: `text` equals the inherited colour natively and still returns.
  'colour references': {slides: [{title: 'List', items: [[{text: 'a', color: 'primary'}, 'b'], [{text: 'x', color: 'text'}, 'y'], {text: [{text: 'z', color: 'accent2'}], description: [{text: 'd', color: 'text'}]}]}]},
  'plain runs': {slides: [{title: 'List', items: [['a', 'b'], 'c']}]},
};
for (const [label, deck] of Object.entries(decks)) {
  for (const catalogs of [undefined, [defaultCatalog]]) {
    const options = catalogs ? {catalogs} : {};
    const {deck: imported} = await read(await toPptx(structuredClone(deck), options), options);
    assert.deepEqual(imported, deck, `${label}${catalogs ? ' (default catalog registered)' : ''}: untouched round trip`);
    checks++;
  }
}

// 2. The record: one look per list (text lines, and description lines when the list has descriptions), never text.
{
  const bytes = await toPptx({slides: [{title: 'List', blocks: [{items: [{text: 'a', description: 'about'}, 'b']}, {bullets: ['c']}]}]});
  const {listRuns} = slideTag(bytes);
  assert.deepEqual(listRuns.map(([path]) => path), ['slides.0.blocks.0.items', 'slides.0.blocks.1.bullets']);
  const [[, first], [, second]] = listRuns;
  assert.deepEqual(Object.keys(first), ['text', 'description']);
  assert.deepEqual(Object.keys(second), ['text']);
  for (const look of [first.text, first.description, second.text]) assert.deepEqual(Object.keys(look).sort(), ['bold', 'color', 'fontFamily', 'fontSize']);
  assert.ok(first.description.fontSize < first.text.fontSize, 'a description is smaller than its entry');
  assert.doesNotMatch(JSON.stringify(listRuns), /about|"a"|"b"|"c"/, 'no list text in the record');
  assert.equal(slideTag(await toPptx({slides: [{title: 'List', items: ['a']}]}, {provenance: 'references-only'})), undefined, "'references-only' records no list look");
  checks += 2;
}

// 3. A run style edited in PowerPoint comes back as observed; the untouched runs stay inherited.
{
  const source = {slides: [{title: 'List', items: ['first', 'second', 'third']}]};
  const bytes = await toPptx(structuredClone(source));
  const edited = edit(bytes, (name, xml) => name !== 'ppt/slides/slide1.xml' ? xml : lineShape(xml, 'slides.0.items', 1, shape => shape
    .replace(/<a:rPr lang="en-US" sz="\d+"/, '<a:rPr lang="en-US" sz="2400"')
    .replace(/(<a:rPr\b[^>]*>)<a:solidFill>[\s\S]*?<\/a:solidFill>/, '$1<a:solidFill><a:srgbClr val="FF0000"/></a:solidFill>')));
  const {deck} = await read(edited);
  assert.deepEqual(deck.slides[0].items, ['first', [{text: 'second', fontSize: 24, color: '#FF0000'}], 'third'], 'only the edited run carries its native size and colour');
  // A family chosen for the whole list in PowerPoint differs from the recorded look on every run: observed everywhere.
  const family = edit(bytes, (name, xml) => name !== 'ppt/slides/slide1.xml' ? xml : xml.replace(/<p:sp><p:nvSpPr><p:cNvPr id="\d+" name="OPF list [\s\S]*?<\/p:sp>/g, shape => shape.replace(/<a:latin typeface="[^"]*"/g, '<a:latin typeface="Georgia"')));
  const {deck: restyled} = await read(family);
  assert.deepEqual(restyled.slides[0].items, ['first', 'second', 'third'].map(text => [{text, fontFamily: 'Georgia'}]));
  // Bold toggled on in PowerPoint is an authored style, and a run made not bold again is plain.
  const bold = edit(bytes, (name, xml) => name !== 'ppt/slides/slide1.xml' ? xml : lineShape(xml, 'slides.0.items', 2, shape => shape.replace(/<a:rPr lang="en-US" sz="(\d+)"/, '<a:rPr lang="en-US" sz="$1" b="1"')));
  assert.deepEqual((await read(bold)).deck.slides[0].items, ['first', 'second', [{text: 'third', bold: true}]]);
  checks += 3;
}

// 4. Without the record the runs are read as they are (the native rule): provenance false keeps every observed value.
{
  const {deck} = await read(await toPptx({slides: [{title: 'List', items: ['a']}]}, {provenance: false}));
  const [item] = deck.slides[0].items ?? deck.slides[0].blocks?.[0]?.items ?? [];
  assert.ok(Array.isArray(item) && item[0].fontSize > 0 && item[0].fontFamily && item[0].color, 'observed run values without a record');
  checks++;
}

// 5. A malformed record is rejected (untrusted input); the slide record then reads as unreadable, never as a partial look.
{
  const look = {bold: false, color: '#FFFFFF', fontSize: 18.75, fontFamily: 'Aptos'};
  assert.doesNotThrow(() => validateListRuns([['slides.0.items', {text: look}]]));
  assert.doesNotThrow(() => validateListRuns([['slides.0.blocks.1.bullets', {text: look, description: {...look, fontSize: 15.37}}]]));
  for (const bad of [[], {}, [['slides.0.items']], [['items', {text: look}]], [['slides.0.items', {}]], [['slides.0.items', {text: {}}]],
    [['slides.0.items', {text: {...look, color: 'red'}}]], [['slides.0.items', {text: {...look, fontSize: -1}}]], [['slides.0.items', {text: {...look, size: 3}}]],
    [['slides.0.items', {text: look, other: look}]], [['slides.0.items', {text: look}], ['slides.0.items', {text: look}]]]) {
    assert.throws(() => validateListRuns(bad), /Invalid list runs/, JSON.stringify(bad));
  }
  const source = {slides: [{title: 'List', items: ['a']}]};
  const tampered = edit(await toPptx(structuredClone(source)), (name, xml) => name !== 'ppt/tags/opfSlide1.xml' ? xml : xml.replace(/\bval="([^"]+)"/, (_match, hex) => {
    const value = JSON.parse(Buffer.from(hex, 'hex').toString('utf8'));
    value.listRuns[0][1].text.color = 'not a colour';
    return `val="${Buffer.from(JSON.stringify(value), 'utf8').toString('hex').toUpperCase()}"`;
  }));
  const {deck} = await read(tampered);
  const items = deck.slides[0].items ?? deck.slides[0].blocks?.find(block => block.items)?.items;
  assert.equal(items?.length, 1, 'the list still imports');
  assert.ok(Array.isArray(items[0]) && items[0][0].fontSize > 0, 'an unreadable record restores nothing: the runs are observed');
  checks += 2;
}

console.log(`List inherited runs passed: ${checks} checks (untouched list round trips deep-equal, the listRuns record, native edits observed, no record without provenance, malformed records rejected).`);
