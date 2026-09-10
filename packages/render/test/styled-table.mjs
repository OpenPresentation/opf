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
// Verify rendered baselines, independently of the layout implementation: one
// short cell spanning two rows must move by equal amounts at middle/bottom.
for (const rich of [false,true]) {
  const baselines = [];
  for (const verticalAlign of ['top','middle','bottom']) {
    const value = rich ? [{text:'Align',bold:true}] : 'Align';
    const aligned = renderSvg({design:{theme:'classic',fontScheme:'roboto'},slides:[{table:{rows:[
      [{value,rowSpan:2,style:{verticalAlign}},'B'],[null,'C']
    ]}}]});
    const match = aligned.match(/<text([^>]*)>Align<\/text>/);
    assert.ok(match);
    baselines.push(Number(match[1].match(/\by="([^"]+)"/)[1]));
  }
  assert.ok(baselines[1] > baselines[0], `${rich?'rich':'scalar'} middle baseline moves down`);
  assert.ok(baselines[2] > baselines[1], `${rich?'rich':'scalar'} bottom baseline moves down`);
  assert.ok(Math.abs((baselines[1]-baselines[0])-(baselines[2]-baselines[1])) < .001);
}
const lines = output => [...output.matchAll(/<line\b([^>]*)>/g)].map(match =>
  Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(([,key,value]) => [key,value])));

// Bright fills used to receive invisible white headers. Body cells must also
// adapt inherited colors; explicit cell/run colors always remain authoritative.
for(const [fill,headerColor,bodyColor,explicit] of [
  ['#F8FAFC','#000000','#000000'],['#0F172A','#FFFFFF','#FFFFFF'],
  ['#777777','#000000','#000000'],['#767676','#FFFFFF','#000000'],
  ['#FFFFFF80','#FFFFFF','#000000'],['#F8FAFC','#FFFFFF','#FFFFFF','#FFFFFF'],
]){
  const style={fill,...(explicit?{color:explicit}:{})};
  const input={design:{background:'#FFFFFF',colorScheme:{id:'cool-horizon',dark1:'#000000'}},slides:[{table:{columns:[{value:'Header',style},{value:['Inherited',{text:'Explicit',color:'#FF0000'}],style}],rows:[[{value:'Body',style},{value:['BodyInherited',{text:'BodyExplicit',color:'#FF0000'}],style}]]}}]};
  const original=structuredClone(input),output=renderSvg(input);
  for(const [text,color] of [['Header',headerColor],['Inherited',headerColor],['Body',bodyColor],['BodyInherited',bodyColor],['Explicit','#FF0000'],['BodyExplicit','#FF0000']]){
    const attributes=output.match(new RegExp(`<text([^>]*)>${text}</text>`))?.[1];assert.ok(attributes,text);
    assert.ok(attributes.includes(`fill="${color}"`),`${fill} ${text}: ${attributes}`);
  }
  assert.deepEqual(input,original);
}
// An earlier custom merge edge must not be covered by later styled defaults.
const edgeTable = {rows:[
  [{value:'Merged',rowSpan:2,style:{borders:{right:{color:'#a100a1',width:2,dash:'dot'}}}}, {value:'B',style:{borders:{top:{color:'#111111',width:1}}}}],
  [null,{value:'C',style:{borders:{bottom:{color:'#111111',width:1}}}}]
]};
const edgeSvg = renderSvg({slides:[{table:edgeTable}]},{trace:true});
const custom = lines(edgeSvg).find(line => line.stroke === '#a100a1');
assert.ok(custom);
const shared = lines(edgeSvg).filter(line => line.x1 === custom.x1 && line.x2 === custom.x2);
assert.equal(shared.length,1,'neighbor defaults leave dotted gaps empty');
// A short explicit neighbor only removes its portion of a long merged edge.
// Include zero width: suppression must not depend on a visible stroke.
for (const width of [0,2]) {
  const split = renderSvg({slides:[{table:{rows:[
    [{value:'Merge',rowSpan:3},'B'],
    [null,{value:'C',style:{borders:{left:{color:'#a100a1',width}}}}],
    [null,'D']
  ]}}]},{trace:true});
  const mergeEdges = lines(split).filter(line => line['data-opf-path'] === 'slides.0.table.rows.0.0.style.borders.right');
  assert.equal(mergeEdges.length,2,'long implicit edge split above and below explicit neighbor');
  assert.equal(Number(mergeEdges[1].y1)-Number(mergeEdges[0].y2),54);
  assert.equal(lines(split).filter(line => line.stroke === '#a100a1').length,width ? 1 : 0);
}
console.log('Styled table renderer passed: spans, fills/alpha, shared border precedence and suppression, scalar/rich vertical alignment, editable paths, run overrides and rasterization.');
