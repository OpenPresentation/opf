import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {resolveSlideContext} from '../dist/index.js';
import {chartNumericAxes,composeSlide,resolveChartData} from '../dist/composition.js';
import {gallery} from '@openpresentation/gallery';
const geometry={box:{x:0,y:0,width:600,height:400},scale:1,measure:(text,size)=>text.length*size*.5};
const cases=[['positive',[8400000,-1250000,-640000,380000,6890000],{min:0,max:10000000,majorUnit:2000000}],['negative',[-3,1,-1,-3],{min:-4,max:0,majorUnit:1}],['crossing',[3,-7,6,2],{min:-6,max:4,majorUnit:2}],['gaps',[8,null,-3,null,5],{min:0,max:10,majorUnit:2}],['nulls',[null,null],{min:0,max:1.2,majorUnit:.2}]];
test('RR-105: hidden waterfall scale follows running totals, sign crossings, gaps and terminal totals',()=>{
 for(const [name,values,expected]of cases){
  const chart={type:'waterfall',data:{columns:['Stage','Cost'],rows:values.map((v,i)=>['Stage '+i,v])}};
  assert.deepEqual(chartNumericAxes(chart,resolveChartData(chart),geometry,{waterfall:{valueAxis:false,roles:[],labels:true,colors:true},header:{height:25}}),{value:expected},name);
 }
});
test('RR-105: qualification freight waterfall keeps its reviewed ten-million maximum',()=>{
 const deck=JSON.parse(fs.readFileSync(new URL('../../../scripts/native-acceptance/qualification/decks/layout-harvest.opf.json',import.meta.url),'utf8'));
 const context=resolveSlideContext(deck,18,{catalogs:[gallery]});
 const item=composeSlide(context.slide,context.options).items.find(item=>item.field==='chart');
 assert.deepEqual(item.chart.layer.numericAxes,{value:{min:0,max:10000000,majorUnit:2000000}});
 assert.equal(item.chart.layer.waterfall.valueAxis,false);
});
test('RR-105: visible/titled waterfall and lone-column data keep finite numeric axes',()=>{
 for(const data of [{columns:['Stage','Cost'],rows:[['A',8],['B',null],['C',-3],['D',null],['E',5]]},{columns:['Cost'],rows:[[8],[null],[-3],[null],[5]]}]){
  const chart={type:'waterfall',data,dataLabels:false,axisTitles:{category:'Stage',value:'Cost'}};
  assert.deepEqual(chartNumericAxes(chart,resolveChartData(chart),geometry,{waterfall:{valueAxis:true,roles:[],labels:false,colors:true}}),{value:{min:0,max:10,majorUnit:2}});
 }
 const huge={type:'waterfall',data:{columns:['Cost'],rows:[[1e308],[1e308]]}};
 assert.equal(chartNumericAxes(huge,resolveChartData(huge),geometry),undefined,'finite-range overflow remains a renderer diagnostic');
});
