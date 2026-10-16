import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {boxStatistics} from '../dist/charts.js';
import {toSvg} from '../dist/svg.js';
const deck=(type,rows)=>({slides:[{chart:{type,data:{columns:['Category','Value'],rows}}}]});
const finiteSvg=svg=>assert.doesNotMatch(svg,/NaN|Infinity|undefined/,'finite values produce valid SVG numbers/colors');
for(const values of [[Number.MAX_VALUE,Number.MAX_VALUE],[-Number.MAX_VALUE,Number.MAX_VALUE]]) {
  assert.throws(()=>boxStatistics(values),/box statistics exceeds the finite numeric range/);
  assert.throws(()=>toSvg(deck('box-and-whisker',values.map(value=>['A',value])),1),
    error=>error instanceof RangeError&&/Cannot render slides\.0\.chart: box statistics exceeds the finite numeric range/.test(error.message));
}
for(const values of [[-Number.MAX_VALUE,0,Number.MAX_VALUE],[Number.MAX_VALUE,Number.MAX_VALUE],[-Number.MAX_VALUE,-Number.MAX_VALUE]]) {
  const document=deck('world',values.map((value,index)=>[String(index),value]));
  const before=JSON.stringify(document);
  finiteSvg(toSvg(document,1));
  assert.equal(JSON.stringify(document),before,'rendering preserves the authored values');
}
assert.deepEqual(boxStatistics([2,4,8,12]),{q1:2.5,median:6,q3:11,mean:6.5,low:2,high:12,outliers:[]});
assert.equal(boxStatistics([null]),null);
// These ordinary SVG hashes were captured before this arithmetic-only fix.
const ordinary={'box-and-whisker':'2d371b30269c317883d1b3c85ac3024ca0a50980147fa68b513fc10e7a9a4ad1',world:'7372a5c265bc5eed1551283f58d65c61aeab84d38f03f5bd430a7638f5124a69'};
for(const [type,expected] of Object.entries(ordinary)) {
  const svg=toSvg(deck(type,[['A',2],['A',4],['B',8],['B',12]]),1);
  finiteSvg(svg);
  assert.equal(createHash('sha256').update(svg).digest('hex'),expected,`${type}: ordinary SVG bytes remain unchanged`);
}
console.log('Finite extreme chart stats refuse explicitly; map colors stay finite; ordinary SVG bytes exact.');
