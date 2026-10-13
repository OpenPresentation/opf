import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,realpath,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {generateFontInputs} from './fonts.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('installed renderer font manifest pins every transferred face and license',async()=>{
  const scratch=await realpath(await mkdtemp(path.join(tmpdir(),'native-font-inputs-')));
  try{
    const consumer=path.join(scratch,'consumer'),renderer=path.join(consumer,'node_modules/@openpresentation/opf-render'),font=path.join(consumer,'node_modules/@expo-google-fonts/roboto');
    await mkdir(path.join(renderer,'dist'),{recursive:true});await mkdir(font,{recursive:true});
    await writeFile(path.join(consumer,'package.json'),'{}\n');
    await writeFile(path.join(renderer,'package.json'),'{"name":"@openpresentation/opf-render","type":"module"}\n');
    await writeFile(path.join(font,'package.json'),'{"name":"@expo-google-fonts/roboto","version":"test"}\n');
    const license=Buffer.from('SIL OPEN FONT LICENSE Version 1.1\n');await writeFile(path.join(font,'LICENSE_FONT'),license);
    const faces=[];
    for(let index=0;index<7;index++){
      const file=`faces/face-${index}.ttf`,bytes=Buffer.from(`test font face ${index}`);
      await mkdir(path.dirname(path.join(font,file)),{recursive:true});await writeFile(path.join(font,file),bytes);
      faces.push({file,sha256:hash(bytes),family:'Roboto',weight:400+index,italic:false});
    }
    const record={name:'@expo-google-fonts/roboto',version:'test',license:'OFL-1.1',licenseFile:'LICENSE_FONT',licenseSha256:hash(license),faces};
    await writeFile(path.join(renderer,'dist/font-manifest.js'),`export const BUNDLED_FONT_MANIFEST=${JSON.stringify({packages:[record]})};\n`);
    const output=path.join(scratch,'output');await mkdir(output);
    const result=await generateFontInputs({consumer,output});
    assert.equal(result.files.length,8);assert.equal(result.fontInventory.transferredFaces.length,7);
    assert.equal(result.fontInventory.registeredByAgent,false);
    assert.deepEqual(await readFile(path.join(output,'fonts/roboto/LICENSE')),license);
    await writeFile(path.join(font,faces[0].file),'tampered');
    const rejected=path.join(scratch,'rejected');await mkdir(rejected);
    await assert.rejects(()=>generateFontInputs({consumer,output:rejected}),/installed font face differs/);
  }finally{await rm(scratch,{recursive:true,force:true});}
});
