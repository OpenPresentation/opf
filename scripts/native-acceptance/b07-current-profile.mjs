// Separate, opt-in, one-case controller. Import/default inspection never starts Office or generates a deck.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {digest,fileIdentity,installedIdentity,repositoryIdentity} from './identity.mjs';
import {tableRegular,tableAsset,tableFileRecords,tableRepository,assertTableOutputSeparate} from './table-profile.mjs';
import {plainLocalPath} from './reference-chart-profile.mjs';
import {inspectReferenceRuntimeRoutes} from './reference-runtime-routes.mjs';
import {preparationInputPaths} from './prepare.mjs';
import {readB07PackedProof} from './b07-current-generate.mjs';
import {readB07Sources,b07SourceSummary,b07CurrentShapeBound,assertB07Case10Topology} from './b07-current-source.mjs';
import {readB07SuccessfulStages} from './b07-stages.mjs';
import {B07_POSTFLIGHT_POLICY,assertB07PostflightReady,assertB07BoundedPostflight} from './b07-postflight.mjs';

export const B07_PROFILE='b07-current-one-case-readonly-v1';
export const B07_REVIEWED_WORKER='6831f30a6ecec7ffec870e9aaf80dda27f2bab9a';
export const B07_WORKER_FILES=['native-furniture-control.ps1','native-process.ps1','native-process-check.ps1','native-furniture-harness-check.ps1','native-text-probes-check.ps1'].map(name=>'packages/pptx/test/'+name);
export const B07_LIMITS={slides:1,topLevelShapes:16,targets:3,ranges:8,sampledUtf16:32,textUtf16:4096,archiveBytes:16777216,zipParts:4096,phases:3,pngs:3,timeoutSecondsMax:60};
export const b07LimitsForSource=source=>({...B07_LIMITS,topLevelShapes:b07CurrentShapeBound(source)});
const root=fileURLToPath(new URL('../../',import.meta.url));
// Match repositoryIdentity's canonical directory; do not normalize untrusted envelope values.
export function assertB07ControllerDirectory(directory){assert.equal(directory,fs.realpathSync(root),'Wrong canonical B07 controller directory');}
const json=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const hex=value=>assert.match(value??'',/^[a-f0-9]{64}$/u,'Explicit reviewed SHA256 required');
const exact=(object,keys)=>{assert.ok(object&&typeof object==='object'&&!Array.isArray(object));assert.deepEqual(Object.keys(object).sort(),[...keys].sort(),'Unexpected or missing keys');};
const integer=(value,min,max)=>assert.ok(Number.isSafeInteger(value)&&value>=min&&value<=max,'Out-of-bounds integer');
const literal=(value,max)=>assert.ok(typeof value==='string'&&value.length>0&&value.length<=max,'Bounded nonempty literal required');
const span=(text,start,length)=>{integer(start,1,text.length);integer(length,1,text.length-start+1);const a=start-1,b=a+length;for(const edge of[a,b])assert.ok(!(edge>0&&edge<text.length&&/[\uD800-\uDBFF]/u.test(text[edge-1])&&/[\uDC00-\uDFFF]/u.test(text[edge])),'UTF16 surrogate split');return text.slice(a,b);};
// stdout consumed by Windows PowerShell5 must not pass non-ASCII through its OEM codepage.
export const b07WireJson=value=>JSON.stringify(value).split('').map(unit=>unit.charCodeAt(0)>126?'\\u'+unit.charCodeAt(0).toString(16).padStart(4,'0'):unit).join('');
export function assertB07Node(){assert.match(process.version,/^v24\./u);assert.equal(process.env.NODE_OPTIONS,undefined);assert.equal(process.env.NODE_PATH,undefined);assert.ok(!process.execArgv.some(arg=>/^(--import|--loader|--experimental-loader|--require|-r)(=|$)/u.test(arg)),'Runtime aliases refused');}

