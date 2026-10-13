import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync,existsSync,mkdirSync,symlinkSync,realpathSync,copyFileSync,cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {bootstrapPnpmEnvironment} from '../scripts/bootstrap-pnpm.mjs';
import {bootstrapInvocation} from '../scripts/bootstrap-command.mjs';

test('temporary Corepack shim enables nested pnpm without an ambient pnpm and cleans up',()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'gallery-pnpm-'));
 try{
 const isolated=path.join(directory,'entrypoints');mkdirSync(isolated);
 if(process.platform==='win32') {
  // Copy the executable and Corepack package: file symlinks require privileges
  // on ordinary Windows accounts, and copying only a .cmd breaks relative paths.
  copyFileSync(process.execPath,path.join(isolated,'node.exe'));
  const entry=bootstrapInvocation('corepack',[]).args[0];
  cpSync(path.dirname(path.dirname(entry)),path.join(isolated,'node_modules/corepack'),{recursive:true});
 } else {
  const lookup=spawnSync('which',['corepack'],{encoding:'utf8'});assert.equal(lookup.status,0,lookup.stderr);
  const corepack=realpathSync(lookup.stdout.trim().split(/\r?\n/)[0]);
  symlinkSync(process.execPath,path.join(isolated,'node'));
  symlinkSync(corepack,path.join(isolated,'corepack'));
 }
 const key=Object.keys(process.env).find(key=>key.toLowerCase()==='path')??'PATH';
 const env={...process.env,[key]:[isolated,...(process.platform==='win32'?[process.env.SystemRoot+'/System32']:['/usr/bin','/bin'])].join(path.delimiter)};
 const run=(args,environment)=>spawnSync(process.execPath,args,{cwd:directory,env:environment,encoding:'utf8'});
  writeFileSync(path.join(directory,'package.json'),JSON.stringify({packageManager:'pnpm@10.33.2',scripts:{nested:'pnpm --version'}}));
  // This is the hosted failure: package-manager subprocess lookup has no pnpm.
  const absent=run(['-e',"const r=require('node:child_process').spawnSync('pnpm',['--version']);if(r.error?.code==='ENOENT')process.exit(42);process.exit(1)"] ,env);
  assert.equal(absent.status,42,absent.stderr);
  const staged=bootstrapPnpmEnvironment(directory,env);
  assert.equal(env[key].split(path.delimiter).includes(path.join(directory,'bin')),false);
  const invocation=bootstrapInvocation('corepack',['pnpm','run','nested'],{env:staged});
  const result=spawnSync(invocation.command,invocation.args,{cwd:directory,env:staged,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/10\.33\.2/);
 }finally{rmSync(directory,{recursive:true,force:true});}
 assert.equal(existsSync(directory),false);
});
