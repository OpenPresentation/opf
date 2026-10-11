import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkSchemaExamples} from './check-schema-examples.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const mutate=async(action)=>{const dir=await mkdtemp(path.join(tmpdir(),'opf-schema-examples-'));try{await cp(path.join(root,'spec/schemas'),dir,{recursive:true});const file=path.join(dir,'opf.schema.json');const schema=JSON.parse(await readFile(file,'utf8'));action(schema);await writeFile(file,JSON.stringify(schema));return await checkSchemaExamples({schemaRoot:dir});}finally{await rm(dir,{recursive:true,force:true});}};
test('all positive schema examples and actual gallery 2 SVG previews validate',async()=>{
 const result=await checkSchemaExamples({previewIndex:process.env.OPF_GALLERY_PREVIEW_INDEX??path.join(root,'packages/gallery/previews/layouts/index.json')});
 assert.equal(result.valid,true,JSON.stringify(result.failures));assert.ok(result.examples>900);assert.equal(result.embeddedRecords,4);
});
test('an obsolete layout record in a property-level catalog example is rejected by its companion schema',async()=>{
 const result=await mutate(schema=>{schema.$defs.Catalogs.properties.default.examples[0].layouts['two-column']={name:'Old layout',placeholders:[{type:'title'}]};});
 assert.equal(result.valid,false);assert.ok(result.failures.some(failure=>failure.includes('/properties/default/examples/0/layouts/two-column')&&failure.includes('areas')));
});
test('positive examples on arbitrary schema properties are checked at that exact schema node',async()=>{
 const result=await mutate(schema=>{schema.$defs.Slide.properties.title.examples.push(42);});
 assert.equal(result.valid,false);assert.ok(result.failures.some(failure=>failure.includes('/Slide/properties/title/examples/')));
});
test('an embedded record with identity metadata is rejected even when its companion type accepts it',async()=>{
 const result=await mutate(schema=>{schema.$defs.Catalogs.examples[0].custom.layouts['q4-special'].id='q4-special';});
 assert.equal(result.valid,false);assert.ok(result.failures.some(failure=>failure.includes('embedded identity/display metadata')));
});

const previewMutation=async(action)=>{const dir=await mkdtemp(path.join(tmpdir(),'opf-preview-index-'));try{
 const previews=path.join(dir,'previews/layouts');await mkdir(previews,{recursive:true});await mkdir(path.join(dir,'catalog/layouts'),{recursive:true});
 const content='<svg xmlns="http://www.w3.org/2000/svg"></svg>';const index={$schema:'https://openpresentation.org/schema/opf-layout-preview-index/v1',version:'2',description:'Test previews',records:[{id:'cover',file:'cover.svg',bytes:Buffer.byteLength(content)}]};action(index);
 await writeFile(path.join(previews,'cover.svg'),content);await writeFile(path.join(previews,'index.json'),JSON.stringify(index));await writeFile(path.join(dir,'catalog/layouts/index.json'),JSON.stringify({records:[{id:'cover',file:'cover.json'}]}));
 return await checkSchemaExamples({previewIndex:path.join(previews,'index.json')});
 }finally{await rm(dir,{recursive:true,force:true});}};
test('preview index rejects a valid SVG filename that belongs to a different template',async()=>{
 const result=await previewMutation(index=>{index.records[0].file='chart.svg';});assert.equal(result.valid,false);assert.ok(result.failures.some(failure=>failure.includes('matching SVG file')));
});
test('preview index rejects wrong byte counts and duplicate template IDs',async()=>{
 const result=await previewMutation(index=>{index.records[0].bytes++;index.records.push({...index.records[0]});});assert.equal(result.valid,false);assert.ok(result.failures.some(failure=>failure.includes('byte length differs')));assert.ok(result.failures.some(failure=>failure.includes('catalog order')));
});
test('gallery 2 preview contract rejects an older index version',async()=>{
 const result=await previewMutation(index=>{index.version='1';});assert.equal(result.valid,false);assert.ok(result.failures.some(failure=>failure.includes('equal to constant')));
});