/** Typed authored text paths only. Data, extension strings and historical JSON keys never participate. */
export function b07AuthoredStrings(document){
  const values=new Map(),put=(pointer,value)=>{if(typeof value==='string')values.set(pointer,value);else if(Array.isArray(value))value.forEach((run,index)=>{assert.ok(typeof run==='string'||run&&typeof run.text==='string');put(pointer+'/'+index+(typeof run==='string'?'':'/text'),typeof run==='string'?run:run.text);});};
  document.slides.forEach((slide,index)=>{const base='/slides/'+index;put(base+'/title',slide.title);put(base+'/text',slide.text);slide.items?.forEach((item,i)=>{put(base+'/items/'+i,item);});slide.blocks?.forEach((block,i)=>{const at=base+'/blocks/'+i;if(block.type==='text')put(at+'/text',block.text);else if(block.type==='list')block.items.forEach((item,j)=>{put(at+'/items/'+j,item);});});});return values;
}
export function validateB07Probe(plan,mapping,{archiveSha256,sourceSha256,document,shapes}){
  exact(plan,['schemaVersion','archiveSha256','targets']);assert.equal(plan.schemaVersion,1);hex(plan.archiveSha256);assert.equal(plan.archiveSha256,archiveSha256);
  exact(mapping,['schemaVersion','archiveSha256','sourceSha256','targets']);assert.equal(mapping.schemaVersion,1);assert.equal(mapping.archiveSha256,archiveSha256);assert.equal(mapping.sourceSha256,sourceSha256);
  assert.ok(Array.isArray(plan.targets)&&plan.targets.length>=1&&plan.targets.length<=3);assert.ok(Array.isArray(mapping.targets));assert.equal(mapping.targets.length,plan.targets.length);
  const strings=b07AuthoredStrings(document),ids=new Set(),names=new Set();let ranges=0,units=0;
  for(const [index,target]of plan.targets.entries()){
    exact(target,['slideIndex','shapeId','shapeName','text','ranges']);assert.equal(target.slideIndex,1);integer(target.shapeId,1,2147483647);literal(target.shapeName,255);literal(target.text,4096);
    assert.ok(!ids.has(target.shapeId)&&!names.has(target.shapeName),'Duplicate exact target');ids.add(target.shapeId);names.add(target.shapeName);
    const matches=shapes.filter(shape=>shape.id===target.shapeId||shape.name===target.shapeName);assert.equal(matches.length,1,'Stale/ambiguous shape identity');const shape=matches[0];assert.equal(shape.id,target.shapeId);assert.equal(shape.name,target.shapeName);assert.equal(shape.text,target.text,'Exact raw native text differs');
    const mapped=mapping.targets[index];exact(mapped,['shapeId','shapeName','segments']);assert.equal(mapped.shapeId,target.shapeId);assert.equal(mapped.shapeName,target.shapeName);assert.ok(Array.isArray(mapped.segments)&&mapped.segments.length>0&&mapped.segments.length<=64);let offset=0;
    for(const segment of mapped.segments){
      exact(segment,['nativeStart1Based','length','sourcePointer','sourceStart1Based','transform']);assert.equal(segment.nativeStart1Based,offset+1,'Mapping must partition whole native text');const source=strings.get(segment.sourcePointer);assert.equal(typeof source,'string','Not an authored text path');const sourceText=span(source,segment.sourceStart1Based,segment.length),nativeText=span(target.text,offset+1,segment.length);
      if(segment.transform==='identity')assert.equal(nativeText,sourceText,'No literal/whitespace/Unicode substitution');else{assert.equal(segment.transform,'paragraph-lf-to-cr');assert.equal(segment.length,1);assert.equal(sourceText,'\n');assert.equal(nativeText,'\r');}
      offset+=segment.length;
    }
    assert.equal(offset,target.text.length,'Incomplete raw native text mapping');assert.ok(Array.isArray(target.ranges)&&target.ranges.length>=1&&target.ranges.length<=8);const occupied=[];
    for(const sample of target.ranges){
      exact(sample,['start1Based','length','text','style']);integer(sample.length,1,32);assert.equal(sample.text,span(target.text,sample.start1Based,sample.length));for(const prior of occupied)assert.ok(sample.start1Based+sample.length<=prior.start1Based||prior.start1Based+prior.length<=sample.start1Based,'Overlapping samples');occupied.push(sample);
      exact(sample.style,['name','sizePoints','bold','italic']);literal(sample.style.name,128);assert.ok(Number.isFinite(sample.style.sizePoints)&&sample.style.sizePoints>0&&sample.style.sizePoints<=400);for(const key of['bold','italic'])assert.ok(sample.style[key]===-1||sample.style[key]===0);
      const touched=shape.runs.filter(run=>run.start1Based<sample.start1Based+sample.length&&sample.start1Based<run.start1Based+run.text.length);assert.ok(touched.length>0);assert.equal(touched.map(run=>span(run.text,Math.max(sample.start1Based-run.start1Based+1,1),Math.min(run.start1Based+run.text.length,sample.start1Based+sample.length)-Math.max(run.start1Based,sample.start1Based))).join(''),sample.text);
      for(const run of touched)assert.deepEqual(run.style,sample.style,'Sample style differs from actual native wire style');ranges++;units+=sample.length;
    }
  }
  assert.ok(ranges<=8&&units<=32,'Global range/UTF16 budget exceeded');return {targets:plan.targets.length,ranges,sampledUtf16:units};
}

