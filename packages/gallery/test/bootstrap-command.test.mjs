import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {bootstrapInvocation} from '../scripts/bootstrap-command.mjs';

test('Windows bootstrap invokes installed manager JavaScript with literal arguments',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'gallery managers & spaces-'));
 try {
  for(const relative of ['npm/bin/npm-cli.js','corepack/dist/corepack.js','corepack/dist/pnpm.js']){
   const entry=path.join(root,'node_modules',relative);mkdirSync(path.dirname(entry),{recursive:true});writeFileSync(entry,'');
  }
  const env=Object.freeze({Path:root});
  const args=['run','a & b','C:/path with spaces'];
  for(const [manager,relative] of [['npm','npm/bin/npm-cli.js'],['corepack','corepack/dist/corepack.js'],['pnpm','corepack/dist/pnpm.js']]){
   assert.deepEqual(bootstrapInvocation(manager,args,{platform:'win32',env}),{command:process.execPath,args:[path.join(root,'node_modules',relative),...args]});
  }
  assert.deepEqual(env,{Path:root});assert.deepEqual(args,['run','a & b','C:/path with spaces']);
  assert.throws(()=>bootstrapInvocation('npm',[],{platform:'win32',env:{Path:path.join(root,'missing')}}),/Cannot locate npm/);
  assert.deepEqual(bootstrapInvocation('git',args,{platform:'win32',env}),{command:'git',args});
  assert.deepEqual(bootstrapInvocation('npm',args,{platform:'linux',env}),{command:'npm',args});
 } finally {rmSync(root,{recursive:true,force:true});}
});
