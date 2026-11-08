// LH-93: shared horizontal stacked plots refit full-size names/segment values after contraction.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide} from '../dist/composition.js';
const chart = (rows, names = ['Current', 'Expansion'], type = 'stacked-bar', extra = {}) => ({chart: {type, data: {columns: ['Stage', ...names], rows}, ...extra}});
const items = (a, b) => composeSlide({title: 'Pipeline by stage', blocks: [a, b]}, {width: 1280, height: 720}).items.filter(item => item.field === 'chart');
const plot = item => {const p = item.chart.layer.plot; return {x: item.box.x + p.left, y: item.box.y + p.top, width: item.box.width - p.left - p.right, height: item.box.height - p.top - p.bottom};};
const shared = result => {
  assert.equal(result.length, 2);
  const [a,b] = result.map(plot);
  for(const key of ['width','height','y']) assert.ok(Math.abs(a[key]-b[key]) < 1e-6, key + ': identical plot');
  assert.deepEqual(result[0].chart.valueAxis,result[1].chart.valueAxis);
  for(const item of result){const p=plot(item);assert.ok(p.x>=item.box.x && p.x+p.width<=item.box.x+item.box.width+.001 && p.y>=item.box.y && p.y+p.height<=item.box.y+item.box.height+.001);}
};

test('stacked and percent horizontal siblings share dimensions and refit names at segment starts',()=>{
  for(const type of ['stacked-bar','100pct-stacked-bar']){
    const result=items(chart([['Lead',120,64],['Won',50,30]],undefined,type),chart([['Partner sourced accounts with review',96,52],['Won',80,30]],undefined,type));shared(result);
    for(const item of result){
      const p=plot(item), stack=item.chart.layer.stack, axis=item.chart.valueAxis;
      assert.ok(stack.names?.above,'names still fit at unchanged size');
      const total=item.value.data.rows[0].slice(1).reduce((a,b)=>a+Math.abs(b),0);
      for(const [j,entry]of stack.names.entries.entries()){
        const preceding=item.value.data.rows[0].slice(1,j+1).reduce((a,b)=>a+b,0)/(axis.percent?total:1);
        assert.ok(Math.abs(entry.box.x-(p.x+(preceding-axis.min)/(axis.max-axis.min)*p.width))<1e-6,'name follows final shared segment');
        assert.equal(entry.box.height,28.5,'text size/line height is retained');
      }
      if(type.startsWith('100pct')){assert.ok(stack.values.flat().every(value=>!value));assert.notEqual(stack.valueAxis,false,'percentage axis remains');}
    }
  }
});

test('contraction restores the original legend when series names would meet',()=>{
  const a=chart([['Lead',30,70],['Won',30,70]],['AAAA','BBBB']);
  const before=items(a,a), after=items(a,chart([['Partner sourced accounts with review',30,70],['Won',30,70]],['AAAA','BBBB']));
  assert.ok(before[0].chart.layer.stack.names?.above);
  shared(after);
  assert.equal(after[0].chart.layer.stack.names,undefined);
  assert.deepEqual(after[0].chart.layer.header,before[0].chart.layer.stack.legend,'full original legend retains names and exact boxes');
});

test('a segment that loses its value label restores the numeric axis and tick band',()=>{
  const a=chart([['Lead',5,95],['Won',5,95]],['X','Y']);
  const before=items(a,a), after=items(a,chart([['Partner sourced accounts with review',5,95],['Won',5,95]],['X','Y']));
  assert.equal(before[0].chart.layer.stack.valueAxis,false);
  assert.deepEqual(before[0].chart.layer.stack.values,[[true,true],[true,true]]);
  shared(after);
  for(const item of after){assert.notEqual(item.chart.layer.stack.valueAxis,false);assert.deepEqual(item.chart.layer.stack.values,[[false,false],[true,true]]);assert.equal(item.chart.layer.plot.bottom,38.5,'full tick row restored');}
});

test('negative/null data and authored chart options retain their contracts',()=>{
  const rows=[['Lead',-20,64],['Won',null,30]],a=chart(rows),b=chart([['Partner sourced accounts with review',-10,52],['Won',null,30]]);
  const result=items(a,b);shared(result);assert.deepEqual(result[0].value.data.rows,rows);assert.equal(result[0].chart.layer.stack.values[0][1],false,'null never gains a numeric label');
  const opt=items(chart([['Lead',120,64],['Won',50,30]],undefined,'stacked-bar',{legend:'bottom'}),chart([['Partner sourced accounts with review',96,52],['Won',80,30]]));
  assert.equal(opt[0].chart.layer?.stack,undefined,'authored options keep their native chart policy');
});
