import assert from 'node:assert/strict';
import {renderSvg,resolvePresentation} from '../dist/svg.js';
import {CHART_TYPES,DEPRECATED_CHART_TYPES,CHART_SERIES_COLORS,resolveChartType,niceScale,stackCategoryValues,barGeometry,scatterSeries} from '../dist/charts.js';
import {chartColorForFill} from '@openpresentation/opf/composition';

// FF-22: every kept catalog chart type previews its native construct.
const CLASSIC=['column','stacked-column-3x','100pct-stacked-column-3x','bar','stacked-bar-3x','100pct-stacked-bar-3x','line','line-with-markers','stacked-line-3x','stacked-line-with-markers-3x','area','stacked-area-3x','100pct-stacked-area-3x','pie','doughnut','scatter','radar','radar-with-markers','filled-radar'];
const CHARTEX=['treemap','histogram','pareto','box-and-whisker','waterfall','funnel','world'];
assert.deepEqual(Object.keys(CHART_TYPES).sort(),[...CLASSIC,...CHARTEX].sort(),'26 kept chart type ids');
assert.equal(Object.keys(DEPRECATED_CHART_TYPES).length,50,'50 deprecated chart type ids');
for(const id of Object.keys(CHART_TYPES))assert.equal(resolveChartType(id),id);
for(const [id,replacement] of Object.entries(DEPRECATED_CHART_TYPES)){assert.ok(CHART_TYPES[replacement],`${id} -> ${replacement}`);assert.equal(resolveChartType(id),replacement);}
assert.equal(resolveChartType('donut'),'doughnut');
assert.equal(resolveChartType(' Stacked-Column-2X '),'stacked-column-3x');
for(const id of ['mystery-chart','gantt','',undefined])assert.equal(resolveChartType(id),null);

