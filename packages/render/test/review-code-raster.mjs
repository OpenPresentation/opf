// Compare every changed golden slide to an ordinary installed baseline renderer.
// node test/review-code-raster.mjs <baseline-registry-consumer> [output]
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import {examples} from '@openpresentation/opf/examples';
import {renderSvgDeck,svgToPng} from '../dist/index.js';
const [consumer,directory='artifacts/code-review']=process.argv.slice(2);assert.ok(consumer);
const root=await realpath(consumer),base=await realpath(path.join(root,'node_modules/@openpresentation/opf-render'));
assert.ok(base.startsWith(root+path.sep),'Use an installed registry baseline, not a source alias');
const baseline=await import(pathToFileURL(path.join(base,'dist/index.js')));
const lock=JSON.parse(await readFile(path.join(root,'package-lock.json'),'utf8'));
const entry=lock.packages['node_modules/@openpresentation/opf-render'];
assert.equal(entry.version,'0.6.0');assert.ok(entry.resolved.startsWith('https://registry.npmjs.org/')&&!entry.link);
const expected=JSON.parse(await readFile('test/golden/pre-shared-code-opf-examples-png.sha256.json','utf8'));
const candidate=JSON.parse(await readFile('artifacts/golden/candidate.json','utf8'));
assert.deepEqual(expected.source,candidate.source);
const changed=Object.keys(expected.entries).filter(key=>expected.entries[key].sha256!==candidate.entries[key].sha256);
const hash=value=>createHash('sha256').update(value).digest('hex');
await mkdir(directory,{recursive:true});const pairs=[],records=[];
for(const [ordinal,key] of changed.entries()) {
  const split=key.lastIndexOf('#'),file=key.slice(0,split),index=Number(key.slice(split+1));
  const deck=examples.find(example=>example.file==='examples/'+file)?.deck;assert.ok(deck,key);
  const before=await baseline.svgToPng(baseline.renderSvgDeck(deck,{trace:true})[index],{scale:.25,loadSystemFonts:false});
  const after=await svgToPng(renderSvgDeck(deck,{trace:true})[index],{scale:.25,loadSystemFonts:false});
  assert.equal(hash(before),expected.entries[key].sha256,'Baseline runtime must reproduce the approved slide');
  assert.equal(hash(after),candidate.entries[key].sha256,'Candidate must reproduce the new slide');
  const id=String(ordinal).padStart(2,'0');
  await writeFile(path.join(directory,id+'-before.png'),before);await writeFile(path.join(directory,id+'-after.png'),after);
  const pair=await sharp({create:{width:800,height:250,channels:4,background:'#dddddd'}}).composite([
    {input:await sharp(before).resize(400,225,{fit:'contain',background:'#dddddd'}).toBuffer(),left:0,top:0},
    {input:await sharp(after).resize(400,225,{fit:'contain',background:'#dddddd'}).toBuffer(),left:400,top:0},
    {input:Buffer.from(`<svg width="800" height="25"><text x="4" y="18" font-family="Arial" font-size="12">${id}: ${file.replaceAll('&','&amp;')} #${index} — before | after</text></svg>`),left:0,top:225},
  ]).png().toBuffer();pairs.push(pair);
  records.push({id,key,beforeSha256:hash(before),afterSha256:hash(after)});
  if (file.startsWith('technical/') || ordinal === 3) {
    await writeFile(path.join(directory,id+'-before-full.png'),await baseline.svgToPng(baseline.renderSvgDeck(deck,{trace:true})[index],{loadSystemFonts:false}));
    await writeFile(path.join(directory,id+'-after-full.png'),await svgToPng(renderSvgDeck(deck,{trace:true})[index],{loadSystemFonts:false}));
  }
}
for(let offset=0;offset<pairs.length;offset+=6) {
  const sheet=await sharp({create:{width:800,height:250*Math.min(6,pairs.length-offset),channels:4,background:'#ddd'}}).composite(pairs.slice(offset,offset+6).map((input,i)=>({input,left:0,top:i*250}))).png().toBuffer();
  await writeFile(path.join(directory,`sheet-${offset/6}.png`),sheet);
}
await writeFile(path.join(directory,'review.json'),JSON.stringify({node:process.version,baseline:entry,source:expected.source,records,verifierSha256:hash(await readFile(new URL(import.meta.url))),scope:'All changed golden slides reproduced against verified registry renderer 0.6.0. Manual visual review is required; this report does not approve new baselines or assert layout quality or native fidelity.'},null,2)+'\n');
console.log(`Prepared ${records.length} before/after pairs in ${directory}; approved manifest remains unchanged.`);
