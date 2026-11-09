import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {gzipSync,brotliCompressSync,constants} from 'node:zlib';
import {cpus,totalmem} from 'node:os';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const start=performance.now(),[size='16',mode='batch-fonts',runsArg='5',outputArg,fontVariant='demand']=process.argv.slice(2);
assert.ok(['16','36'].includes(size));
assert.ok(['batch-fonts','selected-default','selected-once','batch-system'].includes(mode));
const runs=Number(runsArg);assert.ok(Number.isInteger(runs)&&runs>=1&&runs<=20);
const input=readFileSync(new URL('inputs/'+(size==='16'?'original-16':'extended-36')+'.opf.json',import.meta.url));
const deck=JSON.parse(input),moduleStart=performance.now();
assert.ok(['whole','demand'].includes(fontVariant));
const runtimeRoot=process.env.OPF_DEMAND_RUNTIME??'C:/opf-work/demand-fonts';
const [{toSvg},{loadFonts},{gallery}]=await Promise.all([import(pathToFileURL(resolve(runtimeRoot,'packages/render/dist/index.js'))),import(pathToFileURL(resolve(runtimeRoot,'packages/render/dist/fonts-node.js'))),import(pathToFileURL(resolve(runtimeRoot,'packages/gallery/dist/index.js')))]);
const moduleMs=performance.now()-moduleStart,fontStart=performance.now();
const fontCpuStart=process.cpuUsage();const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',...(fontVariant==='demand'?{presentation:deck,scripts:'auto',renderOptions:{catalogs:[gallery]}}:{})});if(fontVariant==='whole')await fonts.ensure(deck,{renderOptions:{catalogs:[gallery]}});const fontMs=performance.now()-fontStart,fontCpu=process.cpuUsage(fontCpuStart);
const diagnostics=new Map(),options={fonts,catalogs:[gallery],...(mode==='batch-system'?{text:'system'}:{}),onDiagnostic:d=>diagnostics.set(JSON.stringify(d),d)};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const memory=()=>({...process.memoryUsage(),peakRssBytes:process.resourceUsage().maxRSS>0?process.resourceUsage().maxRSS*1024:null});
const render=()=>mode.startsWith('batch-')?toSvg(deck,options):deck.slides.map((_,i)=>toSvg(deck,i+1,{...options,...(mode==='selected-once'?{validate:i===0}:{})}));
globalThis.gc?.();const setupMemory=memory(),samples=[];let output,previousHashes;
for(let i=0;i<runs+1;i++){
 globalThis.gc?.();const before=memory(),cpuStart=process.cpuUsage(),wallStart=performance.now();
 output=render();const elapsedMs=performance.now()-wallStart,cpu=process.cpuUsage(cpuStart);
 assert.ok(Array.isArray(output));assert.equal(output.length,deck.slides.length);
 const afterRender=memory(),hashes=output.map(svg=>hash(svg));
 if(previousHashes)assert.deepEqual(hashes,previousHashes,'repeated equivalent renders are byte stable');previousHashes=hashes;
 const svgBytes=output.reduce((n,s)=>n+Buffer.byteLength(s),0);
 samples.push({kind:i===0?'first-render':'warm',elapsedMs,userCpuMs:cpu.user/1000,systemCpuMs:cpu.system/1000,svgBytes,before,afterRender});
}
const storageStart=performance.now(),storageCpu=process.cpuUsage();
const storage={svgBytes:output.reduce((n,s)=>n+Buffer.byteLength(s),0),gzipBytes:0,brotliQuality5Bytes:0,fontDataBytes:0,svgElements:0,perSlide:[]};
for(let i=0;i<output.length;i++){
 const svg=output[i],bytes=Buffer.from(svg),row={slide:i+1,bytes:bytes.length,gzipBytes:gzipSync(bytes).length,brotliQuality5Bytes:brotliCompressSync(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:5}}).length,elements:(svg.match(/<(?![!/?])[A-Za-z][^>]*>/g)||[]).length,fontDataBytes:0,sha256:previousHashes[i]};
 for(const match of svg.matchAll(/data:font\/[^;,'")]+;base64,([A-Za-z0-9+/=]+)/g))row.fontDataBytes+=Buffer.from(match[1],'base64').length;
 storage.gzipBytes+=row.gzipBytes;storage.brotliQuality5Bytes+=row.brotliQuality5Bytes;storage.fontDataBytes+=row.fontDataBytes;storage.svgElements+=row.elements;storage.perSlide.push(row);
}
storage.combinedGzipBytes=gzipSync(Buffer.from(output.join('\n'))).length;
const storageElapsedMs=performance.now()-storageStart,storageCpuUsage=process.cpuUsage(storageCpu);
output=null;globalThis.gc?.();const finalMemory=memory();
const warm=samples.slice(1).map(s=>s.elapsedMs).sort((a,b)=>a-b),warmMedianMs=warm.length%2?warm[(warm.length-1)/2]:(warm[warm.length/2-1]+warm[warm.length/2])/2;
const result={schema:1,status:'PASS',runtimeSource:'ed29f47f092aeefbde5fabac26d395f92c6b7823',fontVariant,comparison:'Same candidate runtime: explicit historical whole-pack path versus presentation-aware demand loading',size:Number(size),mode,runs,node:process.version,platform:process.platform,arch:process.arch,machine:{cpu:cpus()[0]?.model,logicalProcessors:cpus().length,totalMemoryBytes:totalmem()},inputBytes:input.length,inputSHA256:hash(input),authoredFontScheme:deck.design.fontScheme,fontPolicy:{pack:'office',substitutionPolicy:'visual',substitutions:fonts.substitutions??null},moduleMs,fontMs,fontCpuMs:{user:fontCpu.user/1000,system:fontCpu.system/1000},faceCount:fonts.registry.describeFaces().length,faces:fonts.registry.describeFaces(),fontFileCount:fonts.fontFiles.length,pending:fonts.pending(deck,{catalogs:[gallery]}),setupMemory,samples,warmMedianMs,warmMinMs:warm[0],warmMaxMs:warm.at(-1),storage,storageElapsedMs,storageCpuMs:{user:storageCpuUsage.user/1000,system:storageCpuUsage.system/1000},finalMemory,diagnostics:[...diagnostics.values()],totalCaseMs:performance.now()-start};
const out=outputArg?pathToFileURL(resolve(outputArg)):new URL('results/'+size+'-'+mode+'.json',import.meta.url);
mkdirSync(new URL('.',out),{recursive:true});writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'PASS',size:result.size,mode,warmMedianMs,firstRenderMs:samples[0].elapsedMs,fontMs,svgBytes:storage.svgBytes,gzipBytes:storage.gzipBytes,peakRssBytes:finalMemory.peakRssBytes,result:out.href}));
