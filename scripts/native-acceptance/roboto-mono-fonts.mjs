import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,realpath,readdir,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {BUNDLED_FONT_MANIFEST} from '../../packages/render/src/font-manifest.js';
import {fixtureWriter} from './generate.mjs';

export const MONO_PROFILE_ID='opf-native-roboto-mono-0.4.2-400-700-v1';
const freeze=value=>{for(const child of Object.values(value))if(child&&typeof child==='object')freeze(child);return Object.freeze(value);};
export const MONO_PINS=freeze({name:'@expo-google-fonts/roboto-mono',version:'0.4.2',license:'OFL-1.1',licenseFile:'LICENSE_FONT',licenseSha256:'50ab8dd54680d3473f649c9db86fece88434d097c7834475c1c72d2f8c429215',faces:[{file:'400Regular/RobotoMono_400Regular.ttf',family:'Roboto Mono',weight:400,italic:false,sha256:'e4bf45837847d4abfa5a502b807a83393aa138727bdb9ea9c93fb17d53208d95'},{file:'700Bold/RobotoMono_700Bold.ttf',family:'Roboto Mono',weight:700,italic:false,sha256:'92649d819cc4c20480b23a47aaa111769924eb31c66b6ecdcf6f573662558c83'}]});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function validateMonoRecord(record){
 assert.ok(record&&typeof record==='object','Missing pinned Mono record');
 for(const key of['name','version','license','licenseFile','licenseSha256'])assert.equal(record[key],MONO_PINS[key],'Mono '+key+' differs from the bounded profile');
 assert.ok(Array.isArray(record.faces)&&record.faces.length===2,'Expected exactly two pinned Mono faces');
 for(const expected of MONO_PINS.faces){const matches=record.faces.filter(face=>face.file===expected.file);assert.equal(matches.length,1,'Missing/duplicate Mono face');for(const key of['file','family','weight','italic','sha256'])assert.equal(matches[0][key],expected[key],'Mono face '+key+' differs from pin');}
 return record;
}
export async function generateMonoFontInputs({output}={}){
 const root=await realpath(output);assert.equal((await readdir(root)).length,0,'Mono output must be empty');
 const records=BUNDLED_FONT_MANIFEST.packages.filter(r=>r.name===MONO_PINS.name);assert.equal(records.length,1);const record=validateMonoRecord(records[0]);
 const renderPackage=fileURLToPath(new URL('../../packages/render/package.json',import.meta.url)),require=createRequire(renderPackage),packageRoot=path.dirname(require.resolve(MONO_PINS.name+'/package.json'));
 const pkg=JSON.parse(await readFile(path.join(packageRoot,'package.json'),'utf8'));assert.equal(pkg.name,MONO_PINS.name);assert.equal(pkg.version,MONO_PINS.version);
 const license=await readFile(path.join(packageRoot,MONO_PINS.licenseFile));assert.equal(hash(license),MONO_PINS.licenseSha256,'Mono license bytes differ');assert.match(license.toString('utf8'),/SIL OPEN FONT LICENSE/u);
 // Read and authenticate everything before writing any transferable font.
 const faces=await Promise.all(MONO_PINS.faces.map(async face=>{const bytes=await readFile(path.join(packageRoot,face.file));assert.equal(hash(bytes),face.sha256,'Mono font bytes differ');return{face,bytes};}));
 const tools=await Promise.all(['setup-roboto-mono-windows.ps1','probe-fonts-windows.ps1'].map(async name=>({name,sha256:hash(await readFile(new URL(name,import.meta.url)))})));
 const {put,files}=fixtureWriter(root),transferredFaces=[];for(const{face,bytes}of faces){const saved=await put('fonts/roboto-mono/'+face.file,bytes);transferredFaces.push({...face,file:saved.path,bytes:saved.bytes});}
 const savedLicense=await put('fonts/roboto-mono/LICENSE',license);
 return {schemaVersion:1,profileId:MONO_PROFILE_ID,setupToolSha256:tools[0].sha256,probeToolSha256:tools[1].sha256,registeredByAgent:false,fontInventory:{...record,actualLicenseVerified:true,actualFaceHashesVerified:true,transferredFaces,transferredLicense:{file:savedLicense.path,sha256:MONO_PINS.licenseSha256}},files};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 assert.equal(process.argv.length,4,'Usage: node scripts/native-acceptance/roboto-mono-fonts.mjs --out <fresh-directory>');assert.equal(process.argv[2],'--out');const output=path.resolve(process.argv[3]);await mkdir(output,{recursive:false});const suite=await generateMonoFontInputs({output});await writeFile(path.join(output,'suite.json'),JSON.stringify(suite,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output,profileId:suite.profileId,faces:suite.fontInventory.faces.length,registered:false}));
}
