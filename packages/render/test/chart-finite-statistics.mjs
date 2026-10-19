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
// These ordinary SVG hashes were captured before this arithmetic-only fix and re-captured for RR-89 and RR-90 (series colours from the
// colour scheme, 20 px chart text) and RR-96 (scheme-derived neutrals), which change every chart's bytes on purpose.
const ordinary={'box-and-whisker':'6c9685b42fb2e3997575b8830adf5048e345f156a5d932f289706d67e3b3516a',world:'87256993cac4736dd79071aba9c9f36c180cc311087c97a47e15e86d1a269e46'};
for(const [type,expected] of Object.entries(ordinary)) {
  const svg=toSvg(deck(type,[['A',2],['A',4],['B',8],['B',12]]),1);
  finiteSvg(svg);
  assert.equal(createHash('sha256').update(svg).digest('hex'),expected,`${type}: ordinary SVG bytes remain unchanged`);
}
console.log('Finite extreme chart stats refuse explicitly; map colors stay finite; ordinary SVG bytes exact.');