const PATH='slides.0.chart';
const categoryData={columns:['Quarter','North','South','East'],rows:[['Q1',12,8,-3],['Q2',16,10,5],['Q3',21,-4,null],['Q4',18,13,9]]};
const render=(type,data=categoryData,design)=>renderSvg({...(design?{design}:{}),slides:[{chart:{type,data}}]},{trace:true});
const elements=(svg,name)=>[...svg.matchAll(new RegExp(`<${name}\\b([^>]*)/?>`,'g'))].map(([,attrs])=>Object.fromEntries([...attrs.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([,k,v])=>[k,v])));
const marks=(svg,name,pattern)=>elements(svg,name).filter(a=>pattern.test(a['data-opf-path']??''));
const texts=svg=>[...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(([,t])=>t.replace(/<[^>]+>/g,''));
const point=/^slides\.0\.chart\.data\.rows\.\d+\.\d+$/,series=/^slides\.0\.chart\.data\.columns\.\d+$/;
const bound=resolvePresentation({slides:[{chart:{type:'column',data:categoryData}}]}).slides[0];
const palette=CHART_SERIES_COLORS.map(color=>chartColorForFill(bound.design.colors.surface,color));
let checks=0;

// Every classic id takes the catalog path, never the legacy single-series fallback.
for(const id of CLASSIC){
  const svg=render(id);
  assert.match(svg,new RegExp(`data-opf-chart="${id}"`),`${id}: catalog renderer`);
  assert.ok(elements(svg,'text').length>0,`${id}: labels are real text`);
  for(const a of elements(svg,'text'))assert.ok(a['font-family'].startsWith(bound.design.fonts.body),`${id}: body font`);
  checks++;
}

// Column and bar: one rect per non-empty value, palette in exporter order.
for(const id of ['column','stacked-column-3x','100pct-stacked-column-3x','bar','stacked-bar-3x','100pct-stacked-bar-3x']){
  const svg=render(id),rects=marks(svg,'rect',point);
  assert.equal(rects.length,11,`${id}: 11 non-empty values`);
  for(const r of rects){const j=Number(r['data-opf-path'].split('.').at(-1))-1;assert.equal(r.fill,palette[j],`${id}: series colour ${j}`);}
  assert.equal(marks(svg,'rect',series).length,3,`${id}: legend with three series`);
  const labels=texts(svg);
  if(id.startsWith('100pct')){assert.ok(labels.includes('100%')&&labels.includes('0%'),`${id}: percent axis`);assert.ok(!labels.some(t=>/^\d+%$/.test(t)&&Number(t.slice(0,-1))>100));}
  else assert.ok(!labels.some(t=>t.endsWith('%')),`${id}: numeric axis`);
  checks++;
}
{
  // Clustered bars sit side by side; stacked bars share one slot and stack edge to edge.
  const clustered=marks(render('column'),'rect',/rows\.0\.\d$/),stacked=marks(render('stacked-column-3x'),'rect',/rows\.0\.\d$/);
  assert.equal(new Set(clustered.map(r=>r.x)).size,3);
  assert.equal(new Set(stacked.map(r=>r.x)).size,1);
  const [north,south,east]=stacked.map(r=>({y:Number(r.y),bottom:Number(r.y)+Number(r.height)}));
  assert.ok(Math.abs(south.bottom-north.y)<0.01,'positive values stack upward');
  assert.ok(Math.abs(east.y-north.bottom)<0.01,'negative values stack downward from zero');
  // Horizontal bars: first category at the bottom, first series nearest the axis.
  const bars=marks(render('bar'),'rect',point),y=path=>Number(bars.find(r=>r['data-opf-path']===`${PATH}.data.rows.${path}`).y);
  assert.ok(y('0.1')>y('3.1'),'first category at the bottom');
  assert.ok(y('0.1')>y('0.2'),'first series lowest in its cluster');
  const band=100;assert.deepEqual(barGeometry(band,2,'clustered'),{group:40,width:20,offset:30,clustered:true});
  assert.deepEqual(barGeometry(band,2,'stacked').width,band/1.5);
  checks++;
}

// Stacking math (Office): bars split positive/negative stacks; lines and areas accumulate; 100% divides by the absolute sum.
{
  const s=[{values:[12,16]},{values:[8,-4]},{values:[-3,null]}];
  assert.deepEqual(stackCategoryValues(s,2,'bar','stacked').map(v=>v.map(p=>p&&[p.from,p.to])),[[[0,12],[0,16]],[[12,20],[0,-4]],[[0,-3],null]]);
  assert.deepEqual(stackCategoryValues(s,2,'line','stacked').map(v=>v.map(p=>p&&p.to)),[[12,16],[20,12],[17,null]]);
  const percent=stackCategoryValues(s,2,'bar','percentStacked');
  assert.ok(Math.abs(percent[0][0].to-12/23)<1e-12&&Math.abs(percent[2][0].to+3/23)<1e-12);
  const area=stackCategoryValues(s,2,'area','percentStacked');
  assert.ok(Math.abs(area[1][0].to-20/23)<1e-12);assert.ok(Math.abs(area[2][1].to-12/20)<1e-12,'blank area values plot as zero');
  checks++;
}

// Office-like automatic value axes.
assert.deepEqual(niceScale(0,21,10),{min:0,max:25,step:5,ticks:[0,5,10,15,20,25]});
assert.deepEqual(niceScale(0,42,10).max,45);
assert.deepEqual(niceScale(-4,21,10).min,-10,"5% headroom below the negative minimum");
assert.deepEqual(niceScale(100,110,10).min>0,true,'values in the top sixth drop the zero baseline');
assert.deepEqual(niceScale(0,1,10,{percent:true}).ticks.length,11);
assert.deepEqual(niceScale(-0.2,1,10,{percent:true}).min,-1);
checks++;

// Lines: markers only for the -with-markers ids; stacked lines plot cumulative totals.
for(const [id,markers] of [['line',false],['line-with-markers',true],['stacked-line-3x',false],['stacked-line-with-markers-3x',true]]){
  const svg=render(id);
  assert.equal(marks(svg,'circle',point).length,markers?11:0,`${id}: markers`);
  assert.equal(marks(svg,'polyline',series).length,6,`${id}: three legend keys and one line per series`);
  checks++;
}
{
  // Stacked lines plot cumulative totals: South Q1 = 12 + 8 = 20 sits above North Q2 = 16.
  const ys=(svg,column)=>marks(svg,'polyline',new RegExp(`columns\.${column}$`)).at(-1).points.split(' ').map(p=>Number(p.split(',')[1]));
  const stacked=render('stacked-line-3x'),standard=render('line');
  assert.ok(ys(stacked,2)[0]<ys(stacked,1)[1],'stacked: 20 above 16');
  assert.ok(ys(standard,2)[0]>ys(standard,1)[1],'standard: 8 below 16');
}

// Areas: one filled path per series.
for(const id of ['area','stacked-area-3x','100pct-stacked-area-3x']){
  const paths=marks(render(id),'path',series);
  assert.equal(paths.length,3,`${id}: three area paths`);
  paths.forEach((p,j)=>assert.equal(p.fill,palette[j]));
  checks++;
}

// Pie and doughnut: first series only, one slice per category, category colours, per-category legend.
for(const id of ['pie','doughnut','donut']){
  const svg=render(id,{columns:['Region','Share','Ignored'],rows:[['North',42,1],['South',31,2],['East',18,3],['West',9,4]]});
  const slices=marks(svg,'path',point);
  assert.equal(slices.length,4,`${id}: four slices`);
  assert.ok(slices.every(s=>s['data-opf-path'].endsWith('.1')),`${id}: first series only`);
  slices.forEach((s,i)=>assert.equal(s.fill,palette[i],`${id}: slice ${i} colour`));
  const holes=slices.filter(s=>(s.d.match(/A /g)??[]).length===2).length;
  assert.equal(holes,id==='pie'?0:4,`${id}: ring slices`);
  assert.deepEqual(marks(svg,'rect',/\.data\.rows\.\d+\.0$/).map(r=>r.fill),palette.slice(0,4),`${id}: legend per category`);
  assert.ok(['North','South','East','West'].every(t=>texts(svg).includes(t)));
  checks++;
}
assert.equal(render('donut',{columns:['a','b'],rows:[['x',1]]}).replace(/data-opf-chart="doughnut"/,''),render('doughnut',{columns:['a','b'],rows:[['x',1]]}).replace(/data-opf-chart="doughnut"/,''));

// Scatter: numeric X axis from columns[1], Y series from columns[2..], markers without lines.
{
  const data={columns:['Point','Spend','Revenue','Margin'],rows:[['a',1,12,5],['b',2.5,15,7],['c',4,11,9],['d',6,20,4],['e',7.5,24,10]]};
  const svg=render('scatter',data),points=marks(svg,'circle',point);
  assert.equal(points.length,10);
  assert.equal(marks(svg,'polyline',/./).filter(p=>p['data-opf-path'].includes('rows')).length,0,'no connecting line');
  const cx=points.filter(p=>p['data-opf-path'].endsWith('.2')).map(p=>Number(p.cx));
  const ratio=(cx[1]-cx[0])/(cx[2]-cx[0]);assert.ok(Math.abs(ratio-1.5/3)<1e-3,'X positions follow numeric values');
  assert.ok(!texts(svg).includes('a'),'point labels are not categories');
  assert.deepEqual(marks(svg,'circle',series).length,2,'legend markers for two Y series');
  const single=scatterSeries([['a',5],['b',7]],['P','Y']);
  assert.deepEqual(single.series[0].points.map(p=>[p.x,p.y]),[[1,5],[2,7]],'single numeric column: X = 1..n');
  assert.equal(marks(render('scatter',{columns:['P','X','Y'],rows:[['a',1,2],['b',2,3]]}),'circle',series).length,0,'one Y series: no legend');
  checks++;
}

// Radar: lines without markers, markers, or filled polygons.
for(const [id,markers,filled] of [['radar',false,false],['radar-with-markers',true,false],['filled-radar',false,true]]){
  const svg=render(id),outlines=marks(svg,'path',series);
  assert.equal(outlines.length,3,`${id}: one outline per series`);
  outlines.forEach((p,j)=>filled?assert.equal(p.fill,palette[j]):(assert.equal(p.fill,'none'),assert.equal(p.stroke,palette[j])));
  assert.equal(marks(svg,'circle',point).length,markers?11:0,`${id}: markers`);
  checks++;
}

// Single series: no legend; deprecated ids render exactly like their replacement.
assert.equal(marks(render('column',{columns:['Q','Only'],rows:[['Q1',1],['Q2',2]]}),'rect',series).length,0,'single series has no legend');
for(const [id,replacement] of Object.entries(DEPRECATED_CHART_TYPES)){assert.equal(render(id),render(replacement),`${id} renders as ${replacement}`);checks++;}

// Ids outside the catalog keep the legacy preview; kept ids without inline rows keep the no-data panel.
{
  const svg=render('mystery-chart');
  assert.doesNotMatch(svg,/data-opf-chart=/);
  assert.equal(marks(svg,'rect',/^slides\.0\.chart\.data\.rows\.\d+$/).length,4,'legacy single-series bars');
  assert.ok(render('column',{src:'asset:missing'}).includes('No chart data'));
  checks++;
}

console.log(`Chart types passed: ${checks} checks; ${CLASSIC.length} classic ids on the catalog renderer, ${Object.keys(DEPRECATED_CHART_TYPES).length} deprecated ids identical to their replacement, unknown ids on the legacy preview.`);
