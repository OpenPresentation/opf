import assert from 'node:assert/strict';
import {getJsonFieldContext,replaceFieldOption,fieldOptionEdit} from '../dist/json-options.js';
import {validate} from '@openpresentation/opf';
import {defaultCatalog} from '@openpresentation/opf/catalog';
// OPF 0.15: the document embeds records by group (`custom`, `default`, named groups); the host passes its catalogs (Catalog[]).
const record=(name)=>({name,placeholders:[{type:'title'},{type:'text'}]});
const deck={name:'Two  spaces',tone:'formal',slides:[{layout:'text-1x',title:'Keep title',text:'e\u0302',notes:'Keep\r\nnotes'}],catalogs:{gallery:{source:'https://example.invalid/catalog.json'},custom:{layouts:{'text-1x':record('Local override'),local:record('local')}}},'x-data':{layout:'text-1x'}};
const original=JSON.stringify(deck,null,2).replace('"name":','"name"  :').replaceAll('\n','\r\n');
const loaded=[{source:'pkg:app',layouts:{'text-1x':record('Loaded override'),loaded:record('loaded')},tones:defaultCatalog.tones}],snapshot=structuredClone(loaded);
// The host default catalog with extra records, for the ranking checks below.
const withLayouts=(extra)=>[{...defaultCatalog,layouts:{...defaultCatalog.layouts,...extra}}];
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
const malformed='{"slides":[{"layout":"text-1x"}],"catalogs":{"custom":{"layouts":true}}}';assert.ok(at(malformed,'"layout"'),'a malformed document catalog still offers the host records');
const duplicate='{"slides":[{"layout":"text-1x","layout":"title-subtitle"}]}';assert.throws(()=>replaceFieldOption(at(duplicate,'"layout"'),'loaded'),/duplicate key/);
console.log('JSON options: schema paths, catalog precedence, exact token edits, custom values, invalid drafts, malformed catalog arrays and duplicate-key rejection pass.');

