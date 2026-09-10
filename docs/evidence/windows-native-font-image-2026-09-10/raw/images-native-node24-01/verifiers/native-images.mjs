import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import sharp from 'sharp';
import {validatePresentation} from '@openpresentation/opf';
import {renderSvg} from '@openpresentation/opf-render';
import {createEditorSession} from '../../opf-editor/dist/index.js';
import {toPptx,fromPptx} from '../dist/index.js';
import {sha,json,fingerprint} from './native-evidence.mjs';
const [mode,directory]=process.argv.slice(2);assert.ok(['generate','compare'].includes(mode));
const root=path.resolve(directory),runtime=await fingerprint(['test/native-images.mjs','test/native-images.ps1'],{editor:true});
const write=(file,value)=>writeFile(path.join(root,file),JSON.stringify(value,null,2)+'\n');
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const array=v=>v==null?[]:Array.isArray(v)?v:[v];
const find=(v,key)=>!v||typeof v!=='object'?[]:Array.isArray(v)?v.flatMap(x=>find(x,key)):Object.entries(v).flatMap(([k,x])=>k===key?array(x):find(x,key));
const formats=['wide.png','tall.png','square.png','wide.jpg','wide-progressive.jpg','wide.gif','wide.webp','wide-lossy.webp','wide-alpha.webp'];
const options={imageFormat:'preserve',strictAssets:true};
if(mode==='generate'){
 await mkdir(root,{recursive:true});await assert.rejects(readFile(path.join(root,'generation.json')),e=>e.code==='ENOENT');
 const sources=[];
 for(const name of formats){const bytes=await readFile(new URL('fixtures/images/'+name,import.meta.url));const mime=name.endsWith('.jpg')?'jpeg':name.split('.').at(-1);sources.push(`data:image/${mime};base64,${bytes.toString('base64')}`);}
 const source={design:{theme:'classic',imageFill:'fit'},slides:sources.map((src,i)=>({id:'image-'+i,image:{src,alt:formats[i]}}))};
 const original=structuredClone(source),editor=createEditorSession(source,{rejectInvalid:true}),baseline=await toPptx(source,options);
 const patches=[{op:'test',path:'/slides/0/id',value:'image-0'},{op:'test',path:'/slides/0/image/src',value:sources[0]},{op:'replace',path:'/slides/0/image/src',value:sources[1]},{op:'replace',path:'/slides/0/image/alt',value:'Editor replaced wide with tall'}];
 editor.applyPatch(patches,{source:'native-fixture'});const edited=editor.document,editBytes=await toPptx(edited,options);
 assert.notDeepEqual(editBytes,baseline);assert.equal(editor.snapshot().undoDepth,1);assert.deepEqual(editor.undo().document,original);assert.deepEqual(await toPptx(editor.document,options),baseline);assert.deepEqual(editor.redo().document,edited);assert.deepEqual(await toPptx(editor.document,options),editBytes);assert.deepEqual(source,original);
 assert.throws(()=>editor.applyPatch([{op:'test',path:'/slides/0/id',value:'stale-id'},{op:'replace',path:'/slides/0/image/alt',value:'Must not apply'}]));assert.deepEqual(editor.document,edited);
 await write('editor-undo.json',{patches,passed:true,atomicUndoDepth:1,sourceUnchanged:true,undoRestoresDocumentAndPptx:true,redoRestoresDocumentAndPptx:true,staleGuardRejected:true,originalPptxSha256:sha(baseline),editedPptxSha256:sha(editBytes)});
 const decks=[];
 for(const [id,document]of [['images-fit',source],['images-crop',{...source,design:{...source.design,imageFill:'crop'}}],['images-editor-redo',edited]]){
  assert.ok(validatePresentation(document).valid);const bytes=await toPptx(document,options);assert.deepEqual(await toPptx(document,options),bytes);
  await writeFile(path.join(root,id+'.pptx'),bytes);await write(id+'.opf.json',document);const zip=unzipSync(bytes),records=[];
  for(const [i,slide]of document.slides.entries()){
   const svg=renderSvg({...document,slides:[slide]},{trace:true});await writeFile(path.join(root,`${id}-${i+1}.svg`),svg);
   const image=find(parser.parse(svg),'image')[0],cell=Object.fromEntries(['x','y','width','height'].map(k=>[k,Number(image[k])]));
   const sourceBytes=Buffer.from(slide.image.src.split(',')[1],'base64'),meta=await sharp(sourceBytes).metadata();
   const fill=document.design.imageFill,scale=(fill==='crop'?Math.max:Math.min)(cell.width/meta.width,cell.height/meta.height);
   const content={x:cell.x+(cell.width-meta.width*scale)/2,y:cell.y+(cell.height-meta.height*scale)/2,width:meta.width*scale,height:meta.height*scale};
   const box=fill==='crop'?cell:content;
   const picture=find(parser.parse(new TextDecoder().decode(zip[`ppt/slides/slide${i+1}.xml`])),'p:pic')[0],transform=picture['p:spPr']['a:xfrm'];
   for(const [key,observed]of Object.entries({x:Number(transform['a:off'].x)/9525,y:Number(transform['a:off'].y)/9525,width:Number(transform['a:ext'].cx)/9525,height:Number(transform['a:ext'].cy)/9525}))assert.ok(Math.abs(observed-box[key])<.002,`${id} ${i} ${key}`);
   assert.ok(Object.entries(zip).some(([file,data])=>file.startsWith('ppt/media/')&&Buffer.from(data).equals(sourceBytes)));
   records.push({slide:i+1,alt:slide.image.alt,sourceSha256:sha(sourceBytes),sourceUri:slide.image.src,sourceWidth:meta.width,sourceHeight:meta.height,fill,cell,box,content});
  }
  decks.push({id,pptxSha256:sha(bytes),sourceSha256:sha(await readFile(path.join(root,id+'.opf.json'))),records});
 }
 await write('generation.json',{node:process.version,runtime,decks,scope:'Nine raster formats/aspects in fit/crop plus an atomic editor source replacement and undo/redo. Native alt edits and current image-byte imports are distinct from arbitrary picture-position/crop round trips.'});
}else{
 const g=await json(path.join(root,'generation.json'));assert.deepEqual(runtime,g.runtime);const observations=[],outliers=[],imports=[];
 for(const deck of g.decks){
  const native=await json(path.join(root,`runs/${deck.id}/native.json`)),worker=await json(path.join(root,`runs/${deck.id}/worker.json`));assert.equal(worker.exitCode,0);assert.equal(worker.timedOut,false);assert.equal(native.generationSha256,sha(await readFile(path.join(root,'generation.json'))));
  for(const phase of native.phases){
   assert.equal(phase.slides.length,9);
   for(const slide of phase.slides){
    const record=deck.records[slide.slide-1];assert.equal(slide.alt,phase.phase==='edited'?'Native alt '+record.alt:record.alt);
    for(const key of ['x','y','width','height'])if(Math.abs(slide.box[key]/.75-record.box[key])>.02)outliers.push({deck:deck.id,phase:phase.phase,slide:slide.slide,kind:'native-geometry',key,expected:record.box[key],actual:slide.box[key]/.75});
    const png=await readFile(path.join(root,slide.png));assert.equal(sha(png),slide.sha256);
    const raster=await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(raster.info.width,1280);assert.equal(raster.info.height,720);
    const source=await sharp(Buffer.from(record.sourceUri.split(',')[1],'base64')).flatten({background:'#ffffff'}).removeAlpha().raw().toBuffer({resolveWithObject:true});
    const samples=[];
    for(const ux of [.2,.8])for(const uy of [.2,.8]){
     const x=Math.floor(record.box.x+record.box.width*ux),y=Math.floor(record.box.y+record.box.height*uy);
     const sx=Math.max(0,Math.min(source.info.width-1,Math.floor((x+.5-record.content.x)/record.content.width*source.info.width))),sy=Math.max(0,Math.min(source.info.height-1,Math.floor((y+.5-record.content.y)/record.content.height*source.info.height)));
     const actual=[...raster.data.subarray((y*1280+x)*3,(y*1280+x)*3+3)],expected=[...source.data.subarray((sy*source.info.width+sx)*3,(sy*source.info.width+sx)*3+3)],error=Math.max(...actual.map((v,i)=>Math.abs(v-expected[i])));
     samples.push({x,y,sx,sy,actual,expected,maximumChannelError:error});if(error>12)outliers.push({deck:deck.id,phase:phase.phase,slide:slide.slide,kind:'interior-color',x,y,error});
    }
    observations.push({deck:deck.id,phase:phase.phase,slide:slide.slide,samples});
   }
  }
  assert.deepEqual(native.phases[0].slides.map(s=>s.sha256),native.phases[1].slides.map(s=>s.sha256));assert.deepEqual(native.phases[0].slides.map(s=>s.sha256),native.phases[2].slides.map(s=>s.sha256));
  for(const suffix of ['', '-saved','-edited']){
   const file=deck.id+suffix+'.pptx',bytes=await readFile(path.join(root,file));assert.equal(sha(bytes),suffix===''?deck.pptxSha256:suffix==='-saved'?native.savedSha256:native.editedSha256);
   let restored=await fromPptx(bytes);
   for(let cycle=0;cycle<3;cycle++){
    assert.ok(validatePresentation(restored).valid);assert.equal(restored.slides.length,9);
    for(const [index,slide]of restored.slides.entries()){
     assert.equal(slide.blocks.length,1);assert.equal(slide.blocks[0].type,'image');const image=slide.blocks[0].image;assert.equal(image.alt,(suffix==='-edited'?'Native alt ':'')+deck.records[index].alt);assert.equal(sha(Buffer.from(image.src.split(',')[1],'base64')),deck.records[index].sourceSha256);
    }
    await write(`${file}.cycle-${cycle}.opf.json`,restored);imports.push({file,cycle,slides:9,exactCurrentImageBytesAndAlt:true});if(cycle<2)restored=await fromPptx(await toPptx(restored,options));
   }
  }
 }
 await write('comparison.json',{node:process.version,passed:outliers.length===0,nativeSlideObservations:observations.length,interiorSamples:observations.length*4,geometryToleranceReferencePixels:.02,maximumInteriorChannelError:12,observations,outliers,imports,scope:'Native geometry, selected interior colors and save/reopen pixels; current image bytes/alt across two further export/import cycles. These samples do not establish whole-image pixel equivalence, animated playback, or arbitrary native crop/position import.'});
 assert.equal(outliers.length,0,'Native image outliers retained in comparison.json');console.log('Native images: 81 slide observations, 324 interior samples, 27 real alt edits and 243 current image-byte/alt imports including repeated exports.');
}
