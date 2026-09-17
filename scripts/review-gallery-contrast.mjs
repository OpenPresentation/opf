// Verify a narrowly authored color revision and both unpromoted raster corpora.
// Recreate the previous images from the recorded GitHub source checkpoints when
// moving computers; artifact directory names alone are never accepted as proof.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {examples} from '../packages/javascript/dist/examples.js';
import {scenarioSpecs} from './generate-example-suite.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const [beforeDirectory,afterDirectory,outputDirectory='artifacts/gallery-contrast-review']=process.argv.slice(2);
assert.ok(beforeDirectory&&afterDirectory,'Pass previous and current golden artifact directories.');
const beforeRoot=path.resolve(beforeDirectory),afterRoot=path.resolve(afterDirectory),output=path.resolve(outputDirectory);
const previousSource='7a625546a23ca8a0dbe5a0e87d5cc56daee224ac';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const before=await json(path.join(root,'docs/evidence/shared-metric-native-anchor/corpus-candidate.json'));
assert.deepEqual(await json(path.join(beforeRoot,'candidate.json')),before,'Previous candidate must match portable committed evidence.');
const after=await json(path.join(afterRoot,'candidate.json'));
assert.deepEqual(Object.keys(before.entries),Object.keys(after.entries),'Review additions/removals separately.');
for(const field of ['scale','format','systemFonts','version'])assert.deepEqual(after[field],before[field]);
const corpus=examples.map(({file,deck})=>({file:file.replace(/^examples\//,''),deck})).sort((a,b)=>a.file<b.file?-1:a.file>b.file?1:0);
const sourceRows=[],authoring=[];
const slots=new Set(['primary','secondary','accent','background','text','dark1','dark2','light1','light2']);
for(const {file,deck}of corpus){
 const previous=JSON.parse(execFileSync('git',['show',`${previousSource}:examples/${file}`],{cwd:root,encoding:'utf8',maxBuffer:20*1024*1024}));
 sourceRows.push([file,canonical(previous)]);
 const changes=[],outcome=scenarioSpecs.find(spec=>spec[1]===deck.name)?.[4].toLowerCase();
 const compare=(a,b,at=[],parentA,parentB)=>{
  if(JSON.stringify(canonical(a))===JSON.stringify(canonical(b)))return;
  const allowed=file.startsWith('gallery/')&&(
   (at.length===3&&at[0]==='design'&&at[1]==='colorScheme'&&slots.has(at[2]))||
   /^design\.background\.gradient\.stops\.\d+\.color$/.test(at.join('.'))||
   (outcome&&at[0]==='slides'&&at.at(-1)==='color'&&parentA?.text===outcome&&parentB?.text===outcome&&parentA?.bold===true&&parentB?.bold===true)
  );
  if(allowed){assert.match(b,/^#[0-9a-f]{6}$/i);changes.push({path:at.join('.'),before:a??null,after:b});return;}
  assert.ok(a&&b&&typeof a==='object'&&typeof b==='object',`${file}: unexpected authored change ${at.join('.')}`);
  assert.equal(Array.isArray(a),Array.isArray(b));
  for(const key of new Set([...Object.keys(a),...Object.keys(b)]))compare(a[key],b[key],[...at,key],a,b);
 };
 compare(previous,deck);
 assert.deepEqual(deck,await json(path.join(root,'examples',file)),'Built examples must match current source files.');
 if(changes.length)authoring.push({file,beforeSha256:hash(JSON.stringify(previous)),afterSha256:hash(JSON.stringify(deck)),changes});
}
assert.equal(hash(JSON.stringify(sourceRows)),before.source.sha256,'Prior GitHub checkpoint corpus binding');
assert.equal(hash(JSON.stringify(corpus.map(({file,deck})=>[file,canonical(deck)]))),after.source.sha256,'Current built/source corpus binding');
const rasters=[];
for(const [i,key]of Object.keys(after.entries).entries()){
 const file=`${String(i).padStart(4,'0')}.png`;
 for(const [directory,manifest]of [[beforeRoot,before],[afterRoot,after]]){
  const bytes=await readFile(path.join(directory,file));assert.equal(hash(bytes),manifest.entries[key].sha256,`${directory} ${key}`);assert.equal(bytes.length,manifest.entries[key].bytes);
 }
 if(before.entries[key].sha256!==after.entries[key].sha256)rasters.push({key,asset:file,beforeSha256:before.entries[key].sha256,afterSha256:after.entries[key].sha256});
}
await mkdir(output,{recursive:true});
await writeFile(path.join(output,'review.json'),JSON.stringify({previousSource,previousRenderer:'647368a481d316c390671fe4d33803cd08b933a6',harnessSha256:hash(await readFile(fileURLToPath(import.meta.url))),before:before.source,after:after.source,verifiedRastersPerCorpus:Object.keys(after.entries).length,authoredDecks:authoring.length,authoredColorChanges:authoring.reduce((n,deck)=>n+deck.changes.length,0),changedSlides:rasters.length,authoring,rasters,baselinePromoted:false,visualReviewComplete:false,scope:'Both sets of 805 PNG bytes match their manifests. Prior source is bound to a GitHub commit; current source matches built examples and its candidate digest. Authored changes are limited to enumerated palette slots, gradient stop colors and the original emphasized outcome run colors. Text, units, values, metadata and geometry are unchanged. Current raster differences also include the shared inherited table-color fix. This is integrity evidence, not a visual-quality or native-equivalence verdict.'},null,2)+'\n');
console.log(JSON.stringify({authoredDecks:authoring.length,changedSlides:rasters.length,verifiedRastersPerCorpus:Object.keys(after.entries).length,output}));