// Placeholder similarity outranks provenance, counts remain significant, and
// layout metadata reflects the actual content kinds.
const layouts={
  'same-z':{name:'Zulu exact',placeholders:[{type:'subtitle'},{type:'title'}]},
  'same-a':{name:'Alpha exact',placeholders:[{type:'title'},{type:'subtitle'}]},
  three:{name:'AAA three texts',placeholders:[{type:'title'},{type:'text'},{type:'text'},{type:'text'}]},
  'unknown-slots':{name:'No declared slots'},
  wrong:{name:'AAA chart',placeholders:[{type:'title'},{type:'chart'}]},
};
const rankedSource=JSON.stringify({slides:[{layout:'title-subtitle',title:'Keep',text:'Keep text'}],catalogs:{custom:{layouts}}});
const ranked=getJsonFieldContext(rankedSource,rankedSource.indexOf('title-subtitle')+1,withLayouts({'app-list':{name:'AAA app list',placeholders:[{type:'list'}]}}));
// The registered default catalog is part of the option list, so expectations are rules over whatever it holds, never a
// literal list of ids: any registered layout with the current layout's placeholders (or a compatible set) joins the
// groups below and sorts among the test records by label.
const groupOrder=['Current layout','Same placeholders','Compatible placeholders','Different counts','Other layouts','Unspecified placeholders'];
const values=ranked.options.map(option=>option.value);
assert.equal(values[0],'title-subtitle');assert.equal(ranked.options[0].layoutGroup,'Current layout');
const ranks=ranked.options.map(option=>groupOrder.indexOf(option.layoutGroup));
assert.deepEqual(ranks,[...ranks].sort((a,b)=>a-b),'Groups appear in ranking order');
for(const group of groupOrder){
  const labels=ranked.options.filter(option=>option.layoutGroup===group).map(option=>option.label);
  assert.deepEqual(labels,[...labels].sort((a,b)=>a.localeCompare(b,'en',{numeric:true})),group+' is ordered by label within the group');
}
const option=id=>ranked.options.find(entry=>entry.value===id);
assert.equal(option('same-a').layoutGroup,'Same placeholders');assert.equal(option('same-z').layoutGroup,'Same placeholders');
assert.ok(values.indexOf('same-a')<values.indexOf('same-z'),'Equal similarity keeps label order');
assert.equal(option('text-1x').layoutGroup,'Compatible placeholders');assert.equal(option('text-1x').placeholders,'Title + Text');
assert.ok(values.indexOf('same-z')<values.indexOf('text-1x'),'Same placeholders outrank compatible ones');
const lastSuggested=Math.max(...ranked.options.filter(entry=>entry.related).map(entry=>values.indexOf(entry.value)));
assert.ok(values.indexOf('app-list')>lastSuggested,'Placeholder similarity outranks provenance and label order');
const suggested=['Current layout','Same placeholders','Compatible placeholders'];
assert.deepEqual(ranked.options.filter(entry=>entry.related).map(entry=>entry.value),ranked.options.filter(entry=>suggested.includes(entry.layoutGroup)).map(entry=>entry.value),'related covers exactly the current, same and compatible groups');
for(const id of ['same-a','same-z','text-1x'])assert.ok(option(id).related,id);
assert.equal(ranked.options.find(option=>option.value==='three').layoutGroup,'Different counts');
assert.equal(ranked.options.find(option=>option.value==='three').placeholders,'Title + Text × 3');
assert.equal(ranked.options.find(option=>option.value==='wrong').layoutGroup,'Other layouts');
assert.equal(ranked.options.find(option=>option.value==='unknown-slots').layoutGroup,'Unspecified placeholders');
assert.equal(ranked.options.find(option=>option.value==='app-list').sourceLabel,'Provided by app');
assert.ok(!ranked.options.find(option=>option.value==='text-3x').suggested);
const inline=JSON.stringify({slides:[{layout:'text-1x'}],catalogs:{custom:{layouts:{'text-1x':{name:'Override',placeholders:[{type:'title'},{type:'chart'},{type:'text'}]}}}}});
const inlineOptions=getJsonFieldContext(inline,inline.indexOf('text-1x')+1,[defaultCatalog]).options;
assert.equal(inlineOptions.find(option=>option.value==='chart-1x').layoutGroup,'Same placeholders','Document catalog overrides determine similarity');
const noSlots='{"slides":[{"layout":"unknown-layout"}]}';
const noSlotsOptions=getJsonFieldContext(noSlots,noSlots.indexOf('unknown-layout')+1,[defaultCatalog]).options;
assert.equal(noSlotsOptions[0].value,'unknown-layout');
assert.equal(noSlotsOptions.filter(option=>option.related).length,1,'Unknown placeholders do not imply a match');
const blank='{"slides":[{"layout":"blank"}],"catalogs":{"custom":{"layouts":{"also-blank":{"name":"Also blank","placeholders":[]}}}}}';
assert.equal(getJsonFieldContext(blank,blank.indexOf('blank')+1,[defaultCatalog]).options.find(option=>option.value==='also-blank').layoutGroup,'Same placeholders','Explicitly empty placeholders are known');
console.log('Layout ranking: current first, exact/compatible groups, counted placeholders, document overrides, provenance and unknown layouts pass.');

