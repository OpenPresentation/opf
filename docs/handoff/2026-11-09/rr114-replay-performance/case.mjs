// Explicitly measured only via the frozen coordinator-authorized runner.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {createRequire,registerHooks} from 'node:module';
import {performance} from 'node:perf_hooks';
import {resolve,join,dirname,basename} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {cpus,totalmem,release} from 'node:os';
import {RUNTIMES,INPUT_ROOT,FACE_KEYS} from './config.mjs';
import {sha,normalized,describeBackendAssets} from './shared.mjs';
const arg=name=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3);
assert.ok(process.argv.includes('--measure'),'explicit --measure required');
assert.match(process.version,/^v24\./);assert.equal(typeof globalThis.gc,'function','--expose-gc required');
const variant=arg('runtime'),size=Number(arg('size')),output=resolve(arg('out'));
assert.ok(RUNTIMES[variant]);assert.ok([16,36].includes(size));
const preflightBytes=readFileSync(resolve(arg('preflight'))),preflightSha256=sha(preflightBytes);
assert.match(arg('expected-preflight-sha256')??'',/^[a-f0-9]{64}$/);assert.equal(preflightSha256,arg('expected-preflight-sha256'),'exact runner preflight bytes');
const preflight=JSON.parse(preflightBytes),runtime=preflight.runtimes[variant];
assert.deepEqual({root:runtime.root,head:runtime.head,runtime:runtime.runtime},RUNTIMES[variant]);
const inputEntry=preflight.inputs.files.find(row=>row.size===size),input=readFileSync(join(INPUT_ROOT,inputEntry.name));
assert.equal(sha(input),inputEntry.sha256);const deck=JSON.parse(input);assert.equal(deck.slides.length,size);
const loaded=new Set();
registerHooks({load(url,context,next){const result=next(url,context);if(url.startsWith('file:'))loaded.add(url);return result;}});
const fontModuleURL=pathToFileURL(join(runtime.root,'packages/render/dist/fonts-node.js'));
const [{loadFonts},{toSvg},{gallery}]=await Promise.all([
  import(fontModuleURL),import(pathToFileURL(join(runtime.root,'packages/render/dist/index.js'))),import(pathToFileURL(join(runtime.root,'packages/gallery/dist/index.js'))),
]);
const memory=()=>({...process.memoryUsage(),maxRssBytes:process.resourceUsage().maxRSS*1024});
const cpu=value=>({userMs:value.user/1000,systemMs:value.system/1000,totalMs:(value.user+value.system)/1000});
globalThis.gc();
const baselinePostGc=memory(),prepareCpuStart=process.cpuUsage(),prepareStart=performance.now();
const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:deck,renderOptions:{catalogs:[gallery]}});
const prepareEnd=performance.now(),preparationMs=prepareEnd-prepareStart,preparationCpu=cpu(process.cpuUsage(prepareCpuStart));
const afterPreparation=memory();
function renderThreeBatches(){
 const samples=[],outputs=[];
 for(let index=0;index<3;index++){
  if(index>0)globalThis.gc(); // Outside each warm interval; no forced GC between preparation and first rendering.
  const before=memory(),cpuStart=process.cpuUsage(),start=performance.now();
  const svgs=toSvg(deck,{fonts,catalogs:[gallery]});
  const end=performance.now(),elapsedMs=end-start,renderCpu=cpu(process.cpuUsage(cpuStart));
  const after=memory(); // Immediately after return, before hashing, JSON, storage or evidence file reads.
  assert.ok(Array.isArray(svgs));assert.equal(svgs.length,size);
  outputs.push(svgs);samples.push({kind:index===0?'first':'warm',elapsedMs,cpu:renderCpu,before,after,...(index===0?{continuousPreparationToFirstMs:end-prepareStart}:{})});
}
 return {outputs,samples,finalRenderMemory:memory()}; // True process HWM before any evidence work.
}
let {outputs,samples,finalRenderMemory}=renderThreeBatches();
function validateOutputs(values){
  let hashes,bytes;
  for(const svgs of values){const current=svgs.map(svg=>sha(svg));if(!hashes){hashes=current;bytes=svgs.reduce((sum,svg)=>sum+Buffer.byteLength(svg),0);}else assert.deepEqual(current,hashes,'all three rendered batches byte-equivalent');}
  return {hashes,bytes};
}
const validated=validateOutputs(outputs); // All timing and first/final render HWM metrics above are already fixed.
outputs=null; // No SVG content is retained by any result/sample/closure.
globalThis.gc();
const postDropGc=memory(); // Fonts/deck/caches and a small common hash vector remain; no SVG arrays/strings.
// Evidence work below cannot replace the earlier HWM/current-memory observations.
const faces=fonts.registry.describeFaces({selection:true});assert.deepEqual(faces.map(face=>[face.family,face.weight,!!face.italic].join('/')).sort(),FACE_KEYS);
assert.equal(fonts.fontFiles.length,3);assert.deepEqual(fonts.pending(deck,{catalogs:[gallery]}),[]);
const require=createRequire(fontModuleURL),fontRecords=[];
for(const file of fonts.fontFiles){
  const actual=realpathSync(file),matches=[];
  for(const pkg of fonts.manifest.packages)for(const face of pkg.faces){
    if(basename(face.file)!==basename(file))continue;
    let directory;try{directory=pkg.vendored?join(runtime.root,'packages/render',pkg.vendored):dirname(require.resolve(pkg.name+'/package.json'));}catch{continue;}
    const expected=join(directory,face.file);if(realpathSync(expected).toLowerCase()!==actual.toLowerCase())continue;
    matches.push({pkg,face,directory});
  }
  assert.equal(matches.length,1,'unique manifest-selected font');const {pkg,face,directory}=matches[0],fontData=readFileSync(file),license=readFileSync(join(directory,pkg.licenseFile));
  assert.equal(sha(fontData),face.sha256);assert.equal(sha(license),pkg.licenseSha256);
  const notice=pkg.noticeFile?readFileSync(join(directory,pkg.noticeFile)):undefined;if(notice)assert.equal(sha(notice),pkg.noticeSha256);
  fontRecords.push({package:pkg.name,version:pkg.version??null,family:face.family,weight:face.weight,italic:!!face.italic,file:normalized(runtime.root,file),bytes:fontData.length,sha256:sha(fontData),license:pkg.license,licenseFile:pkg.licenseFile,licenseSha256:sha(license),noticeFile:pkg.noticeFile??null,noticeSha256:notice?sha(notice):null});
}
const loadedModules=[...loaded].map(url=>{const file=realpathSync(fileURLToPath(url)),data=readFileSync(file);return{file:normalized(runtime.root,file),bytes:data.length,sha256:sha(data)};}).sort((a,b)=>a.file.localeCompare(b.file));
const dependencyAssets=describeBackendAssets(runtime.root);
assert.deepEqual(dependencyAssets,runtime.backendAssets,'exact source-bound HarfBuzz binary identities');
const backendAvailability={subsetEngineAvailable:Boolean(fonts.subsets),outlineProviderAvailable:Boolean(fonts.outlines),shaperState:'not separately exposed by handle'};
const result={schema:1,status:'PASS',variant,size,node:process.version,versions:process.versions,platform:process.platform,arch:process.arch,machine:{cpu:cpus()[0]?.model,logicalProcessors:cpus().length,totalMemoryBytes:totalmem(),release:release()},runtime:{root:runtime.root,head:runtime.head,tree:runtime.tree,runtime:runtime.runtime},preflightSha256,inputSha256:sha(input),fontMode:'office/visual/scripts:auto/presentation/catalogs',faceCount:faces.length,faces,fontRecords,preparationMs,preparationCpu,prepPlusFirstMs:preparationMs+samples[0].elapsedMs,continuousPreparationToFirstMs:samples[0].continuousPreparationToFirstMs,prepPlusFirstCpuMs:preparationCpu.totalMs+samples[0].cpu.totalMs,baselinePostGc,afterPreparation,firstRenderMemory:samples[0].after,finalRenderMemory,postDropGc,samples,hashes:validated.hashes,svgBytes:validated.bytes,loadedModules,dependencyAssets,backendAvailability,protocol:'Uninstrumented product functions; URL observation only. First/final render HWM captured before output hashing. Three SVG batches retained until validation; all SVG refs dropped before GC/post-drop heap; then module/font/license evidence. No compression.'};
writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'PASS',variant,size,faces:faces.length,preparationMs,firstMs:samples[0].elapsedMs,prepPlusFirstMs:result.prepPlusFirstMs,firstMaxRssBytes:result.firstRenderMemory.maxRssBytes,finalRenderMaxRssBytes:finalRenderMemory.maxRssBytes,postDropHeapUsed:postDropGc.heapUsed}));
