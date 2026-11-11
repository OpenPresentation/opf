// Native-generated archive readbacks, never fabricated Series.Values observations.
import assert from 'node:assert/strict';
import {digest} from './identity.mjs';
import {inspectSevenArchive,archiveDependencies,bindSevenPhase} from './seven-chart-archive.mjs';
import {bindCurrentTreemap} from './seven-value-current.mjs';
import {comparePersistedSevenValueEdit,sevenWorkbookAliasPartition} from './seven-value-archive.mjs';
import {assertSnapshotRawPreservation,snapshotSourceBeforeRawFindings} from './seven-value-snapshot-namespace.mjs';

export function snapshotNumericReadback(archive,action){
 const matches=archive.slides[action.slideIndex-1].shapes.filter(shape=>shape.kind==='chart'&&shape.branch===action.branch&&shape.id===action.shapeId&&shape.name===action.shapeName);assert.equal(matches.length,1);const chart=matches[0].chart;assert.equal(chart.family,'chartEx');
 const data=chart.caches.filter(cache=>cache.id===action.dataId);assert.equal(data.length,1);const dimension=data[0].dimensions[action.dimensionIndex];assert.equal(dimension.kind,'cx:numDim');assert.equal(dimension.formula,action.dataFormula);
 assert.equal(chart.workbook.part,action.workbookPart);assert.equal(chart.workbook.sheet,action.worksheet);
 const workbookValues=action.workbookCells.map(cell=>{const found=chart.workbook.cells.filter(row=>row.cell===cell);assert.equal(found.length,1);return found[0].value;});assert.deepEqual(dimension.values,workbookValues,'Actual native cache/workbook readbacks disagree');
 return{values:[...dimension.values],workbookValues};
}
function unchangedRaw(input,saved,action,values,deps,archiveContext){
 // This internal zero-delta comparison action is not a setter request/receipt.
 // The guard checks each selected leaf equals values before masking it.
 return assertSnapshotRawPreservation({input,saved,action:{...action,expectedValues:[...values],newValues:[...values]},deps,archiveContext});
}
const list=value=>value===undefined?[]:Array.isArray(value)?value:[value];
// Closed source/data-role fields only. Paint, spacing and extensions are retained
// by the separate OPEN raw findings, never asserted equal or rewritten here.
function fields(node,names){
 if(node===undefined||node==='')return{};
 assert.ok(node&&typeof node==='object'&&!Array.isArray(node),'One semantic container required');
 for(const key of Object.keys(node))assert.ok(names.includes(key)||(key==='#text'&&typeof node[key]==='string'&&/^[ \t\r\n]*$/u.test(node[key])),'Unknown source-role field '+key);
 return Object.fromEntries(Object.entries(node).filter(([key])=>key!=='#text'));
}
const attr=(node,names)=>fields(node,names);
const leaf=node=>{const value=fields(node,['val']);assert.equal(typeof value.val,'string','Typed semantic value required');return value.val;};
function values(node,names){return Object.fromEntries(names.filter(name=>Object.hasOwn(node,name)).map(name=>[name,leaf(node[name])]));}
function classicRoles(plot){
 fields(plot,['c:layout','c:barChart','c:lineChart','c:catAx','c:valAx','c:spPr','c:extLst']);
 const groups=Object.keys(plot).filter(key=>key.endsWith('Chart')).map(construct=>{
  const group=fields(plot[construct],['c:ser','c:barDir','c:grouping','c:axId','c:varyColors','c:dLbls','c:gapWidth','c:overlap','c:marker','c:smooth','c:extLst']);
  const series=list(group['c:ser']).map(node=>{
   fields(node,['c:idx','c:order','c:tx','c:cat','c:val','c:spPr','c:dPt','c:dLbls','c:invertIfNegative','c:marker','c:smooth','c:extLst']);
   const cacheFormats={};for(const key of ['c:tx','c:cat','c:val'])if(Object.hasOwn(node,key)){
    const data=fields(node[key],['c:strRef','c:numRef','c:v','c:extLst']),alternatives=Object.keys(data).filter(name=>name!=='c:extLst');assert.equal(alternatives.length,1,'One complete semantic data alternative required');
    cacheFormats[key]={kind:alternatives[0]};
    for(const [kind,cache]of [['c:strRef','c:strCache'],['c:numRef','c:numCache']])if(Object.hasOwn(data,kind)){
     const ref=fields(data[kind],['c:f',cache,'c:extLst']),contents=fields(ref[cache],['c:formatCode','c:ptCount','c:pt','c:extLst']);
     leaf(contents['c:ptCount']);
     if(Object.hasOwn(contents,'c:formatCode')){assert.equal(typeof contents['c:formatCode'],'string');cacheFormats[key].formatCode=contents['c:formatCode'];}
     for(const point of list(contents['c:pt'])){fields(point,['idx','c:v']);assert.equal(typeof point['c:v'],'string','One complete literal cache value required');}
    }
   }
   return{...values(node,['c:idx','c:order']),cacheFormats};
  });
  return{construct,...values(group,['c:barDir','c:grouping']),axisIds:list(group['c:axId']).map(leaf),series};
 });
 const axes=['c:catAx','c:valAx'].flatMap(kind=>list(plot[kind]).map(node=>{
  fields(node,['c:axId','c:scaling','c:delete','c:axPos','c:numFmt','c:crossAx','c:crosses','c:crossesAt','c:crossBetween','c:majorUnit','c:minorUnit','c:auto','c:lblAlgn','c:lblOffset','c:noMultiLvlLbl','c:majorTickMark','c:minorTickMark','c:tickLblPos','c:spPr','c:txPr','c:majorGridlines','c:minorGridlines','c:extLst']);
  const scaling=fields(node['c:scaling'],['c:min','c:max','c:orientation','c:logBase','c:extLst']);
  return{kind,...values(node,['c:axId','c:delete','c:axPos','c:crossAx','c:crosses','c:crossesAt','c:crossBetween','c:majorUnit','c:minorUnit']),scaling:values(scaling,['c:min','c:max','c:orientation','c:logBase']),...(Object.hasOwn(node,'c:numFmt')?{numberFormat:attr(node['c:numFmt'],['formatCode','sourceLinked'])}:{})};
 }));
 return{groups,axes};
}
function nativeRoles(plot,chartData){
 fields(chartData,['cx:data','cx:externalData','cx:extLst']);
 const cacheFormats=list(chartData['cx:data']).map(data=>{
  fields(data,['id','cx:strDim','cx:numDim','cx:extLst']);
  return{id:data.id,dimensions:['cx:strDim','cx:numDim'].flatMap(kind=>list(data[kind]).map(dimension=>{
   fields(dimension,['type','cx:f','cx:lvl','cx:extLst']);return{kind,levels:list(dimension['cx:lvl']).map(level=>{
    fields(level,['ptCount','formatCode','cx:pt','cx:extLst']);assert.equal(typeof level.ptCount,'string');
    for(const point of list(level['cx:pt'])){assert.ok(point&&typeof point==='object'&&!Array.isArray(point));assert.ok(Object.keys(point).every(key=>['idx','#text'].includes(key)),'Unknown native cache point field');assert.equal(typeof point.idx,'string');assert.equal(typeof point['#text'],'string');}
    if(Object.hasOwn(level,'formatCode')){assert.equal(typeof level.formatCode,'string');return{formatCode:level.formatCode};}return{};
   })};
  }))};
 });
 fields(plot,['cx:plotAreaRegion','cx:axis','cx:extLst']);const region=fields(plot['cx:plotAreaRegion'],['cx:series','cx:plotSurface','cx:extLst']);
 const series=list(region['cx:series']).map(node=>{
  fields(node,['layoutId','hidden','ownerIdx','srcOrd','uniqueId','cx:tx','cx:dataId','cx:axisId','cx:layoutPr','cx:dataPt','cx:dataLabels','cx:spPr','cx:extLst']);
  const layout=fields(node['cx:layoutPr'],['cx:parentLabelLayout','cx:visibility','cx:statistics','cx:subtotals','cx:extLst']);
  const subtotals=fields(layout['cx:subtotals'],['cx:idx']);
  return{attributes:Object.fromEntries(['layoutId','hidden','ownerIdx','srcOrd','uniqueId'].filter(key=>Object.hasOwn(node,key)).map(key=>{assert.equal(typeof node[key],'string');return[key,node[key]];})),...values(node,['cx:dataId']),axisIds:list(node['cx:axisId']).map(leaf),layout:{...values(layout,['cx:parentLabelLayout']),...(Object.hasOwn(layout,'cx:visibility')?{visibility:attr(layout['cx:visibility'],['meanLine','meanMarker','nonoutliers','outliers','connectorLines'])}:{}),...(Object.hasOwn(layout,'cx:statistics')?{statistics:attr(layout['cx:statistics'],['quartileMethod'])}:{}),subtotalIndices:list(subtotals['cx:idx']).map(leaf)}};
 });
 const axes=list(plot['cx:axis']).map(node=>{
  fields(node,['id','hidden','cx:catScaling','cx:valScaling','cx:units','cx:numFmt','cx:tickLabels','cx:majorTickMarks','cx:minorTickMarks','cx:majorGridlines','cx:minorGridlines','cx:spPr','cx:txPr','cx:extLst']);
  // Category gapWidth is presentation spacing. Its actual0.06→0.0599999987
  // change stays OPEN; it is not treated as numeric equality.
  if(Object.hasOwn(node,'cx:catScaling'))fields(node['cx:catScaling'],['gapWidth']);
  return{attributes:Object.fromEntries(['id','hidden'].filter(key=>Object.hasOwn(node,key)).map(key=>[key,node[key]])),categoryScaling:Object.hasOwn(node,'cx:catScaling'),...(Object.hasOwn(node,'cx:valScaling')?{valueScaling:attr(node['cx:valScaling'],['min','max','majorUnit','minorUnit','logBase'])}:{}),...(Object.hasOwn(node,'cx:numFmt')?{numberFormat:attr(node['cx:numFmt'],['formatCode','sourceLinked'])}:{}),...(Object.hasOwn(node,'cx:units')?{units:attr(node['cx:units'],['unit','cx:unitsLabel'])}:{})};
 });
 return{series,axes,cacheFormats};
}
function sourceRoleModel(slides,parts,deps){
 const roles=structuredClone(slides),parser=new deps.XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,parseAttributeValue:false,trimValues:false});
 for(const slide of roles)for(const shape of slide.shapes)if(shape.kind==='chart'){
  const chart=shape.chart,parsed=parser.parse(deps.strFromU8(parts[shape.chartPart]));
  chart.sourceRoles=chart.family==='classic'?classicRoles(parsed['c:chartSpace']['c:chart']['c:plotArea']):nativeRoles(parsed['cx:chartSpace']['cx:chart']['cx:plotArea'],parsed['cx:chartSpace']['cx:chartData']);
  if(chart.groups)for(const group of chart.groups)delete group.properties;
  delete chart.axes;delete shape.chartPart;delete chart.workbook.part;
 }return roles;
}
export function compareSevenNativeBefore({input,before,source,selection,action,phases,imports,root,deps=archiveDependencies()}){
 const original=bindCurrentTreemap(input,source,selection,{root,deps});assert.deepEqual(original.action,action);
 const actual=bindCurrentTreemap(before,source,selection,{root,deps});
 // These are actual first-Save resource locators, not a rewritten setter wire.
 assert.deepEqual({...actual.action,inputSha256:action.inputSha256,chartPart:action.chartPart,workbookPart:action.workbookPart},action,'Native-before changed the live target or logical data contract');
 // Both archives passed the maintained decompression/XML checks above.
 const sourceParts=deps.unzipSync(input),beforeParts=deps.unzipSync(before);
 assert.deepEqual(sourceRoleModel(actual.archive.slides,beforeParts,deps),sourceRoleModel(original.archive.slides,sourceParts,deps),'Native-before changed whole-seven parsed data/source roles');
 const workbookSharing={qualification:'OPEN',source:sevenWorkbookAliasPartition(original.archive),before:sevenWorkbookAliasPartition(actual.archive)};
 assert.ok(phases?.original,'Actual original whole-seven captured phase required');
 assert.deepEqual(sourceRoleModel(bindSevenPhase(actual.archive,phases.original),beforeParts,deps),sourceRoleModel(bindSevenPhase(original.archive,phases.original),sourceParts,deps),'Native-before no longer binds captured source roles');
 assert.deepEqual(imports.before.document,imports.source.document,'Native-before complete public import changed');assert.deepEqual(imports.before.diagnostics,imports.source.diagnostics,'Native-before diagnostics changed');
 const rawFindings=snapshotSourceBeforeRawFindings(input,before,deps,original.archiveContext);
 return {sourceSha256:digest(input),beforeSha256:digest(before),actualNumericValues:snapshotNumericReadback(actual.archive,actual.action).values,archiveComparisonAction:actual.action,rawFindings,workbookSharing,sourcePublicModelVerified:true,nativeRoleBindingVerified:true,sourceRawStyleQualification:'OPEN',observation:'actual-native-before-archive comparison target; not setter action or COM getter',nativeAcceptance:false};
}
export function compareSevenNativeSnapshots({input,before,edited,reopened,source,selection,action,phases,imports,root,deps=archiveDependencies()}){
 const baseline=compareSevenNativeBefore({input,before,source,selection,action,phases,imports,root,deps});
 const context=bindCurrentTreemap(before,source,selection,{root,deps}).archiveContext;
 const editOptions={input:before,saved:edited,source,action:baseline.archiveComparisonAction,phases,imports:{original:imports.before,'saved-reopened':imports.edited},deps,archiveContext:context};
 const strictEdit={parsed:comparePersistedSevenValueEdit(editOptions),raw:assertSnapshotRawPreservation(editOptions)};
 const editedArchive=inspectSevenArchive(edited,deps,context),reopenedArchive=inspectSevenArchive(reopened,deps,context);
 assert.deepEqual(reopenedArchive.slides,editedArchive.slides,'Reopened native archive changed parsed current data/style');
 const rawReopened=unchangedRaw(edited,reopened,baseline.archiveComparisonAction,action.newValues,deps,context);
 assert.deepEqual(imports.reopened.document,imports.edited.document,'Reopened full public import changed');assert.deepEqual(imports.reopened.diagnostics,imports.edited.diagnostics,'Reopened diagnostics changed');
 return {baseline,editContract:strictEdit,rawReopened,archiveReadbacks:{before:{sha256:digest(before),values:baseline.actualNumericValues},edited:{sha256:digest(edited),...snapshotNumericReadback(editedArchive,baseline.archiveComparisonAction)},reopened:{sha256:digest(reopened),...snapshotNumericReadback(reopenedArchive,baseline.archiveComparisonAction)}},allFullImportsRetained:true,nativeAcceptance:false,registryAcceptance:false,scope:'One documented native setter with three native-generated archive numeric readbacks; exact source public-model/native-role admission with source raw-style OPEN findings, then strict isolated edit and reopen preservation (two recorded outer core metadata fields). No getter-array, all-chart-type, pixel or release claim.'};
}
