import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const sourceRequire=createRequire(new URL('../../opf-render/package.json',import.meta.url)),{chromium}=sourceRequire('playwright');
const output=path.resolve(process.argv[2]??'artifacts/readability-browser'),installed=process.argv[3]==='installed';
const consumer=path.resolve('artifacts/npm/consumer'),require=installed?createRequire(path.join(consumer,'package.json')):sourceRequire;
const moduleUrl=(name,source)=>installed?pathToFileURL(require.resolve(name)).href:new URL(source,import.meta.url).href;
const {renderSvg,resolvePresentation}=await import(moduleUrl('@openpresentation/opf-render','../../opf-render/dist/svg.js'));
const {prepareNodeFonts}=await import(moduleUrl('@openpresentation/opf-render/fonts-node','../../opf-render/dist/fonts-node.js'));
const {toPptx}=await import(moduleUrl('@openpresentation/opf-pptx','../../opf-pptx/dist/index.js'));
const pptxRequire=installed?require:createRequire(new URL('../../opf-pptx/package.json',import.meta.url)),{unzipSync}=pptxRequire('fflate'),{XMLParser}=pptxRequire('fast-xml-parser');
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false}),array=v=>v===undefined?[]:Array.isArray(v)?v:[v];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),{registry,options:fontOptions}=await prepareNodeFonts();
const rich=['Visible ',{text:'small requested run',fontSize:9,bold:true},' and x',{text:'2',superscript:true}];
const fixtures=[{text:'Short plain text retains its words.'},{text:rich},{items:[{text:'First idea',description:'Supporting detail.'},{text:'Second idea',description:[{text:'Small request',fontSize:9,italic:true}]}]},{table:{columns:['Item','Value'],rows:[['Plain cell',rich],['Second row','Readable data']]}}];
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:process.platform==='win32'&&!process.env.CI?'msedge':undefined}),results=[],errors=[],requests=[];
try {
 const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));await page.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});await page.setContent('<style>body{margin:0}</style><main></main>');
 await page.evaluate(async faces=>{for(const face of faces)document.fonts.add(await new FontFace(face.family,`url(${face.dataUrl})`,{weight:String(face.weight),style:face.italic?'italic':'normal'}).load());await document.fonts.ready;},registry.embeddedFonts);
 for(const measured of [false,true])for(const [width,height]of [[1280,720],[720,1280]])for(const floor of [16,24,32])for(const [fixture,payload]of fixtures.entries()) {
  const deck={design:{fontScheme:'roboto',dimensions:{widthInches:width/96,heightInches:height/96}},slides:[{title:'Readable source',tag:'Floor test',composition:{minFontSize:floor,overflow:'error'},...structuredClone(payload)}]},before=structuredClone(deck),options={trace:true,...(measured?{textMeasurement:fontOptions.textMeasurement}:{})};
  const bound=resolvePresentation(deck,options).slides[0],svg=renderSvg(deck,options);assert.deepEqual(deck,before);assert.deepEqual(bound.geometry.diagnostics,[]);
  await page.setViewportSize({width,height});
  const glyphs=await page.evaluate(async svg=>{
   document.querySelector('main').innerHTML=svg;await document.fonts.ready;
   return [...document.querySelectorAll('text,tspan')].flatMap(node=>{
    const text=[...node.childNodes].filter(child=>child.nodeType===Node.TEXT_NODE).map(child=>child.textContent).join('');
    return text?[{text,path:node.closest('[data-opf-path]')?.getAttribute('data-opf-path'),size:parseFloat(getComputedStyle(node).fontSize),family:getComputedStyle(node).fontFamily}]:[];
   });
  },svg);
  assert.ok(glyphs.length>2);for(const glyph of glyphs)assert.ok(glyph.size+1e-4>=floor,JSON.stringify({measured,width,height,floor,fixture,glyph}));
  const bytes=await toPptx(deck,options),files=unzipSync(bytes),xml=parser.parse(new TextDecoder().decode(files['ppt/slides/slide1.xml'])),native=[];
  const visit=node=>{if(!node||typeof node!=='object')return;for(const run of array(node['a:r'])){if(String(run['a:t']??''))native.push({text:String(run['a:t']),points:Number(run['a:rPr']?.sz)/100});}for(const [key,value]of Object.entries(node))if(key!=='a:r')for(const child of array(value))visit(child);};visit(xml);
  assert.ok(native.length>2);for(const run of native)assert.ok(Number.isFinite(run.points)&&run.points+.005>=floor*.75,JSON.stringify({measured,width,height,floor,fixture,run}));
  results.push({measured,width,height,floor,fixture,glyphs,native,svgSha256:hash(svg),pptxSha256:hash(bytes)});
  if(measured&&floor===32&&(fixture===1||fixture===3)){const name=`${fixture===1?'rich':'table'}-${width}`;await writeFile(path.join(output,`${name}.svg`),svg);await page.screenshot({path:path.join(output,`${name}.png`)});}
 }
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 await writeFile(path.join(output,'report.json'),JSON.stringify({node:process.version,browser:browser.version(),installed,lockSha256:installed?hash(await readFile(path.join(consumer,'package-lock.json'))):undefined,verifierSha256:hash(await readFile(new URL(import.meta.url))),results,errors,requests,scope:'48 offline measured/estimated wide/portrait browser cases at selected floors 16/24/32; actual SVG glyph font sizes and separately parsed editable native run sizes. Source metadata stays exact. Browser sizes allow 0.0001px serialization precision and native sizes allow half a 0.01pt unit. No native Office execution, raster equivalence or general layout-quality certification.'},null,2)+'\n');
 console.log('48 offline browser/PPTX cases honor selected glyph floors while preserving source metadata.');
}finally{await browser.close();}
