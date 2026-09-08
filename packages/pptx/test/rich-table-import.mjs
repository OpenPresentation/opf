import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {validatePresentation} from '@openpresentation/opf';
import {renderSvg} from '@openpresentation/opf-render';
import {fromPptx, toPptx} from '../dist/index.js';

const decoder = new TextDecoder(), encoder = new TextEncoder();
const plain = cell => Array.isArray(cell) ? cell.map(run => typeof run === 'string' ? run : run.text).join('') : cell;
const tableOf = deck => deck.slides[0].blocks.find(block => block.table).table;
const source = {columns:[[{text:'Normal ',bold:false},{text:'bold',bold:true}],'Value'],rows:[
 [[{text:' A ',bold:true,italic:true,underline:true,strikethrough:true,color:'#12345680',fontSize:17,fontFamily:'Georgia',link:'https://example.com/?a=1&b=2'}],['H',{text:'2',subscript:true},'O']],
 [['\nStart\n',{text:'\nEnd\n',bold:true}],['x',{text:'2',superscript:true}]],
 [[],null]
]};
const original = structuredClone(source);
const diagnostics=[];
const imported = await fromPptx(await toPptx({slides:[{table:source}]}), {onDiagnostic:d=>diagnostics.push(d)});
const table=tableOf(imported);
assert.equal(validatePresentation(imported).valid,true);
assert.deepEqual(diagnostics,[]);
assert.deepEqual(source,original);
assert.equal(table.columns[0][0].bold,false,'Normal native text must override the OPF bold header default');
assert.equal(table.columns[0][1].bold,true);
const a=table.rows[0][0][0];
assert.deepEqual(a,{text:' A ',bold:true,italic:true,underline:true,strikethrough:true,fontSize:17,fontFamily:'Georgia',color:'#12345680',link:'https://example.com/?a=1&b=2'});
assert.equal(table.rows[0][1].find(run=>run.text==='2').subscript,true);
assert.equal(table.rows[1][1].find(run=>run.text==='2').superscript,true);
assert.equal(plain(table.rows[1][0]),'\nStart\n\nEnd\n');
assert.deepEqual(table.rows[2],['','']);
assert.match(renderSvg(imported),/A/);
assert.match(renderSvg(imported),/https:\/\/example.com/);
const again=tableOf(await fromPptx(await toPptx(imported)));
assert.equal(plain(again.rows[1][0]),'\nStart\n\nEnd\n');
assert.deepEqual(again.rows[0][0],table.rows[0][0],'Representable styles survive repeated native conversion');

