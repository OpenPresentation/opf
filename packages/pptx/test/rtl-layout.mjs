import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {fromPptx, toPptx} from '../dist/index.js';
import {nativeTableEntries} from './table-values.js';
import {latinPhrases} from '../src/script-fonts.js';

// RR-05: right-to-left layout in the PPTX export. Authored alignment is logical (`left` is the start edge), so a right-to-left
// paragraph writes rtl="1" with algn="r"; bullets hang at the right (marL/indent are the start-side margin and hanging indent);
// every wrapped line of a paragraph shares its paragraph's direction; a table runs right to left (a:tblPr rtl); the regions
// mirror; column charts reverse their categories; and a Latin phrase inside Arabic text is its own en-US run so PowerPoint orders
// "v2.0" and "PowerPoint 365" left to right. A left-to-right deck is written as before.
const arabic = 'العنصر الأول مع رقم 2026';
const deck = (language, extra = {}) => ({name: 'RTL layout', ...(language === undefined ? {} : {language}), ...extra, slides: [
  {title: 'عنوان العرض', items: [arabic, 'English item', {text: 'العنصر الثاني: v2.0 و PowerPoint 365', level: 1}, 'آخر']},
  {title: 'مناطق', left: {text: 'النص الأيسر'}, right: {text: 'النص الأيمن'}},
  {title: 'جدول', table: {columns: ['المؤشر', 'القيمة', 'الحالة'], rows: [['الإيرادات', 'Customers', 'جيد']]}},
  {title: 'مخطط', chart: {type: 'column', data: {columns: ['شهر', 'قيمة'], rows: [['يناير', 12], ['فبراير', 15], ['مارس', 18]]}}},
  {title: 'نص طويل', text: `${arabic} ${arabic} ${arabic} ${'abc '.repeat(40)}`.trim(), notes: 'ملاحظات المتحدث'},
  {title: 'شريط', chart: {type: 'bar', data: {columns: ['شهر', 'قيمة'], rows: [['يناير', 12], ['فبراير', 15]]}}},
]});
const read = async presentation => {
  const bytes = await toPptx(presentation);
  const entries = unzipSync(new Uint8Array(bytes));
  const xml = Object.fromEntries(Object.entries(entries).filter(([name]) => /\.(xml|rels)$/.test(name)).map(([name, value]) => [name, strFromU8(value)]));
  for (const [name, value] of Object.entries(xml)) if (name.endsWith('.xml')) assert.equal(XMLValidator.validate(value), true, `${name} is well-formed`);
  return {bytes, xml};
};
const shapes = (xml, slide) => [...xml[`ppt/slides/slide${slide}.xml`].matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => ({
  name: /<p:cNvPr\b[^>]*\bname="([^"]*)"/.exec(shape)?.[1],
  x: Number(/<a:off x="(-?\d+)"/.exec(shape)?.[1]), width: Number(/<a:ext cx="(\d+)"/.exec(shape)?.[1]),
  pPr: /<a:pPr\b[^>]*>/.exec(shape)?.[0] ?? '',
  text: [...shape.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]).join(''),
  runs: [...shape.matchAll(/<a:r><a:rPr\b[^>]*?\slang="([^"]*)"[^>]*>[\s\S]*?<a:t>([^<]*)<\/a:t><\/a:r>/g)].map(match => ({lang: match[1], text: match[2]})),
}));
const attribute = (tag, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

const rtl = await read(deck('ar')), ltr = await read(deck('en'));

// Title and list: start at the right, markers at the right.
{
  const [title, ...list] = shapes(rtl.xml, 1);
  assert.equal(attribute(title.pPr, 'rtl'), '1');
  assert.equal(attribute(title.pPr, 'algn'), 'r', 'a left-aligned right-to-left title starts at the right edge');
  const [first, latin, nested, last] = list;
  for (const entry of [first, nested, last]) {
    assert.equal(attribute(entry.pPr, 'rtl'), '1');
    assert.equal(attribute(entry.pPr, 'algn'), 'r');
    assert.ok(Number(attribute(entry.pPr, 'marL')) > 0 && Number(attribute(entry.pPr, 'indent')) < 0, 'a hanging bullet indent (start-side margin)');
  }
  assert.equal(attribute(latin.pPr, 'rtl'), '0', 'a Latin item stays left to right');
  assert.equal(attribute(latin.pPr, 'algn'), 'l');
  // The first line of an entry reaches the right edge of the content box (the marker column); a continuation line stops at the text column.
  const right = shape => shape.x + shape.width;
  assert.equal(right(first), right(last));
  assert.ok(Number(attribute(nested.pPr, 'marL')) > Number(attribute(first.pPr, 'marL')), 'a nested level steps in from the right');
  const ltrList = shapes(ltr.xml, 1).slice(1);
  assert.ok(ltrList.every(entry => attribute(entry.pPr, 'rtl') === undefined && attribute(entry.pPr, 'algn') === 'l'), 'a left-to-right deck writes no direction and left alignment');
}

// Regions mirror.
{
  const rtlRegions = shapes(rtl.xml, 2).filter(shape => /left|right/.test(shape.name)), ltrRegions = shapes(ltr.xml, 2).filter(shape => /left|right/.test(shape.name));
  const byName = (list, side) => list.find(shape => shape.name.includes(`.${side}.`));
  assert.ok(byName(rtlRegions, 'left').x > byName(rtlRegions, 'right').x, 'the authored left region is at the right');
  assert.ok(byName(ltrRegions, 'left').x < byName(ltrRegions, 'right').x);
}

// Tables run right to left and their cells start at the right.
{
  const table = rtl.xml['ppt/slides/slide3.xml'];
  assert.match(/<a:tblPr\b[^>]*>/.exec(table)[0], /\srtl="1"/);
  assert.doesNotMatch(ltr.xml['ppt/slides/slide3.xml'], /<a:tblPr\b[^>]*\srtl=/);
  const cells = [...table.matchAll(/<a:tc\b[\s\S]*?<\/a:tc>/g)].map(([cell]) => ({pPr: /<a:pPr\b[^>]*>/.exec(cell)?.[0] ?? '', text: [...cell.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]).join('')}));
  const customers = cells.find(cell => cell.text === 'Customers'), index = cells.find(cell => cell.text === 'الإيرادات');
  assert.equal(attribute(index.pPr, 'algn'), 'r');
  assert.equal(attribute(customers.pPr, 'algn'), 'l', 'a Latin cell starts at the left');
  // The first column is the first cell; the table keeps its logical column order.
  assert.equal(cells[0].text, 'المؤشر');
  const round = await fromPptx(rtl.bytes);
  const value = cell => typeof cell === 'string' ? cell : Array.isArray(cell) ? cell.map(value).join('') : value(cell?.value ?? cell?.text ?? '');
  assert.deepEqual(round.slides[2].table.columns.map(value), ['المؤشر', 'القيمة', 'الحالة'], 're-import keeps the column order');
  assert.deepEqual(round.slides[2].table, deck('arabic').slides[2].table, 'unchanged RTL tables preserve authored style absence');
  const native = await fromPptx(zipSync(nativeTableEntries(rtl.bytes)));
  const alignments = [...native.slides[2].table.columns, ...native.slides[2].table.rows[0]].map(cell => cell?.style?.align).filter(Boolean);
  assert.ok(alignments.length > 0 && alignments.every(align => align === 'left'), 're-import reads right alignment of rtl cells as the logical start');
}

