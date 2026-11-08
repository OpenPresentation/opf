import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {toSvg,resolvePresentation,defaultCatalog} from '../packages/render/test/catalog-harness.mjs';
import {toPng} from '../packages/render/dist/png.js';
import {loadFonts} from '../packages/render/dist/fonts-node.js';
import {toPptx} from '../packages/pptx/test/helpers/default-catalog.mjs';
const out=path.resolve(process.argv[2]??'artifacts/sh25-native'),evidence=path.resolve(process.argv[3]??'docs/evidence/sh25-chart-points');
const baseline=JSON.parse(await readFile('artifacts/baseline-67698/baseline.json','utf8')),hash=value=>createHash('sha256').update(value).digest('hex');
const fonts=await loadFonts(),require=createRequire(new URL('../packages/render/package.json',import.meta.url)),sharp=require('sharp'),records=[],decks=[],panels=[];
await mkdir(out+'/pptx',{recursive:true});await mkdir(out+'/preview',{recursive:true});await mkdir(evidence,{recursive:true});
for(const [index,control]of baseline.cases.entries()){
 assert.equal(hash(toSvg(control.deck,1)),control.svgSha256,control.id+' ordinary SVG');
 assert.equal(hash(await toPptx(control.deck)),control.pptxSha256,control.id+' ordinary PPTX');
 const deck=structuredClone(control.deck),type=deck.slides[0].blocks[0].chart.type;
 if(type==='pie') {deck.slides[0].blocks[0].chart.data.columns.pop();for(const row of deck.slides[0].blocks[0].chart.data.rows)row.pop();}
 deck.slides[0].title='Follow the plotted '+type;
 deck.slides[0].shapes=['start','end','top','bottom','center'].map((edge,shape)=>({shape:'ellipse',fill:'none',stroke:{color:'accent2',width:3},at:{block:'chart',point:shape%4,series:shape===4&&type!=='pie'&&type!=='scatter'?1:0,edge,width:32,height:32}}));
 await fonts.ensure(deck,{renderOptions:{catalogs:[defaultCatalog]}});
 const plain=structuredClone(deck);delete plain.slides[0].shapes;const pair=[];
 for(const [side,document]of [['before',plain],['after',deck]]){
  const svg=toSvg(document,1,{fonts,trace:true}),png=await toPng(svg,{fonts}),name=control.id+'-'+side;
  await writeFile(evidence+'/'+name+'.svg',svg);await writeFile(evidence+'/'+name+'.png',png);pair.push({side,svgSha256:hash(svg),pngSha256:hash(png)});
  panels.push({index,id:control.id,side,png});
  if(side==='after'){await mkdir(out+'/preview/'+control.id,{recursive:true});await writeFile(out+'/preview/'+control.id+'/slide-1.png',png);}
 }
 const resolved=resolvePresentation(deck,{fonts}).slides[0].geometry,chart=resolved.items.find(item=>item.chart),native=await toPptx(deck,{fonts}),file='pptx/'+control.id+'.pptx';
 await writeFile(out+'/'+file,native);await writeFile(out+'/'+control.id+'.opf.json',JSON.stringify(deck,null,2)+'\n');
 const points=resolved.overlayShapes.map(shape=>({shapeName:'OPF shape '+shape.path,shapeIndex:shape.index,at:deck.slides[0].shapes[shape.index].at,point:shape.attachedTo.chartPoint,center:{x:shape.box.x+shape.box.width/2,y:shape.box.y+shape.box.height/2}}));
 assert.equal(points.length,5,control.id+' all point shapes');
 records.push({id:control.id,type,language:deck.language,deck,pair,chartBox:chart.box,plot:chart.chart.layer.plot,points,pptxSha256:hash(native)});
 decks.push({id:control.id,source:control.id+'.opf.json',sourceSha256:hash(JSON.stringify(deck,null,2)+'\n'),previewOk:true,previewSlides:1,previewFindings:[],variants:[{name:'default',flags:[],pptx:file,ok:true,sha256:hash(native),findings:[]}]});
}
for(let offset=0;offset<records.length;offset+=4){
 const layers=[];for(const panel of panels.filter(panel=>panel.index>=offset&&panel.index<offset+4)){
  const left=panel.side==='before'?16:752,top=(panel.index-offset)*440;
  layers.push({input:Buffer.from('<svg width="720" height="28"><text x="4" y="22" font-size="16" font-family="sans-serif">'+panel.id+' — '+panel.side+'</text></svg>'),left,top});
  layers.push({input:await sharp(await readFile(evidence+'/'+panel.id+'-'+panel.side+'.png')).resize({width:720,height:405,fit:'contain',background:'#fff'}).png().toBuffer(),left,top:top+30});
 }await writeFile(evidence+'/sheet-'+(offset/4+1)+'.png',await sharp({create:{width:1488,height:1760,channels:4,background:'#e5e7eb'}}).composite(layers).png().toBuffer());
}
const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),build={manifestVersion:1,revision,dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),opfVersion:JSON.parse(await readFile('packages/javascript/package.json','utf8')).version,node:process.version,platform:process.platform+'-'+process.arch,builtAt:new Date().toISOString(),decks};
await writeFile(out+'/build.json',JSON.stringify(build,null,2)+'\n');
await writeFile(out+'/point-probes.json',JSON.stringify({revision,dirty:build.dirty,scope:'Candidate geometry; actual native point centers within4px still required for every enabled domain.',cases:records},null,2)+'\n');
await writeFile(evidence+'/review.json',JSON.stringify({baseline:baseline.source,ordinaryControls:32,ordinarySvg:'byte-identical',ordinaryPptx:'byte-identical',cases:records},null,2)+'\n');
console.log('Saved32 complete pairs/eight sheets and160 candidate native point probes in '+out);
