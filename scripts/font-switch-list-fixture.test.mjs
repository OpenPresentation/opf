import assert from 'node:assert/strict';
import test from 'node:test';
import {fontSwitchListBlock} from './font-switch-list-fixture.mjs';
import {checkLayoutFixtures} from './published-matrix/layout-fixtures.mjs';
test('explicit list fixtures retain labels without mutating caller input',()=>{
  const labels=['Root','First','Second'],before=structuredClone(labels);
  assert.deepEqual(fontSwitchListBlock(labels,{regions:[{accepts:['list'],arrangement:'chevrons'}]}),{items:labels.map(text=>({text}))});
  assert.deepEqual(labels,before);
});
test('declared parent/child arrangements get flat OPF levels, preserving label order',()=>{
  for(const arrangement of ['org-chart','hierarchy'])assert.deepEqual(fontSwitchListBlock(['Root','First','Second'],{regions:[{regions:[{accepts:['list'],arrangement}]}]}),{items:[{text:'Root',level:0},{text:'First',level:1},{text:'Second',level:1}]});
});
test('current real catalog placement and painted label retention, with the released bad fixture as a negative control',async()=>{
  const result=await checkLayoutFixtures(new URL('./published-matrix/engines-source.mjs',import.meta.url).href);
  assert.ok(result.listLayouts.includes('inverted-pyramid'));assert.ok(result.listLayouts.includes('org-chart'));assert.ok(result.listLayouts.includes('hierarchy'));assert.ok(result.listLayouts.includes('venn'));
});

test('matrix fixtures fill four quadrants from existing localized text and refuse a missing fourth label',()=>{
 const layout={regions:[{accepts:['list'],arrangement:'matrix'}]},labels=['一','二','三'];
 assert.throws(()=>fontSwitchListBlock(labels,layout),/fourth localized label/);
 assert.deepEqual(fontSwitchListBlock(labels,layout,{supplementalLabel:'次の手順'}).items.map(item=>item.text),['一','二','三','次の手順']);
 assert.deepEqual(labels,['一','二','三']);
});
