import assert from 'node:assert/strict';
import {registryToolchain} from './registry-toolchain.mjs';
const registry=await registryToolchain();
const {layouts}=await registry.import('@openpresentation/opf/catalogs');
const {validatePresentation}=await registry.import('@openpresentation/opf/validator');
const {getJsonFieldContext,replaceFieldOption,fieldOptionEdit}=await registry.import('@openpresentation/opf-editor/json-options');
const original=JSON.stringify({slides:[{layout:'title-subtitle',title:'Keep title',subtitle:'Keep subtitle',notes:'Keep notes'}]},null,2);
const context=getJsonFieldContext(original,original.indexOf('"layout"')+1);
for(const layout of layouts){
 const result=replaceFieldOption(context,layout.id),edit=fieldOptionEdit(context,layout.id);
 assert.equal(original.slice(0,edit.from)+edit.insert+original.slice(edit.to),result);
 const document=JSON.parse(result),slide=document.slides[0];
 assert.equal(validatePresentation(document).valid,true,layout.id);
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
