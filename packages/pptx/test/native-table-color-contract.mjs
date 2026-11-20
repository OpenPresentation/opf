import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {toPptx} from '../dist/index.js';
import {colorHex, themeColorsOf, clrMapOf} from './helpers/scheme-colors.mjs';
import {tableColorDocument} from '../../../scripts/native-acceptance/table-colors.mjs';
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false});
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const find = (value, key) => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(item => find(item, key)) : Object.entries(value).flatMap(([name, child]) => name === key ? array(child) : find(child, key));
const {document, expected} = tableColorDocument(), before = structuredClone(document);
// RR-96: #767676 meets the white contrast threshold but black has higher
// contrast. Native preparation must agree with actual maintained export bytes.
assert.equal(expected[3].fill, '#767676');
assert.equal(expected[3].cells[0].runs[0].color, '#000000');
assert.equal(expected[2].cells[0].runs[0].color, '#000000');
assert.equal(expected[4].cells[0].runs[0].color, '#FFFFFF');
assert.equal(expected[5].explicit, '#FFFFFF');
assert.equal(expected[5].cells[0].runs[0].color, '#FFFFFF');
const parts = unzipSync(await toPptx(document));
const decode = relative => new TextDecoder().decode(parts[relative]);
const theme = themeColorsOf(decode('ppt/theme/theme1.xml'));
const clrMap = clrMapOf(decode('ppt/slideMasters/slideMaster1.xml'));
let cells = 0, runs = 0;
for (const [index, slide] of expected.entries()) {
  const tables = find(parser.parse(decode('ppt/slides/slide' + (index + 1) + '.xml')), 'a:tbl');
  assert.equal(tables.length, 1);
  const rows = array(tables[0]['a:tr']); assert.equal(rows.length, 2);
  for (const cell of slide.cells) {
    const actual = find(array(rows[cell.row - 1]['a:tc'])[cell.column - 1], 'a:r');
    assert.equal(actual.length, cell.runs.length); cells++;
    for (const [i, run] of cell.runs.entries()) {
      assert.equal(actual[i]['a:t'], run.text);
      assert.equal('#' + colorHex(actual[i]['a:rPr']['a:solidFill'], theme, clrMap), run.color, JSON.stringify({slide: index + 1, row: cell.row, column: cell.column, text: run.text, fill: slide.fill}));
      runs++;
    }
  }
}
assert.equal(cells, 24); assert.equal(runs, 36);
assert.deepEqual(document, before);
console.log('Canonical native table expectations match actual OOXML: all24cells/36runs, maximum-contrast boundary, alpha, explicit override and mixed rich colors. No Office invoked.');
