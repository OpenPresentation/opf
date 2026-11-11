// Historical checkpoint03 single-edit contract, carried forward unexecuted.
// NOT current-corpus admission: signed histogram now exposes a direct classic
// branch, whereas this historical action schema requires histogram Choice/118.
// See the source checkpoint design before adding a production entrypoint.
import assert from 'node:assert/strict';
import {inspectSevenArchive,bindSevenPhase,archiveDependencies} from './seven-chart-archive.mjs';
import {assertSevenTitles,compareSevenBindings} from './seven-chart-profile.mjs';
import {digest} from './identity.mjs';
import {assertCurrentSevenPublicData} from './seven-signed-pareto.mjs';

export const SEVEN_VALUE_PROFILE='seven-chart-single-value-edit-v1';
// All46 numeric arrays in the four hash-locked HISTORICAL seven fixtures have four values.
// The accompanying census binds those archives. A larger/new corpus requires a new reviewed admission.
export const SEVEN_VALUE_MAX_VALUES=4;
export const SEVEN_VALUE_TYPES=Object.freeze({treemap:117,histogram:118,pareto:122,'box-and-whisker':121,waterfall:119,funnel:123,world:51});
const layouts=Object.freeze({treemap:'treemap',histogram:'clusteredColumn',pareto:'clusteredColumn','box-and-whisker':'boxWhisker',waterfall:'waterfall',funnel:'funnel'});
const clone=value=>structuredClone(value);
const keys=(value,expected)=>assert.deepEqual(Object.keys(value).sort(),[...expected].sort(),'Unknown/missing prospective value field');
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const jsonDigest=value=>digest(Buffer.from(JSON.stringify(value)));
export function assertSevenNumericArray(values){
 assert.ok(Array.isArray(values)&&values.length>0&&values.length<=SEVEN_VALUE_MAX_VALUES,'Numeric array exceeds admitted seven-corpus bound');
 for(let index=0;index<values.length;index++)assert.ok(Object.hasOwn(values,index)&&finite(values[index]),'Only dense finite numeric primitives are permitted');return values;
}
export function assertSevenSingleDelta(before,after,pointIndex){
 assertSevenNumericArray(before);assertSevenNumericArray(after);assert.equal(before.length,after.length,'Array length changed');
 assert.ok(Number.isInteger(pointIndex)&&pointIndex>=1&&pointIndex<=before.length);
 const changed=before.flatMap((value,index)=>value===after[index]?[]:[index+1]);assert.deepEqual(changed,[pointIndex],'Exactly the selected one-based index must change');return true;
}
function sourceValues(source,slideIndex){
 assert.equal(source.slides.length,7);const chart=source.slides[slideIndex-1]?.chart;assert.ok(chart&&Object.hasOwn(SEVEN_VALUE_TYPES,chart.type));
 const data=chart.data;assert.ok(data&&Array.isArray(data.columns)&&data.columns.length===2&&Array.isArray(data.rows));
 assert.ok(data.rows.every(row=>Array.isArray(row)&&row.length===2&&typeof row[0]==='string'&&finite(row[1])),'Prospective profile requires exact two-column category/numeric data');
 return{chart,values:assertSevenNumericArray(data.rows.map(row=>row[1]))};
}
function cellsFor(formula,book){
 assert.ok(book&&typeof formula==='string');
 const match=/^(?:'([^']+)'|([^'!]+))!\$([A-Z]+)\$([1-9][0-9]*)(?::\$([A-Z]+)\$([1-9][0-9]*))?$/u.exec(formula);
 assert.ok(match&&(!match[5]||match[5]===match[3]),'One bounded worksheet column required');assert.equal(match[1]??match[2],book.sheet);
 const start=Number(match[4]),end=Number(match[6]??match[4]);assert.ok(end>=start&&end-start<SEVEN_VALUE_MAX_VALUES);
 const cells=Array.from({length:end-start+1},(_,index)=>match[3]+(start+index));
 return cells.map(cell=>{const found=book.cells.filter(item=>item.cell===cell);assert.equal(found.length,1);assert.ok(finite(found[0].value));return cell;});
}
function numericSlot(shape){
 const chart=shape.chart;assert.ok(chart.series.length>=1&&chart.series.length<=2,'Only actual admitted owner/optional Pareto derived series permitted');
 if(chart.family==='classic'){
  assert.equal(chart.construct,'c:barChart');assert.equal(chart.series.length,1);const series=chart.series[0],data=series['c:val'];
  assert.ok(Array.isArray(data?.values)&&typeof data.formula==='string');const name=series['c:tx'];
  const seriesName=name.values?name.values[0]:name.value;assert.equal(typeof seriesName,'string');
  return{values:data.values,formula:data.formula,name:seriesName,dataId:null,dimensionIndex:null,layoutId:null};
 }
 assert.equal(chart.family,'chartEx');const series=chart.series[0];assert.notEqual(series.derived,true,'Derived Pareto line is not a data-edit target');
 assert.equal(chart.series.filter(item=>!item.derived).length,1);
 const found=chart.caches.filter(cache=>cache.id===series.dataId);assert.equal(found.length,1);
 const dimensions=found[0].dimensions.flatMap((dim,index)=>dim.kind==='cx:numDim'?[{dim,index}]:[]);assert.equal(dimensions.length,1,'Ambiguous numeric dimension');
 return{values:dimensions[0].dim.values,formula:dimensions[0].dim.formula,name:series.name,dataId:series.dataId,dimensionIndex:dimensions[0].index,layoutId:series.layoutId};
}
function derivedSignatures(input,archive,deps){
 const parts=deps.unzipSync(input),parser=new deps.XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,parseAttributeValue:false,trimValues:true}),signatures=[];
 for(const slide of archive.slides)for(const shape of slide.shapes){
  if(shape.kind!=='chart'||shape.chart.family!=='chartEx'||!shape.chart.series.some(series=>series.derived))continue;
  const parsed=parser.parse(deps.strFromU8(parts[shape.chartPart]));const raw=parsed['cx:chartSpace']['cx:chart']['cx:plotArea']['cx:plotAreaRegion']['cx:series'];const series=Array.isArray(raw)?raw:[raw];
  assert.equal(series.length,2,'Only one owner and its Pareto derived line are admitted');const derived=series[1];
  keys(derived,['layoutId','ownerIdx','uniqueId','cx:spPr','cx:axisId']);assert.equal(derived.layoutId,'paretoLine');assert.equal(derived.ownerIdx,'0');assert.equal(typeof derived.uniqueId,'string');
  assert.equal(typeof derived['cx:spPr'],'object');assert.ok(derived['cx:spPr']);assert.ok(Array.isArray(derived['cx:axisId']));assert.deepEqual(derived['cx:axisId'].map(axis=>{keys(axis,['val']);return axis.val;}),['0','2']);
  // No persisted derived Values/formula/cache exists in this admitted representation.
  // Unknown derived children (including any new data/cached percentages) fail above.
  const signature=clone(derived);delete signature.uniqueId;signatures.push({slide:slide.index,branch:shape.branch,signature});
 }
 return signatures;
}
export function sevenCorpusNumericMaximum(archive){
 const arrays=archive.slides.flatMap(slide=>slide.shapes.filter(shape=>shape.kind==='chart').flatMap(shape=>shape.chart.family==='chartEx'
  ?shape.chart.caches.flatMap(cache=>cache.dimensions.filter(dim=>dim.kind==='cx:numDim').map(dim=>dim.values))
  :shape.chart.series.map(series=>series['c:val']?.values)));
 assert.ok(arrays.length>0);for(const values of arrays)assertSevenNumericArray(values);return Math.max(...arrays.map(values=>values.length));
}
export function bindSingleSevenValueTarget(input,source,selection,{deps=archiveDependencies(),archiveContext}={}){
 keys(selection,['slideIndex','branch','seriesIndex','pointIndex','newValue']);
 assert.ok(Number.isInteger(selection.slideIndex)&&selection.slideIndex>=1&&selection.slideIndex<=7);assert.equal(selection.seriesIndex,1,'Only the first source owner series is admitted');assert.ok(finite(selection.newValue));
 const archive=inspectSevenArchive(input,deps,archiveContext);assertSevenTitles(archive,source);sevenCorpusNumericMaximum(archive);derivedSignatures(input,archive,deps);
 const {chart:authored,values}=sourceValues(source,selection.slideIndex),shapes=archive.slides[selection.slideIndex-1].shapes.filter(shape=>shape.kind==='chart'&&shape.branch===selection.branch);assert.equal(shapes.length,1,'Exact source branch required');const shape=shapes[0];
 if(authored.type==='world'){assert.equal(selection.branch,'direct');assert.equal(shape.chart.family,'classic');}
 else{assert.equal(selection.branch,'choice','ChartEx edit must address actual native choice, never its classic fallback');assert.equal(shape.chart.family,'chartEx');}
 const slot=numericSlot(shape);
 if(shape.chart.family==='chartEx'){assert.equal(slot.layoutId,layouts[authored.type],'ChartEx layout differs from the authored type');assert.equal(shape.chart.series.some(series=>series.derived),authored.type==='pareto','Derived Pareto ownership differs');}
 assertSevenNumericArray(slot.values);assert.deepEqual(slot.values,values,'Native cache does not address the authored numeric array');
 assert.equal(slot.name,authored.data.columns[1]);assert.ok(slot.name.length>0&&slot.name.length<=255&&!/[\u0000-\u001f]/u.test(slot.name));
 const workbookCells=cellsFor(slot.formula,shape.chart.workbook);assert.equal(workbookCells.length,values.length);
 const next=[...values];assert.ok(Number.isInteger(selection.pointIndex)&&selection.pointIndex>=1&&selection.pointIndex<=values.length);next[selection.pointIndex-1]=selection.newValue;assertSevenSingleDelta(values,next,selection.pointIndex);
 const action={op:'set-seven-series-values',slideIndex:selection.slideIndex,shapeId:shape.id,shapeName:shape.name,branch:shape.branch,sourceType:authored.type,comChartType:SEVEN_VALUE_TYPES[authored.type],seriesIndex:1,maxSeriesCount:shape.chart.series.length,seriesName:slot.name,chartPart:shape.chartPart,chartFamily:shape.chart.family,dataId:slot.dataId,dimensionIndex:slot.dimensionIndex,layoutId:slot.layoutId,dataFormula:slot.formula,workbookPart:shape.chart.workbook.part,worksheet:shape.chart.workbook.sheet,workbookCells,pointIndex:selection.pointIndex,expectedValues:[...values],newValues:next,inputSha256:digest(input),sourceModelSha256:jsonDigest(source)};
 return{archive,action,actionModelSha256:jsonDigest(action)};
}
// The caller supplies the deterministic action returned by the original source/cache/workbook rebind.
// Wire whitespace/BOM/member order are not additional semantic actions, but their exact bytes stay distinct.
export function bindSevenValueActionFile(bytes,reboundAction){
 assertSevenValueAction(reboundAction);assert.ok(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=4*1024*1024,'Bounded owned action JSON required');
 const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));assertSevenValueAction(parsed);assert.deepEqual(parsed,reboundAction,'Action wire does not match the rebound model');
 return{action:clone(reboundAction),actionModelSha256:jsonDigest(reboundAction),actionFileIdentity:{bytes:bytes.length,sha256:digest(bytes)}};
}
export function assertSevenValueAction(action){
 keys(action,['op','slideIndex','shapeId','shapeName','branch','sourceType','comChartType','seriesIndex','maxSeriesCount','seriesName','chartPart','chartFamily','dataId','dimensionIndex','layoutId','dataFormula','workbookPart','worksheet','workbookCells','pointIndex','expectedValues','newValues','inputSha256','sourceModelSha256']);
 assert.equal(action.op,'set-seven-series-values');assert.ok(Number.isInteger(action.slideIndex)&&action.slideIndex>=1&&action.slideIndex<=7);assert.ok(Number.isInteger(action.shapeId)&&action.shapeId>0);assert.equal(action.seriesIndex,1);
 assert.ok(Object.hasOwn(SEVEN_VALUE_TYPES,action.sourceType));assert.equal(action.maxSeriesCount,action.sourceType==='pareto'?2:1);assert.equal(action.comChartType,SEVEN_VALUE_TYPES[action.sourceType]);
 for(const field of ['shapeName','seriesName','chartPart','dataFormula','workbookPart','worksheet'])assert.ok(typeof action[field]==='string'&&action[field].length>0&&!/[\u0000-\u001f]/u.test(action[field]));
 assert.ok(action.seriesName.length<=255);
 assertSevenSingleDelta(action.expectedValues,action.newValues,action.pointIndex);assert.ok(Array.isArray(action.workbookCells)&&action.workbookCells.length===action.expectedValues.length&&new Set(action.workbookCells).size===action.workbookCells.length);for(const cell of action.workbookCells)assert.match(cell,/^[A-Z]+[1-9][0-9]*$/u);
 for(const field of ['inputSha256','sourceModelSha256'])assert.match(action[field],/^[a-f0-9]{64}$/u);
 if(action.sourceType==='world'){assert.equal(action.branch,'direct');assert.equal(action.chartFamily,'classic');assert.equal(action.dataId,null);assert.equal(action.dimensionIndex,null);assert.equal(action.layoutId,null);}
 else{assert.equal(action.branch,'choice');assert.equal(action.chartFamily,'chartEx');assert.ok(typeof action.dataId==='string'&&action.dataId.length>0&&!/[\u0000-\u001f]/u.test(action.dataId));assert.ok(Number.isInteger(action.dimensionIndex)&&action.dimensionIndex>=0);assert.equal(action.layoutId,layouts[action.sourceType]);}
 return action;
}
function applyExpectedChartDelta(chart,action){
 const values=chart.family==='classic'?chart.series[0]['c:val'].values:chart.caches.find(cache=>cache.id===action.dataId).dimensions[action.dimensionIndex].values;
 assert.deepEqual(values,action.expectedValues);values[action.pointIndex-1]=action.newValues[action.pointIndex-1];
 const cell=chart.workbook.cells.filter(item=>item.cell===action.workbookCells[action.pointIndex-1]);assert.equal(cell.length,1);assert.equal(cell[0].value,action.expectedValues[action.pointIndex-1]);cell[0].value=action.newValues[action.pointIndex-1];
}
function expectedArchiveDelta(archive,action){
 const expected=clone(archive);let cacheReferences=0,workbookReferences=0;
 for(const slide of expected.slides)for(const shape of slide.shapes){
  if(shape.kind!=='chart'||shape.chart.workbook.part!==action.workbookPart)continue;
  const chart=shape.chart,book=chart.workbook;assert.equal(book.sheet,action.worksheet);
  const cell=book.cells.filter(item=>item.cell===action.workbookCells[action.pointIndex-1]);assert.equal(cell.length,1);assert.equal(cell[0].value,action.expectedValues[action.pointIndex-1]);cell[0].value=action.newValues[action.pointIndex-1];workbookReferences++;
  const slots=chart.family==='classic'?chart.series.map(series=>series['c:val']):chart.caches.flatMap(cache=>cache.dimensions.filter(dim=>dim.kind==='cx:numDim'));
  for(const slot of slots){
   const cells=cellsFor(slot.formula,book),index=cells.indexOf(action.workbookCells[action.pointIndex-1]);
   if(index<0)continue;assert.equal(slot.values[index],action.expectedValues[action.pointIndex-1]);slot.values[index]=action.newValues[action.pointIndex-1];cacheReferences++;
  }
 }
 assert.ok(cacheReferences>0&&workbookReferences>0,'Selected workbook cell has no cache references');return{expected,cacheReferences,workbookReferences};
}
function semanticSlides(archive){
 const slides=clone(archive.slides);for(const slide of slides)for(const shape of slide.shapes)if(shape.kind==='chart'){delete shape.chartPart;delete shape.chart.workbook.part;}return slides;
}
export function sevenWorkbookAliasPartition(archive){
 const groups=new Map(),labels=new Set();
 for(const slide of archive.slides)for(const shape of slide.shapes){
  if(shape.kind!=='chart')continue;const label=`${slide.index}/${shape.branch}`,part=shape.chart.workbook?.part;
  assert.ok(!labels.has(label),'Ambiguous chart branch in alias partition');labels.add(label);assert.ok(typeof part==='string'&&part.length>0);
  let group=groups.get(part);if(!group)groups.set(part,group=[]);group.push(label);
 }
 return[...groups.values()].map(group=>group.sort()).sort((a,b)=>a[0].localeCompare(b[0]));
}
export function comparePersistedSevenValueEdit({input,saved,source,action,phases,imports,deps=archiveDependencies(),archiveContext}){
 assertSevenValueAction(action);const rebound=bindSingleSevenValueTarget(input,source,{slideIndex:action.slideIndex,branch:action.branch,seriesIndex:action.seriesIndex,pointIndex:action.pointIndex,newValue:action.newValues[action.pointIndex-1]},{deps,archiveContext});assert.deepEqual(rebound.action,action,'Action no longer binds the exact original source/cache/workbook');
 // Existing strict parsing refuses stale cache/workbook pairs, lost formulas and unsupported rewritten data.
 const savedArchive=inspectSevenArchive(saved,deps,archiveContext);assertSevenTitles(savedArchive,source);sevenCorpusNumericMaximum(savedArchive);
 assert.deepEqual(sevenWorkbookAliasPartition(savedArchive),sevenWorkbookAliasPartition(rebound.archive),'Saved workbook sharing classes changed; part renames cannot waive splits or merges');
 assert.deepEqual(derivedSignatures(saved,savedArchive,deps),derivedSignatures(input,rebound.archive,deps),'Derived owner/axes/style changed or introduced an unmodeled persisted dependency');
 // Choice and fallback share a workbook in the retained corpus. Every cache reference
 // to this ONE logical cell must agree; unrelated hidden branches/data remain strict.
 const persisted=expectedArchiveDelta(rebound.archive,action);assert.deepEqual(semanticSlides(savedArchive),semanticSlides(persisted.expected),'Parsed archive differs beyond the one logical workbook-cell edit and all its cache references');
 const before=bindSevenPhase(rebound.archive,phases.original),after=bindSevenPhase(savedArchive,phases['saved-reopened']);
 const originalTarget=before[action.slideIndex-1].shapes.find(shape=>shape.kind==='chart');assert.equal(originalTarget.id,action.shapeId);assert.equal(originalTarget.name,action.shapeName);assert.equal(originalTarget.branch,action.branch);assert.equal(originalTarget.chartPart,action.chartPart);
 const expected=clone(before);applyExpectedChartDelta(expected[action.slideIndex-1].shapes.find(shape=>shape.kind==='chart').chart,action);
 assert.deepEqual(compareSevenBindings(expected,after),[],'Persisted data differs beyond the one numeric cache/workbook cell');
 for(let index=0;index<7;index++)for(const kind of ['title','chart']){
  const a=before[index].shapes.find(shape=>shape.kind===kind),b=after[index].shapes.find(shape=>shape.kind===kind);assert.deepEqual([b.id,b.name,b.type,b.geometry],[a.id,a.name,a.type,a.geometry],'Saved native identity/geometry changed');
 }
 assert.ok(imports&&imports.original&&imports['saved-reopened']);
 const baseline=imports.original.document,edited=imports['saved-reopened'].document;assert.equal(baseline.slides.length,7);assert.equal(edited.slides.length,7);
 if(archiveContext)assertCurrentSevenPublicData(baseline,source,archiveContext);
 else for(let index=0;index<7;index++)assert.deepEqual(baseline.slides[index].chart?.data,source.slides[index].chart.data,'Original public import differs from authored data');
 const wanted=clone(baseline);wanted.slides[action.slideIndex-1].chart.data.rows[action.pointIndex-1][1]=action.newValues[action.pointIndex-1];
 assert.deepEqual(edited,wanted,'Public import must retain the native value edit and nothing else');
 assert.deepEqual(imports['saved-reopened'].diagnostics,imports.original.diagnostics,'Changed import diagnostics require review; no blanket waiver');
 return{profile:SEVEN_VALUE_PROFILE,nativeAcceptance:false,registryAcceptance:false,scope:'Exactly one parsed-data numeric edit; physical/compatibility/release acceptance and raw OOXML style fidelity remain separate',inputSha256:digest(input),savedSha256:digest(saved),actionModelSha256:rebound.actionModelSha256,cacheReferences:persisted.cacheReferences,workbookReferences:persisted.workbookReferences,nativeMapQualified:false,rawOoxmlStyleFidelity:'OPEN'};
}
