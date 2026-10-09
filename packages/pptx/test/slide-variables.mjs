import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {paginate, validate} from '@openpresentation/opf';
import {toPptx, fromPptx} from './helpers/default-catalog.mjs';

// FA-31: header and footer values are variables in a zone's `text`. {{slide.number}} is a native slide-number field when its
// line fits; {{deck.slideCount}} and {{slide.section}} are fixed text; in body text every slide token is fixed text. Import
// returns {{slide.number}} for a native field, and the tokens of an OPF-written file.
const enc = new TextEncoder(), dec = new TextDecoder();
const options = {seed: 1, timestamp: '2026-01-01T00:00:00Z', zipDate: '2026-01-01T00:00:00Z', date: '2026-09-22'};
const exportDeck = async (source, extra = {}) => {
  const before = structuredClone(source), issues = [];
  const bytes = await toPptx(source, {...options, ...extra, onDiagnostic: issue => issues.push(issue)});
  assert.deepEqual(source, before, 'Export leaves the source unchanged.');
  return {bytes, issues, entries: unzipSync(bytes)};
};
const slideXml = (entries, index) => dec.decode(entries[`ppt/slides/slide${index}.xml`]);
const shapes = xml => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match => match[0]);
const furniture = xml => shapes(xml).filter(shape => /name="OPF furniture/.test(shape));
const nativeOf = (xml, type) => shapes(xml).filter(shape => new RegExp(`<p:ph type="${type}"`).test(shape));
// "Page [slidenum:2] of 3": runs in order, a native field as [type:cached words].
const runs = shape => [...shape.matchAll(/<a:(r|fld)\b([^>]*)>[\s\S]*?<a:t>([^<]*)<\/a:t><\/a:\1>/g)]
  .map(([, kind, attributes, text]) => kind === 'fld' ? `[${attributes.match(/type="([^"]+)"/)[1]}:${text}]` : text).join('');
const fieldCount = xml => (xml.match(/<a:fld\b/g) ?? []).length;
const read = async bytes => {
  const issues = [], deck = await fromPptx(bytes, {onDiagnostic: issue => issues.push(issue)});
  assert.equal(validate(deck, {only: ['format']}).valid, true, JSON.stringify(validate(deck, {only: ['format']}).findings));
  return {deck, issues, invalid: issues.filter(issue => issue.code === 'invalid-furniture-provenance')};
};
const modify = (bytes, mutate) => { const entries = unzipSync(bytes); mutate(entries); return zipSync(entries); };
// Every tag stripped: the closest local stand-in for a deck not made by OPF.
const stripTags = bytes => modify(bytes, entries => {
  for (const path of Object.keys(entries)) {
    if (/^ppt\/tags\//.test(path)) { delete entries[path]; continue; }
    if (/\.xml$/.test(path) && !/Content_Types/.test(path)) entries[path] = enc.encode(dec.decode(entries[path]).replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g, ''));
  }
});

// 1. "Page {{slide.number}} of {{deck.slideCount}}": a native slide-number field (the Slide Number placeholder) with fixed words around it.
const paged = {name: 'Paged', design: {fontScheme: 'roboto', footer: {left: {text: 'Confidential'}, center: {text: 'Page {{slide.number}} of {{deck.slideCount}}'}}}, slides: [
  {title: 'One', text: 'Body'}, {title: 'Two', text: 'Body'}, {title: 'Three', text: 'Body'}]};
{
  const {bytes, issues, entries} = await exportDeck(paged);
  assert.deepEqual(issues, []);
  for (const index of [1, 2, 3]) {
    const xml = slideXml(entries, index), native = nativeOf(xml, 'sldNum');
    assert.deepEqual(native.map(runs), [`Page [slidenum:${index}] of 3`], `slide ${index}: the number is a field; "Page" and "of 3" are fixed runs`);
    assert.match(native[0], /<a:fld id="\{[0-9A-F-]+\}" type="slidenum">/);
    assert.deepEqual(nativeOf(xml, 'ftr').map(runs), ['Confidential']);
    assert.equal(fieldCount(xml), 1, 'Only the number is a field.');
    assert.ok(!xml.includes('{{'), 'No token reaches the file.');
  }
  assert.deepEqual((await exportDeck(paged)).bytes, bytes, 'Export is deterministic.');
  // OPF -> PPTX -> OPF returns the authored tokens, whatever the slide position.
  const {deck, invalid} = await read(bytes);
  assert.deepEqual(invalid, []);
  assert.deepEqual(deck.design.footer, paged.design.footer);
  assert.deepEqual(deck.slides.map(slide => slide.design), [undefined, undefined, undefined]);
}

// 2. A header is ordinary tagged shapes (PowerPoint has no header object), and its slide number is still a live field.
{
  const source = {name: 'Header', design: {fontScheme: 'roboto', header: {left: {text: '{{slide.section}}'}, right: {text: 'No. {{slide.number}}'}}}, slides: [
    {title: 'One', section: 'Intro'}, {title: 'Two', section: 'Intro'}, {title: 'Three', section: 'Close'}]};
  const {bytes, entries} = await exportDeck(source);
  const xml = slideXml(entries, 3);
  assert.deepEqual(furniture(xml).map(runs), ['Close', 'No. [slidenum:3]'], '{{slide.section}} is fixed text; the number is a field.');
  assert.deepEqual(nativeOf(xml, 'sldNum'), [], 'A header part is never a placeholder.');
  const {deck, invalid} = await read(bytes);
  assert.deepEqual(invalid, []);
  assert.deepEqual(deck.design.header, source.design.header, 'Both tokens return while the words still match the slide and its section.');
  assert.deepEqual(deck.slides.map(slide => slide.section), ['Intro', 'Intro', 'Close']);
}

// 3. Body text: every slide token is fixed text with the slide's value; nothing but the footer number is a field.
{
  const source = {name: 'Body', design: {fontScheme: 'roboto', footer: {right: {text: '{{slide.number}}'}}}, slides: [
    {title: 'Intro slide', section: 'Intro', text: 'Slide {{slide.number}} of {{deck.slideCount}} in {{slide.section}}'},
    {title: 'Slide {{slide.number}}', text: 'The count is {{ deck.slideCount }}.'},
    {title: 'Escaped', text: 'Write \\{{slide.number}} for the number.'}]};
  const {entries, issues} = await exportDeck(source);
  assert.deepEqual(issues, []);
  const [first, second, third] = [1, 2, 3].map(index => slideXml(entries, index));
  assert.ok(first.includes('<a:t>Slide 1 of 3 in Intro</a:t>'));
  assert.ok(second.includes('<a:t>Slide 2</a:t>') && second.includes('<a:t>The count is 3.</a:t>'));
  assert.ok(third.includes('<a:t>Write {{slide.number}} for the number.</a:t>'), 'An escaped token is the literal text.');
  for (const xml of [first, second, third]) assert.equal(fieldCount(xml), 1, 'Body text is never a field; only the footer number is.');
  assert.deepEqual(furniture(first).map(runs), ['[slidenum:1]']);
  // The footer's own escape draws literally and stays literal through a round trip.
  const literal = {name: 'Literal', design: {fontScheme: 'roboto', footer: {right: {text: 'Use \\{{slide.number}}'}}}, slides: [{title: 'One'}, {title: 'Two'}]};
  const exported = await exportDeck(literal);
  assert.deepEqual(furniture(slideXml(exported.entries, 2)).map(runs), ['Use {{slide.number}}']);
  assert.equal(fieldCount(slideXml(exported.entries, 2)), 0);
  assert.deepEqual((await read(exported.bytes)).deck.design.footer, literal.design.footer);
}

// 4. Pagination: a slide split in two shows consecutive numbers and the final count, in the footer and in the body.
{
  const long = {title: 'Long list', items: Array.from({length: 80}, (_, index) => `Item ${index + 1} with enough words to take a line of its own on the page`)};
  const source = {name: 'Long', design: {fontScheme: 'roboto', footer: {left: {text: 'Slide {{slide.number}} of {{deck.slideCount}}'}, right: {text: '{{slide.number}} / {{deck.slideCount}}'}}},
    slides: [{title: 'Cover'}, long, {title: 'End', text: 'Count {{deck.slideCount}}, number {{slide.number}}'}]};
  const split = paginate(source).presentation;
  const count = split.slides.length;
  assert.ok(count > 3, 'The long list is split over several slides.');
  assert.ok(JSON.stringify(split.slides).includes('{{deck.slideCount}}'), 'The paginated document keeps its tokens.');
  const {entries, bytes} = await exportDeck(split);
  for (let index = 1; index <= count; index++) {
    const xml = slideXml(entries, index);
    assert.deepEqual(furniture(xml).map(runs), [`Slide [slidenum:${index}] of ${count}`, `[slidenum:${index}] / ${count}`], `slide ${index}`);
  }
  assert.ok(slideXml(entries, count).includes(`<a:t>Count ${count}, number ${count}</a:t>`), 'The body uses the same numbers as the footer.');
  const {deck, invalid} = await read(bytes);
  assert.deepEqual(invalid, []);
  assert.deepEqual(deck.design.footer, source.design.footer);
}

// 5. A third-party deck: a native slide-number footer (no OPF tags) imports as {{slide.number}}, with its words kept.
{
  const {bytes} = await exportDeck(paged);
  const { deck, invalid } = await read(stripTags(bytes));
  assert.deepEqual(invalid, []);
  assert.deepEqual(deck.design.footer, {left: {text: 'Confidential'}, center: {text: 'Page {{slide.number}} of 3'}}, 'The count is words without provenance; the field is the token.');
  const bare = await exportDeck({name: 'Number only', design: {fontScheme: 'roboto', footer: {right: {text: '{{slide.number}}'}}}, slides: [{title: 'A'}, {title: 'B'}]});
  assert.deepEqual((await read(stripTags(bare.bytes))).deck.design.footer, {right: {text: '{{slide.number}}'}});
}

// 6. Typed words that spell a token are literal, never a live value on the next export.
{
  const {bytes} = await exportDeck({name: 'Typed', design: {fontScheme: 'roboto', footer: {center: {text: 'Say hi'}}}, slides: [{title: 'A'}, {title: 'B'}]});
  const typed = stripTags(modify(bytes, entries => { for (const index of [1, 2]) entries[`ppt/slides/slide${index}.xml`] = enc.encode(slideXml(entries, index).replace('Say hi', 'Type {{slide.number}} here')); }));
  const {deck} = await read(typed);
  assert.deepEqual(deck.design.footer, {center: {text: 'Type \\{{slide.number}} here'}});
  const again = unzipSync(await toPptx(deck, options));
  assert.equal(fieldCount(slideXml(again, 1)), 0);
  assert.deepEqual(nativeOf(slideXml(again, 1), 'ftr').map(runs), ['Type {{slide.number}} here']);
}

console.log('Slide variables passed: native {{slide.number}} fields with fixed words, fixed {{deck.slideCount}} and {{slide.section}}, body tokens as text, pagination numbers, tokens through the round trip and third-party footers.');
