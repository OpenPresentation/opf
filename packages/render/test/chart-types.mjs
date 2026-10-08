import assert from 'node:assert/strict';
import {resolvePresentation, renderSlideSvg} from '../dist/svg.js';
import {CHART_TYPES,CHART_SERIES_COLORS,chartSeriesPalette,resolveChartType,niceScale,stackCategoryValues,barGeometry,scatterSeries,squarify,scottBinCount,histogramBins,boxStatistics,mixHex} from '../dist/charts.js';

// FF-22: every chart type previews its native construct. OPF 0.15: chart.type is core's CHART_TYPES enum (an engine
// vocabulary, no catalog); a value outside it is rejected at the validation boundary, and the renderer's legacy preview
// for such a value is reached only with validation off. The documents here name no gallery record, so no catalog is registered.
// FA-15: combo (clustered columns with line series) is a classic construct too: one barChart and one lineChart per value axis.
const CLASSIC=['combo','column','stacked-column','100pct-stacked-column','bar','stacked-bar','100pct-stacked-bar','line','line-with-markers','stacked-line','stacked-line-with-markers','area','stacked-area','100pct-stacked-area','pie','doughnut','scatter','radar','radar-with-markers','filled-radar'];
const CHARTEX=['treemap','histogram','pareto','box-and-whisker','waterfall','funnel','world'];
assert.deepEqual(Object.keys(CHART_TYPES).sort(),[...CLASSIC,...CHARTEX].sort(),'27 kept chart type ids');
for(const id of Object.keys(CHART_TYPES))assert.equal(resolveChartType(id),id);
assert.equal(resolveChartType('donut'),null,'OPF 0.15 removed the donut alias: only doughnut is a chart type');
assert.equal(resolveChartType(' Stacked-Column '),'stacked-column');
for(const id of ['stacked-column-3x','stacked-column-2x','clustered-column','sparkline','dot-plot','australia'])assert.equal(resolveChartType(id),null,`${id} is not a chart type`);
for(const id of ['mystery-chart','gantt','',undefined])assert.equal(resolveChartType(id),null);

