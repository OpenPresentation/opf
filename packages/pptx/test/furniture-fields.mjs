import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';
import {formatDate, parseDate, furniturePartFields, lineFields, nativeFieldType, formatSlideNumber} from '../dist/furniture-fields.js';
import {validatePresentation} from '@openpresentation/opf';

const enc = new TextEncoder(), dec = new TextDecoder();
const options = {seed: 1, timestamp: '2026-01-01T00:00:00Z', zipDate: '2026-01-01T00:00:00Z'};
const deck = footer => ({design: {footer}, slides: [{title: 'Title', design: {footer: false}}, {title: 'Two'}, {title: 'Three'}]});
const exportDeck = async (source, extra = {}) => {
  const before = structuredClone(source), issues = [];
  const bytes = await toPptx(source, {...options, ...extra, onDiagnostic: issue => issues.push(issue)});
  assert.deepEqual(source, before, 'Export leaves the source unchanged.');
  return {bytes, issues, entries: unzipSync(bytes)};
};
const slideXml = (entries, index) => dec.decode(entries[`ppt/slides/slide${index}.xml`]);
const furnitureParagraphs = xml => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match => match[0])
  .filter(shape => /name="OPF furniture/.test(shape)).map(shape => shape.match(/<a:p>[\s\S]*?<\/a:p>/)[0]);
const runs = paragraph => [...paragraph.matchAll(/<a:(r|fld)\b([^>]*)>[\s\S]*?<a:t>([^<]*)<\/a:t><\/a:\1>/g)]
  .map(([, kind, attributes, text]) => kind === 'fld' ? `[${attributes.match(/type="([^"]+)"/)[1]}:${text}]` : text).join('');
const read = async bytes => {
  const issues = [], imported = await fromPptx(bytes, {onDiagnostic: issue => issues.push(issue)});
  assert.equal(validatePresentation(imported).valid, true);
  return {imported, issues, invalid: issues.filter(issue => issue.code === 'invalid-furniture-provenance')};
};
const edit = (entries, index, mutate) => {
  const copy = {...entries};
  copy[`ppt/slides/slide${index}.xml`] = enc.encode(mutate(slideXml(entries, index)));
  return zipSync(copy);
};

// Slide numbers are native fields inside the tagged furniture shapes; {total} stays fixed.
{
  const footer = {left: {text: 'Prepared for Northstar Health'}, right: {slideNumber: true, slideNumberFormat: '{current} / {total}'}};
  const {bytes, issues, entries} = await exportDeck(deck(footer));
  assert.deepEqual(issues, []);
  assert.deepEqual(furnitureParagraphs(slideXml(entries, 1)), [], 'The title slide override hides the footer.');
  for (const index of [2, 3]) assert.deepEqual(furnitureParagraphs(slideXml(entries, index)).map(runs), ['Prepared for Northstar Health', `[slidenum:${index}] / 3`]);
  assert.match(slideXml(entries, 2), /<a:fld id="\{[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-8[0-9A-F]{3}-[0-9A-F]{12}\}" type="slidenum"><a:rPr\b[^>]*lang="en-US"/);
  assert.deepEqual((await exportDeck(deck(footer))).bytes, bytes, 'Field ids are deterministic.');
  const {imported, invalid} = await read(bytes);
  assert.deepEqual(invalid, []);
  assert.deepEqual(imported.design.footer, footer);
  assert.deepEqual(imported.slides.map(slide => slide.design?.footer), [false, undefined, undefined]);
  // A cached number that disagrees with the slide position (as after a move PowerPoint has not yet
  // refreshed) fails provenance: the visible words are kept as ordinary text, not restored as a field.
  const moved = await read(edit(entries, 2, xml => xml.replace(/(<a:fld\b[^>]*type="slidenum">[\s\S]*?<a:t>)2</, '$18<')));
  assert.equal(moved.invalid.length, 1, 'A visible number that disagrees with its position is ordinary text.');
  // Fixed text around the field that no longer matches the recorded format is not restored.
  const edited = await read(edit(entries, 3, xml => xml.replace('<a:t> / 3</a:t>', '<a:t> of 3</a:t>')));
  assert.equal(edited.invalid.length, 1);
  assert.ok(JSON.stringify(edited.imported).includes('3 of 3'), 'Current native words are retained.');
}
{
  const footer = {right: {slideNumber: true, slideNumberFormat: 'A-{current}'}};
  const {bytes, entries} = await exportDeck(deck(footer));
  assert.deepEqual(furnitureParagraphs(slideXml(entries, 3)).map(runs), ['A-[slidenum:3]']);
  assert.deepEqual((await read(bytes)).imported.design.footer, footer);
  const plain = await exportDeck(deck({right: {slideNumber: true}}));
  assert.deepEqual(furnitureParagraphs(slideXml(plain.entries, 2)).map(runs), ['[slidenum:2]']);
  assert.deepEqual((await read(plain.bytes)).imported.design.footer, {right: {slideNumber: true}});
}

// Fixed dates are formatted text; their ISO value and pattern return while the text round-trips.
{
  const footer = {left: {date: '2026-04-23', dateFormat: 'MMM d, yyyy'}, center: {text: 'v0.8'}, right: {slideNumber: true}};
  const {bytes, issues, entries} = await exportDeck(deck(footer));
  assert.deepEqual(issues, []);
  assert.deepEqual(furnitureParagraphs(slideXml(entries, 2)).map(runs), ['Apr 23, 2026', 'v0.8', '[slidenum:2]']);
  assert.doesNotMatch(slideXml(entries, 2), /type="datetime/);
  assert.deepEqual((await read(bytes)).imported.design.footer, footer);
  const rewritten = await read(edit(entries, 2, xml => xml.replace('Apr 23, 2026', 'Apr 24, 2026')));
  assert.deepEqual(rewritten.invalid, []);
  assert.deepEqual(rewritten.imported.slides[1].design.footer.left, {dateFormat: 'MMM d, yyyy', date: '2026-04-24'});
  const words = await read(edit(entries, 2, xml => xml.replace('Apr 23, 2026', 'Spring 2026')));
  assert.deepEqual(words.imported.slides[1].design.footer.left, {date: 'Spring 2026'}, 'Unparseable current words stay a literal date.');
  const month = await exportDeck(deck({center: {date: '2026-04-23', dateFormat: 'MMM yyyy'}}));
  assert.deepEqual((await read(month.bytes)).imported.design.footer, {center: {date: 'Apr 2026'}}, 'A pattern without a day cannot recover the ISO date.');
  const literal = await exportDeck(deck({left: {date: ' 2026-09-14 '}}));
  assert.deepEqual((await read(literal.bytes)).imported.design.footer, {left: {date: ' 2026-09-14 '}});
}

// Current dates are live PowerPoint date fields whose cached text is the host-supplied date.
{
  const footer = {left: {date: true, dateFormat: 'MMMM d, yyyy'}, center: {date: true}, right: {slideNumber: true}};
  const {bytes, issues, entries} = await exportDeck(deck(footer), {date: '2026-09-22'});
  assert.deepEqual(issues, []);
  assert.deepEqual(furnitureParagraphs(slideXml(entries, 2)).map(runs), ['[datetime4:September 22, 2026]', '[datetime1:9/22/2026]', '[slidenum:2]']);
  const {imported, invalid} = await read(bytes);
  assert.deepEqual(invalid, []);
  assert.deepEqual(imported.design.footer, footer);
  // PowerPoint's Date and Time dialog can change the field type; the current type wins.
  const retyped = await read(edit(entries, 2, xml => xml.replace('type="datetime4"', 'type="datetime3"')));
  assert.deepEqual(retyped.imported.slides[1].design.footer.left, {dateFormat: 'd MMMM yyyy', date: true});
  // A field replaced by typed text is a literal date.
  const typed = await read(edit(entries, 2, xml => xml.replace(/<a:fld\b[^>]*type="datetime1">(<a:rPr\b[^>]*>[\s\S]*?<\/a:rPr>)<a:t>[^<]*<\/a:t><\/a:fld>/, '<a:r>$1<a:t>Monday</a:t></a:r>')));
  assert.deepEqual(typed.imported.slides[1].design.footer.center, {date: 'Monday'});
  // Without a host date the current date is unresolved, as before; nothing reads a clock.
  const missing = await exportDeck(deck(footer));
  assert.ok(missing.issues.some(issue => issue.code === 'unresolved-content' && issue.path === 'design.footer.left.date'));
  // A pattern without an en-US field type is exported as fixed text, with a diagnostic.
  const iso = await exportDeck(deck({left: {date: true, dateFormat: 'yyyy-MM-dd'}}), {date: '2026-09-22'});
  assert.deepEqual(furnitureParagraphs(slideXml(iso.entries, 2)).map(runs), ['2026-09-22']);
  assert.deepEqual(iso.issues.map(issue => [issue.code, issue.path]), [['furniture-date-fixed', 'design.footer.left.date'], ['furniture-date-fixed', 'design.footer.left.date']]);
  await assert.rejects(exportDeck(deck(footer), {date: '22/09/2026'}), RangeError);
}

// Pure helpers.
assert.equal(formatDate('2026-04-23', "EEEE', 'MMMM d', 'yyyy"), 'Thursday, April 23, 2026');
for (const pattern of ['MMM d, yyyy', 'yyyy-MM-dd', 'EEEE, MMMM d, yyyy', 'd-MMM-yyyy', "dd/MM/yyyy 'x'"]) assert.equal(parseDate(formatDate('2024-02-29', pattern), pattern), '2024-02-29');
for (const [text, pattern] of [['Apr 2026', 'MMM yyyy'], ['23-Apr-26', 'd-MMM-yy'], ['Friday, April 23, 2026', 'EEEE, MMMM d, yyyy'], ['Feb 30, 2026', 'MMM d, yyyy'], ['x', 'hh']]) assert.equal(parseDate(text, pattern), null);
assert.deepEqual(furniturePartFields({field: 'slideNumber', text: '12'}), [{type: 'slideNumber', start: 0, end: 2}], 'Earlier cores still get a live number.');
assert.deepEqual(furniturePartFields({field: 'date', text: '2026'}), []);
assert.equal(nativeFieldType({type: 'date', format: 'MMM-yy'}), 'datetime7');
assert.equal(nativeFieldType({type: 'date', format: 'MMM d, yyyy'}), null);
assert.equal(formatSlideNumber('{current} of {total}', 4, 9), '4 of 9');
assert.deepEqual(lineFields('Page 12', [{type: 'slideNumber', start: 5, end: 7}], [{start: 0, end: 4}, {start: 5, end: 7}], ['Page', '12']), [[], [{type: 'slideNumber', start: 0, end: 2}]]);
assert.deepEqual(lineFields('1234', [{type: 'slideNumber', start: 0, end: 4}], [{start: 0, end: 2}, {start: 2, end: 4}], ['12', '34']), [[], []], 'A wrapped number stays fixed text.');

console.log('Furniture fields: live slide numbers, fixed {total}, fixed and current dates, native date types, edits and helpers pass. Native Office is a separate gate.');
