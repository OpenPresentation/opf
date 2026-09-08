import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {renderSvg} from '@openpresentation/opf-render';
import {toPptx} from '../dist/index.js';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false});
const array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const find=(value,key)=>!value||typeof value!=='object'?[]:Array.isArray(value)?value.flatMap(item=>find(item,key)):Object.entries(value).flatMap(([name,child])=>name===key?[...array(child),...find(child,key)]:find(child,key));
const deck={slides:[{table:{columns:[['Normal ',{text:'bold',bold:true}],'Value'],rows:[['Short','one'],[['\nStart\n',{text:'\nEnd\n',bold:true}],[]]]}}]};
const diagnostics=[];
const svg=parser.parse(renderSvg(deck,{trace:true,onDiagnostic:d=>diagnostics.push(d)}));
assert.ok(!diagnostics.some(d=>d.code==='text-overflow'));
const native=parser.parse(new TextDecoder().decode(unzipSync(await toPptx(deck))['ppt/slides/slide1.xml']));
const rows=find(native,'a:tr'),rectangles=find(svg,'rect');
assert.equal(rows.length,3);
let height=0;
for(const [r,row] of rows.entries()){
 const path=r===0?'slides.0.table.columns.0':`slides.0.table.rows.${r-1}.0`;
 const rectangle=rectangles.find(rect=>rect['data-opf-path']===path);
 const actual=Number(row.h)/9525;
 assert.ok(Math.abs(actual-Number(rectangle.height))<.001);
 if(r<2)assert.equal(actual,54);else assert.ok(actual>=103.5-.001,'Five text lines plus cell padding require room');
 if(r===2){
  const group=find(svg,'g').find(group=>group['data-opf-path']===path&&group['data-opf-rich-text']==='true');
  const lines=JSON.parse(group['data-opf-rich-lines']);
  assert.equal(lines.length,5);
  assert.ok(lines.every(line=>line.y+line.height<=Number(rectangle.y)+actual+.001));
 }
 height+=actual;
}
const frame=find(native,'p:graphicFrame')[0];
assert.ok(Math.abs(Number(frame['p:xfrm']['a:ext'].cy)/9525-height)<.001,'Native table extent equals variable row heights');
console.log('Variable table rows passed: unchanged short rows, five-line rich cell containment, identical SVG/native row heights and native table extent.');

const mixed={slides:[{table:{rows:[[[{text:'Large\n',fontSize:30},'small\nsmall']]]}}]};
const mixedXml=parser.parse(new TextDecoder().decode(unzipSync(await toPptx(mixed))['ppt/slides/slide1.xml']));
const paragraphHeights=find(mixedXml,'a:pPr').map(p=>Number(p['a:lnSpc']?.['a:spcPts']?.val)/75).filter(Number.isFinite);
assert.equal(paragraphHeights.length,3);
assert.equal(new Set(paragraphHeights).size,1);
assert.ok(Number(find(mixedXml,'a:tr')[0].h)/9525>=paragraphHeights.reduce((sum,height)=>sum+height,0)+12-.01,'Native mixed-size paragraph advances fit the allocated row');
