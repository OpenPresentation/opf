import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import {registryBindings} from './registry-toolchain.mjs';
import {packageManagerInvocation} from './package-manager.mjs';

test('real installed imports and browser entries stay inside consumer; ancestor and symlink escapes refuse',async()=>{
 const root=realpathSync(mkdtempSync(path.join(tmpdir(),'registry-boundary-')));
 try{
  const source=path.join(root,'source'),consumer=path.join(root,'consumer');mkdirSync(source);mkdirSync(consumer);
  const manifest={name:'@openpresentation/probe',version:'1.0.0',type:'module',exports:{'.':{browser:'./browser.js',default:'./index.js'},'./package.json':'./package.json'}};
  writeFileSync(path.join(source,'package.json'),JSON.stringify(manifest));writeFileSync(path.join(source,'index.js'),'export const actual=42;');writeFileSync(path.join(source,'browser.js'),'export const browser=true;');
  writeFileSync(path.join(consumer,'package.json'),'{"private":true,"type":"module"}');
  const env={...process.env,npm_config_cache:path.join(root,'cache')};
  const npmRun=(args,cwd)=>{const invocation=packageManagerInvocation('npm',args,{env});return execFileSync(invocation.command,invocation.args,{cwd,env,encoding:'utf8',stdio:['ignore','pipe','pipe']});};
  const packed=JSON.parse(npmRun(['pack','--ignore-scripts','--json','--pack-destination',root],source))[0];
  npmRun(['install','--ignore-scripts','--no-audit','--no-fund',path.join(root,packed.filename)],consumer);
  const modules=realpathSync(path.join(consumer,'node_modules')),installed=path.join(modules,'@openpresentation/probe');
  const resolver=path.join(consumer,'resolve.mjs');writeFileSync(resolver,'export const resolve=s=>import.meta.resolve(s);');const {resolve}=await import(pathToFileURL(resolver));const tools=registryBindings(modules,resolve);
  assert.equal((await tools.import('@openpresentation/probe')).actual,42);
  let onResolve;tools.plugin(true).setup({onResolve(_filter,fn){onResolve=fn;}});assert.equal(onResolve({path:'@openpresentation/probe'}).path,path.join(installed,'browser.js'));
  let fallback;registryBindings(modules,s=>s==='@openpresentation/opf-editor'?pathToFileURL(path.join(installed,'index.js')).href:resolve(s)).plugin().setup({onResolve(_filter,fn){fallback=fn;}});
  writeFileSync(path.join(installed,'exact-source.js'),'export const preserved=true;');
  assert.equal(fallback({path:'@openpresentation/opf-editor/exact-source'}).path,path.join(installed,'exact-source.js'));
  const ancestor=path.join(root,'node_modules/@openpresentation/ancestor');mkdirSync(ancestor,{recursive:true});writeFileSync(path.join(ancestor,'package.json'),JSON.stringify({...manifest,name:'@openpresentation/ancestor'}));writeFileSync(path.join(ancestor,'index.js'),'export const leaked=true;');writeFileSync(path.join(ancestor,'browser.js'),'export const leaked=true;');
  await assert.rejects(tools.import('@openpresentation/ancestor'),/outside the installed consumer/);
  assert.throws(()=>onResolve({path:'@openpresentation/ancestor'}),/outside the installed consumer/);
  rmSync(path.join(installed,'exact-source.js'));symlinkSync(path.join(ancestor,'index.js'),path.join(installed,'exact-source.js'));
  assert.throws(()=>fallback({path:'@openpresentation/opf-editor/exact-source'}),/outside the installed consumer/);
  rmSync(path.join(installed,'browser.js'));symlinkSync(path.join(ancestor,'browser.js'),path.join(installed,'browser.js'));
  assert.throws(()=>onResolve({path:'@openpresentation/probe'}),/outside the installed consumer/);
  rmSync(path.join(installed,'index.js'));symlinkSync(path.join(ancestor,'index.js'),path.join(installed,'index.js'));
  await assert.rejects(tools.import('@openpresentation/probe'),/outside the installed consumer/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