/** Ordered OOXML; never group all a:r before a:br or trim the native text. */
export function b07NativeShapes(xml,XMLParser,source){
  const shapeBound=b07CurrentShapeBound(source);
  const parser=new XMLParser({preserveOrder:true,ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,parseAttributeValue:false,trimValues:false});
  const child=(nodes,key)=>nodes.flatMap(node=>node[key]?[node]:[]),one=(nodes,key)=>{const found=child(nodes,key);assert.equal(found.length,1,'Expected one '+key);return found[0];};
  const document=parser.parse(xml),slide=one(document,'p:sld'),common=one(slide['p:sld'],'p:cSld'),tree=one(common['p:cSld'],'p:spTree')['p:spTree'];
  assert.ok(tree.filter(node=>['p:sp','p:pic','p:graphicFrame','p:grpSp','p:cxnSp'].some(key=>Object.hasOwn(node,key))).length<=shapeBound);if(shapeBound===22)assert.equal(tree.filter(node=>['p:sp','p:pic','p:graphicFrame','p:grpSp','p:cxnSp'].some(key=>Object.hasOwn(node,key))).length,22);assert.equal(child(tree,'p:grpSp').length,0,'Nested groups need separate review');
  const shapes=child(tree,'p:sp').map(node=>{
    const content=node['p:sp'],nv=one(content,'p:nvSpPr'),identity=one(nv['p:nvSpPr'],'p:cNvPr')[':@'];const id=Number(identity.id);integer(id,1,2147483647);literal(identity.name,255);const bodies=child(content,'p:txBody');let text='';const runs=[];
    if(bodies.length){assert.equal(bodies.length,1);for(const [index,p]of child(bodies[0]['p:txBody'],'a:p').entries()){
      if(index)text+='\r';const ppr=child(p['a:p'],'a:pPr')[0]?.['a:pPr']??[],defaults=child(ppr,'a:defRPr')[0];
      for(const entry of p['a:p']){if(Object.hasOwn(entry,'a:br')){text+='\v';continue;}if(!Object.hasOwn(entry,'a:r'))continue;const parts=entry['a:r'],t=one(parts,'a:t')['a:t'];assert.ok(t.every(part=>Object.hasOwn(part,'#text')));const value=t.map(part=>part['#text']).join(''),properties=child(parts,'a:rPr')[0]??defaults,attrs={...defaults?.[':@'],...properties?.[':@']},latin=child(properties?.['a:rPr']??properties?.['a:defRPr']??[],'a:latin')[0]?.[':@']?.typeface??child(defaults?.['a:defRPr']??[],'a:latin')[0]?.[':@']?.typeface;
        const flag=value=>value===undefined||value==='0'?0:value==='1'?-1:null;
        const style={name:latin,sizePoints:Number(attrs.sz)/100,bold:flag(attrs.b),italic:flag(attrs.i)};runs.push({start1Based:text.length+1,text:value,style,rawProperties:properties??null});text+=value;
      }
    }}return {id,name:identity.name,text,runs,raw:node};
  });assert.equal(new Set(shapes.map(shape=>shape.id)).size,shapes.length);assert.equal(new Set(shapes.map(shape=>shape.name)).size,shapes.length);return shapes;
}

