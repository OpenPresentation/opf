// Actual rendered metric ink; keep native Office observations as a separate gate.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
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
  cases.push({id,document,cell:item.box,layout:item.metricLayout,svg,sourceSha256:hash(before),svgSha256:hash(svg)});
}
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined}),errors=[],requests=[],results=[];
try{
  const page=await browser.newPage({viewport:{width:1400,height:1050}});
  page.on('pageerror',error=>errors.push(error.message));await page.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});
  await page.setContent('<style>body{margin:0}</style><main></main>');
  await page.evaluate(async faces=>{for(const face of faces)document.fonts.add(await new FontFace(face.family,`url(${face.dataUrl})`,{weight:String(face.weight),style:face.italic?'italic':'normal'}).load());await document.fonts.ready;},prepared.options.embeddedFonts);
  for(const item of cases){
    const expected=item.layout.parts.filter(part=>part.visible).flatMap(part=>part.fit.sourceLines.map((line,index)=>({text:part.text.slice(line.start,line.end),segments:line.segments,origin:part.linePositions[index],width:line.width,path:part.path})));
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
    const result={id:item.id,sourceSha256:item.sourceSha256,svgSha256:item.svgSha256,cell:item.cell,...observed,ink:[]};results.push(result);
    if(item.id.endsWith('540-right-4')){await page.locator('svg').screenshot({path:path.join(out,item.id+'.png')});await writeFile(path.join(out,item.id+'.opf.json'),JSON.stringify(item.document,null,2)+'\n');}
    for(const part of item.layout.parts.filter(part=>part.visible)){
      await page.evaluate(({svg,sourcePath})=>{
        const main=document.querySelector('main');main.innerHTML=svg;const original=main.querySelector('svg'),mask=original.cloneNode(false);mask.style.background='#000';
        for(const text of original.querySelectorAll('text'))if(text.getAttribute('data-opf-path')===sourcePath){const clone=text.cloneNode(true);clone.style.fill='#fff';clone.style.color='#fff';mask.append(clone);}
        main.replaceChildren(mask);
      },{svg:item.svg,sourcePath:part.path});
      const png=await page.locator('svg').screenshot(),{data,info}=await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});
      let pixels=0;const outside=[];const cell=item.cell;
      for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
        const at=(y*info.width+x)*info.channels,coverage=Math.max(data[at],data[at+1],data[at+2]);if(!coverage)continue;pixels++;
        if(Math.max(cell.x-(x+.5),cell.y-(y+.5),x+.5-(cell.x+cell.width),y+.5-(cell.y+cell.height))>.1+1e-9)outside.push({x,y,coverage});
      }
      if(Boolean(pixels)!==Boolean(part.text.trim()))result.failures.push('Blank/nonblank ink differs: '+part.path);
      if(outside.length)result.failures.push('Paint leaves cell: '+part.path);
      const file=item.id+'-'+part.role+'.mask.png';await writeFile(path.join(out,file),png);
      result.ink.push({path:part.path,file,sha256:hash(png),pixels,outside});
    }
  }
  const runtime={};for(const file of (await readdir(path.join(root,'packages/javascript/dist'))).filter(file=>file.endsWith('.js')))runtime[file]=hash(await readFile(path.join(root,'packages/javascript/dist',file)));
  const report={node:process.version,browser:browser.version(),platform:process.platform,widthOnly,sourceSha256:hash(await readFile(path.join(root,'packages/javascript/src/composition.ts'))),runtime,verifierSha256:hash(await readFile(fileURLToPath(import.meta.url))),fonts:prepared.options.embeddedFonts.map(face=>({family:face.family,weight:face.weight,italic:face.italic,sha256:hash(Buffer.from(face.dataUrl.split(',')[1],'base64'))})),results,errors,requests,scope:'96 actual offline SVG metric cases using exact open Carlito/Roboto bytes. Source, accepted segment origins/advances within 0.1 reference pixels, and nonzero mask pixel centers inside cells plus 0.1. Width-only mode retains the previous metric model as a control. Native PowerPoint/Calibri tab and paint gates require independent fresh evidence.'};
  await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);assert.deepEqual(results.flatMap(result=>result.failures.map(failure=>result.id+': '+failure)),[]);
  console.log(`${results.length} actual metric SVG cases preserve source, accepted segment positions and nonzero ink containment.`);
}finally{await browser.close();}
