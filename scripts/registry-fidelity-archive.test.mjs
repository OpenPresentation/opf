import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {archiveRegistryFidelity} from './registry-fidelity-archive.mjs';

test('pinned renderer tests retain static script imports while executing installed runtime bytes', () => {
 const root=mkdtempSync(path.join(tmpdir(),'registry-fidelity-closure-'));
 try {
  const checkout=path.join(root,'source'), output=path.join(root,'verification'), installed=path.join(root,'installed');
  for(const folder of [checkout,output,installed])mkdirSync(folder,{recursive:true});
  for(const folder of ['test','scripts','dist'])mkdirSync(path.join(checkout,folder));
  writeFileSync(path.join(checkout,'test/golden.mjs'), "import assert from 'node:assert/strict';\nimport {baseline} from '../scripts/example-baseline.mjs';\nimport {identity} from '../dist/index.mjs';\nassert.equal(baseline,'reviewed-ref');\nassert.equal(identity,'installed-registry');\nassert.equal(process.env.OPF_GOLDEN_BASELINE,'approved.json');\nconsole.log('static closure and installed runtime verified');\n");
  const helper="export const baseline='reviewed-ref';\n";
  writeFileSync(path.join(checkout,'scripts/example-baseline.mjs'),helper);
  writeFileSync(path.join(checkout,'dist/index.mjs'),"throw new Error('Source runtime must not execute');\n");
  writeFileSync(path.join(installed,'index.mjs'),"export const identity='installed-registry';\n");
  const git=(...args)=>execFileSync('git',args,{cwd:checkout,encoding:'utf8',stdio:'pipe'}).trim();
  git('init','--quiet');git('add','.');
  git('-c','user.name=Registry fidelity test','-c','user.email=registry-fidelity@example.invalid','commit','--quiet','-m','immutable fixture');
  const ref=git('rev-parse','HEAD');
  // Dirty or later source must not supply the helper for an immutable release.
  writeFileSync(path.join(checkout,'scripts/example-baseline.mjs'),"throw new Error('Unreviewed worktree helper');\n");
  const archive=archiveRegistryFidelity({checkout,ref,repo:'opf-render',directory:output});
  assert.ok(existsSync(archive));
  assert.equal(readFileSync(path.join(output,'scripts/example-baseline.mjs'),'utf8'),helper);
  assert.equal(existsSync(path.join(output,'dist')),false);
  symlinkSync(installed,path.join(output,'dist'),process.platform==='win32'?'junction':'dir');
  const result=execFileSync(process.execPath,[path.join(output,'test/golden.mjs')],{cwd:root,env:{...process.env,OPF_GOLDEN_BASELINE:'approved.json'},encoding:'utf8'});
  assert.equal(result.trim(),'static closure and installed runtime verified');
  const pptx=path.join(root,'pptx-verification');mkdirSync(pptx);
  archiveRegistryFidelity({checkout,ref,repo:'opf-pptx',directory:pptx});
  assert.equal(existsSync(path.join(pptx,'scripts')),false,'PPTX archive scope remains test-only');
  assert.equal(existsSync(path.join(pptx,'test/golden.mjs')),true);
 } finally {
  rmSync(root,{recursive:true,force:true});
 }
});

test('a package of the monorepo is archived from its directory at the release commit', () => {
 const root=mkdtempSync(path.join(tmpdir(),'registry-fidelity-prefix-'));
 try {
  const checkout=path.join(root,'source'), output=path.join(root,'verification');
  for(const folder of [checkout,output])mkdirSync(folder,{recursive:true});
  for(const folder of ['packages/render/test','packages/render/scripts','packages/render/dist','packages/pptx/test'])mkdirSync(path.join(checkout,folder),{recursive:true});
  writeFileSync(path.join(checkout,'packages/render/test/golden.mjs'),"console.log('render test');\n");
  writeFileSync(path.join(checkout,'packages/render/scripts/example-baseline.mjs'),"export const baseline='ref';\n");
  writeFileSync(path.join(checkout,'packages/render/dist/index.mjs'),"throw new Error('Source runtime must not execute');\n");
  writeFileSync(path.join(checkout,'packages/pptx/test/other.mjs'),"console.log('other package');\n");
  const git=(...args)=>execFileSync('git',args,{cwd:checkout,encoding:'utf8',stdio:'pipe'}).trim();
  git('init','--quiet');git('add','.');
  git('-c','user.name=Registry fidelity test','-c','user.email=registry-fidelity@example.invalid','commit','--quiet','-m','immutable fixture');
  archiveRegistryFidelity({checkout,ref:git('rev-parse','HEAD'),repo:'opf-render',directory:output,prefix:'packages/render'});
  assert.equal(readFileSync(path.join(output,'test/golden.mjs'),'utf8'),"console.log('render test');\n");
  assert.equal(readFileSync(path.join(output,'scripts/example-baseline.mjs'),'utf8'),"export const baseline='ref';\n");
  assert.equal(existsSync(path.join(output,'dist')),false,'runtime output is never taken from the commit');
  assert.equal(existsSync(path.join(output,'packages')),false,'the package directory is stripped');
  assert.equal(existsSync(path.join(output,'test/other.mjs')),false,'another package is not archived');
 } finally {
  rmSync(root,{recursive:true,force:true});
 }
});
