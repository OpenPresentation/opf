import assert from 'node:assert/strict';
import {test} from 'node:test';
import {toSvg,resolvePresentation} from './catalog-harness.mjs';
const data={columns:['Region','Actual'],rows:[['North',12],['South',18],['East',16]]};
const deck=options=>({design:{fontScheme:'roboto'},slides:[{chart:{type:'bar',data,legend:'none',dataLabels:false,referenceLines:[{value:20,label:'Target 20',stroke:{color:'#C44900',width:2,dash:'dash'}}],...options}}]});
const attrs=text=>Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([,k,v])=>[k,v]));
const tags=(svg,name)=>[...svg.matchAll(new RegExp('<'+name+'\\b([^>]*)>','g'))].map(([,a])=>attrs(a));
const refs=svg=>tags(svg,'line').filter(a=>/^slides\.0\.chart\.referenceLines\.\d+$/.test(a['data-opf-path']??''));
const near=(a,b)=>assert.ok(Math.abs(Number(a)-Number(b))<.02,String(a)+' ~ '+String(b));
test('suite03 bar options render the missing dashed target using the same value scale as ordinary bars',()=>{
 const doc=deck(),svg=toSvg(doc,1,{trace:true}),line=refs(svg)[0];assert.ok(line);assert.equal(line.stroke.toUpperCase(),'#C44900');assert.equal(line['stroke-width'],'2');assert.equal(line['stroke-dasharray'],'8 6');assert.ok(svg.includes('Target 20'));
 const item=resolvePresentation(doc).slides[0].geometry.items.find(i=>i.field==='chart'),p=item.chart.layer.plot,axis=item.chart.valueAxis,plotWidth=item.box.width-p.left-p.right,origin=item.box.x+p.left;near(line.x1,origin+20/25*plotWidth);near(line.y1,item.box.y+p.top);near(line.y2,item.box.y+item.box.height-p.bottom);
 for(const [i,value]of [12,18,16].entries()){const bar=tags(svg,'rect').find(x=>x['data-opf-path']==='slides.0.chart.data.rows.'+i+'.1');assert.ok(bar);near(bar.x,origin);near(bar.width,value/25*plotWidth);}assert.equal(axis.max,25);
});
test('active legends/title bands and percentage/negative targets preserve explicit labels and independent strokes',()=>{
 for(const legend of ['none','top','bottom','left','right']){const svg=toSvg(deck({legend,axisTitles:{category:'Region',value:'Actual'}}),1,{trace:true});assert.equal(refs(svg).length,1,legend);assert.ok(svg.includes('Target 20'));}
 const doc=deck({data:{...data,columns:['Region',{name:'Actual',format:'0%'}],rows:[['North',.12],['South',.18],['East',.16]]},referenceLines:[{value:.2,label:'Target 20%',labelPosition:'start',stroke:{color:'#123456',width:3,dash:'dot'}},{value:-.1,label:'Floor',stroke:{width:0}}]}),svg=toSvg(doc,1,{trace:true}),line=refs(svg)[0],item=resolvePresentation(doc).slides[0].geometry.items.find(i=>i.field==='chart');assert.equal(refs(svg).length,1);assert.equal(item.chart.layer.references.lines.length,2);assert.equal(item.chart.layer.references.lines[0].value,.2);assert.ok(item.chart.valueAxis.min<=-.1&&item.chart.valueAxis.max>=.2);assert.equal(line['stroke-dasharray'],'3 9');assert.ok(svg.includes('Target 20%')&&svg.includes('Floor'));assert.ok(!/NaN|Infinity/.test(svg));
});


