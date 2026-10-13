// Transfer only the exact open Roboto faces used by the native visual control.
// Files come from the selected installed renderer manifest, never a CDN or a
// machine font directory. This does not register fonts on the host.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,realpath} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {fixtureWriter} from './generate.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function contained(relative){
  assert.ok(typeof relative==='string'&&!path.isAbsolute(relative)&&relative.split(/[/\\]/).every(part=>part&&part!=='.'&&part!=='..'),'unsafe font path');
  return relative;
}

export async function generateFontInputs({consumer,output}={}){
  const installed=await realpath(consumer),root=await realpath(output);
  assert.ok(root!==installed&&!root.startsWith(installed+path.sep),'font output cannot live in installed consumer');
  const require=createRequire(path.join(installed,'package.json'));
  const renderer=path.dirname(require.resolve('@openpresentation/opf-render/package.json'));
  const {BUNDLED_FONT_MANIFEST}=await import(pathToFileURL(path.join(renderer,'dist/font-manifest.js')).href);
  const records=BUNDLED_FONT_MANIFEST.packages.filter(item=>item.name==='@expo-google-fonts/roboto');
  assert.equal(records.length,1,'expected one installed Roboto manifest record');
  const record=records[0];assert.equal(record.license,'OFL-1.1','Roboto must retain its open license');
  assert.equal(record.faces.length,7,'retain seven pinned Roboto faces');
  const packageRoot=path.dirname(require.resolve('@expo-google-fonts/roboto/package.json'));
  const license=await readFile(path.join(packageRoot,contained(record.licenseFile)));
  assert.equal(hash(license),record.licenseSha256,'installed license differs from renderer pin');
  assert.match(license.toString('utf8'),/SIL OPEN FONT LICENSE/i,'license notice missing');
  const {put,files}=fixtureWriter(root),transferredFaces=[];
  for(const face of record.faces){
    const relative=contained(face.file),bytes=await readFile(path.join(packageRoot,relative));
    assert.equal(hash(bytes),face.sha256,`installed font face differs from renderer pin: ${relative}`);
    const file=`fonts/roboto/${relative.split(path.sep).join('/')}`;
    const saved=await put(file,bytes);transferredFaces.push({file,sha256:saved.sha256,bytes:saved.bytes,family:face.family,weight:face.weight,italic:face.italic});
  }
  const licenseFile=(await put('fonts/roboto/LICENSE',license)).path;
  return {files,fontInventory:{...record,actualLicenseVerified:true,actualFaceHashesVerified:true,registeredByAgent:false,transferredFaces,transferredLicense:{file:licenseFile,sha256:record.licenseSha256},otherResolvedFontsNotClaimed:true}};
}
