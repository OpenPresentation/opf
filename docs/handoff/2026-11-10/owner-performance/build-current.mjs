import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {captureBinding,verifyBinding,verifyFiles,measuredInputs,assetAdmission,fileRecord,compilerRecords} from './bindings.mjs';
const root=process.cwd(),folder=path.dirname(fileURLToPath(import.meta.url));
const req=createRequire(path.join(root,'packages/editor/package.json')),{build}=req('esbuild');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const abs=file=>path.resolve(root,file).split(path.sep).join('/');
const out=path.resolve(root,process.argv.find(arg=>arg.startsWith('--out='))?.slice(6)??'artifacts/owner-current-build-01');
const relative=path.relative(root,out);if(!relative||relative.startsWith('..')||path.isAbsolute(relative)||fs.existsSync(out))throw Error('Fresh owned output directory required');
if(git('diff','--name-only','HEAD','--','packages','spec','pnpm-lock.yaml'))throw Error('Production source must be frozen');
const compiler=compilerRecords(root),beforeBinding=captureBinding(root,compiler);
const assetDir=path.resolve(root,process.argv.find(arg=>arg.startsWith('--assets='))?.slice(9)??'artifacts/owner-current-assets-01');
const assets=assetAdmission(root,assetDir);
fs.mkdirSync(out,{recursive:true});
const core=abs('packages/javascript/dist/browser.js'),panel=abs('packages/editor/src/review-panel.js'),svg=abs('packages/render/dist/svg.js'),selection=abs('packages/render/dist/slide-sources.js');
const virtual=[];
const plugin={name:'rr117-public-forwarders',setup(builder){
 builder.onResolve({filter:/^@rr117\/workspace$/},()=>({path:abs('packages/editor/src/workspace.js')}));
 builder.onResolve({filter:/review-panel\.js$/},args=>args.importer.endsWith('workspace-parts.js')?{path:'panel',namespace:'rr117'}:undefined);
 builder.onResolve({filter:/^@openpresentation\/opf$/},args=>args.importer.split(path.sep).join('/').endsWith('/src/review-panel.js')?{path:'core',namespace:'rr117'}:undefined);
 builder.onResolve({filter:/^@openpresentation\/opf-render\/svg$/},()=>({path:'svg',namespace:'rr117'}));
 builder.onLoad({filter:/.*/,namespace:'rr117'},args=>{
  const contents=args.path==='panel'
   ?`export * from ${JSON.stringify(panel)};import{createReviewPanel as original}from ${JSON.stringify(panel)};export function createReviewPanel(...args){const panel=original(...args);window.__reviewTrial.panels.push(panel);return panel;}`
   :args.path==='core'
   ?`export * from ${JSON.stringify(core)};import{createValidator as original,validate}from ${JSON.stringify(core)};export function createValidator(){const checker=original();window.__reviewTrial.coldValidate=validate;window.__reviewTrial.checkers.push(checker);return{get cache(){return checker.cache;},clear:()=>checker.clear(),validate(input,options){const before={...checker.cache},start=performance.now(),report=checker.validate(input,options);window.__reviewTrial.checks.push({ms:performance.now()-start,beforeCache:before,cache:{...checker.cache}});window.__reviewTrial.latest={input,options,report};return report;}};}`
   :`export * from ${JSON.stringify(svg)};import{toSvg as original}from ${JSON.stringify(svg)};import{selectSlides}from ${JSON.stringify(selection)};export function toSvg(...args){const start=performance.now(),result=original(...args),state=window.__svgPerf;if(state){const request=args[1],options=request!==null&&typeof request==='object'&&!Array.isArray(request)?request:args[2],count=args[0].slides.length,selected=typeof request==='number'?[request]:typeof request==='string'||Array.isArray(request)?selectSlides(request,count):args[0].slides.map((_,i)=>i+1).filter(n=>!(options?.skipHidden&&args[0].slides[n-1]?.hidden)),svgs=Array.isArray(result)?result:[result];state.calls.push({ms:performance.now()-start,slides:count,selected,outputs:svgs.length,characters:svgs.reduce((n,s)=>n+s.length,0)});if(selected.length!==svgs.length)throw Error('Instrumentation selection mismatch');svgs.forEach((value,i)=>state.outputs.set(count+':'+selected[i],value));}return result;}`;
  virtual.push({name:args.path,bytes:Buffer.byteLength(contents),sha256:hash(contents),source:contents});return{resolveDir:root,contents};
 });
}};
const inputDir=path.resolve(root,process.argv.find(arg=>arg.startsWith('--inputs='))?.slice(9)??'artifacts/owner-performance-inputs');
const projectionFile=process.argv.find(arg=>arg.startsWith('--projection='))?.slice(13);
const measured=measuredInputs(root,inputDir,projectionFile?path.resolve(root,projectionFile):undefined);
const [{validate},{gallery}]=await Promise.all([import(pathToFileURL(abs('packages/javascript/dist/index.js')).href),import(pathToFileURL(abs('packages/gallery/dist/index.js')).href)]);
const validationInputs=[];
for(const input of Object.values(measured.inputs)){const report=validate(input.deck,{only:['format'],catalogs:[gallery]});if(!report.valid)throw Error('Explicit measured input fails current format: '+JSON.stringify(report.findings));validationInputs.push({rawBytes:input.bytes.length,rawSha256:input.sha256,measuredBytes:input.measuredBytes.length,measuredSha256:input.measuredSha256,valid:report.valid});}
const result=await build({entryPoints:[path.join(folder,'current-browser-entry.mjs')],absWorkingDir:root,bundle:true,platform:'browser',format:'esm',minify:true,write:false,metafile:true,plugins:[plugin],define:{'process.env.NODE_ENV':'"production"'},logLevel:'error'});
const js=result.outputFiles[0].contents;fs.writeFileSync(path.join(out,'app.js'),js);
fs.writeFileSync(path.join(out,'index.html'),'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="./styles.css"><style>html,body{margin:0;height:100%;width:100%;overflow:hidden}#host{height:100dvh;width:100vw}</style><div id="host"></div><script type="module" src="./app.js"></script>');
const inputs=Object.keys(result.metafile.inputs).filter(file=>!file.startsWith('rr117:')).map(file=>{const bytes=fs.readFileSync(path.resolve(root,file));return{path:file,bytes:bytes.length,sha256:hash(bytes)};});
verifyBinding(root,beforeBinding);verifyFiles(root,compiler);verifyFiles(root,measured.inputFiles);verifyFiles(root,[assets.record]);assetAdmission(root,assetDir);
const binding=captureBinding(root,[...inputs,...compiler]);
const outputs=['app.js','index.html'].map(file=>fileRecord(root,path.join(out,file)));
const receipt={scope:'BUILT_NOT_MEASURED',binding,compiler,outputs,projection:measured.admission,inputFiles:measured.inputFiles,assets:assets.record,validationInputs,source:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),node:process.version,bundleBytes:js.length,bundleSha256:hash(js),inputs,virtual,buildDriver:fileRecord(root,fileURLToPath(import.meta.url)),control:'One frozen current-candidate bundle in six cached cases; complete public cold-oracle reports checked outside intervals. Wrapper instrumentation only; no product source/dist rewrite.'};
fs.writeFileSync(path.join(out,'build-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({scope:receipt.scope,source:receipt.source,inputs:inputs.length,bundleBytes:js.length,out}));
