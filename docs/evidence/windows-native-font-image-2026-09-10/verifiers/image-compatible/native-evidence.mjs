import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const json=async file=>JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
export async function fingerprint(tests,{editor=false}={}){
 const runtime={},root=fileURLToPath(new URL('../',import.meta.url));
 for(const file of [...tests,'test/native-evidence.mjs','test/native-process.ps1','vendor/pptxgenjs/pptxgen.es.js','package-lock.json'])runtime[file]=sha(await readFile(path.join(root,file)));
 for(const name of ['@openpresentation/opf','@openpresentation/opf-render','@openpresentation/opf-pptx',...(editor?['@openpresentation/opf-editor']:[])]){
  const directory=name.endsWith('/opf-editor')?path.resolve(root,'../opf-editor'):path.dirname(fileURLToPath(import.meta.resolve(name+'/package.json')));
  runtime[name+'/package.json']=sha(await readFile(path.join(directory,'package.json')));
  const dist=path.join(directory,'dist'),seen=new Set();
  const visit=async file=>{
   if(seen.has(file))return;seen.add(file);const relative=path.relative(dist,file);assert.ok(!relative.startsWith('..')&&!path.isAbsolute(relative));
   const bytes=await readFile(file);runtime[name+'/dist/'+relative.split(path.sep).join('/')]=sha(bytes);
   for(const match of bytes.toString().matchAll(/(?:from\s*|import\s*)['"](\.\/[^'"]+\.js)['"]/g))await visit(path.resolve(path.dirname(file),match[1]));
  };
  const entries=name==='@openpresentation/opf'?['composition.js','pagination.js','validator.js','catalogs.js']:(await readdir(dist,{recursive:true})).filter(f=>f.endsWith('.js'));
  for(const file of entries)await visit(path.join(dist,file));
 }
 return runtime;
}
