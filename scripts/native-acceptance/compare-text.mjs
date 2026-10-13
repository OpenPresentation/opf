// Office-free named-text geometry comparison. This is not a native fidelity acceptance gate.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,realpath} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {digest,installedIdentity} from './identity.mjs';

export const TEXT_GEOMETRY_TOLERANCE_POINTS=0.02;
const words=text=>{assert.equal(typeof text,'string','Text observation missing');return text.match(/\S+/gu)??[];};
const finite=value=>{assert.equal(typeof value,'number','Numeric geometry observation missing');assert.ok(Number.isFinite(value),'Nonfinite geometry');return value;};
const unique=(items,key,label)=>{
  assert.ok(Array.isArray(items),`${label}: missing list`);const seen=new Set();
  for(const item of items){const value=key(item);assert.equal(typeof value,'string',`${label}: missing identity`);assert.ok(value.length&&!seen.has(value.toLowerCase()),`${label}: duplicate/empty identity`);seen.add(value.toLowerCase());}
};

export function compareTextObservations({expected,report,actions=[]}={}){
  assert.ok(Array.isArray(expected)&&expected.length>0&&expected.length<=3,'Expected one through three slides');
  assert.ok(Array.isArray(actions)&&actions.length<=20,'Invalid action list');
  // Structural mutations need their own comparator model, rather than an inferred correspondence.
  for(const action of actions)assert.ok(['set-text'].includes(action.op),`Unsupported text comparison action: ${action.op}`);
  for(const action of actions){assert.ok(Number.isInteger(action.slideIndex)&&action.slideIndex>=1&&action.slideIndex<=expected.length,'Invalid action slide');assert.equal(typeof action.text,'string');assert.equal(expected[action.slideIndex-1].shapes.filter(shape=>shape.name===action.shapeName).length,1,'Action must select one exact named text shape');}
  const findings=[],rows=[];
  assert.equal(report.schemaVersion,1);assert.equal(report.cleanupConfirmed,true);assert.equal(report.officeOperationsStopped,false);assert.equal(report.error,null);assert.equal(report.lastStage,'worker.complete');assert.equal(report.lastStatus,'success');
  assert.deepEqual(report.actionPlan.actions,actions,'Worker action plan differs');
  assert.equal(report.actionPlan.completed.length,actions.length,'Incomplete native actions');
  report.actionPlan.completed.forEach((item,index)=>{assert.deepEqual(item,{index:index+1,op:actions[index].op,status:'success'});});
  for(const phase of ['original','edited','reopened']){
    const observed=report.phases[phase];assert.equal(observed.slideCount,expected.length,`${phase}: slide count`);assert.equal(observed.slides.length,expected.length);
    for(const [index,slide] of expected.entries()){
      unique(slide.shapes,item=>item.name,'Expected shapes');const actual=observed.slides[index];assert.equal(actual.index,index+1);assert.equal(actual.shapeCount,actual.shapes.length);assert.ok(actual.shapeCount<=30);
      unique(actual.shapes,item=>item.name,`${phase}: shapes`);
      const textShapes=actual.shapes.filter(item=>item.hasTextFrame!==0&&item.text!==null);
      assert.equal(textShapes.length,slide.shapes.length,`${phase}: named text shape count`);
      for(const shape of slide.shapes){
        const matches=textShapes.filter(item=>item.name===shape.name);assert.equal(matches.length,1,`${phase}: missing exact named text shape ${shape.name}`);
        const current=matches[0];assert.equal(typeof current.hasTextFrame,'number');assert.notEqual(current.hasTextFrame,0);
        let expectedText=shape.text;
        if(phase!=='original')for(const action of actions)if(action.op==='set-text'&&action.slideIndex===index+1&&action.shapeName===shape.name){assert.equal(typeof action.text,'string');expectedText=action.text;}
        if(JSON.stringify(words(current.text))!==JSON.stringify(words(expectedText)))findings.push({phase,slide:index+1,name:shape.name,field:'words',expected:words(expectedText),actual:words(current.text)});
        const differences={};for(const field of ['left','top','width','height','rotation']){
          const delta=finite(current[field])-finite(shape[field]);differences[field]=delta;
          // Rotation is an exact control, not a quantity measured in points.
          if(field==='rotation'?delta!==0:Math.abs(delta)>TEXT_GEOMETRY_TOLERANCE_POINTS)findings.push({phase,slide:index+1,name:shape.name,field,expected:shape[field],actual:current[field],delta});
        }
        rows.push({phase,slide:index+1,name:shape.name,differences});
      }
    }
  }
  // A native edit may legitimately change original words; reopening must preserve the edited observation.
  for(let index=0;index<expected.length;index++)for(const shape of expected[index].shapes){
    const edited=report.phases.edited.slides[index].shapes.find(item=>item.name===shape.name),reopened=report.phases.reopened.slides[index].shapes.find(item=>item.name===shape.name);
    if(JSON.stringify(words(edited.text))!==JSON.stringify(words(reopened.text)))findings.push({phase:'edited-to-reopened',slide:index+1,name:shape.name,field:'words'});
    for(const field of ['left','top','width','height','rotation'])if(field==='rotation'?edited[field]!==reopened[field]:Math.abs(edited[field]-reopened[field])>TEXT_GEOMETRY_TOLERANCE_POINTS)findings.push({phase:'edited-to-reopened',slide:index+1,name:shape.name,field});
  }
  assert.ok(rows.length>0,'No named text observations');
  return {passed:findings.length===0,tolerancePoints:TEXT_GEOMETRY_TOLERANCE_POINTS,slides:expected.length,slideDimensionsPoints:expected.map(slide=>slide.dimensions??null),textShapes:expected.reduce((count,slide)=>count+slide.shapes.length,0),observations:rows,findings,unavailable:{fontSelection:'Existing worker does not record character font/style descriptors; host registration is not glyph font proof.',baseline:'COM shape geometry does not measure a typographic baseline.',pixelEquivalence:'Not compared; PNG ink differences are separate observations.'},nativeAcceptance:false,registryAcceptance:false,textComparison:'Whitespace-delimited words only; exact spacing, tabs, line breaks and typography are not compared.',coordinateSystem:'PPTX transform EMUs divided by 12700 give points; native COM boxes are points. No slide aspect ratio or raster resolution is assumed.',scope:'Named editable text words and exported allocation boxes versus native COM, including edited/reopened stability. No font, baseline, glyph-outline or pixel-equivalence acceptance.'};
}

