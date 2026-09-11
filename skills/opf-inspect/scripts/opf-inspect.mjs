#!/usr/bin/env node
import { createRequire } from 'node:module';
import { readFile, stat } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const usage = `OPF local inspection (Node 24)
  version
  schema [schemaName=presentation] [schemaJsonPointer]
  find-schema <query>
  catalog <kind> [query]
  record <kind> <id>
  validate <file.opf.json> [catalogKind]
Resolve @openpresentation/opf from the current project or OPF_ROOT checkout.
Exit codes: 0 success (warnings may exist), 1 invalid data, 2 usage/runtime error.`;
const print = value => process.stdout.write(JSON.stringify(value, null, 2) + '\n');
async function loadPackage() {
  const explicit = process.env.OPF_ROOT;
  const roots = explicit ? [path.resolve(explicit), path.resolve(explicit, 'packages/javascript')] : [process.cwd(), path.resolve(process.cwd(), 'packages/javascript'), fileURLToPath(new URL('../../../', import.meta.url)), fileURLToPath(new URL('../../../packages/javascript/', import.meta.url))];
  const attempts = [];
  for (const root of roots) {
    const require = createRequire(path.join(root, 'package.json'));
    let manifestPath;
    try { manifestPath = require.resolve('@openpresentation/opf/package.json'); } catch { attempts.push(root); continue; }
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const exported = manifest.exports?.['.'];
    const target = typeof exported === 'string' ? exported : exported?.import ?? exported?.default ?? manifest.main;
    if (typeof target !== 'string') throw new Error(`Cannot identify the ESM entrypoint in ${manifestPath}.`);
    const entry = path.resolve(path.dirname(manifestPath), target);
    // Once a package resolves, surface a broken installation instead of silently switching versions.
    const api = await import(pathToFileURL(entry));
    return { api, version: manifest.version, entry };
  }
  throw new Error(`Cannot resolve @openpresentation/opf. Install it in your project, or build the OPF checkout and set OPF_ROOT. Searched: ${attempts.join(', ')}`);
}
function pointer(value, source) {
  if (!source) return value;
  if (!source.startsWith('/') || /~(?![01])/u.test(source)) throw new Error('Use a JSON Pointer such as /$defs/Slide.');
  for (const part of source.slice(1).split('/').map(part=>part.replace(/~1/g,'/').replace(/~0/g,'~'))) {
    if (!value || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value,part)) throw new Error(`Schema pointer not found: ${source}`);
    value=value[part];
  }
  return value;
}
function searchSchemas(schemas, query) {
  const matches=[];const escape=key=>key.replace(/~/g,'~0').replace(/\//g,'~1');
  for (const [name,root] of Object.entries(schemas)) {
    const walk=(node,location,key='')=>{
      if (!node || typeof node!=='object' || Array.isArray(node)) return;
      if (`${key} ${location} ${node.title??''} ${node.description??''}`.toLowerCase().includes(query))matches.push({schema:name,path:location,title:node.title??key,description:node.description??'',type:node.type??null,reference:node.$ref??null,values:node.enum??null});
      for(const field of ['$defs','properties','patternProperties'])for(const [key,value]of Object.entries(node[field]??{}))walk(value,`${location}/${field}/${escape(key)}`,key);
      for(const field of ['oneOf','anyOf','allOf'])for(const [index,value]of (node[field]??[]).entries())walk(value,`${location}/${field}/${index}`);
      for(const field of ['items','additionalProperties','if','then','else','not'])if(typeof node[field]==='object')walk(node[field],`${location}/${field}`);
    };walk(root,'');
  }
  return {total:matches.length,matches:matches.slice(0,50),truncated:matches.length>50};
}
async function main(args) {
  const [command,...rest]=args;
  if(!command || ['help','--help','-h'].includes(command)){console.log(usage);return;}
  const arities={version:[0,0],schema:[0,2],'find-schema':[1,1],catalog:[1,2],record:[2,2],validate:[1,2]};
  if(!arities[command] || rest.length<arities[command][0] || rest.length>arities[command][1])throw new Error(usage);
  const {api,version,entry}=await loadPackage();
  if(command==='version'){print({package:'@openpresentation/opf',version,entry,schemas:Object.keys(api.schemas),catalogKinds:Object.keys(api.catalogs)});return;}
  if(command==='schema'){
    const name=rest[0]??'presentation';
    if(!Object.prototype.hasOwnProperty.call(api.schemas,name))throw new Error(`Unknown schema: ${name}. Choose ${Object.keys(api.schemas).join(', ')}.`);
    print({version,schema:name,path:rest[1]??'',value:pointer(api.schemas[name],rest[1])});return;
  }
  if(command==='find-schema'){if(!rest[0].trim())throw new Error('Enter a nonempty schema search.');print({version,...searchSchemas(api.schemas,rest[0].toLowerCase())});return;}
  if(command==='catalog'||command==='record'){
    const kind=rest[0];if(!Object.prototype.hasOwnProperty.call(api.catalogs,kind))throw new Error(`Unknown catalog kind: ${kind}. Choose ${Object.keys(api.catalogs).join(', ')}.`);
    const records=api.catalogs[kind];
    if(command==='record'){const record=records.find(record=>record.id===rest[1]);if(!record)throw new Error(`No ${kind} record with id ${rest[1]}.`);print({version,kind,record});return;}
    const query=(rest[1]??'').toLowerCase(),matches=records.filter(record=>JSON.stringify(record).toLowerCase().includes(query));
    print({version,kind,total:matches.length,truncated:matches.length>50,records:matches.slice(0,50).map(({id,name,summary,description})=>({id,name,summary:summary??description??''}))});return;
  }
  const file=path.resolve(rest[0]);if((await stat(file)).size>20*1024*1024)throw new Error('Input exceeds the 20 MB inspection limit.');
  const value=JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
  const kind=rest[1];
  if(kind && !Object.prototype.hasOwnProperty.call(api.catalogs,kind))throw new Error(`Unknown catalog kind: ${kind}.`);
  const result=kind?api.validateCatalogRecord(kind,value):api.validatePresentation(value);
  print({version,file,...result});if(!result.valid)process.exitCode=1;
}
main(process.argv.slice(2)).catch(error=>{process.stderr.write(`OPF inspection failed: ${error.message}\n`);process.exitCode=2;});
