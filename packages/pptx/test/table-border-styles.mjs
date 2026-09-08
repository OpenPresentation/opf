import assert from 'node:assert/strict';
import {unzipSync,zipSync} from 'fflate';
import {validatePresentation} from '@openpresentation/opf';
import {fromPptx,toPptx} from '../dist/index.js';

const encoder=new TextEncoder(),decoder=new TextDecoder();
const rgb=color=>`<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>`;
const line=(color='123456',width=19050,dash='solid')=>`<a:ln w="${width}">${rgb(color)}<a:prstDash val="${dash}"/></a:ln>`;
const edge=(name,body)=>`<a:${name}>${body}</a:${name}>`;
const part=(name,borders)=>`<a:${name}><a:tcStyle><a:tcBdr>${borders}</a:tcBdr></a:tcStyle></a:${name}>`;
const tableOf=deck=>deck.slides[0].blocks.find(block=>block.table).table;
const all=table=>[...(table.columns?[table.columns]:[]),...table.rows];
const bases=new Map();
async function fixture({definition='',properties='',rows=3,columns=3,direct=()=>'',theme,modify=xml=>xml}={}){
 const key=rows+':'+columns;
 if(!bases.has(key))bases.set(key,unzipSync(await toPptx({design:{dimensions:{widthInches:1280/96,heightInches:720/96}},slides:[{table:{rows:Array.from({length:rows},(_,r)=>Array.from({length:columns},(_,c)=>`${r},${c}`))}}]})));
 const entries={...bases.get(key)},path='ppt/slides/slide1.xml';
 let index=0;
 let xml=decoder.decode(entries[path]).replace(/<a:tcPr\b[^>]*(?:\/>|>[\s\S]*?<\/a:tcPr>)/g,()=>`<a:tcPr>${direct(Math.floor(index/columns),index++%columns)}</a:tcPr>`);
 xml=xml.replace(/<a:tblPr\b[^>]*(?:\/>|>[\s\S]*?<\/a:tblPr>)/,`<a:tblPr ${properties}><a:tableStyle styleId="{12345678-1234-1234-1234-123456789ABC}" styleName="Border fixture">${definition}</a:tableStyle></a:tblPr>`);
 entries[path]=encoder.encode(modify(xml));
 if(theme){const path=Object.keys(entries).find(path=>/^ppt\/theme\/theme\d+\.xml$/.test(path));entries[path]=encoder.encode(decoder.decode(entries[path]).replace(/<a:lnStyleLst>[\s\S]*?<\/a:lnStyleLst>/,`<a:lnStyleLst>${theme}</a:lnStyleLst>`));}
 const bytes=zipSync(entries),copy=bytes.slice(),diagnostics=[];
 const deck=await fromPptx(bytes,{onDiagnostic:d=>diagnostics.push(d)});
 assert.deepEqual(bytes,copy);assert.equal(validatePresentation(deck).valid,true);
 return {deck,rows:all(tableOf(deck)),diagnostics,bytes};
}
const outer={top:'AA0000',right:'00AA00',bottom:'0000AA',left:'AAAA00'};
const frame=part('wholeTbl',Object.entries(outer).map(([name,color])=>edge(name,line(color))).join('')+edge('insideH',line('112233',28575,'dot'))+edge('insideV',line('445566',38100,'dash')));
const grid=await fixture({definition:frame});assert.deepEqual(grid.diagnostics,[]);
for(let r=0;r<3;r++)for(let c=0;c<3;c++)for(const name of Object.keys(outer)){
 const outside={top:r===0,right:c===2,bottom:r===2,left:c===0}[name];
 const horizontal=name==='top'||name==='bottom';
 assert.deepEqual(grid.rows[r][c].style.borders[name],outside?{color:'#'+outer[name],width:2}:{color:horizontal?'#112233':'#445566',width:horizontal?3:4,dash:horizontal?'dot':'dash'},`${r},${c} ${name}`);
}
const again=all(tableOf(await fromPptx(await toPptx(grid.deck))));
assert.deepEqual(again.map(row=>row.map(cell=>cell.style.borders)),grid.rows.map(row=>row.map(cell=>cell.style.borders)),'Resolved frame/grid borders survive native re-export');

