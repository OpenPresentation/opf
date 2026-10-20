import assert from 'node:assert/strict';
import {getJsonFieldContext,getJsonCompletions,replaceFieldOption,fieldOptionEdit} from '../dist/json-options.js';
import {validate} from '@openpresentation/opf';
import {gallery as defaultCatalog} from '@openpresentation/gallery';
// OPF 0.15: the document embeds records by group (`custom`, `default`, named groups); the host passes its catalogs (Catalog[]).
const record=(name)=>({name,areas:[['title'], ['body']],regions:{body:{accepts:['text'],flow:'auto'}}});
const deck={name:'Two  spaces',tone:'formal',slides:[{layout:'text',title:'Keep title',text:'e\u0302',notes:'Keep\r\nnotes'}],catalogs:{gallery:{source:'https://example.invalid/catalog.json'},custom:{layouts:{'text':record('Local override'),local:record('local')}}},'x-data':{layout:'text'}};
const original=JSON.stringify(deck,null,2).replace('"name":','"name"  :').replaceAll('\n','\r\n');
const loaded=[{source:'pkg:app',layouts:{'text':record('Loaded override'),loaded:record('loaded')},tones:defaultCatalog.tones}],snapshot=structuredClone(loaded);
// The host default catalog with extra records, for the ranking checks below.
const withLayouts=(extra)=>[{...defaultCatalog,layouts:{...defaultCatalog.layouts,...extra}}];
const at=(source,key,catalogs=loaded)=>getJsonFieldContext(source,source.indexOf(key)+1,catalogs);
const context=at(original,'"layout"');assert.equal(context.catalog,'layouts');assert.equal(context.unloadedSource,true);
assert.equal(context.options.find(option=>option.value==='text').source,'Document catalog');
assert.equal(context.options.find(option=>option.value==='text').label,'Local override');
assert.equal(context.options.find(option=>option.value==='loaded').source,'Loaded catalog');
assert.deepEqual(loaded,snapshot);
assert.equal(replaceFieldOption(context,'loaded'),original.replace('"layout": "text"','"layout": "loaded"'));
assert.throws(()=>replaceFieldOption(context,'absent'),/no longer available/);
assert.equal(at(original,'"title"'),null);assert.equal(at('{"slides":[{"layout":"','"layout"'),null);
assert.equal(getJsonFieldContext(original,original.lastIndexOf('"layout"')+1),null,'Extension keys must not gain schema behavior by name');
assert.ok(at(original,'"tone"').options.some(option=>option.value==='casual'));
const unknown='{"slides":[{"layout":"custom-current","title":"Keep"}]}';assert.equal(at(unknown,'"layout"').options[0].source,'Current value');
const malformed='{"slides":[{"layout":"text"}],"catalogs":{"custom":{"layouts":true}}}';assert.ok(at(malformed,'"layout"'),'a malformed document catalog still offers the host records');
const duplicate='{"slides":[{"layout":"text","layout":"cover"}]}';assert.throws(()=>replaceFieldOption(at(duplicate,'"layout"'),'loaded'),/duplicate key/);
console.log('JSON options: schema paths, catalog precedence, exact token edits, custom values, invalid drafts, malformed catalog arrays and duplicate-key rejection pass.');

// V2 intent groups and region summaries describe the template without generating content.
const source = JSON.stringify({slides:[{layout:'cover',title:'Keep',text:[{text:'Rich',bold:true}],notes:'Keep notes'}]},null,2);
const context2 = getJsonFieldContext(source,source.indexOf('cover')+1,[defaultCatalog]);
assert.equal(context2.options[0].layoutGroup,'Current layout');
assert.equal(context2.options.find(option=>option.value==='text').layoutGroup,'Text');
assert.equal(context2.options.find(option=>option.value==='chart').layoutGroup,'Visuals');
assert.match(context2.options.find(option=>option.value==='chart').regions,/charts/);
assert.ok(context2.options.every(option=>!Object.hasOwn(option,'placeholderTypes')&&!Object.hasOwn(option,'placeholders')));
for(const value of ['pillars','metrics','chart','image']) {
 const changed=replaceFieldOption(context2,value),edit=fieldOptionEdit(context2,value);
 assert.equal(source.slice(0,edit.from)+edit.insert+source.slice(edit.to),changed);
 assert.deepEqual(JSON.parse(changed).slides[0],{...JSON.parse(source).slides[0],layout:value});
 assert.ok(validate(JSON.parse(changed),{only:['format']}).valid);
}
console.log('V2 layout options: intent groups, region descriptions, exact content-preserving reference edits and atomic source undo pass.');