export function exportedTextShapes(bytes,{unzipSync,XMLParser,XMLValidator},slideCount){
  const archive=unzipSync(bytes),parser=new XMLParser({preserveOrder:true,ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,parseAttributeValue:false,trimValues:false});
  const child=(nodes,key)=>nodes.filter(node=>Object.hasOwn(node,key));
  const one=(nodes,key)=>{const found=child(nodes,key);assert.equal(found.length,1,`PPTX requires one ${key}`);return found[0];};
  const attr=(node,key)=>{const value=node[':@']?.[key];assert.equal(typeof value,'string',`Missing XML attribute ${key}`);return value;};
  const number=(node,key)=>{const value=attr(node,key);assert.match(value,/^-?\d+$/u,'Invalid EMU/rotation integer');const result=Number(value);assert.ok(Number.isSafeInteger(result));return result;};
  const parse=file=>{assert.ok(archive[file],`Missing PPTX part ${file}`);const xml=Buffer.from(archive[file]).toString();assert.equal(XMLValidator.validate(xml),true,`Invalid XML ${file}`);assert.ok(!/<!DOCTYPE|<!ENTITY/u.test(xml),'XML declarations are not supported');return parser.parse(xml);};
  const slides=Object.keys(archive).filter(file=>/^ppt\/slides\/slide\d+\.xml$/u.test(file));assert.equal(slides.length,slideCount,'PPTX slide count differs');
  const presentation=one(parse('ppt/presentation.xml'),'p:presentation');const ids=one(presentation['p:presentation'],'p:sldIdLst')['p:sldIdLst'];
  const size=one(presentation['p:presentation'],'p:sldSz'),dimensions={width:number(size,'cx')/12700,height:number(size,'cy')/12700};assert.ok(dimensions.width>0&&dimensions.height>0,'Invalid presentation dimensions');
  const relationships=one(parse('ppt/_rels/presentation.xml.rels'),'Relationships').Relationships;
  const ordered=child(ids,'p:sldId').map(node=>{const id=attr(node,'r:id'),matches=child(relationships,'Relationship').filter(rel=>attr(rel,'Id')===id);assert.equal(matches.length,1,'Slide relationship missing/duplicate');assert.equal(matches[0][':@'].TargetMode,undefined);const target=attr(matches[0],'Target');assert.match(target,/^slides\/slide[1-9]\d*\.xml$/u);return `ppt/${target}`;});assert.equal(ordered.length,slideCount);assert.equal(new Set(ordered).size,slideCount,'Duplicate slide relationship');
  const text=nodes=>nodes.map(node=>Object.hasOwn(node,'a:t')?node['a:t'].map(item=>item['#text']??'').join(''):Object.hasOwn(node,'a:br')?'\n':Object.hasOwn(node,'a:tab')?'\t':Object.entries(node).filter(([key])=>key!==':@').map(([,value])=>Array.isArray(value)?text(value):'').join('')).join('');
  return ordered.map(file=>{
    const sld=one(parse(file),'p:sld'),tree=one(one(sld['p:sld'],'p:cSld')['p:cSld'],'p:spTree')['p:spTree'];
    assert.equal(child(tree,'p:grpSp').length,0,'Grouped text requires a dedicated transform comparator');
    const shapes=child(tree,'p:sp').filter(node=>child(node['p:sp'],'p:txBody').length).map(node=>{
      const sp=node['p:sp'],name=attr(one(one(sp,'p:nvSpPr')['p:nvSpPr'],'p:cNvPr'),'name');assert.ok(name.length>0,'Missing serialized text shape name');
      const transform=one(one(sp,'p:spPr')['p:spPr'],'a:xfrm'),off=one(transform['a:xfrm'],'a:off'),ext=one(transform['a:xfrm'],'a:ext');
      assert.ok(!transform[':@']?.flipH&&!transform[':@']?.flipV,'Flipped text requires separate comparison');
      const rotation=transform[':@']?.rot===undefined?0:number(transform,'rot')/60000;assert.equal(rotation,0,'Rotated text requires a dedicated comparator');
      return {name,text:child(one(sp,'p:txBody')['p:txBody'],'a:p').map(node=>text(node['a:p'])).join('\r'),left:number(off,'x')/12700,top:number(off,'y')/12700,width:number(ext,'cx')/12700,height:number(ext,'cy')/12700,rotation};
    });unique(shapes,item=>item.name,'PPTX text shapes');return {dimensions,shapes};
  });
}

