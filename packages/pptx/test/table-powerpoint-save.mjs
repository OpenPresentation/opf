// opf-pptx#241: a PowerPoint save keeps tables plain on import. A save drops attributes that hold their schema default
// (anchor="t" on every a:tcPr), reorders the a:pPr attributes and adds an a16:colId extension to every a:gridCol (and an
// a16:rowId to every a:tr). The recorded table evidence reads the native table with those defaults applied, so an untouched
// save is still deep-equal to the source; a cell really edited in PowerPoint still comes back as observed, and only that cell.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {fromPptx, toPptx} from '../dist/index.js';
import {tableCellEvidence} from '../dist/data-provenance.js';
import {decodeTextTag, encodeTextTag} from '../dist/code-provenance.js';

const edit = (bytes, transform) => {
  const parts = unzipSync(bytes);
  for (const name of Object.keys(parts)) if (/\.(xml|rels)$/.test(name)) parts[name] = strToU8(transform(name, strFromU8(parts[name])));
  return zipSync(parts);
};
const slidePart = /^ppt\/slides\/slide\d+\.xml$/;
const COL_ID = n => `<a:extLst><a:ext uri="{9D8B030D-6E8A-4147-A177-3AD203B41FA5}"><a16:colId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" val="${20000 + n}"/></a:ext></a:extLst>`;
const ROW_ID = n => `<a:extLst><a:ext uri="{0D108BD9-81ED-4DB2-BD59-A6C34878D82A}"><a16:rowId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" val="${10000 + n}"/></a:ext></a:extLst>`;
// Attributes PowerPoint leaves out because they hold their default (CT_TableCellProperties).
const DEFAULTS = {marL: '91440', marR: '91440', marT: '45720', marB: '45720', anchor: 't', anchorCtr: '0', horzOverflow: 'clip', vert: 'horz'};
const powerPointSave = xml => {
  let column = 0, row = 0;
  return xml
    // Drop default-valued attributes from every a:tcPr.
    .replace(/<a:tcPr\b([^>]*?)(\/?)>/g, (_match, attributes, close) => `<a:tcPr${attributes.replace(/\s([\w:]+)="([^"]*)"/g, (all, name, value) => DEFAULTS[name] === value ? '' : all)}${close}>`)
    // Reorder the a:pPr attributes (the export writes algn, indent, marL; a save writes marL, indent, algn).
    .replace(/<a:pPr\b([^>]*)>/g, (_match, attributes) => `<a:pPr${[...attributes.matchAll(/\s([\w:]+)="([^"]*)"/g)].reverse().map(([, name, value]) => ` ${name}="${value}"`).join('')}>`)
    // Whitespace between child elements, which a save does not keep.
    .replace(/\s+(<\/a:tcPr>)/g, '$1').replace(/(<\/a:tcPr>)\s+(<\/a:tc>)/g, '$1$2')
    .replace(/<a:gridCol w="(\d+)"\/>/g, (_match, width) => `<a:gridCol w="${width}">${COL_ID(column++)}</a:gridCol>`)
    .replace(/<\/a:tc><\/a:tr>/g, () => `</a:tc>${ROW_ID(row++)}</a:tr>`);
};
const saveAs = bytes => edit(bytes, (name, xml) => slidePart.test(name) ? powerPointSave(xml) : xml);
const tableDeck = {slides: [
  {title: 'Plain', blocks: [{table: {columns: ['A', 'B'], rows: [[1, 2], [3, 4]]}}]},
  {title: 'Rich', blocks: [{table: {columns: ['Name', 'Note'], rows: [['Alpha', [{text: 'bold', bold: true}, ' and plain']], ['Beta', [{text: 'red', color: '#FF0000'}]]]}}]},
  {title: 'Numbers', blocks: [{table: {columns: ['Item', 'Value'], rows: [['One', 1.5], ['Two', 20000], ['Three', -3]]}}]},
  {title: 'Headerless', blocks: [{table: {rows: [['a', 'b'], ['c', 'd']]}}]},
]};
const read = (bytes, diagnostics = []) => fromPptx(bytes, {onDiagnostic: issue => diagnostics.push(issue)});
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
let checks = 0;

