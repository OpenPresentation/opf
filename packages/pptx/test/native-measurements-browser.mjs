// RR-114: real browser loader + renderer + native exporter, with hash-pinned local fonts.
// This is a browser/archive regression, not PowerPoint glyph or editing qualification.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {loadFonts,BUNDLED_FONT_MANIFEST} from '@openpresentation/opf-render/fonts-node';

const root=fileURLToPath(new URL('../',import.meta.url));
const renderRoot=path.resolve(fileURLToPath(import.meta.resolve('@openpresentation/opf-render/fonts-node')),'../..');
const output=path.join(root,'artifacts/native-measurements-browser');
await mkdir(output,{recursive:true});
const document={slides:[{title:'Title',text:[
  {text:'Bonjour 1\nWelcome 2 ',language:'ar-SA',fontFamily:'Georgia'},
  {text:'Hello 2',language:'ar-SA',fontFamily:'Times New Roman'},
]}]};
const initial=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:document});
const full=await loadFonts({pack:'office',substitutionPolicy:'visual'});
const described=full.registry.describeFaces(),bytes=full.registry.exportFaces();
assert.equal(described.length,bytes.length);
const faces=described.map((face,index)=>({...face,index,bytes:Buffer.from(bytes[index].data)}));
// Arimo is an office-pack host resource, not a vendored browser file. Advertise
// its real pinned faces through the existing extraLazyFonts API; nothing eager.
const host=faces.filter(face=>face.family==='Arimo').map(face=>({family:face.family,weight:face.weight,italic:face.italic,url:`https://app.test/host/${face.index}.ttf`,sha256:createHash('sha256').update(face.bytes).digest('hex')}));
assert.equal(host.length,4);
const initialKeys=initial.registry.describeFaces().map(face=>JSON.stringify([face.family,face.weight,face.italic]));
const startup=faces.filter(face=>initialKeys.includes(JSON.stringify([face.family,face.weight,face.italic])));
assert.equal(startup.length,3,'The fixture starts with only the three SVG-selected faces');
assert.ok(!startup.some(face=>face.family==='Intos'&&face.weight===400));
const fallback=faces.find(face=>face.family==='Roboto'&&face.weight===400&&!face.italic);assert.ok(fallback);
const bundle=await build({
  stdin:{contents:`import{loadFonts}from'@openpresentation/opf-render/fonts-browser';import{toSvg}from'@openpresentation/opf-render/svg';import{toPptx,fromPptx}from'./dist/index.js';import{unzipSync,strFromU8}from'fflate';window.opf={loadFonts,toSvg,toPptx,fromPptx,unzipSync,strFromU8};`,resolveDir:root,sourcefile:'native-measurements-browser-entry.js'},
  bundle:true,platform:'browser',format:'iife',write:false,minify:true,metafile:true,
});
assert.ok(!Object.keys(bundle.metafile.inputs).some(input=>/fonts-node\.js|image-fallback-node|node-resolve\.js/.test(input)),'The actual browser bundle has no Node-only font or image loader');
const allowed=new Map(BUNDLED_FONT_MANIFEST.packages.filter(pkg=>pkg.vendored).flatMap(pkg=>pkg.faces.map(face=>[`${pkg.vendored}/${face.file}`,path.join(renderRoot,pkg.vendored,face.file)])));
const browser=await chromium.launch({channel:process.platform==='win32'&&!process.env.CI?'msedge':undefined});
const report={browser:browser.version(),cases:[],unexpected:[],errors:[]};
try{
  for(const{typefaces,svgControl}of[{typefaces:'selected'},{typefaces:'safe'},{typefaces:'safe',svgControl:true}]){
    const page=await browser.newPage({viewport:{width:1100,height:700}}),requests=[];
    page.on('pageerror',error=>report.errors.push(error.message));
    await page.route(/^https?:/,async route=>{
      const url=new URL(route.request().url());
      if(url.href==='https://app.test/')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><main></main>'});
      const eager=/^\/eager\/(\d+)\.ttf$/.exec(url.pathname);
      if(eager)return route.fulfill({contentType:'font/ttf',body:faces[Number(eager[1])].bytes});
      const hosted=/^\/host\/(\d+)\.ttf$/.exec(url.pathname);
      if(hosted){requests.push(url.pathname.slice(1));return route.fulfill({contentType:'font/ttf',body:faces[Number(hosted[1])].bytes});}
      const file=url.pathname.slice(1);
      if(allowed.has(file)){requests.push(file);return route.fulfill({contentType:'font/ttf',body:await readFile(allowed.get(file))});}
      report.unexpected.push(url.href);return route.abort();
    });
    await page.goto('https://app.test/');await page.addScriptTag({content:bundle.outputFiles[0].text});
    const result=await page.evaluate(async({source,startup,all,typefaces,host,svgControl})=>{
      const {loadFonts,toSvg,toPptx,fromPptx,unzipSync,strFromU8}=window.opf;
      const options={substitutionPolicy:'visual',lazyFontsBaseUrl:'https://app.test/',extraLazyFonts:host};
      const inputs=list=>list.map(({index,...face})=>({...face,url:`/eager/${index}.ttf`}));
      const fonts=await loadFonts({...options,faces:inputs(startup)}),eager=await loadFonts({...options,faces:inputs(all)});
      const key=face=>`${face.family}/${face.weight}/${face.italic}`;
      const before=fonts.registry.describeFaces().map(key),requests=[],ensure=fonts.ensure.bind(fonts);
      fonts.ensure=(document,options)=>{requests.push(...(options?.measurementRequests??[]));return ensure(document,options);};
      const xml=bytes=>Object.fromEntries(Object.entries(unzipSync(bytes)).filter(([name])=>/^ppt\/(slides|theme)\/.*\.xml$/.test(name)).map(([name,value])=>[name,strFromU8(value)]));
      try{
        const previewBefore=svgControl?toSvg(source,1,{fonts,text:'paths'}):null;
        const refusals=[];
        for(const measurementRequests of [
          [{text:'x',size:24,style:{fontFamily:'Absent Browser Family',fontWeight:400}}],
          [{text:'x',size:NaN,style:{fontFamily:'Aptos',fontWeight:400}}],
        ]){
          try{await fonts.ensure(source,{measurementRequests});refusals.push('unexpected success');}
          catch(error){refusals.push(error.code);}
        }
        const afterRefusals=fonts.registry.describeFaces().map(key);
        const exportOptions={bodyText:'native',typefaces,date:'2026-11-10'};
        const expected=await toPptx(source,{...exportOptions,fonts:eager});
        const actual=await toPptx(source,{...exportOptions,fonts});
        const first=xml(actual),prepared=fonts.registry.describeFaces().map(key);
        // The three-face fixture lacks an undrawn default SVG role before a
        // safe export too. Keep native acceptance separate; the control adds
        // the host's ordinary Roboto fallback to compare SVG before/after.
        const preview=svgControl||typefaces==='selected'?toSvg(source,1,{fonts,text:'paths'}):null;
        const repeated=xml(await toPptx(source,{...exportOptions,fonts}));
        const after=fonts.registry.describeFaces().map(key),repeatedPreview=preview===null?null:toSvg(source,1,{fonts,text:'paths'});
        globalThis.document.querySelector('main').innerHTML=preview??'';
        await globalThis.document.fonts.ready;
        return{passed:true,before,prepared,after,actual:first,expected:xml(expected),repeated,previewBefore,preview,repeatedPreview,requests,refusals,afterRefusals,
          imported:await fromPptx(actual),expectedImported:await fromPptx(expected),source,
          loaded:[...globalThis.document.fonts].map(face=>({family:face.family,status:face.status}))};
      }catch(error){return{passed:false,code:error.code,message:error.message,details:error.details,before,requests};}
      finally{fonts.dispose();eager.dispose();}
    },{source:document,startup:(svgControl?[...startup,fallback]:startup).map(({bytes,...face})=>face),all:faces.map(({bytes,...face})=>face),typefaces,host,svgControl});
    report.cases.push({typefaces,svgControl:!!svgControl,requests,result});
    if(result.passed&&result.preview!==null)await page.screenshot({path:path.join(output,`${typefaces}${svgControl?'-svg-control':''}.png`)});
    await page.close();
  }
}finally{
  await browser.close();initial.dispose?.();full.dispose?.();
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
}
assert.deepEqual(report.errors,[]);assert.deepEqual(report.unexpected,[]);
for(const{typefaces,svgControl,requests,result}of report.cases){
  assert.equal(result.passed,true,`${typefaces}: ${JSON.stringify(result)}`);
  assert.deepEqual(result.actual,result.expected,`${typefaces}: exact eager native geometry and chosen typefaces`);
  assert.deepEqual(result.refusals,['font-unavailable','invalid-font-measurement-request']);
  assert.deepEqual(result.afterRefusals,result.before,'Rejected requests do not add faces or poison a later export');
  assert.deepEqual(result.repeated,result.actual);assert.deepEqual(result.after,result.prepared);
  assert.equal(result.repeatedPreview,result.preview,'Native preparation leaves repeated SVG subsets stable');
  if(svgControl)assert.equal(result.preview,result.previewBefore,'A prepared ordinary SVG is unchanged by native-only safe preparation');
  assert.deepEqual(result.imported,result.expectedImported);assert.deepEqual(result.source,document);
  assert.ok(result.prepared.length<10,'The demand handle never loads the complete office pack');
  assert.ok(result.requests.some(request=>request.text==='abcdefghijklmnopqrstuvwxyz'),'Actual native alphabet preparation ran');
  if(typefaces==='selected'){
    assert.deepEqual(result.prepared.filter(key=>!result.before.includes(key)),['Intos/400/false']);
    assert.deepEqual(requests,['fonts/intos/Intos-Regular.ttf'],'Exactly the missing default measurement face is fetched once');
  }
  const slide=result.actual['ppt/slides/slide1.xml'];
  assert.match(slide,/name="OPF native body slides\.0\.text"/);
  assert.equal([...slide.matchAll(/<a:p>/g)].length>=2,true);
  assert.match(slide,typefaces==='selected'?/typeface="Georgia"/:/typeface="Times New Roman"/);
  assert.ok(result.loaded.every(face=>face.status==='loaded'),'The real browser loaded every registered FontFace');
}
console.log(JSON.stringify({passed:true,browser:report.browser,cases:report.cases.map(({typefaces,requests,result})=>({typefaces,requests,faces:result.prepared.length}))}));
