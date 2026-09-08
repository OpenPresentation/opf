import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {validatePresentation} from '@openpresentation/opf';
import {renderSvg} from '@openpresentation/opf-render';
import {toPptx} from '../dist/index.js';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const all=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const table={columns:[[{text:'Normal ',bold:false},{text:'bold',bold:true}],'Scalar'],rows:[
 [['A ',{text:'Bold',bold:true,color:'#A00000'},' tail'],['H',{text:'2',subscript:true},'O']],
 [[{text:'Link',link:'https://example.com',underline:true,fontFamily:'Alias',italic:true,strikethrough:true}],true],
 [null,12.5],
 [[{text:'Large',fontSize:18},' small'],['x',{text:'2',superscript:true}]],
 [[' A  B\nC ',{text:' emoji 👩‍💻',color:'#123456'}],[]],
 [[{text:'Alpha',color:'#12345680'},{text:'Short',color:'#abc'},{text:'Fallback',color:'invalid'}],null],
 [['Start\n',{text:'\nEnd\n',bold:true}],['\nLeading'] ],
]};
const deck={design:{theme:'classic',fontScheme:'roboto'},slides:[{table}]},before=structuredClone(deck);
const measurement={measure:(text,size,style)=>[...text].length*size*(style.fontWeight>=600?.6:.5),resolveStyle:style=>style.fontFamily==='Alias'?{...style,fontFamily:'Resolved'}:style};
assert.equal(validatePresentation(deck).valid,true);
const svg=renderSvg(deck,{trace:true,textMeasurement:measurement});
assert.match(svg,/data-opf-rich-text="true"/);
assert.match(svg,/data-opf-path="slides\.0\.table\.rows\.0\.0"/);
assert.ok(/<text(?=[^>]*font-weight="700")(?=[^>]*fill="#A00000")[^>]*>Bold<\/text>/.test(svg));
assert.match(svg,/href="https:\/\/example.com"/);
assert.match(svg,/font-family="Resolved,/);
const entries=unzipSync(await toPptx(deck,{textMeasurement:measurement}));
const xml=new TextDecoder().decode(entries['ppt/slides/slide1.xml']);assert.equal(XMLValidator.validate(xml),true);
const frame=parser.parse(xml)['p:sld']['p:cSld']['p:spTree']['p:graphicFrame'];
const native=frame['a:graphic']['a:graphicData']['a:tbl'];
const cells=all(native['a:tr']).map(row=>all(row['a:tc']));
const runs=cell=>all(cell['a:txBody']['a:p']).flatMap(p=>all(p['a:r']));
assert.equal(runs(cells[0][0])[0]['a:rPr'].b,undefined,'Explicit normal run overrides bold header');
assert.equal(runs(cells[0][0])[1]['a:rPr'].b,'1');
const body=runs(cells[1][0]);assert.equal(body.map(r=>r['a:t']).join(''),'A Bold tail');
assert.equal(body[1]['a:rPr'].b,'1');assert.equal(body[1]['a:rPr']['a:solidFill']['a:srgbClr'].val,'A00000');
const link=runs(cells[2][0])[0]['a:rPr'];assert.equal(link['a:latin'].typeface,'Resolved');assert.equal(link.i,'1');assert.equal(link.u,'sng');assert.equal(link.strike,'sngStrike');assert.ok(link['a:hlinkClick']['r:id']);
assert.ok(Number(runs(cells[1][1])[1]['a:rPr'].baseline)<0,'Subscript baseline');
assert.ok(Number(runs(cells[4][1])[1]['a:rPr'].baseline)>0,'Superscript baseline');
assert.equal(runs(cells[4][0])[0]['a:rPr'].sz,'1800','Explicit point size is retained');
assert.equal(runs(cells[2][1]).map(r=>r['a:t']).join(''),'true');assert.equal(runs(cells[3][1]).map(r=>r['a:t']).join(''),'12.5');
const paragraphs=all(cells[5][0]['a:txBody']['a:p']);
assert.deepEqual(paragraphs.map(p=>all(p['a:r']).map(r=>r['a:t']).join('')),[' A  B','C  emoji 👩‍💻'],'Only explicit newlines create native paragraphs; whitespace survives');
for(const cell of cells.flat()) for(const paragraph of all(cell['a:txBody']['a:p'])) assert.ok(!Array.isArray(paragraph['a:pPr']),'Each native paragraph has at most one properties element');
const colored=runs(cells[6][0]).map(r=>r['a:rPr']['a:solidFill']['a:srgbClr']);
assert.equal(colored[0].val,'123456');assert.ok(Math.abs(Number(colored[0]['a:alpha'].val)-128/255*100000)<2,'Eight-digit colors preserve alpha');
assert.equal(colored[1].val,'AABBCC');assert.match(colored[2].val,/^[0-9A-F]{6}$/,'Invalid run colors fall back to the theme');
const lines=cell=>all(cell['a:txBody']['a:p']).map(p=>all(p['a:r']).map(r=>r['a:t']??'').join(''));
assert.deepEqual(lines(cells[7][0]),['Start','','End',''],'Run boundaries preserve blank and trailing lines');
assert.deepEqual(lines(cells[7][1]),['','Leading'],'Leading blank lines survive');
assert.deepEqual(deck,before);
console.log('Rich tables passed: canonical headers/cells, SVG traces/styles/links, native editable runs/fonts/styles/point sizes/scripts/hyperlinks, scalar preservation and immutable input.');
