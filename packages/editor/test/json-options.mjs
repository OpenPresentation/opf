import assert from 'node:assert/strict';
import {getJsonFieldContext,replaceFieldOption} from '../dist/json-options.js';
const record=(id,name=id)=>({id,name,placeholders:[{type:'title'},{type:'text'}]});
const deck={name:'Two  spaces',tone:'formal',slides:[{layout:'text-1x',title:'Keep title',text:'e\u0302',notes:'Keep\r\nnotes'}],catalogs:{layouts:{source:'https://example.invalid/catalog.json',records:[record('text-1x','Local override'),record('local')]}},'x-data':{layout:'text-1x'}};
const original=JSON.stringify(deck,null,2).replace('"name":','"name"  :').replaceAll('\n','\r\n');
const loaded={layouts:[record('text-1x','Loaded override'),record('loaded')]},snapshot=structuredClone(loaded);
const at=(source,key,catalogs=loaded)=>getJsonFieldContext(source,source.indexOf(key)+1,catalogs);
const context=at(original,'"layout"');assert.equal(context.catalog,'layouts');assert.equal(context.unloadedSource,true);
assert.equal(context.options.find(option=>option.value==='text-1x').source,'Document catalog');
assert.equal(context.options.find(option=>option.value==='text-1x').label,'Local override');
assert.equal(context.options.find(option=>option.value==='loaded').source,'Loaded catalog');
assert.ok(context.options.some(option=>option.suggested));assert.deepEqual(loaded,snapshot);
assert.equal(replaceFieldOption(context,'loaded'),original.replace('"layout": "text-1x"','"layout": "loaded"'));
assert.throws(()=>replaceFieldOption(context,'absent'),/no longer available/);
assert.equal(at(original,'"title"'),null);assert.equal(at('{"slides":[{"layout":"','"layout"'),null);
assert.equal(getJsonFieldContext(original,original.lastIndexOf('"layout"')+1),null,'Extension keys must not gain schema behavior by name');
assert.ok(at(original,'"tone"').options.some(option=>option.value==='casual'));
const unknown='{"slides":[{"layout":"custom-current","title":"Keep"}]}';assert.equal(at(unknown,'"layout"').options[0].source,'Current value');
const malformed='{"slides":[{"layout":"text-1x"}],"catalogs":{"layouts":{"records":true}}}';assert.ok(at(malformed,'"layout"',{layouts:true}));
const duplicate='{"slides":[{"layout":"text-1x","layout":"title-subtitle"}]}';assert.throws(()=>replaceFieldOption(at(duplicate,'"layout"'),'loaded'),/duplicate key/);
console.log('JSON options: schema paths, catalog precedence, exact token edits, custom values, invalid drafts, malformed catalog arrays and duplicate-key rejection pass.');

// Placeholder similarity outranks provenance, counts remain significant, and
// only the current token changes when moving between related layouts.
const layouts=[
  {id:'same-z',name:'Zulu exact',placeholders:[{type:'subtitle'},{type:'title'}]},
  {id:'same-a',name:'Alpha exact',placeholders:[{type:'title'},{type:'subtitle'}]},
  {id:'three',name:'AAA three texts',placeholders:[{type:'title'},{type:'text'},{type:'text'},{type:'text'}]},
  {id:'unknown-slots',name:'No declared slots'},
  {id:'wrong',name:'AAA chart',placeholders:[{type:'title'},{type:'chart'}]},
];
const rankedSource=JSON.stringify({slides:[{layout:'title-subtitle',title:'Keep',text:'Keep text'}],catalogs:{layouts:{records:layouts}}});
const ranked=getJsonFieldContext(rankedSource,rankedSource.indexOf('title-subtitle')+1,{layouts:[{id:'app-list',name:'AAA app list',placeholders:[{type:'list'}]}]});
assert.deepEqual(ranked.options.slice(0,5).map(option=>option.value),['title-subtitle','same-a','same-z','number-1x','text-1x']);
assert.equal(ranked.options[1].layoutGroup,'Same placeholders');
assert.equal(ranked.options[3].layoutGroup,'Compatible placeholders');
assert.equal(ranked.options[3].placeholders,'Title + Text');
assert.equal(ranked.options.find(option=>option.value==='three').layoutGroup,'Different counts');
assert.equal(ranked.options.find(option=>option.value==='three').placeholders,'Title + Text × 3');
assert.equal(ranked.options.find(option=>option.value==='wrong').layoutGroup,'Other layouts');
assert.equal(ranked.options.find(option=>option.value==='unknown-slots').layoutGroup,'Unspecified placeholders');
assert.equal(ranked.options.find(option=>option.value==='app-list').sourceLabel,'Provided by app');
assert.deepEqual(ranked.options.filter(option=>option.related).map(option=>option.value),['title-subtitle','same-a','same-z','number-1x','text-1x']);
assert.ok(!ranked.options.find(option=>option.value==='text-3x').suggested);
const inline=JSON.stringify({slides:[{layout:'text-1x'}],catalogs:{layouts:{records:[{id:'text-1x',name:'Override',placeholders:[{type:'title'},{type:'chart'},{type:'text'}]}]}}});
const inlineOptions=getJsonFieldContext(inline,inline.indexOf('text-1x')+1).options;
assert.equal(inlineOptions.find(option=>option.value==='chart-1x').layoutGroup,'Same placeholders','Document catalog overrides determine similarity');
const noSlots='{"slides":[{"layout":"unknown-layout"}]}';
const noSlotsOptions=getJsonFieldContext(noSlots,noSlots.indexOf('unknown-layout')+1).options;
assert.equal(noSlotsOptions[0].value,'unknown-layout');
assert.equal(noSlotsOptions.filter(option=>option.related).length,1,'Unknown placeholders do not imply a match');
const blank='{"slides":[{"layout":"blank"}],"catalogs":{"layouts":{"records":[{"id":"also-blank","name":"Also blank","placeholders":[]}]}}}';
assert.equal(getJsonFieldContext(blank,blank.indexOf('blank')+1).options.find(option=>option.value==='also-blank').layoutGroup,'Same placeholders','Explicitly empty placeholders are known');
console.log('Layout ranking: current first, exact/compatible groups, counted placeholders, document overrides, provenance and unknown layouts pass.');
