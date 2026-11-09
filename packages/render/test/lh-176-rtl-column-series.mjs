import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolvePresentation,toSvg} from './catalog-harness.mjs';
const base=JSON.parse(await readFile(new URL('../../../examples/technical/chart-point-overlays.opf.json',import.meta.url),'utf8'));
const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const mark=(svg,row,column)=>attrs([...svg.matchAll(/<rect\b[^>]*>/g)].map(m=>m[0]).find(tag=>tag.includes('data-opf-path="slides.0.blocks.0.chart.data.rows.'+row+'.'+column+'"'))??'');
let checks=0;
for(const type of ['column','combo'])for(const language of ['en-US','ar']){
 const deck={...base,language,slides:[{title:'Native source series order',blocks:[{id:'chart',chart:{type,data:{columns:['Stage','First','Second','Third'],rows:[['A',20,30,15],['B',12,22,18],['C',10,25,14]]}}}],...(type==='column'?{shapes:[0,1,2].map(series=>({shape:'ellipse',fill:'none',at:{block:'chart',point:0,series,edge:'center',width:24,height:24}}))}:{})}]};
 const svg=toSvg(deck,1,{trace:true}),a=mark(svg,0,1),b=mark(svg,0,2),last=mark(svg,2,1);assert.ok(a.x&&b.x&&last.x,'real native-comparable columns exist');
 assert.ok(language==='ar'?+a.x>+b.x:+a.x<+b.x,'physical series order '+type+language);assert.ok(language==='ar'?+a.x>+last.x:+a.x<+last.x,'category direction '+type+language);
 const other=toSvg({...deck,language:language==='ar'?'en-US':'ar'},1,{trace:true});assert.equal(a.fill,mark(other,0,1).fill,'first source series retains its color');assert.equal(b.fill,mark(other,0,2).fill,'second source series retains its color');
 if(type==='column')for(const shape of resolvePresentation(deck).slides[0].geometry.overlayShapes){const point=shape.attachedTo.chartPoint,rect=mark(svg,point.row,point.column);for(const key of ['x','y','width','height'])assert.ok(Math.abs(+rect[key]-point.box[key])<.003,'preview and shared anchor '+key);}
 checks++;
}
console.log('LH176: '+checks+' actual SVG column/combo source-series, category direction and color controls pass; clustered anchors match actual marks.');
