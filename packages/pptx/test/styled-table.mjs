import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {toPptx} from '../dist/index.js';
import {composeSlide, layoutTable} from '@openpresentation/opf/composition';

const parser = new XMLParser({ignoreAttributes:false, attributeNamePrefix:'', parseTagValue:false});
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const find = (value,key) => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(item => find(item,key)) : Object.entries(value).flatMap(([name,child]) => name === key ? array(child) : find(child,key));
const fill = '#12345680', border = {color:'#aabbcc80', width:2, dash:'dot'};
const table = {rows:[
  [{value:['Merged ',{text:'red',color:'#ff0000'}],rowSpan:2,colSpan:2,style:{fill,color:'#abcdef80',align:'right',verticalAlign:'bottom',padding:{top:0,left:3,bottom:6},borders:{top:border,bottom:{color:'#000',width:0}}}},null,{value:'C',style:{padding:{left:17},borders:{right:{color:'#00ff00',width:3,dash:'dash'}}}}],
  [null,null,{value:'D',style:{align:'center',padding:{top:.25,right:19}}}],
  ['E','F','G']
]};

for (const scale of [1,.5]) {
  const deck = {design:{dimensions:{widthInches:1280*scale/96,heightInches:720*scale/96}},slides:[{table}]};
  const before = structuredClone(deck), bytes = await toPptx(deck);
  assert.deepEqual(await toPptx(deck), bytes, 'Styled export is deterministic');
  const xml = new TextDecoder().decode(unzipSync(bytes)['ppt/slides/slide1.xml']);
  const native = find(parser.parse(xml),'a:tbl')[0], rows = array(native['a:tr']);
  assert.equal(rows.length,3);
  assert.deepEqual(rows.map(row => array(row['a:tc']).length),[3,3,3]);
  const cells = rows.map(row => array(row['a:tc']));
  assert.equal(cells[0][0].rowSpan,'2');
  assert.equal(cells[0][0].gridSpan,'2');
  assert.equal(cells[0][1].hMerge,'1');
  assert.equal(cells[1][0].vMerge,'1');
  assert.equal(cells[1][1].vMerge,'1');
  assert.equal(cells[1][1].hMerge,'1');
  assert.deepEqual(find(cells[1][0],'a:t'),[]);
  assert.equal((xml.match(/<a:t>Merged <\/a:t>/g) ?? []).length,1);
  const props = cells[0][0]['a:tcPr'];
  assert.equal(props.anchor,'b');
  assert.equal(Number(props.marT),0);
  assert.equal(Number(props.marL),Math.round(3*scale*9525));
  assert.equal(Number(props.marB),Math.round(6*scale*9525));
  assert.equal(props['a:solidFill']['a:srgbClr'].val,'123456');
  assert.equal(Number(props['a:solidFill']['a:srgbClr']['a:alpha'].val),50196);
  assert.equal(Number(props['a:lnT'].w),Math.round(2*scale*9525));
  assert.equal(props['a:lnT']['a:prstDash'].val,'sysDot');
  assert.equal(Number(props['a:lnT']['a:solidFill']['a:srgbClr']['a:alpha'].val),50196);
  assert.ok(Object.hasOwn(props['a:lnB'],'a:noFill'));
  assert.equal(props['a:lnB'].w,'0');
  assert.ok(find(cells[0][0],'a:pPr').every(p => p.algn === 'r'));
  assert.equal(find(cells[0][0],'a:rPr')[0]['a:solidFill']['a:srgbClr'].val,'ABCDEF');
  assert.equal(find(cells[0][0],'a:rPr')[1]['a:solidFill']['a:srgbClr'].val,'FF0000');
  assert.equal(find(cells[0][0],'a:rPr')[1]['a:solidFill']['a:srgbClr']['a:alpha'],undefined,'An explicit opaque run overrides a translucent cell text color');
  assert.equal(Number(cells[0][2]['a:tcPr'].marL),Math.round(17*scale*9525));
  assert.equal(cells[0][2]['a:tcPr']['a:lnR']['a:prstDash'].val,'dash');
  assert.equal(Number(cells[1][2]['a:tcPr'].marT),Math.round(.25*scale*9525));
  assert.equal(Number(cells[1][2]['a:tcPr'].marR),Math.round(19*scale*9525));
  assert.ok(find(cells[1][2],'a:pPr').every(p => p.algn === 'ctr'));
  const item = composeSlide(deck.slides[0],{width:1280*scale,height:720*scale}).items.find(item => item.field === 'table');
  const geometry = layoutTable(table,item.box,{scale});
  rows.forEach((row,i) => assert.ok(Math.abs(Number(row.h)/9525-geometry.rows[i].box.height)<.001));
  assert.deepEqual(deck,before);
}

// Fully covered rows contain no anchors; the native library must still emit them.
const full = await toPptx({slides:[{table:{rows:[[{value:'All',rowSpan:3,colSpan:2},null],[null,null],[null,null]]}}]});
const fullRows = find(parser.parse(new TextDecoder().decode(unzipSync(full)['ppt/slides/slide1.xml'])),'a:tr');
assert.deepEqual(fullRows.map(row => array(row['a:tc']).length),[2,2,2]);
console.log('Styled native table export passed: merged grid, unique text, full covered rows, colors/alpha, border dashes, zero/fractional padding, alignment, scaled row geometry and determinism.');

// Native PowerPoint reads physical continuation borders and shared neighbors.
// Anchor-only XML passed earlier checks but visibly truncated a merged dash.
for (const scale of [1,.5]) {
  const right={color:'#22558880',width:3,dash:'dash'};
  const top={color:'#556677',width:2,dash:'dot'};
  const source={design:{dimensions:{widthInches:1280*scale/96,heightInches:720*scale/96}},slides:[{table:{rows:[
    [{value:'Anchor',rowSpan:2,colSpan:2,style:{borders:{right,top,bottom:{color:'#000000',width:0}}}},null,'R1'],
    [null,null,'R2'],['B1','B2','Corner']
  ]}}]};
  const before=structuredClone(source);
  const bytes=await toPptx(source);
  const native=find(parser.parse(new TextDecoder().decode(unzipSync(bytes)['ppt/slides/slide1.xml'])),'a:tbl')[0];
  const cells=array(native['a:tr']).map(row=>array(row['a:tc']));
  for(const [r,c,edge] of [[0,1,'R'],[1,1,'R'],[0,2,'L'],[1,2,'L']]) {
    const line=cells[r][c]['a:tcPr']['a:ln'+edge];
    assert.equal(Number(line.w),Math.round(3*scale*9525));
    assert.equal(line['a:prstDash'].val,'dash');
    assert.equal(line['a:solidFill']['a:srgbClr'].val,'225588');
    assert.equal(Number(line['a:solidFill']['a:srgbClr']['a:alpha'].val),50196);
  }
  assert.equal(cells[0][1]['a:tcPr']['a:lnT']['a:prstDash'].val,'sysDot');
  for(const [r,c,edge] of [[1,0,'B'],[1,1,'B'],[2,0,'T'],[2,1,'T']]) {
    assert.equal(cells[r][c]['a:tcPr']['a:ln'+edge].w,'0');
    assert.ok(Object.hasOwn(cells[r][c]['a:tcPr']['a:ln'+edge],'a:noFill'));
  }
  assert.deepEqual(find(cells[1][1],'a:t'),[],'Continuation border normalization never duplicates text');
  assert.deepEqual(source,before,'Shared-edge normalization must not mutate the source');
}
console.log('Native merge perimeter regression passed: continuation and neighbor edges, transparent dashes, dotted top, hidden bottom and scaling.');
