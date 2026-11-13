// Tooling entry/closure controls, never genuine packed/native qualification.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import test from 'node:test';
import {b07NativeShapes} from './b07-native-shapes.mjs';
import {b07NativeShapes as profileParser,b07ControllerFiles} from './b07-current-profile.mjs';
import {digest} from './identity.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url)),shared=new URL('./b07-native-shapes.mjs',import.meta.url),generator=new URL('./b07-current-generate.mjs',import.meta.url),profile=new URL('./b07-current-profile.mjs',import.meta.url);
const original='2a2e40030e449dfe099b3abe73088a3cba635ae8';
test('one shared parser and literal guards are exact reviewed extraction, with no reverse CLI dependency',()=>{
 const old=execFileSync('git',['-C',root,'show',original+':scripts/native-acceptance/b07-current-profile.mjs'],{encoding:'utf8'}),source=fs.readFileSync(shared,'utf8'),marker='/** Ordered OOXML;';
 assert.equal(old.split(marker).length,2);assert.equal(source.split(marker).length,2);
 const before=old.slice(old.indexOf(marker),old.indexOf('\nexport async function b07ControllerFiles()',old.indexOf(marker))).trimEnd()+'\n',after=source.slice(source.indexOf(marker));
 assert.equal(digest(before),'5d9613036acbfe7b5c01881853f795d516239909a46fe8a75dc197a437043385');assert.equal(after,before);assert.equal(profileParser,b07NativeShapes);
 for(const name of ['integer','literal']){const line=old.split('\n').find(line=>line.startsWith('const '+name+'='));assert.ok(line);assert.ok(source.includes('export '+line));assert.ok(!fs.readFileSync(profile,'utf8').includes(line));}
 assert.doesNotMatch(fs.readFileSync(generator,'utf8'),/b07-current-profile\.mjs/u,'The generator cannot dynamically await a module importing its own CLI');
 const relative=[...source.matchAll(/from\s*['"](\.[^'"]+)['"]/gu)].map(match=>match[1]);assert.deepEqual(relative,['./b07-current-source.mjs']);
});

test('both maintained controller inventories bind the new shared parser',async()=>{
 assert.ok((await b07ControllerFiles()).includes('scripts/native-acceptance/b07-native-shapes.mjs'));
 assert.match(fs.readFileSync(new URL('./run-b07-current-profile.ps1',import.meta.url),'utf8'),/'scripts\/native-acceptance\/b07-native-shapes\.mjs'/u);
});

test('actual generator inspect entry completes with shared parser once and no profile/product import',()=>{
 const scratch=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'opf-b07-entry-'))),hook=path.join(scratch,'inspect-hook.mjs');let passed=false;
 try{
  fs.writeFileSync(hook,`import {registerHooks} from 'node:module';\nlet shared=0;\nregisterHooks({resolve(s,c,next){if(s.startsWith('@openpresentation/'))throw Error('Unexpected product import');return next(s,c);},load(url,c,next){if(url===${JSON.stringify(profile.href)})throw Error('Generator/profile cycle');if(url===${JSON.stringify(shared.href)})shared++;return next(url,c);}});\nprocess.on('beforeExit',()=>{if(shared!==1)throw Error('Shared parser was not loaded exactly once');});\n`,{flag:'wx'});
  const child=spawnSync(process.execPath,['--import',pathToFileURL(hook).href,fileURLToPath(generator),'inspect'],{encoding:'utf8',timeout:10000,maxBuffer:1024*1024});
  assert.ifError(child.error);assert.equal(child.signal,null);assert.equal(child.status,0,child.stderr);assert.equal(child.stderr,'');const result=JSON.parse(child.stdout);assert.equal(result.generation,false);assert.equal(result.nativeAcceptance,false);assert.equal(result.registryAcceptance,false);assert.equal(result.cases.length,5);passed=true;
 }finally{if(passed){assert.ok(path.basename(scratch).startsWith('opf-b07-entry-'));fs.rmSync(scratch,{recursive:true,force:true});}else console.error('Retained failed B07 entry fixture: '+scratch);}
});
