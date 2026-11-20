import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,realpath,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {BUNDLED_FONT_MANIFEST} from '../../packages/render/src/font-manifest.js';
import {generateMonoFontInputs,MONO_PINS,MONO_PROFILE_ID,validateMonoRecord} from './roboto-mono-fonts.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const record=()=>structuredClone(BUNDLED_FONT_MANIFEST.packages.find(value=>value.name===MONO_PINS.name));
test('bounded Mono profile equals the renderer pins and cannot be changed in memory',()=>{
  assert.equal(validateMonoRecord(record()).faces.length,2);
  assert.equal(MONO_PROFILE_ID,'opf-native-roboto-mono-0.4.2-400-700-v1');
  assert.ok(Object.isFrozen(MONO_PINS)&&Object.isFrozen(MONO_PINS.faces)&&MONO_PINS.faces.every(Object.isFrozen));
  assert.throws(()=>{MONO_PINS.faces[0].weight=500;},TypeError);
});
for(const [name,change] of [
  ['package',v=>{v.name='@expo-google-fonts/roboto';}],
  ['version',v=>{v.version='0.4.3';}],
  ['license',v=>{v.license='MIT';}],
  ['license file',v=>{v.licenseFile='LICENSE';}],
  ['license hash',v=>{v.licenseSha256='a'.repeat(64);}],
  ['family',v=>{v.faces[0].family='Roboto';}],
  ['weight',v=>{v.faces[0].weight=500;}],
  ['italic',v=>{v.faces[0].italic=true;}],
  ['face hash',v=>{v.faces[0].sha256='a'.repeat(64);}],
  ['face path',v=>{v.faces[0].file='../font.ttf';}],
  ['duplicate face',v=>{v.faces[1]=v.faces[0];}],
  ['extra face',v=>{v.faces.push(v.faces[0]);}],
])test(`Mono refuses changed ${name}`,()=>{
  const value=record();change(value);assert.throws(()=>validateMonoRecord(value));
});
test('Mono input generator authenticates actual two font files, license and exact tools; nonempty output is refused',async()=>{
  const scratch=await realpath(await mkdtemp(path.join(tmpdir(),'opf-mono-generate-')));
  try{
    const output=path.join(scratch,'output');await mkdir(output);
    const result=await generateMonoFontInputs({output});
    assert.equal(result.profileId,MONO_PROFILE_ID);assert.equal(result.registeredByAgent,false);
    assert.equal(result.files.length,3);assert.equal(result.fontInventory.transferredFaces.length,2);
    for(const file of result.files){const bytes=await readFile(path.join(output,file.path));assert.equal(hash(bytes),file.sha256);assert.equal(bytes.length,file.bytes);}
    for(const [field,file] of [['setupToolSha256','setup-roboto-mono-windows.ps1'],['probeToolSha256','probe-fonts-windows.ps1']])assert.equal(result[field],hash(await readFile(new URL(file,import.meta.url))));
    assert.match(await readFile(path.join(output,'fonts/roboto-mono/LICENSE'),'utf8'),/SIL OPEN FONT LICENSE/u);
    await writeFile(path.join(output,'sentinel'),'preserve');
    await assert.rejects(()=>generateMonoFontInputs({output}),/must be empty/u);
    assert.equal(await readFile(path.join(output,'sentinel'),'utf8'),'preserve');
  }finally{await rm(scratch,{recursive:true,force:true});}
});
