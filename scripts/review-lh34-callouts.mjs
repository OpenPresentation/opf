// Reproducible full-slide image-callout review; never writes render goldens.
import assert from 'node:assert/strict';
import {createHash}from'node:crypto';
import {execFileSync}from'node:child_process';
import {mkdir,readFile,writeFile}from'node:fs/promises';
import {createRequire}from'node:module';
import path from'node:path';
import {fileURLToPath,pathToFileURL}from'node:url';
import {toSvg,resolvePresentation}from'../packages/render/test/catalog-harness.mjs';
import {toPng}from'../packages/render/dist/png.js';
import {loadFonts}from'../packages/render/dist/fonts-node.js';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url))),beforeRoot=process.argv[2],out=path.resolve(process.argv[3]??'artifacts/lh34-callout-review');
if(!beforeRoot)throw Error('usage: node scripts/review-lh34-callouts.mjs <built baseline checkout> [output]');
const before=await import(pathToFileURL(path.join(beforeRoot,'packages/render/test/catalog-harness.mjs')).href),beforePptx=await import(pathToFileURL(path.join(beforeRoot,'packages/pptx/test/helpers/default-catalog.mjs')).href),afterPptx=await import('../packages/pptx/test/helpers/default-catalog.mjs');
const require=createRequire(path.join(root,'packages/render/package.json')),sharp=require('sharp'),fonts=await loadFonts(),hash=value=>createHash('sha256').update(value).digest('hex');
const fsTall=(await readFile(new URL('../packages/pptx/test/fixtures/images/tall.png',import.meta.url))).toString('base64');
const base=JSON.parse(await readFile(new URL('../examples/technical/image-callouts.opf.json',import.meta.url),'utf8'));
const make=(id,fn)=>{const deck=structuredClone(base);fn(deck);return{id,deck};};
const cases=[make('wide',()=>{}),make('portrait',deck=>{deck.design.dimensions={widthInches:540/96,heightInches:960/96};deck.slides[0].title='Labels travel with the frame';deck.slides[0].blocks[0].image.src='data:image/png;base64,'+fsTall; deck.slides[0].blocks[0].image.callouts=[{text:'Red',x:.04,y:.05,width:.4,height:.4},{text:'Blue',x:.56,y:.05,width:.4,height:.4}];}),make('cover-focus',deck=>{deck.design.variant='dark1';const block=deck.slides[0].blocks[0];block.fit='cover';block.aspectRatio=1.9;block.focus={x:.6,y:.5};}),make('masked-rtl',deck=>{deck.language='ar';const block=deck.slides[0].blocks[0];block.shape='roundRect';block.overlay={color:'#000000',opacity:.65};block.image.callouts.forEach((label,index)=>{label.text=['المنطقة الحمراء','المنطقة الزرقاء','نقطة الفحص'][index];});}),make('nine-labels',deck=>{deck.slides[0].title='Nine labels remain readable';deck.slides[0].blocks[0].image.callouts=Array.from({length:9},(_,index)=>({text:`Zone ${index+1}`,x:.02+(index%3)/3,y:.05+Math.floor(index/3)/3,width:.28,height:.2}));}),make('long-label',deck=>{deck.slides[0].title='The annotation is real text';deck.slides[0].blocks[0].image.callouts=[{text:'A measured label stays readable above the image and its overlay.',x:.08,y:.2,width:.84,height:.6}];})];
await mkdir(out,{recursive:true});const results=[],panels=[];
for(const [index,{id,deck}]of cases.entries()){
 await fonts.ensure(deck);
 const old=structuredClone(deck);delete old.slides[0].blocks[0].image.callouts;
 // Ordinary image output must remain exact, even where the new labels intentionally add text.
 assert.equal(toSvg(old,1,{fonts}),before.toSvg(old,1,{fonts}));
 const records=[];
 for(const [side,renderer,document]of [['before',before,old],['after',{toSvg,resolvePresentation},deck]]){
  const svg=renderer.toSvg(document,1,{fonts,trace:true}),png=await toPng(svg,{fonts}),image=renderer.resolvePresentation(document,{fonts}).slides[0].geometry.items.find(item=>item.image).image;
  if(side==='after')for(const label of image.callouts){assert.equal(label.fit.overflow,false,id);assert.ok(label.fit.fontSize>=28*Math.min(...Object.values(deck.design.dimensions??{widthInches:1280/96,heightInches:720/96}))*96/720-.001,id);}
  await writeFile(path.join(out,`${id}-${side}.svg`),svg);await writeFile(path.join(out,`${id}-${side}.png`),png);records.push({side,svgSha256:hash(svg),pngSha256:hash(png),image});panels.push({index,side,png});
 }
 results.push({id,deck,beforeSource:'Same picture/treatments/heading, with the unsupported new callouts removed.',renders:records});
}
for(let offset=0;offset<cases.length;offset+=3){const layers=[];for(const panel of panels.filter(panel=>panel.index>=offset&&panel.index<offset+3)){const left=panel.side==='before'?20:770,top=(panel.index-offset)*445;layers.push({input:Buffer.from(`<svg width="720" height="30"><text x="4" y="22" font-size="17" font-family="sans-serif">${cases[panel.index].id} — ${panel.side}</text></svg>`),left,top});layers.push({input:await sharp(await readFile(path.join(out,`${cases[panel.index].id}-${panel.side}.png`))).resize({width:720,height:405,fit:'contain',background:'#fff'}).png().toBuffer(),left,top:top+32});}await writeFile(path.join(out,`sheet-${offset/3+1}.png`),await sharp({create:{width:1510,height:1335,channels:4,background:'#e5e7eb'}}).composite(layers).png().toBuffer());}
const controls=[];for(const language of ['en','ar'])for(const fit of ['contain','cover','stretch']){const deck=structuredClone(base);deck.language=language;deck.slides[0].blocks[0].fit=fit;delete deck.slides[0].blocks[0].image.callouts;const a=await afterPptx.toPptx(deck),b=await beforePptx.toPptx(deck);assert.deepEqual(a,b);controls.push({language,fit,pptxSha256:hash(a)});}
await writeFile(path.join(out,'review.json'),JSON.stringify({baselineRoot:beforeRoot,baselineCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:beforeRoot,encoding:'utf8'}).trim(),compositionSha256:hash(await readFile(new URL('../packages/javascript/src/composition.ts',import.meta.url))),ordinarySvgControls:cases.length,ordinaryPptxControls:controls,cases:results},null,2)+'\n');console.log(`Saved ${cases.length} full before/after pairs and two sheets with exact ordinary image controls in ${out}`);
