import assert from 'node:assert/strict';
import {getJsonFieldContext,replaceFieldOption,fieldOptionEdit} from '../dist/json-options.js';
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
