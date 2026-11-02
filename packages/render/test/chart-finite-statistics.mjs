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
  // LH-60: a map plots places (region codes here); over other categories it is drawn as columns.
  const document=deck('world',values.map((value,index)=>[['DE','FR','ES'][index],value]));
  const before=JSON.stringify(document);
  finiteSvg(toSvg(document,1));
  assert.equal(JSON.stringify(document),before,'rendering preserves the authored values');
}
assert.deepEqual(boxStatistics([2,4,8,12]),{q1:2.5,median:6,q3:11,mean:6.5,low:2,high:12,outliers:[]});
assert.equal(boxStatistics([null]),null);
// These ordinary SVG hashes were captured before this arithmetic-only fix and re-captured for RR-89 and RR-90 (series colours from the
// colour scheme, 20 px chart text), RR-96 (scheme-derived neutrals) and WI-5 (the chart panel has no outer frame), which change every chart's bytes on purpose.
// LH-60: the map is captured over region codes (DE, FR), since a map over A and B is drawn as columns; LH-56 gave its tile labels a colour per tile.
const ordinary={'box-and-whisker':'c8e5eda684548294ccb223b87e1871d80300173d467f570932ef5d0778890727',world:'1c73cddd4f061dff4bfee0cc0ec01d0d2b0ec4b807a9275b1e7bccce9d2d90f2'};
const labels={'box-and-whisker':['A','B'],world:['DE','FR']};
for(const [type,expected] of Object.entries(ordinary)) {
  const [a,b]=labels[type];
  const svg=toSvg(deck(type,[[a,2],[a,4],[b,8],[b,12]]),1);
  finiteSvg(svg);
  assert.equal(createHash('sha256').update(svg).digest('hex'),expected,`${type}: ordinary SVG bytes remain unchanged`);
}
console.log('Finite extreme chart stats refuse explicitly; map colors stay finite; ordinary SVG bytes exact.');