const PATH='slides.0.chart';
const categoryData={columns:['Quarter','North','South','East'],rows:[['Q1',12,8,-3],['Q2',16,10,5],['Q3',21,-4,null],['Q4',18,13,9]]};
const render=(type,data=categoryData,design,options={})=>renderSlideSvg({...(design?{design}:{}),slides:[{chart:{type,data}}]}, 0,{trace:true,...options});
const elements=(svg,name)=>[...svg.matchAll(new RegExp(`<${name}\\b([^>]*)/?>`,'g'))].map(([,attrs])=>Object.fromEntries([...attrs.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([,k,v])=>[k,v])));
const marks=(svg,name,pattern)=>elements(svg,name).filter(a=>pattern.test(a['data-opf-path']??''));
const texts=svg=>[...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(([,t])=>t.replace(/<[^>]+>/g,''));
const point=/^slides\.0\.chart\.data\.rows\.\d+\.\d+$/,series=/^slides\.0\.chart\.data\.columns\.\d+$/;
const bound=resolvePresentation({slides:[{chart:{type:'column',data:categoryData}}]}).slides[0];
const palette=chartSeriesPalette(bound.design.colors.surface);
let checks=0;

// Every classic id takes the chart-type renderer, never the legacy single-series fallback.
for(const id of CLASSIC){
  const svg=render(id);
  assert.match(svg,new RegExp(`data-opf-chart="${id}"`),`${id}: chart-type renderer`);
  assert.ok(elements(svg,'text').length>0,`${id}: labels are real text`);
  for(const a of elements(svg,'text'))assert.ok(a['font-family'].startsWith(bound.design.fonts.body),`${id}: body font`);
  checks++;
}

// Column and bar: one rect per non-empty value, palette in exporter order.
for(const id of ['column','stacked-column','100pct-stacked-column','bar','stacked-bar','100pct-stacked-bar']){
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
  const clustered=marks(render('column'),'rect',/rows\.0\.\d$/),stacked=marks(render('stacked-column'),'rect',/rows\.0\.\d$/);
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
for(const [id,markers] of [['line',false],['line-with-markers',true],['stacked-line',false],['stacked-line-with-markers',true]]){
  const svg=render(id);
  assert.equal(marks(svg,'circle',point).length,markers?11:0,`${id}: markers`);
  assert.equal(marks(svg,'polyline',series).length,6,`${id}: three legend keys and one line per series`);
  checks++;
}
{
  // Stacked lines plot cumulative totals: South Q1 = 12 + 8 = 20 sits above North Q2 = 16.
  const ys=(svg,column)=>marks(svg,'polyline',new RegExp(`columns\.${column}$`)).at(-1).points.split(' ').map(p=>Number(p.split(',')[1]));
  const stacked=render('stacked-line'),standard=render('line');
  assert.ok(ys(stacked,2)[0]<ys(stacked,1)[1],'stacked: 20 above 16');
  assert.ok(ys(standard,2)[0]>ys(standard,1)[1],'standard: 8 below 16');
}

// Areas: one filled path per series.
for(const id of ['area','stacked-area','100pct-stacked-area']){
  const paths=marks(render(id),'path',series);
  assert.equal(paths.length,3,`${id}: three area paths`);
  paths.forEach((p,j)=>assert.equal(p.fill,palette[j]));
  checks++;
}

// Pie and doughnut: first series only, one slice per category, category colours, per-category legend.
for(const id of ['pie','doughnut']){
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
assert.throws(()=>render('donut',{columns:['a','b'],rows:[['x',1]]}),error=>error.code==='invalid-opf'&&JSON.stringify(error.details).includes('/slides/0/chart/type'),'donut is not a chart type: the validator rejects it at chart.type');

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

// Single series: no legend.
assert.equal(marks(render('column',{columns:['Q','Only'],rows:[['Q1',1],['Q2',2]]}),'rect',series).length,0,'single series has no legend');

// Chartex constructs (FF-22b): every chartex id takes the chart-type renderer with marks traced to its data.
for(const id of CHARTEX){
  const svg=render(id);
  assert.match(svg,new RegExp(`data-opf-chart="${id}"`),`${id}: chart-type renderer`);
  assert.equal(marks(svg,'rect',/^slides\.0\.chart\.data\.rows\.\d+$/).length,0,`${id}: no legacy bars`);
  assert.ok(elements(svg,'text').length>0,`${id}: labels are real text`);
  for(const a of elements(svg,'text'))assert.ok(a['font-family'].startsWith(bound.design.fonts.body),`${id}: body font`);
  assert.doesNotMatch(svg,/NaN|undefined|Infinity/,`${id}: finite markup`);
  checks++;
}
{
  // Treemap: one tile per positive value of the first series, squarified areas in proportion, one palette colour per tile, category labels inside.
  const svg=render('treemap'),tiles=marks(svg,'rect',/rows\.\d+\.1$/);
  assert.equal(tiles.length,4,'four tiles for the first series');
  tiles.forEach((t,i)=>assert.equal(t.fill,palette[i],`tile ${i} colour`));
  const areas=tiles.map(t=>Number(t.width)*Number(t.height)),values=[12,16,21,18];
  assert.ok(Math.abs(areas[2]/areas[0]-values[2]/values[0])<0.02,'areas follow the values');
  assert.ok(['Q1','Q2','Q3','Q4'].every(t=>texts(svg).includes(t)),'category labels inside the tiles');
  assert.deepEqual(marks(svg,'rect',/columns/).length,0,'no legend');
  const negative=render('treemap',{columns:['A','V'],rows:[['x',-1],['y',0]]});
  assert.ok(negative.includes('No positive chart values'));
  const rects=squarify([{value:6},{value:6},{value:4},{value:3},{value:2},{value:2},{value:1}],0,0,6,4);
  assert.ok(Math.abs(rects.reduce((s,r)=>s+r.width*r.height,0)-24)<1e-9,'squarify fills the area');
  assert.ok(Math.abs(rects[0].width*rects[0].height-6)<1e-9&&Math.abs(rects[6].width*rects[6].height-1)<1e-9,'areas are proportional');
  assert.deepEqual(squarify([{value:0},{value:0}],0,0,2,2),[null,null]);
  checks++;
}
{
  // Histogram: a lone value column is binned like PowerPoint (Scott's rule, right-closed bins from the minimum); a category column bins by category.
  assert.equal(scottBinCount([3,5,8,13]),2);
  assert.equal(scottBinCount(Array.from({length:1000},(_,i)=>i)),10);
  assert.equal(scottBinCount([7,7,7]),1);
  assert.deepEqual(histogramBins([3,5,8,13]).map(b=>[b.label,b.count]),[['[3, 8]',3],['(8, 13]',1]]);
  assert.deepEqual(histogramBins([7,7]).map(b=>[b.label,b.count]),[['7',2]]);
  assert.deepEqual(histogramBins([]),[]);
  const single=render('histogram',{columns:['Sample'],rows:[[3],[5],[8],[13]]}),bins=marks(single,'rect',/columns\.0$/);
  assert.equal(bins.length,2,'two bin bars traced to the value column');
  assert.ok(texts(single).includes('[3, 8]')&&texts(single).includes('(8, 13]'),'bin labels');
  assert.equal(bins[0].fill,palette[0]);
  const byCategory=render('histogram'),bars=marks(byCategory,'rect',/rows\.\d+\.1$/);
  assert.equal(bars.length,4,'one bar per category from the first series');
  assert.ok(Number(bars[1].x)>Number(bars[0].x)&&Number(bars[0].width)>Number(bars[0].x)*0,'bars in row order');
  assert.ok(texts(byCategory).includes('Q1'));
  checks++;
}
{
  // Pareto: columns sorted descending with the cumulative-percentage line on a 0-100% axis.
  const svg=render('pareto',{columns:['Cause','Count'],rows:[['a',10],['b',40],['c',30],['d',20]]}),bars=marks(svg,'rect',/rows\.\d+\.1$/);
  assert.deepEqual(bars.map(b=>b['data-opf-path'].split('.').at(-2)),['1','2','3','0'],'bars sorted by value, descending');
  assert.ok(Number(bars[0].height)>Number(bars[1].height)&&Number(bars[1].height)>Number(bars[3].height));
  const line=marks(svg,'polyline',/columns\.1$/);
  assert.equal(line.length,1,'one cumulative line traced to the series');
  const ys=line[0].points.split(' ').map(p=>Number(p.split(',')[1]));
  assert.ok(ys[0]>ys[1]&&ys[1]>ys[2]&&ys[2]>ys[3],'cumulative line rises');
  assert.ok(texts(svg).includes('100%')&&texts(svg).includes('0%'),'percentage axis');
  assert.equal(line[0].stroke,palette[1]);
  checks++;
}
{
  // Box and whisker: exclusive quartiles (Excel QUARTILE.EXC), whiskers within 1.5 IQR, outliers as markers, one box per category and series.
  assert.deepEqual(boxStatistics([5,8,6,30]),{q1:5.25,median:7,q3:24.5,mean:12.25,low:5,high:30,outliers:[]});
  assert.deepEqual(boxStatistics([1,2,3,4,5,6,7,8,100]),{q1:2.5,median:5,q3:7.5,mean:15.111111111111111,low:1,high:8,outliers:[100]});
  assert.deepEqual(boxStatistics([4]),{q1:4,median:4,q3:4,mean:4,low:4,high:4,outliers:[]});
  assert.deepEqual(boxStatistics([2,6]),{q1:2,median:4,q3:6,mean:4,low:2,high:6,outliers:[]});
  assert.equal(boxStatistics([null,'x']),null);
  const data={columns:['Team','Cycle','Review'],rows:[['A',1,5],['A',2,6],['A',3,7],['A',4,8],['A',5,9],['A',6,5],['A',7,6],['A',8,7],['A',100,8],['B',5,1],['B',6,2],['B',7,3],['B',8,4]]};
  const svg=render('box-and-whisker',data);
  const boxRects=marks(svg,'rect',/columns\.[12]$/),swatches=boxRects.filter(r=>r.width===r.height);
  assert.equal(boxRects.length-swatches.length,4,'one box per category and series');
  assert.equal(marks(svg,'circle',point).length,1,'one outlier marker');
  assert.equal(marks(svg,'circle',point)[0]['data-opf-path'],`${PATH}.data.rows.8.1`,'the outlier is traced to its row');
  assert.equal(swatches.length,2,'legend for two series');
  assert.ok(texts(svg).includes('A')&&texts(svg).includes('B'));
  checks++;
}
{
  // Waterfall: floating bars from the running total, increases and decreases in the first two palette colours, connectors between bars.
  const svg=render('waterfall',{columns:['Step','Value'],rows:[['Start',100],['Gain',24],['Loss',-8],['End',10]]}),bars=marks(svg,'rect',/rows\.\d+\.1$/);
  assert.deepEqual(bars.map(b=>b.fill),[palette[0],palette[0],palette[1],palette[0]],'colour by sign');
  const top=r=>Number(r.y),bottom=r=>Number(r.y)+Number(r.height);
  assert.ok(Math.abs(bottom(bars[1])-top(bars[0]))<0.01,'the second bar starts where the first ends');
  assert.ok(Math.abs(top(bars[2])-top(bars[1]))<0.01,'a decrease starts at the previous total');
  assert.equal(elements(svg,'line').filter(l=>!l['data-opf-path']&&l.stroke==='#888888'&&l.x1!==l.x2&&Number(l.x2)>Number(l.x1)+1).length>=3,true,'connector lines');
  checks++;
}
{
  // Funnel: centred bars from the top with value labels, category labels on the left.
  const svg=render('funnel',{columns:['Stage','Accounts'],rows:[['Qualified',120],['Proposal',72],['Commit',31]]}),bars=marks(svg,'rect',/rows\.\d+\.1$/);
  assert.equal(bars.length,3);
  const centres=bars.map(b=>Number(b.x)+Number(b.width)/2);
  assert.ok(centres.every(c=>Math.abs(c-centres[0])<0.01),'bars are centred');
  assert.ok(Number(bars[0].width)>Number(bars[1].width)&&Number(bars[1].width)>Number(bars[2].width),'widths follow the values');
  assert.ok(Number(bars[0].y)<Number(bars[1].y),'first stage on top');
  assert.ok(['120','72','31','Qualified','Commit'].every(t=>texts(svg).includes(t)),'value and category labels');
  checks++;
}
{
  // Region map: an honest non-geographic tile grid shaded by value, with region names and values.
  const svg=render('world',{columns:['Country','Value'],rows:[['Brazil',10],['Chile',40],['Peru',25]]}),tiles=marks(svg,'rect',/rows\.\d+\.1$/);
  assert.equal(tiles.length,3,'one tile per region');
  assert.equal(tiles[1].fill,palette[0],'the largest value takes the series colour');
  assert.equal(new Set(tiles.map(t=>t.fill)).size,3,'shades differ by value');
  assert.ok(['Brazil','Chile','Peru','10','40','25'].every(t=>texts(svg).includes(t)),'names and values');
  assert.doesNotMatch(svg,/<path/,'no geography is drawn');
  assert.equal(mixHex('#000000','#FFFFFF',0.5),'#808080');
  assert.equal(mixHex('#102030','#FFFFFF',0),'#102030');
  checks++;
}
{
  // A lone value column plots against row numbers for the non-binning constructs, matching the exporter's row-numbers adaptation.
  const svg=render('funnel',{columns:['V'],rows:[[3],[5]]});
  assert.equal(marks(svg,'rect',/rows\.\d+\.0$/).length,2,'values from column 0');
  assert.ok(texts(svg).includes('1')&&texts(svg).includes('2'),'row numbers as categories');
  assert.match(render('treemap',{columns:['V'],rows:[[3],[5]]}),/data-opf-chart="treemap"/);
  // A lone-column box chart draws one (degenerate) box per row, traced to the value column, with row numbers as categories.
  const box=render('box-and-whisker',{columns:['V'],rows:[[3],[5],[8]]});
  assert.equal(marks(box,'rect',/columns\.0$/).length,3,'one box per row from column 0');
  assert.ok(texts(box).includes('1')&&texts(box).includes('3'),'row numbers as categories');
  checks++;
}

// A value outside CHART_TYPES is invalid; drawn with validation off it keeps the legacy preview.
{
  assert.throws(()=>render('mystery-chart'),error=>error.code==='invalid-opf','a type outside CHART_TYPES is rejected at the boundary');
  const svg=render('mystery-chart',categoryData,undefined,{validate:false});
  assert.doesNotMatch(svg,/data-opf-chart=/);
  assert.equal(marks(svg,'rect',/^slides\.0\.chart\.data\.rows\.\d+$/).length,4,'legacy single-series bars');
  // A data source by asset is not part of the format (FA-07): it is rejected at the boundary.
  assert.throws(()=>render('column',{src:'asset:missing'}),error=>error.code==='invalid-opf');
  checks++;
}

console.log(`Chart types passed: ${checks} checks; ${CLASSIC.length} classic and ${CHARTEX.length} chartex ids on the chart-type renderer, unknown values on the legacy preview.`);
