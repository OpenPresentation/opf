import assert from 'node:assert/strict';
import {verifyV2LayoutChoices} from './registry-layout-v2.mjs';
import {registryToolchain} from './registry-toolchain.mjs';
const registry=await registryToolchain();
// OPF 0.15: the host registers the published default catalog (here, the JSON options): the @openpresentation/gallery package from
// core 0.19 (RR-78, core's dependency), core's /catalog subpath before.
const loaded=await Promise.resolve().then(()=>registry.import('@openpresentation/gallery')).then(module=>({gallery:module.gallery,schema:module.CATALOG_SCHEMA}),()=>registry.import('@openpresentation/opf/catalog').then(module=>({gallery:module.defaultCatalog,schema:1})));
const {gallery,schema}=loaded;assert.ok(schema===1||schema===2,'known catalog schema');
const layouts=Object.entries(gallery.layouts).map(([id,record])=>({id,...record}));
const {validate}=await registry.import(schema===2?'@openpresentation/opf':'@openpresentation/opf/validator');
const {getJsonFieldContext,replaceFieldOption,fieldOptionEdit}=await registry.import('@openpresentation/opf-editor/json-options');
if(schema===2){
 const previews=await registry.import('@openpresentation/gallery/previews');
 console.log(verifyV2LayoutChoices({gallery,previews,validate,editor:{getJsonFieldContext,replaceFieldOption,fieldOptionEdit}}));
}else{
const original=JSON.stringify({slides:[{layout:'title-subtitle',title:'Keep title',subtitle:'Keep subtitle',notes:'Keep notes'}]},null,2);
const context=getJsonFieldContext(original,original.indexOf('"layout"')+1,[gallery]);
for(const layout of layouts){
 const result=replaceFieldOption(context,layout.id),edit=fieldOptionEdit(context,layout.id);
 assert.equal(original.slice(0,edit.from)+edit.insert+original.slice(edit.to),result);
 const document=JSON.parse(result),slide=document.slides[0];
 assert.equal(validate(document,{only:['format']}).valid,true,layout.id);
 assert.equal(slide.title,'Keep title');assert.equal(slide.subtitle,'Keep subtitle');assert.equal(slide.notes,'Keep notes');
 if(/^number-[1-6]x$/.test(layout.id)){
  const count=Number(layout.id.match(/\d/)[0]);
  assert.equal(context.options.find(option=>option.value===layout.id).related,false);
  assert.deepEqual((slide.blocks??[slide]).map(block=>block.metric),Array.from({length:count},()=>({value:'',label:''})));
 }
 if(layout.id==='quote-1x')assert.deepEqual(slide.quote,{text:'',attribution:''});
 if(layout.id==='timeline-1x')assert.deepEqual(slide.timeline,{events:[{when:'',what:''}]});
}
assert.ok(layouts.some(layout=>layout.id==='quote-1x'));
assert.ok(layouts.some(layout=>layout.id==='timeline-1x'));
console.log(`${layouts.length} published layout choices validate and preserve existing content; metric, quote and timeline fields scaffold correctly.`);

}
