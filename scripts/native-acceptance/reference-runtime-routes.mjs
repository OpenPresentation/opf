// Reference-only consumer route proof. Imports modules; never prepares fonts, converts, exports or starts Office.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {digest,fileIdentity,installedIdentity} from './identity.mjs';
const names={core:'@openpresentation/opf',render:'@openpresentation/opf-render',pptx:'@openpresentation/opf-pptx'};
export async function inspectReferenceRuntimeRoutes(consumer){
  const packages=installedIdentity(consumer),require=createRequire(path.join(packages.consumer,'package.json'));
  const entry=specifier=>fs.realpathSync(require.resolve(specifier));
  const files={core:entry(names.core),engine:entry(names.core+'/internal/engine'),render:entry(names.render),fonts:entry(names.render+'/fonts-node'),pptx:entry(names.pptx)};
  for(const[key,file]of Object.entries(files)){
    const name=key==='core'||key==='engine'?names.core:key==='pptx'?names.pptx:names.render;
    const root=packages.packages.find(p=>p.name===name).directory;
    assert(file.startsWith(root+path.sep),'Reference route escaped recorded package: '+key);
  }
  const [engine,render,fonts,pptx]=await Promise.all(['engine','render','fonts','pptx'].map(key=>import(pathToFileURL(files[key]).href)));
  assert.equal(typeof engine.loadRenderer,'function','Bound core must expose its actual renderer loader');
  assert.equal(typeof engine.loadPptx,'function','Bound core must expose its actual PPTX loader');
  assert.equal(typeof engine.locatePackage,'function','Bound core must expose its actual core→cwd resolver');
  const actual=await engine.loadRenderer(),native=await engine.loadPptx();
  assert.strictEqual(actual.render.module,render,'Core resolved a different renderer module');
  assert.strictEqual(actual.fonts,fonts,'Core resolved a different fonts-node module');
  assert.strictEqual(native.module,pptx,'Core resolved a different PPTX module');
  const manifests=[names.render,names.pptx].map(name=>{
    const selected=engine.locatePackage(name);assert(selected,'Core peer manifest missing: '+name);
    const file=fs.realpathSync(selected.manifest),record=packages.packages.find(p=>p.name===name);
    assert.equal(file,path.join(record.directory,'package.json'),'Core located a different peer manifest: '+name);
    return{name,file,...fileIdentity(file)};
  });
  assert.deepEqual(installedIdentity(consumer),packages,'Consumer changed during route inspection');
  return{schema:1,binding:{consumer:packages.consumer,packagesSha256:digest(JSON.stringify(packages)),entries:Object.entries(files).map(([role,file])=>({role,file,...fileIdentity(file)})),manifests},context:{cwd:fs.realpathSync(process.cwd()),node:{path:process.execPath,version:process.version,...fileIdentity(process.execPath)}},scope:'Actual built core loader/module identity only; no font preparation, conversion, rendering, export, Office or native acceptance.'};
}
export function assertReferenceRuntimeRoutes(consumer,expected){
  assert.equal(expected?.schema,1,'Missing explicit reference runtime-route receipt');
  const result=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--probe',fs.realpathSync(consumer)],{cwd:process.cwd(),encoding:'utf8',timeout:15000,maxBuffer:1024*1024,windowsHide:true});
  assert.equal(result.status,0,'Reference runtime routes refused: '+(result.stderr||result.error?.message||result.signal||'child failure'));
  const actual=JSON.parse(result.stdout);assert.deepEqual(actual.binding,expected.binding,'Reference runtime route binding changed');return actual;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  assert.equal(process.argv.length,4,'Explicit reference route probe only');assert.equal(process.argv[2],'--probe');
  console.log(JSON.stringify(await inspectReferenceRuntimeRoutes(process.argv[3])));
}
