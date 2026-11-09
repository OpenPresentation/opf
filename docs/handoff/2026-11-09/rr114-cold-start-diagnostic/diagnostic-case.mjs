import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {installDiagnostic,runtimeSource,builtSource} from './diagnostic-loader.mjs';

const[runtimeArg,sizeArg,variant,inputDirectory,expectedFile,outputFile]=process.argv.slice(2);
assert.equal(process.argv.length,8,'six explicit arguments');
assert.match(process.version,/^v24[.]/);
const size=Number(sizeArg);assert.ok([16,36].includes(size));
assert.ok(['whole','demand'].includes(variant));
const runtimeRoot=realpathSync(runtimeArg),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const inputNames={16:'original-16.opf.json',36:'extended-36.opf.json'};
const inputHashes={16:'e14be44e63a8bbe4e64c5bdd2b6d95194ed39dc5e67c09c5a6a1225d13396a29',36:'249a8912ce59d7d55988d04b41909033017eb285b239960cb7fba6fab8d62599'};
const input=readFileSync(path.join(inputDirectory,inputNames[size]));
assert.equal(sha(input),inputHashes[size]);
const deck=JSON.parse(input),expected=JSON.parse(readFileSync(expectedFile,'utf8'))[size];
assert.equal(expected.length,size);
const diagnostic=installDiagnostic(runtimeRoot),d=diagnostic.collector;
const result={
  schema:1,kind:'INSTRUMENTED_DIAGNOSTIC',runtimeSource,builtSource,
  runtimeRoot,size,variant,node:process.version,started:new Date().toISOString(),
  input:{file:inputNames[size],bytes:input.length,sha256:sha(input)},
  protocol:'Same reviewed runtime; diagnostic-only in-memory loader. No optimization. Inclusive nested/concurrent phases are not additive. Four configurations, once each; unchanged batch-fonts options; first+two warm;45s external child deadline.',
  status:'RUNNING',samples:[]
};
const memory=()=>({...process.memoryUsage(),peakRssBytes:process.resourceUsage().maxRSS*1024});
let fonts;
try{
  d.setPhase('moduleImport');
  const moduleStart=performance.now();
  const[{toSvg},{loadFonts},{gallery}]=await Promise.all([
    import(pathToFileURL(path.join(runtimeRoot,'packages/render/dist/index.js'))),
    import(pathToFileURL(path.join(runtimeRoot,'packages/render/dist/fonts-node.js'))),
    import(pathToFileURL(path.join(runtimeRoot,'packages/gallery/dist/index.js')))
  ]);
  result.moduleMs=performance.now()-moduleStart;
  diagnostic.verifyLoaded();
  d.setPhase('fontPreparation');
  const fontStart=performance.now(),fontCpuStart=process.cpuUsage();
  fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',...(variant==='demand'?{presentation:deck,scripts:'auto',renderOptions:{catalogs:[gallery]}}:{})});
  if(variant==='whole')await fonts.ensure(deck,{renderOptions:{catalogs:[gallery]}});
  result.fontMs=performance.now()-fontStart;
  const fontCpu=process.cpuUsage(fontCpuStart);result.fontCpuMs={user:fontCpu.user/1000,system:fontCpu.system/1000};
  result.faceCount=fonts.registry.describeFaces().length;
  result.faces=fonts.registry.describeFaces();
  result.fontFileCount=fonts.fontFiles.length;
  assert.equal(result.faceCount,variant==='demand'?3:131);
  assert.equal(result.fontFileCount,result.faceCount);
  const diagnostics=new Map(),options={fonts,catalogs:[gallery],onDiagnostic:value=>diagnostics.set(JSON.stringify(value),value)};
  d.setPhase('outsideTimedRender');globalThis.gc?.();result.setupMemory=memory();
  let previous;
  for(let index=0;index<3;index++){
    d.setPhase('outsideTimedRender');globalThis.gc?.();
    d.setPhase(index===0?'firstRender':'warmRender'+index);
    const before=memory(),cpuStart=process.cpuUsage(),start=performance.now();
    const output=toSvg(deck,options);
    const elapsedMs=performance.now()-start,cpu=process.cpuUsage(cpuStart),after=memory();
    d.setPhase('hashVerification');
    assert.ok(Array.isArray(output));assert.equal(output.length,size);
    const hashes=output.map(sha);
    assert.deepEqual(hashes,expected,'every SVG equals accepted uninstrumented baseline');
    if(previous)assert.deepEqual(hashes,previous,'all repeated renders are identical');
    previous=hashes;
    result.samples.push({kind:index===0?'first-render':'warm',index,elapsedMs,cpuMs:{user:cpu.user/1000,system:cpu.system/1000},before,after,hashes,svgBytes:output.reduce((n,svg)=>n+Buffer.byteLength(svg),0)});
  }
  d.setPhase('postMeasurementPending');
  result.pending=fonts.pending(deck,{catalogs:[gallery]});
  assert.deepEqual(result.pending,[]);
  result.diagnostics=[...diagnostics.values()];
  d.setPhase('finalOutsideTiming');globalThis.gc?.();result.finalMemory=memory();
  result.status='PASS';
}catch(error){
  result.status='FAIL';result.failure={name:error.name,message:error.message,stack:error.stack,code:error.code};
  process.exitCode=1;
}finally{
  result.finished=new Date().toISOString();
  result.moduleTransforms=diagnostic.loadedModules;
  result.diagnostic=d.snapshot();
  diagnostic.close();
  writeFileSync(outputFile,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:result.status,size,variant,faceCount:result.faceCount,fontMs:result.fontMs,firstRenderMs:result.samples[0]?.elapsedMs,outputFile}));
}