// Replace the actual cell XML in a native PPTX. No OPF source metadata is read.
// Runs/fields/breaks are deliberately interleaved, with significant whitespace.
const base=unzipSync(await toPptx({slides:[{table:{rows:[['placeholder']]}}]}));
const body=`<a:txBody><a:bodyPr/><a:lstStyle><a:lvl1pPr><a:defRPr b="1" sz="2100"><a:latin typeface="+mn-lt"/><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:defRPr></a:lvl1pPr></a:lstStyle>
<a:p><a:pPr><a:defRPr i="1"/></a:pPr><a:r><a:t> A </a:t></a:r><a:fld id="field" type="slidenum"><a:rPr b="0" i="false" u="none" strike="noStrike" baseline="0"><a:solidFill><a:srgbClr val="AABBCC"/></a:solidFill></a:rPr><a:t>7</a:t></a:fld><a:br/><a:r><a:rPr sz="900" b="true"><a:hlinkClick r:id="customLink"/></a:rPr><a:t> B  </a:t></a:r></a:p><a:p/><a:p><a:r><a:t> End </a:t></a:r></a:p><a:p/>
</a:txBody>`;
async function native(body,modify=entries=>entries){
 const entries={...base};
 entries['ppt/slides/slide1.xml']=encoder.encode(decoder.decode(entries['ppt/slides/slide1.xml']).replace(/<a:txBody>[\s\S]*?<\/a:txBody>/,body));
 entries['ppt/slides/_rels/slide1.xml.rels']=encoder.encode(decoder.decode(entries['ppt/slides/_rels/slide1.xml.rels']).replace('</Relationships>','<Relationship Id="customLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="mailto:test@example.com" TargetMode="External"/></Relationships>'));
 const diagnostics=[];
 const deck=await fromPptx(zipSync(modify(entries)),{onDiagnostic:d=>diagnostics.push(d)});
 return {deck,cell:tableOf(deck).rows[0][0],diagnostics};
}
const ordered=await native(body);
assert.equal(plain(ordered.cell),' A 7\n B  \n\n End \n');
assert.equal(ordered.cell[0].bold,true);assert.equal(ordered.cell[0].italic,true);assert.equal(ordered.cell[0].fontSize,21);
assert.equal(ordered.cell[0].fontFamily,'Aptos');assert.match(ordered.cell[0].color,/^#[0-9A-F]{6}$/);
assert.deepEqual(ordered.cell.find(run=>run.text==='7'),{text:'7',bold:false,italic:false,underline:false,strikethrough:false,fontSize:21,superscript:false,subscript:false,fontFamily:'Aptos',color:'#AABBCC'});
assert.equal(ordered.cell.find(run=>run.text===' B  ').link,'mailto:test@example.com');
assert.equal(ordered.cell.find(run=>run.text===' B  ').fontSize,9);
assert.deepEqual(ordered.diagnostics,[]);
assert.equal((await native('<a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t> plain  </a:t></a:r><a:br/><a:fld><a:t>42</a:t></a:fld></a:p><a:p/></a:txBody>')).cell,' plain  \n42\n','Unstyled cells remain strings without trimming');
const themed=await native(body, entries=>{
 const key=Object.keys(entries).find(key=>/^ppt\/theme\/theme\d+\.xml$/.test(key));
 entries[key]=encoder.encode(decoder.decode(entries[key]).replace(/(<a:minorFont>[\s\S]*?<a:latin typeface=")[^"]*/, '$1Native Minor').replace(/<a:accent1>[\s\S]*?<\/a:accent1>/,'<a:accent1><a:srgbClr val="2468AC"/></a:accent1>'));
 return entries;
});
assert.equal(themed.cell[0].fontFamily,'Native Minor');assert.equal(themed.cell[0].color,'#2468AC');
const noFill=await native(body.replace('<a:rPr sz="900" b="true">','<a:rPr sz="900" b="true"><a:noFill/>'));
assert.equal(noFill.cell.find(run=>run.text===' B  ').color,'#00000000','Explicit no-fill replaces paragraph solid color');
const internal=await native(body, entries=>{
 entries['ppt/slides/_rels/slide1.xml.rels']=encoder.encode(decoder.decode(entries['ppt/slides/_rels/slide1.xml.rels']).replace('TargetMode="External"','TargetMode="Internal"'));
 return entries;
});
assert.equal(internal.cell.find(run=>run.text===' B  ').link,undefined);
assert.ok(internal.diagnostics.some(d=>d.code==='unsupported-table-link'));
const unresolved=await native(body.replace('val="accent1"','val="unknown"').replace('r:id="customLink"','r:id="missing"'));
assert.ok(unresolved.diagnostics.some(d=>d.code==='unsupported-table-text-color'));
assert.ok(unresolved.diagnostics.some(d=>d.code==='unsupported-table-link'));
assert.ok(unresolved.diagnostics.every(d=>d.path==='slides.0.tables.0.rows.0.0'));
const merged=await native(body, entries=>{
 entries['ppt/slides/slide1.xml']=encoder.encode(decoder.decode(entries['ppt/slides/slide1.xml']).replace('<a:tc>','<a:tc gridSpan="2">').replace('<a:tblPr firstRow="0"/>','<a:tblPr firstRow="0"><a:tableStyleId>{CUSTOM}</a:tableStyleId></a:tblPr>'));
 return entries;
});
assert.ok(merged.diagnostics.some(d=>d.code==='unsupported-table-merge'));
assert.ok(merged.diagnostics.some(d=>d.code==='unsupported-table-style'));
console.log('Native rich table import passed: styles, alpha, theme fonts/colors, defaults/resets, links, XML child order, fields, whitespace/blank lines, repeated conversion and path-specific diagnostics.');
