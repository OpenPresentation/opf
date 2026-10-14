import assert from 'node:assert/strict';
import {verifyV2LayoutChoices} from './registry-layout-v2.mjs';
import {readFile,realpath} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {assertCatalogGeneration,assertConsumerLock,assertInstalledCatalog,consumerDependencies} from './published-matrix/consumer-dependencies.mjs';
import {registryFile,registryToolchain} from './registry-toolchain.mjs';
const registry=await registryToolchain();
// OPF 0.15: the host registers the published default catalog (here, the JSON options): the @openpresentation/gallery package from
// core 0.19 (RR-78, core's dependency), core's /catalog subpath before.
const loaded=await Promise.resolve().then(()=>registry.import('@openpresentation/gallery')).then(module=>({gallery:module.gallery,schema:module.CATALOG_SCHEMA}),()=>registry.import('@openpresentation/opf/catalog').then(module=>({gallery:module.defaultCatalog,schema:1})));
const {gallery,schema}=loaded;
const core=registry.packages.find(item=>item.name==='@openpresentation/opf')?.version;
assertCatalogGeneration(core,schema);
const modern=schema!==1;
if(modern){
 const plan=JSON.parse(await readFile(new URL('../release-plan.json',import.meta.url),'utf8'));
 const consumerPlan=consumerDependencies(Object.fromEntries(registry.packages.map(item=>[item.name,item.version])),plan.independentPackages);
 const modules=await realpath(path.join(registry.consumer,'node_modules'));
 const require=createRequire(path.join(registry.consumer,'package.json'));
 const manifestPath=registryFile(modules,pathToFileURL(require.resolve('@openpresentation/gallery/package.json')));
 const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
 const lock=JSON.parse(await readFile(path.join(registry.consumer,'package-lock.json'),'utf8'));
 assertConsumerLock(consumerPlan,lock);
 assertInstalledCatalog(core,manifest,schema,consumerPlan);
}
const layouts=Object.entries(gallery.layouts).map(([id,record])=>({id,...record}));
const {validate}=await registry.import(modern?'@openpresentation/opf':'@openpresentation/opf/validator');
const {getJsonFieldContext,replaceFieldOption,fieldOptionEdit}=await registry.import('@openpresentation/opf-editor/json-options');
if(modern){
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
