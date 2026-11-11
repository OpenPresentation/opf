import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {gzipSync,brotliCompressSync,constants} from 'node:zlib';
import {verifyBinding,verifyFiles,measuredInputs,assetAdmission,fileRecord} from './bindings.mjs';
import {FONT_CACHE_DIAGNOSTIC_VERSION,FONT_CACHE_TARGETS,assertFontCacheOwnershipSource} from './font-cache-diagnostics.mjs';

const root=process.cwd(),req=createRequire(path.join(root,'packages/editor/package.json')),{chromium}=req('playwright');
const smoke=process.argv.includes('--smoke'),measured=process.argv.includes('--measure'),cacheDiagnostics=process.argv.includes('--cache-diagnostics');
assert.notEqual(smoke,measured,'Choose exactly --smoke (functional only) or coordinator-authorized --measure');
const option=(name,fallback)=>process.argv.find(arg=>arg.startsWith(name+'='))?.slice(name.length+1)??fallback;
const site=path.resolve(root,option('--build','artifacts/owner-current-build-01'));
const output=path.resolve(root,option('--out',`artifacts/owner-current-${smoke?'smoke':'formal'}-01`));
const relative=path.relative(root,output);assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&!fs.existsSync(output),'Fresh owned output directory required');fs.mkdirSync(output,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const buildReceiptFile=path.join(site,'build-receipt.json'),buildReceiptRecord=fileRecord(root,buildReceiptFile);
const build=JSON.parse(fs.readFileSync(buildReceiptFile)),scope=cacheDiagnostics?'CACHE_RETENTION_DIAGNOSTIC_NOT_LATENCY_OR_LEAK_ACCEPTANCE':smoke?'FUNCTIONAL_NOT_TIMING':'MEASURED_CURRENT_CANDIDATE_NOT_VERSION_COMPARISON';
// Explicit roots replace the archived driver's machine-private Windows paths.
const inputDir=path.resolve(root,option('--inputs','artifacts/owner-performance-inputs'));
const assetSite=path.resolve(root,option('--assets','artifacts/owner-current-assets-01'));
assert.ok(fs.statSync(inputDir).isDirectory(),'Exact owner inputs are required');
assert.ok(fs.statSync(assetSite).isDirectory(),'Current maintained split-font assets are required');
const projectionArg=option('--projection',undefined),projectionFile=projectionArg?path.resolve(root,projectionArg):undefined;
const inputSelection=measuredInputs(root,inputDir,projectionFile),inputs=inputSelection.inputs;
assert.deepEqual(inputSelection.admission,build.projection,'Explicit raw/projection admission must equal the frozen build');
assert.deepEqual(inputSelection.inputFiles,build.inputFiles);
const prepared=assetAdmission(root,assetSite);assert.deepEqual(prepared.record,build.assets,'Prepared assets must be the frozen build inputs');
function verifyBuild(){
 assert.equal(build.cacheDiagnostics?.enabled,cacheDiagnostics,'Build/runner cache diagnostic flags differ');
 assert.equal(build.cacheDiagnostics.recipeVersion,FONT_CACHE_DIAGNOSTIC_VERSION,'Cache diagnostic recipe differs');
 if(cacheDiagnostics){assert.deepEqual(build.cacheDiagnostics.transforms.map(row=>row.name).sort(),[...FONT_CACHE_TARGETS].sort(),'Incomplete diagnostic overlay receipt');const owner=build.cacheDiagnostics.ownershipSource;assertFontCacheOwnershipSource(root,owner);verifyFiles(root,[{path:owner.path,bytes:owner.bytes,sha256:owner.sha256},...build.cacheDiagnostics.transforms.map(row=>row.original)]);}
 verifyFiles(root,[buildReceiptRecord]);verifyBinding(root,build.binding);verifyFiles(root,[build.buildDriver,...build.inputFiles,...build.outputs,...build.inputs,...build.compiler]);assert.deepEqual(measuredInputs(root,inputDir,projectionFile).admission,build.projection);assert.deepEqual(assetAdmission(root,assetSite).record,build.assets);}
verifyBuild();
const allowedResources=new Map([...build.outputs,...prepared.receipt.outputs].map(record=>[path.resolve(root,record.path),record]));
const requests=[],blocked=[],errors=[],assets=new Map(),cases=[],renderedVectors=new Map();let activeCase='setup';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.ttf':'font/ttf','.woff2':'font/woff2','.wasm':'application/wasm'};
const server=createServer((request,response)=>{try{
 const url=new URL(request.url,'http://127.0.0.1');if(url.pathname==='/favicon.ico'){response.writeHead(204).end();return;}
 const decoded=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);assert.ok(!decoded.includes('\\'));let file=path.resolve(site,'.'+decoded),rel=path.relative(site,file);assert.ok(!rel.startsWith('..')&&!path.isAbsolute(rel));
 if(!fs.existsSync(file))file=path.resolve(assetSite,rel);const declared=allowedResources.get(file);assert.ok(declared,'Resource is absent from the initial bound output inventory');const bytes=fs.readFileSync(file),sha256=hash(bytes);assert.equal(sha256,declared.sha256,'Resource differs from its initial provenance');assert.equal(bytes.length,declared.bytes);
 if(assets.has(file))assert.equal(assets.get(file),sha256,'served resource changed');else assets.set(file,sha256);
 requests.push({case:activeCase,path:url.pathname,method:request.method,bytes:bytes.length,sha256,hasCookie:!!request.headers.cookie,hasAuthorization:!!request.headers.authorization});
 response.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream','Cache-Control':'no-cache'}).end(bytes);
}catch(error){errors.push({case:activeCase,kind:'server',path:request.url,message:error.message});response.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
const bounded=async(promise,label,timeout=30000)=>{let timer;try{return await Promise.race([promise,new Promise((_resolve,reject)=>{timer=setTimeout(()=>reject(Error(`${timeout}ms fixed deadline: ${label}`)),timeout);})]);}finally{clearTimeout(timer);}};
const mapMetrics=result=>Object.fromEntries(result.metrics.map(item=>[item.name,item.value]));
const delta=(a,b)=>Object.fromEntries(Object.keys(b).filter(key=>a[key]!==undefined).map(key=>[key,b[key]-a[key]]));
function chartCell(deck){const charts=[];function walk(value,parts){if(!value||typeof value!=='object')return;if(value.chart)charts.push({chart:value.chart,path:parts,slideIndex:Number(parts[1])});for(const[key,child]of Object.entries(value))walk(child,[...parts,key]);}walk(deck,[]);for(const entry of charts){const dataset=entry.chart.data?.dataset,data=dataset?deck.datasets?.[dataset]:entry.chart.data;if(!Array.isArray(data?.rows))continue;for(let i=0;i<data.rows.length;i++)for(let j=1;j<data.rows[i].length;j++){const previous=data.rows[i][j];if(typeof previous==='number'&&Number.isFinite(previous))return{path:(dataset?['datasets',dataset,'rows',i,j]:[...entry.path,'chart','data','rows',i,j]).join('.'),previous,slideIndex:entry.slideIndex,dataset:dataset??null,dependentChartIndices:dataset?charts.filter(item=>item.chart.data?.dataset===dataset).map(item=>item.slideIndex):[entry.slideIndex]};}}throw Error('Fixed input has no numeric datum');}
async function gc(cdp){await cdp.send('HeapProfiler.collectGarbage');return{heap:await cdp.send('Runtime.getHeapUsage'),dom:await cdp.send('Memory.getDOMCounters')};}
// Read WeakRefs only after the original heap/DOM observation. The extra evaluation returns scalars, never owners.
async function retentionGc(session,checkpoint){
 assert.ok(cacheDiagnostics,'Diagnostic observation requires explicit opt-in');const observed=await gc(session.cdp);
 const start=performance.now(),diagnostic=await session.page.evaluate(checkpoint=>window.reviewTrial.fontCacheDiagnostics(checkpoint),checkpoint);
 return{...observed,cacheDiagnostic:diagnostic,diagnosticTransport:{roundTripMs:performance.now()-start,encodedBytes:Buffer.byteLength(JSON.stringify(diagnostic))}};
}

async function startCase(configuration){
 activeCase=configuration.name;verifyBuild();
 const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,args:['--js-flags=--expose-gc']});
 try {
 const context=await browser.newContext({viewport:configuration.viewport??{width:1440,height:900},deviceScaleFactor:1}),page=await context.newPage(),cdp=await context.newCDPSession(page);
 page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push({case:activeCase,kind:'page',message:error.stack??error.message}));
 await context.route(/^https?:/,route=>new URL(route.request().url()).origin===origin?route.continue():(blocked.push(route.request().url()),route.abort()));
 await cdp.send('Performance.enable');await cdp.send('Emulation.setCPUThrottlingRate',{rate:configuration.cpu});
 await bounded(page.goto(origin+'/index.html'),configuration.name+'/navigate',90000);await bounded(page.waitForFunction(()=>window.__browserPerfReady===true,undefined,{timeout:90000}),configuration.name+'/font-setup',90000);
 await page.evaluate(mode=>window.reviewTrial.setMode(mode),configuration.mode);
 const setup=await page.evaluate(()=>({fontSetupMs:window.__svgPerf.fontSetupMs,setupMs:window.__svgPerf.setupMs,fonts:window.browserPerf.fonts.registry.describeFaces()}));
 return{browser,context,page,cdp,setup,browserVersion:browser.version()};
 } catch(error) { await browser.close(); throw error; }
}
async function phase(session,configuration,name,action,payload,{primary=false,round=0}={}){
 const{page,cdp}=session,errorsBefore=errors.length,before=mapMetrics(await cdp.send('Performance.getMetrics')),domBefore=await cdp.send('Memory.getDOMCounters');
 const result=await bounded(page.evaluate(async({name,action,payload})=>{performance.mark('opf-start:'+name);const result=action==='mount'?await window.browserPerf.mount(payload):await window.browserPerf.operation(action,payload);performance.mark('opf-end:'+name);return result;},{name,action,payload}),configuration.name+'/'+name,action==='mount'?90000:30000);
 const after=mapMetrics(await cdp.send('Performance.getMetrics')),domAfter=await cdp.send('Memory.getDOMCounters');
 assert.equal(errors.length,errorsBefore);assert.deepEqual(result.errors,[]);assert.ok(result.canvasSvg>0,'real workspace SVG');assert.ok(result.cache.entries>0);assert.ok(result.cache.entries<=64&&result.cache.bytes<=result.cache.maxBytes);
 for(const call of result.calls)assert.equal(call.selected.length,call.outputs,'requested-slide log matches actual output');
 if(primary&&action==='set'){assert.ok(result.reviewChecks.length>0,'actual settled core review ran');if(configuration.mode==='cold')assert.equal(result.reviewChecks[0].beforeCache.entries,0,'public invalidate cold control');else assert.ok(result.reviewChecks[0].beforeCache.entries>0,'candidate begins with retained composition');}
 const oracle=await page.evaluate(()=>window.reviewTrial.oracle());assert.equal(oracle.same,true,'complete report equals public cold oracle');
 const svgs=await page.evaluate(()=>window.reviewTrial.outputs());svgs.sort((a,b)=>a.key.localeCompare(b.key));
 const svgHashes=svgs.map(item=>({key:item.key,bytes:Buffer.byteLength(item.svg),sha256:hash(item.svg)}));
 // This is one current candidate: cold-oracle report equality above remains mandatory; no cross-version speed claim or artificial opposite-mode pair is invented.
 const previousVector=renderedVectors.get(configuration.name)??new Map(),outputChanges={scope:'EMITTED_OUTPUTS_ONLY_NOT_FULL_DECK_INVALIDATION',changed:[],unchanged:[],previouslyUnknown:[]};
 for(const output of svgHashes){const slide=Number(output.key.split(':').at(-1)),previous=previousVector.get(slide);outputChanges[previous===undefined?'previouslyUnknown':previous===output.sha256?'unchanged':'changed'].push(slide);previousVector.set(slide,output.sha256);}renderedVectors.set(configuration.name,previousVector);
 const primaryLongTasks=Number.isFinite(result.phaseStart)?result.longTasks.map(item=>({...item,overlapMs:Math.max(0,Math.min(item.start+item.duration,result.phaseEnd)-Math.max(item.start,result.phaseStart))})).filter(item=>item.overlapMs>0):[];
 const document=await page.evaluate(()=>window.browserPerf.document()),compact=Buffer.from(JSON.stringify(document));
 const apiOperationBytes=action==='set'?Buffer.byteLength(JSON.stringify({method:'session.set',path:payload.path,value:payload.value})):null;
 const payloadStorage={scope:'ENCODED_SIZE_OUTSIDE_INTERVAL_NOT_PERSISTENCE_OR_WIRE_IO',compactDocumentBytes:compact.length,compactDocumentGzipBytes:gzipSync(compact).length,actualApiOperationEncodingBytes:apiOperationBytes,emittedSvgBytes:svgs.reduce((n,row)=>n+Buffer.byteLength(row.svg),0),emittedSvgGzipBytes:svgs.reduce((n,row)=>n+gzipSync(row.svg).length,0),emittedSvgBrotliQuality5Bytes:svgs.reduce((n,row)=>n+brotliCompressSync(Buffer.from(row.svg),{params:{[constants.BROTLI_PARAM_QUALITY]:5}}).length,0)};
 if(action==='sorter'){const direct=await bounded(page.evaluate(document=>window.browserPerf.systemControl(document),document),configuration.name+'/system-oracle',30000);assert.equal(result.sorterSvg,document.slides.length,'all requested sorter thumbnails are drawn');for(const output of svgHashes){const slide=Number(output.key.split(':').at(-1));assert.equal(output.sha256,direct.hashes.find(row=>row.slide===slide)?.sha256,'actual sorter SVG equals current direct system-text oracle');}}
 const postGc=await gc(cdp),row={name,primary,round,action,payloadStorage,outputChanges,payload:action==='mount'?{slides:payload.slides.length}:payload,...result,primaryLongTasks,oracle,svgHashes,svgs,cdpDelta:delta(before,after),domBefore,domAfter,postGc};
 console.log(JSON.stringify({scope,case:configuration.name,phase:name,primary,ms:row.elapsedMs,coreMs:row.reviewChecks.reduce((sum,item)=>sum+item.ms,0),rendererCalls:row.calls.length,requestedSlides:row.calls.reduce((sum,item)=>sum+item.selected.length,0),cacheEntries:row.cache.entries}));return row;
}
async function measuredCase(configuration){
 const session=await startCase(configuration),rows=[],traceEvents=[];let tracing=false;
 try{
  if(measured){session.cdp.on('Tracing.dataCollected',event=>traceEvents.push(...event.value));await session.cdp.send('Tracing.start',{categories:'devtools.timeline,blink.user_timing',transferMode:'ReportEvents'});tracing=true;}
  const deck=structuredClone(inputs[configuration.size].deck),cell=chartCell(deck);assert.ok(cell.dataset,'the edit is a real shared document dataset');if(configuration.size===36)assert.equal(cell.dependentChartIndices.length,2);assert.equal(typeof deck.slides[0].title,'string');
  rows.push(await phase(session,configuration,'setup:mount','mount',deck));
  rows.push(await phase(session,configuration,'setup:sorter','sorter'));
  rows.push(await phase(session,configuration,'setup:slide','slide'));
  const rounds=smoke?1:4;
  for(let round=0;round<rounds;round++){
   const primary=measured&&round>0,prefix=round===0?'warmup':`round-${round}`;
   rows.push(await phase(session,configuration,prefix+':navigate','navigate',0,{primary,round}));
   rows.push(await phase(session,configuration,prefix+':sorter','sorter',undefined,{primary,round}));
   rows.push(await phase(session,configuration,prefix+':slide','slide',undefined,{primary,round}));
   rows.push(await phase(session,configuration,prefix+':local-title0','set',{path:'slides.0.title',value:deck.slides[0].title+` — edit ${round}`},{primary,round}));
   await session.page.evaluate(async index=>{await window.browserPerf.operation('navigate',index);await window.reviewTrial.oracle();window.reviewTrial.outputs();},cell.slideIndex);
   rows.push(await phase(session,configuration,prefix+':shared-datum','set',{path:cell.path,value:cell.previous+round+1},{primary,round}));
   rows.push(await phase(session,configuration,prefix+':global-name','set',{path:'name',value:(deck.name??'Deck')+` — edit ${round}`},{primary,round}));
   if(round===0)await session.page.screenshot({path:path.join(output,configuration.name+'-warmup.png'),timeout:10000});
  }
  if(configuration.size===16){rows.push(await phase(session,configuration,'update:append-twenty','replace',structuredClone(inputs[36].deck)));rows.push(await phase(session,configuration,'update:append-sorter','sorter'));}
  const record={scope,status:'PASS',configuration,setup:session.setup,browserVersion:session.browserVersion,cell,rows};cases.push(record);fs.writeFileSync(path.join(output,configuration.name+'.json'),JSON.stringify(record,null,2)+'\n');
 }catch(error){fs.writeFileSync(path.join(output,configuration.name+'-failure.json'),JSON.stringify({scope,status:'FAILED',message:error.stack??String(error),rows},null,2));throw error;}
 finally{try{
  if(tracing){await bounded(new Promise(async resolve=>{session.cdp.once('Tracing.tracingComplete',resolve);await session.cdp.send('Tracing.end');}),configuration.name+'/trace-end',15000);fs.writeFileSync(path.join(output,configuration.name+'-trace.json.gz'),gzipSync(JSON.stringify({traceEvents})));}
 }finally{await session.browser.close();}
 }
}
async function soak(mode){
 const configuration={name:'retained-heap-'+mode,size:36,cpu:1,mode},session=await startCase(configuration),samples=[],deck=structuredClone(inputs[36].deck);
 try{
  await phase(session,configuration,'soak:warmup','mount',deck);
  const warmDisposed=await session.page.evaluate(()=>window.reviewTrial.dispose());assert.ok(warmDisposed.infos.length>0&&warmDisposed.infos.every(info=>info.entries===0&&info.bytes===0));
  const baseline=await (cacheDiagnostics?retentionGc(session,'warm-disposed'):gc(session.cdp));
  await phase(session,configuration,'soak:mount','mount',deck);
  samples.push({edit:0,cache:await session.page.evaluate(()=>window.browserPerf.snapshot().cache),...await (cacheDiagnostics?retentionGc(session,'edit-0'):gc(session.cdp))});
  for(let edit=0;edit<(smoke?3:200);edit++){
   await bounded(session.page.evaluate(async edit=>{await window.browserPerf.operation('set',{path:'slides.35.title',value:'Retained heap edit '+edit});},edit),'soak-edit',30000);
   if([20,40,80,120,200].includes(edit+1)||smoke){const oracle=await session.page.evaluate(()=>window.reviewTrial.oracle());assert.equal(oracle.same,true);const cache=await session.page.evaluate(()=>window.browserPerf.snapshot().cache);assert.ok(cache.entries<=64&&cache.bytes<=cache.maxBytes);samples.push({edit:edit+1,cache,...await (cacheDiagnostics?retentionGc(session,'edit-'+(edit+1)):gc(session.cdp))});await session.page.evaluate(()=>window.reviewTrial.outputs());}
  }
  const cycles=[];
  for(let cycle=0;cycle<(smoke?1:10);cycle++){
   const disposed=await session.page.evaluate(()=>window.reviewTrial.dispose());assert.ok(disposed.infos.length>0&&disposed.infos.every(info=>info.entries===0&&info.bytes===0));assert.equal(disposed.workspaces,0);assert.equal(disposed.fontFaces,warmDisposed.fontFaces,'repeated sessions do not duplicate prepared faces');
   cycles.push({cycle,disposed,...await (cacheDiagnostics?retentionGc(session,'destroy-'+cycle):gc(session.cdp))});
   if(cycle<(smoke?1:10)-1)await phase(session,configuration,'soak:remount-'+cycle,'mount',deck);
  }
  const record={scope:cacheDiagnostics?'CACHE_AND_WEAKREF_DIAGNOSTIC_NOT_LEAK_ACCEPTANCE':'BOUNDED_RETENTION_NOT_LEAK_ACCEPTANCE',...(cacheDiagnostics?{diagnosticBuild:build.cacheDiagnostics,ownership:'Shared fonts remain owned throughout; finally closes browser without an explicit fonts.dispose call.'}:{}),configuration,baseline,warmDisposed,samples,cycles,edits:smoke?3:200,mountDestroyCycles:smoke?1:10,browserVersion:session.browserVersion};fs.writeFileSync(path.join(output,configuration.name+'.json'),JSON.stringify(record,null,2)+'\n');return record;
 }finally{await session.browser.close();}
}
try{
 const cells=smoke?[{size:16,cpu:1,label:'desktop'}]:[16,36].flatMap(size=>[{size,cpu:1,label:'desktop'},{size,cpu:4,label:'desktop'},{size,cpu:4,label:'viewport390',viewport:{width:390,height:844}}]);
 for(const cell of cells)await measuredCase({...cell,name:`${cell.label}-cpu${cell.cpu}-${cell.size}-cached`,mode:'cached'});
 const retained=[await soak('cached')];
 assert.equal(errors.length,0,JSON.stringify(errors));assert.deepEqual(blocked,[]);verifyBuild();for(const[file,sha256]of assets)assert.equal(hash(fs.readFileSync(file)),sha256,'served asset remains byte exact: '+file);for(const input of Object.values(inputs))assert.equal(hash(fs.readFileSync(input.file)),input.sha256);
 const receipt={status:'PASS',scope,cacheDiagnostics:build.cacheDiagnostics,source:build.source,tree:build.tree,bundleSha256:build.bundleSha256,node:process.version,buildReceipt:buildReceiptRecord,binding:build.binding,projection:build.projection,assetProvenance:build.assets,assetsObserved:[...assets].map(([file,sha256])=>({path:path.relative(root,file),sha256})),assetCoverage:'Only observed served resources are browser-used; prepared unused outputs are bound, not qualified',inputFiles:Object.fromEntries(Object.entries(inputs).map(([size,input])=>[size,{rawBytes:input.bytes.length,rawSha256:input.sha256,measuredBytes:input.measuredBytes.length,measuredSha256:input.measuredSha256}])),cases:cases.map(item=>({configuration:item.configuration,rows:item.rows.length})),completeColdOracleChecks:cases.reduce((n,item)=>n+item.rows.length,0),retained:retained.map(item=>({configuration:item.configuration,edits:item.edits,mountDestroyCycles:item.mountDestroyCycles})),requests,blocked,errors,limits:{setupMs:90000,phaseMs:30000,traceEndMs:15000},disclosure:[...(cacheDiagnostics?['Opt-in cache/WeakRef registration and after-GC reads add recorded diagnostic overhead; this run does not establish latency or leak acceptance.']:[]),'One current candidate with public cold-oracle equality outside intervals; no historical/version speed comparison.','One fresh browser process per case;390px viewport and4xCPU are desktop proxies; no physical-mobile/low-power-device claim.','Debounce stays inside settled elapsed time; report/SVG equality, hashing, GC and storage are outside primary intervals. Sorter direct-oracle work primes caches outside intervals.','Trace/forwarder/observer overhead is present symmetrically; no unperturbed-production claim.','Cache policy bounds are logical; short post-GC heap/DOM soak is not leak acceptance.','Original root smoke is functional evidence only and is preserved separately; no invented root stdout.']};
 fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({status:'PASS',scope,cases:receipt.cases.length,completeColdOracleChecks:receipt.completeColdOracleChecks,output}));
}catch(error){fs.writeFileSync(path.join(output,'first-failure.json'),JSON.stringify({status:'FAILED',scope,message:error.stack??String(error),requests,blocked,errors},null,2)+'\n');console.error(error);process.exitCode=1;}
finally{await new Promise(resolve=>server.close(resolve));}
