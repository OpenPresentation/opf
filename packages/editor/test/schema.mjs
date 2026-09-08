import assert from 'node:assert/strict';
import {schemas,validatePresentation} from '@openpresentation/opf';
import {schemaAtPath,schemaVariants,activeSchema,createSchemaValue,listSchemaFields} from '../src/schema.js';
import {createEditorSession} from '../src/index.js';
const deck={slides:[{title:'Hello',text:[{text:'bold',bold:true}],blocks:[{composition:{mode:'row'},blocks:[{text:'Nested'}]}]}]};
assert.equal(schemaAtPath(deck,'/slides/0/text/0/bold').type,'boolean');
assert.equal(schemaAtPath(deck,'/slides/0/blocks/0/blocks/0/text').oneOf.length,2);
assert.equal(schemaAtPath(deck,'/slides/0/top:left').$ref,undefined);
assert.equal(schemaVariants(schemaAtPath(deck,'/slides/0/design/background')).length,7);
for(const type of ['theme','solid','gradient','image','pattern']){
 const schema=schemaVariants(schemaAtPath(deck,'/design/background')).find(s=>s.properties?.type?.const===type);
 const value=createSchemaValue(schema);
 assert.equal(value.type,type);
 assert.equal(activeSchema(schemaAtPath(deck,'/design/background'),value).properties.type.const,type);
 assert.equal(validatePresentation({slides:[{title:'Background'}],design:{background:value}}).valid,true,JSON.stringify(value));
}
assert.equal(schemaAtPath(deck,'/catalogs/layouts/records/0').properties.id.type,'string');
const fields=listSchemaFields();assert.ok(fields.length>600);
for(const [name,schema]of Object.entries(schemas))for(const key of Object.keys(schema.properties??{}))assert.ok(fields.some(f=>f.schema===name&&f.path===`/properties/${key.replace(/~/g,'~0').replace(/\//g,'~1')}`));
for(const [name,schema]of Object.entries(schemas.presentation.$defs))for(const key of Object.keys(schema.properties??{}))assert.ok(fields.some(f=>f.schema==='presentation'&&f.path===`/$defs/${name}/properties/${key}`));
assert.equal(new Set(fields.map(f=>`${f.schema}:${f.path}`)).size,fields.length);
console.log(`Schema controls: ${fields.length} documented fields, nested paths, catalog records, background forms, required defaults passed.`);

assert.deepEqual(schemaVariants({type:['string','number']}).map(s=>s.type),['string','number']);