const choose=(deck,value,catalogs=[defaultCatalog])=>{
  const source=JSON.stringify(deck,null,2);
  const context=at(source,'"layout"',catalogs);
  const changed=replaceFieldOption(context,value);
  const edit=fieldOptionEdit(context,value);
  assert.equal(source.slice(0,edit.from)+edit.insert+source.slice(edit.to),changed);
  const result=JSON.parse(changed),validation=validate(result, { only: ["format"] });
  assert.equal(validation.valid,true,JSON.stringify(validation.findings));
  return result;
};
assert.deepEqual(choose({slides:[{layout:'text-1x',text:'Keep'}]},'text-3x').slides[0].blocks,[{text:'Keep'},{text:''},{text:''}]);
assert.equal(choose({slides:[{layout:'text-1x',text:'Keep'}]},'title-subtitle').slides[0].subtitle,'');
const cover={slides:[{layout:'title-subtitle',title:'Keep',subtitle:'Keep support',notes:'Keep notes',metric:0}]};
const metricContext=at(JSON.stringify(cover),'"layout"',[defaultCatalog]);
assert.equal(metricContext.options.find(option=>option.value==='number-1x').placeholders,'Title + Metric');
assert.equal(metricContext.options.find(option=>option.value==='number-1x').related,false);
const metricDeck=choose({...cover,slides:[{...cover.slides[0],metric:undefined}]},'number-1x');
assert.deepEqual(metricDeck.slides[0],{layout:'number-1x',title:'Keep',subtitle:'Keep support',notes:'Keep notes',metric:{value:'',label:''}});
assert.equal(choose(cover,'number-1x').slides[0].metric,0,'Existing zero is content');
const several=choose(cover,'number-3x');
assert.deepEqual(several.slides[0].blocks,[{metric:0},{metric:{value:'',label:''}},{metric:{value:'',label:''}}]);
assert.equal(several.slides[0].subtitle,'Keep support');
assert.equal(several.slides[0].notes,'Keep notes');
const rich=[{text:'Keep',bold:true}];
const texts=choose({slides:[{layout:'text-1x',title:'Keep',text:rich}]},'text-3x');
assert.deepEqual(texts.slides[0].blocks,[{text:rich},{text:''},{text:''}]);
const subtitle=choose({slides:[{layout:'text-1x',title:'Keep',text:'Do not discard'}]},'title-subtitle');
assert.equal(subtitle.slides[0].subtitle,'');assert.equal(subtitle.slides[0].text,'Do not discard');
const nested={slides:[{layout:'text-1x',blocks:[{composition:{mode:'row'},blocks:[{text:'Nested'}]}]}]};
const nestedResult=choose(nested,'text-3x');
assert.deepEqual(nestedResult.slides[0].blocks[0],nested.slides[0].blocks[0]);
assert.equal(nestedResult.slides[0].blocks.length,3);
const positioned=choose({slides:[{layout:'text-1x',left:{text:'Keep left'},right:{text:'Keep right'}}]},'number-1x');
assert.deepEqual(positioned.slides[0].left,{text:'Keep left'});
assert.deepEqual(positioned.slides[0].right.blocks,[{text:'Keep right'},{metric:{value:'',label:''}}]);
const explicit=choose({slides:[{layout:'text-1x',type:'text',text:'Typed content'}]},'number-1x');
assert.deepEqual(explicit.slides[0].blocks,[{type:'text',text:'Typed content'},{metric:{value:'',label:''}}]);
const custom={name:'Custom metric',placeholders:[{type:'title'},{type:'metric'},{type:'metric'}]};
assert.equal(choose({slides:[{layout:'text-1x'}],catalogs:{custom:{layouts:{'custom-metric':custom}}}},'custom-metric').slides[0].blocks.length,2);
assert.equal(choose({slides:[{layout:'text-1x'}]},'custom-metric',withLayouts({'custom-metric':custom})).slides[0].blocks.length,2);
for(const layout of ['chart-1x','table-1x','image-1x','list-1x','quote-1x','timeline-1x']){
  choose({slides:[{layout:'title',title:'Keep'}]},layout);
}
assert.equal(replaceFieldOption(metricContext,'title-subtitle'),metricContext.source,'Current choice is a no-op');
console.log('Layout edits: blank metrics, repeated slots, rich text, zero values, nested blocks, regions, explicit types, local/app catalogs and atomic source edits pass.');

