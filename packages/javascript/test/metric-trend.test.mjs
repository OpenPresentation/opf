import assert from 'node:assert/strict';
import {test} from 'node:test';
import { colorSchemes } from './support/catalog.mjs'; import { METRIC_TREND_MIN_CONTRAST, METRIC_TREND_SHAPES, colorContrast, layoutMetric, metricTrendColor, metricTrendMark, metricTrendPoints } from '../dist/composition.js';

const box={x:40,y:60,width:600,height:400};

test('trend maps to the DrawingML arrow presets and a text alternative',()=>{
  assert.deepEqual({...METRIC_TREND_SHAPES},{up:'upArrow',down:'downArrow',flat:'rightArrow'});
  for(const [trend,shape] of Object.entries(METRIC_TREND_SHAPES)) {
    const layout=layoutMetric({value:42,delta:'+3',trend},box,{path:'m'});
    const mark=metricTrendMark(layout,{background:'#FFFFFF'});
    assert.equal(mark.trend,trend);assert.equal(mark.shape,shape);assert.equal(mark.ariaLabel,`Trend: ${trend}`);assert.equal(mark.path,'m.trend');
    assert.equal(mark.box.width,mark.box.height);
    assert.equal(mark.points.length,7);
  }
});

test('the arrow sits on the trend word baseline, after it for left alignment and before it for centre and right, inside the field',()=>{
  for(const align of ['left','center','right']) {
    const layout=layoutMetric({value:42,label:'Latency',trend:'up'},box,{align});
    const part=layout.parts.find(candidate=>candidate.role==='trend'),line=part.fit.sourceLines[0],origin=part.linePositions[0];
    const mark=metricTrendMark(layout,{background:'#FFFFFF'});
    assert.ok(mark,align);
    assert.equal(mark.box.y+mark.box.height,origin.baseline);
    assert.ok(mark.box.x>=part.box.x&&mark.box.x+mark.box.width<=part.box.x+part.box.width);
    if(align==='left')assert.ok(mark.box.x>=origin.x+line.width);else assert.ok(mark.box.x+mark.box.width<=origin.x);
  }
});

test('no mark without a visible trend, or when the arrow has no room',()=>{
  assert.equal(metricTrendMark(layoutMetric({value:42,delta:'+3'},box),{background:'#FFFFFF'}),undefined);
  assert.equal(metricTrendMark(layoutMetric(42,box),{background:'#FFFFFF'}),undefined);
  const narrow=layoutMetric({value:1,trend:'down'},{...box,width:60},{align:'left'});
  const mark=metricTrendMark(narrow,{background:'#FFFFFF'});
  if(mark){const part=narrow.parts.find(candidate=>candidate.role==='trend');assert.ok(mark.box.x>=part.box.x-.01&&mark.box.x+mark.box.width<=part.box.x+part.box.width+.01);}
});

test('preset arrow outlines match the DrawingML geometry at default adjustments',()=>{
  const square={x:0,y:0,width:20,height:20};
  assert.deepEqual(metricTrendPoints('upArrow',square),[[0,10],[10,0],[20,10],[15,10],[15,20],[5,20],[5,10]]);
  assert.deepEqual(metricTrendPoints('downArrow',square),[[0,10],[5,10],[5,0],[15,0],[15,10],[20,10],[10,20]]);
  assert.deepEqual(metricTrendPoints('rightArrow',square),[[0,5],[10,5],[10,0],[20,10],[10,20],[10,15],[0,15]]);
});

test('trend colours keep >=4.5:1 on light, dark and mid-tone backgrounds, for every catalog colour scheme',()=>{
  const backgrounds=['#FFFFFF','#000000','#0F172A','#808080','#7F7F7F','#2563EB','#F59E0B'];
  for(const scheme of colorSchemes) backgrounds.push(scheme.light1,scheme.dark1,scheme.light2,scheme.dark2);
  for(const background of backgrounds) for(const trend of ['up','down','flat']) {
    const color=metricTrendColor(trend,{background});
    assert.ok(colorContrast(color,background)>=METRIC_TREND_MIN_CONTRAST,`${trend} ${color} on ${background}`);
  }
  assert.equal(metricTrendColor('up',{background:'#FFFFFF'}),'#15803D');
  assert.equal(metricTrendColor('down',{background:'#0F172A'}),'#F87171');
  assert.notEqual(metricTrendColor('up',{background:'#FFFFFF'}),metricTrendColor('down',{background:'#FFFFFF'}));
});
