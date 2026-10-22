import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {toPptx,fromPptx} from '../dist/index.js';
import {colorHex,schemeRole,clrMapOf,themeColorsOf} from './helpers/scheme-colors.mjs';
import {colorContrast,chartPaletteForFill,chartSeriesPalette,ENGINE_DEFAULT_COLOR_SCHEME} from '@openpresentation/opf/composition';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false});
// RR-89 / RR-96: a series that keeps a theme accent, and any colour that is a scheme colour, is a schemeClr; the exported theme and the master's
// colour map hold the colour it stands for. `scheme` is {theme, map}, set per exported deck below.
let scheme;
const themeHex=value=>ENGINE_DEFAULT_COLOR_SCHEME[value].replace('#','').toUpperCase();
const schemeOf=entries=>({theme:themeColorsOf(new TextDecoder().decode(entries['ppt/theme/theme1.xml'])),map:clrMapOf(new TextDecoder().decode(entries['ppt/slideMasters/slideMaster1.xml']))});
const colorNodes=paint=>[...find(paint,'a:srgbClr').map(color=>({'a:srgbClr':color})),...find(paint,'a:schemeClr').map(color=>({'a:schemeClr':color}))];
const paintColors=paint=>colorNodes(paint).map(node=>colorHex(node,scheme.theme,scheme.map));
const array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const find=(value,key)=>!value||typeof value!=='object'?[]:Array.isArray(value)?value.flatMap(item=>find(item,key)):Object.entries(value).flatMap(([name,child])=>name===key?array(child):find(child,key));
// RR-96: chart text is core's derived chart-text neutral, a scheme colour with a luminance transform (tx1 on a surface the deck's text reads on), or
// the contrast-chosen black or white where the surface is on the other side. `expected` is the colour it resolves to; `role` the scheme role (if any).
const cases=[
 {background:'#FFFFFF',surface:'#F8FAFC',text:'#0F172A',expected:'39579F',role:'tx1'},
 {background:'#000000',surface:'#334155',text:'#FFFFFF',expected:'FFFFFF',role:'tx1'},
 {background:'#000000',surface:'#F8FAFC',text:'#FFFFFF',expected:'000000'},
 {background:'#FFFFFF',surface:'#0F172A',text:'#000000',expected:'FFFFFF'},
 {background:'#000000',surface:'#FFFFFF80',text:'#FFFFFF',expected:'A6A6A6',role:'tx1'},
];
let checked=0;
for(const fixture of cases)for(const type of ['column','bar','line','area','pie','doughnut','stacked-column']){
 const circular=['pie','doughnut'].includes(type);
 const data={columns:circular?['Quarter','Current']:['Quarter','Current','Baseline'],rows:circular?[['Q1',2],['Q2',3]]:[['Q1',2,1],['Q2',3,2]]};
 const input={design:{background:fixture.background,colorScheme:{id:'cool-horizon',dark1:fixture.text,light1:fixture.text,text:fixture.text,dark2:fixture.surface,light2:fixture.surface}},slides:[{chart:{type,data}}]},original=structuredClone(input);
 const bytes=await toPptx(input),entries=unzipSync(bytes),xml=new TextDecoder().decode(entries['ppt/charts/chart1.xml']),root=parser.parse(xml)['c:chartSpace'];
 scheme=schemeOf(entries);
 const nativeFill=root['c:spPr']['a:solidFill'];assert.deepEqual(paintColors(nativeFill),[fixture.surface.slice(1,7)]);
 const fillColor=nativeFill['a:srgbClr']??nativeFill['a:schemeClr'];
 if(fixture.surface.length===9)assert.ok(Math.abs(Number(fillColor['a:alpha'].val)-128/255*100000)<1);
 assert.ok(Object.hasOwn(root['c:chart']['c:plotArea']['c:spPr'],'a:noFill'),'Plot area must not stack alpha');
 const labelStyles=find(root,'c:txPr');assert.ok(labelStyles.length>0);
 for(const style of labelStyles){const colors=paintColors(style);assert.ok(colors.length>0);for(const color of colors)assert.equal(color,fixture.expected,`${type} ${fixture.surface}`);
  for(const node of colorNodes(style))assert.equal(schemeRole(node),fixture.role,`${type} ${fixture.surface}: text colour role`);
  if(fixture.surface.length===7)assert.ok(colorContrast('#'+fixture.expected,fixture.surface)>=4.5,`${type} text on ${fixture.surface}`);}
 const series=find(root,'c:ser');assert.ok(series.length);
 let paints=0;
 // A pie or doughnut series carries a default theme fill that its per-slice points replace: the slices are the paint.
 for(const item of circular?find(root,'c:dPt'):series)for(const style of find(item,'c:spPr')){
  const paint=type.includes('line')?style['a:ln']?.['a:solidFill']:style['a:solidFill'];
  for(const color of paintColors(paint)){paints++;if(fixture.surface.length===7)assert.ok(colorContrast('#'+color,fixture.surface)>=3,`${type} series ${color} against ${fixture.surface}`);}
 }
 assert.ok(paints>0,`${type}: every fixture must inspect actual native series/point paint`);
 const imported=await fromPptx(bytes);const charts=find(imported,'chart');assert.equal(charts.length,1);assert.deepEqual(charts[0].data,data,'Chart data remains editable/reimportable');
 assert.deepEqual(input,original);checked++;
}
// RR-29: on a dark card the exported series colours stay distinguishable (two dark blues must not merge into one colour), and they are the shared palette function's colours, the ones opf-render draws.
{
 const palette=chartSeriesPalette(ENGINE_DEFAULT_COLOR_SCHEME);
 const lightness=hex=>{const c=[1,3,5].map(i=>Number.parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);const y=.2126729*c[0]+.7151522*c[1]+.072175*c[2];return 116*(y>216/24389?Math.cbrt(y):(24389/27*y+16)/116)-16;};
 for(const surface of ['#334155','#1B1B1B','#011842']){
  const input={design:{background:'#000000',colorScheme:{id:'cool-horizon',dark1:'#FFFFFF',light1:'#FFFFFF',text:'#FFFFFF',dark2:surface,light2:surface}},slides:[{chart:{type:'column',data:{columns:['Quarter','Current','Baseline','Third'],rows:[['Q1',2,1,3],['Q2',3,2,1]]}}}]};
  const entries=unzipSync(await toPptx(input)),xml=new TextDecoder().decode(entries['ppt/charts/chart1.xml']);
  scheme=schemeOf(entries);
  const fills=[...xml.matchAll(/<c:ser>[\s\S]*?<c:spPr><a:solidFill>(?:<a:srgbClr val="([0-9A-F]{6})"|<a:schemeClr val="(\w+)")/g)].map(match=>'#'+(match[1]??colorHex({'a:schemeClr':{val:match[2]}},scheme.theme,scheme.map)));
  assert.equal(fills.length,3,'three native series on '+surface);
  assert.equal(new Set(fills).size,3,'distinct native series colours on '+surface+': '+fills);
  for(const [a,b] of [[0,1],[1,2]])assert.ok(Math.abs(lightness(fills[a])-lightness(fills[b]))>=9,surface+': native series '+(a+1)+' and '+(b+1)+' are '+fills[a]+' and '+fills[b]+', too close in lightness');
  assert.deepEqual(fills,chartPaletteForFill(surface,palette).slice(0,3),'native colours are the shared palette function colours on '+surface);
  checked++;
 }
}
console.log(`Native chart colors passed: ${checked} charts, explicit chart panel, single alpha fill, axis/legend colors and exact data reimport.`);
