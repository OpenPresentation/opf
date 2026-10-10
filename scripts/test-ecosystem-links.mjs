import assert from 'node:assert/strict';
import {mkdtemp, mkdir, copyFile, writeFile, readFile, realpath, rm, lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';

const temp=await mkdtemp(path.join(tmpdir(),'opf-link-test-'));
async function json(file,value){await mkdir(path.dirname(file),{recursive:true});await writeFile(file,JSON.stringify(value));}
try {
 const root=path.join(temp,'opf'),core=path.join(root,'packages/javascript'),script=path.join(root,'scripts/link-ecosystem.mjs');
 await mkdir(path.dirname(script),{recursive:true});await copyFile(new URL('./link-ecosystem.mjs',import.meta.url),script);
 await copyFile(new URL('./package-manager.mjs',import.meta.url),path.join(root,'scripts/package-manager.mjs'));
 await copyFile(new URL('./check-one-core.mjs',import.meta.url),path.join(root,'scripts/check-one-core.mjs'));
 await mkdir(path.join(core,'dist'),{recursive:true});await writeFile(path.join(core,'dist/composition.js'),'');
 await json(path.join(core,'package.json'),{name:'@openpresentation/opf'});
 for(const name of ['opf-render','opf-pptx','opf-editor','pptx-gallery']) {
  const directory=path.join(temp,name);
  await json(path.join(directory,'package.json'),{name,scripts:{build:'node --version'},...(name==='opf-render'?{peerDependencies:{'@expo-google-fonts/noto-sans-jp':'0.4.4','@expo-google-fonts/noto-emoji':'0.4.8','@openpresentation/opf':'^0.18.0'}}:{})});
  if(name==='opf-editor')await json(path.join(directory,'node_modules/@expo-google-fonts/noto-sans-jp/package.json'),{name:'@expo-google-fonts/noto-sans-jp',version:'0.4.3'});
  if(name==='opf-pptx')await json(path.join(directory,'node_modules/@expo-google-fonts/noto-sans-jp/package.json'),{name:'@expo-google-fonts/noto-sans-jp',version:'0.4.4',marker:'pptx-own'});
  await json(path.join(directory,'node_modules/@openpresentation/opf/package.json'),{name:'@openpresentation/opf'});
  if(name==='opf-pptx'||name==='opf-editor')await json(path.join(directory,'node_modules/@openpresentation/opf-render/package.json'),{name:'@openpresentation/opf-render'});
  if(name==='opf-editor')await json(path.join(directory,'node_modules/@openpresentation/opf-pptx/package.json'),{name:'@openpresentation/opf-pptx'});
 }
 // The renderer's pinned font tarball, as `npm pack` names it, in the cache the script reads first (no network).
 const cache=path.join(temp,'font-cache'),packed=path.join(temp,'packed');
 await json(path.join(packed,'package/package.json'),{name:'@expo-google-fonts/noto-sans-jp',version:'0.4.4',marker:'pinned'});
 await mkdir(cache,{recursive:true});
 const tar=spawnSync('tar',['-czf',path.join(cache,'expo-google-fonts-noto-sans-jp-0.4.4.tgz'),'-C',packed,'package'],{encoding:'utf8'});
 assert.equal(tar.status,0,tar.stderr);
 const run=()=>spawnSync(process.execPath,[script,'--packages-only'],{encoding:'utf8',timeout:30000,env:{...process.env,OPF_LINK_FONT_CACHE:cache}});
 for(let pass=0;pass<2;pass++) {
  const result=run();assert.equal(result.status,0,result.stderr||result.stdout);
  for(const name of ['opf-render','opf-pptx','opf-editor'])assert.equal(await realpath(path.join(temp,name,'node_modules/@openpresentation/opf')),await realpath(core));
  for(const name of ['opf-pptx','opf-editor'])assert.equal(await realpath(path.join(temp,name,'node_modules/@openpresentation/opf-render')),await realpath(path.join(temp,'opf-render')));
  assert.equal(await realpath(path.join(temp,'opf-editor/node_modules/@openpresentation/opf-pptx')),await realpath(path.join(temp,'opf-pptx')));
  const fontPackage=async(name)=>JSON.parse(await readFile(path.join(temp,name,'node_modules/@expo-google-fonts/noto-sans-jp/package.json'),'utf8'));
  assert.deepEqual(await fontPackage('opf-editor'),{name:'@expo-google-fonts/noto-sans-jp',version:'0.4.4',marker:'pinned'},'An older font package is replaced by the linked renderer\'s pin');
  assert.equal((await fontPackage('opf-pptx')).marker,'pptx-own','A font package already at the pin is left alone');
  for(const name of ['opf-pptx','opf-editor'])assert.equal(existsSync(path.join(temp,name,'node_modules/@expo-google-fonts/noto-emoji')),false,'A font package the sibling does not have is not added');
 }
 assert.equal((await lstat(path.join(temp,'pptx-gallery/node_modules/@openpresentation/opf'))).isSymbolicLink(),false,'Packages-only setup leaves gallery alone');
 console.log('Coordinated links passed: core, renderer and editor converter, the linked renderer\'s font pins, repeat setup and packages-only isolation.');
} finally {
 const actual=await realpath(temp),parent=await realpath(tmpdir());
 assert.ok(actual.startsWith(parent+path.sep)&&path.basename(actual).startsWith('opf-link-test-'));
 await rm(actual,{recursive:true,force:true});
}
