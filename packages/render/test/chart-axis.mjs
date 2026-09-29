import assert from 'node:assert/strict';
import {renderSvg} from '../dist/svg.js';
import {validatePresentation} from '@openpresentation/opf';

const MAX=Number.MAX_VALUE,MIN=Number.MIN_VALUE;
// Fractions are independent authored expectations, not a copy of the axis helper.
const fixtures=[
  {name:'positive',values:[1,3,2],fractions:[1/3,1,2/3],zero:0,min:0,max:3},
  {name:'negative',values:[-1,-3,-2],fractions:[2/3,0,1/3],zero:1,min:-3,max:0},
  {name:'mixed-sign',values:[-2,0,3],fractions:[0,0.4,1],zero:0.4,min:-2,max:3},
  {name:'constant',values:[5,5,5],fractions:[1,1,1],zero:0,min:0,max:5},
  {name:'zero',values:[0,0,0],fractions:[0,0,0],zero:0,min:0,max:1},
  {name:'subnormal',values:[MIN,2*MIN,3*MIN],fractions:[1/3,2/3,1],zero:0,min:0,max:3*MIN},
  {name:'maximum-positive',values:[MAX/4,MAX/2,MAX],fractions:[0.25,0.5,1],zero:0,min:0,max:MAX},
  {name:'maximum-negative',values:[-MAX,-MAX/2,-MAX/4],fractions:[0,0.5,0.75],zero:1,min:-MAX,max:0},
  {name:'mixed-extremes',values:[-MAX,0,MAX],fractions:[0,0.5,1],zero:0.5,min:-MAX,max:MAX},
];
const attributes=text=>Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([,k,v])=>[k,v]));
const elements=(svg,name)=>[...svg.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'g'))].map(([,a])=>attributes(a));
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-9,`${message}: ${actual} != ${expected}`);
const points=value=>value.trim().split(/\s+/).map(pair=>pair.split(',').map(Number));
const chartPath='slides.0.chart';
let checked=0;

