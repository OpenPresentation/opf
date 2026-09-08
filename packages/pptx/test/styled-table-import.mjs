import assert from 'node:assert/strict';
import {unzipSync,zipSync} from 'fflate';
import {validatePresentation} from '@openpresentation/opf';
import {toPptx,fromPptx} from '../dist/index.js';

const encoder=new TextEncoder(),decoder=new TextDecoder();
const tableOf=deck=>deck.slides[0].blocks.find(block=>block.table).table;
const plain=cell=>{const value=cell?.value??cell;return Array.isArray(value)?value.map(run=>typeof run==='string'?run:run.text).join(''):value;};
const all=table=>[...(table.columns?[table.columns]:[]),...table.rows];
const table={columns:[{value:'Heading',colSpan:2},null,'C'],rows:[
 [{value:['A ',{text:'red',color:'#FF0000'}],rowSpan:2,colSpan:2,style:{fill:'#12345680',color:'#ABCDEFAA',align:'right',verticalAlign:'bottom',padding:{top:0,right:3.5,bottom:6,left:12},borders:{top:{color:'#ABCDEF80',width:2,dash:'dot'},right:{color:'#123456',width:3,dash:'dash'},bottom:{color:'#000000',width:0}}}},null,'B'],
 [null,null,{value:'D',style:{align:'center',verticalAlign:'middle',padding:{left:17}}}]
]};
for(const scale of [1,.5]){
 const source={design:{dimensions:{widthInches:1280*scale/96,heightInches:720*scale/96}},slides:[{table}]};
 const bytes=await toPptx(source),before=bytes.slice(),diagnostics=[];
 const imported=await fromPptx(bytes,{onDiagnostic:d=>diagnostics.push(d)}),actual=tableOf(imported);
 assert.deepEqual(diagnostics,[]);
 assert.deepEqual(bytes,before);
 assert.equal(validatePresentation(imported).valid,true);
 assert.deepEqual(all(actual).map(row=>row.map(plain)),all(table).map(row=>row.map(plain)));
 assert.equal(actual.columns[0].colSpan,2);
 assert.equal(actual.rows[0][0].rowSpan,2);assert.equal(actual.rows[0][0].colSpan,2);
 assert.equal(actual.rows[0][1],null);assert.equal(actual.rows[1][0],null);assert.equal(actual.rows[1][1],null);
 const style=actual.rows[0][0].style;
 assert.equal(style.fill,'#12345680');assert.equal(style.align,'right');assert.equal(style.verticalAlign,'bottom');
 for(const edge of ['top','right','bottom','left'])assert.ok(Math.abs(style.padding[edge]-table.rows[0][0].style.padding[edge])<.001);
 for(const edge of ['top','right']){
  const expected=table.rows[0][0].style.borders[edge],actual=style.borders[edge];
  assert.equal(actual.color,expected.color);assert.equal(actual.dash,expected.dash);assert.ok(Math.abs(actual.width-expected.width)<.001);
 }
 assert.equal(style.borders.bottom.width,0);
 assert.equal(actual.rows[1][2].style.align,'center');assert.equal(actual.rows[1][2].style.verticalAlign,'middle');
 assert.equal(actual.rows[0][0].value[0].color,'#ABCDEFAA');assert.equal(actual.rows[0][0].value[1].color,'#FF0000');
 const again=tableOf(await fromPptx(await toPptx(imported)));
 assert.deepEqual(again,actual,'Native styles and dense merges survive repeated conversion');
}

const base=unzipSync(await toPptx({slides:[{table:{rows:[[{value:'Anchor',rowSpan:2,colSpan:2},null,'C'],[null,null,'D']]}}]}));
async function native(modify){
 const entries={...base};entries['ppt/slides/slide1.xml']=encoder.encode(modify(decoder.decode(entries['ppt/slides/slide1.xml'])));
 const diagnostics=[],deck=await fromPptx(zipSync(entries),{onDiagnostic:d=>diagnostics.push(d)});
 assert.equal(validatePresentation(deck).valid,true);
 return {table:tableOf(deck),diagnostics};
}
const crossing=await native(xml=>xml.replace('firstRow="0"','firstRow="1"'));
assert.equal(crossing.table.columns,undefined);assert.equal(crossing.table.rows[0][0].rowSpan,2);
assert.ok(crossing.diagnostics.some(d=>d.code==='table-header-in-body'));
for(const mutate of [
 xml=>xml.replace('rowSpan="2" gridSpan="2"','rowSpan="9" gridSpan="2"'),
 xml=>xml.replace('vMerge="1"','vMerge="0"'),
 xml=>xml.replace('<a:tc rowSpan="2" hMerge="1"><a:tcPr/></a:tc>','<a:tc rowSpan="2" hMerge="1"><a:txBody><a:bodyPr/><a:p><a:r><a:t>Hidden content</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>'),
 xml=>xml.replace('rowSpan="2" gridSpan="2"','rowSpan="2" gridSpan="1.5"'),
]){
 const result=await native(mutate);
 assert.ok(result.diagnostics.some(d=>d.code==='unsupported-table-merge'));
 assert.ok(result.table.rows.flat().every(cell=>cell!==null && cell.rowSpan===undefined && cell.colSpan===undefined));
 assert.equal(plain(result.table.rows[0][0]),'Anchor');
 if(mutate.toString().includes('Hidden content'))assert.equal(plain(result.table.rows[0][1]),'Hidden content');
}
const unsupported=await native(xml=>xml.replace(/<a:tcPr([^>]*)>/,'<a:tcPr$1 vert="vert270">').replace(/<a:lnL[\s\S]*?<\/a:lnL>/,'<a:lnL w="900000000"><a:solidFill><a:srgbClr val="123456"/></a:solidFill><a:prstDash val="dashDot"/></a:lnL>'));
assert.ok(unsupported.diagnostics.some(d=>d.code==='unsupported-table-alignment'));
assert.ok(unsupported.diagnostics.some(d=>d.code==='unsupported-table-border'));
console.log('Styled native table import passed: direct fills/alpha, borders, margins, alignment, dense merges, repeated conversion, header crossing and text-preserving malformed-merge diagnostics.');
