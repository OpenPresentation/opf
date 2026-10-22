import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp, mkdir, writeFile, readFile, cp, realpath, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {packageManagerInvocation} from '../../../scripts/package-manager.mjs';

async function temporary(run) {
  const directory=await mkdtemp(path.join(tmpdir(),'opf-windows-harness-'));
  try { await run(directory); }
  finally {
    const actual=await realpath(directory),parent=await realpath(tmpdir());
    assert.ok(actual.startsWith(parent+path.sep)&&path.basename(actual).startsWith('opf-windows-harness-'));
    await rm(actual,{recursive:true,force:true});
  }
}

test('Windows package invocation preserves literal arguments and ignores the other manager',async()=>temporary(async directory=>{
  const npm=path.join(directory,'space & literal','npm','bin','npm-cli.js');
  const pnpm=path.join(directory,'space & literal','pnpm','bin','pnpm.cjs');
  await mkdir(path.dirname(npm),{recursive:true});
  await mkdir(path.dirname(pnpm),{recursive:true});
  await writeFile(npm,'console.log(JSON.stringify(process.argv.slice(2)))');
  await writeFile(pnpm,'console.log(JSON.stringify(process.argv.slice(2)))');
  const args=['value with spaces','literal & echo nope','$(nope)','"quoted"','x^|y'];
  const invocation=packageManagerInvocation('npm',args,{platform:'win32',env:{npm_execpath:pnpm,PATH:`"${path.join(directory,'space & literal','.bin')}"`}});
  assert.equal(invocation.command,process.execPath);
  assert.equal(invocation.args[0],npm);
  const result=spawnSync(invocation.command,invocation.args,{encoding:'utf8'});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),args);
  assert.deepEqual(packageManagerInvocation('pnpm',args,{platform:'win32',env:{npm_execpath:pnpm}}).args,[pnpm,...args]);
  assert.deepEqual(packageManagerInvocation('npm',args,{platform:'linux'}),{command:'npm',args});
  assert.throws(()=>packageManagerInvocation('npm',[],{platform:'win32',env:{npm_execpath:pnpm}}),/Cannot locate npm/);
  assert.throws(()=>packageManagerInvocation('unexpected',[]),/Unsupported/);
}));

test('the site linker replaces an existing link or package and never follows a link into another checkout',async()=>temporary(async directory=>{
  const root=path.join(directory,'opf'),site=path.join(directory,'pptx-gallery');
  await mkdir(path.join(root,'scripts'),{recursive:true});
  await mkdir(path.join(root,'packages/javascript/dist'),{recursive:true});
  await writeFile(path.join(root,'packages/javascript/dist/composition.js'),'export {};');
  await writeFile(path.join(root,'packages/javascript/package.json'),JSON.stringify({name:'@openpresentation/opf',version:'0.0.0'}));
  await cp(new URL('../../../scripts/link-ecosystem.mjs',import.meta.url),path.join(root,'scripts/link-ecosystem.mjs'));
  const installed=path.join(site,'node_modules/@openpresentation/opf');
  await mkdir(installed,{recursive:true});
  await writeFile(path.join(installed,'package.json'),JSON.stringify({name:'@openpresentation/opf'}));
  await writeFile(path.join(site,'package.json'),JSON.stringify({name:'pptx-gallery',private:true}));
  // Twice: the second run replaces the link the first one made (a junction on Windows).
  for (let attempt=0;attempt<2;attempt++) {
    const result=spawnSync(process.execPath,[path.join(root,'scripts/link-ecosystem.mjs'),site],{encoding:'utf8',timeout:30000});
    assert.ifError(result.error);
    assert.equal(result.status,0,result.stderr||result.stdout);
    assert.equal(await realpath(installed),await realpath(path.join(root,'packages/javascript')));
  }
  // A package that is not the one being linked is never replaced.
  await rm(installed,{recursive:true,force:true});
  await mkdir(installed,{recursive:true});
  await writeFile(path.join(installed,'package.json'),JSON.stringify({name:'something-else'}));
  const refused=spawnSync(process.execPath,[path.join(root,'scripts/link-ecosystem.mjs'),site],{encoding:'utf8',timeout:30000});
  assert.notEqual(refused.status,0);
  assert.match(refused.stderr,/Refusing to replace unexpected package/);
}));

test('local linking refuses a node_modules parent that resolves outside its checkout',async()=>temporary(async directory=>{
  const root=path.join(directory,'opf'),repo=path.join(directory,'pptx-gallery'),outside=path.join(directory,'outside');
  await mkdir(path.join(root,'scripts'),{recursive:true});
  await mkdir(path.join(root,'packages/javascript/dist'),{recursive:true});
  await writeFile(path.join(root,'packages/javascript/dist/composition.js'),'export {};');
  await cp(new URL('../../../scripts/link-ecosystem.mjs',import.meta.url),path.join(root,'scripts/link-ecosystem.mjs'));
  await mkdir(repo,{recursive:true});
  await writeFile(path.join(repo,'package.json'),JSON.stringify({name:'pptx-gallery'}));
  const protectedFile=path.join(outside,'@openpresentation/opf/package.json');
  await mkdir(path.dirname(protectedFile),{recursive:true});
  const content=JSON.stringify({name:'@openpresentation/opf',keep:'preserved'});
  await writeFile(protectedFile,content);
  await symlink(outside,path.join(repo,'node_modules'),process.platform==='win32'?'junction':'dir');
  const result=spawnSync(process.execPath,[path.join(root,'scripts/link-ecosystem.mjs'),repo],{encoding:'utf8',timeout:10000});
  assert.ifError(result.error);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Refusing to replace a package outside/);
  assert.equal(await readFile(protectedFile,'utf8'),content);
}));
