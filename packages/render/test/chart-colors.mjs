import assert from 'node:assert/strict';
import {renderSvg,resolvePresentation} from '../dist/svg.js';
import {colorContrast} from '@openpresentation/opf/composition';
const cases=[
 {background:'#FFFFFF',surface:'#F8FAFC',text:'#0F172A',expected:'#0F172A'},
 {background:'#000000',surface:'#334155',text:'#FFFFFF',expected:'#FFFFFF'},
 {background:'#000000',surface:'#F8FAFC',text:'#FFFFFF',expected:'#000000'},
 {background:'#FFFFFF',surface:'#0F172A',text:'#000000',expected:'#FFFFFF'},
 {background:'#000000',surface:'#FFFFFF80',text:'#FFFFFF',expected:'#FFFFFF'},
];
let checked=0;
for(const fixture of cases)for(const type of ['column','bar','line','area','pie','donut','stacked-column-3x','sparkline-5x']){
 const circular=['pie','donut'].includes(type);
 const chart={type,data:{columns:circular?['Quarter','Current']:['Quarter','Current','Baseline'],rows:circular?[['Q1',2],['Q2',3]]:[['Q1',2,1],['Q2',3,2]]}};
 const input={design:{background:fixture.background,colorScheme:{id:'cool-horizon',dark1:fixture.text,light1:fixture.text,dark2:fixture.surface,light2:fixture.surface}},slides:[{chart}]},original=structuredClone(input);
 const svg=renderSvg(input,{trace:true}),bound=resolvePresentation(input).slides[0];
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
// Unresolved data uses the same themed panel without inventing chart data.
const missing={design:{background:'#000000',colorScheme:{id:'cool-horizon',dark2:'#334155',light1:'#FFFFFF'}},slides:[{chart:{type:'column',data:{src:'asset:missing'}}}]};
const svg=renderSvg(missing);assert.ok(svg.includes('No chart data'));assert.ok(/<text[^>]*fill="#FFFFFF"[^>]*>No chart data<\/text>/.test(svg));
console.log(`Chart colors passed: ${checked} simple/catalog paths, light/dark/opposite surfaces, retained alpha and unresolved data; no source mutation.`);