async function regular(file){assert.equal(await realpath(file),path.resolve(file),'Aliased evidence path');assert.ok((await lstat(file)).isFile(),'Expected regular evidence file');return readFile(file);}
const json=async file=>JSON.parse((await regular(file)).toString('utf8').replace(/^\uFEFF/u,''));
async function asset(root,relative){assert.equal(typeof relative,'string');assert.ok(relative&&!relative.includes('\\')&&!path.isAbsolute(relative)&&relative.split('/').every(part=>part&&part!=='.'&&part!=='..'&&![...part].some(char=>char.charCodeAt(0)<32||'<>:"|?*'.includes(char))),'Unsafe asset path');return regular(path.join(root,relative));}
export async function compareText({suiteDirectory,output,consumer,caseId}){
  const suiteBytes=await regular(path.join(suiteDirectory,'suite.json')),suite=JSON.parse(suiteBytes.toString());assert.equal(suite.schemaVersion,1);
  unique(suite.cases,item=>item.id,'Suite cases');unique(suite.files,item=>item.path,'Suite files');assert.ok(suite.files.length>0&&suite.files.length<=1000);
  for(const file of suite.files){assert.match(file.sha256,/^[a-f0-9]{64}$/u);assert.ok(Number.isSafeInteger(file.bytes)&&file.bytes>=0);const bytes=await asset(suiteDirectory,file.path);assert.equal(bytes.length,file.bytes,`Suite bytes differ: ${file.path}`);assert.equal(digest(bytes),file.sha256,`Suite hash differs: ${file.path}`);}
  const selected=suite.cases.find(item=>item.id===caseId);assert.ok(selected,'Exact selected case missing');assert.equal(selected.worker,'furniture');assert.equal(selected.automaticControlEligible,true);
  for(const field of ['input','actionPlan'])assert.equal(suite.files.filter(file=>file.path===selected[field]).length,1,`Unsealed selected ${field}`);
  assert.deepEqual(installedIdentity(consumer),suite.provenance.packages,'Installed identity changed');
  const runner=await json(path.join(output,'runner.json'));assert.equal(runner.schemaVersion,1);assert.equal(runner.case,caseId);assert.equal(runner.manifestSha256,digest(suiteBytes));assert.deepEqual(runner.selectedCase,selected);assert.deepEqual(runner.provenance,suite.provenance);assert.equal(runner.status,'native-observation-completed; acceptance-requires-supervisor-review');assert.equal(runner.nativeAcceptance,false);assert.equal(runner.registryAcceptance,false);
  for(const identity of [suite.provenance.suiteRepository,suite.provenance.workerRepository]){assert.match(identity.revision,/^[a-f0-9]{40}$/u);assert.equal(typeof identity.dirty,'boolean');unique(identity.files,item=>item.path,'Recorded code inputs');}
  for(const [key,recorded] of [['suite','suiteRepository'],['workers','workerRepository']]){const actual=runner.executingCode[key],expected=suite.provenance[recorded];assert.equal(actual.revision,expected.revision);assert.equal(actual.dirty,expected.dirty);assert.deepEqual(actual.files,expected.files);}
  assert.ok(Number.isInteger(runner.timeoutSeconds)&&runner.timeoutSeconds>=5&&runner.timeoutSeconds<=60,'Invalid bounded runner timeout');
  const native=path.join(output,'native'),terminal=await json(path.join(native,'supervisor.json'));assert.equal(terminal.timedOut,false);assert.equal(terminal.exitCode,0);assert.equal(terminal.cleanupConfirmed,true);
  const reportBytes=await regular(path.join(native,'report.json')),report=JSON.parse(reportBytes.toString('utf8').replace(/^\uFEFF/u,'')),request=await json(path.join(native,'request.json'));
  const input=await asset(suiteDirectory,selected.input),plan=await asset(suiteDirectory,selected.actionPlan),actions=JSON.parse(plan.toString());assert.equal(selected.archiveSha256,digest(input));
  for(const [relative,bytes] of [['inputs/case.pptx',input],['inputs/action-plan.json',plan],['native/inputs/input.pptx',input],['native/inputs/action-plan.json',plan]])assert.equal(digest(await asset(output,relative)),digest(bytes),`Snapshot changed: ${relative}`);
  assert.equal(request.source.sha256,digest(input));assert.equal(request.source.snapshotSha256,digest(input));assert.equal(report.source.sha256,digest(input));assert.equal(report.source.openedSha256,digest(input));
  for(const record of [request.actionPlan,report.actionPlan]){assert.equal(record.sha256,digest(plan));assert.equal(record.snapshotSha256,digest(plan));}
  for(const [key,file] of [['verifier','test/native-furniture-control.ps1'],['processHelper','test/native-process.ps1']]){const expected=suite.provenance.workerRepository.files.find(item=>item.path===file);assert.ok(expected,'Missing worker code identity');assert.deepEqual(report.inputs[key],request[key]);assert.equal(request[key].sha256,expected.sha256);assert.equal(request[key].snapshotSha256,expected.sha256);const snapshot=key==='verifier'?'native/inputs/native-furniture-control.ps1':'native/inputs/native-process.ps1';assert.equal(digest(await asset(output,snapshot)),expected.sha256);}
  assert.equal(request.actionPlan.count,actions.length,'Request action count differs');
  const saved=await asset(output,'native/native-furniture-control.pptx');assert.equal(digest(saved),report.saved.sha256);assert.equal(report.reopened.sha256,report.saved.sha256);
  const require=createRequire(path.join(consumer,'package.json')),dependencies=createRequire(require.resolve('@openpresentation/opf-pptx/package.json'));
  const expected=exportedTextShapes(input,{...dependencies('fflate'),...dependencies('fast-xml-parser')},selected.slideCount),result=compareTextObservations({expected,report,actions});
  const comparator=await regular(fileURLToPath(import.meta.url));Object.assign(result,{case:caseId,manifestSha256:digest(suiteBytes),reportSha256:digest(reportBytes),runnerSha256:digest(await regular(path.join(output,'runner.json'))),comparatorSha256:digest(comparator),node:process.version});
  await writeFile(path.join(output,'text-comparison.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const options={};for(let index=2;index<process.argv.length;index+=2){const key=process.argv[index];assert.ok(['--suite','--output','--consumer','--case'].includes(key),`Unknown option ${key}`);assert.ok(!Object.hasOwn(options,key)&&process.argv[index+1]&&!process.argv[index+1].startsWith('--'),`Invalid/duplicate option ${key}`);options[key]=process.argv[index+1];}
  for(const key of ['--suite','--output','--consumer','--case'])assert.ok(options[key],`Required ${key}`);
  const result=await compareText({suiteDirectory:path.resolve(options['--suite']),output:path.resolve(options['--output']),consumer:path.resolve(options['--consumer']),caseId:options['--case']});console.log(JSON.stringify(result));assert.ok(result.passed,'Named text words/geometry comparison failed; preserve text-comparison.json');
}
