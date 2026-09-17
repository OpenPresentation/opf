import { schemas, catalogSchemaNames } from '@openpresentation/opf';
import { getValueAtPath, splitOpfPath, opfPathToJsonPointer } from './index.js';
export const opfSchemas = schemas;
const documents = new Map(Object.values(schemas).map(schema => [schema.$id, schema]));
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
export function resolveSchema(schema, root = schemas.presentation, seen = new Set()) {
  if (!schema || typeof schema !== 'object') return {};
  if (!schema.$ref) return schema;
  const ref = schema.$ref;
  if (seen.has(ref)) return {};
  seen.add(ref);
  const [id, fragment = ''] = ref.split('#');
  const target = id ? documents.get(id) : root;
  if (!target) throw new Error(`Unresolved OPF schema: ${ref}`);
  const resolved = fragment ? getValueAtPath(target, fragment) : target;
  if (!resolved) throw new Error(`Unresolved OPF schema: ${ref}`);
  const { $ref, ...rest } = schema;
  return {...resolveSchema(resolved, target, seen), ...rest};
}
export function schemaVariants(schema, root = schemas.presentation) {
  const resolved = resolveSchema(schema, root);
  if (Array.isArray(resolved.type)) return resolved.type.flatMap(type=>schemaVariants({...resolved,type},root));
  const variants = resolved.oneOf ?? resolved.anyOf;
  if (!variants) return [resolved];
  const {$ref, oneOf, anyOf, ...base} = resolved;
  return variants.flatMap(child => schemaVariants(child, root).map(variant => ({...base, ...variant, properties: base.properties || variant.properties ? {...base.properties,...variant.properties} : undefined})));
}
export function schemaType(schema, value) {
  return schema.type ?? (schema.properties || schema.additionalProperties ? 'object' : schema.items ? 'array' : schema.const !== undefined ? typeof schema.const : value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value === 'undefined' ? 'string' : typeof value);
}
function score(schema, value) {
  const type=schemaType(schema,value);
  if (type === 'integer' ? !Number.isInteger(value) : type === 'array' ? !Array.isArray(value) : type === 'null' ? value !== null : typeof value !== type || (type === 'object' && (value === null || Array.isArray(value)))) return -100;
  if (own(schema,'const')) return JSON.stringify(schema.const)===JSON.stringify(value)?100:-100;
  if(schema.enum && !schema.enum.includes(value))return -100;
  let result=1;
  for(const [key,child] of Object.entries(schema.properties??{})) {
    if(!value || !own(value,key))continue;
    if(own(child,'const'))result+=value[key]===child.const?100:-1000;
    else result+=1;
  }
  for(const key of schema.required??[])if(!value || !own(value,key))result-=2;
  return result;
}
export function activeSchema(schema, value, root=schemas.presentation) {
  return schemaVariants(schema,root).sort((a,b)=>score(b,value)-score(a,value))[0] ?? {};
}
export function schemaAtPath(document, path, root = schemas.presentation) {
  const parts=splitOpfPath(path);let current=root,value=document;
  for(let index=0; index<parts.length;index++) {
    const key=parts[index], resolved=activeSchema(current,value,root);
    if(parts[0]==='catalogs' && parts[2]==='records' && index===3) current=schemas[catalogSchemaNames[parts[1]]]??{};
    else current=Array.isArray(value)||resolved.type==='array' ? resolved.items??{} : resolved.properties?.[key] ?? Object.entries(resolved.patternProperties??{}).find(([pattern])=>new RegExp(pattern).test(key))?.[1] ?? (typeof resolved.additionalProperties==='object'?resolved.additionalProperties:{});
    value=value?.[key];
  }
  return resolveSchema(current,root);
}
export function schemaLabel(schema, index=0) {
  const type=schemaType(schema);
  return schema.title ?? schema.properties?.type?.const ?? (schema.const!==undefined?String(schema.const):`${type}${schema.properties ? ` · ${Object.keys(schema.properties).slice(0,3).join(', ')}` : ''}`) ?? `Option ${index+1}`;
}
export function createSchemaValue(schema, root=schemas.presentation, depth=0) {
  if(depth>20)throw new Error('Choose a shallower initial value for this recursive structure.');
  const variants=schemaVariants(schema,root), s=variants[0]??{};
  if(own(s,'const'))return structuredClone(s.const);
  if(own(s,'default'))return structuredClone(s.default);
  if(s.enum?.length)return structuredClone(s.enum[0]);
  const type=schemaType(s);
  if(type==='object'){
    const value={};
    for(const key of new Set([...(s.required??[]),...Object.keys(s.properties??{}).filter(key=>own(s.properties[key],'const'))])) value[key]=createSchemaValue(s.properties?.[key]??{},root,depth+1);
    if(s.anyOf || s.oneOf){ /* Variants have already been expanded. */ }
    return value;
  }
  if(type==='array')return Array.from({length:Math.min(s.minItems??0,100)},()=>createSchemaValue(s.items??{},root,depth+1));
  if(type==='boolean')return false;
  if(type==='null')return null;
  if(type==='number'||type==='integer')return s.minimum??(s.exclusiveMinimum!==undefined?s.exclusiveMinimum+1:0);
  if(s.examples?.length && typeof s.examples[0]==='string' && !s.examples[0].includes('...'))return s.examples[0];
  if(s.format==='uri')return 'https://example.com';
  if(s.pattern?.includes('a-z'))return 'example';
  return s.minLength?'Text':'';
}
export function listSchemaFields() {
  const result=[];
  for(const [name,root] of Object.entries(schemas)) {
    const walk=(schema,path)=>{
      if(!schema || typeof schema!=='object')return;
      for(const [key,child]of Object.entries(schema.properties??{})){
        result.push({schema:name,path:opfPathToJsonPointer([...path,'properties',key]),name:key,description:child.description??'',reference:child.$ref??null,type:child.type??null,values:child.enum??(own(child,'const')?[child.const]:null)});
        walk(child,[...path,'properties',key]);
      }
      for(const [key,child]of Object.entries(schema.$defs??{}))walk(child,[...path,'$defs',key]);
      for(const keyword of ['oneOf','anyOf','allOf']) (schema[keyword]??[]).forEach((child,index)=>walk(child,[...path,keyword,String(index)]));
      if(schema.items)walk(schema.items,[...path,'items']);
      if(typeof schema.additionalProperties==='object')walk(schema.additionalProperties,[...path,'additionalProperties']);
      for(const [key,child]of Object.entries(schema.patternProperties??{}))walk(child,[...path,'patternProperties',key]);
    };
    walk(root,[]);
  }
  return result;
}
