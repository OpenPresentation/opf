import assert from 'node:assert/strict';
import{mkdir,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import{createRequire}from'node:module';
import{fileURLToPath}from'node:url';
import{gallery}from'../../../../packages/gallery/dist/index.js';
import{composeSlideGeometry}from'../../../../packages/editor/dist/slide-adapter.js';
import{slideScene}from'../../../../packages/editor/dist/slide-scene.js';
import{prepareSceneTrackResize}from'../../../../packages/editor/dist/slide-edits.js';
import{toSvg,resolvePresentation}from'../../../../packages/render/dist/index.js';
import{toPng}from'../../../../packages/render/dist/png.js';
import{loadFonts}from'../../../../packages/render/dist/fonts-node.js';
const here=new URL('./',import.meta.url),require=createRequire(new URL('../../../../packages/render/package.json',import.meta.url)),sharp=require('sharp'),catalogs=[gallery],records=[],panels=[];
const hash=x=>createHash('sha256').update(x).digest('hex');
const texts=g=>g.items.filter(i=>i.field==='text').map(i=>({path:i.path,value:i.value,box:i.box,fontSize:i.text.fontSize}));
const dividers=s=>s.node(s.slideKey).container.tracks.slice(0,-1).map(t=>t.start+t.length);
for(const[id,language,boundary,delta]of[['en-first-up','en',0,-.1],['en-last-down','en',1,.1],['ar-first-up','ar',0,-.1],['ja-last-down','ja',1,.1]]){
 const doc={language,design:{fontScheme:'roboto'},slides:[{id:'stack',title:'Centered track resize',composition:{mode:'column'},blocks:Array.from({length:3},(_,i)=>({id:'b'+i,text:language==='ar'?'نص قصير '+(i+1):language==='ja'?'短い文章 '+(i+1):['Short line','Another short line','Third'][i]}))}]};
 const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:doc,renderOptions:{catalogs}});
 const beforeGeometry=resolvePresentation(doc,{catalogs,fonts}).slides[0].geometry,before=slideScene(doc,0,{geometry:beforeGeometry}),tracks=before.node(before.slideKey).container.tracks,a=tracks[boundary],b=tracks[boundary+1];
 const rest=prepareSceneTrackResize(doc,before,before.slideKey,boundary,a.length/(a.length+b.length),{catalogs});assert.equal(rest.changed,false);assert.deepEqual(rest.presentation,doc);
 const prepared=prepareSceneTrackResize(doc,before,before.slideKey,boundary,a.length/(a.length+b.length)+delta,{catalogs}),afterGeometry=resolvePresentation(prepared.presentation,{catalogs,fonts}).slides[0].geometry,after=slideScene(prepared.presentation,0,{geometry:afterGeometry});
 assert.deepEqual(doc.slides[0].blocks,prepared.presentation.slides[0].blocks);assert.deepEqual(texts(beforeGeometry).map(i=>i.fontSize),texts(afterGeometry).map(i=>i.fontSize));
 const images=[];for(const[side,document]of[['before',doc],['after',prepared.presentation]]){const svg=toSvg(document,1,{catalogs,fonts,trace:true}),png=await toPng(svg,{fonts});await writeFile(new URL(id+'-'+side+'.svg',here),svg);await writeFile(new URL(id+'-'+side+'.png',here),png);await writeFile(new URL(id+'-'+side+'.opf.json',here),JSON.stringify(document,null,2)+'\n');images.push({side,svgSha256:hash(svg),pngSha256:hash(png)});panels.push({input:png,left:side==='before'?0:1280,top:records.length*756+36});}
 records.push({id,language,boundary,delta,fonts:'actual pinned Office visual replacement pack + per-document automatic scripts; no system font discovery',atRestExact:true,weights:prepared.weights,before:texts(beforeGeometry),after:texts(afterGeometry),beforeDividers:dividers(before),afterDividers:dividers(after),images});
}
const labels=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="3024">'+records.map((r,i)=>'<rect x="0" y="'+(i*756)+'" width="2560" height="36" fill="#eeeeee"/><text x="16" y="'+(i*756+25)+'" font-family="sans-serif" font-size="22">'+r.id+' — before (left) / deliberate weighted drag (right); type preserved, reflow is visible</text>').join('')+'</svg>');
const sheet=await sharp({create:{width:2560,height:3024,channels:4,background:'#ffffff'}}).composite([...panels,{input:labels,left:0,top:0}]).png().toBuffer();await writeFile(new URL('review-sheet.png',here),sheet);await writeFile(new URL('visual-receipt.json',here),JSON.stringify({scope:'Four actual measured before/after allowed-drag cases; no native equivalence or glyph-position identity during deliberate reflow; no Claude panel for synthetic fixture',node:process.version,execPath:process.execPath,sheetSha256:hash(sheet),records},null,2)+'\n');console.log(JSON.stringify({cases:records.length,sheet:fileURLToPath(new URL('review-sheet.png',here)),glyphShifts:records.map(r=>({id:r.id,firstY:r.after[0].box.y-r.before[0].box.y,fonts:r.after.map(t=>t.fontSize)}))}));
