import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {validatePresentation} from '@openpresentation/opf';
import {renderSvg} from '@openpresentation/opf-render';
import {fromPptx, toPptx} from '../dist/index.js';

const encoder=new TextEncoder(),decoder=new TextDecoder();
const id='{12345678-1234-1234-1234-123456789ABC}';
const colors={wholeTbl:'101010',band1H:'202020',band2H:'303030',band1V:'404040',band2V:'505050',lastCol:'606060',firstCol:'707070',lastRow:'808080',seCell:'909090',swCell:'A0A0A0',firstRow:'B0B0B0',neCell:'C0C0C0',nwCell:'D0D0D0'};
const part=(name,body)=>`<a:${name}>${body}</a:${name}>`;
const tx=(body='',attributes='')=>`<a:tcTxStyle ${attributes}>${body}</a:tcTxStyle>`;
const rgb=value=>`<a:srgbClr val="${value}"/>`;
const style=Object.entries(colors).map(([name,color])=>part(name,tx((name==='wholeTbl'?'<a:fontRef idx="minor"><a:srgbClr val="FFFFFF"/></a:fontRef>':'')+rgb(color),name==='band1H'?'i="on"':name==='band2H'?'i="off"':name==='firstRow'?'b="on"':''))).join('');
const flags='firstRow="1" lastRow="1" firstCol="1" lastCol="1" bandRow="1" bandCol="1"';
const tableOf=deck=>deck.slides[0].blocks.find(b=>b.table).table;
const allRows=table=>table.columns?[table.columns,...table.rows]:table.rows;
const run=cell=>Array.isArray(cell)?cell.find(r=>typeof r!=='string'):undefined;
const text=cell=>Array.isArray(cell)?cell.map(r=>typeof r==='string'?r:r.text).join(''):cell;
const bases=new Map();
async function fixture({rows=5,columns=5,properties=flags,definition=style,inline=false,reference=id,modify=()=>{}}={}){
 const key=rows+':'+columns;
 if(!bases.has(key))bases.set(key,unzipSync(await toPptx({slides:[{table:{rows:Array.from({length:rows},(_,r)=>Array.from({length:columns},(_,c)=>`${r},${c}`))}}]})));
 const entries={...bases.get(key)};
 let slide=decoder.decode(entries['ppt/slides/slide1.xml']);
 let cell=0;
 slide=slide.replace(/<a:txBody>[\s\S]*?<\/a:txBody>/g,()=>`<a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${Math.floor(cell/columns)},${cell++%columns}</a:t></a:r></a:p></a:txBody>`);
 const selected=inline?`<a:tableStyle styleId="${id}" styleName="Fixture">${definition}</a:tableStyle>`:reference?`<a:tableStyleId>${reference}</a:tableStyleId>`:'';
 slide=slide.replace(/<a:tblPr\b[^>]*(?:\/>|>[\s\S]*?<\/a:tblPr>)/,`<a:tblPr ${properties}>${selected}</a:tblPr>`);
 entries['ppt/slides/slide1.xml']=encoder.encode(slide);
 // A nonstandard part name proves lookup follows the presentation relationship.
 const rel='ppt/_rels/presentation.xml.rels';
 entries[rel]=encoder.encode(decoder.decode(entries[rel]).replace(/Target="tableStyles.xml"/,'Target="styles/custom-tables.xml"'));
 entries['ppt/styles/custom-tables.xml']=encoder.encode(`<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="${id}"><a:tblStyle styleId="${id}" styleName="Fixture">${definition}</a:tblStyle></a:tblStyleLst>`);
 delete entries['ppt/tableStyles.xml'];
 entries['[Content_Types].xml']=encoder.encode(decoder.decode(entries['[Content_Types].xml']).replace('/ppt/tableStyles.xml','/ppt/styles/custom-tables.xml'));
 modify(entries);
 const bytes=zipSync(entries),copy=bytes.slice(),diagnostics=[];
 const deck=await fromPptx(bytes,{onDiagnostic:d=>diagnostics.push(d)});
 assert.deepEqual(bytes,copy,'Import must not mutate the archive');
 assert.equal(validatePresentation(deck).valid,true);
 return {deck,table:tableOf(deck),diagnostics,bytes};
}
const themed=await fixture();
assert.deepEqual(themed.diagnostics,[]);
assert.deepEqual(allRows(themed.table).map(row=>row.map(cell=>run(cell).color)),[
 ['#D0D0D0','#B0B0B0','#B0B0B0','#B0B0B0','#C0C0C0'],
 ['#707070','#404040','#505050','#404040','#606060'],
 ['#707070','#404040','#505050','#404040','#606060'],
 ['#707070','#404040','#505050','#404040','#606060'],
 ['#A0A0A0','#808080','#808080','#808080','#909090']
],'DrawingML whole/band/edge/corner precedence');
assert.equal(run(themed.table.columns[0]).bold,true);
assert.equal(run(themed.table.rows[0][1]).italic,true);
assert.equal(run(themed.table.rows[1][1]).italic,false);
assert.equal(run(themed.table.rows[2][1]).italic,true);
assert.equal(run(themed.table.rows[0][1]).fontFamily,'Aptos');
assert.match(renderSvg(themed.deck),/#D0D0D0/i);
assert.deepEqual(allRows(themed.table).map(r=>r.map(text)),Array.from({length:5},(_,r)=>Array.from({length:5},(_,c)=>`${r},${c}`)));
const repeated=await fromPptx(await toPptx(themed.deck));
assert.deepEqual(allRows(tableOf(repeated)).map(row=>row.map(cell=>({color:run(cell).color,bold:run(cell).bold??false,italic:run(cell).italic??false}))),allRows(themed.table).map(row=>row.map(cell=>({color:run(cell).color,bold:run(cell).bold??false,italic:run(cell).italic??false}))));
const horizontal=await fixture({properties:'bandRow="true"'});
assert.deepEqual(horizontal.table.rows.map(row=>run(row[2]).color),['#202020','#303030','#202020','#303030','#202020']);
const vertical=await fixture({properties:'bandCol="on"'});
assert.deepEqual(vertical.table.rows[2].map(cell=>run(cell).color),['#404040','#505050','#404040','#505050','#404040']);
const off=await fixture({properties:'firstRow="off" firstCol="false" bandRow="0" bandCol="off"'});
assert.ok(off.table.rows.flat().every(cell=>run(cell).color==='#101010'));
const one=await fixture({rows:1,columns:1});assert.equal(run(one.table.columns[0]).color,'#D0D0D0');
const oneNoCorners=await fixture({rows:1,columns:1,definition:Object.entries(colors).filter(([name])=>!name.endsWith('Cell')).map(([name,c])=>part(name,tx(rgb(c)))).join('')});
assert.equal(run(oneNoCorners.table.columns[0]).color,'#B0B0B0','First row wins the one-cell row/column overlaps');
const same=await fixture({inline:true});assert.deepEqual(same.table,themed.table);
const lowercase=await fixture({reference:id.toLowerCase()});assert.deepEqual(lowercase.table,themed.table);
const noStyle=await fixture({properties:'',reference:''});assert.equal(noStyle.table.rows[0][0],'0,0','Insertion default must not style existing unstyled cells');assert.deepEqual(noStyle.diagnostics,[]);
const missing=await fixture({reference:'{MISSING}'});assert.ok(missing.diagnostics.some(d=>d.code==='unsupported-table-style'&&d.path==='slides.0.tables.0'));
const external=await fixture({modify:e=>{const p='ppt/_rels/presentation.xml.rels';e[p]=encoder.encode(decoder.decode(e[p]).replace('Target="styles/custom-tables.xml"','Target="styles/custom-tables.xml" TargetMode="External"'));}});assert.ok(external.diagnostics.some(d=>d.code==='unsupported-table-style'));
const explicit=await fixture({properties:'',definition:part('wholeTbl',tx('<a:font><a:latin typeface="Georgia"/><a:ea typeface=""/><a:cs typeface=""/></a:font>'+rgb('2468AC'),'b="on" i="on"')),modify:e=>{
 const p='ppt/slides/slide1.xml';e[p]=encoder.encode(decoder.decode(e[p]).replace('<a:p><a:r><a:t>0,0','<a:p><a:pPr><a:defRPr b="0"><a:solidFill><a:srgbClr val="AAAAAA"/></a:solidFill></a:defRPr></a:pPr><a:r><a:rPr i="0"><a:latin typeface="Arial"/><a:solidFill><a:srgbClr val="CC0000"/></a:solidFill></a:rPr><a:t>0,0'));
}});
assert.deepEqual(run(explicit.table.rows[0][0]),{text:'0,0',bold:false,italic:false,fontFamily:'Arial',color:'#CC0000'});
assert.equal(run(explicit.table.rows[0][1]).fontFamily,'Georgia');
const placeholder=await fixture({properties:'',definition:part('wholeTbl',tx('<a:fontRef idx="major"><a:srgbClr val="2468AC"><a:alpha val="50000"/></a:srgbClr></a:fontRef><a:schemeClr val="phClr"><a:alphaMod val="50000"/></a:schemeClr>'))});
assert.equal(run(placeholder.table.rows[0][0]).color,'#2468AC40');assert.equal(run(placeholder.table.rows[0][0]).fontFamily,'Aptos Display');
const decoration=await fixture({properties:'',definition:part('wholeTbl',tx(rgb('123456'))+'<a:tcStyle><a:fill><a:solidFill><a:srgbClr val="CCCCCC"/></a:solidFill></a:fill></a:tcStyle>')});
assert.equal(run(decoration.table.rows[0][0]).color,'#123456');assert.ok(decoration.diagnostics.some(d=>d.code==='unsupported-table-cell-style'&&d.path==='slides.0.tables.0.rows.0.0'));
const unresolved=await fixture({properties:'',definition:part('wholeTbl',tx('<a:schemeClr val="unknown"/>'))});assert.ok(unresolved.diagnostics.some(d=>d.code==='unsupported-table-text-color'));
const inheritedPlaceholder=await fixture({properties:'firstRow="1"',definition:
 part('wholeTbl',tx('<a:fontRef idx="minor"><a:srgbClr val="13579B"/></a:fontRef>'+rgb('111111'),'b="on"'))+
 part('firstRow',tx('<a:schemeClr val="phClr"/>','b="def"'))});
assert.equal(run(inheritedPlaceholder.table.columns[0]).color,'#13579B');assert.equal(run(inheritedPlaceholder.table.columns[0]).bold,true);
const inheritedCollection=await fixture({properties:'firstRow="1"',definition:
 part('wholeTbl',tx('<a:fontRef idx="major"><a:srgbClr val="000000"/></a:fontRef>'))+
 part('firstRow',tx('<a:font><a:latin typeface="Georgia"/><a:ea typeface=""/><a:cs typeface=""/></a:font>'))});
assert.equal(run(inheritedCollection.table.columns[0]).fontFamily,'Georgia');
const overriddenUnsupported=await fixture({rows:1,columns:1,properties:'',definition:part('wholeTbl',tx('<a:fontRef idx="none"><a:srgbClr val="000000"/></a:fontRef><a:prstClr val="red"/>')),modify:e=>{
 const p='ppt/slides/slide1.xml';e[p]=encoder.encode(decoder.decode(e[p]).replace('<a:r><a:t>','<a:r><a:rPr><a:latin typeface="Arial"/><a:solidFill><a:srgbClr val="123456"/></a:solidFill></a:rPr><a:t>'));
}});
assert.deepEqual(overriddenUnsupported.diagnostics,[],'Unused style font/color must not diagnose direct text overrides');
const emptyBorder=await fixture({properties:'',definition:part('wholeTbl',tx(rgb('123456'))+'<a:tcStyle><a:tcBdr/></a:tcStyle>')});assert.deepEqual(emptyBorder.diagnostics,[]);
const rtl=await fixture({properties:'rtl="1" '+flags});assert.ok(rtl.diagnostics.some(d=>d.code==='unsupported-table-direction'));
console.log('Native conditional table text styles passed: archive/inline definitions, DrawingML precedence, edge/corner overlaps, band parity, fonts/colors/alpha, direct overrides, repeated conversion, and diagnostics.');

if (process.env.OPF_TABLE_STYLE_FIXTURE) {
 const {writeFile}=await import('node:fs/promises');
 await writeFile(process.env.OPF_TABLE_STYLE_FIXTURE,themed.bytes);
}
