import assert from 'node:assert/strict';
import {resolvePresentation, renderSlideSvg} from '../dist/svg.js';
import {colorContrast,chartPaletteForFill} from '@openpresentation/opf/composition';
import {CHART_SERIES_COLORS} from '../dist/charts.js';
const cases=[
 {background:'#FFFFFF',surface:'#F8FAFC',text:'#0F172A',expected:'#0F172A'},
 {background:'#000000',surface:'#334155',text:'#FFFFFF',expected:'#FFFFFF'},
 {background:'#000000',surface:'#F8FAFC',text:'#FFFFFF',expected:'#000000'},
 {background:'#FFFFFF',surface:'#0F172A',text:'#000000',expected:'#FFFFFF'},
 {background:'#000000',surface:'#FFFFFF80',text:'#FFFFFF',expected:'#FFFFFF'},
];
let checked=0;
for(const fixture of cases)for(const type of ['column','bar','line','area','pie','donut','stacked-column']){
 const circular=['pie','donut'].includes(type);
 const chart={type,data:{columns:circular?['Quarter','Current']:['Quarter','Current','Baseline'],rows:circular?[['Q1',2],['Q2',3]]:[['Q1',2,1],['Q2',3,2]]}};
 const input={design:{background:fixture.background,colorScheme:{id:'cool-horizon',dark1:fixture.text,light1:fixture.text,dark2:fixture.surface,light2:fixture.surface}},slides:[{chart}]},original=structuredClone(input);
 const svg=renderSlideSvg(input, 0,{trace:true}),bound=resolvePresentation(input).slides[0];
 assert.equal(bound.design.colors.surface,fixture.surface);
 const chartPath='slides.0.chart';
 const panel=[...svg.matchAll(/<rect\b([^>]*)>/g)].find(([,a])=>a.includes(`data-opf-path="${chartPath}"`));assert.ok(panel);assert.ok(panel[1].includes(`fill="${fixture.surface}"`));
 const labels=[...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)];assert.ok(labels.length>0);
 for(const [,a]of labels)assert.ok(a.includes(`fill="${fixture.expected}"`),`${type} ${fixture.surface}: ${a}`);
 const marks=[...svg.matchAll(/<(?:rect|path|circle|polyline)\b([^>]*)>/g)].filter(([,a])=>/data-opf-path="slides\.0\.chart\.data(?:\.|"|$)/.test(a));assert.ok(marks.length);
 for(const [,a]of marks){const color=(a.match(/\bfill="(#[0-9a-f]+)"/i)??a.match(/\bstroke="(#[0-9a-f]+)"/i))?.[1];assert.ok(color);if(fixture.surface.length===7)assert.ok(colorContrast(color,fixture.surface)>=3,`${type}: mark ${color} against ${fixture.surface}`);}
 if(fixture.surface.length===7)assert.ok(colorContrast(fixture.expected,fixture.surface)>=4.5);
 else assert.equal(colorContrast(fixture.expected,fixture.surface),undefined);
 assert.deepEqual(input,original);checked++;
}
// RR-29: on a dark card the default series colours stay distinguishable (two dark blues must not merge into one colour), by the same
// palette function the PPTX exporter calls, so preview and export draw the same series colours.
{
 const lightness=hex=>{const c=[1,3,5].map(i=>Number.parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);const y=.2126729*c[0]+.7151522*c[1]+.072175*c[2];return 116*(y>216/24389?Math.cbrt(y):(24389/27*y+16)/116)-16;};
 const seriesFills=(surface,type)=>{
  const input={design:{background:'#000000',colorScheme:{id:'cool-horizon',dark1:'#FFFFFF',light1:'#FFFFFF',dark2:surface,light2:surface}},slides:[{chart:{type,data:{columns:['Quarter','Current','Baseline','Third'],rows:[['Q1',2,1,3],['Q2',3,2,1]]}}}]};
  const svg=renderSlideSvg(input, 0,{trace:true});
  const byColumn=new Map();
  for(const [,a] of svg.matchAll(/<rect\b([^>]*)>/g)){const path=a.match(/data-opf-path="slides\.0\.chart\.data\.rows\.\d+\.(\d+)"/);const fill=a.match(/\bfill="(#[0-9a-f]{6})"/i);if(path&&fill)byColumn.set(Number(path[1]),fill[1].toUpperCase());}
  return [...byColumn.entries()].sort((x,y)=>x[0]-y[0]).map(([,color])=>color);
 };
 for(const surface of ['#334155','#1B1B1B','#011842']){
  const fills=seriesFills(surface,'column');
  assert.equal(fills.length,3,'three series marks '+surface);
  assert.equal(new Set(fills).size,3,'distinct series colours on '+surface+': '+fills);
  for(const [a,b] of [[0,1],[1,2]])assert.ok(Math.abs(lightness(fills[a])-lightness(fills[b]))>=9,surface+': series '+(a+1)+' and '+(b+1)+' are '+fills[a]+' and '+fills[b]+', too close in lightness');
  for(const color of fills)assert.ok(colorContrast(color,surface)>=3,color+' on '+surface);
  assert.deepEqual(fills,chartPaletteForFill(surface,CHART_SERIES_COLORS).slice(0,3),'preview colours are the shared palette function colours');
  checked++;
 }
}
// Unresolved data (a data source by asset, which the format no longer has, drawn with validation off) uses the same themed panel without inventing chart data.
const missing={design:{background:'#000000',colorScheme:{id:'cool-horizon',dark2:'#334155',light1:'#FFFFFF'}},slides:[{chart:{type:'column',data:{src:'asset:missing'}}}]};
const svg=renderSlideSvg(missing, 0, {validate:false});assert.ok(svg.includes('No chart data'));assert.ok(/<text[^>]*fill="#FFFFFF"[^>]*>No chart data<\/text>/.test(svg));
console.log(`Chart colors passed: ${checked} simple/catalog paths, light/dark/opposite surfaces, retained alpha and unresolved data; no source mutation.`);
