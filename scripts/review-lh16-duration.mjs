// Render before/after sheets for the explicit LH-16 duration examples. No golden hashes are generated or changed.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {toSvg,resolvePresentation} from '../packages/render/test/catalog-harness.mjs';
import {toPng} from '../packages/render/dist/png.js';
import {loadFonts} from '../packages/render/dist/fonts-node.js';
const root=path.resolve(new URL('..',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const beforeRoot=process.argv[2],out=path.resolve(process.argv[3]??'artifacts/lh16-duration-review');
if(!beforeRoot)throw Error('usage: node scripts/review-lh16-duration.mjs <built baseline checkout> [output]');
const before=await import(pathToFileURL(path.join(beforeRoot,'packages/render/test/catalog-harness.mjs')).href);
const require=createRequire(path.join(root,'packages/render/package.json')),sharp=require('sharp'),fonts=await loadFonts();
const base=JSON.parse(await readFile(new URL('../examples/technical/duration-timeline.opf.json',import.meta.url),'utf8'));
const make=(id,change)=>{const deck=structuredClone(base);change(deck);return{id,deck};};
const cases=[make('wide',()=>{}),make('portrait',deck=>{deck.design.dimensions={widthInches:540/96,heightInches:960/96};deck.slides[0].title='Three consecutive periods';delete deck.slides[0].timeline.name;for(const event of deck.slides[0].timeline.events)delete event.description;}),make('rtl',deck=>deck.language='ar'),make('nine-periods',deck=>{deck.slides[0].title='Nine phases keep their relative lengths';deck.slides[0].timeline={events:Array.from({length:9},(_,index)=>({what:`Phase ${index+1}`,duration:index%3+1}))};}),make('single-period',deck=>{deck.slides[0].title='One continuous delivery period';deck.slides[0].timeline={events:[{when:'Weeks 1–4',what:'Deliver the working product',duration:4,status:'current'}]};}),make('partial-periods',deck=>{deck.slides[0].title='Omitted durations remain one unit';deck.slides[0].timeline.events[1].duration=.5;delete deck.slides[0].timeline.events[0].duration;})];
await mkdir(out,{recursive:true});const results=[],panels=[];
const hash=value=>createHash('sha256').update(value).digest('hex');
for(const [index,{id,deck}] of cases.entries()){
 const old=structuredClone(deck);for(const event of old.slides[0].timeline.events)delete event.duration;
 const records=[];
 for(const [side,renderer,document] of [['before',before,old],['after',{toSvg,resolvePresentation},deck]]){
  const svg=renderer.toSvg(document,1,{fonts,trace:true}),png=await toPng(svg,{fonts}),name=`${id}-${side}`;
  await writeFile(path.join(out,`${name}.svg`),svg);await writeFile(path.join(out,`${name}.png`),png);
  const layout=renderer.resolvePresentation(document,{fonts}).slides[0].geometry.items.find(item=>item.timelineLayout).timelineLayout;
  assert.equal(layout.overflow,false,`${id} ${side}`);
  records.push({side,svgSha256:hash(svg),pngSha256:hash(png),arrangement:layout.arrangement,fonts:layout.parts.map(part=>part.fit.fontSize),ranges:layout.ranges??[]});
  panels.push({index,side,png});
 }
 results.push({id,deck,beforeSource:'Same words/statuses, duration fields removed for the older schema.',renders:records});
}
for(let offset=0;offset<cases.length;offset+=3){
 const layers=[];
 for(const panel of panels.filter(panel=>panel.index>=offset&&panel.index<offset+3)){
  const left=panel.side==='before'?20:770,top=(panel.index-offset)*445;
  const label=`${cases[panel.index].id} — ${panel.side}`;
  layers.push({input:Buffer.from(`<svg width="720" height="30"><text x="4" y="22" font-size="17" font-family="sans-serif">${label}</text></svg>`),left,top});
  layers.push({input:await sharp(panel.png).resize({width:720,height:405,fit:'contain',background:'#fff'}).png().toBuffer(),left,top:top+32});
 }
 await writeFile(path.join(out,`sheet-${offset/3+1}.png`),await sharp({create:{width:1510,height:1335,channels:4,background:'#e5e7eb'}}).composite(layers).png().toBuffer());
}
await writeFile(path.join(out,'review.json'),JSON.stringify({baselineRoot:beforeRoot,baselineCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:beforeRoot,encoding:'utf8'}).trim(),compositionSha256:hash(await readFile(new URL('../packages/javascript/src/composition.ts',import.meta.url))),cases:results},null,2)+'\n');
console.log(`Saved ${cases.length} complete before/after pairs and 2 sheets in ${out}`);