// Column charts reverse their categories; bar charts keep theirs.
{
  const orientations = slide => {
    const rel = rtl.xml[`ppt/slides/_rels/slide${slide}.xml.rels`].match(/charts\/(chart\d+\.xml)/)[1];
    return [...rtl.xml[`ppt/charts/${rel}`].matchAll(/<c:orientation val="(\w+)"\/>/g)].map(match => match[1]);
  };
  assert.deepEqual(orientations(4), ['maxMin', 'minMax'], 'column: reversed categories, value axis unchanged');
  assert.deepEqual(orientations(6), ['minMax', 'minMax'], 'bar charts keep their vertical category axis');
  const rel = ltr.xml['ppt/slides/_rels/slide4.xml.rels'].match(/charts\/(chart\d+\.xml)/)[1];
  assert.deepEqual([...ltr.xml[`ppt/charts/${rel}`].matchAll(/<c:orientation val="(\w+)"\/>/g)].map(match => match[1]), ['minMax', 'minMax']);
}

// Every line of a wrapped paragraph shares the paragraph's direction and alignment, including the Latin-only last line.
{
  const lines = shapes(rtl.xml, 5).filter(shape => /OPF text|Text/.test(shape.name ?? '') || shape.text);
  const body = lines.filter(shape => shape.text && !/عنوان|نص طويل/.test(shape.name + shape.text.slice(0, 0)) && shape.name !== undefined && !/heading/.test(shape.name));
  assert.ok(body.length >= 2);
  assert.ok(body.every(shape => attribute(shape.pPr, 'rtl') === '1' && attribute(shape.pPr, 'algn') === 'r'), 'all lines are rtl and right aligned');
  assert.match(body.at(-1).text, /^[a-z ]+$/, 'the last line holds only Latin letters');
  // Notes paragraphs start at the right too.
  const notes = rtl.xml['ppt/notesSlides/notesSlide5.xml'];
  assert.match(/<a:pPr\b[^>]*>/.exec(notes.slice(notes.indexOf('ملاحظات')- 600, notes.indexOf('ملاحظات')))?.[0] ?? '', /rtl="1"/);
}

