// Controlled SVG consumer of candidate core geometry; this is not the OPF renderer.
// node scripts/test-metric-layout-browser.mjs <registry-consumer> <geometry.json> [report.json] [renderer-checkout]
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {layoutMetric} from '../packages/javascript/dist/composition.js';
import {metricLayoutFixtures} from './metric-layout-fixtures.mjs';

assert.ok(!process.env.NODE_OPTIONS&&!process.execArgv.some(x=>/^(--import|--loader|--experimental-loader|--require|-r)(=|$)/.test(x)), 'Run without source aliases or preload/loader arguments.');
const [consumer,geometryFile,output,renderer='../opf-render']=process.argv.slice(2);
assert.ok(consumer&&geometryFile,'Provide the registry consumer and freshly generated candidate geometry report.');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const geometryBytes=await readFile(geometryFile),geometry=JSON.parse(geometryBytes);
for (const item of [...geometry.sourceHashes,...geometry.runtimeHashes]) assert.equal(hash(await readFile(item.file)),item.sha256,`Stale evidence: ${item.file}`);
for (const item of geometry.fontHashes) assert.equal(hash(await readFile(path.join(consumer,'node_modules',item.file))),item.sha256,`Changed measured font: ${item.file}`);
const require=createRequire(path.resolve(consumer,'package.json')),browserRequire=createRequire(path.resolve(renderer,'package.json'));
const {loadOfficeFontRegistry}=await import(pathToFileURL(require.resolve('@openpresentation/opf-render/fonts-node')));
const registry=await loadOfficeFontRegistry(),fixtures=metricLayoutFixtures();
assert.equal(fixtures.length,geometry.results.length);
const cases=fixtures.flatMap((fixture,index)=>{
  const recorded=geometry.results[index];assert.equal(fixture.id,recorded.id);assert.equal(fixture.family,recorded.family);assert.deepEqual(fixture.dimensions,recorded.dimensions);
  if (recorded.error) {assert.equal(recorded.error.code,'missing-glyph');assert.equal(recorded.error.details.character,fixture.missingGlyph);return [];}
  const layout=layoutMetric(fixture.metric,recorded.box,{fonts:{heading:fixture.family,body:fixture.family},path:'slides.0.metric',
    textMeasurement:registry.textMeasurement,scale:recorded.scale,minFontSize:fixture.minFontSize});
  assert.equal(layout.overflow,recorded.overflow);assert.equal(layout.arrangement,recorded.arrangement);
  for (const [i,part] of layout.parts.entries()) {
    assert.deepEqual(part.box,recorded.parts[i].box);assert.equal(hash(part.text),recorded.parts[i].textSha256);
    assert.deepEqual(part.style,recorded.parts[i].style);
  }
  return layout.overflow?[]:[{id:fixture.id,family:fixture.family,dimensions:fixture.dimensions,arrangement:layout.arrangement,box:recorded.box,parts:layout.parts}];
});
const styles=cases.flatMap(c=>c.parts.map(p=>p.style));
const faces=registry.embeddedFonts.filter(face=>styles.some(s=>s.fontFamily===face.family&&s.fontWeight===face.weight&&!!s.italic===!!face.italic));
for (const style of styles) assert.ok(faces.some(f=>f.family===style.fontFamily&&f.weight===style.fontWeight&&!!f.italic===!!style.italic),'Every resolved style needs exact font bytes, without synthetic weights');
const fontHashes=faces.map(face=>({family:face.family,weight:face.weight,italic:face.italic,sha256:hash(Buffer.from(face.dataUrl.split(',')[1],'base64')),license:face.license}));
for (const face of fontHashes) assert.ok(geometry.fontHashes.some(f=>f.sha256===face.sha256));
const browser=await browserRequire('playwright').chromium.launch({channel:process.platform==='win32'?'msedge':undefined});
const errors=[],externalRequests=[],results=[],screenshots=[];
try {
  const page=await browser.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))externalRequests.push(r.url());});
  await page.setContent('<style>body{margin:0;background:#fff}</style><svg id="probe" xmlns="http://www.w3.org/2000/svg"></svg>');
  await page.evaluate(async faces=>{
    for (const face of faces) document.fonts.add(await new FontFace(face.family,`url(${face.dataUrl})`,{weight:String(face.weight),style:face.italic?'italic':'normal'}).load());
    await document.fonts.ready;
  },faces);
  for (const item of cases) {
    await page.setViewportSize(item.dimensions);
    const result=await page.evaluate(item=>{
      const svg=document.querySelector('#probe'),ns='http://www.w3.org/2000/svg';
      svg.replaceChildren();svg.setAttribute('width',item.dimensions.width);svg.setAttribute('height',item.dimensions.height);
      const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
      const parts=item.parts.map(part=>{
        if (!part.visible) return {role:part.role,visible:false,text:part.text,lines:[]};
        context.font=`${part.style.fontWeight} ${part.fit.fontSize}px "${part.style.fontFamily}"`;
        const lines=part.fit.sourceLines.map((line,index)=>{
          const node=document.createElementNS(ns,'text'),baseline=part.box.y+part.fit.fontSize+index*part.fit.lineHeight;
          node.setAttribute('x',part.box.x);node.setAttribute('y',baseline);node.setAttribute('font-family',part.style.fontFamily);
          node.setAttribute('font-size',part.fit.fontSize);node.setAttribute('font-weight',part.style.fontWeight);
          node.setAttribute('text-rendering','geometricPrecision');node.setAttribute('xml:space','preserve');node.style.whiteSpace='pre';
          node.setAttribute('fill',part.role==='value'?'#194a72':'#243445');svg.append(node);
          const segments=line.segments.map(segment=>{
            const span=document.createElementNS(ns,'tspan'),text=part.text.slice(segment.start,segment.end),x=part.box.x+segment.x;
            span.setAttribute('x',x);
            if (segment.kind==='tab') {span.setAttribute('textLength',segment.width);span.setAttribute('lengthAdjust','spacingAndGlyphs');}
            span.textContent=text;node.append(span);
            const ink=context.measureText(text);
            return {kind:segment.kind,text,expectedX:x,expectedEndX:x+segment.width,actualX:span.getStartPositionOfChar(0).x,
              actualEndX:span.getEndPositionOfChar(span.getNumberOfChars()-1).x,
              ink:segment.kind==='tab'?null:{x:x-ink.actualBoundingBoxLeft,y:baseline-ink.actualBoundingBoxAscent,
                right:x+ink.actualBoundingBoxRight,bottom:baseline+ink.actualBoundingBoxDescent}};
          });
          const bbox=node.getBBox();
          return {text:part.text.slice(line.start,line.end),domText:node.textContent,expectedAdvance:line.width,actualAdvance:node.getComputedTextLength(),
            baseline,fontBox:{x:bbox.x,y:bbox.y,width:bbox.width,height:bbox.height},segments};
        });
        return {role:part.role,visible:true,box:part.box,fontSize:part.fit.fontSize,style:part.style,lines};
      });
      return {id:item.id,family:item.family,dimensions:item.dimensions,arrangement:item.arrangement,parts};
    },item);
    results.push(result);
    if (output&&item.family==='Carlito'&&((item.id==='all-metadata'&&item.dimensions.width===1280)||(item.id==='literal-whitespace'&&item.dimensions.width===540))) {
      const file=output.replace(/\.json$/,'')+`-${item.id}.png`;
      await page.screenshot({path:file});screenshots.push({file:path.basename(file),sha256:hash(await readFile(file))});
    }
  }
  const inkPartOverhangs=[],inkPartCollisions=[];
  for (const result of results) {
    const inks=[];
    for (const part of result.parts.filter(p=>p.visible)) for (const line of part.lines) for (const segment of line.segments.filter(s=>s.ink)) {
      const ink=segment.ink,overhang={left:Math.max(0,part.box.x-ink.x),right:Math.max(0,ink.right-part.box.x-part.box.width),
        top:Math.max(0,part.box.y-ink.y),bottom:Math.max(0,ink.bottom-part.box.y-part.box.height)};
      if (Object.values(overhang).some(v=>v>.1)) inkPartOverhangs.push({id:result.id,family:result.family,dimensions:result.dimensions,role:part.role,overhang});
      inks.push({...ink,role:part.role});
    }
    for (const [i,a] of inks.entries()) for (const b of inks.slice(i+1)) if (a.role!==b.role&&a.x<b.right-.1&&b.x<a.right-.1&&a.y<b.bottom-.1&&b.y<a.bottom-.1) {
      inkPartCollisions.push({id:result.id,family:result.family,dimensions:result.dimensions,roles:[a.role,b.role]});
    }
  }
  const report={browser:browser.version(),platform:process.platform,geometryReportSha256:hash(geometryBytes),verifierSha256:hash(await readFile(new URL(import.meta.url))),
    textRendering:'geometricPrecision',toleranceReferencePixels:.1,fontHashes,results,screenshots,errors,externalRequests,inkPartOverhangs,inkPartCollisions,
    scope:'Controlled SVG harness of standalone metric-flow-v1, with each accepted source line and tab positioned explicitly and exact resolved font bytes loaded offline. Checks DOM source and measured advances/segment positions; records Canvas ink estimates and SVG font boxes separately. This is not integrated OPF rendering/editing, native PPTX, glyph-outline equivalence, broad script conformance or a polished-layout guarantee.'};
  if (output) await writeFile(output,JSON.stringify(report,null,2)+'\n');
  for (const result of results) for (const part of result.parts) for (const line of part.lines) {
    assert.equal(line.domText,line.text);
    assert.ok(Math.abs(line.actualAdvance-line.expectedAdvance)<=.1,`Advance differs: ${result.family}/${result.id}/${part.role}: ${line.actualAdvance} vs ${line.expectedAdvance}`);
    for (const segment of line.segments) {
      assert.ok(Math.abs(segment.actualX-segment.expectedX)<=.1,`Segment start differs: ${result.family}/${result.id}/${part.role}`);
      assert.ok(Math.abs(segment.actualEndX-segment.expectedEndX)<=.1,`Segment end differs: ${result.family}/${result.id}/${part.role}`);
    }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);assert.deepEqual(inkPartCollisions,[],'Canvas ink estimates must not collide between metric parts');
  console.log(`Verified ${results.length} accepted metric layouts in browser ${report.browser}; exact source and advances, no external requests or page errors.`);
} finally {await browser.close();}
