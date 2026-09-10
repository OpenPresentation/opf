import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import {examples} from '@openpresentation/opf/examples';
import {renderSvgDeck,svgToPng} from '../dist/index.js';
import {renderSvgDeck as renderBefore} from '../artifacts/source-whitespace-before-runtime/dist/index.js';
const before=path.resolve(process.argv[2]??'artifacts/source-whitespace-golden-before'),after=path.resolve(process.argv[3]??'artifacts/source-whitespace-golden-after'),out=path.resolve(process.argv[4]??'docs/evidence/source-whitespace-corpus-review');
const original=JSON.parse(await readFile(path.join(before,'candidate.json'))),candidate=JSON.parse(await readFile(path.join(after,'candidate.json')));
assert.deepEqual(original.source,candidate.source);
const keys=Object.keys(candidate.entries),changed=keys.filter(key=>original.entries[key].sha256!==candidate.entries[key].sha256),sheets=[];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
await mkdir(out,{recursive:true});
for(let offset=0;offset<changed.length;offset+=8){
  const slides=changed.slice(offset,offset+8),layers=[];
  for(const [index,key] of slides.entries())for(const [side,root]of [before,after].entries()){
    const left=(index%2)*660+side*325,top=Math.floor(index/2)*210;
    const png=await readFile(path.join(root,`${String(keys.indexOf(key)).padStart(4,'0')}.png`));
    assert.equal(hash(png),(side?candidate:original).entries[key].sha256);
    layers.push({input:await sharp(png).resize({width:320,height:180,fit:'contain',background:'#fff'}).png().toBuffer(),left,top:top+25});
    const label=`${offset+index}: ${side?'AFTER':'BEFORE'} ${key.split('/').at(-1)}`.replaceAll('&','&amp;').replaceAll('<','&lt;');
    layers.push({input:Buffer.from(`<svg width="320" height="24"><text x="4" y="15" font-size="10">${label}</text></svg>`),left,top});
  }
  const file=`sheet-${offset/8}.png`,png=await sharp({create:{width:1320,height:840,channels:4,background:'#e5e5e5'}}).composite(layers).png().toBuffer();
  await writeFile(path.join(out,file),png);sheets.push({file,sha256:hash(png),slides});
}
const full=[];
for(const key of [changed[0],changed[17],changed[62],changed[134],changed[221],changed[278]]){
  const [file,index]=key.split('#'),deck=examples.find(example=>example.file.replace(/^examples\//,'')===file).deck;
  const files=[];
  for(const [side,render]of [['before',renderBefore],['after',renderSvgDeck]]){
    const svg=render(deck,{trace:true})[Number(index)],png=await svgToPng(svg,{loadSystemFonts:false}),name=`full-${full.length}-${side}`;
    await writeFile(path.join(out,`${name}.svg`),svg);await writeFile(path.join(out,`${name}.png`),png);
    files.push({side,svg:`${name}.svg`,svgSha256:hash(svg),png:`${name}.png`,pngSha256:hash(png)});
  }
  full.push({key,files});
}
await writeFile(path.join(out,'report.json'),JSON.stringify({source:candidate.source,total:keys.length,changed:changed.length,unchanged:keys.length-changed.length,previousBaseline:'test/golden/opf-examples-png.rich-flow.sha256.json',previousRendererCommit:'c92198b0d0acc94892385a8594fe2879461d64b0',previousCoreCandidate:JSON.parse(await readFile(new URL('../artifacts/source-whitespace-before-runtime/before.json',import.meta.url))),verifierSha256:hash(await readFile(new URL(import.meta.url))),sheets,full},null,2)+'\n');
console.log(`${sheets.length} review sheets for ${changed.length} changed slides`);
