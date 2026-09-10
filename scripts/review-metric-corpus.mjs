// Review current metric corpus changes against a verified prior registry install.
// Never modifies the installed packages or promotes a golden baseline.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {renderSvg,svgToPng} from '../../opf-render/dist/index.js';
import {examples} from '../packages/javascript/dist/examples.js';
const root=fileURLToPath(new URL('../',import.meta.url));
assert.ok(process.argv[2],'Provide the preserved actual registry consumer');
assert.ok(!/loader|register-local-opf/.test(process.env.NODE_OPTIONS??''),'A source loader invalidates the baseline');
const consumer=await realpath(process.argv[2]),output=path.resolve(process.argv[3]??path.join(root,'artifacts/metric-corpus-review'));
const hash=b=>createHash('sha256').update(b).digest('hex'),load=async f=>JSON.parse(await readFile(f,'utf8'));
const registry=await load(path.join(root,'docs/evidence/shared-code-complete/registry-code-node24.json'));
let verifiedFiles=0;
for(const name of ['@openpresentation/opf','@openpresentation/opf-render']){
  const record=registry.packages.find(p=>p.name===name);assert.ok(record);
  for(const [file,expected]of Object.entries(record.files)){
    const actual=await realpath(path.join(consumer,'node_modules',name,file));assert.ok(actual.startsWith(consumer+path.sep));
    assert.equal(hash(await readFile(actual)),expected,name+'/'+file);verifiedFiles++;
  }
}
const prior=await import(pathToFileURL(path.join(consumer,'node_modules/@openpresentation/opf-render/dist/index.js')));
const {examples:priorExamples}=await import(pathToFileURL(path.join(consumer,'node_modules/@openpresentation/opf/dist/examples.js')));
const baseline=await load(path.join(root,'scripts/fixtures/opf-examples-png.shared-code.sha256.json'));
const current=await load(path.resolve(process.argv[4]??path.resolve(root,'../opf-render/artifacts/golden/candidate.json')));
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const corpusHash=items=>hash(JSON.stringify(items.map(({file,deck})=>[file.replace(/^examples\//,''),canonical(deck)]).sort(([a],[b])=>a<b?-1:a>b?1:0)));
assert.equal(corpusHash(priorExamples),baseline.source.sha256,'Prior registry corpus must reproduce the prior manifest');
assert.equal(corpusHash(examples),current.source.sha256,'Current corpus must reproduce the candidate manifest');
assert.equal(current.scale,baseline.scale);assert.equal(current.systemFonts,baseline.systemFonts);
assert.deepEqual(Object.keys(current.entries),Object.keys(baseline.entries),'Review additions/removals separately');
const changed=Object.keys(current.entries).filter(key=>JSON.stringify(current.entries[key])!==JSON.stringify(baseline.entries[key]));
await mkdir(output,{recursive:true});const results=[];
const metricCount=value=>value&&typeof value==='object'?(Array.isArray(value)?value.reduce((n,item)=>n+metricCount(item),0):Object.entries(value).reduce((n,[key,item])=>n+(key==='metric'?1:metricCount(item)),0)):0;
for(const [i,key]of changed.entries()){
  const [filename,number]=key.split('#'),slideIndex=Number(number),deck=examples.find(item=>item.file==='examples/'+filename)?.deck,oldDeck=priorExamples.find(item=>item.file==='examples/'+filename)?.deck;assert.ok(deck,key);assert.ok(oldDeck,key);
  const count=metricCount(deck.slides[slideIndex]);assert.ok(count>0,key+' changed without a metric');
  const authoredChanges=[];
  const compareSources=(before,after,at='slide')=>{
    if(JSON.stringify(canonical(before))===JSON.stringify(canonical(after)))return;
    if(at.endsWith('.metric')){authoredChanges.push({path:at,before,after});return;}
    assert.ok(before&&after&&typeof before==='object'&&typeof after==='object',key+' non-metric source change '+at);
    assert.deepEqual(Object.keys(before).sort(),Object.keys(after).sort(),key+' non-metric shape change '+at);
    for(const field of Object.keys(before))compareSources(before[field],after[field],at+'.'+field);
  };
  compareSources(oldDeck.slides[slideIndex],deck.slides[slideIndex]);
  const oldSvg=prior.renderSvg(oldDeck,{slideIndex,trace:true}),newSvg=renderSvg(deck,{slideIndex,trace:true});
  const before=await prior.svgToPng(oldSvg,{scale:baseline.scale,loadSystemFonts:false}),after=await svgToPng(newSvg,{scale:current.scale,loadSystemFonts:false});
  assert.equal(hash(before),baseline.entries[key].sha256,key+' previous registry raster');assert.equal(hash(after),current.entries[key].sha256,key+' current source raster');
  const prefix=String(i).padStart(3,'0');await writeFile(path.join(output,prefix+'-before.png'),before);await writeFile(path.join(output,prefix+'-after.png'),after);
  if(filename.startsWith('technical/')){await writeFile(path.join(output,prefix+'-before-full.png'),await prior.svgToPng(oldSvg));await writeFile(path.join(output,prefix+'-after-full.png'),await svgToPng(newSvg));}
  results.push({key,metricCount:count,prefix,beforeSha256:hash(before),afterSha256:hash(after),authoredChanges});
}
const sheets=[];
for(let offset=0;offset<results.length;offset+=10){
  const rows=results.slice(offset,offset+10),parts=[];
  for(const [i,row]of rows.entries()){
    const x=(i%2)*650,y=Math.floor(i/2)*220;
    for(const [j,state]of ['before','after'].entries()){
      const bytes=await readFile(path.join(output,row.prefix+'-'+state+'.png'));
      parts.push(`<image x="${x+j*320}" y="${y+22}" width="320" height="180" href="data:image/png;base64,${bytes.toString('base64')}"/>`);
    }
    parts.push(`<text x="${x+4}" y="${y+15}" font-family="Roboto" font-size="13">${row.prefix}: before / after; ${row.metricCount} metrics</text>`);
  }
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1300" height="1100"><rect width="100%" height="100%" fill="#ddd"/>${parts.join('')}</svg>`;
  const file=`sheet-${offset/10}.png`,bytes=await svgToPng(svg);await writeFile(path.join(output,file),bytes);sheets.push({file,sha256:hash(bytes)});
}
await writeFile(path.join(output,'review.json'),JSON.stringify({verifiedPriorRegistryFiles:verifiedFiles,priorSource:baseline.source,currentSource:current.source,changedSlides:changed.length,authoredMetricChanges:results.reduce((n,item)=>n+item.authoredChanges.length,0),allChangesContainMetrics:true,baselinePromoted:false,results,sheets,scope:'All prior and current changed rasters reproduce their respective manifests using their respective source corpora. Each changed slide contains metric content; any authored changes to those slides are confined to recorded metric payloads. Visual review must still evaluate arrangement and readability. No baseline is promoted by this helper.'},null,2)+'\n');
console.log(`Prepared ${changed.length} before/after pairs in ${sheets.length} sheets; verified ${verifiedFiles} prior registry files; baseline unchanged.`);
