// Actual rendered metric ink; keep native Office observations as a separate gate.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {availableParallelism} from 'node:os';
import {measureInk} from './metric-outline-ink.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(new URL('../../opf-render/package.json',import.meta.url));
const {chromium}=require('playwright'),sharp=require('sharp');
const {prepareNodeFonts}=await import(new URL('../../opf-render/dist/fonts-node.js',import.meta.url));
const {renderSvg,resolvePresentation}=await import(new URL('../../opf-render/dist/svg.js',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const out=path.resolve(process.argv[2]??'artifacts/metric-outline-browser'),widthOnly=process.argv.includes('--width-only');
await mkdir(out,{recursive:true});
const prepared=await prepareNodeFonts({pack:'office'});
const options={...prepared.options,trace:true,...(widthOnly?{textMeasurement:{...prepared.options.textMeasurement,outlineBounds:undefined}}:{})};
const metrics=[0,'',{value:42,unit:'ms',label:'Left\tRight  ',description:'Exact\r\n\r\ncontext',delta:0,trend:'flat'},
  {value:'42\r\n-0.5',unit:'milliseconds across all completed production requests',label:'Latency'},
  {value:'',unit:'',label:'',description:'',delta:'',trend:'up'},
  {value:1,unit:'%',label:'Completion'},
  {value:'\t1\t%',unit:'ms',label:'\tBefore\tAfter  ',description:'\t'},
  {value:'\r\n\r\n\n',label:'\t  ',description:'\n'}];
const cases=[];
for(const family of ['Carlito','Roboto'])for(const [width,height]of [[1280,720],[540,960]])for(const align of ['left','center','right'])for(const [index,metric]of metrics.entries()){
  const id=`${family}-${width}-${align}-${index+1}`;
  const document={design:{dimensions:{widthInches:width/96,heightInches:height/96},contentAlignment:align,fontScheme:{id:'roboto',heading:{family},body:{family},code:{family}}},slides:[{composition:{minFontSize:24},metric}]};
  const before=JSON.stringify(document),bound=resolvePresentation(document,options).slides[0],svg=renderSvg(document,options),item=bound.geometry.items[0];
  assert.equal(JSON.stringify(document),before);assert.equal(item.metricLayout.overflow,false);
  cases.push({id,width,height,document,cell:item.box,layout:item.metricLayout,svg,sourceSha256:hash(before),svgSha256:hash(svg)});
}
// RR-45 (opf#368, item 2): one screenshot per case and native ink statistics. Each case's SVG is parsed once; its visible
// parts become black masks (white text of that part only, exactly as before) laid out side by side, captured in one
// clipped screenshot and measured per part by scripts/metric-outline-ink.mjs (sharp stats(), a black cover rect over the
// cell). Cases run on up to four pages in parallel; results keep the case order. Same assertions, same 0.1 px tolerance.
const gridOf=(item,count)=>{const columns=Math.max(1,Math.min(count,Math.ceil(Math.sqrt(count*item.height/item.width))));return {columns,width:columns*item.width,height:Math.ceil(count/columns)*item.height};};
const visibleParts=item=>item.layout.parts.filter(part=>part.visible);
const viewport=cases.reduce((size,item)=>{const grid=gridOf(item,visibleParts(item).length);return {width:Math.max(size.width,grid.width),height:Math.max(size.height,grid.height)};},{width:1400,height:1050});
const pages=Math.max(1,Math.min(4,availableParallelism(),cases.length));
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined}),errors=[],requests=[],results=new Array(cases.length);
async function openPage(){
  const page=await (await browser.newContext({viewport})).newPage();
  page.on('pageerror',error=>errors.push(error.message));await page.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});
  await page.setContent('<style>body{margin:0}main{position:relative}</style><main></main>');
  await page.evaluate(async faces=>{for(const face of faces)document.fonts.add(await new FontFace(face.family,`url(${face.dataUrl})`,{weight:String(face.weight),style:face.italic?'italic':'normal'}).load());await document.fonts.ready;},prepared.options.embeddedFonts);
  return page;
}
async function runCase(page,index){
  const item=cases[index],parts=visibleParts(item);
  const expected=parts.flatMap(part=>part.fit.sourceLines.map((line,index)=>({text:part.text.slice(line.start,line.end),segments:line.segments,origin:part.linePositions[index],width:line.width,path:part.path})));
  const observed=await page.evaluate(async({svg,expected})=>{
    document.querySelector('main').innerHTML=svg;await document.fonts.ready;
    const nodes=[...document.querySelectorAll('svg text')],failures=[],observations=[];
    if(nodes.length!==expected.length)failures.push('Text line count differs');
    expected.forEach((value,index)=>{
      const node=nodes[index];if(!node)return;
      if(node.textContent!==value.text)failures.push('Text source differs: '+value.path);
      const spans=[...node.querySelectorAll('tspan')];if(spans.length!==value.segments.length)failures.push('Segment count differs');
      spans.forEach((span,i)=>{
        const segment=value.segments[i],first=span.getNumberOfChars()?span.getStartPositionOfChar(0):null,width=span.getComputedTextLength();
        if(first&&(Math.abs(first.x-value.origin.x-segment.x)>.1||Math.abs(first.y-value.origin.baseline)>.1))failures.push('Accepted origin differs: '+value.path);
        if(Math.abs(width-segment.width)>.1)failures.push('Segment advance differs: '+value.path);
        observations.push({path:value.path,text:span.textContent,kind:segment.kind,expectedX:value.origin.x+segment.x,actualX:first?.x,expectedY:value.origin.baseline,actualY:first?.y,expectedWidth:segment.width,actualWidth:width});
      });
    });return {failures,observations};
  },{svg:item.svg,expected});
  const result={id:item.id,sourceSha256:item.sourceSha256,svgSha256:item.svgSha256,cell:item.cell,...observed,ink:[]};results[index]=result;
  if(item.id.endsWith('540-right-4')){await page.locator('svg').screenshot({path:path.join(out,item.id+'.png')});await writeFile(path.join(out,item.id+'.opf.json'),JSON.stringify(item.document,null,2)+'\n');}
  if(!parts.length)return;
  const grid=gridOf(item,parts.length),regions=parts.map((part,i)=>({left:(i%grid.columns)*item.width,top:Math.floor(i/grid.columns)*item.height,width:item.width,height:item.height}));
  await page.evaluate(({sourcePaths,regions})=>{
    const main=document.querySelector('main'),original=main.querySelector('svg');
    main.replaceChildren(...sourcePaths.map((sourcePath,i)=>{
      const mask=original.cloneNode(false);mask.style.background='#000';Object.assign(mask.style,{position:'absolute',left:regions[i].left+'px',top:regions[i].top+'px'});
      for(const text of original.querySelectorAll('text'))if(text.getAttribute('data-opf-path')===sourcePath){const clone=text.cloneNode(true);clone.style.fill='#fff';clone.style.color='#fff';mask.append(clone);}
      return mask;
    }));
  },{sourcePaths:parts.map(part=>part.path),regions});
  const png=await page.screenshot({clip:{x:0,y:0,width:grid.width,height:grid.height}}),{data,info}=await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const file=item.id+'.masks.png';await writeFile(path.join(out,file),png);result.masks={file,sha256:hash(png),width:info.width,height:info.height};
  const measured=await Promise.all(regions.map(region=>measureInk(sharp,{data,width:info.width,height:info.height,channels:info.channels},region,item.cell)));
  parts.forEach((part,i)=>{
    const {ink,outside,maxInk,maxOutsideInk}=measured[i];
    if(ink!==Boolean(part.text.trim()))result.failures.push('Blank/nonblank ink differs: '+part.path);
    if(outside)result.failures.push('Paint leaves cell: '+part.path);
    result.ink.push({path:part.path,role:part.role,region:regions[i],ink,outside,maxInk,maxOutsideInk});
  });
}
try{
  let next=0;
  await Promise.all(Array.from({length:pages},async()=>{const page=await openPage();for(let index=next++;index<cases.length;index=next++)await runCase(page,index);}));
  const runtime={};for(const file of (await readdir(path.join(root,'packages/javascript/dist'))).filter(file=>file.endsWith('.js')))runtime[file]=hash(await readFile(path.join(root,'packages/javascript/dist',file)));
  const report={node:process.version,browser:browser.version(),platform:process.platform,widthOnly,sourceSha256:hash(await readFile(path.join(root,'packages/javascript/src/composition.ts'))),runtime,verifierSha256:hash(await readFile(fileURLToPath(import.meta.url))),fonts:prepared.options.embeddedFonts.map(face=>({family:face.family,weight:face.weight,italic:face.italic,sha256:hash(Buffer.from(face.dataUrl.split(',')[1],'base64'))})),results,errors,requests,scope:'96 actual offline SVG metric cases using exact open Carlito/Roboto bytes. Source, accepted segment origins/advances within 0.1 reference pixels, and nonzero mask pixel centers inside cells plus 0.1 (one masks screenshot per case, measured with sharp stats()). Width-only mode retains the previous metric model as a control. Native PowerPoint/Calibri tab and paint gates require independent fresh evidence.'};
  await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);assert.deepEqual(results.flatMap(result=>result.failures.map(failure=>result.id+': '+failure)),[]);
  console.log(`${results.length} actual metric SVG cases preserve source, accepted segment positions and nonzero ink containment (${pages} pages).`);
}finally{await browser.close();}
