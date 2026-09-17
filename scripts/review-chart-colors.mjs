import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {examples} from '../packages/javascript/dist/examples.js';
import {svgToPng} from '../../opf-render/dist/index.js';
const [previousDirectory,currentDirectory,outputDirectory]=process.argv.slice(2);
assert.ok(previousDirectory&&currentDirectory&&outputDirectory,'Pass previous and current golden directories and a new review directory.');
const previous=path.resolve(previousDirectory),current=path.resolve(currentDirectory),output=path.resolve(outputDirectory);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const readJson=async file=>JSON.parse(await readFile(file,'utf8'));
const before=await readJson(path.join(previous,'candidate.json')),after=await readJson(path.join(current,'candidate.json'));
assert.deepEqual(before.source,after.source,'This renderer-only review must not change authored content.');
for(const field of ['version','format','scale','systemFonts'])assert.deepEqual(before[field],after[field]);
const keys=Object.keys(before.entries);assert.deepEqual(Object.keys(after.entries),keys);
const hasChart=value=>value&&typeof value==='object'&&(Object.hasOwn(value,'chart')||Object.values(value).some(hasChart));
const corpus=new Map(examples.map(({file,deck})=>[file.replace(/^examples\//,''),deck]));
const changed=[],images=[];
await mkdir(output,{recursive:true});
for(const [index,key]of keys.entries()){
 const name=`${String(index).padStart(4,'0')}.png`,old=await readFile(path.join(previous,name)),next=await readFile(path.join(current,name));
 assert.equal(hash(old),before.entries[key].sha256);assert.equal(hash(next),after.entries[key].sha256);
 if(before.entries[key].sha256===after.entries[key].sha256)continue;
 const [file,slide]=key.split('#');assert.ok(hasChart(corpus.get(file).slides[Number(slide)]),`${key}: non-chart raster changed`);
 changed.push({key,index,before:hash(old),after:hash(next)});images.push({old,next,index});
}
const escapeXml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;');
for(let start=0;start<images.length;start+=12){
 const rows=images.slice(start,start+12),svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="${rows.length*240}"><rect width="100%" height="100%" fill="#e2e8f0"/>${rows.map(({old,next,index},i)=>`<text x="12" y="${i*240+20}" font-family="Roboto" font-size="16">${escapeXml(keys[index])} — before / after</text><image x="10" y="${i*240+27}" width="700" height="205" href="data:image/png;base64,${old.toString('base64')}"/><image x="730" y="${i*240+27}" width="700" height="205" href="data:image/png;base64,${next.toString('base64')}"/>`).join('')}</svg>`;
 await writeFile(path.join(output,`sheet-${start/12}.png`),await svgToPng(svg));
}
await writeFile(path.join(output,'review.json'),JSON.stringify({source:after.source,beforeManifestSha256:hash(await readFile(path.join(previous,'candidate.json'))),afterManifestSha256:hash(await readFile(path.join(current,'candidate.json'))),verifiedImagesPerPhase:keys.length,changed,scope:'Source content unchanged; only slides containing charts changed. Exact before/after bytes verified. Review sheets are raster-regression aids, not browser/native equivalence or baseline approval.'},null,2)+'\n');
console.log(JSON.stringify({verifiedImagesPerPhase:keys.length,changed:changed.length,sheets:Math.ceil(changed.length/12),output}));
