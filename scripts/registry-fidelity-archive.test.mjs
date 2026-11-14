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
  const crlf="export const intentional='CRLF';\r\n";
  writeFileSync(path.join(checkout,'scripts/crlf.mjs'),crlf);
  writeFileSync(path.join(checkout,'scripts/example-baseline.mjs'),helper);
  writeFileSync(path.join(checkout,'dist/index.mjs'),"throw new Error('Source runtime must not execute');\n");
  writeFileSync(path.join(installed,'index.mjs'),"export const identity='installed-registry';\n");
  const git=(...args)=>execFileSync('git',args,{cwd:checkout,encoding:'utf8',stdio:'pipe'}).trim();
  git('init','--quiet');
  // This private fixture owns its bytes; do not inherit the host's checkout newline policy.
  git('config','--local','core.autocrlf','false');git('config','--local','core.eol','lf');
  git('add','.');
  git('-c','user.name=Registry fidelity test','-c','user.email=registry-fidelity@example.invalid','commit','--quiet','-m','immutable fixture');
  const ref=git('rev-parse','HEAD');
  // Dirty or later source must not supply the helper for an immutable release.
  writeFileSync(path.join(checkout,'scripts/example-baseline.mjs'),"throw new Error('Unreviewed worktree helper');\n");
  const archive=archiveRegistryFidelity({checkout,ref,repo:'opf-render',directory:output});
  assert.ok(existsSync(archive));
  assert.equal(readFileSync(path.join(output,'scripts/example-baseline.mjs'),'utf8'),helper);
  assert.equal(readFileSync(path.join(output,'scripts/crlf.mjs'),'utf8'),crlf,'intentional CRLF bytes are preserved, not normalized by the archiver');
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
  git('init','--quiet');
  // This private fixture owns its bytes; do not inherit the host's checkout newline policy.
  git('config','--local','core.autocrlf','false');git('config','--local','core.eol','lf');
  git('add','.');
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

// The registry tier runs these tests against the published packages, after a release. Each must also run on a pull request, or a
// change that breaks the test is first seen in the nightly run (opf-render 0.34.0: shared-metric.mjs was in the runner's exclude
// list, no step ran it, and it still wrote contentAlignment 'left' after 0.34 made the value logical).
test('every test of the registry tier also runs in pull-request CI', () => {
 const root=path.resolve(import.meta.dirname,'..');
 const source=readFileSync(path.join(root,'scripts/test-registry-fidelity.mjs'),'utf8');
 const block=source.slice(source.indexOf('const suites=['),source.indexOf('const CORRECTED_TESTS'));
 const ci=readFileSync(path.join(root,'.github/workflows/ci.yml'),'utf8');
 let checked=0;
 for(const [,repo,list] of block.matchAll(/\['(opf-[a-z]+)',\[(.*)\]\],?\n/g)){
  const directory=path.join(root,'packages',repo.replace(/^opf-/,''));
  const suites=JSON.parse(readFileSync(path.join(directory,'test/suites.json'),'utf8'));
  const scripts=JSON.parse(readFileSync(path.join(directory,'package.json'),'utf8')).scripts;
  // A script of the package that a step of ci.yml names for this package.
  const called=Object.keys(scripts).filter(name=>new RegExp('pnpm run '+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![\\w:.-])').test(ci));
  for(const [,name] of list.matchAll(/'([a-z0-9-]+\.mjs)'/g)){
   assert.ok(existsSync(path.join(directory,'test',name)),repo+' test/'+name+' exists');
   checked++;
   if(!suites.exclude.includes(name))continue; // the package's test runner globs it
   assert.ok(called.some(script=>scripts[script].includes('test/'+name)),repo+' test/'+name+' is in the exclude list of test/suites.json and no script that ci.yml runs names it: nothing runs it on a pull request');
  }
 }
 assert.ok(checked>=20,'the suites of scripts/test-registry-fidelity.mjs were read ('+checked+' tests)');
});
