import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
// Independent known-gap reproduction. Expected exit 1 on both exact base8772593b2 and this shaping fix.
// node repro.mjs <repository> <fresh-output.json>
const [repository,output]=process.argv.slice(2);
if(!repository||!output)throw Error('Pass repository and output JSON paths.');
const {toPptx,fromPptx}=await import(pathToFileURL(path.resolve(repository,'packages/pptx/dist/index.js')));
const {gallery}=await import(pathToFileURL(path.resolve(repository,'packages/gallery/dist/index.js')));
const everyRun=value=>Array.isArray(value)?value.flatMap(everyRun):value&&typeof value==='object'?[...(typeof value.text==='string'?[value]:[]),...Object.values(value).filter(x=>x&&typeof x==='object').flatMap(everyRun)]:[];
const cases=[];
for(const lang of ['ar-SA','fr','en-US']){
 const fixture={language:'ar-SA',slides:[{items:[{text:[{text:'Item 1: authored proofing choice.',lang}]}],numbering:'arabic'}]};
 const diagnostics=[],imported=await fromPptx(await toPptx(fixture,{catalogs:[gallery]}),{catalogs:[gallery],onDiagnostic:item=>diagnostics.push(item)});
 cases.push({lang,fixture,imported,diagnostics,preserved:everyRun(imported).some(value=>value.lang===lang&&value.text.includes('authored proofing'))});
}
await writeFile(output,JSON.stringify({cases},null,2)+'\n');
for(const item of cases)assert.ok(item.preserved,'authored language survives import exactly: '+item.lang);
