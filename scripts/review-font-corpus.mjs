// Compare independently generated before/after corpus PNGs without changing baselines.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {svgToPng}=await import(pathToFileURL(path.resolve(root,'../opf-render/dist/index.js')));
const [beforeDirectory,afterDirectory,output]=process.argv.slice(2).map(value=>path.resolve(value));
assert.ok(beforeDirectory&&afterDirectory&&output,'Supply before, after, and output directories.');
const before=JSON.parse(await readFile(path.join(beforeDirectory,'candidate.json'),'utf8'));
const after=JSON.parse(await readFile(path.join(afterDirectory,'candidate.json'),'utf8'));
assert.deepEqual(after.source,before.source,'The font-only review must preserve corpus source.');
assert.deepEqual(Object.keys(after.entries),Object.keys(before.entries));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),changes=[];
const escapeXml=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
for(const [index,key]of Object.keys(after.entries).entries()){
  const file=`${String(index).padStart(4,'0')}.png`;
  const oldPng=await readFile(path.join(beforeDirectory,file)),newPng=await readFile(path.join(afterDirectory,file));
  assert.equal(hash(oldPng),before.entries[key].sha256,`Before PNG ${key}`);
  assert.equal(hash(newPng),after.entries[key].sha256,`After PNG ${key}`);
  if(hash(oldPng)!==hash(newPng))changes.push({index,key,file,before:hash(oldPng),after:hash(newPng),oldPng,newPng});
}
await mkdir(output,{recursive:true});
for(let offset=0;offset<changes.length;offset+=8){
  const items=changes.slice(offset,offset+8);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="880"><rect width="1280" height="880" fill="#ddd"/>${items.map((item,i)=>{
    const x=(i%2)*640,y=Math.floor(i/2)*220;
    return `<text x="${x+6}" y="${y+15}" font-family="Roboto" font-size="11">${item.index} ${escapeXml(item.key).slice(-89)}</text><text x="${x+6}" y="${y+30}" font-family="Roboto" font-size="11">Before</text><text x="${x+326}" y="${y+30}" font-family="Roboto" font-size="11">After</text><image x="${x}" y="${y+36}" width="318" height="180" href="data:image/png;base64,${item.oldPng.toString('base64')}"/><image x="${x+320}" y="${y+36}" width="318" height="180" href="data:image/png;base64,${item.newPng.toString('base64')}"/>`;
  }).join('')}</svg>`;
  await writeFile(path.join(output,`sheet-${offset/8}.png`),await svgToPng(svg));
}
const report={source:after.source,verifiedImages:Object.keys(after.entries).length*2,changedSlides:changes.length,unchangedSlides:Object.keys(after.entries).length-changes.length,sheets:Math.ceil(changes.length/8),changes:changes.map(({oldPng,newPng,...item})=>item)};
await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({verifiedImages:report.verifiedImages,changedSlides:report.changedSlides,unchangedSlides:report.unchangedSlides,sheets:report.sheets}));