const invalidTemplate=JSON.stringify({catalogs:{custom:{layouts:{broken:{name:'Broken',areas:[null],regions:{}}}}},slides:[{layout:'broken'}]});
assert.equal(getJsonFieldContext(invalidTemplate,invalidTemplate.indexOf('"layout"')+1,[defaultCatalog]).options.find(option=>option.value==='broken').regions,'Invalid region template','invalid JSON drafts remain editable without restoring retired placeholders');

// RR-98: live completions read the same data as the field menu, from drafts that do not parse yet.
const complete=(draft,{catalogs=[defaultCatalog],explicit=false}={})=>{const at=draft.indexOf('|');return getJsonCompletions(draft.replace('|',''),at,catalogs,{explicit});};
const labels=(result)=>result?.options.map(option=>option.label)??[];
// Keys: the property names of the schema at the cursor's object, minus the ones already present.
const keys=complete('{"slides":[{"title":"Keep","|"}]}');
assert.equal(keys.kind,'key');assert.equal(keys.quoted,true);assert.equal(keys.closed,true);
assert.ok(labels(keys).includes('layout')&&labels(keys).includes('notes'),'slide keys are offered');
assert.ok(!labels(keys).includes('title'),'a key the object already has is not offered again');
assert.ok(!labels(keys).includes('slides'),'slide keys are not the root keys');
assert.ok(labels(complete('{"|"}')).includes('slides'),'root keys at the top level');
assert.ok(labels(complete('{"slides":[{"design":{"|"}}]}')).includes('theme'),'nested object keys come from the nested schema');
assert.equal(complete('{"slides":[{"ti|').kind,'key','an unterminated key still completes');
assert.equal(complete('{"slides":[{"ti|').closed,false);
assert.ok(labels(complete('{"slides":[{"title":"x",|}]}',{explicit:true})).includes('layout'),'a bare position after a comma offers keys when asked');
assert.equal(complete('{"slides":[{"title":"x",|}]}'),null,'nothing is offered where nothing was typed and nothing was asked');
assert.ok(labels(complete('{ n|')).includes('name'),'a bare word offers keys');
assert.equal(complete('{"slides":[{"|"}]}').options.find(option=>option.label==='title').detail?.length>0,true,'a key option carries its type');
assert.ok(complete('{"slides":[{"|"}]}').options.find(option=>option.label==='title').info,'a key option carries the schema description');
// Values: enum and catalog values at the cursor's JSON path.
const layouts=complete('{"slides":[{"layout":"te|"}]}');
assert.equal(layouts.kind,'value');assert.equal(layouts.from,complete('{"slides":[{"layout":"|"}]}').from);
assert.ok(labels(layouts).includes('text')&&labels(layouts).includes('cover'),'layouts come from the catalog');
const fieldMenu=getJsonFieldContext('{"slides":[{"layout":"text"}]}','{"slides":[{"layout":"'.length,[defaultCatalog]);
for(const option of fieldMenu.options.filter(option=>option.source!=='Current value'))assert.ok(labels(layouts).includes(String(option.value)),`${option.value} is in the menu and in the completions`);
assert.deepEqual(labels(complete('{"tone":"|"}')),labels(complete('{"tone":|',{explicit:true})),'a value is offered inside quotes and bare');
assert.ok(labels(complete('{"tone":"|"}')).includes('casual'));
assert.equal(complete('{"tone":"|"}').options.find(option=>option.label==='casual').detail,'Casual','a catalog option names its record');
assert.deepEqual(complete('{"slides":[{"design":{"mirror":|}}]}',{explicit:true}).options.map(option=>option.value).sort(),[false,true],'a boolean field offers true and false');
assert.ok(labels(complete('{"slides":[{"design":{"theme":"|"}}]}')).length>0,'design references complete');
assert.equal(complete('{"name":"|"}'),null,'a free-text field offers nothing');
assert.equal(complete('{"extensions":{"layout":"|"}}'),null,'extension keys do not gain behavior by name');
assert.equal(complete('{"slides":[{"title":"abc"|}]}',{explicit:true}),null,'after a finished value nothing is offered');
// Catalogs the host did not register do not offer their records.
assert.ok(!labels(complete('{"slides":[{"layout":"|"}]}',{catalogs:[]})).includes('cover'));
// A draft's own catalog records are offered with their names.
assert.equal(complete('{"catalogs":{"custom":{"layouts":{"mine":'+JSON.stringify(record('Mine'))+'}}},"slides":[{"layout":"|"}]}').options.find(option=>option.value==='mine').detail,'Mine');
console.log('JSON completions: keys, values, booleans, catalogs, invalid drafts and the field menu data agree.');
