import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {gzipSync,brotliCompressSync,constants} from 'node:zlib';
import {cpus,totalmem} from 'node:os';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const start=performance.now(),[size='16',mode='batch-fonts',runsArg='5',outputArg]=process.argv.slice(2);
assert.ok(['16','36'].includes(size));
assert.ok(['batch-fonts','batch-no-open','batch-office-only'].includes(mode));
const runs=Number(runsArg);assert.ok(Number.isInteger(runs)&&runs>=1&&runs<=20);
const input=readFileSync(new URL('inputs/'+(size==='16'?'original-16':'extended-36')+'.opf.json',import.meta.url));
const deck=JSON.parse(input),moduleStart=performance.now();
const [{toSvg},{loadFonts},{gallery}]=await Promise.all([import('../../../../packages/render/dist/index.js'),import('../../../../packages/render/dist/fonts-node.js'),import('../../../../packages/gallery/dist/index.js')]);
const moduleMs=performance.now()-moduleStart,fontStart=performance.now();
const beforeFontMemory={...process.memoryUsage(),peakRssBytes:process.resourceUsage().maxRSS*1024};
const fontOptions={pack:'office',substitutionPolicy:'visual',...(mode==='batch-no-open'?{includeOpenFonts:false}:{}),...(mode==='batch-office-only'?{includeOpenFonts:false,includeBaseFonts:false}:{})};
const fonts=await loadFonts(fontOptions),fontMs=performance.now()-fontStart;
const fontFaces=fonts.registry.describeFaces(),fontInputBytes=fonts.registry.exportFaces().reduce((n,f)=>n+f.data.byteLength,0);
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
const result={schema:1,status:'PASS',runtimeSource:'58e0d7939fc318119f5f81a8ba1455bbfab7f1cd',size:Number(size),mode,runs,node:process.version,platform:process.platform,arch:process.arch,machine:{cpu:cpus()[0]?.model,logicalProcessors:cpus().length,totalMemoryBytes:totalmem()},inputBytes:input.length,inputSHA256:hash(input),fontOptions,beforeFontMemory,fontFaces,fontInputBytes,authoredFontScheme:deck.design.fontScheme,fontPolicy:{pack:'office',substitutionPolicy:'visual',substitutions:fonts.substitutions??null},moduleMs,fontMs,setupMemory,samples,warmMedianMs,warmMinMs:warm[0],warmMaxMs:warm.at(-1),storage,storageElapsedMs,storageCpuMs:{user:storageCpuUsage.user/1000,system:storageCpuUsage.system/1000},finalMemory,diagnostics:[...diagnostics.values()],totalCaseMs:performance.now()-start};
const out=outputArg?pathToFileURL(resolve(outputArg)):new URL('results/'+size+'-'+mode+'.json',import.meta.url);
mkdirSync(new URL('.',out),{recursive:true});writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'PASS',size:result.size,mode,warmMedianMs,firstRenderMs:samples[0].elapsedMs,fontMs,svgBytes:storage.svgBytes,gzipBytes:storage.gzipBytes,peakRssBytes:finalMemory.peakRssBytes,result:out.href}));
