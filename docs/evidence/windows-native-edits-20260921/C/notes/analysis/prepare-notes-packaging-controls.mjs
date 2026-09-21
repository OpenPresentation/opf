import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
assert.equal(process.versions.node.split('.')[0],'24');
const root=path.dirname(fileURLToPath(import.meta.url)), out=path.join(root,'notes-packaging-controls-02');
const require=createRequire(path.join(root,'registry-consumer/package.json')),{unzipSync,zipSync}=require('fflate');
const original=await readFile(path.join(root,'notes-order-registry-01/original/notes-control.pptx'));
const changed=await readFile(path.join(root,'notes-order-registry-01/reordered/notes-control.pptx'));
const entries=unzipSync(original),changedEntries=unzipSync(changed),sha=b=>createHash('sha256').update(b).digest('hex');
const pack=(parts,locale)=>zipSync(Object.fromEntries(Object.keys(parts).sort(locale?(a,b)=>a.localeCompare(b):undefined).map(k=>[k,[parts[k],{mtime:new Date(1980,0,1)}]])),{level:6});
await mkdir(out,{recursive:false});
const records=[];
for(const [id,parts,locale] of [['unchanged-ascii',entries,false],['unchanged-locale',entries,true],['reordered-ascii',changedEntries,false]]){
 const bytes=pack(parts,locale),file=path.join(out,id+'.pptx');await writeFile(file,bytes);
 const archive=unzipSync(bytes),changedParts=Object.keys(entries).filter(k=>sha(entries[k])!==sha(archive[k]));
 assert.deepEqual(changedParts,id.startsWith('reordered')?['ppt/presentation.xml']:[]);
 records.push({id,file,sha256:sha(bytes),originalBytesIdentical:Buffer.from(bytes).equals(original),changedParts,partOrder:Object.keys(archive)});
}
const manifest={node:process.version,verifierSha256:sha(await readFile(fileURLToPath(import.meta.url))),sourceSha256:sha(original),scope:'Offline isolation of the existing diagnostic generator ZIP ordering confound. Source production uses ASCII sort; diagnostic used localeCompare. No runtime output changes.',records};
await writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest.records.map(({id,sha256,originalBytesIdentical,changedParts,partOrder})=>({id,sha256,originalBytesIdentical,changedParts,firstParts:partOrder.slice(0,3)}))));