const colors={wholeTbl:'101010',band1H:'202020',band2H:'303030',band1V:'404040',band2V:'505050',lastCol:'606060',firstCol:'707070',lastRow:'808080',seCell:'909090',swCell:'A0A0A0',firstRow:'B0B0B0',neCell:'C0C0C0',nwCell:'D0D0D0'};
const conditions=Object.entries(colors).map(([name,color])=>part(name,edge('top',line(color)))).join('');
const properties='firstRow="1" lastRow="1" firstCol="1" lastCol="1" bandRow="1" bandCol="1"';
const conditional=await fixture({rows:5,columns:5,properties,definition:conditions});assert.deepEqual(conditional.diagnostics,[]);
assert.deepEqual(conditional.rows.map(row=>row.map(cell=>cell.style.borders.top.color)),[
 ['#D0D0D0','#B0B0B0','#B0B0B0','#B0B0B0','#C0C0C0'],
 ['#707070','#404040','#505050','#404040','#606060'],
 ['#707070','#404040','#505050','#404040','#606060'],
 ['#707070','#404040','#505050','#404040','#606060'],
 ['#A0A0A0','#808080','#808080','#808080','#909090']
]);
const one=await fixture({rows:1,columns:1,properties,definition:conditions});assert.equal(one.rows[0][0].style.borders.top.color,'#D0D0D0');
const partial=await fixture({definition:frame+part('firstRow',edge('top','<a:ln w="47625"/>')),properties:'firstRow="1"',direct:(r,c)=>r===0&&c===0?`<a:lnT>${rgb('FEDCBA')}</a:lnT>`:''});
assert.deepEqual(partial.diagnostics,[]);assert.deepEqual(partial.rows[0][0].style.borders.top,{color:'#FEDCBA',width:5});assert.deepEqual(partial.rows[0][1].style.borders.top,{color:'#AA0000',width:5});
const reset=await fixture({definition:frame,direct:()=>'<a:lnT><a:noFill/></a:lnT><a:lnL w="0"/>'});assert.deepEqual(reset.diagnostics,[]);
assert.ok(reset.rows.flat().every(cell=>cell.style.borders.top.width===0&&cell.style.borders.left.width===0));
const overrideInterior=await fixture({definition:frame+part('band1H',edge('insideH',line('ABCDEF',9525))),properties:'bandRow="1"'});
assert.equal(overrideInterior.rows[0][1].style.borders.top.color,'#AA0000','Interior overrides do not recolor the outer frame');
assert.equal(overrideInterior.rows[0][1].style.borders.bottom.color,'#ABCDEF');
assert.equal(overrideInterior.rows[1][1].style.borders.top.color,'#112233');

