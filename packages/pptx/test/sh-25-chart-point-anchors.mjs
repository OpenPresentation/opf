import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {unzipSync,zipSync,strToU8,strFromU8} from 'fflate';
import {toPptx,fromPptx,resolvePresentation,toSvg} from './helpers/default-catalog.mjs';
const source=JSON.parse(await readFile(new URL('../../../examples/technical/chart-point-overlays.opf.json',import.meta.url),'utf8'));
const near=(a,b)=>assert.ok(Math.abs(a-b)<.01,a+' != '+b),emu=value=>Math.round(value/96*914400);
for(const type of ['column','stacked-column','100pct-stacked-column','bar','stacked-bar','100pct-stacked-bar','line','line-with-markers','stacked-line','stacked-line-with-markers','area','stacked-area','100pct-stacked-area','scatter','pie','doughnut']){
 const deck={...source,slides:[{title:'Point follows its data',blocks:[{id:'chart',chart:{type,data:{columns:['Country','A','B'],rows:[['US',20,10],['France',8,12],['Japan',15,25]]}}}],shapes:[{shape:'ellipse',fill:'none',stroke:{color:'accent2',width:3},at:{block:'chart',point:1,series:0,edge:'end',widthPx:48,heightPx:48}}]}]};
 const geometry=resolvePresentation(deck).slides[0].geometry,chart=geometry.items.find(item=>item.chart),shape=geometry.overlayShapes[0],point=shape.attachedTo.chartPoint;
 const zip=unzipSync(await toPptx(deck)),slide=strFromU8(zip['ppt/slides/slide1.xml']),native=strFromU8(zip['ppt/charts/chart1.xml']);
 assert.ok(native.includes('<c:manualLayout><c:layoutTarget val="inner"/>'));const inset=chart.chart.layer.plot,expected={x:inset.left/chart.box.width,y:inset.top/chart.box.height,w:1-(inset.left+inset.right)/chart.box.width,h:1-(inset.top+inset.bottom)/chart.box.height};
 for(const [key,value] of Object.entries(expected)){const written=Number(native.match(new RegExp('<c:'+key+' val="([^"]+)"'))?.[1]);assert.ok(Math.abs(written-value)<.00011,type+' pinned '+key);}
 const object=[...slide.matchAll(/<p:sp>[^]*?<\/p:sp>/g)].find(m=>m[0].includes('name="OPF shape slides.0.shapes.0"'))[0];assert.ok(object.includes('<a:off x="'+emu(shape.box.x)+'" y="'+emu(shape.box.y)+'"/><a:ext cx="'+emu(shape.box.width)+'" cy="'+emu(shape.box.height)+'"/>'),type+' native shape exact EMU');
 near(shape.box.x+24,point.position.x);near(shape.box.y+24,point.position.y);
 const svg=toSvg(deck,1,{trace:true});assert.ok(svg.includes('data-opf-path="slides.0.shapes.0"'),type+' native overlay preview');
 const back=await fromPptx(zipSync(zip));assert.deepEqual(back.slides[0].shapes[0].at,deck.slides[0].shapes[0].at,type+' point identity roundtrip');
}
// External native edits are authoritative: a missing named category cannot resurrect its old anchor.
const bytes=await toPptx({...source,slides:[source.slides[0]]}),zip=unzipSync(bytes);zip['ppt/charts/chart1.xml']=strToU8(strFromU8(zip['ppt/charts/chart1.xml']).replaceAll('United States','Native replacement'));
const findings=[],back=await fromPptx(zipSync(zip),{onDiagnostic:d=>findings.push(d)});assert.equal(back.slides[0].shapes[0].at,undefined);assert.equal(typeof back.slides[0].shapes[0].x,'number');assert.ok(findings.some(d=>d.code==='shape-property-dropped'&&d.property==='chart point anchor'));assert.ok(JSON.stringify(back.slides[0].blocks).includes('Native replacement'));assert.ok(!JSON.stringify(back.slides[0].blocks).includes('United States'));
console.log('SH-25:16 classic native plot pins, exact overlay EMU, current-data roundtrips and stale-anchor refusal pass; native application centers remain a separate qualification.');