// 1. The untouched export is deep-equal to the source, and so is the same file after a PowerPoint-style save.
const exported = await toPptx(structuredClone(tableDeck));
assert.deepEqual(await read(exported), tableDeck, 'the export round trip is deep-equal');
const saved = saveAs(exported);
{
  const xml = strFromU8(unzipSync(saved)['ppt/slides/slide1.xml']);
  assert.notEqual(xml, strFromU8(unzipSync(exported)['ppt/slides/slide1.xml']), 'the transform changes the slide');
  assert.ok(!/<a:tcPr[^>]*\banchor=/.test(xml), 'the save dropped anchor="t" from every a:tcPr');
  assert.ok(/<a16:colId\b/.test(xml) && /<a16:rowId\b/.test(xml) && /<a:pPr marL="0" indent="0" algn="l"/.test(xml), 'the save added the identity extensions and reordered a:pPr');
}
const diagnostics = [];
assert.deepEqual(await read(saved, diagnostics), tableDeck, 'a save without edits is deep-equal to the source');
assert.deepEqual(diagnostics.filter(issue => /table/.test(issue.code)), [], 'no table diagnostics on an untouched save');
checks += 5;

// 2. A cell really edited in PowerPoint (a changed fill in one a:tcPr) comes back as observed; every other cell stays plain.
{
  let first = true;
  const edited = edit(saved, (name, xml) => name !== 'ppt/slides/slide1.xml' ? xml : xml.replace(/<a:tcPr\b[^>]*>[\s\S]*?<\/a:tcPr>/g, properties => {
    if (!first) return properties;
    first = false;
    return properties.replace(/<a:solidFill><a:schemeClr val="accent1"\/><\/a:solidFill>(?![\s\S]*<a:solidFill>)/, '<a:solidFill><a:srgbClr val="00FF00"/></a:solidFill>');
  }));
  const diagnostics = [];
  const result = await read(edited, diagnostics);
  const table = result.slides[0].blocks[0].table;
  assert.equal(typeof table.columns[0], 'object', 'the edited header cell is an explicit style object');
  assert.equal(table.columns[0].style.fill, '#00FF00', 'with the edited fill');
  assert.equal(table.columns[1], 'B', 'the other header cell stays plain');
  assert.deepEqual(table.rows, [[1, 2], [3, 4]], 'the body cells stay plain');
  assert.deepEqual(result.slides.slice(1), tableDeck.slides.slice(1), 'the other slides stay deep-equal');
  assert.ok(diagnostics.some(issue => issue.code === 'table-data-provenance-changed'), 'the edit is reported');
  checks += 6;
}

