import assert from 'node:assert/strict';
import {getJsonFieldContext,replaceFieldOption,fieldOptionEdit} from '../dist/json-options.js';
import {validatePresentation,schemas} from '@openpresentation/opf';
const metricSlots=schemas.layout.$defs.Placeholder.properties.type.enum.includes('metric');
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
// layout metadata reflects the actual content kinds.
const layouts=[
  {id:'same-z',name:'Zulu exact',placeholders:[{type:'subtitle'},{type:'title'}]},
  {id:'same-a',name:'Alpha exact',placeholders:[{type:'title'},{type:'subtitle'}]},
  {id:'three',name:'AAA three texts',placeholders:[{type:'title'},{type:'text'},{type:'text'},{type:'text'}]},
  {id:'unknown-slots',name:'No declared slots'},
  {id:'wrong',name:'AAA chart',placeholders:[{type:'title'},{type:'chart'}]},
];
const rankedSource=JSON.stringify({slides:[{layout:'title-subtitle',title:'Keep',text:'Keep text'}],catalogs:{layouts:{records:layouts}}});
const ranked=getJsonFieldContext(rankedSource,rankedSource.indexOf('title-subtitle')+1,{layouts:[{id:'app-list',name:'AAA app list',placeholders:[{type:'list'}]}]});
assert.deepEqual(ranked.options.slice(0,metricSlots?4:5).map(option=>option.value),metricSlots?['title-subtitle','same-a','same-z','text-1x']:['title-subtitle','same-a','same-z','number-1x','text-1x']);
assert.equal(ranked.options[1].layoutGroup,'Same placeholders');
assert.equal(ranked.options[3].layoutGroup,'Compatible placeholders');
assert.equal(ranked.options[3].placeholders,'Title + Text');
assert.equal(ranked.options.find(option=>option.value==='three').layoutGroup,'Different counts');
assert.equal(ranked.options.find(option=>option.value==='three').placeholders,'Title + Text × 3');
assert.equal(ranked.options.find(option=>option.value==='wrong').layoutGroup,'Other layouts');
assert.equal(ranked.options.find(option=>option.value==='unknown-slots').layoutGroup,'Unspecified placeholders');
assert.equal(ranked.options.find(option=>option.value==='app-list').sourceLabel,'Provided by app');
assert.deepEqual(ranked.options.filter(option=>option.related).map(option=>option.value),metricSlots?['title-subtitle','same-a','same-z','text-1x']:['title-subtitle','same-a','same-z','number-1x','text-1x']);
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

const choose=(deck,value,catalogs={})=>{
  const source=JSON.stringify(deck,null,2);
  const context=at(source,'"layout"',catalogs);
  const changed=replaceFieldOption(context,value);
  const edit=fieldOptionEdit(context,value);
  assert.equal(source.slice(0,edit.from)+edit.insert+source.slice(edit.to),changed);
  const result=JSON.parse(changed),validation=validatePresentation(result);
  assert.equal(validation.valid,true,JSON.stringify(validation.errors));
  return result;
};
assert.deepEqual(choose({slides:[{layout:'text-1x',text:'Keep'}]},'text-3x').slides[0].blocks,[{text:'Keep'},{text:''},{text:''}]);
assert.equal(choose({slides:[{layout:'text-1x',text:'Keep'}]},'title-subtitle').slides[0].subtitle,'');
if(metricSlots){
const cover={slides:[{layout:'title-subtitle',title:'Keep',subtitle:'Keep support',notes:'Keep notes',metric:0}]};
const metricContext=at(JSON.stringify(cover),'"layout"',{});
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
const custom={id:'custom-metric',name:'Custom metric',placeholders:[{type:'title'},{type:'metric'},{type:'metric'}]};
assert.equal(choose({slides:[{layout:'text-1x'}],catalogs:{layouts:{records:[custom]}}},custom.id).slides[0].blocks.length,2);
assert.equal(choose({slides:[{layout:'text-1x'}]},custom.id,{layouts:[custom]}).slides[0].blocks.length,2);
for(const layout of ['chart-1x','table-1x','image-1x','list-1x','quote-1x','timeline-1x']){
  choose({slides:[{layout:'title',title:'Keep'}]},layout);
}
assert.equal(replaceFieldOption(metricContext,'title-subtitle'),metricContext.source,'Current choice is a no-op');
console.log('Layout edits: blank metrics, repeated slots, rich text, zero values, nested blocks, regions, explicit types, local/app catalogs and atomic source edits pass.');

} else console.log('Metric-specific layout regressions require the core metric-placeholder schema; text scaffolding passes with the published core.');
