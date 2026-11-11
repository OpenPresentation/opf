// Synthetic prepared archives and managed objects are not native observations.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {toPptx,fromPptx} from '@openpresentation/opf-pptx';
import {archiveDependencies,inspectSevenArchive} from './seven-chart-archive.mjs';
import {currentSevenSource,bindCurrentTreemap} from './seven-value-current.mjs';
import {sevenWorkbookAliasPartition} from './seven-value-archive.mjs';
import {sevenExpectedOperations} from './seven-postflight.mjs';
import {digest,fileIdentity} from './identity.mjs';
import {windowsPowerShellEnvironment} from './windows-powershell-env.mjs';
import {syntheticValueControl} from './seven-value-control-fixture.mjs';
import {compareSevenNativeBefore,compareSevenNativeSnapshots,snapshotNumericReadback} from './seven-value-snapshot-compare.mjs';
import {projectSnapshotNamespacePair,assertSnapshotRawPreservation} from './seven-value-snapshot-namespace.mjs';
import {snapshotOperations,snapshotBeforeOperations,snapshotCriticalProbes,SNAPSHOT_PROFILE,SNAPSHOT_POLICY} from './seven-value-snapshot-profile.mjs';
const deps=archiveDependencies(),selection={slideIndex:1,seriesIndex:1,pointIndex:1,newValue:43},ROOT=path.resolve(import.meta.dirname,'../..');
const once=(text,before,after)=>{assert.equal(text.split(before).length,2);return text.replace(before,after);};
const change=(parts,name,edit)=>{assert.ok(parts[name]);parts[name]=deps.strToU8(edit(deps.strFromU8(parts[name])));};
const zip=parts=>Buffer.from(deps.zipSync(parts));
function phase(archive){return{slideCount:7,rasters:Array.from({length:7},(_,i)=>({slideIndex:i+1})),slides:archive.slides.map((slide,i)=>{const shapes=slide.shapes.filter(s=>s.kind==='title'||s.branch==='choice'||s.branch==='direct').map((s,j)=>({index:j+1,id:s.id,name:s.name,type:s.kind==='title'?14:3,...s.geometry,hasTextFrame:s.kind==='title'?-1:0,text:s.kind==='title'?s.text:null,alternativeText:''}));return{index:i+1,slideId:i+256,name:'Synthetic '+i,shapeCount:shapes.length,shapes};})};}
let pending;
async function fixture(){pending??=(async()=>{
 const source=currentSevenSource(),input=Buffer.from(await toPptx(source,{chartex:'native'})),bound=bindCurrentTreemap(input,source,selection),action=bound.action,parts=deps.unzipSync(input);
 for(const slide of bound.archive.slides)for(const shape of slide.shapes){if(shape.kind!=='chart'||shape.chart.workbook.part!==action.workbookPart)continue;change(parts,shape.chartPart,text=>shape.chart.family==='chartEx'?once(text,'<cx:pt idx="0">42</cx:pt>','<cx:pt idx="0">43</cx:pt>'):once(text,'<c:pt idx="0"><c:v>42</c:v></c:pt>','<c:pt idx="0"><c:v>43</c:v></c:pt>'));}
 const book=deps.unzipSync(parts[action.workbookPart]);change(book,'xl/worksheets/sheet1.xml',text=>once(text,'<c r="B2"><v>42</v></c>','<c r="B2"><v>43</v></c>'));parts[action.workbookPart]=deps.zipSync(book);const edited=zip(parts),imports={};
 for(const [name,bytes]of [['source',input],['before',input],['edited',edited],['reopened',edited]]){const diagnostics=[],document=await fromPptx(bytes,{onDiagnostic:d=>diagnostics.push(d)});imports[name]={document,diagnostics};}
 return{input,before:input,edited,reopened:edited,source,selection,action,imports,root:ROOT,deps,bound,phases:{original:phase(bound.archive),'saved-reopened':phase(inspectSevenArchive(edited,deps,bound.archiveContext))}};
})();return pending;}
const uri=prefix=>prefix==='cx1'?'http://schemas.microsoft.com/office/drawing/2015/9/8/chartex':'http://schemas.microsoft.com/office/drawing/2015/10/21/chartex';
function xml(prefix='cx1',location='choice'){return '<p:sld xmlns:p="p" xmlns:mc="mc"><p:cSld><p:spTree><mc:AlternateContent'+(location==='parent'?' xmlns:'+prefix+'="'+uri(prefix)+'"':'')+'><mc:Choice Requires="'+prefix+'"'+(location==='choice'?' xmlns:'+prefix+'="'+uri(prefix)+'"':'')+'><p:graphicFrame><'+prefix+':chart/></p:graphicFrame></mc:Choice><mc:Fallback><p:sp/></mc:Fallback></mc:AlternateContent></p:spTree></p:cSld></p:sld>';}
test('snapshot namespace policy admits only the real pairwise local/direct-parent declaration move',()=>{
 for(const prefix of ['cx1','cx2'])for(const reverse of [false,true]){const a=xml(prefix),b=xml(prefix,'parent'),pair=projectSnapshotNamespacePair(reverse?b:a,reverse?a:b);assert.equal(pair.changes.length,1);assert.equal(pair.changes[0].effectiveUri,uri(prefix));const parser=new deps.XMLParser({ignoreAttributes:false});assert.deepEqual(parser.parse(pair.before),parser.parse(pair.after));assert.equal(pair.changes[0].beforeDeclaration,reverse?'AlternateContent':'Choice');}
 const unchanged=xml();assert.deepEqual(projectSnapshotNamespacePair(unchanged,unchanged),{before:unchanged,after:unchanged,changes:[]});
});
test('namespace projection refuses container scope effects, QName mentions, shadows and unknown topology',()=>{
 const a=xml(),b=xml('cx1','parent'),cases=[
 ['own-QName',t=>t.replace('<mc:AlternateContent','<mc:AlternateContent cx1:unknown="x"')],['own-Ignorable',t=>t.replace('<mc:AlternateContent','<mc:AlternateContent mc:Ignorable="cx1"')],['container-text',t=>t.replace('<mc:Choice','cx1<mc:Choice')],['encoded-mention',t=>t.replace('<mc:Fallback>','<mc:Fallback note="c&#120;1">')],['fallback-QName',t=>t.replace('<p:sp/>','<cx1:unknown/>')],['shadow',t=>t.replace('<p:graphicFrame>','<p:graphicFrame xmlns:cx1="urn:foreign">')],['redundant-nested',t=>t.replace('<p:graphicFrame>','<p:graphicFrame xmlns:cx1="'+uri('cx1')+'">')],['redundant-parent',t=>t.replace('<mc:Choice Requires="cx1"','<mc:Choice xmlns:cx1="'+uri('cx1')+'" Requires="cx1"')],['ancestor',t=>t.replace('<p:cSld>','<p:cSld xmlns:cx1="'+uri('cx1')+'">')],['foreign',t=>t.replace(uri('cx1'),'urn:foreign')],['unbound',t=>t.replace(' xmlns:cx1="'+uri('cx1')+'"','')],['multiple',t=>t.replace('Requires="cx1"','Requires="cx1 cx2"')],['whitespace',t=>t.replace('Requires="cx1"','Requires=" cx1 "')],['topology',t=>t.replace('<mc:Fallback>','<mc:Fallback/><mc:Fallback>')],['unknown-child',t=>t.replace('</mc:AlternateContent>','<p:sp/></mc:AlternateContent>')],
 ];for(const [name,edit]of cases)assert.throws(()=>projectSnapshotNamespacePair(a,edit(b)),undefined,name);
 // A different owner path receives no exception: the raw comparison still sees it.
 const foreignA=a.replace('<p:spTree>','<p:other>').replace('</p:spTree>','</p:other>'),foreignB=b.replace('<p:spTree>','<p:other>').replace('</p:spTree>','</p:other>');assert.equal(projectSnapshotNamespacePair(foreignA,foreignB).changes.length,0);
});
test('public current seven source/before/edited/reopened archives prove exactly one actual cache/workbook delta',async()=>{
 const f=await fixture(),result=compareSevenNativeSnapshots(f);assert.deepEqual(result.archiveReadbacks.before.values,[42,31,-8,19]);assert.deepEqual(result.archiveReadbacks.edited.values,[43,31,-8,19]);assert.deepEqual(result.archiveReadbacks.reopened.workbookValues,[43,31,-8,19]);assert.equal(result.nativeAcceptance,false);assert.equal(result.baseline.observation,'actual-native-before-archive comparison target; not setter action or COM getter');assert.deepEqual(f.imports.reopened,f.imports.edited);
});
test('source-to-before admission refuses changed data, roles, broken relationships and public imports before any setter',async()=>{
 const f=await fixture();assert.throws(()=>compareSevenNativeBefore({...f,before:f.edited}));
 const imported=structuredClone(f.imports);imported.before.document.slides[1].title='Foreign title';assert.throws(()=>compareSevenNativeBefore({...f,imports:imported}),/public import/);
 for(const mode of ['title','relationship']){const parts=deps.unzipSync(f.input);if(mode==='title')change(parts,'ppt/slides/slide1.xml',t=>t.replace('</a:t>',' changed</a:t>'));if(mode==='relationship')change(parts,'ppt/slides/_rels/slide1.xml.rels',t=>t.replace('Id="rId1"','Id="rIdChanged"'));assert.throws(()=>compareSevenNativeBefore({...f,before:zip(parts)}),undefined,mode);}
});
test('first-Save semantic roles retain complete data while every raw spacing/paint/lexical change stays OPEN',async()=>{
 const f=await fixture(),parts=deps.unzipSync(f.input),original=Buffer.from(f.input);
 change(parts,'ppt/charts/chart3.xml',text=>{
  const axis=/<c:catAx>[\s\S]*?<\/c:catAx>/u.exec(text)?.[0];assert.ok(axis);
  return once(once(once(text,'<c:overlap val="0"/>',''),'<c:v>0.7934782608695652</c:v>','<c:v>0.79347826086956519</c:v>'),axis,once(axis,'<c:lblAlgn val="ctr"/>','<c:lblAlgn val="ctr"/><c:lblOffset val="100"/>')).replace(/>\s+</gu,'><');
 });
 change(parts,'ppt/charts/chartEx3.xml',text=>once(text,'</cx:layoutPr>','<cx:subtotals/></cx:layoutPr>'));
 change(parts,'ppt/charts/chartEx4.xml',text=>once(text,'gapWidth="0.06"','gapWidth="0.0599999987"'));
 const before=zip(parts),copy=Buffer.from(before),diagnostics=[],document=await fromPptx(before,{onDiagnostic:d=>diagnostics.push(d)});
 const result=compareSevenNativeBefore({...f,before,imports:{...f.imports,before:{document,diagnostics}}});
 assert.equal(result.nativeRoleBindingVerified,true);assert.equal(result.sourceRawStyleQualification,'OPEN');assert.equal(result.rawFindings.qualification,'OPEN');
 assert.deepEqual(result.rawFindings.changes.map(r=>r.part),['ppt/charts/chart3.xml','ppt/charts/chartEx3.xml','ppt/charts/chartEx4.xml']);
 assert.deepEqual(f.input,original);assert.deepEqual(before,copy);assert.match(deps.strFromU8(deps.unzipSync(before)['ppt/charts/chartEx4.xml']),/gapWidth="0\.0599999987"/u,'The genuinely different spacing is retained, never rounded');
 assert.throws(()=>assertSnapshotRawPreservation({...f,saved:before,action:{...f.action,newValues:[...f.action.expectedValues]},archiveContext:f.bound.archiveContext}),'The same raw delta still refuses under the strict later-save guard');
});
test('first-Save role admission checks previously omitted srcOrd, axis associations/scaling and closed semantic vectors',async()=>{
 const f=await fixture();
 for(const [name,file,edit]of [
  ['source order','ppt/charts/chartEx1.xml',text=>once(text,'<cx:series layoutId="treemap"','<cx:series srcOrd="0" layoutId="treemap"')],
  ['native axis association','ppt/charts/chartEx2.xml',text=>once(text,'<cx:axisId val="0"/>','<cx:axisId val="1"/>')],
  ['native scaling','ppt/charts/chartEx2.xml',text=>once(text,'max="50"','max="51"')],
  ['classic cross-axis','ppt/charts/chart4.xml',text=>once(text,'<c:crossAx val="2094734552"/>','<c:crossAx val="999"/>')],
  ['classic series order','ppt/charts/chart4.xml',text=>once(text,'<c:order val="0"/>','<c:order val="1"/>')],
  ['box statistics','ppt/charts/chartEx2.xml',text=>once(text,'quartileMethod="exclusive"','quartileMethod="inclusive"')],
  ['waterfall subtotal','ppt/charts/chartEx3.xml',text=>once(text,'</cx:layoutPr>','<cx:subtotals><cx:idx val="0"/></cx:subtotals></cx:layoutPr>')],
  ['unknown native vector','ppt/charts/chartEx1.xml',text=>once(text,'</cx:data>','<cx:unknownDim/></cx:data>')],
  ['unknown classic vector','ppt/charts/chart4.xml',text=>once(text,'</c:barChart>','<c:unknownVector/></c:barChart>')],
  ['classic cache format','ppt/charts/chart4.xml',text=>once(text,'<c:formatCode>General</c:formatCode>','<c:formatCode>0%</c:formatCode>')],
  ['classic missing cache format','ppt/charts/chart4.xml',text=>once(text,'<c:formatCode>General</c:formatCode>','')],
  ['native cache format','ppt/charts/chartEx2.xml',text=>once(text,'formatCode="General"','formatCode="0%"')],
  ['native missing cache format','ppt/charts/chartEx2.xml',text=>once(text,' formatCode="General"','')],
  ['unknown classic cache vector','ppt/charts/chart4.xml',text=>once(text,'</c:numCache>','<c:unknownVector/></c:numCache>')],
  ['unknown native level vector','ppt/charts/chartEx2.xml',text=>{const level=/<cx:lvl\b[^>]*>[\s\S]*?<\/cx:lvl>/u.exec(text)?.[0];assert.ok(level);return once(text,level,once(level,'</cx:lvl>','<cx:unknownVector/></cx:lvl>'));}],
  ['unknown classic point field','ppt/charts/chart4.xml',text=>once(text,'<c:pt idx="0"><c:v>42</c:v></c:pt>','<c:pt idx="0"><c:v>42</c:v><c:unknownVector/></c:pt>')],
  ['unknown native point field','ppt/charts/chartEx2.xml',text=>once(text,'<cx:pt idx="0">42</cx:pt>','<cx:pt idx="0">42<cx:unknownVector/></cx:pt>')],
 ]){
  const parts=deps.unzipSync(f.input);change(parts,file,edit);const before=zip(parts);
  assert.throws(()=>compareSevenNativeBefore({...f,before}),/whole-seven parsed data\/source roles|Unknown source-role field|Unknown native cache point field/u,name);
 }
 const source=deps.strFromU8(deps.unzipSync(f.input)['ppt/charts/chart4.xml']),series=/<c:ser>[\s\S]*?<\/c:ser>/u.exec(source)?.[0];assert.ok(series);
 const numeric=/<c:val>[\s\S]*?<\/c:val>/u.exec(series)?.[0];assert.ok(numeric);
 for(const field of ['c:xVal','c:yVal','c:bubbleSize']){
  const vector=numeric.replace('<c:val>','<'+field+'>').replace('</c:val>','</'+field+'>'),parts=deps.unzipSync(f.input);
  change(parts,'ppt/charts/chart4.xml',text=>once(text,series,once(series,'</c:ser>',vector+'</c:ser>')));
  assert.throws(()=>compareSevenNativeBefore({...f,before:zip(parts)}),new RegExp('Unknown source-role field '+field,'u'),'Unsupported complete nested '+field+' vector refuses even when cache/workbook agree');
 }
});
test('first-Save complete data comparison refuses coherent numeric changes in every other source slide',async()=>{
 const f=await fixture();
 for(let slideIndex=2;slideIndex<=7;slideIndex++){
  const parts=deps.unzipSync(f.input),shape=f.bound.archive.slides[slideIndex-1].shapes.find(s=>s.kind==='chart'&&s.chart.family==='classic'),bookPart=shape.chart.workbook.part;
  for(const slide of f.bound.archive.slides)for(const current of slide.shapes)if(current.kind==='chart'&&current.chart.workbook.part===bookPart)change(parts,current.chartPart,text=>current.chart.family==='classic'?once(text,'<c:pt idx="0"><c:v>42</c:v></c:pt>','<c:pt idx="0"><c:v>43</c:v></c:pt>'):once(text,'<cx:pt idx="0">42</cx:pt>','<cx:pt idx="0">43</cx:pt>'));
  const book=deps.unzipSync(parts[bookPart]);change(book,'xl/worksheets/sheet1.xml',text=>once(text,'<c r="B2"><v>42</v></c>','<c r="B2"><v>43</v></c>'));parts[bookPart]=deps.zipSync(book);
  assert.throws(()=>compareSevenNativeBefore({...f,before:zip(parts)}),undefined,'All branches of unselected slide'+slideIndex+' retain their complete data');
 }
});
test('edited/reopened incoherence, extra changes, diagnostics, unknown raw leaves and title/style changes refuse',async()=>{
 const f=await fixture();for(const phaseName of ['edited','reopened']){for(const mode of ['cache','workbook','style','title']){const parts=deps.unzipSync(f.edited);if(mode==='cache')change(parts,f.action.chartPart,t=>once(t,'<cx:pt idx="0">43</cx:pt>','<cx:pt idx="0">44</cx:pt>'));if(mode==='workbook'){const book=deps.unzipSync(parts[f.action.workbookPart]);change(book,'xl/worksheets/sheet1.xml',t=>once(t,'<c r="B2"><v>43</v></c>','<c r="B2"><v>44</v></c>'));parts[f.action.workbookPart]=deps.zipSync(book);}if(mode==='style')change(parts,f.action.chartPart,t=>t.replace('<cx:chartSpace ','<cx:chartSpace newStyle="foreign" '));if(mode==='title')change(parts,'ppt/slides/slide2.xml',t=>t.replace('</a:t>',' changed</a:t>'));assert.throws(()=>compareSevenNativeSnapshots({...f,[phaseName]:zip(parts)}),undefined,phaseName+'/'+mode);}}
 const imports=structuredClone(f.imports);imports.reopened.diagnostics.push({code:'foreign'});assert.throws(()=>compareSevenNativeSnapshots({...f,imports}),/diagnostics/);const model=structuredClone(f.bound.archive),chart=model.slides[0].shapes.find(s=>s.kind==='chart'&&s.branch==='choice');chart.chart.workbook.cells.find(c=>c.cell===f.action.workbookCells[0]).value=999;assert.throws(()=>snapshotNumericReadback(model,f.action),/disagree/);
});
test('real slide namespace-only rewrite stays scoped while all other archive bytes remain protected',async()=>{
 const f=await fixture(),parts=deps.unzipSync(f.input);let moves=0;
 for(const name of Object.keys(parts).filter(n=>/^ppt\/slides\/slide\d+\.xml$/u.test(n)))change(parts,name,t=>t.replace(/<mc:AlternateContent\b([^>]*)><mc:Choice\s+([^>]*?)>/gu,(all,parentAttributes,attrs)=>{assert.equal(parentAttributes,' xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"');const match=/\bxmlns:(cx[12])="([^"]+)"/u.exec(attrs);if(!match)return all;moves++;return '<mc:AlternateContent'+parentAttributes+' xmlns:'+match[1]+'="'+match[2]+'"><mc:Choice '+attrs.replace(match[0],'').trim()+'>';}));
 assert.ok(moves>0);const before=zip(parts),result=compareSevenNativeBefore({...f,before});assert.equal(result.sourceRawStyleQualification,'OPEN');assert.equal(result.rawFindings.qualification,'OPEN');assert.equal(result.rawFindings.changes.filter(row=>/^ppt\/slides\/slide[1-9][0-9]*\.xml$/u.test(row.part)).length,moves);
 const unknown=deps.unzipSync(before);change(unknown,'ppt/slides/slide1.xml',t=>t.replace('<mc:AlternateContent','<mc:AlternateContent unknown="changed"'));assert.throws(()=>assertSnapshotRawPreservation({...f,saved:zip(unknown),action:{...f.action,newValues:[...f.action.expectedValues]},archiveContext:f.bound.archiveContext}));
});
test('first native Save keeps all raw/package changes OPEN while complete public model and captured roles stay strict',async()=>{
 const f=await fixture(),parts=deps.unzipSync(f.input);parts['unreviewed-first-save.bin']=new Uint8Array([1,2,3]);change(parts,'[Content_Types].xml',text=>text+'<!-- retained first-save finding -->');
 const before=zip(parts),diagnostics=[],document=await fromPptx(before,{onDiagnostic:d=>diagnostics.push(d)}),imports={...f.imports,before:{document,diagnostics}};
 const result=compareSevenNativeBefore({...f,before,imports});assert.equal(result.sourcePublicModelVerified,true);assert.equal(result.nativeRoleBindingVerified,true);assert.equal(result.sourceRawStyleQualification,'OPEN');assert.equal(result.nativeAcceptance,false);assert.deepEqual(result.rawFindings.changes.map(row=>row.part),['[Content_Types].xml','unreviewed-first-save.bin']);
 const phases=structuredClone(f.phases);phases.original.slides[0].shapes[0].name='Unbound native title';assert.throws(()=>compareSevenNativeBefore({...f,before,imports,phases}),/native shape/);
 const changedImports=structuredClone(imports);changedImports.before.document.slides[2].title+=' changed';assert.throws(()=>compareSevenNativeBefore({...f,before,imports:changedImports}),/complete public import/);
});
test('first-Save workbook locator rebind is comparison-only and propagates through edit and reopen',async()=>{
 const f=await fixture(),old=f.action.workbookPart,next=path.posix.join(path.posix.dirname(old),'native-before.xlsx');
 function rename(bytes){const parts=deps.unzipSync(bytes);assert.ok(parts[old]);assert.equal(parts[next],undefined);parts[next]=parts[old];delete parts[old];let refs=0;for(const name of Object.keys(parts).filter(name=>name.endsWith('.rels')))change(parts,name,text=>text.replaceAll(path.posix.basename(old),()=>{refs++;return path.posix.basename(next);}));assert.ok(refs>0);return zip(parts);}
 const before=rename(f.input),edited=rename(f.edited),reopened=edited,imports={...f.imports};
 for(const [name,bytes]of [['before',before],['edited',edited],['reopened',reopened]]){const diagnostics=[],document=await fromPptx(bytes,{onDiagnostic:d=>diagnostics.push(d)});imports[name]={document,diagnostics};}
 const result=compareSevenNativeSnapshots({...f,before,edited,reopened,imports});assert.equal(result.baseline.archiveComparisonAction.workbookPart,next);assert.equal(f.action.workbookPart,old);assert.equal(f.action.inputSha256,digest(f.input));assert.deepEqual(result.archiveReadbacks.reopened.workbookValues,[43,31,-8,19]);assert.equal(result.baseline.sourceRawStyleQualification,'OPEN');
 const renamedAgain=deps.unzipSync(edited);renamedAgain[next+'.other']=renamedAgain[next];delete renamedAgain[next];assert.throws(()=>compareSevenNativeSnapshots({...f,before,edited:zip(renamedAgain),reopened,imports}));
});
test('first-Save native/fallback unsharing remains OPEN; later alias changes and wrong branch data refuse',async()=>{
 const f=await fixture(),parts=deps.unzipSync(f.input),nativeBook=path.posix.join(path.posix.dirname(f.action.workbookPart),'native-choice-before.xlsx'),chartRels=path.posix.join(path.posix.dirname(f.action.chartPart),'_rels',path.posix.basename(f.action.chartPart)+'.rels');
 assert.ok(parts[f.action.workbookPart]);assert.equal(parts[nativeBook],undefined);parts[nativeBook]=parts[f.action.workbookPart];change(parts,chartRels,text=>once(text,path.posix.basename(f.action.workbookPart),path.posix.basename(nativeBook)));
 const before=zip(parts),beforeBound=bindCurrentTreemap(before,f.source,f.selection),nativeAction=beforeBound.action;
 assert.notDeepEqual(sevenWorkbookAliasPartition(beforeBound.archive),sevenWorkbookAliasPartition(f.bound.archive));
 const editedParts=deps.unzipSync(before);change(editedParts,nativeAction.chartPart,text=>once(text,'<cx:pt idx="0">42</cx:pt>','<cx:pt idx="0">43</cx:pt>'));
 const book=deps.unzipSync(editedParts[nativeBook]);change(book,'xl/worksheets/sheet1.xml',text=>once(text,'<c r="B2"><v>42</v></c>','<c r="B2"><v>43</v></c>'));editedParts[nativeBook]=deps.zipSync(book);const edited=zip(editedParts),imports={...f.imports};
 for(const [name,bytes]of [['before',before],['edited',edited],['reopened',edited]]){const diagnostics=[],document=await fromPptx(bytes,{onDiagnostic:d=>diagnostics.push(d)});imports[name]={document,diagnostics};}
 const result=compareSevenNativeSnapshots({...f,before,edited,reopened:edited,imports});assert.equal(result.baseline.workbookSharing.qualification,'OPEN');assert.notDeepEqual(result.baseline.workbookSharing.before,result.baseline.workbookSharing.source);assert.equal(result.baseline.sourceRawStyleQualification,'OPEN');assert.equal(result.baseline.archiveComparisonAction.workbookPart,nativeBook);
 const fallbackBefore=beforeBound.archive.slides[0].shapes.find(shape=>shape.kind==='chart'&&shape.branch==='fallback'),fallbackAfter=inspectSevenArchive(edited,deps,f.bound.archiveContext).slides[0].shapes.find(shape=>shape.kind==='chart'&&shape.branch==='fallback');assert.deepEqual(fallbackAfter,fallbackBefore,'Separately owned fallback stays an unchanged snapshot; no cross-app update promise');
 assert.deepEqual(imports.edited.document.slides[0].chart.data.rows.map(row=>row[1]),[43,31,-8,19]);
 const sharedAgain=deps.unzipSync(edited);change(sharedAgain,chartRels,text=>once(text,path.posix.basename(nativeBook),path.posix.basename(f.action.workbookPart)));const mergedBook=deps.unzipSync(sharedAgain[f.action.workbookPart]);change(mergedBook,'xl/worksheets/sheet1.xml',text=>once(text,'<c r="B2"><v>42</v></c>','<c r="B2"><v>43</v></c>'));sharedAgain[f.action.workbookPart]=deps.zipSync(mergedBook);change(sharedAgain,fallbackBefore.chartPart,text=>once(text,'<c:pt idx="0"><c:v>42</c:v></c:pt>','<c:pt idx="0"><c:v>43</c:v></c:pt>'));assert.throws(()=>compareSevenNativeSnapshots({...f,before,edited:zip(sharedAgain),reopened:edited,imports}),/sharing classes/);
 const wrongBranch=deps.unzipSync(before),badBook=deps.unzipSync(wrongBranch[f.action.workbookPart]);change(badBook,'xl/worksheets/sheet1.xml',text=>once(text,'<c r="B2"><v>42</v></c>','<c r="B2"><v>99</v></c>'));wrongBranch[f.action.workbookPart]=deps.zipSync(badBook);change(wrongBranch,fallbackBefore.chartPart,text=>once(text,'<c:pt idx="0"><c:v>42</c:v></c:pt>','<c:pt idx="0"><c:v>99</c:v></c:pt>'));const wrongBytes=zip(wrongBranch),diagnostics=[],document=await fromPptx(wrongBytes,{onDiagnostic:d=>diagnostics.push(d)});assert.throws(()=>compareSevenNativeBefore({...f,before:wrongBytes,imports:{...imports,before:{document,diagnostics}}}),/whole-seven parsed data\/source roles/,'Every branch independently resolves its actual cache/workbook data');
});
const coreChange=(parts,field,value)=>change(parts,'docProps/core.xml',text=>{const expression=new RegExp('(<'+field+'(?:\\s[^<>]*?)?>)[\\s\\S]*?(</'+field+'>)','u');assert.ok(expression.test(text));return text.replace(expression,(_all,a,b)=>a+value+b);});
test('later saves record ONLY valid modified and lastModifiedBy values, preserving actual raw evidence',async()=>{
 const f=await fixture(),parts=deps.unzipSync(f.edited);coreChange(parts,'dcterms:modified','2026-11-12T00:00:01Z');coreChange(parts,'cp:lastModifiedBy','Managed modifier');const edited=zip(parts);coreChange(parts,'dcterms:modified','2026-11-12T00:00:02Z');const reopened=zip(parts),imports={...f.imports};
 for(const [name,bytes]of [['edited',edited],['reopened',reopened]]){const diagnostics=[],document=await fromPptx(bytes,{onDiagnostic:d=>diagnostics.push(d)});imports[name]={document,diagnostics};}
 const result=compareSevenNativeSnapshots({...f,edited,reopened,imports}),core=result.rawReopened.metadata.find(row=>row.part==='docProps/core.xml');assert.equal(core.recorded['dcterms:modified'].before.value,'2026-11-12T00:00:01Z');assert.equal(core.recorded['dcterms:modified'].after.value,'2026-11-12T00:00:02Z');assert.match(core.recorded['cp:lastModifiedBy'].after.raw,/>Managed modifier</);
});
test('later metadata/package changes outside the two closed scalar fields refuse',async()=>{
 const f=await fixture();
 const guard=(input,saved)=>assertSnapshotRawPreservation({...f,input,saved,action:{...f.action,newValues:[...f.action.expectedValues]},archiveContext:f.bound.archiveContext});
 for(const [label,file,edit]of [
  ['author','docProps/core.xml',text=>text.replace(/<dc:creator>[\s\S]*?<\/dc:creator>/u,'<dc:creator>Changed author</dc:creator>')],
  ['title','docProps/core.xml',text=>text.replace(/<dc:title>[\s\S]*?<\/dc:title>/u,'<dc:title>Changed title</dc:title>')],
  ['unknown','docProps/core.xml',text=>text.replace('</cp:coreProperties>','<cp:unknown>unreviewed</cp:unknown></cp:coreProperties>')],
  ['comment','docProps/core.xml',text=>text.replace('</cp:coreProperties>','<!-- unreviewed --></cp:coreProperties>')],
  ...['Company','Application','Words','Paragraphs','Notes','PresentationFormat','HeadingPairs','TitlesOfParts'].map(field=>[field,'docProps/app.xml',text=>{const expression=new RegExp('(<'+field+'(?:\\s[^<>]*?)?>)[\\s\\S]*?(</'+field+'>)','u');assert.ok(expression.test(text));return text.replace(expression,(_all,a,b)=>a+'changed'+b);}]),
  ['types','[Content_Types].xml',text=>text+'<!-- unreviewed -->'],['root-rels','_rels/.rels',text=>text+'<!-- unreviewed -->'],
 ]){const parts=deps.unzipSync(f.input);change(parts,file,text=>{const updated=edit(text);assert.notEqual(updated,text,label);return updated;});assert.throws(()=>guard(f.input,zip(parts)),undefined,label);}
 for(const value of ['not-a-time','2026-02-30T00:00:00Z','<cp:unknown/>']){const parts=deps.unzipSync(f.input);coreChange(parts,'dcterms:modified',value);assert.throws(()=>guard(f.input,zip(parts)),undefined,value);}
 const parts=deps.unzipSync(f.input);coreChange(parts,'cp:lastModifiedBy','<cp:unknown/>');assert.throws(()=>guard(f.input,zip(parts)),/Scalar core/);
 const baseline=deps.unzipSync(f.input);change(baseline,'docProps/core.xml',text=>text.replace('</cp:coreProperties>','<cp:unknown xml:space="preserve"> x </cp:unknown></cp:coreProperties>'));const preserved=zip(baseline);change(baseline,'docProps/core.xml',text=>text.replace('> x <','>x<'));assert.throws(()=>guard(preserved,zip(baseline)),/metadata difference/);
 const unknown=deps.unzipSync(f.input);unknown['docProps/custom.xml']=deps.strToU8('<unknown> x </unknown>');const original=zip(unknown);unknown['docProps/custom.xml']=deps.strToU8('<unknown>x</unknown>');assert.throws(()=>guard(original,zip(unknown)),/package part changed/);
 const indent=deps.unzipSync(f.input);change(indent,'docProps/app.xml',text=>text.replace(/(<Properties\b[^>]*>)([\s\S]*)(<\/Properties>)/u,(_all,start,body,end)=>start+body.replaceAll('><','>\n<')+end));assert.ok(guard(f.input,zip(indent)).metadata.length===2);
});
test('snapshot wrapper applies the maintained decompression limits before any unbounded scan',async()=>{
 const f=await fixture(),bomb=zip({'oversized.xml':new Uint8Array(8*1024*1024+1)}),calls=[],checked={...deps,unzipSync(input,options){calls.push(!!options?.filter);return deps.unzipSync(input,options);}};assert.throws(()=>assertSnapshotRawPreservation({...f,input:bomb,saved:f.input,deps:checked,archiveContext:f.bound.archiveContext}),/expansion bound/);assert.deepEqual(calls,[true]);
 const parts=deps.unzipSync(f.input);change(parts,'[Content_Types].xml',t=>t+'<!-- unreviewed native package rewrite -->');assert.throws(()=>assertSnapshotRawPreservation({...f,saved:zip(parts),action:{...f.action,newValues:[...f.action.expectedValues]},archiveContext:f.bound.archiveContext}),/package part|XML/);
});
test('exact lifecycle grammar is 2 opens, 3 actual copies, 2 closes, one setter, one Quit and zero getter',async()=>{
 const f=await fixture(),report={phases:f.phases,sourcePath:'original',snapshots:{edited:{path:'edited'}}},names=snapshotOperations(report,f.action),old=sevenExpectedOperations(report);assert.deepEqual(snapshotBeforeOperations(report),names.slice(0,names.indexOf('archive.before.check')));assert.deepEqual(snapshotBeforeOperations(report).filter(n=>!n.startsWith('archive.')&&n!=='preflight.globalIdle'),old.slice(0,old.indexOf('copy.fullName')));assert.equal(names.filter(n=>n.endsWith('.open')).length,2);assert.equal(names.filter(n=>n.endsWith('.saveCopyAs')).length,3);assert.equal(names.filter(n=>n.endsWith('.close')).length,2);assert.equal(names.filter(n=>n==='snapshot.series.values.set').length,1);assert.equal(names.filter(n=>n==='application.quit').length,1);assert.ok(!names.some(n=>/values\.get/i.test(n)));const proofs=snapshotCriticalProbes(report,f.action);assert.equal(proofs.length,53);assert.ok(proofs.every(p=>p.matched));assert.deepEqual(proofs.filter(p=>p.stage.endsWith('.readOnly')||p.stage.endsWith('.hasChart')).map(p=>p.expected),Array(9).fill(-1));
});
// Synthetic completion records test the new private adapter AFTER its external
// source/data/import reader boundary. They cannot qualify that reader or Office.
function snapshotBridgeFixture(output) {
 const f=syntheticValueControl(path.join(output,'bridge-fixture')),e=f.evidence,q=e.request,r=e.report;
 q.profile=SNAPSHOT_PROFILE;q.policy=structuredClone(SNAPSHOT_POLICY);q.selectedCase.representation='native-treemap-choice; setter-and-three-native-archives';
 r.schemaVersion=4;r.profile=SNAPSHOT_PROFILE;r.saveCopies=3;r.snapshots={};
 for(const phase of ['before','edited','reopened']){const file=path.join(q.nativeRoot,phase+'.pptx');fs.writeFileSync(file,'SYNTHETIC INERT '+phase+'; NOT A PPTX',{flag:'wx'});r.snapshots[phase]={path:file,sha256:fileIdentity(file).sha256};}
 r.opens[1].path=r.snapshots.edited.path;r.opens[1].sha256=r.snapshots.edited.sha256;
 r.actions=[{op:q.selectedCase.action.op,actionModelSha256:q.selectedCase.actionModelSha256,actionFileIdentity:q.selectedCase.actionFileIdentity,status:'success',setterAttempts:1}];
 r.probes=snapshotCriticalProbes(r,q.selectedCase.action);
 const values=name=>['preflight.globalIdle','application.initial.count','original.preflight.count','saved-reopened.preflight.count','application.final.count'].includes(name)?0:null;
 e.stages=snapshotOperations(r,q.selectedCase.action).flatMap(stage=>stage.startsWith('worker.')?[{stage,status:'success'}]:[{stage,status:'begin'},{stage,status:'success'}]).map((row,index)=>({...row,sequence:index+1,timestamp:'2000-01-01T00:00:00.000Z',value:row.status==='success'?values(row.stage):null,error:'',officeOperationsStopped:false,cleanupConfirmed:row.stage.startsWith('worker.')}));
 e.admission.profile=SNAPSHOT_PROFILE;e.admission.policy=structuredClone(SNAPSHOT_POLICY);e.admission.ready={workerCleanupConfirmed:true,stageCount:e.stages.length,lifecycle:e.stages.filter(s=>s.status==='success').map(s=>({stage:s.stage,sequence:s.sequence})),opens:2,saves:3,closes:2,edits:1,quits:1};
 const fixture=path.join(output,'snapshot-bridge.json');fs.writeFileSync(fixture,JSON.stringify({synthetic:true,nativeAcceptance:false,controllerRoot:ROOT,root:f.root,admissionFile:f.admissionFile,evidence:e},null,2)+'\n',{flag:'wx'});return fixture;
}
test('actual PS5 AST-only setter plus real snapshot typed-adapter controls never call Values getter or Office',{skip:process.platform!=='win32'},async()=>{
 const f=await fixture(),output=fs.mkdtempSync(path.join(os.tmpdir(),'opf-snapshot-managed-')),actionFile=path.join(output,'action.json'),wire=Buffer.from(JSON.stringify(f.action,null,2)+'\n');fs.writeFileSync(actionFile,wire,{flag:'wx'});
 const bridge=snapshotBridgeFixture(output),shell=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
 const result=spawnSync(shell,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(ROOT,'scripts/native-acceptance/seven-value-snapshot-check.ps1'),'-Root',ROOT,'-ActionFile',actionFile,'-ActionModelSha256',digest(Buffer.from(JSON.stringify(f.action))),'-ActionFileSha256',digest(wire),'-ActionFileBytes',String(wire.length),'-FixtureFile',bridge,'-Output',path.join(output,'managed')],{env:windowsPowerShellEnvironment(process.env),timeout:60000,encoding:'utf8',maxBuffer:4*1024*1024});
 fs.writeFileSync(path.join(output,'stdout.log'),result.stdout??'');fs.writeFileSync(path.join(output,'stderr.log'),result.stderr??'');assert.equal(result.error,undefined,output);assert.equal(result.status,0,JSON.stringify({output,stdout:result.stdout,stderr:result.stderr}));
 const receipt=JSON.parse(fs.readFileSync(path.join(output,'managed/result.json'),'utf8').replace(/^\uFEFF/u,''));assert.equal(receipt.officeInvoked,false);assert.equal(receipt.realProcessQueries,0);assert.equal(receipt.officeActions,0);assert.ok(receipt.rows.length>10);assert.ok(receipt.rows.every(r=>r.getterCalls===0));
 const names=['complete-first-zero','foreign-profile','foreign-request-profile','foreign-policy','failed-worker','timed-out','pending-worker','cleanup-false','stopped','missing-stage','duplicate-stage','reordered-stage','stage-gap','stage-error','nonzero-preflight','wrong-model','wrong-wire','second-setter','missing-snapshot','foreign-snapshot','snapshot-hash','identity-bytes','identity-hash','reader-wire-pin','reader-file-identity'];
 assert.deepEqual(receipt.bridge.map(row=>row.name),names);assert.ok(receipt.bridge.every(row=>row.passed===true&&row.realProcessQueries===0&&row.officeActions===0));
 assert.equal(receipt.bridge[0].mockProcessQueries,1);assert.equal(receipt.bridge[0].observedRows,1);assert.ok(receipt.bridge.slice(1).every(row=>row.mockProcessQueries===0&&row.observedRows===0));
});