// A Latin phrase in an Arabic run is its own en-US run; digits stay with their Arabic text.
{
  const list = shapes(rtl.xml, 1);
  const nested = list.find(shape => shape.text.includes('v2.0'));
  assert.deepEqual(nested.runs.map(run => `${run.lang}:${run.text}`), ['ar-SA:العنصر الثاني: ', 'en-US:v2.0', 'ar-SA: و ', 'en-US:PowerPoint 365']);
  const first = list[1];
  assert.deepEqual(first.runs.map(run => run.lang), ['ar-SA'], 'digits next to Arabic words keep the Arabic run');
  assert.deepEqual(latinPhrases('x1 y-2.0 z.'), [[0, 10]], 'spaces and word punctuation join a phrase; trailing punctuation does not');
  assert.deepEqual(latinPhrases('Wi-Fi 6E، ok'), [[0, 8], [10, 12]], 'an Arabic comma ends a phrase');
  assert.deepEqual(latinPhrases('عربي PowerPoint 365 و Hindi.'), [[5, 19], [22, 27]]);
  assert.deepEqual(latinPhrases('2026 ٢٠٢٦'), []);
  assert.deepEqual(latinPhrases('a - b'), [[0, 5]]);
  // Text content is preserved exactly.
  const joined = nested.runs.map(run => run.text).join('');
  assert.equal(joined, 'العنصر الثاني: v2.0 و PowerPoint 365');
  // A left-to-right deck keeps its runs.
  assert.ok(shapes(ltr.xml, 1).every(shape => shape.runs.length <= 1));
}

// Master default levels start right-to-left and start at the right edge.
{
  const master = rtl.xml['ppt/slideMasters/slideMaster1.xml'];
  const levels = [...master.matchAll(/<a:lvl1pPr\b[^>]*>/g)].map(match => match[0]);
  assert.ok(levels.some(level => /\srtl="1"/.test(level) && /\salgn="r"/.test(level)));
  assert.ok(![...ltr.xml['ppt/slideMasters/slideMaster1.xml'].matchAll(/<a:lvl1pPr\b[^>]*>/g)].some(match => /\srtl="1"/.test(match[0])));
}

// An unchanged right-to-left export re-imports with its structure and logical alignment.
{
  const round = await fromPptx(rtl.bytes);
  assert.equal(round.language, 'ar');
  assert.equal(round.slides.length, 6);
  assert.equal(round.design?.contentAlignment, undefined, 'right-aligned right-to-left text is not imported as an explicit right alignment');
}

// Re-import of a right-to-left export raises no direction or language noise: the table direction is the deck's, and the en-US Latin
// phrase runs are not a second presentation language. A right-to-left table in a left-to-right deck still reports it.
{
  const codes = [], plain = unzipSync(new Uint8Array(await toPptx(deck('ar'), {provenance: false})));
  await fromPptx(await toPptx(deck('ar'), {provenance: false}), {onDiagnostic: diagnostic => codes.push(diagnostic.code)});
  assert.ok(Object.keys(plain).length > 0);
  assert.equal(codes.includes('unsupported-table-direction'), false);
  assert.equal(codes.includes('mixed-run-languages'), false);
  assert.equal(codes.includes('rtl-language-mismatch'), false);
  const entries = unzipSync(new Uint8Array(await toPptx(deck('en'), {provenance: false})));
  entries['ppt/slides/slide3.xml'] = strToU8(strFromU8(entries['ppt/slides/slide3.xml']).replace(/<a:tblPr/, '<a:tblPr rtl="1"'));
  const foreign = [];
  await fromPptx(zipSync(entries), {onDiagnostic: diagnostic => foreign.push(diagnostic.code)});
  assert.equal(foreign.includes('unsupported-table-direction'), true, 'a right-to-left table in a left-to-right deck is still reported');
}

console.log('RTL layout export passed: logical alignment, hanging bullets at the right, per-paragraph line direction, mirrored regions and tables, reversed column charts, en-US Latin runs, notes and master defaults.');
