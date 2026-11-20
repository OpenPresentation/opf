// One explicit reference-bearing chart edit. No Office calls or generic route configuration.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {digest} from './identity.mjs';
import {readReferenceSources} from './reference-chart-fixtures.mjs';
import {createReferenceWitnessEnvelope,validateReferenceWitnessEnvelope,assertReferenceWitnessSource,compareReferenceWitnessBindings,compareReferenceWitnessImports,importReferenceWitnessPublic} from './reference-chart-profile.mjs';
import {inspectReferenceArchive,bindReferenceWitnessPhase} from './reference-chart-archive.mjs';
import {readB07SuccessfulStages} from './b07-stages.mjs';
import {OWNED_POSTFLIGHT_POLICY} from './owned-postflight.mjs';

export const REFERENCE_NAME_PROFILE='reference-line-one-series-name-edit-v1';
export const REFERENCE_NAME_POLICY=Object.freeze({policy:'reference-name-exact-one-global-zero-after-completed-owned-quit-v1',...OWNED_POSTFLIGHT_POLICY});
export const REFERENCE_NAME_CASE='reference-native-lines';
export const REFERENCE_NAME_INPUT=Object.freeze({bytes:129055,sha256:'3ec4712d167e889815f22266bd871b8ea2633974689f37ea42a089ae2976c918'});
export const REFERENCE_NAME_ACTION=Object.freeze({op:'set-chart-series-name',slideIndex:1,chartName:'OPF chart 1',seriesIndex:1,expectedName:'Actual',newName:'Actual edited'});
export const referenceNamePlan=()=>[{...REFERENCE_NAME_ACTION}];
const sourceSha='87a3a6c20edcc4cb05d821019f3abc2b9bbaa5b0a73911853563665ae7b5a02e';
export function assertReferenceNameRequest(request){assert.equal(request.referenceNameEdit,true);assert.deepEqual(request.input,REFERENCE_NAME_INPUT);assert.equal(request.profile,REFERENCE_NAME_PROFILE);assert.deepEqual(request.policy,REFERENCE_NAME_POLICY);assert.equal(request.caseId,REFERENCE_NAME_CASE);assert.equal(request.slideCount,3);assert.equal(request.captureTextFonts,false);assert.equal(request.readOnlySurvey,false);assert.deepEqual(request.actionPlan.actions,referenceNamePlan());}
export function assertReferenceNameSelection(source,selected,plan){
 assert.equal(selected.id,REFERENCE_NAME_CASE);assert.equal(selected.slideCount,3);assert.equal(selected.automaticControlEligible,false);assert.equal(selected.worker,'furniture');assert.deepEqual(plan,referenceNamePlan());
 const known=readReferenceSources().find(item=>item.id===REFERENCE_NAME_CASE);assert.equal(known.bytes,2418);assert.equal(known.sha256,sourceSha);assert.deepEqual(source,known.document,'Only the exact reviewed whole reference source is admitted');return source;
}
export function createReferenceNameSource(options,root){
 assert.deepEqual(Object.keys(options).sort(),['consumer','expectedManifestSha256','preparationRepository','suiteDirectory','workerRepository']);
 return createReferenceWitnessEnvelope({...options,caseId:REFERENCE_NAME_CASE,root});
}
export function bindReferenceNameSource(envelope,root){
 const binding=validateReferenceWitnessEnvelope(envelope,{root});assert.deepEqual({bytes:binding.input.length,sha256:digest(binding.input)},REFERENCE_NAME_INPUT);assertReferenceNameSelection(binding.source.deck,binding.selected,referenceNamePlan());return binding;
}
const chartOf=slide=>{const candidates=[slide.chart,...(slide.blocks??[]).map(block=>block.chart)].filter(Boolean);assert.equal(candidates.length,1,'Exactly one current public chart');return candidates[0];};
const ordinary=chart=>chart.groups.flatMap(group=>group.series).filter(series=>!series.owner);
const selectedChart=archive=>{const charts=archive.slides[0].shapes.filter(shape=>shape.kind==='chart');assert.equal(charts.length,1);assert.equal(charts[0].name,REFERENCE_NAME_ACTION.chartName);return charts[0].chart;};
function projectName(archive,expected){
 const projected=structuredClone(archive),chart=selectedChart(projected),series=ordinary(chart);assert.equal(series.length,1);const tx=series[0]['c:tx'];
 // Name is either an exact cached reference or the literal Series.Name form.
 if(Object.hasOwn(tx,'value')){assert.deepEqual(tx,{value:expected});}
 else{assert.deepEqual(Object.keys(tx).sort(),['formula','values']);assert.equal(tx.formula,'Sheet1!$B$1');assert.deepEqual(tx.values,[expected]);}
 series[0]['c:tx']={value:'@one-reviewed-series-name'};
 const header=chart.workbook.cells.filter(cell=>cell.cell==='B1');assert.equal(header.length,1);assert.ok(header[0].value===REFERENCE_NAME_ACTION.expectedName||header[0].value===expected,'Unexpected workbook header edit');header[0].value='@one-reviewed-series-name';
 return projected;
}
export function referenceNameDataTags(input,deps){
 // Run the maintained whole-archive bounds before reading any tag part.
 inspectReferenceArchive(input,deps);const parts=deps.unzipSync(input),parser=new deps.XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false}),list=value=>value===undefined?[]:Array.isArray(value)?value:[value],parse=bytes=>{const xml=deps.strFromU8(bytes);assert.ok(!xml.includes('<!DOCTYPE')&&!xml.includes('<!ENTITY'));return parser.parse(xml);};let count=0;
 // The public reader follows tags relationships, not a fixed tag directory. This
 // closed source refuses any linked target outside its conventional tag parts.
 for(const [name,bytes]of Object.entries(parts))if(name.endsWith('.rels')){const owner=name==='_rels/.rels'?'':/^(.+)\/_rels\/([^/]+)\.rels$/u.exec(name);assert.ok(owner!==null,'Canonical relationship owner required');for(const rel of list(parse(bytes)?.Relationships?.Relationship))if(rel.Type==='http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags'){assert.equal(rel.TargetMode,undefined);assert.equal(typeof rel.Target,'string');
 // biome-ignore lint/suspicious/noControlCharactersInRegex: Reject control characters in package relationship targets before path normalization.
 assert.ok(!/[\\:%\x00-\x1f]/u.test(rel.Target));const target=path.posix.normalize(path.posix.join(owner===''?'':owner[1],rel.Target));assert.match(target,/^ppt\/tags\/[^/]+\.xml$/u,'Closed reference source refuses relocated tag records');assert.ok(Object.hasOwn(parts,target),'Linked tag part must exist');}}
 for(const [name,bytes]of Object.entries(parts))if(/^ppt\/tags\/[^/]+\.xml$/u.test(name))for(const tag of list(parse(bytes)?.['p:tagLst']?.['p:tag']))if(String(tag?.name??'').toUpperCase()==='OPF_DATA_V1')count++;
 assert.equal(count,0,'This exact inline reference source has no authored chart-data restoration records');return{sourceArchiveSha256:digest(input),dataTagCount:count};
}
export function assertReferenceNameArchives(input,saved,source,deps){
 assertReferenceNameSelection(source,{id:REFERENCE_NAME_CASE,slideCount:3,automaticControlEligible:false,worker:'furniture'},referenceNamePlan());
 const before=inspectReferenceArchive(input,deps),after=inspectReferenceArchive(saved,deps),changed=structuredClone(source);changed.slides[0].chart.data.columns[1]=REFERENCE_NAME_ACTION.newName;
 assertReferenceWitnessSource(before,source);assertReferenceWitnessSource(after,changed);
 assert.deepEqual(compareReferenceWitnessBindings(projectName(before,REFERENCE_NAME_ACTION.expectedName).slides,projectName(after,REFERENCE_NAME_ACTION.newName).slides),[],'Only the bound ordinary name/header spelling may differ; references, axes, paints, values and shape topology stay strict');
 return {sourceArchiveSha256:digest(input),savedArchiveSha256:digest(saved),references:2,ordinarySeries:1,sourceCanvas:before.canvas,dataProvenance:{original:referenceNameDataTags(input,deps),saved:referenceNameDataTags(saved,deps)}};
}
export function assertReferenceNameModels(original,saved,source){
 const first=chartOf(original.document.slides[0]);assert.equal(first.type,'line');assert.deepEqual(first.data.columns,['Period','Actual']);assert.deepEqual(first.data.rows,source.slides[0].chart.data.rows);assert.equal(first.referenceLines.length,2);
 const expected=structuredClone(original.document);chartOf(expected.slides[0]).data.columns[1]=REFERENCE_NAME_ACTION.newName;assert.deepEqual(saved.document,expected,'Full current public model permits exactly one ordinary column-name change');
 assert.equal(original.diagnostics.filter(row=>row.code==='chart-data-provenance-changed').length,0);const path='slides.0.charts.0.series.0.line.color',paintWarning=name=>({code:'chart-option-adapted',option:'series.0.line.color',path,message:`Line series '${name}' has explicit native solid paint that is not retained as per-series formatting in OPF; imported chart colors follow its design and semantic highlight.`}),indices=original.diagnostics.flatMap((row,index)=>row.path===path?[index]:[]);assert.equal(indices.length,1);assert.deepEqual(original.diagnostics[indices[0]],paintWarning(REFERENCE_NAME_ACTION.expectedName),'One exact existing paint warning is bound to the renamed ordinary series');const expectedDiagnostics=structuredClone(original.diagnostics);expectedDiagnostics[indices[0]].message=paintWarning(REFERENCE_NAME_ACTION.newName).message;assert.deepEqual(saved.diagnostics,expectedDiagnostics,'Only the exact existing warning message names the renamed series; no warning is removed or added');return true;
}
export function assertReferenceNameImportFindings(source,imports,before,resolveChartData){
 assertReferenceNameModels(imports.original,imports.saved,source);
 const currentOwned=new Set();
 for(const phase of ['original','saved'])source.slides.forEach((slide,index)=>{const actual=chartOf(imports[phase].document.slides[index]),chart=before.slides[index].shapes.find(shape=>shape.kind==='chart').chart;
  for(const [j,reference]of (slide.chart.referenceLines??[]).entries()){const records=chart.ownership.helpers.filter(row=>row.index===j);assert.equal(records.length,1);const record=records[0],owners=chart.groups.flatMap(group=>group.series).filter(series=>series.owner?.id===record.id);assert.equal(owners.length,1);if(typeof record.written!=='string')continue;
   assert.deepEqual(record.stroke,reference.stroke,'Current authored Line receipt must match this exact source');const value=actual.referenceLines[j];assert.ok(value);assert.equal(value.value,reference.value);assert.equal(value.axis??'value',reference.axis??'value');assert.equal(value.label,reference.label);assert.equal(value.labelPosition??'end',reference.labelPosition??'end');assert.deepEqual(value.stroke,reference.stroke,'Current unchanged paint retains the exact authored Line');currentOwned.add((phase==='saved'?'saved-reopened':phase)+'|'+(index+1)+'|'+j);
  }
 });
 const findings=compareReferenceWitnessImports(source,{original:imports.original,'saved-reopened':imports.saved},before.canvas,resolveChartData);
 const remaining=findings.filter(finding=>{
  if(['saved-public-import-differs','saved-public-import-diagnostics-differ'].includes(finding.code))return false; // Exact one-field model and unchanged diagnostics are independently checked above.
  if(finding.code==='import-authored-data-differs'&&finding.phase==='saved-reopened'&&finding.slide===1)return false;
  if(finding.code!=='import-reference-value-label-style-differs')return true;
  // Current S4 restores the exact authored Line only while native paint matches.
  // Legacy receipts keep the old comparer's exact EMU projection; do not relax it.
  return !currentOwned.has(finding.phase+'|'+finding.slide+'|'+finding.reference);
 });
 assert.deepEqual(remaining,[],'No unrelated import/reference/style/axis/topology finding is waived');return findings;
}
function assertReferenceTypeEvidence(evidence){
 assert.ok(evidence&&['System.Int32','System.Int64'].includes(evidence.count?.observedType),'Actual typed integer reference series count required');
 const line={observedType:'System.Int32',observedRawValue:'4',numericValue:4};
 assert.deepEqual(evidence,{chart:{observedType:'System.Int32',observedRawValue:'-4111',numericValue:-4111},count:{observedType:evidence.count.observedType,observedRawValue:'3',numericValue:3},series:Array.from({length:3},(_,i)=>({index:i+1,typeObservation:line}))},'Exact measured parent/three-series type domain required');
}
export function assertReferenceNameNative(report,stageBytes){
 assert.equal(report.referenceNameEdit,true);
 const action=REFERENCE_NAME_ACTION;assert.deepEqual(report.actionPlan.actions,referenceNamePlan());assert.deepEqual(report.actionPlan.completed,[{index:1,op:action.op,status:'success'}]);for(const key of ['styleEdits','chartPoints'])assert.deepEqual(report.actionPlan[key],[]);
 assert.deepEqual(Object.keys(report.phases),['original','edited','reopened']);const original=report.phases.original;assert.equal(original.slideCount,3);assert.equal(original.slides.length,3);assert.ok(original.slides.every(slide=>slide.shapeCount===slide.shapes.length&&slide.shapeCount<=3));
 for(const phase of ['original','edited','reopened']){const state=report.phases[phase],name=phase==='original'?action.expectedName:action.newName;assert.equal(state.slideCount,3);assert.deepEqual(state.slides,original.slides,'A hidden-legend name edit must not alter any captured slide/shape/geometry/text/tag');assert.equal(state.chartSeriesNames.length,1);const referenceTypeEvidence=state.chartSeriesNames[0].referenceTypeEvidence;assertReferenceTypeEvidence(referenceTypeEvidence);assert.deepEqual(state.chartSeriesNames,[{phase,slideIndex:1,chartName:action.chartName,seriesIndex:1,expectedName:name,observedName:name,observedType:'System.String',observedRawValue:name,status:'success',referenceTypeEvidence}]);}
 const edits=report.actionPlan.chartSeriesEdits;assert.equal(edits.length,1);const edit=edits[0];for(const [key,value]of Object.entries({slideIndex:1,chartName:action.chartName,seriesIndex:1,expectedName:action.expectedName,newName:action.newName,before:action.expectedName,after:action.newName,status:'success'}))assert.deepEqual(edit[key],value);assert.deepEqual(edit.otherNames,[{index:2,name:'Target 80'},{index:3,name:'Floor -10'}]);assertReferenceTypeEvidence({chart:edit.chartTypeObservation,count:edit.referenceSeriesCount,series:edit.referenceSeriesTypes});
 const stages=readB07SuccessfulStages(stageBytes),prefix='action-1-set-chart-series-name',hits=stage=>stages.filter(row=>row.stage===stage&&row.status==='success'),sequence=stage=>{const rows=hits(stage);assert.equal(rows.length,1,'One exact completed name/lifecycle operation: '+stage);return rows[0].sequence;};assert.equal(stages.filter(row=>row.stage.endsWith('.series.name.set')&&row.status==='success').length,1);const setter=sequence(prefix+'.series.name.set');
 const originalName=sequence('original.series-name-1.series.name.get'),beforeName=sequence(prefix+'.series.name.get'),afterName=sequence(prefix+'.readback.series.name.get'),editedName=sequence('edited.series-name-1.series.name.get'),reopenedName=sequence('reopened.series-name-1.series.name.get');assert.ok(originalName<beforeName&&beforeName<setter&&setter<afterName&&afterName<sequence('edited.presentation.saveCopyAs')&&sequence('edited.presentation.saveCopyAs')<editedName&&editedName<sequence('edited.presentation.close'));assert.ok(sequence('reopen.presentation.open')<reopenedName&&reopenedName<sequence('reopened.presentation.close'));
 for(const phase of ['original','edited','reopened'])for(const key of ['chart.type','series.type']){const found=hits(phase+'.series-name-1.'+key);assert.equal(found.length,1);}
 for(const prefix of ['original.series-name-1','action-1-set-chart-series-name','edited.series-name-1','reopened.series-name-1']){const chart=sequence(prefix+'.chart.type'),count=sequence(prefix+'.series.count'),selected=sequence(prefix+'.series.type'),second=sequence(prefix+'.reference-series-2.type'),third=sequence(prefix+'.reference-series-3.type'),name=sequence(prefix+'.series.name.get');assert.ok(chart<count&&count<selected&&selected<second&&second<third&&third<name,'All three measured types precede the Name read/setter');for(const index of [2,3])assert.ok(sequence(prefix+'.reference-series-'+index+'.get')<sequence(prefix+'.reference-series-'+index+'.type'));}
 return {caseId:REFERENCE_NAME_CASE,actions:1,phases:3,nativeNames:[action.expectedName,action.newName,action.newName],nativeAcceptance:false};
}
export async function compareReferenceNameEdit(binding,report,stageBytes,saved){
 const native=assertReferenceNameNative(report,stageBytes),consumer=binding.envelope.generation.consumer,require=createRequire(path.join(consumer,'package.json')),peer=createRequire(require.resolve('@openpresentation/opf-pptx/package.json')),deps={...peer('fflate'),...peer('fast-xml-parser')};
 const source=binding.reference.source.deck,archives=assertReferenceNameArchives(binding.input,saved,source,deps),before=inspectReferenceArchive(binding.input,deps),after=inspectReferenceArchive(saved,deps),phaseBindings={};
 for(const phase of ['original','edited','reopened'])phaseBindings[phase]=bindReferenceWitnessPhase(phase==='original'?before:after,report.phases[phase]);
 const imports={original:await importReferenceWitnessPublic(binding.input,{consumer}),saved:await importReferenceWitnessPublic(saved,{consumer})};assertReferenceNameModels(imports.original,imports.saved,source);
 const core=await import(pathToFileURL(require.resolve('@openpresentation/opf')).href),{gallery}=await import(pathToFileURL(require.resolve('@openpresentation/gallery')).href),validation={};
 for(const phase of ['original','saved']){validation[phase]=core.validate(imports[phase].document,{catalogs:[gallery],only:['format','references']});assert.equal(validation[phase].valid,true,'Actual current public model must validate');}
 const readonlyFindings=assertReferenceNameImportFindings(source,imports,before,core.resolveChartData);
 return {schemaVersion:1,profile:REFERENCE_NAME_PROFILE,passed:true,native,archives,phaseBindings,imports,validation,readonlyFindings,nativeAcceptance:false,registryAcceptance:false,scope:'One ordinary literal series-name edit with unchanged explicit reference/data/style/axis/shape semantics; no reference-value, all-type, pixel or release claim.'};
}
