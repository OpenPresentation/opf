import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolvePresentation,toSvg} from './catalog-harness.mjs';
const base=JSON.parse(await readFile(new URL('../../../examples/technical/chart-point-overlays.opf.json',import.meta.url),'utf8'));
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<.003,label+': '+a+' != '+b);
const attributes=tag=>Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const mark=(svg,path,name)=>[...svg.matchAll(new RegExp('<'+name+'\\b[^>]*>','g'))].map(m=>m[0]).find(tag=>tag.includes('data-opf-path="'+path+'"'));
for(const type of ['column','bar','stacked-column','stacked-bar','100pct-stacked-column','100pct-stacked-bar','line-with-markers','stacked-line-with-markers','scatter'])for(const language of ['en-US','ar']){
 const deck={...base,language,slides:[{title:'The mark supplies its own geometry',blocks:[{id:'chart',chart:{type,data:{columns:['Country','A','B'],rows:[['US',20,-5],['France',8,12],['Japan',15,25]]}}}],shapes:[{shape:'ellipse',fill:'none',at:{block:'chart',point:1,series:0,edge:'end',widthPx:48,heightPx:48}}]}]};
 const geometry=resolvePresentation(deck).slides[0].geometry,shape=geometry.overlayShapes[0],point=shape.attachedTo.chartPoint,svg=toSvg(deck,1,{trace:true}),horizontal=type.includes('bar'),bar=horizontal||type.includes('column'),column=type==='scatter'?2:1,path='slides.0.blocks.0.chart.data.rows.1.'+column;
 if(bar){const rect=attributes(mark(svg,path,'rect'));for(const key of ['x','y','width','height'])near(Number(rect[key]),point.box[key],type+language+key);near(shape.box.x+24,horizontal?Number(rect.x)+Number(rect.width):Number(rect.x)+Number(rect.width)/2,type+' x endpoint');near(shape.box.y+24,horizontal?Number(rect.y)+Number(rect.height)/2:Number(rect.y),type+' y endpoint');}
 else{const circle=attributes(mark(svg,path,'circle'));near(Number(circle.cx),point.position.x,type+language+' cx');near(Number(circle.cy),point.position.y,type+language+' cy');}
}
console.log('SH25:18 actual SVG bar/marker bounds and overlay centers match shared geometry, including RTL and scatter X columns.');