for(const fixture of fixtures)for(const type of ['column','bar','line','area']){
  const name=`${fixture.name}/${type}`,horizontal=type==='bar';
  const input={slides:[{title:fixture.name,chart:{type,data:{columns:['Category','Value'],rows:fixture.values.map((v,i)=>[`Item ${i+1}`,v])}}}]};
  const before=JSON.stringify(input);
  assert.equal(validatePresentation(input).valid,true,`${name}: valid finite source`);
  const svg=renderSvg(input,{trace:true});
  assert.equal(renderSvg(input,{trace:true}),svg,`${name}: deterministic bytes`);
  assert.equal(JSON.stringify(input),before,`${name}: unchanged authored source`);
  // Covers coordinates, path/point geometry and actual rendered label content.
  assert.doesNotMatch(svg,/(?:NaN|[-+]?Infinity)/,`${name}: no nonfinite geometry or labels`);
  for(const [,raw] of svg.matchAll(/<(?:svg|rect|circle|line|polyline|polygon|path|text|g)\b([^>]*)>/g)){
    const attrs=attributes(raw);
    for(const key of ['x','y','width','height','x1','x2','y1','y2','cx','cy','r','stroke-width']){
      if(attrs[key]!==undefined)assert.ok(Number.isFinite(Number(attrs[key])),`${name}: ${key}=${attrs[key]}`);
    }
    for(const key of ['points','d','transform'])if(attrs[key]!==undefined){
      for(const numeric of attrs[key].match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi)??[]){
        assert.ok(Number.isFinite(Number(numeric)),`${name}: finite ${key}`);
      }
    }
  }
  const lines=elements(svg,'line');
  assert.equal(lines.length,6,`${name}: five tick grids plus zero axis`);
  const grids=lines.slice(0,5),axis=lines[5];
  const positions=grids.map(a=>Number(a[horizontal?'x1':'y1']));
  const low=horizontal?positions[0]:positions[4],high=horizontal?positions[4]:positions[0];
  assert.ok(high>low,`${name}: noncollapsed value axis`);
  for(let i=1;i<positions.length;i++)assert.ok(horizontal?positions[i]>=positions[i-1]:positions[i]<=positions[i-1],`${name}: ordered tick positions`);
  const start=Number(grids[0][horizontal?'y1':'x1']),end=Number(grids[0][horizontal?'y2':'x2']);
  assert.ok(end>start,`${name}: positive category extent`);
  for(const grid of grids){
    near(Number(grid[horizontal?'y1':'x1']),start,`${name}: grid starts at category edge`);
    near(Number(grid[horizontal?'y2':'x2']),end,`${name}: grid ends at category edge`);
    near(Number(grid[horizontal?'x1':'y1']),Number(grid[horizontal?'x2':'y2']),`${name}: straight grid`);
  }
  const zeroPosition=Number(axis[horizontal?'x1':'y1']);
  near((horizontal?zeroPosition-low:high-zeroPosition)/(high-low),fixture.zero,`${name}: zero baseline`);
  const labels=[...svg.matchAll(/<g\b([^>]*data-opf-source-text="true"[^>]*)>([\s\S]*?)<\/g>/g)]
    .filter(([,a])=>attributes(a)['data-opf-path']===chartPath)
    .map(([,a,body])=>[...body.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(([,text])=>text).join(''));
  assert.equal(labels.length,5,`${name}: five logical tick labels`);
  assert.ok(labels.every(label=>label!==''&&Number.isFinite(Number(label))),`${name}: finite numeric tick labels`);
  assert.equal(Number(labels[0]),fixture.min,`${name}: exact first tick label`);
  assert.equal(Number(labels.at(-1)),fixture.max,`${name}: exact last tick label`);
  const marks=elements(svg,type==='line'||type==='area'?'circle':'rect')
    .filter(a=>/^slides\.0\.chart\.data\.rows\.\d+\.1$/.test(a['data-opf-path']??''));
  assert.equal(marks.length,3,`${name}: retain every authored point`);
  let previousCategory=-Infinity;
  marks.forEach((mark,i)=>{
    assert.equal(mark['data-opf-path'],`${chartPath}.data.rows.${i}.1`,`${name}: source row identity`);
    const v=fixture.values[i];
    const coordinate=type==='line'||type==='area'?Number(mark.cy):horizontal
      ?Number(mark.x)+(v<0?0:Number(mark.width))
      :Number(mark.y)+(v<0?Number(mark.height):0);
    near((horizontal?coordinate-low:high-coordinate)/(high-low),fixture.fractions[i],`${name}: authored value fraction ${i}`);
    const category=Number(mark[horizontal?'y':type==='line'||type==='area'?'cx':'x']);
    assert.ok(category>previousCategory,`${name}: authored category ordering`);previousCategory=category;
    assert.ok(category>=start&&category<=end,`${name}: category mark in plot`);
    if(type==='column'||type==='bar'){
      const a=Number(mark[horizontal?'x':'y']),b=a+Number(mark[horizontal?'width':'height']);
      assert.ok(a>=low-1e-9&&b<=high+1e-9,`${name}: bar bounds`);
      assert.ok(Number(mark.width)>=0&&Number(mark.height)>=0,`${name}: nonnegative bar dimensions`);
      near(v<0?(horizontal?b:a):(horizontal?a:b),zeroPosition,`${name}: each bar begins at zero`);
    }
  });
  if(type==='line'||type==='area'){
    const paths=elements(svg,'polyline');assert.equal(paths.length,1,`${name}: one series path`);
    const vertices=points(paths[0].points);assert.equal(vertices.length,3,`${name}: all series vertices`);
    vertices.forEach(([x,y],i)=>{near(x,Number(marks[i].cx),`${name}: vertex X`);near(y,Number(marks[i].cy),`${name}: vertex Y`);assert.ok(x>=start&&x<=end&&y>=low-1e-9&&y<=high+1e-9,`${name}: path bounds`);});
    if(type==='area'){
      const polygons=elements(svg,'polygon');assert.equal(polygons.length,1,`${name}: one area polygon`);
      const area=points(polygons[0].points);assert.equal(area.length,5,`${name}: area plus baseline endpoints`);
      near(area[0][1],zeroPosition,`${name}: area begins at baseline`);near(area.at(-1)[1],zeroPosition,`${name}: area ends at baseline`);
      for(const [x,y] of area)assert.ok(x>=start&&x<=end&&y>=low-1e-9&&y<=high+1e-9,`${name}: area bounds`);
    }
  }
  checked++;
}
console.log(`Chart axis passed: ${checked} public Cartesian cases; finite geometry/text, exact tick endpoints, zero baselines, authored fractions/order/bounds, source preservation and deterministic bytes.`);
