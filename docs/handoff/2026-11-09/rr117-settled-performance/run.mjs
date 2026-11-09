import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';

const root=process.cwd(),req=createRequire(path.join(root,'packages/editor/package.json')),{chromium}=req('playwright');
const smoke=process.argv.includes('--smoke'),measured=process.argv.includes('--measure');
assert.notEqual(smoke,measured,'Choose exactly --smoke (functional only) or coordinator-authorized --measure');
const option=(name,fallback)=>process.argv.find(arg=>arg.startsWith(name+'='))?.slice(name.length+1)??fallback;
const site=path.resolve(root,option('--build','artifacts/review-paired-build-01'));
const output=path.resolve(root,option('--out',`artifacts/review-paired-${smoke?'smoke':'formal'}-01`));
const relative=path.relative(root,output);assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&!fs.existsSync(output),'Fresh owned output directory required');fs.mkdirSync(output,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const build=JSON.parse(fs.readFileSync(path.join(site,'build-receipt.json'))),scope=smoke?'FUNCTIONAL_NOT_TIMING':'MEASURED_SAME_CANDIDATE';
const inputDir='C:/opf-work/perf-svg/docs/handoff/2026-11-09/svg-performance/inputs',assetSite='C:/opf-work/svg-browser/artifacts/browser/site';
const expected={16:'e14be44e63a8bbe4e64c5bdd2b6d95194ed39dc5e67c09c5a6a1225d13396a29',36:'249a8912ce59d7d55988d04b41909033017eb285b239960cb7fba6fab8d62599'};
const inputs=Object.fromEntries([16,36].map(size=>{const file=path.join(inputDir,size===16?'original-16.opf.json':'extended-36.opf.json'),bytes=fs.readFileSync(file);assert.equal(hash(bytes),expected[size]);const deck=JSON.parse(bytes);assert.equal(deck.slides.length,size);return[size,{file,bytes,sha256:hash(bytes),deck}];}));
function verifyBuild(){assert.equal(git('rev-parse','HEAD'),build.source,'source revision stays fixed');assert.equal(hash(fs.readFileSync(path.join(site,'app.js'))),build.bundleSha256);for(const item of build.inputs)assert.equal(hash(fs.readFileSync(path.resolve(root,item.path))),item.sha256,item.path);}
verifyBuild();
const requests=[],blocked=[],errors=[],assets=new Map(),cases=[],comparisons=new Map();let activeCase='setup';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.ttf':'font/ttf','.woff2':'font/woff2','.wasm':'application/wasm'};
const server=createServer((request,response)=>{try{
 const url=new URL(request.url,'http://127.0.0.1');if(url.pathname==='/favicon.ico'){response.writeHead(204).end();return;}
 const decoded=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);assert.ok(!decoded.includes('\\'));let file=path.resolve(site,'.'+decoded),rel=path.relative(site,file);assert.ok(!rel.startsWith('..')&&!path.isAbsolute(rel));
 if(!fs.existsSync(file))file=path.resolve(assetSite,rel);const bytes=fs.readFileSync(file),sha256=hash(bytes);
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
async function startCase(configuration){
 activeCase=configuration.name;verifyBuild();
 const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,args:['--js-flags=--expose-gc']});
 try {
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1}),page=await context.newPage(),cdp=await context.newCDPSession(page);
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
 if(primary){assert.ok(result.reviewChecks.length>0,'actual settled core review ran');if(configuration.mode==='cold')assert.equal(result.reviewChecks[0].beforeCache.entries,0,'public invalidate cold control');else assert.ok(result.reviewChecks[0].beforeCache.entries>0,'candidate begins with retained composition');}
 const oracle=await page.evaluate(()=>window.reviewTrial.oracle());assert.equal(oracle.same,true,'complete report equals public cold oracle');
 const svgs=await page.evaluate(()=>window.reviewTrial.outputs());svgs.sort((a,b)=>a.key.localeCompare(b.key));
 const svgHashes=svgs.map(item=>({key:item.key,bytes:Buffer.byteLength(item.svg),sha256:hash(item.svg)}));
 const parity={report:oracle.report,svgs};
 if(primary||smoke&&configuration.name.startsWith('desktop-')&&action==='set'){const key=`${configuration.size}:${configuration.cpu}:${round}:${name.split(':').at(-1)}`,previous=comparisons.get(key);if(previous){assert.notEqual(previous.mode,configuration.mode);assert.deepEqual(parity,previous.parity,'exact cross-mode report/SVG bytes '+key);previous.matched=true;}else comparisons.set(key,{mode:configuration.mode,parity,matched:false});}
 const primaryLongTasks=Number.isFinite(result.phaseStart)?result.longTasks.map(item=>({...item,overlapMs:Math.max(0,Math.min(item.start+item.duration,result.phaseEnd)-Math.max(item.start,result.phaseStart))})).filter(item=>item.overlapMs>0):[];
 const postGc=await gc(cdp),row={name,primary,round,action,payload:action==='mount'?{slides:payload.slides.length}:payload,...result,primaryLongTasks,oracle,svgHashes,svgs,cdpDelta:delta(before,after),domBefore,domAfter,postGc};
 console.log(JSON.stringify({scope,case:configuration.name,phase:name,primary,ms:row.elapsedMs,coreMs:row.reviewChecks.reduce((sum,item)=>sum+item.ms,0),rendererCalls:row.calls.length,requestedSlides:row.calls.reduce((sum,item)=>sum+item.selected.length,0),cacheEntries:row.cache.entries}));return row;
}
async function measuredCase(configuration){
 const session=await startCase(configuration),rows=[],traceEvents=[];let tracing=false;
 try{
  if(measured){session.cdp.on('Tracing.dataCollected',event=>traceEvents.push(...event.value));await session.cdp.send('Tracing.start',{categories:'devtools.timeline,blink.user_timing',transferMode:'ReportEvents'});tracing=true;}
  const deck=structuredClone(inputs[configuration.size].deck),cell=chartCell(deck);assert.ok(cell.dataset,'the edit is a real shared document dataset');if(configuration.size===36)assert.equal(cell.dependentChartIndices.length,2);assert.equal(typeof deck.slides[0].title,'string');
  rows.push(await phase(session,configuration,'setup:mount','mount',deck));
  const rounds=smoke?1:4;
  for(let round=0;round<rounds;round++){
   const primary=measured&&round>0,prefix=round===0?'warmup':`round-${round}`;
   await session.page.evaluate(async()=>{await window.browserPerf.operation('navigate',0);await window.reviewTrial.oracle();window.reviewTrial.outputs();});
   rows.push(await phase(session,configuration,prefix+':local-title0','set',{path:'slides.0.title',value:deck.slides[0].title+` — edit ${round}`},{primary,round}));
   await session.page.evaluate(async index=>{await window.browserPerf.operation('navigate',index);await window.reviewTrial.oracle();window.reviewTrial.outputs();},cell.slideIndex);
   rows.push(await phase(session,configuration,prefix+':shared-datum','set',{path:cell.path,value:cell.previous+round+1},{primary,round}));
   rows.push(await phase(session,configuration,prefix+':global-name','set',{path:'name',value:(deck.name??'Deck')+` — edit ${round}`},{primary,round}));
   if(round===0)await session.page.screenshot({path:path.join(output,configuration.name+'-warmup.png'),timeout:10000});
  }
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
  const baseline=await gc(session.cdp);
  await phase(session,configuration,'soak:mount','mount',deck);
  for(let edit=0;edit<(smoke?3:20);edit++){
   await bounded(session.page.evaluate(async edit=>{await window.browserPerf.operation('set',{path:'slides.35.title',value:'Retained heap edit '+edit});},edit),'soak-edit',30000);
   if((edit+1)%5===0||smoke){const oracle=await session.page.evaluate(()=>window.reviewTrial.oracle());assert.equal(oracle.same,true);const cache=await session.page.evaluate(()=>window.browserPerf.snapshot().cache);assert.ok(cache.entries<=64&&cache.bytes<=cache.maxBytes);samples.push({edit:edit+1,cache,...await gc(session.cdp)});await session.page.evaluate(()=>window.reviewTrial.outputs());}
  }
  const cycles=[];
  for(let cycle=0;cycle<(smoke?1:4);cycle++){
   const disposed=await session.page.evaluate(()=>window.reviewTrial.dispose());assert.ok(disposed.infos.length>0&&disposed.infos.every(info=>info.entries===0&&info.bytes===0));assert.equal(disposed.workspaces,0);assert.equal(disposed.fontFaces,warmDisposed.fontFaces,'repeated sessions do not duplicate prepared faces');
   cycles.push({cycle,disposed,...await gc(session.cdp)});
   if(cycle<(smoke?1:4)-1)await phase(session,configuration,'soak:remount-'+cycle,'mount',deck);
  }
  const record={scope:'BOUNDED_RETENTION_NOT_LEAK_ACCEPTANCE',configuration,baseline,warmDisposed,samples,cycles,edits:smoke?3:20,mountDestroyCycles:smoke?1:4,browserVersion:session.browserVersion};fs.writeFileSync(path.join(output,configuration.name+'.json'),JSON.stringify(record,null,2)+'\n');return record;
 }finally{await session.browser.close();}
}
try{
 const cells=smoke?[{size:16,cpu:1,modes:['cold','cached']}]:[{size:16,cpu:1,modes:['cold','cached']},{size:36,cpu:1,modes:['cached','cold']},{size:16,cpu:4,modes:['cached','cold']},{size:36,cpu:4,modes:['cold','cached']}];
 for(const cell of cells)for(const mode of cell.modes)await measuredCase({name:`desktop-cpu${cell.cpu}-${cell.size}-${mode}`,size:cell.size,cpu:cell.cpu,mode});
 assert.ok([...comparisons.values()].every(item=>item.matched),'all exact phase pairs are present');
 const retained=[];for(const mode of ['cold','cached'])retained.push(await soak(mode));
 assert.equal(errors.length,0,JSON.stringify(errors));assert.deepEqual(blocked,[]);verifyBuild();for(const input of Object.values(inputs))assert.equal(hash(fs.readFileSync(input.file)),input.sha256);
 const receipt={status:'PASS',scope,source:build.source,tree:build.tree,bundleSha256:build.bundleSha256,node:process.version,inputFiles:Object.fromEntries(Object.entries(inputs).map(([size,input])=>[size,{bytes:input.bytes.length,sha256:input.sha256}])),cases:cases.map(item=>({configuration:item.configuration,rows:item.rows.length})),pairedPhases:comparisons.size,retained:retained.map(item=>({configuration:item.configuration,edits:item.edits,mountDestroyCycles:item.mountDestroyCycles})),requests,blocked,errors,limits:{setupMs:90000,phaseMs:30000,traceEndMs:15000},disclosure:['Same candidate/public invalidate cold control; local title0 and global metadata are conservative cache misses.','One fresh browser process per case; fixed desktop viewport; no physical-mobile claim.','Debounce stays inside settled elapsed time; report/SVG equality, hashing, GC and storage are outside primary intervals.','Trace/forwarder/observer overhead is present symmetrically; no unperturbed-production claim.','Cache policy bounds are logical; short post-GC heap/DOM soak is not leak acceptance.','Original root smoke is functional evidence only and is preserved separately; no invented root stdout.']};
 fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({status:'PASS',scope,cases:receipt.cases.length,pairedPhases:receipt.pairedPhases,output}));
}catch(error){fs.writeFileSync(path.join(output,'first-failure.json'),JSON.stringify({status:'FAILED',scope,message:error.stack??String(error),requests,blocked,errors},null,2)+'\n');console.error(error);process.exitCode=1;}
finally{await new Promise(resolve=>server.close(resolve));}
