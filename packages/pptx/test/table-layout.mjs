import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import { composeSlide } from '@openpresentation/opf/composition';
import { renderSvg } from '@openpresentation/opf-render/svg';
import { loadOfficeFontRegistry } from '@openpresentation/opf-render/fonts-node';
import { toPptx } from '../dist/index.js';

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });
const fonts = await loadOfficeFontRegistry();
const array = value => value == null ? [] : Array.isArray(value) ? value : [value];
function find(value, key) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(item => find(item, key));
  return Object.entries(value).flatMap(([name, child]) => name === key ? array(child) : find(child, key));
}
let checked = 0, shrunk = 0, grown = 0;
for (const scale of [1, 0.5]) {
for (const [fontScheme, family] of [['roboto', 'Roboto'], [{major:'Calibri',minor:'Calibri'}, 'Carlito']]) {
for (const align of ['left', 'center', 'right']) {
  for (const withHeaders of [true, false]) {
    const table = {
      ...(withHeaders ? { columns: ['Region', 'Description'] } : {}),
      rows: [
        ['North America', 'A detailed description that must shrink to fit this narrow table cell.'],
        [false, 0],
        [null],
      ],
    };
    const deck = { design: { fontScheme, theme: 'classic', contentAlignment: align, dimensions: {widthInches: 1280 * scale / 96, heightInches: 720 * scale / 96} }, slides: [{
      title: 'Measured table', composition: { mode: 'row', weights: [1, 4], minFontSize: 14 },
      blocks: [{ composition: { mode: 'column', minFontSize: 8 }, blocks: [{ table }] }, { text: 'Supporting context' }],
    }] };
    const geometry = composeSlide(deck.slides[0], { width: 1280 * scale, height: 720 * scale, fonts: {body:family,heading:family}, textMeasurement: fonts.textMeasurement });
    const item = geometry.items.find(item => item.field === 'table');
    const svg = parser.parse(renderSvg(deck, { trace: true, textMeasurement: fonts.textMeasurement }));
    const bytes = await toPptx(deck, { textMeasurement: fonts.textMeasurement });
    const xml = parser.parse(new TextDecoder().decode(unzipSync(bytes)['ppt/slides/slide1.xml']));
    const frame = find(xml, 'p:graphicFrame').find(frame => find(frame, 'a:tbl').length);
    const transform = frame['p:xfrm'];
    for (const [attribute, expected] of [['x', item.box.x], ['y', item.box.y]]) {
      assert.ok(Math.abs(Number(transform['a:off'][`@_${attribute}`]) / 9525 - expected) < 0.001, 'Native table origin matches shared geometry');
    }
    assert.ok(Math.abs(Number(transform['a:ext']['@_cx']) / 9525 - item.box.width) < 0.001, 'Native table width matches shared geometry');
    const nativeTable = find(xml, 'a:tbl')[0];
    for (const column of array(nativeTable['a:tblGrid']['a:gridCol'])) {
      assert.ok(Math.abs(Number(column['@_w']) / 9525 - item.box.width / 2) < 0.001, 'Native column widths match preview cells');
    }

    const rows = array(nativeTable['a:tr']);
    const expectedRows = withHeaders ? [table.columns, ...table.rows] : table.rows;
    assert.equal(rows.length, expectedRows.length);
    for (const [r, row] of rows.entries()) {
      const firstPath = withHeaders && r === 0 ? `${item.path}.columns.0` : `${item.path}.rows.${r - Number(withHeaders)}.0`;
      const rectangle = find(svg, 'rect').find(rect => rect['@_data-opf-path'] === firstPath);
      const rowHeight = Number(rectangle['@_height']);
      assert.ok(Math.abs(Number(row['@_h']) / 9525 - rowHeight) < 0.001, 'Native row geometry matches preview');
      if (rowHeight > 54 * scale + .001) grown++;
      const cells = array(row['a:tc']);
      assert.equal(cells.length, 2, 'Ragged rows retain every table column');
      for (const [c, cell] of cells.entries()) {
        const path = withHeaders && r === 0 ? `${item.path}.columns.${c}` : `${item.path}.rows.${r - Number(withHeaders)}.${c}`;
        const text = find(svg, 'text').filter(text => text['@_data-opf-path'] === path);
        const rectangle = find(svg, 'rect').find(rect => rect['@_data-opf-path'] === path);
        const nativeColor = fill => fill['a:srgbClr']['@_val'];
        assert.equal(nativeColor(cell['a:tcPr']['a:solidFill']), rectangle['@_fill'].slice(1), 'Native cell fill matches the theme preview');
        assert.equal(nativeColor(cell['a:tcPr']['a:lnL']['a:solidFill']), rectangle['@_stroke'].slice(1), 'Native cell border matches the theme preview');
        const value = expectedRows[r][c];
        assert.equal(find(cell, 'a:t').join(''), String(value ?? ''), 'Native cells preserve original values without inserting wrap characters');
        if (!text.length) continue;
        const expectedSize = Number(text[0]['@_font-size']);
        const props = find(cell, 'a:rPr');
        for (const prop of props) {
          assert.equal(Number(prop['@_sz']), Math.round(expectedSize * 75), `${path} uses the preview font size`);
          assert.equal(find(prop, 'a:latin')[0]['@_typeface'], family);
        }
        const pPr = find(cell, 'a:pPr')[0];
        assert.equal(pPr['@_algn'] ?? 'l', {left:'l',center:'ctr',right:'r'}[align], 'Native alignment matches the SVG anchor');
        assert.ok(find(pPr, 'a:spcPts').length, 'Native cell must carry measured line spacing');
        assert.equal(Number(find(pPr, 'a:spcPts')[0]['@_val']), Math.round(expectedSize * 1.22 * 75), 'Native line spacing matches measured lines');
        const margins = cell['a:tcPr'];
        assert.equal(Number(margins['@_marL']), 10 * scale * 9525);
        assert.equal(Number(margins['@_marT']), 8 * scale * 9525);
        if (expectedSize < 15 * scale) shrunk++;
        checked++;
      }
    }
  }
}
}
}
assert.ok(grown >= 24, 'Wrapped rows must use available height instead of shrinking readable text');
console.log(`Table layout passed: ${checked} cells, ${shrunk} shrink cases, ${grown} content-sized rows, Roboto/Calibri substitution, two canvas sizes, header/no-header tables, alignment, native rows and source text preservation.`);
