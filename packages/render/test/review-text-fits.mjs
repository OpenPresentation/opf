import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {examples} from '@openpresentation/opf/examples';
import {renderSvg,resolvePresentation,svgToPng} from '../dist/index.js';
const root=fileURLToPath(new URL('../',import.meta.url)),[previousDir,currentDir,output]=process.argv.slice(2).map(value=>path.resolve(value));
assert.ok(previousDir&&currentDir&&output,'Pass previous/current corpus and new output directories.');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),ref='053edb1797fd367ae401885fc1d2a8667f212e2d';
const previousSource=execFileSync('git',['show',`${ref}:src/svg.js`],{cwd:root});
await mkdir(path.join(root,'artifacts'),{recursive:true});
const moduleDir=await mkdtemp(path.join(root,'artifacts','accepted-fit-review-'));
const modulePath=path.join(moduleDir,'previous-svg.mjs');await writeFile(modulePath,previousSource);
const previous=await import(pathToFileURL(modulePath));
const before=JSON.parse(await readFile(path.join(previousDir,'candidate.json'),'utf8')),after=JSON.parse(await readFile(path.join(currentDir,'candidate.json'),'utf8'));
assert.deepEqual(before.source,after.source);
const corpus=new Map(examples.map(({file,deck})=>[file.replace(/^examples\//,''),deck])),results=[];
const texts=svg=>{
  const records=new Map();
  for(const [,attrs,text]of svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const attr=name=>new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1],key=attr('data-opf-path')??'rich-or-internal';
    if(!records.has(key))records.set(key,[]);records.get(key).push({text,size:Number(attr('font-size')),x:attr('x'),y:attr('y'),attrs});
  }
  return records;
};
for(const [key,entry]of Object.entries(after.entries)) {
  if(entry.sha256===before.entries[key].sha256)continue;
  const [file,index]=key.split('#'),deck=corpus.get(file),options={trace:true,slideIndex:Number(index)};
  const oldBound=previous.resolvePresentation(deck,options).slides[Number(index)],bound=resolvePresentation(deck,options).slides[Number(index)];
  assert.deepEqual(bound.geometry,oldBound.geometry,`${key}: composition changed`);
  const oldSvg=previous.renderSvg(deck,options),svg=renderSvg(deck,options);
  assert.equal(hash(await svgToPng(oldSvg,{scale:.25,loadSystemFonts:false})),before.entries[key].sha256,key);
  assert.equal(hash(await svgToPng(svg,{scale:.25,loadSystemFonts:false})),entry.sha256,key);
  const oldTexts=texts(oldSvg),newTexts=texts(svg),changes=[];
  for(const sourcePath of new Set([...oldTexts.keys(),...newTexts.keys()])) {
    const oldLines=oldTexts.get(sourcePath),newLines=newTexts.get(sourcePath);
    if(JSON.stringify(oldLines)===JSON.stringify(newLines))continue;
    const item=bound.geometry.items.find(item=>item.path===sourcePath);
    assert.ok(item?.text,`${key}: a non-text or untraced payload changed`);
    assert.ok(newLines.every(line=>Math.abs(line.size-item.text.fontSize)<.001));
    assert.equal(oldLines.map(line=>line.text).join(' ').replace(/\s+/g,' '),newLines.map(line=>line.text).join(' ').replace(/\s+/g,' '),`${key}: words changed`);
    changes.push({path:sourcePath,box:item.box,acceptedSize:item.text.fontSize,before:oldLines,after:newLines});
  }
  assert.ok(changes.length);results.push({key,compositionUnchanged:true,changes});
}
await mkdir(output,{recursive:true});
const report={node:process.version,previousRef:ref,previousSourceSha256:hash(previousSource),currentSourceSha256:hash(await readFile(new URL('../dist/svg.js',import.meta.url))),
  verifierSha256:hash(await readFile(new URL(import.meta.url))),source:after.source,results,
  scope:'Reproduces both historical and current default-font rasters for every changed slide. Composition is identical; changed traced text uses its accepted font size and preserves normalized words. This isolates a second fitting pass from layout changes. It does not certify estimated font widths, original whitespace, native export or visual quality.'};
await writeFile(path.join(output,'fit-review.json'),JSON.stringify(report,null,2)+'\n');
console.log(`Accepted-fit review: ${results.length} changed rasters reproduced on both source versions; composition and normalized words unchanged.`);
