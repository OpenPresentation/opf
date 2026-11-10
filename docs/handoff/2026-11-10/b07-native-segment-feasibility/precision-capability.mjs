import {transforms} from './precision-loader.mjs';
// Diagnostic only: existing full sources, frozen historical engines, no native automation or product imports added.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const OLD='C:/opf-work/rr105-sh26-rtl',COHORT='C:/opf-work/rtl-native-contrast-export-01';
const HEAD='473d3fff623bda3f191ae2669824f1b02a5d90f8',OUT='C:/opf-work/b07-segments/artifacts/capability03';
const IDS=['05-mixed-explicit-arabic','06-whole-explicit-arabic','09-long-explicit-arabic','10-non-ascii-digits','11-long-explicit-french'].map(x=>'rtl-contrast-'+x);
const sha=b=>createHash('sha256').update(b).digest('hex'),read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p).toString('utf8').replace(/^\uFEFF/,''));
const git=(...args)=>execFileSync('git',['--no-optional-locks','-C',OLD,...args],{encoding:'utf8',maxBuffer:8*1024*1024}).trim();
const save=(name,b)=>{const p=path.join(OUT,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b,{flag:'wx'});};
const saveJson=(name,x)=>save(name,JSON.stringify(x,null,2)+'\n');
assert.equal(process.version,'v24.20.0');assert.ok(!fs.existsSync(OUT),'Fresh named capability attempt only');fs.mkdirSync(OUT,{recursive:true});
let stage='preflight';
try {
 assert.equal(git('rev-parse','HEAD'),HEAD);assert.equal(git('status','--porcelain'),'');
 const old=json(COHORT+'/runtime-before.json'),build=json(COHORT+'/build.json');assert.equal(old.head,HEAD);assert.equal(build.revision,HEAD);
 const runtime=[];
 for(const pkg of old.packages)for(const f of pkg.dist){const file=OLD+'/packages/'+pkg.name+'/dist/'+f.path,b=read(file);assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);runtime.push({package:pkg.name,...f});}
 const inputs=IDS.map(id=>{const row=build.decks.find(x=>x.id===id);assert.ok(row);const source=read(COHORT+'/'+row.source),variant=row.variants.find(x=>x.name==='default');assert.equal(sha(source),row.sourceSha256);const pptx=read(COHORT+'/'+variant.pptx);assert.equal(sha(pptx),variant.sha256);save('inputs/'+id+'/source.opf.json',source);save('inputs/'+id+'/original.pptx',pptx);return{id,source:JSON.parse(source),sourceSha256:sha(source),pptxSha256:sha(pptx),pptx};});
 saveJson('preflight.json',{sourceHead:HEAD,runtime,inputs:inputs.map(({pptx,source,...x})=>x),producer:{path:process.argv[1],sha256:sha(read(process.argv[1]))},native:false,productEdits:false});
 const req=createRequire(OLD+'/packages/render/package.json'),wasmPath=req.resolve('harfbuzzjs/dist/harfbuzz.wasm'),wasm=read(wasmPath);
 const mod=async p=>import(pathToFileURL(OLD+'/packages/'+p).href);
 const [{loadFonts},{toSvg},{FontLibrary},{layoutText},{parseXml,textContent},{ROOT_STYLE,inheritStyle,attributesOf,parseFontFamilies},{createShaper},{gallery}]=await Promise.all([
 mod('render/dist/fonts-node.js'),mod('render/dist/svg.js'),mod('render/dist/pdf-fonts.js'),mod('render/dist/pdf-text.js'),mod('render/dist/pdf-xml.js'),mod('render/dist/pdf-style.js'),mod('render/dist/hb-shape.js'),mod('gallery/dist/index.js')]);
 const {unzip,parseXml:nativeXml}=await import('file:///C:/opf-work/b07-composite-audit01/data-tools.mjs');
 const local=n=>n.name?.slice(n.name.indexOf('}')+1),find=(n,name)=>[...(local(n)===name?[n]:[]),...(n.children??[]).filter(x=>x.name).flatMap(x=>find(x,name))],attrs=n=>n?Object.fromEntries(Object.entries(n.attributes).map(([k,v])=>[k.replace('{}',''),v])):{},nativeText=n=>(n.children??[]).map(x=>x.text??'').join('');
 const all=[],diagnostics=[];stage='font-setup';
 const fonts=await loadFonts({pack:'office',scripts:'auto',substitutionPolicy:'visual',presentation:inputs[0].source,renderOptions:{catalogs:[gallery]},onDiagnostic:d=>diagnostics.push(d)});
 for(const x of inputs)await fonts.ensure(x.source,{renderOptions:{catalogs:[gallery]}});
 const fontFiles=fonts.fontFiles.map(file=>({file,bytes:read(file).length,sha256:sha(read(file))}));
 const shaper=createShaper(wasm);
 for(const x of inputs){
  stage='geometry:'+x.id;
  const svg=toSvg(x.source,1,{fonts,catalogs:[gallery],trace:true,date:'2026-11-08'});save('geometry/'+x.id+'.svg',svg);
  const tree=parseXml(svg),texts=[];
  const walk=(node,parent)=>{if(node.text!==undefined)return;const own=inheritStyle(parent,attributesOf(node));if(node.name==='text')texts.push({node,parentStyle:parent,style:own});for(const c of node.children??[])if(c.name)walk(c,own);};walk(tree,ROOT_STYLE);
  const familyNames=new Set(texts.flatMap(t=>{const names=[];const add=n=>{if(n.name){if(n.attrs?.['font-family'])names.push(...parseFontFamilies(n.attrs['font-family']));for(const c of n.children??[])add(c);}};add(t.node);names.push(...parseFontFamilies(t.style['font-family']));return names.map(x=>x.toLowerCase());}));
  const library=new FontLibrary(),exported=fonts.registry.exportFaces(),described=fonts.registry.describeFaces();
  exported.forEach((f,i)=>{if(!familyNames.has(f.family.toLowerCase()))return;const face=library.addData(f.data,'pinned-font',f.family);assert.ok(face&&face.embeddable);face.weight=described[i].weight;face.italic=described[i].italic;});
  const env={fonts:library,defaults:[],splitByOwner:true,shape:(face,text,o)=>shaper.shape(face.hash,face.data,text,{...o,language:o.lang}),diagnostic:d=>diagnostics.push(d),missing:d=>{throw Error('Missing glyph '+JSON.stringify(d));},unavailable:families=>Error('Missing face '+families)};
  const planned=texts.map(({node,parentStyle})=>{const result=layoutText(node,env,parentStyle);for(const r of result.runs){assert.ok(Number.isFinite(r.width)&&r.width>=0);if(r.logical.trim()){assert.ok(r.glyphs.length>0,'Nonempty text must have glyphs');assert.ok(r.width>0,'Nonempty text must have positive advance');}}return{svgText:textContent(node),attrs:node.attrs,runs:result.runs.map(r=>({logical:r.logical,text:r.text,start:r.start,level:r.level,x:r.x,y:r.y,width:r.width,size:r.size,natural:r.natural,scale:r.scale,scaleX:r.scaleX,extraSpacing:r.extraSpacing??0,face:{hash:r.face.hash,names:[...r.face.names],weight:r.face.weight,italic:r.face.italic},owner:r.owner?.attrs,style:r.style,glyphs:r.glyphs.map(g=>({gid:g.gid,codePoints:g.codePoints,advance:g.advance,xOffset:g.xOffset,yOffset:g.yOffset,spacing:g.spacing}))}))};});
  const z=unzip(x.pptx),slide=nativeXml(z.get('ppt/slides/slide1.xml'));
  const shapes=find(slide,'sp').map(sp=>({name:attrs(find(sp,'cNvPr')[0]).name,frame:{...attrs(find(sp,'off')[0]),...attrs(find(sp,'ext')[0])},body:find(sp,'bodyPr')[0],paragraphs:find(sp,'p').map(p=>({properties:find(p,'pPr')[0],runs:find(p,'r').map(r=>({text:find(r,'t').map(nativeText).join(''),properties:find(r,'rPr')[0]}))}))}));
  const result={id:x.id,sourceSha256:x.sourceSha256,pptxSha256:x.pptxSha256,shapeCount:shapes.length,shapes,planned};all.push(result);saveJson('geometry/'+x.id+'.json',result);console.log('PLANNED '+x.id+' nativeShapes='+shapes.length+' svgTexts='+planned.length);
 }
 assert.equal(git('rev-parse','HEAD'),HEAD);assert.equal(git('status','--porcelain'),'');
 saveJson('precision-transform.json',transforms);assert.equal(transforms.length,1);const after=[];for(const pkg of old.packages)for(const f of pkg.dist){const b=read(OLD+'/packages/'+pkg.name+'/dist/'+f.path);assert.equal(sha(b),f.sha256);after.push(f.sha256);}
 saveJson('geometry.json',{scope:'DIAGNOSTIC full-line shaping only; no variant admitted or native result',sourceHead:HEAD,wasm:{file:wasmPath,bytes:wasm.length,sha256:sha(wasm)},fontFiles,diagnostics,cases:all});saveJson('terminal.json',{status:0,stage:'full-line-plan-captured',cases:all.length,variantsWritten:0,native:false,sourceDistUnchanged:true,finished:new Date().toISOString()});
}catch(error){saveJson('terminal.json',{status:1,stage,name:error.name,message:error.message,stack:error.stack,variantsWritten:0,native:false,finished:new Date().toISOString()});console.error(error);process.exitCode=1;}