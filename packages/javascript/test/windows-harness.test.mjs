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

test('local package links build through real npm and can replace existing junctions',async()=>temporary(async directory=>{
  const root=path.join(directory,'opf');
  await mkdir(path.join(root,'scripts'),{recursive:true});
  await mkdir(path.join(root,'packages/javascript/dist'),{recursive:true});
  await writeFile(path.join(root,'packages/javascript/dist/composition.js'),'export {};');
  for (const file of ['link-ecosystem.mjs','package-manager.mjs']) {
    await cp(new URL(`../../../scripts/${file}`,import.meta.url),path.join(root,'scripts',file));
  }
  const names=['opf-render','opf-pptx','opf-editor'];
  for (const name of names) {
    const repo=path.join(directory,name);
    await mkdir(repo,{recursive:true});
    await writeFile(path.join(repo,'package.json'),JSON.stringify({name,private:true,scripts:{build:'node build.cjs'}}));
    await writeFile(path.join(repo,'build.cjs'),"require('node:fs').writeFileSync('built.json',JSON.stringify({node:process.version}))");
    for (const dep of name==='opf-render'?['opf']:['opf','opf-render']) {
      const installed=path.join(repo,'node_modules/@openpresentation',dep);
      await mkdir(installed,{recursive:true});
      await writeFile(path.join(installed,'package.json'),JSON.stringify({name:`@openpresentation/${dep}`}));
    }
  }
  for (let attempt=0;attempt<2;attempt++) {
    const result=spawnSync(process.execPath,[path.join(root,'scripts/link-ecosystem.mjs'),'--packages-only'],{encoding:'utf8',timeout:30000});
    assert.ifError(result.error);
    assert.equal(result.status,0,result.stderr||result.stdout);
    for (const name of names) {
      const repo=path.join(directory,name);
      assert.equal(await realpath(path.join(repo,'node_modules/@openpresentation/opf')),await realpath(path.join(root,'packages/javascript')));
      assert.equal(JSON.parse(await readFile(path.join(repo,'built.json'),'utf8')).node,process.version);
      if (name!=='opf-render') assert.equal(await realpath(path.join(repo,'node_modules/@openpresentation/opf-render')),await realpath(path.join(directory,'opf-render')));
    }
  }
}));

test('local linking refuses a node_modules parent that resolves outside its checkout',async()=>temporary(async directory=>{
  const root=path.join(directory,'opf'),repo=path.join(directory,'opf-render'),outside=path.join(directory,'outside');
  await mkdir(path.join(root,'scripts'),{recursive:true});
  await mkdir(path.join(root,'packages/javascript/dist'),{recursive:true});
  await writeFile(path.join(root,'packages/javascript/dist/composition.js'),'export {};');
  for (const file of ['link-ecosystem.mjs','package-manager.mjs']) {
    await cp(new URL(`../../../scripts/${file}`,import.meta.url),path.join(root,'scripts',file));
  }
  await mkdir(repo,{recursive:true});
  await writeFile(path.join(repo,'package.json'),JSON.stringify({name:'opf-render'}));
  const protectedFile=path.join(outside,'@openpresentation/opf/package.json');
  await mkdir(path.dirname(protectedFile),{recursive:true});
  const content=JSON.stringify({name:'@openpresentation/opf',keep:'preserved'});
  await writeFile(protectedFile,content);
  await symlink(outside,path.join(repo,'node_modules'),process.platform==='win32'?'junction':'dir');
  const result=spawnSync(process.execPath,[path.join(root,'scripts/link-ecosystem.mjs'),'--packages-only'],{encoding:'utf8',timeout:10000});
  assert.ifError(result.error);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Refusing to replace a package outside/);
  assert.equal(await readFile(protectedFile,'utf8'),content);
}));
