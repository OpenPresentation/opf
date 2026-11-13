// One current signed categorical histogram adaptation. Never native-bin eligibility.
import assert from 'node:assert/strict';
import {digest} from './identity.mjs';
import {inspectSevenArchive,bindSevenPhase,archiveDependencies} from './seven-chart-archive.mjs';
import {currentSevenSource,currentSevenArchiveContext,classifyCurrentSeven} from './seven-value-current.mjs';
import {sevenWorkbookAliasPartition} from './seven-value-archive.mjs';
import {assertCurrentSevenPublicData} from './seven-signed-pareto.mjs';
export const HISTOGRAM_VALUE_PROFILE='seven-histogram-classic-single-value-edit-v1';
export const HISTOGRAM_SNAPSHOT_PROFILE='seven-histogram-classic-setter-native-archives-v1';
export const HISTOGRAM_SELECTION=Object.freeze({slideIndex:2,seriesIndex:1,pointIndex:1,newValue:43});
// RR-105 Keynote fix 4 (2026-11-12): default fallback changed from a classic chart to a picture of OPF's own preview, 2026-11-12,
// supervisor decision for the owner, vetoable. The four chartex slides' mc:Fallback is now a picture and their classic chart parts are
// gone; the classic histogram (ppt/charts/chart2.xml), its workbook and every mc:Choice are unchanged. The native edits recorded under
// docs/handoff/2026-11-11 ran on the previous archive.
// RR-105 (#1290, 2026-11-12, chart workbook properties): only docProps/core.xml (creator, lastModifiedBy) and docProps/app.xml
// (Application) inside the seven embedded workbooks changed; every slide, chart part and workbook sheet, table and string part is
// byte-identical (part-by-part comparison of the all-seven chartex:'native' export of f3f0b2b1f and of this commit). Previous:
// {bytes:226821,sha256:'0ef9865fa636d57b3fa37d370884d507414d0377a5c56209cbddbabea308c567'}.
// RR-105 (#1290, 2026-11-12, notes page size): only ppt/presentation.xml changed (p:notesSz), part-by-part comparison with the\nexport of 885219b9c. Previous: {bytes:226668,sha256:'c19ae4cda7488d6e25ffa48f6076a47ff51b740b4b37f11695aa85d1ea94224e'}.
export const HISTOGRAM_SOURCE_ARCHIVE=Object.freeze({bytes:226667,sha256:'e3fa122fe5828ba09b64a883225db6560d65ab4ac75493d77e39836dd9393218'});
export const HISTOGRAM_SOURCE_ARCHIVE_BEFORE_RR105_PICTURE=Object.freeze({bytes:184592,sha256:'04c92723efe8485678dc087ab88506486542aee860ad7bc4db11005600ab55fb'});
const keys=(value,names)=>assert.deepEqual(Object.keys(value).sort(),[...names].sort());
const modelHash=value=>digest(Buffer.from(JSON.stringify(value)));
const actionKeys=['op','slideIndex','shapeId','shapeName','branch','sourceType','comChartType','seriesIndex','maxSeriesCount','seriesName','chartPart','chartFamily','dataId','dimensionIndex','layoutId','dataFormula','workbookPart','worksheet','workbookCells','pointIndex','expectedValues','newValues','inputSha256','sourceModelSha256'];
export function assertHistogramAction(action){
 keys(action,actionKeys);
 for(const [key,value]of Object.entries({op:'set-seven-classic-histogram-values',slideIndex:2,shapeId:3,shapeName:'OPF chart 2',branch:'direct',sourceType:'histogram',comChartType:51,seriesIndex:1,maxSeriesCount:1,seriesName:'Value',chartPart:'ppt/charts/chart2.xml',chartFamily:'classic',dataId:null,dimensionIndex:null,layoutId:null,dataFormula:'Sheet1!$B$2:$B$5',worksheet:'Sheet1',workbookCells:['B2','B3','B4','B5'],pointIndex:1,expectedValues:[42,31,-8,19],newValues:[43,31,-8,19]}))assert.deepEqual(action[key],value,key);
 assert.match(action.workbookPart,/^ppt\/embeddings\/Microsoft_Excel_Worksheet[0-9]*\.xlsx(?![\s\S])/u);
 for(const key of ['inputSha256','sourceModelSha256'])assert.match(action[key],/^[a-f0-9]{64}(?![\s\S])/u);
 return action;
}
export function bindHistogramActionFile(bytes,action){
 assertHistogramAction(action);assert.ok(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=4194304);
 const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));assertHistogramAction(parsed);assert.deepEqual(parsed,action);
 return{action:structuredClone(action),actionModelSha256:modelHash(action),actionFileIdentity:{bytes:bytes.length,sha256:digest(bytes)}};
}
function selected(archive){
 const shapes=archive.slides[1].shapes.filter(shape=>shape.kind==='chart');assert.equal(shapes.length,1);const shape=shapes[0];
 assert.deepEqual([shape.branch,shape.id,shape.name,shape.chart.family,shape.chart.construct],['direct',3,'OPF chart 2','classic','c:barChart']);
 assert.equal(shape.chartPart,'ppt/charts/chart2.xml');assert.equal(shape.chart.series.length,1);assert.equal(shape.chart.workbook.sheet,'Sheet1');
 const references=archive.slides.flatMap(slide=>slide.shapes).filter(other=>other.kind==='chart'&&other.chart.workbook.part===shape.chart.workbook.part);assert.equal(references.length,1,'This closed histogram owns one separate workbook');return shape;
}
export function bindCurrentHistogram(input,source,selection,{root,deps=archiveDependencies()}={}){
 assert.deepEqual(source,currentSevenSource(root));assert.deepEqual(selection,HISTOGRAM_SELECTION);
 assert.deepEqual(source.slides[1],{title:'histogram',chart:{type:'histogram',data:{columns:['Region','Value'],rows:[['North',42],['South',31],['East',-8],['West',19]]}}});
 const archiveContext=currentSevenArchiveContext(root,source),archive=inspectSevenArchive(input,deps,archiveContext),shape=selected(archive),chart=shape.chart,series=chart.series[0];
 const classification=classifyCurrentSeven(archive,source);assert.equal(classification[1].representation,'classic-column-fallback');
 assert.deepEqual(series,{index:'0',order:'0','c:tx':{formula:'Sheet1!$B$1',values:['Value']},'c:cat':{formula:'Sheet1!$A$2:$A$5',values:['North','South','East','West']},'c:val':{formula:'Sheet1!$B$2:$B$5',values:[42,31,-8,19]}});
 const action={op:'set-seven-classic-histogram-values',slideIndex:2,shapeId:shape.id,shapeName:shape.name,branch:'direct',sourceType:'histogram',comChartType:51,seriesIndex:1,maxSeriesCount:1,seriesName:'Value',chartPart:shape.chartPart,chartFamily:'classic',dataId:null,dimensionIndex:null,layoutId:null,dataFormula:series['c:val'].formula,workbookPart:chart.workbook.part,worksheet:chart.workbook.sheet,workbookCells:['B2','B3','B4','B5'],pointIndex:1,expectedValues:[42,31,-8,19],newValues:[43,31,-8,19],inputSha256:digest(input),sourceModelSha256:modelHash(source)};
 assertHistogramAction(action);histogramNumericReadback(archive,action);
 const arrays=archive.slides.flatMap(slide=>slide.shapes.filter(s=>s.kind==='chart').flatMap(s=>s.chart.family==='classic'?s.chart.series.map(v=>v['c:val'].values):s.chart.caches.flatMap(c=>c.dimensions.filter(d=>d.kind==='cx:numDim').map(d=>d.values))));assert.equal(Math.max(...arrays.map(a=>a.length)),4);
 return{archive,archiveContext,action,actionModelSha256:modelHash(action),classification,census:{arrays:arrays.length,maximum:4},representation:'classic-column-fallback',nativeTypeQualified:false};
}
export function histogramNumericReadback(archive,action){
 assertHistogramAction(action);const shape=selected(archive),chart=shape.chart,series=chart.series[0];assert.equal(chart.workbook.part,action.workbookPart);assert.equal(series['c:val'].formula,action.dataFormula);
 const cells=chart.workbook.cells;const workbookValues=action.workbookCells.map(cell=>{const found=cells.filter(row=>row.cell===cell);assert.equal(found.length,1);return found[0].value;});
 assert.deepEqual(series['c:val'].values,workbookValues,'Actual histogram cache/workbook disagree');
 const expectedCells=[['Region','Value'],...['North','South','East','West'].map((category,index)=>[category,workbookValues[index]])].flatMap((row,i)=>row.map((value,j)=>({cell:String.fromCharCode(65+j)+(i+1),value})));
 assert.deepEqual(cells,expectedCells,'Complete categorical histogram workbook required');return{values:[...series['c:val'].values],workbookValues};
}
export function compareHistogramPersisted({input,saved,source,action,phases,imports,root,deps=archiveDependencies()}){
 const bound=bindCurrentHistogram(input,source,HISTOGRAM_SELECTION,{root,deps});assert.deepEqual(bound.action,action);const after=inspectSevenArchive(saved,deps,bound.archiveContext);
 assert.deepEqual(sevenWorkbookAliasPartition(after),sevenWorkbookAliasPartition(bound.archive));
 const expected=structuredClone(bound.archive.slides),shape=selected({slides:expected});shape.chart.series[0]['c:val'].values[0]=43;const cell=shape.chart.workbook.cells.filter(row=>row.cell==='B2');assert.equal(cell.length,1);cell[0].value=43;
 assert.deepEqual(after.canvas,bound.archive.canvas);assert.deepEqual(after.slides,expected,'Whole-seven parsed archive changed beyond the one histogram cache/workbook cell');
 bindSevenPhase(bound.archive,phases.original);bindSevenPhase(after,phases['saved-reopened']);histogramNumericReadback(after,action);
 const baseline=imports.original.document;assertCurrentSevenPublicData(baseline,source,bound.archiveContext);const wanted=structuredClone(baseline);wanted.slides[1].chart.data.rows[0][1]=43;
 assert.deepEqual(imports['saved-reopened'].document,wanted,'Full public import must retain only the one histogram numeric edit');assert.deepEqual(imports['saved-reopened'].diagnostics,imports.original.diagnostics,'Actual histogram and whole-seven diagnostics must remain exact');
 return{profile:HISTOGRAM_VALUE_PROFILE,inputSha256:digest(input),savedSha256:digest(saved),representation:'classic-column-fallback',nativeTypeQualified:false,nativeAcceptance:false,registryAcceptance:false};
}