export async function b07ControllerFiles(){return [...new Set([...await preparationInputPaths(),'scripts/pack-ecosystem.mjs','scripts/test-packed-ecosystem.mjs','scripts/test-installed-code.mjs','scripts/ecosystem-preview-plan.mjs'])].sort();}
async function pinnedJson(file,sha,max=4*1024*1024){hex(sha);const bytes=await tableRegular(plainLocalPath(file));assert.ok(bytes.length<=max);assert.equal(digest(bytes),sha,'Reviewed file hash differs');return {bytes,value:JSON.parse(bytes)};}
async function loadB07ProfileSource(spec){
  const {bytes:suiteBytes,value:suite}=await pinnedJson(path.join(spec.suiteDirectory,'suite.json'),spec.suiteSha256);await tableFileRecords(spec.suiteDirectory,suite.files);
  assert.equal(suite.schemaVersion,1);assert.deepEqual(suite.scope,{kind:'b07-current-five-case',fullSuite:false,defaultSuite:false,nativeAcceptance:false});assert.equal(suite.nativeAcceptance,false);assert.equal(suite.registryAcceptance,false);
  const sources=readB07Sources();assert.deepEqual(suite.cases.map(item=>item.id),sources.map(item=>item.id),'Exact five-case roster');assert.deepEqual(suite.provenance.sourceSummary,b07SourceSummary());
  for(const [index,item]of suite.cases.entries()){
    assert.equal(item.automaticControlEligible,false);assert.equal(item.requiresReviewedNativeProfile,true);assert.equal(item.worker,undefined,'Never forge generic furniture eligibility');assert.equal(item.nativeAcceptance,false);assert.equal(item.slideCount,1);const shapeBound=b07CurrentShapeBound(sources[index]);assert.equal(item.declaredTopLevelShapes,shapeBound);integer(item.actualTopLevelShapes,0,shapeBound);if(shapeBound===22)assert.equal(item.actualTopLevelShapes,22);assert.equal(item.bodyText,sources[index].bodyText);
    assert.equal(item.input,'inputs/'+item.id+'.pptx');assert.equal(item.source,'sources/'+item.id+'.opf.json');assert.equal(item.actionPlan,'actions/'+item.id+'.json');
    for(const name of[item.input,item.source,item.actionPlan])assert.equal(suite.files.filter(record=>record.path===name).length,1,'Selected assets must be sealed');
    assert.deepEqual(await tableAsset(spec.suiteDirectory,item.source),sources[index].currentBytes);assert.deepEqual(JSON.parse(await tableAsset(spec.suiteDirectory,item.actionPlan)),[]);assert.equal(digest(await tableAsset(spec.suiteDirectory,item.input)),item.archiveSha256);
    if(sources[index].pin){const pin=sources[index].pin;assert.deepEqual(await tableAsset(spec.suiteDirectory,'historical/'+item.id+'.opf.json'),sources[index].originalBytes);const old=await tableAsset(spec.suiteDirectory,'historical/'+item.id+'.pptx');assert.equal(old.length,pin.archiveBytes);assert.equal(digest(old),pin.archiveSha256,'Historical archive bytes must stay original');}
  }
  await tableRepository(spec.producerRepository,suite.provenance.suiteRepository);assert.equal(suite.provenance.suiteRepository.directory,spec.producerRepository);assert.deepEqual(installedIdentity(spec.consumer),suite.provenance.packages);
  assert.deepEqual(await inspectReferenceRuntimeRoutes(spec.consumer),suite.provenance.runtimeRoutes);assert.deepEqual(readB07PackedProof({consumer:spec.consumer,proof:spec.packedProof,expectedProofSha256:suite.provenance.packedProof.sha256,preparationRepository:spec.producerRepository}),suite.provenance.packedProof);
  assert.equal(suite.provenance.node.version,process.version);assert.deepEqual(fileIdentity(suite.provenance.node.path),{bytes:suite.provenance.node.bytes,sha256:suite.provenance.node.sha256});
  const worker=repositoryIdentity(spec.workerRepository,B07_WORKER_FILES);assert.equal(worker.revision,B07_REVIEWED_WORKER);assert.equal(worker.dirty,false);assert.equal(worker.directory,spec.workerRepository);
  const selected=suite.cases.find(item=>item.id===spec.caseId);assert.ok(selected,'One exact B07 case required');const source=sources.find(item=>item.id===selected.id),input=await tableAsset(spec.suiteDirectory,selected.input);
  const pptx=suite.provenance.packages.packages.find(item=>item.name==='@openpresentation/opf-pptx').directory,require=createRequire(path.join(pptx,'package.json')),{XMLParser}=require('fast-xml-parser');
  const safetyFile=path.join(pptx,'dist/input-safety.js');assert.ok(suite.provenance.packages.packages.find(item=>item.directory===pptx).runtime.files.some(item=>item.path==='dist/input-safety.js'&&item.sha256===fileIdentity(safetyFile).sha256),'Archive safety module must be bound installed runtime');
  const {readInputZip}=await import(pathToFileURL(safetyFile));assert.ok(input.length<=B07_LIMITS.archiveBytes);const entries=readInputZip(input);assert.ok(Object.keys(entries).length<=B07_LIMITS.zipParts);assert.deepEqual(Object.keys(entries).filter(name=>/^ppt\/slides\/slide\d+\.xml$/u.test(name)),['ppt/slides/slide1.xml']);
  const shapes=b07NativeShapes(new TextDecoder('utf-8',{fatal:true}).decode(entries['ppt/slides/slide1.xml']),XMLParser,source);assert.equal(shapes.length<=selected.actualTopLevelShapes,true);
  if(b07CurrentShapeBound(source)===22){const scalarFile=path.join(pptx,'dist/native-scalar-fragments.js');assert.ok(suite.provenance.packages.packages.find(item=>item.directory===pptx).runtime.files.some(item=>item.path==='dist/native-scalar-fragments.js'&&item.sha256===fileIdentity(scalarFile).sha256),'Actual installed scalar reader required');const {readNativeScalarGroups}=await import(pathToFileURL(scalarFile));assertB07Case10Topology(source,shapes,readNativeScalarGroups(entries,'ppt/slides/slide1.xml').groups);}
  const probe=await pinnedJson(spec.probePlan,spec.probeSha256,65536),mapping=await pinnedJson(spec.sourceMapping,spec.mappingSha256,262144);
  const counts=validateB07Probe(probe.value,mapping.value,{archiveSha256:selected.archiveSha256,sourceSha256:digest(source.currentBytes),document:source.document,shapes});
  return {suite,suiteBytes,selected,source,input,probe,mapping,shapes,counts,worker};
}
const SPEC_KEYS=['suiteDirectory','suiteSha256','producerRepository','consumer','packedProof','workerRepository','caseId','probePlan','probeSha256','sourceMapping','mappingSha256','controllerRevision'];
export async function prepareB07Profile(spec,output){
  assertB07Node();exact(spec,SPEC_KEYS);for(const key of['suiteDirectory','producerRepository','consumer','packedProof','workerRepository','probePlan','sourceMapping'])spec[key]=plainLocalPath(spec[key]);
  assert.match(spec.controllerRevision,/^[a-f0-9]{40}$/u);const controller=repositoryIdentity(root,await b07ControllerFiles());assert.equal(controller.revision,spec.controllerRevision);assert.equal(controller.dirty,false,'Freeze reviewed controller');
  const source=await loadB07ProfileSource(spec);output=plainLocalPath(output,{exists:false});assertTableOutputSeparate(output,[root,...['suiteDirectory','producerRepository','consumer','workerRepository','packedProof','probePlan','sourceMapping'].map(key=>spec[key])]);assert.equal(fs.realpathSync(path.dirname(output)),path.dirname(output));
  fs.mkdirSync(output);fs.mkdirSync(path.join(output,'inputs'));const snapshots=[];const put=(file,bytes)=>{fs.writeFileSync(path.join(output,file),bytes,{flag:'wx'});snapshots.push({path:file,bytes:bytes.length,sha256:digest(bytes)});};
  put('inputs/suite.json',source.suiteBytes);put('inputs/case.pptx',source.input);put('inputs/source.opf.json',source.source.currentBytes);put('inputs/action-plan.json',await tableAsset(spec.suiteDirectory,source.selected.actionPlan));put('inputs/text-probe-plan.json',source.probe.bytes);put('inputs/source-mapping.json',source.mapping.bytes);
  const envelope={schemaVersion:1,profile:B07_PROFILE,postflightPolicy:B07_POSTFLIGHT_POLICY,spec,output,controllerRepository:controller,workerRepository:source.worker,node:{path:process.execPath,version:process.version,identity:fileIdentity(process.execPath)},selectedCase:source.selected,counts:source.counts,limits:b07LimitsForSource(source.source),snapshots,nativeAcceptance:false,registryAcceptance:false};
  // Recheck immutable inputs after exclusive snapshots; never resume failed output.
  await loadB07ProfileSource(spec);await tableRepository(root,controller);fs.writeFileSync(path.join(output,'execution-envelope.json'),json(envelope),{flag:'wx'});return {envelope:path.join(output,'execution-envelope.json'),sha256:digest(json(envelope)),nativeAcceptance:false};
}
export async function bindB07Profile(file,sha){
  assertB07Node();const {value:envelope}=await pinnedJson(file,sha);exact(envelope,['schemaVersion','profile','postflightPolicy','spec','output','controllerRepository','workerRepository','node','selectedCase','counts','limits','snapshots','nativeAcceptance','registryAcceptance']);assert.equal(envelope.schemaVersion,1);assert.equal(envelope.profile,B07_PROFILE);assert.deepEqual(envelope.postflightPolicy,B07_POSTFLIGHT_POLICY);assert.equal(envelope.nativeAcceptance,false);assert.equal(envelope.registryAcceptance,false);exact(envelope.spec,SPEC_KEYS);
  assert.equal(file,path.join(envelope.output,'execution-envelope.json'));assertB07ControllerDirectory(envelope.controllerRepository.directory);assert.equal(envelope.controllerRepository.revision,envelope.spec.controllerRevision);assert.deepEqual(envelope.controllerRepository.files.map(item=>item.path),await b07ControllerFiles());await tableRepository(root,envelope.controllerRepository);
  assert.deepEqual(envelope.node,{path:process.execPath,version:process.version,identity:fileIdentity(process.execPath)});assert.deepEqual(envelope.limits,b07LimitsForSource(readB07Sources().find(source=>source.id===envelope.spec.caseId)));
  const source=await loadB07ProfileSource(envelope.spec);assert.deepEqual(envelope.selectedCase,source.selected);assert.deepEqual(envelope.counts,source.counts);assert.deepEqual(envelope.workerRepository,source.worker);assertTableOutputSeparate(envelope.output,[root,...['suiteDirectory','producerRepository','consumer','workerRepository','packedProof','probePlan','sourceMapping'].map(key=>envelope.spec[key])]);
  assert.deepEqual(envelope.snapshots.map(item=>item.path),['inputs/suite.json','inputs/case.pptx','inputs/source.opf.json','inputs/action-plan.json','inputs/text-probe-plan.json','inputs/source-mapping.json']);await tableFileRecords(envelope.output,envelope.snapshots);
  const originals=[source.suiteBytes,source.input,source.source.currentBytes,await tableAsset(envelope.spec.suiteDirectory,source.selected.actionPlan),source.probe.bytes,source.mapping.bytes];for(const [index,item]of envelope.snapshots.entries())assert.equal(item.sha256,digest(originals[index]),'Snapshot differs from admitted original');return {envelope,source};
}

