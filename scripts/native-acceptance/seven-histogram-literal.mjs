// Separate constant-array qualification. The linked histogram contract stays strict.
import assert from 'node:assert/strict';
import {digest} from './identity.mjs';
import {archiveDependencies,inspectHistogramLiteralArchive,bindSevenPhase} from './seven-chart-archive.mjs';
import {assertHistogramAction,bindCurrentHistogram,HISTOGRAM_SELECTION} from './seven-histogram-classic.mjs';
import {compareHistogramNativeBefore} from './seven-value-snapshot-compare.mjs';
import {sevenWorkbookAliasPartition} from './seven-value-archive.mjs';
import {sevenRawPartSignatures} from './seven-value-raw.mjs';
import {snapshotMetadataView,projectSnapshotNamespacePair} from './seven-value-snapshot-namespace.mjs';
export const HISTOGRAM_LITERAL_PROFILE='seven-histogram-literal-setter-native-archives-v1';
export const HISTOGRAM_LITERAL_POLICY='seven-histogram-literal-snapshots-bounded-global-zero-v1';
export const HISTOGRAM_LITERAL_BINDING='numeric-literal';
const chartPart='ppt/charts/chart2.xml',values=[43,31,-8,19];
const branch=literal=>'<c:val><c:'+(literal?'numLit>':'numRef><c:f>Sheet1!$B$2:$B$5</c:f><c:numCache>')+'<c:formatCode>General</c:formatCode><c:ptCount val="4"/>'+ (literal?values:[42,31,-8,19]).map((value,index)=>'<c:pt idx="'+index+'"><c:v>'+value+'</c:v></c:pt>').join('')+(literal?'</c:numLit>':'</c:numCache></c:numRef>')+'</c:val>';
function branchView(parts,deps,literal){
 const xml=deps.strFromU8(parts[chartPart]),found=[...xml.matchAll(/<c:val(?:\s[^<>]*?)?>[\s\S]*?<\/c:val>/gu)];assert.equal(found.length,1,'Exactly one bound c:val branch required');
 const parser=new deps.XMLParser({preserveOrder:true,ignoreAttributes:false,parseTagValue:false,parseAttributeValue:false,trimValues:false});
 assert.equal(found[0][0],branch(literal),'Unreviewed value-branch lexical content is not masked');
 assert.deepEqual(parser.parse(found[0][0]),parser.parse(branch(literal)),'Complete reviewed value branch required; no ref/formula/bare value/attribute/extension waiver');
 return{xml:xml.slice(0,found[0].index)+'<c:val><c:v>@validated-histogram-result</c:v></c:val>'+xml.slice(found[0].index+found[0][0].length),evidence:{kind:literal?HISTOGRAM_LITERAL_BINDING:'worksheet-range',raw:found[0][0],sha256:digest(Buffer.from(found[0][0]))}};
}
function coreView(bytes,deps,revision){
 const xml=deps.strFromU8(bytes),all=[...xml.matchAll(/<cp:revision(?:\s[^<>]*?)?(?:\s*\/>|>[\s\S]*?<\/cp:revision>)/gu)];assert.equal(all.length,1,'One revision field required');assert.equal(all[0][0],'<cp:revision>'+revision+'</cp:revision>','Literal profile permits only exact observed revision1→2→2');
 return{...snapshotMetadataView(deps.strToU8(xml.replace(all[0][0],'<cp:revision>@literal-profile-revision</cp:revision>')),'docProps/core.xml',deps),revision:{value:revision,raw:all[0][0]}};
}
function rawTriplet(archives,action,deps){
 const parts=archives.map(bytes=>deps.unzipSync(bytes)),names=Object.keys(parts[0]).sort();for(const other of parts.slice(1))assert.deepEqual(Object.keys(other).sort(),names,'Literal snapshot part inventory changed');
 const workbooks=names.filter(name=>/^ppt\/embeddings\/.+\.xlsx$/u.test(name));assert.ok(workbooks.includes(action.workbookPart));
 for(const name of workbooks)for(const other of parts.slice(1))assert.deepEqual(other[name],parts[0][name],'Every embedded workbook byte must remain unchanged: '+name);
 const metadata=[];
 for(const name of names.filter(name=>!name.startsWith('ppt/'))){
  if(name==='docProps/core.xml'||name==='docProps/app.xml'){
   const all=parts.map((part,index)=>name==='docProps/core.xml'?coreView(part[name],deps,index===0?'1':'2'):snapshotMetadataView(part[name],name,deps));
   for(const other of all.slice(1))assert.deepEqual(other.protectedXml,all[0].protectedXml,'Unknown literal-save metadata change: '+name);
   metadata.push({part:name,phases:all.map((view,index)=>({sha256:digest(parts[index][name]),recorded:view.recorded,...(view.revision?{revision:view.revision}:{})}))});
  }else for(const other of parts.slice(1))assert.deepEqual(other[name],parts[0][name],'Unknown non-ppt package change: '+name);
 }
 // No value-branch signature mask exists until every metadata/revision check passes.
 const views=parts.map((part,index)=>{
  const out={...part},target=branchView(part,deps,index!==0);out[chartPart]=deps.strToU8(target.xml);return{parts:out,target:target.evidence};
 });
 const signatures=[];for(let index=1;index<3;index++){
  const a={...views[0].parts},b={...views[index].parts},namespacePlacement=[];
  for(const name of names.filter(name=>/^ppt\/slides\/slide[1-9][0-9]*\.xml$/u.test(name))){const pair=projectSnapshotNamespacePair(deps.strFromU8(a[name]),deps.strFromU8(b[name]));a[name]=deps.strToU8(pair.before);b[name]=deps.strToU8(pair.after);if(pair.changes.length)namespacePlacement.push({part:name,changes:pair.changes});}
  const left=sevenRawPartSignatures(a,deps),right=sevenRawPartSignatures(b,deps);assert.deepEqual(right,left,'Unknown literal-save raw style/resource/relationship change');signatures.push({phase:index===1?'edited':'reopened',protectedParts:left.names.length,sha256:digest(Buffer.from(JSON.stringify(left.records))),namespacePlacement});
 }
 return{inputSha256:archives.map(digest),valueBranches:views.map(view=>view.target),workbooks:workbooks.map(name=>({part:name,bytes:parts[0][name].length,sha256:digest(parts[0][name])})),metadata,signatures};
}
export function histogramLiteralReadback(archive,action){
 assertHistogramAction(action);const shape=archive.slides[1].shapes.find(shape=>shape.kind==='chart');assert.equal(shape.chartPart,chartPart);assert.equal(shape.chart.workbook.part,action.workbookPart);const value=shape.chart.series[0]['c:val'];assert.deepEqual(value,{kind:HISTOGRAM_LITERAL_BINDING,formatCode:'General',values});
 const workbookValues=action.workbookCells.map(cell=>{const found=shape.chart.workbook.cells.filter(row=>row.cell===cell);assert.equal(found.length,1);return found[0].value;});assert.deepEqual(workbookValues,action.expectedValues,'Literal setter does not qualify worksheet numeric editing');return{kind:HISTOGRAM_LITERAL_BINDING,values:[...value.values],workbookValues,numericWorksheetEditabilityQualified:false};
}
export function compareHistogramLiteralSnapshots(options){
 const {before,edited,reopened,source,selection,phases,imports,root}=options,deps=options.deps??archiveDependencies();
 const baseline=compareHistogramNativeBefore({...options,deps}),bound=bindCurrentHistogram(before,source,selection,{root,deps});assert.deepEqual(selection,HISTOGRAM_SELECTION);assert.deepEqual(bound.action,baseline.archiveComparisonAction);
 const archives=[bound.archive,inspectHistogramLiteralArchive(edited,deps,bound.archiveContext),inspectHistogramLiteralArchive(reopened,deps,bound.archiveContext)];
 const expected=structuredClone(bound.archive.slides);expected[1].shapes.find(shape=>shape.kind==='chart').chart.series[0]['c:val']={kind:HISTOGRAM_LITERAL_BINDING,formatCode:'General',values:[...values]};
 for(const archive of archives.slice(1)){assert.deepEqual(archive.slides,expected,'Only the one numeric source→literal result may change; all workbooks/styles/source roles remain');assert.deepEqual(sevenWorkbookAliasPartition(archive),sevenWorkbookAliasPartition(bound.archive));}
 bindSevenPhase(archives[0],phases.original);bindSevenPhase(archives[2],phases['saved-reopened']);
 const wanted=structuredClone(imports.before.document);wanted.slides[1].chart.data.rows[0][1]=43;
 for(const phase of ['edited','reopened']){assert.deepEqual(imports[phase].document,wanted,'Complete literal public import must differ by only North42→43');assert.deepEqual(imports[phase].diagnostics,imports.before.diagnostics,'Every diagnostic remains exact');}
 const raw=rawTriplet([before,edited,reopened],bound.action,deps);
 return{profile:HISTOGRAM_LITERAL_PROFILE,expectedResultBinding:HISTOGRAM_LITERAL_BINDING,baseline,raw,archiveReadbacks:{before:{values:baseline.actualNumericValues},edited:histogramLiteralReadback(archives[1],bound.action),reopened:histogramLiteralReadback(archives[2],bound.action)},nativeTypeQualified:false,numericWorksheetEditabilityQualified:false,nativeAcceptance:false,registryAcceptance:false,scope:'One classic fallback constant-array numeric result; not linked-workbook editing or native histogram bins. Original linked qualification remains failed. Source raw fidelity remains OPEN.'};
}
