import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {examples} from '../packages/javascript/dist/examples.js';
import {renderSvg,svgToPng} from '../../opf-render/dist/index.js';
const [beforeDir,currentDir,secondRuntimeDir,outputDir]=process.argv.slice(2).map(value=>path.resolve(value));
assert.ok(beforeDir&&currentDir&&secondRuntimeDir&&outputDir,'Pass previous, current, second-runtime golden directories and output.');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const before=await json(path.join(beforeDir,'candidate.json')),current=await json(path.join(currentDir,'candidate.json')),second=await json(path.join(secondRuntimeDir,'candidate.json'));
assert.deepEqual(current,second,'Node 20/24 corpus manifests must agree exactly');
for(const key of ['version','format','scale','systemFonts'])assert.deepEqual(current[key],before[key]);
const keys=Object.keys(current.entries);assert.equal(keys.length,805);assert.deepEqual(keys,Object.keys(before.entries));
const corpus=new Map(examples.map(({file,deck})=>[file.replace(/^examples\//,''),deck]));
const containsImage=value=>value&&typeof value==='object'&&(Object.keys(value).some(key=>['image','watermark','logo','slideImage'].includes(key))||Object.values(value).some(containsImage));
const changed=[];
for(const [index,key]of keys.entries()){
 const name=`${String(index).padStart(4,'0')}.png`;
 for(const [directory,manifest]of [[beforeDir,before],[currentDir,current],[secondRuntimeDir,second]])assert.equal(hash(await readFile(path.join(directory,name))),manifest.entries[key].sha256,`${directory}/${name}`);
 if(before.entries[key].sha256!==current.entries[key].sha256){assert.ok(containsImage(corpus.get(key.split('#')[0])),`${key}: image-free document changed`);changed.push({index,key,before:before.entries[key].sha256,after:current.entries[key].sha256});}
}
await mkdir(outputDir,{recursive:true});
const selected=[];
for(const index of [0,32,344,552,703,796]){
 const [file,slide]=keys[index].split('#'),diagnostics=[],svg=renderSvg(corpus.get(file),{slideIndex:Number(slide),trace:true,onDiagnostic:issue=>diagnostics.push(issue)}),png=await svgToPng(svg,{loadSystemFonts:false}),name=`full-${String(index).padStart(4,'0')}.png`;
 await writeFile(path.join(outputDir,name),png);selected.push({index,key:keys[index],file:name,pngSha256:hash(png),svgSha256:hash(svg),diagnostics});
}
await writeFile(path.join(outputDir,'review.json'),JSON.stringify({beforeSource:before.source,afterSource:current.source,beforeManifestSha256:hash(await readFile(path.join(beforeDir,'candidate.json'))),currentManifestSha256:hash(await readFile(path.join(currentDir,'candidate.json'))),verifierSha256:hash(await readFile(new URL(import.meta.url))),verifiedImagesPerPhase:keys.length,secondRuntimeVerifiedImages:keys.length,changed,selected,scope:'All 805 historical, current Node24 and current Node20 image hashes verified; both current manifests agree. Changed documents contain image-bearing fields. Exact asset-only authoring preservation is checked separately by test-gallery-artwork.mjs. Overview and selected full-size images support visual review; these checks do not approve a baseline or establish native/browser raster equivalence.'},null,2)+'\n');
console.log(JSON.stringify({verifiedImages:keys.length*3,changed:changed.length,selected:selected.length,output:outputDir}));