const nativeJson=bytes=>JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/u,''));
export function bindB07ObservedPhase(state,plan,source,expectedShapes){
  const shapeBound=b07CurrentShapeBound(source);
  assert.equal(state.slideCount,1);assert.equal(state.slides.length,1);const slide=state.slides[0];assert.equal(slide.index,1);integer(slide.shapeCount,0,shapeBound);assert.equal(slide.shapes.length,slide.shapeCount);
  if(shapeBound===22){assert.equal(slide.shapeCount,22);assert.equal(expectedShapes?.length,22);assert.deepEqual(slide.shapes.map(({id,name,text})=>({id,name,text})),expectedShapes.map(({id,name,text})=>({id,name,text})),'Complete current case10 identities/text must match original admitted topology');assert.equal(slide.shapes.map(shape=>shape.text).join('').length,117);}
  const observed=[];
  for(const target of plan.targets){
    const matches=slide.shapes.filter(shape=>shape.id===target.shapeId||shape.name===target.shapeName);assert.equal(matches.length,1,'Observed stale/ambiguous target');const shape=matches[0];assert.equal(shape.id,target.shapeId);assert.equal(shape.name,target.shapeName);assert.equal(shape.text,target.text);
    for(const property of['left','top','width','height','rotation'])assert.ok(Number.isFinite(shape[property])&&(!['width','height'].includes(property)||shape[property]>=0),'Nonfinite native physical geometry');
    const probe=shape.textProbe;assert.ok(probe);assert.equal(probe.nativeAcceptance,false);assert.equal(probe.shapeId,target.shapeId);assert.equal(probe.shapeName,target.shapeName);assert.equal(probe.text,target.text);assert.equal(probe.ranges.length,target.ranges.length);
    const descriptor=value=>{
      exact(value.fontSlots,['Name','NameAscii','NameOther','NameFarEast','NameComplexScript']);for(const slot of Object.values(value.fontSlots)){exact(slot,['value','status']);assert.ok(slot.value===null||typeof slot.value==='string');assert.equal(slot.status,typeof slot.value==='string'&&slot.value.trim().length?'reported':'mixed-or-unavailable');}
      exact(value.languageId,['value','status']);assert.ok(value.languageId.value===null||Number.isSafeInteger(value.languageId.value));assert.equal(value.languageId.status,Number.isSafeInteger(value.languageId.value)&&value.languageId.value>0?'reported':'mixed-or-unavailable');assert.ok(value.sizePoints===null||Number.isFinite(value.sizePoints));for(const flag of['bold','italic'])assert.ok(value[flag]===null||Number.isSafeInteger(value[flag]));
    };descriptor(probe.primary);
    for(const [index,sample]of target.ranges.entries()){
      const actual=probe.ranges[index];assert.equal(actual.start1Based,sample.start1Based);assert.equal(actual.length,sample.length);assert.equal(actual.text,sample.text);assert.deepEqual(actual.expectedStyle,sample.style);assert.equal(actual.nativeAcceptance,false);descriptor(actual.observed);
      const mismatch=[];if(actual.observed.fontSlots.Name.value!==sample.style.name)mismatch.push('name');if(actual.observed.sizePoints!==sample.style.sizePoints)mismatch.push('sizePoints');for(const flag of['bold','italic'])if(actual.observed[flag]!==sample.style[flag])mismatch.push(flag);assert.deepEqual(actual.styleMismatches,mismatch,'Raw mismatch receipt differs');
      exact(actual.bounds,['BoundLeft','BoundTop','BoundWidth','BoundHeight']);for(const [key,bound]of Object.entries(actual.bounds)){exact(bound,['value','status','unit']);assert.equal(bound.unit,'pt');assert.equal(bound.status,bound.value===null?'unavailable':'reported');assert.ok(bound.value===null||Number.isFinite(bound.value)&&(!['BoundWidth','BoundHeight'].includes(key)||bound.value>=0),'Nonfinite/negative probe bound');}
    }
    observed.push({shapeId:shape.id,shapeName:shape.name,text:shape.text,physical:{left:shape.left,top:shape.top,width:shape.width,height:shape.height,rotation:shape.rotation},textFont:shape.textFont,probe});
  }
  assert.equal(slide.shapes.filter(shape=>shape.textProbe).length,plan.targets.length);assert.equal(state.rasters.length,1);assert.equal(state.rasters[0].slideIndex,1);return observed;
}
export function assertB07Case10Phases(report,binding){
  if(b07CurrentShapeBound(binding.source)!==22)return;assert.deepEqual(Object.keys(report.phases),['original','edited','reopened']);
  for(const phase of ['original','edited','reopened'])bindB07ObservedPhase(report.phases[phase],binding.probe.value,binding.source,binding.shapes);
}
export function b07PngDimensions(bytes){assert.ok(bytes.length>=33);assert.deepEqual(bytes.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));assert.equal(bytes.toString('ascii',12,16),'IHDR');assert.equal(bytes.readUInt32BE(8),13);return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};}
export async function completeB07Observation(output,observation){
  await tableFileRecords(output,observation.rows);
  fs.writeFileSync(path.join(output,'observation.json'),json(observation),{flag:'wx'});
  await tableFileRecords(output,observation.rows);
  return {caseId:observation.caseId,sha256:digest(json(observation)),nativeAcceptance:false};
}
// Pure, prospective admission before the first read-only postflight query. This
// does not resume old failed runners or normalize any worker/report/stage bytes.
export async function verifyB07Postflight(file,sha,output){
  const {envelope,source}=await bindB07Profile(file,sha);output=plainLocalPath(output);assertTableOutputSeparate(output,[root,envelope.output,...['suiteDirectory','producerRepository','consumer','workerRepository'].map(key=>envelope.spec[key])]);
  const rows=[],read=async relative=>{const bytes=await tableAsset(output,relative);rows.push({path:relative,bytes:bytes.length,sha256:digest(bytes)});return bytes;};
  const runner=nativeJson(await read('runner.json'));assert.equal(runner.schemaVersion,1);assert.equal(runner.profile,B07_PROFILE);assert.deepEqual(runner.postflightPolicy,B07_POSTFLIGHT_POLICY);assert.equal(runner.envelopeSha256,sha);assert.equal(runner.caseId,source.selected.id);assert.equal(runner.runOfficeRequested,true);assert.equal(runner.status,'native-worker-completed; bounded-postflight-pending');assert.equal(runner.nativeAcceptance,false);assert.equal(runner.registryAcceptance,false);integer(runner.timeoutSeconds,5,60);assert.equal(runner.postflight,undefined);
  assert.deepEqual(runner.snapshots.map(item=>item.path),['execution-envelope.json',...envelope.snapshots.map(item=>item.path)]);await tableFileRecords(output,runner.snapshots);assert.equal(runner.snapshots[0].sha256,sha);assert.deepEqual(runner.snapshots.slice(1),envelope.snapshots);
  const terminal=nativeJson(await read('native/supervisor.json')),report=nativeJson(await read('native/report.json')),request=nativeJson(await read('native/request.json')),stageBytes=await read('native/stages.jsonl');
  const ready=assertB07PostflightReady(terminal,report,request,stageBytes),native=path.join(output,'native');
  assertB07Case10Phases(report,source);
  for(const [key,original,snapshot,expected]of[['source','inputs/case.pptx','native/inputs/input.pptx',source.selected.archiveSha256],['actionPlan','inputs/action-plan.json','native/inputs/action-plan.json',envelope.snapshots.find(item=>item.path==='inputs/action-plan.json').sha256],['textProbePlan','inputs/text-probe-plan.json','native/inputs/text-probe-plan.json',envelope.spec.probeSha256]]){assert.equal(request[key].path,path.join(output,original));assert.equal(request[key].snapshotPath,path.join(output,snapshot));assert.equal(request[key].sha256,expected);assert.equal(request[key].snapshotSha256,expected);assert.equal(digest(await read(snapshot)),expected);assert.equal(report[key].path,request[key].path);assert.equal(report[key].sha256,expected);assert.equal(report[key].snapshotPath??report.source.openedPath,path.join(output,snapshot));assert.equal(report[key].snapshotSha256??report.source.openedSha256,expected);}
  for(const [key,name]of[['verifier','native-furniture-control.ps1'],['processHelper','native-process.ps1']]){const record=envelope.workerRepository.files.find(item=>item.path==='packages/pptx/test/'+name);assert.equal(request[key].path,path.join(envelope.spec.workerRepository,'packages/pptx/test',name));assert.equal(request[key].sha256,record.sha256);assert.equal(request[key].snapshotPath,path.join(native,'inputs',name));assert.equal(request[key].snapshotSha256,record.sha256);assert.equal(digest(await read('native/inputs/'+name)),record.sha256);assert.deepEqual(report.inputs[key],request[key]);}
  const saved=await read('native/native-furniture-control.pptx');assert.equal(report.saved.path,path.join(native,'native-furniture-control.pptx'));assert.equal(report.reopened.path,report.saved.path);assert.equal(report.saved.sha256,digest(saved));assert.equal(report.reopened.sha256,digest(saved));
  await bindB07Profile(file,sha);await tableFileRecords(output,runner.snapshots);await tableFileRecords(output,rows);
  return {schemaVersion:1,profile:B07_PROFILE,policy:B07_POSTFLIGHT_POLICY,ready,rows,nativeAcceptance:false};
}
export async function observeB07Profile(file,sha,output){
  const {envelope,source}=await bindB07Profile(file,sha);output=plainLocalPath(output);assertTableOutputSeparate(output,[root,envelope.output,...['suiteDirectory','producerRepository','consumer','workerRepository'].map(key=>envelope.spec[key])]);
  const rows=[],read=async relative=>{const bytes=await tableAsset(output,relative);rows.push({path:relative,bytes:bytes.length,sha256:digest(bytes)});return bytes;};
  const runner=nativeJson(await read('runner.json'));assert.equal(runner.schemaVersion,1);assert.equal(runner.profile,B07_PROFILE);assert.deepEqual(runner.postflightPolicy,B07_POSTFLIGHT_POLICY);assert.equal(runner.envelopeSha256,sha);assert.equal(runner.caseId,source.selected.id);assert.equal(runner.runOfficeRequested,true);assert.equal(runner.status,'native-worker-completed; offline-observation-requested');assert.equal(runner.nativeAcceptance,false);assert.equal(runner.registryAcceptance,false);integer(runner.timeoutSeconds,5,60);
  assertB07BoundedPostflight(runner.postflight,await read('native/postflight.jsonl'));
  assert.deepEqual(runner.snapshots.map(item=>item.path),['execution-envelope.json',...envelope.snapshots.map(item=>item.path)]);await tableFileRecords(output,runner.snapshots);assert.equal(runner.snapshots[0].sha256,sha);assert.deepEqual(runner.snapshots.slice(1),envelope.snapshots);
  const supervisor=nativeJson(await read('native/supervisor.json')),report=nativeJson(await read('native/report.json')),request=nativeJson(await read('native/request.json'));assert.equal(supervisor.timedOut,false);assert.equal(supervisor.exitCode,0);assert.equal(supervisor.cleanupConfirmed,true);assert.equal(supervisor.lastDurableStage,'worker.complete');assert.equal(supervisor.lastDurableStatus,'success');assert.equal(report.cleanupConfirmed,true);assert.equal(report.officeOperationsStopped,false);assert.equal(report.error,null);assert.equal(report.lastStage,'worker.complete');assert.equal(report.lastStatus,'success');assert.equal(report.captureTextFonts,true);assert.equal(report.readOnlySurvey,false);assert.equal(request.captureTextFonts,true);assert.equal(request.readOnlySurvey,false);
  const native=path.join(output,'native'),pairs=[['source','inputs/case.pptx','native/inputs/input.pptx',source.selected.archiveSha256],['actionPlan','inputs/action-plan.json','native/inputs/action-plan.json',envelope.snapshots.find(item=>item.path==='inputs/action-plan.json').sha256],['textProbePlan','inputs/text-probe-plan.json','native/inputs/text-probe-plan.json',envelope.spec.probeSha256]];
  for(const [key,original,snapshot,expected]of pairs){assert.equal(request[key].path,path.join(output,original));assert.equal(request[key].snapshotPath,path.join(output,snapshot));assert.equal(request[key].sha256,expected);assert.equal(request[key].snapshotSha256,expected);assert.equal(digest(await read(snapshot)),expected);assert.equal(report[key].path,request[key].path);assert.equal(report[key].sha256,expected);assert.equal(report[key].snapshotPath??report.source.openedPath,path.join(output,snapshot));assert.equal(report[key].snapshotSha256??report.source.openedSha256,expected);}
  for(const [key,name]of[['verifier','native-furniture-control.ps1'],['processHelper','native-process.ps1']]){const record=envelope.workerRepository.files.find(item=>item.path==='packages/pptx/test/'+name);assert.equal(request[key].path,path.join(envelope.spec.workerRepository,'packages/pptx/test',name));assert.equal(request[key].sha256,record.sha256);assert.equal(request[key].snapshotPath,path.join(native,'inputs',name));assert.equal(request[key].snapshotSha256,record.sha256);assert.equal(digest(await read('native/inputs/'+name)),record.sha256);assert.deepEqual(report.inputs[key],request[key]);}
  assert.deepEqual(report.actionPlan.actions,[]);assert.deepEqual(report.actionPlan.completed,[]);assert.equal(request.actionPlan.count,0);
  readB07SuccessfulStages(await read('native/stages.jsonl'));
  assertB07PostflightReady(supervisor,report,request,await tableAsset(output,'native/stages.jsonl'));
  const phases={};for(const phase of['original','edited','reopened']){
    const state=report.phases[phase],observed=bindB07ObservedPhase(state,source.probe.value,source.source,source.shapes),relative=`native/${phase}-slide-01.png`,png=await read(relative);assert.equal(state.rasters[0].path,path.join(output,relative));assert.equal(state.rasters[0].sha256,digest(png));const dimensions=b07PngDimensions(png);assert.deepEqual(dimensions,{width:1280,height:720});phases[phase]={observed,png:{path:relative,bytes:png.length,sha256:digest(png),...dimensions},raw:state};
  }
  const saved=await read('native/native-furniture-control.pptx');assert.equal(report.saved.path,path.join(native,'native-furniture-control.pptx'));assert.equal(report.reopened.path,report.saved.path);assert.equal(report.saved.sha256,digest(saved));assert.equal(report.reopened.sha256,digest(saved));
  const pptx=source.suite.provenance.packages.packages.find(item=>item.name==='@openpresentation/opf-pptx').directory,require=createRequire(path.join(pptx,'package.json')),api=await import(pathToFileURL(require.resolve('@openpresentation/opf-pptx'))),{gallery}=await import(pathToFileURL(require.resolve('@openpresentation/gallery'))),{readInputZip}=await import(pathToFileURL(path.join(pptx,'dist/input-safety.js'))),{XMLParser}=require('fast-xml-parser');
  const findings={};for(const [phase,bytes]of[['original',source.input],['saved',saved],['reopened',saved]]){const diagnostics=[],entries=readInputZip(bytes);assert.ok(bytes.length<=16777216&&Object.keys(entries).length<=4096);assert.deepEqual(Object.keys(entries).filter(name=>/^ppt\/slides\/slide\d+\.xml$/u.test(name)),['ppt/slides/slide1.xml']);findings[phase]={sha256:digest(bytes),nativeShapes:b07NativeShapes(new TextDecoder('utf-8',{fatal:true}).decode(entries['ppt/slides/slide1.xml']),XMLParser,source.source),imported:await api.fromPptx(bytes,{catalogs:[gallery],onDiagnostic:issue=>diagnostics.push(issue)}),diagnostics};}
  await bindB07Profile(file,sha);await tableFileRecords(output,rows);await tableFileRecords(output,runner.snapshots);
  const observation={schemaVersion:1,profile:B07_PROFILE,envelopeSha256:sha,caseId:source.selected.id,rows,phases,findings,environment:report.environment,scope:'Raw before/SaveCopy/reopen reported Font/language/bounds, native PNGs, archives and public import findings. No mutation, physical font identity, glyph acceptance, full59 or release qualification.',nativeAcceptance:false,registryAcceptance:false};
  return completeB07Observation(output,observation);
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  const [command,...args]=process.argv.slice(2),options={};assert.equal(args.length%2,0);for(let i=0;i<args.length;i+=2){assert.ok(args[i].startsWith('--')&&args[i+1]&&!Object.hasOwn(options,args[i]));options[args[i]]=args[i+1];}
  if(command==='prepare'){assert.deepEqual(Object.keys(options).sort(),['--output','--spec','--spec-sha256']);const {value}=await pinnedJson(options['--spec'],options['--spec-sha256']);console.log(b07WireJson(await prepareB07Profile(value,options['--output'])));}
  else if(command==='observe'){assert.deepEqual(Object.keys(options).sort(),['--envelope','--expected-envelope-sha256','--output']);console.log(b07WireJson(await observeB07Profile(options['--envelope'],options['--expected-envelope-sha256'],options['--output'])));}
  else if(command==='verify-postflight'){assert.deepEqual(Object.keys(options).sort(),['--envelope','--expected-envelope-sha256','--output']);console.log(b07WireJson(await verifyB07Postflight(options['--envelope'],options['--expected-envelope-sha256'],options['--output'])));}
  else{assert.equal(command,'verify');assert.deepEqual(Object.keys(options).sort(),['--envelope','--expected-envelope-sha256']);const {envelope}=await bindB07Profile(options['--envelope'],options['--expected-envelope-sha256']);console.log(b07WireJson({profile:B07_PROFILE,output:envelope.output,caseId:envelope.selectedCase.id,inputPath:path.join(envelope.output,'inputs/case.pptx'),planPath:path.join(envelope.output,'inputs/action-plan.json'),probePath:path.join(envelope.output,'inputs/text-probe-plan.json'),nativeAcceptance:false}));}
}
