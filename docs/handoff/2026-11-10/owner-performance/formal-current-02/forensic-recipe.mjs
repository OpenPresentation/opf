// One explicitly instrumented causal diagnostic, not a benchmark or candidate qualification.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
const root=fs.realpathSync('/tmp/opf-owner-current'),out='/tmp/opf-owner-current-core-forensic-01';
assert.equal(fs.existsSync(out),false,'fresh diagnostic output');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
assert.equal(git('rev-parse','HEAD'),'89a9a74a6968848b81c49a396e72f56bc65ff6ca');assert.equal(git('status','--porcelain'),'');
const hash=b=>createHash('sha256').update(b).digest('hex');
const req=createRequire(root+'/packages/editor/package.json'),{build}=req('esbuild'),{chromium}=req('playwright');
const expectedBuildReceiptSha256='db601add9dbf4037e156ef988cce95975130ff34fd7b6b7fdeff066219702995';
const expectedSourceSha256='37bbebb41e9ba4ca8ef846b8e788d6132a2af163c49bdc158fb6171a867ad2d3';
const sourceFile=root+'/packages/javascript/dist/chunk-FAFG3JSM.js',source=fs.readFileSync(sourceFile,'utf8');
assert.equal(hash(source),expectedSourceSha256,'original frozen build graph chunk');
const replacements=[
 ['const engine = validateAgainstSchema(document, "presentation", { template: run.options.template, values: run.options.values, ...run.options.catalogs ? { catalogs: run.options.catalogs } : {} });','const engine = globalThis.__diag.measure("schema-and-semantics",()=>validateAgainstSchema(document, "presentation", { template: run.options.template, values: run.options.values, ...run.options.catalogs ? { catalogs: run.options.catalogs } : {} }));'],
 ['const valid = resolved.validate(subject) === true;','const valid = globalThis.__diag.measure("precompiled-schema",()=>resolved.validate(subject)) === true;'],
 ['presentationSemanticIssues(subject, options2.catalogs)','globalThis.__diag.measure("presentation-semantics",()=>presentationSemanticIssues(subject, options2.catalogs))'],
 ['const data = dataIssues(subject);','const data = globalThis.__diag.measure("data-semantics",()=>dataIssues(subject));'],
 ['presentationReferenceWarnings(subject, options2.catalogs)','globalThis.__diag.measure("reference-warnings",()=>presentationReferenceWarnings(subject, options2.catalogs))'],
 ['referenceFindings(document, engine, run.options)','globalThis.__diag.measure("references",()=>referenceFindings(document, engine, run.options))'],
 ['cache?.begin(doc, run.options)','globalThis.__diag.measure("cache-begin",()=>cache?.begin(doc, run.options))'],
 ['entry2.run(context);','globalThis.__diag.measure("rule:"+entry2.info.id,()=>entry2.run(context));'],
 ['function key2(value, opaque) {','function key2(value,opaque){return globalThis.__diag.measure("cache-key",()=>diagnosticOriginalKey(value,opaque));}\nfunction diagnosticOriginalKey(value, opaque) {'],
 ['return structuredClone(hit.value);','return globalThis.__diag.measure("cache-hit-clone",()=>structuredClone(hit.value));'],
 ['const value = compute();','const value = globalThis.__diag.measure("compose-miss:"+index,compute);'],
 ['const saved = !value.layoutError && !value.layoutDiagnostics.some((entry2) => entry2.strict) && snapshotValue(value);','const saved = !value.layoutError && !value.layoutDiagnostics.some((entry2) => entry2.strict) && globalThis.__diag.measure("cache-snapshot",()=>snapshotValue(value)); if(globalThis.__diag.enabled&&!saved)globalThis.__diag.unsaved.push({index,layoutError:value.layoutError,strict:value.layoutDiagnostics.filter(x=>x.strict),forensic:globalThis.__diag.inspect(value)});'],
 ['const host = measurementFor(options2, index);','const host = globalThis.__diag.measure("host-measurement",()=>measurementFor(options2, index));'],
 ['const baseContext = lazy(() => resolveSlideContext(document, index, { catalogs: options2.catalogs, date: "2000-01-01" }));','const baseContext = lazy(() => globalThis.__diag.measure("slide-context",()=>resolveSlideContext(document, index, { catalogs: options2.catalogs, date: "2000-01-01" })));'],
];
assert.equal(replacements.length,14);
let instrumented=source;
for(const [before,after] of replacements){assert.equal(instrumented.split(before).length,2,'one exact instrumentation location: '+before);instrumented=instrumented.replace(before,after);}
const setup=fs.readFileSync(root+'/docs/handoff/2026-11-10/owner-performance/current-browser-entry.mjs','utf8').split('let editor;')[0].split('\n').filter(line=>!line.startsWith('import ')&&!line.startsWith('new PerformanceObserver')&&!line.startsWith('new MutationObserver')).join('\n');
const entry=`
import {createValidator,validate} from ${JSON.stringify(root+'/packages/javascript/dist/browser.js')};
import {gallery} from ${JSON.stringify(root+'/packages/gallery/dist/index.js')};
import * as browserFonts from ${JSON.stringify(root+'/packages/render/dist/fonts-browser.js')};
import {layoutOptionsFor} from ${JSON.stringify(root+'/packages/editor/src/workspace-measure.js')};
globalThis.__diag={enabled:false,stages:{},unsaved:[],measure(name,fn){if(!this.enabled)return fn();const start=performance.now();try{return fn();}finally{const item=this.stages[name]??={calls:0,ms:0};item.calls++;item.ms+=performance.now()-start;}}};
${setup}
__diag.inspect=value=>{
 const seen=new Set(),failures=[],counts={nodes:0,stringUnits:0,keyBytes:0};
 const part=text=>{counts.keyBytes+=text.length*2;};
 const visit=(node,path,depth)=>{
  counts.nodes++;
  if(depth>128){failures.push({path,reason:'depth',depth});return;}
  if(typeof node==='number'&&!Number.isFinite(node)){failures.push({path,reason:'nonfinite-number',value:String(node)});return;}
  if(node===null){part('null;');return;}
  if(node===undefined){part('undefined;');return;}
  if(typeof node==='boolean'){part(node?'true;':'false;');return;}
  if(typeof node==='number'){part('n'+(Object.is(node,-0)?'-0':node)+';');return;}
  if(typeof node==='string'){counts.stringUnits+=node.length;part('s'+JSON.stringify(node));return;}
  if(typeof node!=='object'){failures.push({path,reason:'opaque-type',type:typeof node});return;}
  if(seen.has(node)){failures.push({path,reason:'cycle'});return;}
  if(!Array.isArray(node)&&![Object.prototype,null].includes(Object.getPrototypeOf(node))){failures.push({path,reason:'prototype'});return;}
  seen.add(node);part(Array.isArray(node)?'a[':'o{');const descriptors=Object.getOwnPropertyDescriptors(node);
  if(Array.isArray(node)){
   const ownKeys=Reflect.ownKeys(node),enumerable=Object.keys(node),length=descriptors.length.value;
   const firstBadIndex=enumerable.findIndex((name,i)=>name!==String(i));
   if(ownKeys.length!==length+1||firstBadIndex!==-1)failures.push({path,reason:'array-shape',length,ownKeyCount:ownKeys.length,enumerableKeyCount:enumerable.length,firstBadIndex,firstBadKey:firstBadIndex<0?undefined:enumerable[firstBadIndex]});
  }
  for(const key of Reflect.ownKeys(node)){
   if(Array.isArray(node)&&key==='length')continue;
   const d=descriptors[key],childPath=path+'/'+String(key).replaceAll('~','~0').replaceAll('/','~1');
   if(typeof key==='symbol'||!('value' in d)||!d.enumerable){failures.push({path:childPath,reason:'descriptor',keyType:typeof key,enumerable:d.enumerable,data:'value' in d});continue;}
   if(!Array.isArray(node))part(JSON.stringify(key));
   visit(d.value,childPath,depth+1);
  }
  part(Array.isArray(node)?']':'}');seen.delete(node);
 };
 visit(value,'',0);let clone='SKIPPED_ACCESSOR_OR_PROTOTYPE';if(!failures.some(x=>x.reason==='prototype'||x.reason==='descriptor'&&!x.data)){try{structuredClone(value);clone='PASS';}catch(e){clone=String(e);}}
 return{counts,keyBudgetBytes:2*1024*1024,keyBudgetExceeded:counts.keyBytes>2*1024*1024,failures,structuredClone:clone};
};
const deck=await fetch('/deck.json').then(r=>r.json());await fonts.ensure(deck,{catalogs:[gallery]});
const options={catalogs:[gallery],fonts:{textMeasurement:index=>layoutOptionsFor(fonts,deck,index,[gallery]).fonts.textMeasurement}};
const checker=createValidator();const before={...checker.cache};
__diag.enabled=true;const start=performance.now();const report=checker.validate(deck,options);const diagnosticElapsedMs=performance.now()-start;__diag.enabled=false;
const cold=validate(deck,options);
window.diagnostic={scope:'ONE_ORIGINAL_SNAPSHOT_REJECTION_FORENSIC_NOT_BENCHMARK',diagnosticElapsedMs,same:JSON.stringify(report)===JSON.stringify(cold),findings:report.findings.length,counts:report.counts,before,after:{...checker.cache},stages:__diag.stages,unsaved:__diag.unsaved,fontFaces:fonts.registry.describeFaces(),fontAnalysis:fonts.analysisStats};
fonts.dispose();window.diagnosticReady=true;
`;
fs.mkdirSync(out);
const originalReceipt=fs.readFileSync(root+'/artifacts/owner-current-build-01/build-receipt.json');
assert.equal(hash(originalReceipt),expectedBuildReceiptSha256,'exact accepted build receipt');
assert.equal(JSON.parse(originalReceipt).inputs.find(x=>x.path==='packages/javascript/dist/chunk-FAFG3JSM.js').sha256,expectedSourceSha256);
const result=await build({stdin:{contents:entry,resolveDir:root,sourcefile:'diagnostic-entry.mjs'},bundle:true,platform:'browser',format:'esm',write:false,minify:false,conditions:['browser'],plugins:[{name:'explicit-diagnostic-only',setup(b){b.onLoad({filter:/chunk-FAFG3JSM\.js$/},args=>{assert.equal(args.path,sourceFile);return{contents:instrumented,resolveDir:path.dirname(sourceFile)};});}}],logLevel:'error'});
fs.writeFileSync(out+'/entry.mjs',entry);fs.writeFileSync(out+'/instrumentation.json',JSON.stringify({originalFile:sourceFile,originalSha256:hash(source),instrumentedSha256:hash(instrumented),replacements},null,2)+'\n');
const requests=[],server=createServer((request,response)=>{try{const url=new URL(request.url,'http://localhost'),name=decodeURIComponent(url.pathname);if(name==='/app.js')return response.writeHead(200,{'Content-Type':'text/javascript'}).end(result.outputFiles[0].contents);if(name==='/index.html')return response.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><meta charset="utf-8"><script type="module" src="/app.js"></script>');if(name==='/deck.json')return response.writeHead(200,{'Content-Type':'application/json'}).end(fs.readFileSync(root+'/artifacts/owner-current-projection-01/extended-36.proposed.opf.json'));const file=path.resolve(root+'/artifacts/owner-current-assets-01','.'+name);assert.ok(file.startsWith(path.resolve(root+'/artifacts/owner-current-assets-01')+path.sep));const bytes=fs.readFileSync(file);requests.push({path:name,bytes:bytes.length,sha256:hash(bytes)});response.writeHead(200,{'Content-Type':path.extname(file)==='.wasm'?'application/wasm':path.extname(file)==='.json'?'application/json':'application/octet-stream'}).end(bytes);}catch(error){response.writeHead(404).end(String(error));}});
let browser;
try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});browser=await chromium.launch();const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(String(error)));await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');await page.waitForFunction(()=>window.diagnosticReady,undefined,{timeout:90000});const actual=await page.evaluate(()=>window.diagnostic);assert.deepEqual(errors,[]);assert.equal(actual.same,true);assert.equal(hash(fs.readFileSync(sourceFile)),hash(source));assert.equal(hash(fs.readFileSync(root+'/artifacts/owner-current-build-01/build-receipt.json')),hash(originalReceipt));assert.equal(git('status','--porcelain'),'');const receipt={...actual,browserVersion:browser.version(),node:process.version,source:git('rev-parse','HEAD'),requests,originalChunkSha256:hash(source),buildReceiptSha256:hash(originalReceipt)};fs.writeFileSync(out+'/result.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({scope:receipt.scope,same:receipt.same,before:receipt.before,after:receipt.after,stages:receipt.stages,unsaved:receipt.unsaved,findings:receipt.findings,counts:receipt.counts,browserVersion:receipt.browserVersion,out}));}catch(error){fs.writeFileSync(out+'/failure.log',String(error.stack??error));throw error;}finally{await browser?.close();if(server.listening)await new Promise(resolve=>server.close(resolve));}