// 3. The evidence: an absent attribute and its default are one value; attribute order and the identity extensions do not matter.
{
  const cell = (properties, paragraph = '<a:pPr marL="0" indent="0" algn="l"/>') => `<a:tbl><a:tblGrid><a:gridCol w="100"/></a:tblGrid><a:tr h="1"><a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p>${paragraph}<a:r><a:t>x</a:t></a:r></a:p></a:txBody><a:tcPr${properties}/></a:tc></a:tr></a:tbl>`;
  const evidence = xml => tableCellEvidence(parser.parse(xml)['a:tbl'])[0][0];
  const base = evidence(cell(''));
  for (const [label, properties] of [
    ['anchor t', ' anchor="t"'], ['default margins', ' marL="91440" marR="91440" marT="45720" marB="45720"'],
    ['anchorCtr 0', ' anchorCtr="0"'], ['anchorCtr false', ' anchorCtr="false"'], ['horzOverflow clip', ' horzOverflow="clip"'], ['vert horz', ' vert="horz"'],
    ['every default, any order', ' anchor="t" anchorCtr="0" horzOverflow="clip" marL="91440" marT="45720" marB="45720" marR="91440" vert="horz"'],
  ]) { assert.equal(evidence(cell(properties)), base, `${label} is the absent value`); checks++; }
  assert.equal(evidence(cell('', '<a:pPr algn="l" marL="0" indent="0"/>')), base, 'a:pPr attribute order');
  assert.equal(evidence(cell('', '<a:pPr/>')), base, 'a:pPr marL/indent/algn at their defaults are absent');
  assert.equal(evidence(cell('').replace('<a:gridCol w="100"/>', `<a:gridCol w="100">${COL_ID(0)}</a:gridCol>`)), base, 'a16:colId');
  assert.equal(evidence(cell('').replace('</a:tc>', `</a:tc>${ROW_ID(0)}`)), base, 'a16:rowId');
  checks += 4;
  // Non-default values are still content.
  for (const properties of [' anchor="ctr"', ' anchor="b"', ' marL="95250"', ' anchorCtr="1"', ' horzOverflow="overflow"', ' vert="vert"']) {
    assert.notEqual(evidence(cell(properties)), base, `${properties.trim()} is a real change`);
    checks++;
  }
  assert.notEqual(evidence(cell('', '<a:pPr algn="ctr"/>')), base, 'a changed alignment is a real change');
  assert.notEqual(evidence(cell('').replace('<a:t>x</a:t>', '<a:t> </a:t>')), evidence(cell('').replace('<a:t>x</a:t>', '<a:t></a:t>')), 'text whitespace stays content');
  checks += 2;
}

// 4. A record written before this fix hashes the raw XML (the exporter's anchor="t" and whitespace included): an untouched file
// still restores, and so does its PowerPoint save.
{
  const parts = unzipSync(exported);
  let rewritten = 0;
  for (const name of Object.keys(parts).filter(path => /^ppt\/tags\/opfData\d+\.xml$/.test(path))) {
    const tag = strFromU8(parts[name]);
    const record = decodeTextTag(tag.match(/\bval="([^"]+)"/)[1]);
    if (record.kind !== 'table') continue;
    // opfData<n> is the n-th recorded frame, in slide order: one table per slide here.
    const slide = strFromU8(parts[`ppt/slides/slide${name.match(/(\d+)\.xml$/)[1]}.xml`]);
    const table = parser.parse(slide)['p:sld']['p:cSld']['p:spTree']['p:graphicFrame']['a:graphic']['a:graphicData']['a:tbl'];
    record.evidence = tableCellEvidence(table, new Map(), {form: 'raw'});
    parts[name] = strToU8(tag.replace(/\bval="[^"]+"/, `val="${encodeTextTag(record)}"`));
    rewritten++;
  }
  assert.equal(rewritten, tableDeck.slides.length, 'every table record was rewritten to raw evidence');
  const older = zipSync(parts);
  assert.notDeepEqual(unzipSync(older), unzipSync(exported), 'the records differ from the current form');
  assert.deepEqual(await read(older), tableDeck, 'an older untouched export restores');
  assert.deepEqual(await read(saveAs(older)), tableDeck, 'an older export saved by PowerPoint restores');
  checks += 4;
}

// 5. A real PowerPoint 16.0 save (build 20430, no edits) of the plain table, exported before this fix.
{
  const fixture = fs.readFileSync(new URL('./fixtures/table-powerpoint-saved.pptx', import.meta.url));
  const parts = unzipSync(fixture);
  for (const name of ['docProps/core.xml', 'docProps/app.xml']) assert.ok(!/micha|grimm/i.test(strFromU8(parts[name])), `${name} names no person`);
  assert.ok(!/<a:tcPr[^>]*\banchor=/.test(strFromU8(parts['ppt/slides/slide1.xml'])), 'the real save dropped anchor="t" from every a:tcPr');
  const source = {slides: [{title: 'Plain table', blocks: [{table: {columns: ['A', 'B'], rows: [[1, 2], [3, 4]]}}]}]};
  assert.deepEqual(await read(fixture), source, 'a real PowerPoint save imports deep-equal to its source');
  checks += 4;
}
console.log(`PowerPoint-saved tables import plain (${checks} checks).`);
