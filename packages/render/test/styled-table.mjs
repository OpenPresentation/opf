import assert from 'node:assert/strict';
import {renderSvg, svgToPng} from '../dist/index.js';
import {composeSlide, layoutTable} from '@openpresentation/opf/composition';

const table = {rows: [
  [{value: ['Styled ', {text: 'red', color: '#ff0000'}], colSpan: 2, rowSpan: 2, style: {
    fill:'#12345680', color:'#00ff00', align:'right', verticalAlign:'bottom',
    padding:{left:30, right:20, top:12, bottom:6},
    borders:{top:{color:'#fedcba80', width:4, dash:'dash'}, right:{color:'#aa00aa', width:2, dash:'dot'}, bottom:{color:'#000000', width:0}}
  }}, null, 'C'], [null, null, 'D'], ['E', 'F', {value:'Scalar', style:{align:'center', color:'#123456'}}]
]};
const document = {design:{theme:'classic', fontScheme:'roboto'}, slides:[{table}]};
const before = structuredClone(document);
const svg = renderSvg(document, {trace:true});
assert.equal((svg.match(/>Styled <\/text>/g) ?? []).length, 1);
assert.equal((svg.match(/>red<\/text>/g) ?? []).length, 1);
assert.ok(/<text(?=[^>]*fill="#00ff00")[^>]*>Styled <\/text>/.test(svg));
assert.ok(/<text(?=[^>]*fill="#ff0000")[^>]*>red<\/text>/.test(svg));
assert.ok(/<text(?=[^>]*fill="#123456")(?=[^>]*text-anchor="middle")[^>]*>Scalar<\/text>/.test(svg));
assert.match(svg, /data-opf-path="slides\.0\.table\.rows\.0\.0\.value"/);
assert.doesNotMatch(svg, /data-opf-path="slides\.0\.table\.rows\.(0\.1|1\.[01])"/);
assert.ok(/<rect(?=[^>]*fill="#12345680")(?=[^>]*data-opf-path="slides\.0\.table\.rows\.0\.0")[^>]*>/.test(svg));
assert.ok(/<line(?=[^>]*stroke="#fedcba80")(?=[^>]*stroke-width="4")(?=[^>]*stroke-dasharray="16 12")[^>]*>/.test(svg));
assert.ok(/<line(?=[^>]*stroke="#aa00aa")(?=[^>]*stroke-width="2")(?=[^>]*stroke-dasharray="2 4")[^>]*>/.test(svg));
assert.doesNotMatch(svg, /data-opf-path="slides\.0\.table\.rows\.0\.0\.style\.borders\.bottom"/);
// A custom edge must remain visible after neighboring cells are filled.
assert.ok(svg.indexOf('stroke="#fedcba80"') > svg.lastIndexOf('<rect'));
const geometry = composeSlide(document.slides[0]);
const item = geometry.items.find(item => item.field === 'table');
const merged = layoutTable(table, item.box).rows[0].cells[0];
assert.equal(merged.box.width, item.box.width * 2/3);
assert.equal(merged.box.height, 108);
assert.ok((await svgToPng(svg)).length > 1000);
assert.deepEqual(document, before);
console.log('Styled table renderer passed: spans, fills/alpha, border edges/dashes, alignment, editable paths, run overrides and rasterization.');