const reference=index=>part('wholeTbl',edge('top',`<a:lnRef idx="${index}"><a:srgbClr val="2468AC"><a:alpha val="50000"/></a:srgbClr></a:lnRef>`));
const theme=line('FF0000')+'<a:ln w="28575"><a:solidFill><a:schemeClr val="phClr"><a:alphaMod val="50000"/></a:schemeClr></a:solidFill><a:prstDash val="dot"/></a:ln>';
const referenced=await fixture({definition:reference(2),theme});assert.deepEqual(referenced.diagnostics,[]);
assert.deepEqual(referenced.rows[0][0].style.borders.top,{color:'#2468AC40',width:3,dash:'dot'});
const single=await fixture({definition:reference(1),theme:line('ABCDEF')});assert.deepEqual(single.diagnostics,[]);assert.equal(single.rows[0][0].style.borders.top.color,'#ABCDEF');
const none=await fixture({definition:frame+part('firstRow',edge('top','<a:lnRef idx="0"/>')),properties:'firstRow="1"'});assert.deepEqual(none.diagnostics,[]);assert.equal(none.rows[0][0].style.borders.top.color,'#AA0000');
const zero=await fixture({definition:reference(0)});assert.deepEqual(zero.diagnostics,[]);assert.equal(zero.rows[0][0].style.borders.top.width,0,'Index zero alone must not invent a black default border');
const missing=await fixture({definition:reference(999)});assert.equal(missing.diagnostics.filter(d=>d.code==='unsupported-table-border').length,3);
const incomplete=await fixture({definition:reference(999),direct:()=>`<a:lnT>${rgb('FEDCBA')}</a:lnT>`});assert.ok(incomplete.diagnostics.some(d=>d.code==='unsupported-table-border'));
for(const direct of ['<a:lnT><a:noFill/></a:lnT>','<a:lnT w="0"/>',`<a:lnT w="19050">${rgb('FEDCBA')}<a:prstDash val="solid"/></a:lnT>`]){
 const masked=await fixture({definition:reference(999),direct:()=>direct});assert.deepEqual(masked.diagnostics,[],'Invisible or complete direct lines mask missing theme references');
}
const diagonal=await fixture({definition:part('wholeTbl',edge('tl2br',line()))});assert.ok(diagonal.diagnostics.some(d=>d.code==='unsupported-table-cell-effect'));
const custom=await fixture({definition:part('wholeTbl',edge('top',`<a:ln w="19050">${rgb('123456')}<a:custDash><a:ds d="100000" sp="100000"/></a:custDash></a:ln>`)),direct:()=>'<a:lnT><a:prstDash val="dash"/></a:lnT>'});assert.deepEqual(custom.diagnostics,[],'A direct preset dash replaces an inherited custom dash');
// Replace the first four native cells with one dense 2x2 merge. Blank
// continuation properties are unspecified; explicit differing edge segments
// must diagnose instead of disappearing silently.
const merge=(xml,segment='')=>{let index=0;return xml.replace(/<a:tc(?:\s[^>]*)?>[\s\S]*?<\/a:tc>/g,cell=>{
 const i=index++;if(i===0)return cell.replace('<a:tc>','<a:tc rowSpan="2" gridSpan="2">');
 if(i===1)return `<a:tc rowSpan="2" hMerge="1"><a:tcPr>${segment}</a:tcPr></a:tc>`;
 if(i===3)return '<a:tc gridSpan="2" vMerge="1"><a:tcPr/></a:tc>';
 if(i===4)return '<a:tc hMerge="1" vMerge="1"><a:tcPr/></a:tc>';
 return cell;
});};
const merged=await fixture({definition:frame,rows:2,modify:xml=>merge(xml)});
assert.deepEqual(merged.diagnostics,[]);assert.equal(merged.rows[0][0].rowSpan,2);assert.equal(merged.rows[0][0].colSpan,2);
assert.equal(merged.rows[0][0].style.borders.bottom.color,'#0000AA','Merged anchor reaches the outer bottom frame');
assert.equal(merged.rows[0][0].style.borders.right.color,'#445566','Merged anchor ends at an interior vertical edge');
const segments=await fixture({definition:frame,rows:2,modify:xml=>merge(xml,`<a:lnT w="9525">${rgb('ABCDEF')}</a:lnT>`)});
assert.ok(segments.diagnostics.some(d=>d.code==='unsupported-table-merge-border'&&d.path.endsWith('rows.0.1')));
assert.equal(segments.rows[0][0].style.borders.top.color,'#AA0000');assert.equal(segments.rows[0][1],null);
console.log('Native conditional table borders passed: outer frame/interior grid, bands/edges/corners, partial/direct overrides, theme lines/alpha, missing-reference masking, repeated conversion and diagnostics.');
