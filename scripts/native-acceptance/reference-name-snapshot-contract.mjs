// Prospective Name-only three-copy route. The old single-copy Name contract stays strict.
import assert from 'node:assert/strict';
import {digest} from './identity.mjs';
import {OWNED_POSTFLIGHT_POLICY} from './owned-postflight.mjs';
import {archiveDependencies,inspectReferenceArchive,bindReferenceWitnessPhase} from './reference-chart-archive.mjs';
import {assertReferenceWitnessSource,importReferenceWitnessPublic} from './reference-chart-profile.mjs';
import {REFERENCE_NAME_INPUT,REFERENCE_NAME_CASE,referenceNamePlan,assertReferenceNameNative,assertReferenceNameModels,assertReferenceNameImportFindings,referenceNameDataTags} from './reference-name-contract.mjs';
import {readB07SuccessfulStages} from './b07-stages.mjs';
import {sevenRawPartSignatures} from './seven-value-raw.mjs';
import {snapshotMetadataView} from './seven-value-snapshot-namespace.mjs';

export const REFERENCE_NAME_SNAPSHOT_PROFILE='reference-line-one-name-three-native-archives-v1';
export const REFERENCE_NAME_SNAPSHOT_POLICY=Object.freeze({policy:'reference-name-three-archives-global-zero-after-completed-owned-quit-v1',...OWNED_POSTFLIGHT_POLICY});
const selectedPart='ppt/charts/chart1.xml',list=value=>value===undefined?[]:Array.isArray(value)?value:[value];
function keys(node,allowed){assert.ok(node&&typeof node==='object'&&!Array.isArray(node));for(const key of Object.keys(node))assert.ok(allowed.includes(key),'Unreviewed semantic field: '+key);return node;}
function scalarTree(node){
 if(node===null||typeof node!=='object')return node;
 const out={};keys(node,['c:orientation','c:min','c:max','c:logBase','#text']);
 for(const [key,value]of Object.entries(node)){if(key==='#text'){assert.ok(typeof value==='string'&&/^\s*$/u.test(value));continue;}assert.deepEqual(Object.keys(value),['val']);out[key]=value;}
 return out;
}
function cacheRoles(archive,parts,deps){
 const parser=new deps.XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,parseAttributeValue:false,trimValues:false});
 const fields=(node,allowed)=>{keys(node,[...allowed,'#text']);if(Object.hasOwn(node,'#text'))assert.ok(typeof node['#text']==='string'&&/^\s*$/u.test(node['#text']));return Object.fromEntries(Object.entries(node).filter(([key])=>key!=='#text'));};
 return archive.slides.map(slide=>{const shape=slide.shapes.find(shape=>shape.kind==='chart'),plot=fields(parser.parse(deps.strFromU8(parts[shape.chartPart]))['c:chartSpace']['c:chart']['c:plotArea'],['c:layout','c:lineChart','c:barChart','c:catAx','c:valAx','c:spPr','c:extLst']);
  const axes=['c:catAx','c:valAx'].flatMap(kind=>list(plot[kind]).map(axis=>{fields(axis,['c:axId','c:scaling','c:delete','c:axPos','c:majorGridlines','c:minorGridlines','c:title','c:numFmt','c:majorTickMark','c:minorTickMark','c:tickLblPos','c:spPr','c:txPr','c:crossAx','c:crosses','c:crossesAt','c:crossBetween','c:lblAlgn','c:lblOffset','c:tickLblSkip','c:tickMarkSkip','c:noMultiLvlLbl','c:majorUnit','c:minorUnit','c:extLst']);return{kind,id:axis['c:axId'],cross:axis['c:crossAx'],crosses:axis['c:crosses'],crossesAt:axis['c:crossesAt'],crossBetween:axis['c:crossBetween'],minorUnit:Object.hasOwn(axis,'c:minorUnit')?{present:true,value:axis['c:minorUnit']}:{present:false}};}));
  const groups=[...new Set(shape.chart.groups.map(group=>group.construct))].flatMap(constructName=>list(plot[constructName]).map(construct=>{fields(construct,['c:barDir','c:grouping','c:varyColors','c:ser','c:marker','c:dLbls','c:gapWidth','c:overlap','c:axId','c:extLst']);return list(construct['c:ser']).map(series=>{
   fields(series,['c:idx','c:order','c:tx','c:cat','c:val','c:spPr','c:marker','c:dLbls','c:invertIfNegative','c:smooth','c:extLst']);
   for(const vector of ['c:xVal','c:yVal','c:bubbleSize'])assert.equal(series[vector],undefined,'Closed reference charts refuse unsupported semantic vectors');
   return{index:series['c:idx'],order:series['c:order'],fields:['c:tx','c:cat','c:val'].map(field=>{
    const data=fields(series[field],['c:strRef','c:numRef','c:v','c:extLst']),alternatives=Object.keys(data).filter(key=>key!=='c:extLst');assert.equal(alternatives.length,1);const kind=alternatives[0];if(kind==='c:v')return{field,kind,value:data[kind]};
    const ref=fields(data[kind],['c:f','c:strCache','c:numCache','c:extLst']),cacheName=kind==='c:numRef'?'c:numCache':'c:strCache',cache=fields(ref[cacheName],['c:formatCode','c:ptCount','c:pt','c:extLst']);assert.equal(ref[cacheName==='c:numCache'?'c:strCache':'c:numCache'],undefined);
    const count=keys(cache['c:ptCount'],['val']);assert.deepEqual(Object.keys(count),['val']);
    return{field,kind,formula:ref['c:f'],formatCode:Object.hasOwn(cache,'c:formatCode')?{present:true,value:cache['c:formatCode']}:{present:false},count,points:list(cache['c:pt']).map(point=>{const clean=fields(point,['idx','c:v']);assert.deepEqual(Object.keys(clean).sort(),['c:v','idx']);return clean;})};
   })};
  });}));return{axes,groups};
 });
}
// Only source→first Save has raw/style/placement OPEN. Data, role identity,
// formulas, workbook cells, reference ownership and numeric scaling stay exact.
function sourceRoles(archive){return archive.slides.map(slide=>({index:slide.index,shapes:slide.shapes.map(shape=>{
 const out=structuredClone(shape);if(shape.kind!=='chart')return out;const chart=shape.chart;
 keys(chart,['family','layout','groups','axes','ownership','workbook']);
 out.chart={family:chart.family,groups:chart.groups.map(group=>{
  keys(group,['construct','grouping','direction','axes','series']);return{construct:group.construct,grouping:group.grouping,direction:group.direction,axes:group.axes,series:group.series.map(series=>{
   keys(series,['index','order','c:tx','c:cat','c:val','owner','paint','marker','labels']);
   return{index:series.index,order:series.order,'c:tx':series['c:tx'],'c:cat':series['c:cat'],'c:val':series['c:val'],owner:series.owner};
  })};
 }),axes:chart.axes.map(axis=>{keys(axis,['kind','id','cross','scaling','format','major','placement']);return{kind:axis.kind,id:axis.id,cross:axis.cross,scaling:scalarTree(axis.scaling),format:axis.format,major:axis.major};}),ownership:chart.ownership,workbook:structuredClone(chart.workbook)};
 delete out.chart.workbook.part;return out;
})}));}
function workbookAliases(archive){const known=new Map();return archive.slides.flatMap(slide=>slide.shapes.filter(shape=>shape.kind==='chart').map(shape=>{const part=shape.chart.workbook.part;if(!known.has(part))known.set(part,known.size);return known.get(part);}));}
export function assertReferenceNameSnapshotRequest(request){
 assert.equal(request.profile,REFERENCE_NAME_SNAPSHOT_PROFILE);assert.deepEqual(request.policy,REFERENCE_NAME_SNAPSHOT_POLICY);assert.equal(request.referenceNameSnapshots,true);assert.equal(request.referenceNameEdit,true);assert.deepEqual(request.input,REFERENCE_NAME_INPUT);assert.equal(request.caseId,REFERENCE_NAME_CASE);assert.equal(request.slideCount,3);assert.equal(request.captureTextFonts,false);assert.equal(request.readOnlySurvey,false);assert.deepEqual(request.actionPlan.actions,referenceNamePlan());
}
export function assertReferenceNameSnapshotNative(report,stageBytes){
 assertReferenceNameNative(report,stageBytes);assert.ok(Array.isArray(report.referenceNameSnapshots));assert.deepEqual(report.referenceNameSnapshots.map(row=>row.phase),['before','reopened']);
 const stages=readB07SuccessfulStages(stageBytes),success=name=>{const found=stages.filter(row=>row.stage===name&&row.status==='success');assert.equal(found.length,1,'One snapshot/lifecycle operation required: '+name);return found[0];};
 const original=report.source.openedPath,saved=report.saved.path;
 const setter=success('action-1-set-chart-series-name.series.name.set').sequence;
 for(const phase of ['before','reopened']){
  const prefix='reference-'+phase+'.presentation',owner=phase==='before'?original:saved,operations=['fullName.get','saveCopyAs','fullName.afterCopy.get'].map(suffix=>prefix+'.'+suffix);let previous=phase==='before'?success('original.series-name-1.series.name.get').sequence:success('reopened.series-name-1.series.name.get').sequence;
  for(const name of operations){const pair=stages.filter(row=>row.stage===name);assert.deepEqual(pair.map(row=>row.status),['begin','success']);assert.ok(pair[0].sequence>previous&&pair[1].sequence>pair[0].sequence);for(const row of pair){assert.equal(row.ownedPresentationPath,owner);assert.equal(row.cleanupConfirmed,false);}previous=pair[1].sequence;}
  assert.ok(previous<(phase==='before'?setter:success('reopened.presentation.close').sequence));
 }
 assert.deepEqual(stages.filter(row=>row.stage.endsWith('.saveCopyAs')&&row.status==='success').map(row=>row.stage),['reference-before.presentation.saveCopyAs','edited.presentation.saveCopyAs','reference-reopened.presentation.saveCopyAs']);
 for(const suffix of ['.presentation.open','.presentation.close'])assert.equal(stages.filter(row=>row.stage.endsWith(suffix)&&row.status==='success').length,2);assert.equal(stages.filter(row=>row.stage==='application.cleanup.quit'&&row.status==='success').length,1);
 return{copies:3,opens:2,closes:2,actions:1,quits:1};
}
function txProjection(parts,deps,edited){
 const xml=deps.strFromU8(parts[selectedPart]),series=[...xml.matchAll(/<c:ser(?:\s[^<>]*?)?>[\s\S]*?<\/c:ser>/gu)],selected=series.filter(match=>/^<c:ser>\s*<c:idx val="0"\/>/u.test(match[0]));assert.equal(selected.length,1,'Unique ordinary series index0 required');
 const matches=[...selected[0][0].matchAll(/<c:tx(?:\s[^<>]*?)?>[\s\S]*?<\/c:tx>/gu)];assert.equal(matches.length,1);const raw=matches[0][0];
 const parser=new deps.XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
 assert.deepEqual(parser.parse(raw),edited?{'c:tx':{'c:v':'Actual edited'}}:{'c:tx':{'c:strRef':{'c:f':'Sheet1!$B$1','c:strCache':{'c:ptCount':{val:'1'},'c:pt':{'c:v':'Actual',idx:'0'}}}}},'Only the complete cached-to-literal Name alternative may be projected');
 const changedSeries=selected[0][0].replace(raw,'<c:tx><c:v>@one-validated-name</c:v></c:tx>');return{xml:xml.slice(0,selected[0].index)+changedSeries+xml.slice(selected[0].index+selected[0][0].length),raw,sha256:digest(Buffer.from(raw))};
}
function coreRevision(bytes,deps,revision){const xml=deps.strFromU8(bytes),matches=[...xml.matchAll(/<cp:revision(?:\s[^<>]*?)?(?:\s*\/>|>[\s\S]*?<\/cp:revision>)/gu)];assert.equal(matches.length,1);assert.equal(matches[0][0],'<cp:revision>'+revision+'</cp:revision>');return{...snapshotMetadataView(deps.strToU8(xml.replace(matches[0][0],'<cp:revision>@name-snapshot-revision</cp:revision>')),'docProps/core.xml',deps),revision:{raw:matches[0][0],value:revision}};}
export function assertReferenceNameSnapshotRaw(before,edited,reopened,deps=archiveDependencies()){
 // Safety and complete typed parsing precede all unzip/projection operations.
 for(const bytes of [before,edited,reopened])inspectReferenceArchive(bytes,deps);
 const parts=[before,edited,reopened].map(bytes=>deps.unzipSync(bytes)),names=Object.keys(parts[0]).sort();for(const other of parts.slice(1))assert.deepEqual(Object.keys(other).sort(),names);
 const workbooks=names.filter(name=>/^ppt\/embeddings\/.+\.xlsx$/u.test(name));assert.equal(workbooks.length,3);for(const name of workbooks)for(const other of parts.slice(1))assert.deepEqual(other[name],parts[0][name],'Every workbook byte/B1 must remain exact');
 const metadata=[];for(const name of names.filter(name=>!name.startsWith('ppt/'))){if(name==='docProps/core.xml'||name==='docProps/app.xml'){
  const views=parts.map((part,index)=>name==='docProps/core.xml'?coreRevision(part[name],deps,index===0?'1':'2'):snapshotMetadataView(part[name],name,deps));for(const view of views.slice(1))assert.deepEqual(view.protectedXml,views[0].protectedXml,'Unknown later Name-save metadata change');metadata.push({part:name,phases:views.map((view,index)=>({sha256:digest(parts[index][name]),recorded:view.recorded,...(view.revision?{revision:view.revision}:{})}))});
 }else for(const other of parts.slice(1))assert.deepEqual(other[name],parts[0][name],'Unknown non-ppt part change');}
 const projected=parts.map((part,index)=>{const tx=txProjection(part,deps,index>0),copy={...part,[selectedPart]:deps.strToU8(tx.xml)};return{tx,signature:sevenRawPartSignatures(copy,deps)};});for(const view of projected.slice(1))assert.deepEqual(view.signature,projected[0].signature,'Only the validated Name branch may change after before; axes/labels/styles/resources remain strict');
 return{archives:[before,edited,reopened].map(bytes=>({bytes:bytes.length,sha256:digest(bytes)})),workbooks:workbooks.map(name=>({part:name,bytes:parts[0][name].length,sha256:digest(parts[0][name])})),valueBranches:projected.map(row=>({raw:row.tx.raw,sha256:row.tx.sha256})),metadata,protectedParts:projected[0].signature.names.length};
}
function differences(a,b,path='',out=[]){if(JSON.stringify(a)===JSON.stringify(b))return out;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b)){const fact=value=>value===undefined?{present:false}:{present:true,value};out.push({path,before:fact(a),after:fact(b)});return out;}for(const key of new Set([...Object.keys(a),...Object.keys(b)]))differences(a[key],b[key],path+'/'+key,out);return out;}
export async function compareReferenceNameSnapshots(binding,report,stageBytes,archives){
 assert.deepEqual(Object.keys(archives).sort(),['before','edited','reopened','source']);
 assert.deepEqual({bytes:archives.source.length,sha256:digest(archives.source)},REFERENCE_NAME_INPUT,'Only the exact current production source enters this comparison');assert.deepEqual(archives.source,binding.input,'Comparison source is the already-admitted exact input');
 for(const row of report.referenceNameSnapshots)assert.equal(row.sha256,digest(archives[row.phase]),'Each copy record must name the actual retained archive bytes');assert.equal(report.saved.sha256,digest(archives.edited));assert.deepEqual(report.reopened,report.saved);
 const native=assertReferenceNameSnapshotNative(report,stageBytes),consumer=binding.envelope.generation.consumer,{core,gallery,deps}=await referenceConsumer(consumer),source=binding.reference.source.deck,parsed=Object.fromEntries(Object.entries(archives).map(([phase,bytes])=>[phase,inspectReferenceArchive(bytes,deps)]));
 for(const phase of ['source','before'])assertReferenceWitnessSource(parsed[phase],source);assert.deepEqual(sourceRoles(parsed.before),sourceRoles(parsed.source),'Complete current data/source/reference/axis roles must survive first Save');assert.deepEqual(workbookAliases(parsed.before),workbookAliases(parsed.source),'Whole reference workbook-sharing partition must survive first Save');
 const sourceParts=deps.unzipSync(archives.source),beforeParts=deps.unzipSync(archives.before);assert.deepEqual(cacheRoles(parsed.before,beforeParts,deps),cacheRoles(parsed.source,sourceParts,deps),'All current cache/formula/format/count/point semantics must survive first Save');
 const phaseBindings={};for(const [phase,archive]of [['original',parsed.before],['edited',parsed.edited],['reopened',parsed.reopened]])phaseBindings[phase]=bindReferenceWitnessPhase(archive,report.phases[phase]);
 const imports={},validation={};for(const [phase,bytes]of Object.entries(archives)){imports[phase]=await importReferenceWitnessPublic(bytes,{consumer});validation[phase]=core.validate(imports[phase].document,{catalogs:[gallery],only:['format','references']});assert.equal(validation[phase].valid,true,'Matching installed core validates every complete public import');}
 assert.deepEqual(imports.before,imports.source,'First Save public content/reference styles and findings remain exact');assertReferenceNameModels(imports.before,imports.edited,source);assertReferenceNameModels(imports.before,imports.reopened,source);assert.deepEqual(imports.reopened,imports.edited);assertReferenceNameImportFindings(source,{original:imports.before,saved:imports.edited},parsed.before,core.resolveChartData);
 const raw=assertReferenceNameSnapshotRaw(archives.before,archives.edited,archives.reopened,deps);const rawFindings=[...new Set([...Object.keys(sourceParts),...Object.keys(beforeParts)])].sort().filter(name=>!sourceParts[name]||!beforeParts[name]||digest(sourceParts[name])!==digest(beforeParts[name])).map(name=>({part:name,source:sourceParts[name]?digest(sourceParts[name]):null,before:beforeParts[name]?digest(beforeParts[name]):null}));
 return{profile:REFERENCE_NAME_SNAPSHOT_PROFILE,native,phaseBindings,imports,validation,raw,sourceBefore:{qualification:'OPEN',rawFindings,typedFindings:differences(parsed.source.slides,parsed.before.slides),scope:'First Save raw/style/axis differences retained; not cosmetic or accepted by public equality'},dataProvenance:Object.fromEntries(Object.entries(archives).map(([phase,bytes])=>[phase,referenceNameDataTags(bytes,deps)])),nativeAcceptance:false,registryAcceptance:false};
}
// Existing public consumer import route supplies core; no private package path.
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
async function referenceConsumer(consumer){const require=createRequire(path.join(consumer,'package.json')),peer=createRequire(require.resolve('@openpresentation/opf-pptx/package.json')),core=await import(pathToFileURL(require.resolve('@openpresentation/opf')).href),{gallery}=await import(pathToFileURL(require.resolve('@openpresentation/gallery')).href);return{core,gallery,deps:{...peer('fflate'),...peer('fast-xml-parser')}};}
