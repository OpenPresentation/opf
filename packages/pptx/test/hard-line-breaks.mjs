import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';
import {validate} from '@openpresentation/opf';

// RR-09: rich text with hard line breaks (a newline inside a run, a blank line, a break between differently
// styled runs) exports as one native text shape per line and used to re-import as separate blocks with
// `content-structure-changed`. The slide record now stores the whitespace each line break held (never a word) beside
// the line count, so the authored payload returns exactly; whatever cannot be shown to rebuild keeps the diagnostic.
const enc = new TextEncoder(), dec = new TextDecoder();
const EXPORT = {timestamp: '2026-01-01T00:00:00Z', seed: 1, date: '2026-09-30'};
const read = async (bytes) => {
  const issues = [];
  const deck = await fromPptx(bytes, {onDiagnostic: issue => issues.push(issue)});
  assert.equal(validate(deck, {only: ['format']}).valid, true, JSON.stringify(validate(deck, {only: ['format']}).findings));
  return {deck, issues, provenance: issues.filter(issue => /provenance|reference|structure|slide-id|block-id/.test(issue.code))};
};
const modify = (bytes, mutate) => { const entries = unzipSync(bytes); mutate(entries); return zipSync(entries); };
const text = (entries, path, mutate) => { entries[path] = enc.encode(mutate(dec.decode(entries[path]))); };
const tagValue = xml => JSON.parse(Buffer.from(xml.match(/\bval="([^"]+)"/)[1], 'hex').toString('utf8'));
const retag = (xml, mutate) => { const value = tagValue(xml); mutate(value); return xml.replace(/val="[0-9A-F]+"/, `val="${Buffer.from(JSON.stringify(value)).toString('hex').toUpperCase()}"`); };
const slideRecord = (bytes, index = 1) => tagValue(dec.decode(unzipSync(bytes)[`ppt/tags/opfSlide${index}.xml`]));
const stripTags = bytes => {
  const entries = unzipSync(bytes), kept = {};
  for (const [name, data] of Object.entries(entries)) {
    if (/^ppt\/tags\//.test(name)) continue;
    if (name === '[Content_Types].xml') kept[name] = enc.encode(dec.decode(data).replace(/<Override [^>]*tags\+xml"[^>]*\/>/g, ''));
    else if (/\.rels$/.test(name)) kept[name] = enc.encode(dec.decode(data).replace(/<Relationship [^>]*relationships\/tags"[^>]*\/>/g, ''));
    else if (/\.xml$/.test(name)) kept[name] = enc.encode(dec.decode(data).replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g, ''));
    else kept[name] = data;
  }
  return zipSync(kept);
};
// What PowerPoint changes when it saves a deck: shape ids are renumbered, run properties gain editing attributes,
// the XML is reserialised; names, geometry, tags and text stay.
const resave = bytes => modify(bytes, entries => {
  for (const path of Object.keys(entries).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))) text(entries, path, xml => {
    let id = 40;
    return xml.replace(/<p:cNvPr id="\d+"/g, () => `<p:cNvPr id="${id++}"`)
      .replace(/<a:rPr /g, '<a:rPr dirty="0" err="0" ').replace(/<a:endParaRPr /g, '<a:endParaRPr dirty="0" ')
      .replace(/<\?xml[^>]*\?>/, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n').replace(/></g, '>\n<');
  });
});

// Imported runs carry resolved defaults: compare the words and the authored style, with equal neighbours merged.
const normalize = value => {
  const runs = (typeof value === 'string' ? [value] : value).map(run => typeof run === 'string' ? {text: run} : {...run});
  const merged = [];
  for (const run of runs) {
    for (const key of ['fontSize', 'fontFamily', 'color']) delete run[key];
    const last = merged.at(-1);
    if (last && JSON.stringify({...last, text: ''}) === JSON.stringify({...run, text: ''})) last.text += run.text;
    else merged.push(run);
  }
  return merged;
};
const roundTrip = async (slide, {strip = false, save = false} = {}) => {
  let bytes = await toPptx({name: 'Breaks', slides: [{title: 'Probe', ...slide}]}, EXPORT);
  const record = slideRecord(bytes).content;
  if (save) bytes = resave(bytes);
  if (strip) bytes = stripTags(bytes);
  return {bytes, record, ...await read(bytes)};
};
const shapes = bytes => [...dec.decode(unzipSync(bytes)['ppt/slides/slide1.xml']).matchAll(/<p:cNvPr id="\d+" name="Text \d+"/g)].length;
const long = 'The quick brown fox jumps over the lazy dog and keeps running across the wide open field until the sun sets behind the distant hills and everyone goes home, and then it sleeps.';

// --- Every authored form returns exactly, with and without a PowerPoint-style re-save -------------------------
const cases = {
  'newline inside the second run': [{text: 'First paragraph', bold: true}, {text: '\nSecond paragraph'}],
  'newline ending the first run': [{text: 'First paragraph\n', bold: true}, {text: 'Second paragraph'}],
  'one run with a newline': [{text: 'First\nSecond'}],
  'plain string runs': ['One\nTwo', 'Three'],
  'blank line': [{text: 'A\n\nB'}],
  'several blank lines': [{text: 'A', italic: true}, {text: '\n\n\nB'}],
  'carriage return and line feed': [{text: 'A\r\nB'}],
  'trimmed spaces at a break': [{text: 'A  \n  B'}],
  'bold, then the same style across the break': [{text: 'A\n', bold: true}, {text: '\n', bold: true}, {text: 'B'}],
  'soft wraps and hard breaks together': [{text: 'Bold start ', bold: true}, {text: `${long}\n\n${long} tail`}, {text: '\nlast', italic: true, color: '#0F172A'}],
  'strike and underline on a later paragraph': [{text: 'Intro\n'}, {text: 'More', strikethrough: true, underline: true}]
};
for (const save of [false, true]) {
  for (const [name, runs] of Object.entries(cases)) {
    const label = `${name}${save ? ' (re-saved)' : ''}`;
    const result = await roundTrip({text: runs}, {save});
    const {wrap} = result.record;
    assert.ok(wrap.lines >= 2, `${label}: the record counts the lines`);
    assert.equal(wrap.lines, shapes(result.bytes), `${label}: the count is the number of native line shapes`);
    assert.equal(result.record.lines, undefined, `${label}: an importer before RR-09 sees no marker and keeps the flat blocks`);
    assert.ok(Array.isArray(wrap.gaps), `${label}: the hard breaks are recorded`);
    assert.equal(wrap.gaps.length, wrap.lines - 1, label);
    assert.ok(wrap.gaps.flat().every(gap => typeof gap === 'number' || /^[ \t\r\n]*$/.test(gap)), `${label}: gaps hold whitespace only`);
    assert.equal(JSON.stringify(result.record).includes('First'), false, `${label}: no words in the record`);
    assert.deepEqual(result.provenance, [], label);
    assert.equal(result.deck.slides[0].blocks, undefined, label);
    assert.deepEqual(normalize(result.deck.slides[0].text), normalize(runs), label);
  }
}

// --- Root, group, region and blocks: ids, extensions and neighbours are untouched -----------------------------
{
  const runs = [{text: 'Heading', bold: true}, {text: `\n${long}`}];
  const group = await roundTrip({blocks: [{type: 'group', id: 'g', blocks: [{type: 'text', id: 't', text: runs, extensions: {'x-a': 1}}, {type: 'text', text: 'Short'}]}, {type: 'text', text: 'Outer'}]});
  assert.deepEqual(group.provenance, []);
  const [grouped, outer] = group.deck.slides[0].blocks;
  assert.deepEqual([grouped.id, grouped.type, grouped.blocks[0].id, grouped.blocks[0].extensions, grouped.blocks[1].text, outer.text], ['g', 'group', 't', {'x-a': 1}, 'Short', 'Outer']);
  assert.deepEqual(normalize(grouped.blocks[0].text), normalize(runs));

  const region = await roundTrip({left: {text: runs}, right: {text: [{text: 'R1\n'}, {text: 'R2', bold: true}]}});
  assert.deepEqual(region.provenance, []);
  assert.equal(region.deck.slides[0].blocks, undefined);
  assert.deepEqual(normalize(region.deck.slides[0].left.text), normalize(runs));
  assert.deepEqual(normalize(region.deck.slides[0].right.text), [{text: 'R1\n'}, {text: 'R2', bold: true}]);

  const sibling = await roundTrip({blocks: [{text: runs}, {type: 'list', items: ['a', 'b']}, {type: 'text', text: 'Tail'}]});
  assert.deepEqual(sibling.provenance, []);
  assert.deepEqual(normalize(sibling.deck.slides[0].blocks[0].text), normalize(runs));
  assert.equal(sibling.deck.slides[0].blocks[2].text, 'Tail');
}

// --- Other multi-line text still returns whole (title, subtitle, quote, a plain string) -----------------------
{
  const result = await roundTrip({subtitle: 'Line one\nLine two', quote: {text: 'Q one\nQ two', attribution: 'Me'}});
  assert.deepEqual(result.provenance, []);
  assert.equal(result.deck.slides[0].subtitle, 'Line one\nLine two');
  assert.deepEqual(result.deck.slides[0].quote, {text: 'Q one\nQ two', attribution: 'Me'});
  const plain = await roundTrip({text: 'Para one\nPara two\n\nPara four'});
  assert.deepEqual(plain.provenance, []);
  assert.equal(plain.deck.slides[0].text, 'Para one\nPara two\n\nPara four');
  const heading = await roundTrip({blocks: [{type: 'quote', quote: 'A\nB'}, {type: 'text', text: 'x'}]});
  assert.equal(heading.deck.slides[0].blocks[0].quote, 'A\nB');
}

// --- What cannot be shown to rebuild keeps the flat blocks and the diagnostic ---------------------------------
{
  // A differently styled run inside the break: which run holds each character is unknown.
  const inside = await roundTrip({text: [{text: 'A', bold: true}, {text: '\n', italic: true}, {text: 'B'}]});
  assert.equal(inside.record.lines, undefined);
  assert.equal(inside.record.wrap, undefined);
  assert.deepEqual(inside.provenance.map(issue => [issue.code, issue.path]), [['content-structure-changed', 'slides.0']]);
  assert.equal(inside.deck.slides[0].text, undefined);
  assert.deepEqual(inside.deck.slides[0].blocks.map(block => normalize(block.text)), [[{text: 'A', bold: true}], [{text: 'B'}]]);
}

// --- Edited and damaged decks ------------------------------------------------------------------------------------
{
  const runs = [{text: 'First paragraph', bold: true}, {text: `\nSecond ${long}`}];
  const base = await roundTrip({text: runs});
  // Retyped words keep their place; the recorded break returns around the current text.
  const retyped = await read(modify(base.bytes, entries => text(entries, 'ppt/slides/slide1.xml', xml => xml.replace('First paragraph', 'Opening line'))));
  assert.deepEqual(retyped.provenance, []);
  assert.deepEqual(normalize(retyped.deck.slides[0].text)[0], {text: 'Opening line', bold: true});
  assert.equal(normalize(retyped.deck.slides[0].text)[1].text.startsWith('\nSecond'), true);
  // A deleted line changes the slide's shapes: the structure is not applied and nothing is rejoined.
  const deleted = await read(modify(base.bytes, entries => text(entries, 'ppt/slides/slide1.xml', xml => xml.replace(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?name="Text 2"[\s\S]*?<\/p:sp>/, ''))));
  assert.deepEqual(deleted.provenance.map(issue => [issue.code, issue.path]), [['slide-reference-changed', 'slides.0.content']]);
  assert.equal(deleted.deck.slides[0].text, undefined);
  // A record whose count no longer matches the lines reports and keeps the flat blocks.
  for (const lines of [base.record.wrap.lines + 1, base.record.wrap.lines - 1]) {
    const gaps = Array.from({length: lines - 1}, () => '');
    const mismatch = await read(modify(base.bytes, entries => text(entries, 'ppt/tags/opfSlide1.xml', xml => retag(xml, value => { value.content.wrap = {lines, gaps}; }))));
    assert.deepEqual(mismatch.provenance.map(issue => [issue.code, issue.path]), [['content-structure-changed', 'slides.0']], `count ${lines}`);
    assert.equal(mismatch.deck.slides[0].text, undefined);
  }
  // Damaged gaps reject the slide tag as a whole.
  for (const [name, mutate] of Object.entries({
    'a word as a gap': value => { value.content.wrap.gaps[0] = 'word'; },
    'a number': value => { value.content.wrap.gaps[0] = 1; },
    'too few gaps': value => { value.content.wrap.gaps = value.content.wrap.gaps.slice(1); },
    'too many gaps': value => { value.content.wrap.gaps = [...value.content.wrap.gaps, '\n']; },
    'not a list': value => { value.content.wrap.gaps = '\n'; },
    'a long gap': value => { value.content.wrap.gaps[0] = ' '.repeat(300); },
    'a kept count of zero': value => { value.content.wrap.gaps[0] = ['\n', 0]; },
    'a kept count beyond the gap': value => { value.content.wrap.gaps[0] = ['\n', 2]; },
    'a split gap with a word': value => { value.content.wrap.gaps[0] = ['x\n', 1]; },
    'gaps without lines': value => { delete value.content.wrap.lines; },
    'one line': value => { value.content.wrap.lines = 1; value.content.wrap.gaps = []; },
    'wrap that is not an object': value => { value.content.wrap = 3; },
    'wrap on a list leaf': value => { value.content.field = 'items'; }
  })) {
    const damaged = await read(modify(base.bytes, entries => text(entries, 'ppt/tags/opfSlide1.xml', xml => retag(xml, mutate))));
    assert.deepEqual(damaged.provenance.map(issue => [issue.code, issue.path]), [['invalid-document-provenance', 'slides.0']], name);
  }
  // A deck exported before RR-09 (a count only, no gaps) still rejoins pure soft wraps.
  const soft = await roundTrip({text: [{text: 'Bold start ', bold: true}, {text: long}]});
  assert.equal(soft.record.wrap, undefined, 'Pure soft wraps keep the lines form older importers read');
  assert.ok(soft.record.lines >= 2);
  assert.deepEqual(soft.provenance, []);
  assert.deepEqual(normalize(soft.deck.slides[0].text), [{text: 'Bold start ', bold: true}, {text: long}]);
}

// --- Plain PPTX (no OPF record): lines stay separate, nothing is invented -----------------------------------------
{
  const plain = await roundTrip({text: [{text: 'First paragraph', bold: true}, {text: `\nSecond paragraph`}]}, {strip: true});
  assert.deepEqual(plain.provenance, []);
  assert.equal(plain.deck.slides[0].text, undefined);
  assert.deepEqual(plain.deck.slides[0].blocks.map(block => normalize(block.text).map(run => run.text).join('')), ['First paragraph', 'Second paragraph']);
}

// --- Hard breaks inside list items (root, group, region, nested levels, descriptions) -----------------------------
{
  const textOf = value => value === undefined ? undefined : typeof value === 'string' ? value : value.map(run => typeof run === 'string' ? run : run.text).join('');
  // Words, newlines, levels and descriptions of a list, whatever the run structure.
  const flat = items => items.map(item => Array.isArray(item) || typeof item === 'string' ? {text: textOf(item)}
    : {text: textOf(item.text), ...(item.description === undefined ? {} : {description: textOf(item.description)}), ...(item.level ? {level: item.level} : {})});
  const items = [
    [{text: 'Bold\nbroken', bold: true}, ' tail'],
    {text: 'Head\nsecond line of the head', description: 'Detail one\nDetail two'},
    {text: 'Nested', level: 1, description: 'Blank\n\nline in a description'},
    'Plain\n\nblank line in an item',
    {text: [{text: 'Run ', bold: true}, {text: 'ends\n'}, {text: 'styled', italic: true}], level: 2},
    {text: 'Soft wrap: ' + long, description: 'A description that wraps the same way: ' + long + '\nthen breaks'},
    {text: 'Last'}
  ];
  const bulletItems = items.filter(item => typeof item === 'string' || Array.isArray(item) || !item.description);
  const forms = {
    root: [{items}, items, slide => slide.items],
    bullets: [{bullets: bulletItems}, bulletItems, slide => slide.bullets],
    group: [{blocks: [{type: 'group', id: 'g', blocks: [{items}, {type: 'text', text: 'beside'}]}]}, items, slide => slide.blocks[0].blocks[0].items],
    region: [{left: {items}, right: {text: 'R'}}, items, slide => slide.left.items],
    blocks: [{blocks: [{items}, {items: ['p\nq', 'r']}]}, items, slide => slide.blocks[0].items]
  };
  for (const save of [false, true]) for (const [name, [slide, authored, pick]] of Object.entries(forms)) {
    const result = await roundTrip(slide, {save});
    assert.deepEqual(result.provenance, [], `${name} save ${save}`);
    assert.deepEqual(flat(pick(result.deck.slides[0])), flat(authored), `${name} save ${save}`);
    assert.ok(Array.isArray(slideRecord(result.bytes).lists), `${name}: the breaks are recorded`);
    // Whitespace only, keyed by list path and line number: no word reaches the record.
    assert.equal(/Detail|Head|Plain|Nested|Soft|Last|Bold/.test(JSON.stringify(slideRecord(result.bytes).lists)), false, name);
  }

  // The record is a list of [path, [[line, gap]...]] with whitespace gaps and increasing line numbers.
  const exported = await roundTrip({items: ['A\nB', {text: 'C', description: 'D\n\nE'}]});
  assert.deepEqual(slideRecord(exported.bytes).lists, [['slides.0.items', [[1, '\n'], [5, '\n\n']]]]);
  assert.deepEqual(flat(exported.deck.slides[0].items), [{text: 'A\nB'}, {text: 'C', description: 'D\n\nE'}]);
  // A blank line is never a description; no description is invented.
  assert.equal(JSON.stringify(exported.deck.slides[0].items).includes('"description":""'), false);
  // A list with no hard break stores nothing.
  assert.equal(slideRecord(await toPptx({name: 'None', slides: [{title: 'T', items: ['a', 'b', {text: 'c', description: 'd'}]}]}, EXPORT)).lists, undefined);

  // Edited text keeps the recorded separator; a deleted line changes the arrangement, so nothing is applied.
  const retyped = await read(modify(exported.bytes, entries => text(entries, 'ppt/slides/slide1.xml', xml => xml.replace('>B<', '>Bee<'))));
  assert.deepEqual(flat(retyped.deck.slides[0].items)[0], {text: 'A\nBee'});
  const removed = await read(modify(exported.bytes, entries => text(entries, 'ppt/slides/slide1.xml', xml => xml.replace(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?name="OPF list slides\.0\.items line 4"[\s\S]*?<\/p:sp>/, ''))));
  assert.ok(removed.issues.some(issue => issue.code === 'slide-reference-changed'));
  // A recorded break whose line is no longer a continuation reports instead of guessing.
  const moved = await read(modify(exported.bytes, entries => text(entries, 'ppt/tags/opfSlide1.xml', xml => retag(xml, value => { value.lists[0][1] = [[0, '\n']]; }))));
  assert.ok(moved.issues.some(issue => issue.code === 'list-line-break-changed' && issue.path === 'slides.0'));
  assert.deepEqual(flat(moved.deck.slides[0].items), [{text: 'AB'}, {text: 'C', description: 'DE'}]);
  // Damaged records reject the slide tag as a whole.
  for (const [name, mutate] of Object.entries({
    'not a list': value => { value.lists = {}; },
    'empty': value => { value.lists = []; },
    'a prototype key as a path': value => { value.lists[0][0] = '__proto__'; },
    'a path outside the slides': value => { value.lists[0][0] = 'items'; },
    'a repeated path': value => { value.lists.push(structuredClone(value.lists[0])); },
    'a word as a gap': value => { value.lists[0][1][0][1] = 'word'; },
    'an empty gap': value => { value.lists[0][1][0][1] = ''; },
    'a long gap': value => { value.lists[0][1][0][1] = ' '.repeat(300); },
    'a split gap out of range': value => { value.lists[0][1][0][1] = ['\n', 5]; },
    'a negative line': value => { value.lists[0][1][0][0] = -1; },
    'a fractional line': value => { value.lists[0][1][0][0] = 1.5; },
    'unordered lines': value => { value.lists[0][1] = [[4, '\n'], [1, '\n']]; },
    'no lines': value => { value.lists[0][1] = []; },
    'too many lines': value => { value.lists[0][1] = Array.from({length: 20001}, (_, index) => [index, '\n']); },
    'too many lists': value => { value.lists = Array.from({length: 257}, (_, index) => [`slides.0.items.${index}`, [[1, '\n']]]); }
  })) {
    const damaged = await read(modify(exported.bytes, entries => text(entries, 'ppt/tags/opfSlide1.xml', xml => retag(xml, mutate))));
    assert.deepEqual(damaged.provenance.map(issue => [issue.code, issue.path]), [['invalid-document-provenance', 'slides.0']], name);
    assert.deepEqual(flat(damaged.deck.slides[0].blocks.flatMap(block => block.items ?? [])), [{text: 'AB'}, {text: 'C', description: 'DE'}], name);
  }
  // The unrecorded shape of a list: plain PPTX joins continuation lines (it cannot tell a wrap from a break) but never
  // invents a description from a blank line.
  const plain = await roundTrip({items: ['Plain\n\nz', {text: 'x', description: 'q\n\nr'}]}, {strip: true});
  assert.deepEqual(flat(plain.deck.slides[0].blocks[0].items), [{text: 'Plainz'}, {text: 'x', description: 'qr'}]);
  // A break that cannot be recorded exactly is reported at export, and the import says so.
  const issues = [];
  const unprovable = await toPptx({name: 'Unprovable', slides: [{title: 'T', items: ['a\nb\n', 'ok']}]}, {...EXPORT, onDiagnostic: issue => issues.push(issue)});
  assert.deepEqual(issues.filter(issue => issue.code === 'document-provenance-omitted').map(issue => issue.path), ['slides.0.items']);
  assert.ok((await read(unprovable)).issues.some(issue => issue.code === 'document-provenance-omitted' && issue.path === 'slides.0.items'));
}

console.log('Hard line break checks passed: newline inside and between runs, blank lines, CRLF, trimmed spaces, soft wraps with hard breaks, root, group, region and blocks, a PowerPoint-style re-save, edited and damaged records, unprovable runs, plain PPTX, and hard breaks inside list items (root, bullets, group, region, nested levels, descriptions).');
