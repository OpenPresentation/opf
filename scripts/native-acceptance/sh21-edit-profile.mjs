// Prospective closed diagnostic route. No Office/process enumeration in Node.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {digest,fileIdentity,repositoryIdentity,installedIdentity} from './identity.mjs';
import {SH21_PROFILE,SH21_REVISION,SH21_MANIFEST,SH21_CASES,sh21Plan,assertSh21Plan,readSh21HistoricalInput,assertSh21NodeRows} from './sh21-edit-contract.mjs';
import {OWNED_POSTFLIGHT_POLICY,OWNED_SHARED_FILES,ownedControllerFiles,canonicalOwnedPath,readOwnedFile,readOwnedJson,assertOwnedKeys,assertOwnedStageWire,assertOwnedOperations,assertOwnedKernel,makeOwnedAdmission,writeOwnedAdmission,sourceIdentityFiles,assertOwnedPostflightArtifacts} from './owned-postflight.mjs';
import {sevenValueLibraries} from './seven-value-libraries.mjs';

const ROOT=fs.realpathSync(fileURLToPath(new URL('../../',import.meta.url)));
export const SH21_POLICY=Object.freeze({policy:'sh21-node-text-bounded-global-zero-after-completed-owned-quit-v1',...OWNED_POSTFLIGHT_POLICY});
const prefix='scripts/native-acceptance/';
const entries=['sh21-edit-profile.mjs','sh21-edit-contract.mjs','sh21-edit-actions.ps1','sh21-edit-bootstrap.ps1','sh21-edit-worker.ps1','run-sh21-edit-profile.ps1','sh21-edit-postflight.ps1','sh21-edit-profile.test.mjs','sh21-edit-self-test.ps1','seven-chart-worker.ps1','seven-value-bootstrap.ps1'].map(n=>prefix+n);
const SUPERVISOR={bytes:2341,sha256:'b9444de1367fe3a3aab654f4787b5aa9a1304dc38360159a45d1f9f420adf69c'};
const FILES=()=>ownedControllerFiles(ROOT,[...entries,...OWNED_SHARED_FILES,'packages/pptx/test/native-process.ps1']);
const json=v=>Buffer.from(JSON.stringify(v,null,2)+'\n');
const at=(root,name)=>canonicalOwnedPath(path.join(root,name));
const write=(file,data)=>fs.writeFileSync(canonicalOwnedPath(file),data,{flag:'wx'});
function nodeIdentity(){assert.match(process.version,/^v24\./u);assert.equal(process.env.NODE_OPTIONS,undefined);assert.equal(process.env.NODE_PATH,undefined);assert.deepEqual(process.execArgv,[]);return{path:fs.realpathSync(process.execPath),version:process.version,identity:fileIdentity(process.execPath)};}
export function createSh21Envelope({caseId,consumer}){
 const historical=readSh21HistoricalInput(ROOT,caseId),controller=repositoryIdentity(ROOT,FILES());assert.equal(controller.dirty,false);
 return{schemaVersion:1,profile:SH21_PROFILE,policy:SH21_POLICY,historical:{revision:SH21_REVISION,manifest:SH21_MANIFEST,scope:'Historical diagnostic live input; current production live domains remain off'},plan:historical.plan,controller,node:nodeIdentity(),installed:installedIdentity(consumer),libraries:sevenValueLibraries(),nativeAcceptance:false,registryAcceptance:false};
}
export function bindSh21Envelope(file,sha){
 const bytes=readOwnedFile(file,4194304);assert.equal(digest(bytes),sha);const e=JSON.parse(bytes);
 assertOwnedKeys(e,['schemaVersion','profile','policy','historical','plan','controller','node','installed','libraries','nativeAcceptance','registryAcceptance']);
 assert.equal(e.schemaVersion,1);assert.equal(e.profile,SH21_PROFILE);assert.equal(e.nativeAcceptance,false);assert.equal(e.registryAcceptance,false);assert.deepEqual(e.policy,SH21_POLICY);assertSh21Plan(e.plan);
 assert.deepEqual(e.historical,{revision:SH21_REVISION,manifest:SH21_MANIFEST,scope:'Historical diagnostic live input; current production live domains remain off'});
 assert.deepEqual(e.controller,repositoryIdentity(ROOT,FILES()));assert.equal(e.controller.dirty,false);assert.deepEqual(e.node,nodeIdentity());assert.deepEqual(e.installed,installedIdentity(e.installed.consumer));assert.deepEqual(e.libraries,sevenValueLibraries());
 assert.deepEqual(fileIdentity(at(ROOT,'packages/pptx/test/native-process.ps1')),SUPERVISOR);assert.equal(fileIdentity(at(ROOT,SH21_POLICY.observerSource)).sha256,SH21_POLICY.observerSourceSha256);
 return{envelope:e,envelopeSha256:sha,envelopeBytes:bytes,...readSh21HistoricalInput(ROOT,e.plan.caseId)};
}
function outputPath(output,e){canonicalOwnedPath(output);for(const root of [ROOT,e.installed.consumer,...e.installed.packages.map(p=>p.directory)]){assert.ok(output!==root&&!output.startsWith(root+path.sep)&&!root.startsWith(output+path.sep),'Output overlaps bound runtime/source');}return output;}
function expectedRequest(b,output,timeoutSeconds,office){
 assert.ok(Number.isInteger(timeoutSeconds)&&timeoutSeconds>=5&&timeoutSeconds<=60);assert.equal(typeof office,'boolean');
 const snapshots=[{path:'execution-envelope.json',bytes:b.envelopeBytes.length,sha256:b.envelopeSha256},{path:'inputs/case.pptx',bytes:b.bytes.length,sha256:digest(b.bytes)},{path:'inputs/plan.json',bytes:json(b.plan).length,sha256:digest(json(b.plan))},...['sh21-edit-worker.ps1'].map(n=>({path:'inputs/'+n,...fileIdentity(at(ROOT,prefix+n))})),{path:'inputs/native-process.ps1',...SUPERVISOR}];
 return{schemaVersion:1,profile:SH21_PROFILE,policy:SH21_POLICY,envelopeSha256:b.envelopeSha256,output,timeoutSeconds,runOfficeRequested:office,plan:b.plan,planModelSha256:digest(JSON.stringify(b.plan)),planFileIdentity:{bytes:json(b.plan).length,sha256:digest(json(b.plan))},node:b.envelope.node,controller:b.envelope.controller,snapshots,workerPath:at(output,'inputs/sh21-edit-worker.ps1'),nativeRoot:at(output,'native'),nativeAcceptance:false,registryAcceptance:false};
}
export function prepareSh21(file,sha,output,{timeoutSeconds=45,runOfficeRequested=false}={}){
 const b=bindSh21Envelope(file,sha);outputPath(output,b.envelope);assert.equal(fs.existsSync(output),false);const q=expectedRequest(b,output,timeoutSeconds,runOfficeRequested);fs.mkdirSync(output);fs.mkdirSync(at(output,'inputs'));
 for(const [name,data]of [['execution-envelope.json',b.envelopeBytes],['inputs/case.pptx',b.bytes],['inputs/plan.json',json(b.plan)],['inputs/sh21-edit-worker.ps1',readOwnedFile(at(ROOT,prefix+'sh21-edit-worker.ps1'))],['inputs/native-process.ps1',readOwnedFile(at(ROOT,'packages/pptx/test/native-process.ps1'))],['execution-request.json',json(q)]])write(at(output,name),data);
 verifySh21(file,sha,output,runOfficeRequested);return{profile:SH21_PROFILE,output,requestSha256:digest(json(q)),nativeAcceptance:false};
}
export function verifySh21(file,sha,output,office){
 const b=bindSh21Envelope(file,sha);outputPath(output,b.envelope);const q=readOwnedJson(at(output,'execution-request.json'));assert.deepEqual(q,expectedRequest(b,output,q.timeoutSeconds,office));
 for(const record of q.snapshots)assert.deepEqual(fileIdentity(at(output,record.path)),{bytes:record.bytes,sha256:record.sha256});assert.deepEqual(readOwnedFile(at(output,'inputs/case.pptx')),b.bytes);assert.deepEqual(readOwnedFile(at(output,'inputs/plan.json')),json(b.plan));
 return{...b,request:q,requestSha256:fileIdentity(at(output,'execution-request.json')).sha256,output};
}
const owner=p=>[p+'.fullName',p+'.readOnly'];
function target(p){return[...owner(p+'.owner'),p+'.slides',p+'.slides.count',p+'.slide.get',p+'.shapes',p+'.shapes.count',...[1,2].flatMap(i=>[p+'.shape.'+i+'.get',p+'.shape.'+i+'.id',p+'.shape.'+i+'.name']),p+'.hasSmartArt',p+'.smartArt',p+'.layout',p+'.layout.id',...owner(p+'.finalOwner')];}
function capture(phase,rows,items){
 const names=[...owner(phase+'.capture.owner'),phase+'.export',...owner(phase+'.owner'),phase+'.nodes',phase+'.nodes.count'];
 for(const r of rows){const p=phase+'.node.'+r.index;names.push(...['get','frame','range','text','level','type','children','children.count'].map(s=>p+'.'+s));if(r.level>1)names.push(...['parent','parent.frame','parent.range','parent.text'].map(s=>p+'.'+s));}
 names.push(...owner(phase+'.finalOwner'),...['Left','Top','Width','Height'].map(s=>phase+'.frame.'+s),phase+'.group',phase+'.group.count');
 assert.ok(Array.isArray(items)&&items.length>=1&&items.length<=32);
 for(const [index,item]of items.entries()){const p=phase+'.item.'+(index+1);names.push(p+'.get',...['Left','Top','Width','Height','Rotation','Type','HasTextFrame'].map(s=>p+'.'+s));assert.ok([-1,0].includes(item.HasTextFrame));if(item.HasTextFrame===-1)names.push(...['frame','range','text','font','font.size'].map(s=>p+'.'+s));}
 return[...names,...owner(phase+'.capture.finalOwner')];
}
export function sh21Operations(report,plan){
 const open=p=>[p+'.preflight.presentations',p+'.preflight.count',p+'.open',p+'.fullName',p+'.readOnly'];
 const close=p=>[p+'.close.fullName',p+'.close.discard',p+'.close'];
 const edit=['edit.nodes','edit.node2','edit.node2.frame','edit.node2.range',...owner('edit.text.owner'),'edit.existingText.set',...owner('edit.text.afterOwner'),'edit.node3',...owner('edit.add.owner'),'edit.node.add',...owner('edit.add.afterOwner'),'edit.new.frame','edit.new.range',...owner('edit.newText.owner'),'edit.newText.set'];
 return['worker.initialize','preflight.globalIdle','application.create','application.initial.presentations','application.initial.count','application.version','application.path',...open('original'),...target('original.target'),...capture('original',plan.before,report.phases.original.items),...edit,...capture('edited',plan.after,report.phases.edited.items),'copy.fullName','copy.saveCopyAs','copy.afterName',...close('original'),...open('saved-reopened'),...target('saved-reopened.target'),...capture('saved-reopened',plan.after,report.phases['saved-reopened'].items),...close('saved-reopened'),'application.final.presentations','application.final.count','application.quit','worker.complete'];
}
export function assertSh21Ready(terminal,r,q,stages){
 assert.equal(q.profile,SH21_PROFILE);assertSh21Plan(q.plan);assert.deepEqual(q.policy,SH21_POLICY);assert.equal(q.runOfficeRequested,true);assert.equal(q.nativeAcceptance,false);assert.equal(q.registryAcceptance,false);
 assertOwnedKernel(terminal,q.timeoutSeconds);assert.equal(r.error,null);assert.equal(r.cleanupConfirmed,true);assert.equal(r.officeOperationsStopped,false);assert.equal(r.lastStage,'worker.complete');assert.equal(r.lastStatus,'success');assert.equal(r.profile,SH21_PROFILE);assert.equal(r.requestSha256,digest(json(q)));assert.equal(r.envelopeSha256,q.envelopeSha256);assert.equal(r.sourcePath,at(q.output,'inputs/case.pptx'));assert.equal(r.savedPath,at(q.output,'native/saved.pptx'));assert.equal(r.sourceSha256,q.plan.inputSha256);
 assert.equal(r.closes,2);assert.equal(r.saveCopies,1);assert.equal(r.quits,1);assert.deepEqual(r.actions,[{status:'success',textSetterAttempts:1,addNodeAttempts:1,newTextSetterAttempts:1}]);assert.equal(r.opens.length,2);
 for(const [i,phase]of ['original','saved-reopened'].entries())assert.deepEqual(r.opens[i],{phase,path:i?r.savedPath:r.sourcePath,readOnly:-1,sha256:i?r.savedSha256:r.sourceSha256});
 assert.deepEqual(Object.keys(r.phases),['original','edited','saved-reopened']);
 for(const phase of ['original','edited','saved-reopened'])assertSh21NodeRows(r.phases[phase].nodes,q.plan,phase!=='original');
 assertOwnedOperations(stages,sh21Operations(r,q.plan));
 const success=new Map(stages.filter(s=>s.status==='success').map(s=>[s.stage,s]));
 for(const row of stages)assert.ok(!Object.hasOwn(row,'ownedPresentationPath')||row.ownedPresentationPath===null||row.ownedPresentationPath===r.sourcePath||row.ownedPresentationPath===r.savedPath);
 assert.equal(success.get('preflight.globalIdle').value,0);assert.equal(success.get('application.initial.count').value,0);assert.equal(success.get('application.final.count').value,0);assert.equal(success.get('worker.complete').cleanupConfirmed,true);
 assert.ok(Array.isArray(r.probes)&&r.probes.length>0);for(const p of r.probes){assertOwnedKeys(p,['stage','expected','actual','matched']);assert.equal(p.matched,true);}
 // Critical ownership proofs are emitted at every target/read/setter boundary.
 const prefixes=['original.target.owner','original.target.finalOwner','original.capture.owner','original.owner','original.finalOwner','original.capture.finalOwner','edit.text.owner','edit.text.afterOwner','edit.add.owner','edit.add.afterOwner','edit.newText.owner','edited.capture.owner','edited.owner','edited.finalOwner','edited.capture.finalOwner','saved-reopened.target.owner','saved-reopened.target.finalOwner','saved-reopened.capture.owner','saved-reopened.owner','saved-reopened.finalOwner','saved-reopened.capture.finalOwner'];
 for(const p of prefixes){const file=p.startsWith('saved-reopened')?r.savedPath:r.sourcePath;const expected=[['ownership','same verified owned application/presentation references',true],['capturedRefs',true,true],['fullName.refs',true,true],['fullName',file,file],['readOnly.refs',true,true],['readOnly',-1,-1]];for(const [s,e,a]of expected){const actual=r.probes.filter(row=>row.stage===p+'.'+s);assert.deepEqual(actual,[{stage:p+'.'+s,expected:e,actual:a,matched:true}]);}assert.equal(success.get(p+'.fullName').value,file);assert.equal(success.get(p+'.readOnly').value,-1);}
 for(const phase of ['original','edited','saved-reopened']){const state=r.phases[phase];for(const node of state.nodes){for(const name of ['text','level','type','children.count'])assert.deepEqual(success.get(phase+'.node.'+node.index+'.'+name).value,node[name==='children.count'?'children':name]);if(node.level>1)assert.equal(success.get(phase+'.node.'+node.index+'.parent.text').value,node.parent);}}
 for(const phase of ['original','edited','saved-reopened']){const state=r.phases[phase];assert.equal(success.get(phase+'.nodes.count').value,state.nodes.length);assert.equal(success.get(phase+'.group.count').value,state.items.length);for(const name of ['Left','Top','Width','Height']){assert.ok(Number.isFinite(state.frame[name]));assert.equal(success.get(phase+'.frame.'+name).value,state.frame[name]);}for(const [i,item]of state.items.entries()){assert.equal(item.index,i+1);for(const name of ['Left','Top','Width','Height','Rotation','Type','HasTextFrame']){assert.ok(Number.isFinite(item[name]));assert.equal(success.get(phase+'.item.'+(i+1)+'.'+name).value,item[name]);}if(item.HasTextFrame===-1){assert.equal(typeof item.text,'string');assert.equal(success.get(phase+'.item.'+(i+1)+'.text').value,item.text);assert.ok(Number.isFinite(item.fontSize));assert.equal(success.get(phase+'.item.'+(i+1)+'.font.size').value,item.fontSize);}else{assert.equal(item.text,null);assert.equal(item.fontSize,null);}}}
 return{workerCleanupConfirmed:true,stageCount:stages.length,lifecycle:stages.filter(s=>s.status==='success').map(({stage,sequence})=>({stage,sequence})),opens:2,saves:1,closes:2,textSetters:2,nodeAdds:1,quits:1};
}
// The current installed public importer must carry native edits; metadata from
// the original historical archive is never restored by this controller.
async function publicImport(bytes,consumer){const req=createRequire(path.join(consumer,'package.json'));const pptx=await import(pathToFileURL(req.resolve('@openpresentation/opf-pptx')).href),{gallery}=await import(pathToFileURL(req.resolve('@openpresentation/gallery')).href);assert.equal(typeof gallery.source,'string');const diagnostics=[];const document=await pptx.fromPptx(bytes,{catalogs:[gallery],onDiagnostic:d=>diagnostics.push(d)});return{document,diagnostics};}
async function archiveView(bytes,consumer){
 const req=createRequire(path.join(consumer,'package.json')),peer=createRequire(req.resolve('@openpresentation/opf-pptx/package.json'));const {unzipSync,strFromU8}=await import(pathToFileURL(peer.resolve('fflate')).href),{XMLParser}=await import(pathToFileURL(peer.resolve('fast-xml-parser')).href);let total=0,count=0;const seen=new Set();assert.ok(bytes.length>0&&bytes.length<=16777216);const zip=unzipSync(bytes,{filter(entry){const name=entry.name.replace(/\/$/u,'');assert.ok(name&&!name.startsWith('/')&&!/[\\:]/u.test(name)&&![...name].some(c=>c.charCodeAt(0)<32)&&!name.split('/').some(p=>!p||p==='.'||p==='..'));assert.equal(seen.has(entry.name.toLowerCase()),false);seen.add(entry.name.toLowerCase());assert.ok(++count<=4096&&entry.originalSize<=8388608);total+=entry.originalSize;assert.ok(total<=67108864);return true;}});for(const [name,data]of Object.entries(zip))if(/\.(?:xml|rels)$/u.test(name)){const text=strFromU8(data);assert.ok(!text.includes('<!DOCTYPE')&&!text.includes('<!ENTITY'),'DTD/entities not admitted');}const parse=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',parseTagValue:false,trimValues:false});
 const name=Object.keys(zip).filter(n=>/^ppt\/diagrams\/data\d+\.xml$/u.test(n));assert.equal(name.length,1);const raw=parse.parse(strFromU8(zip[name[0]])),model=raw['dgm:dataModel'];assert.ok(model);const arr=v=>v===undefined?[]:Array.isArray(v)?v:[v],points=arr(model['dgm:ptLst']?.['dgm:pt']),connections=arr(model['dgm:cxnLst']?.['dgm:cxn']),doc=points.filter(p=>p['@_type']==='doc');assert.equal(doc.length,1);const data=points.filter(p=>p['@_type']===undefined||p['@_type']==='node');assert.ok([3,4].includes(data.length));assert.equal(new Set(points.map(p=>p['@_modelId'])).size,points.length);
 const ordered=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',preserveOrder:true,parseTagValue:false,trimValues:false}),orderedModel=ordered.parse(strFromU8(zip[name[0]]));const orderedPoints=[];function collect(nodes){for(const n of nodes??[])for(const [tag,kids]of Object.entries(n)){if(tag==='dgm:pt')orderedPoints.push(n);else if(Array.isArray(kids))collect(kids);}}collect(orderedModel);
 function text(p){return arr(p['dgm:t']?.['a:p']).map(par=>arr(par['a:r']).map(r=>typeof r['a:t']==='string'?r['a:t']:r['a:t']?.['#text']??'').join('')).join('\n');}
 const result=[];const walk=(parent,level)=>{const edges=connections.filter(c=>(c['@_type']??'parOf')==='parOf'&&c['@_srcId']===parent).sort((a,b)=>Number(a['@_srcOrd'])-Number(b['@_srcOrd']));assert.equal(new Set(edges.map(c=>c['@_srcOrd'])).size,edges.length);for(const e of edges){const node=data.find(p=>p['@_modelId']===e['@_destId']);assert.ok(node);assert.ok(!result.some(r=>r.id===node['@_modelId']),'Graph cycle/duplicate');result.push({id:node['@_modelId'],text:text(node),level,parent:level===1?null:text(data.find(p=>p['@_modelId']===parent))});walk(node['@_modelId'],level+1);}};walk(doc[0]['@_modelId'],1);assert.equal(result.length,data.length);
 return{zip,parse,ordered,orderedPoints,points:data,nodes:result,layout:doc[0]['dgm:prSet']?.['@_loTypeId']};
}
// Original import admission is intentionally independent of tag restoration:
// both a plain root and an explicit level-zero root carry the same outline.
// No edited archive is generated or used to establish this source prerequisite.
export function assertSh21OriginalOutline(document,plan){
 assertSh21Plan(plan);assert.ok(document&&Array.isArray(document.slides)&&document.slides.length===1);
 const candidates=[],record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 // Closed semantic payload paths from core/content-walk.ts and ContentPayload:
 // root items, group blocks, and the48 slide-only promoted grid regions. Never
 // recurse through arbitrary data/extensions/metadata or through a list item.
 const columns=['start','center','end','start+center','center+end','start+center+end'],rows=['top','middle','bottom','top+middle','middle+bottom','top+middle+bottom'];
 const promoted=[...columns,...rows,...rows.flatMap(row=>columns.map(column=>row+':'+column))];
 function payload(value,parts,depth=0,ancestors=[]){if(!record(value))return;assert.ok(depth<=32&&!ancestors.includes(value),'Bounded acyclic semantic content required');
  if((value.type===undefined||value.type==='list')&&Array.isArray(value.items))candidates.push({parts:[...parts,'items'],items:value.items});
  if((value.type===undefined||value.type==='group')&&Array.isArray(value.blocks))for(const [index,block]of value.blocks.entries())payload(block,[...parts,'blocks',String(index)],depth+1,[...ancestors,value]);
 }
 const slide=document.slides[0];assert.ok(record(slide));
 // Slide.type is not the nested ContentPayload discriminator. Core visits root
 // items and root blocks independently of it; never hide a duplicate outline.
 if(Array.isArray(slide.items))candidates.push({parts:['slides','0','items'],items:slide.items});
 if(Array.isArray(slide.blocks))for(const [index,block]of slide.blocks.entries())payload(block,['slides','0','blocks',String(index)],0,[slide]);
 for(const key of promoted)payload(slide[key],['slides','0',key],0,[slide]);
 const text=v=>typeof v==='string'?v:v?.text;
 const matches=candidates.filter(c=>c.items.length===plan.before.length&&c.items.every((v,i)=>text(v)===plan.before[i].text));assert.equal(matches.length,1,'One exact original public outline required');
 const selected=matches[0],stack=[];
 const nodes=selected.items.map((value,i)=>{if(typeof value!=='string'){assertOwnedKeys(value,Object.hasOwn(value,'level')?['text','level']:['text']);assert.equal(typeof value.text,'string');}
  const level=typeof value==='string'?0:(value.level??0);assert.ok(Number.isSafeInteger(level)&&level>=0&&level<=1);assert.ok(level===0||typeof stack[level-1]==='string','Original public outline has no parent');const parent=level?stack[level-1]:null;stack[level]=text(value);stack.length=level+1;return{index:i+1,text:text(value),level:level+1,parent};});
 assert.deepEqual(nodes,plan.before.map(({index,text,level,parent})=>({index,text,level,parent})),'Original public node order/text/parent/level differs');return{path:selected.parts,items:structuredClone(selected.items),nodes};
}
/** Select the actual public ESM export; require.resolve cannot select import-only entries. */
export async function importSh21Composition(consumer,installed){
 assert.equal(fs.realpathSync(consumer),installed.consumer);
 const records=installed.packages.filter(record=>record.name==='@openpresentation/opf');assert.equal(records.length,1);const record=records[0];
 const req=createRequire(path.join(consumer,'package.json')),manifestFile=req.resolve('@openpresentation/opf/package.json');assert.equal(path.dirname(manifestFile),record.directory);
 const admitted=(file,relative)=>{const entries=record.runtime.files.filter(entry=>entry.path===relative);assert.equal(entries.length,1,'Public composition file is not in the admitted runtime');const bytes=readOwnedFile(file,4194304);assert.deepEqual({bytes:bytes.length,sha256:digest(bytes)},{bytes:entries[0].bytes,sha256:entries[0].sha256},'Public composition runtime identity differs');return bytes;};
 const manifest=JSON.parse(admitted(manifestFile,'package.json'));assert.equal(manifest.name,record.name);assert.equal(manifest.version,record.version);
 const target=manifest.exports?.['./composition']?.import;assert.equal(typeof target,'string','The admitted package has no public composition import export');assert.match(target,/^\.\/[A-Za-z0-9._/-]+$/u);const relative=target.slice(2);assert.ok(relative.split('/').every(part=>part&&part!=='.'&&part!=='..'&&part.toLowerCase()!=='node_modules'),'Public composition import must stay inside its admitted package and obey export-target rules');
 const file=path.join(record.directory,...relative.split('/'));assert.equal(fs.realpathSync(file),file,'Public composition import cannot be an alias');admitted(file,relative);
 return import(pathToFileURL(file).href);
}
export async function verifySh21Source(binding){
 const e=binding.envelope,consumer=e.installed.consumer;assert.deepEqual(e.installed,installedIdentity(consumer));
 const req=createRequire(path.join(consumer,'package.json')),core=await import(pathToFileURL(req.resolve('@openpresentation/opf')).href),{gallery}=await import(pathToFileURL(req.resolve('@openpresentation/gallery')).href),composition=await importSh21Composition(consumer,e.installed);
 assert.equal(typeof core.validate,'function');assert.equal(typeof gallery.source,'string');for(const name of ['nativeTreeGeometry','vennNodes'])assert.equal(typeof composition[name],'function','Actual selected consumer lacks '+name);
 const originals=[];
 for(const caseId of Object.keys(SH21_CASES)){
  const source=readSh21HistoricalInput(ROOT,caseId),view=await archiveView(source.bytes,consumer);assert.equal(view.layout,source.plan.layoutId);assert.deepEqual(view.nodes.map(({text,level,parent})=>({text,level,parent})),source.plan.before.map(({text,level,parent})=>({text,level,parent})),'Exact historical original graph required before Office');
  const imported=await publicImport(source.bytes,consumer),outline=assertSh21OriginalOutline(imported.document,source.plan),validation=core.validate(imported.document,{catalogs:[gallery],only:['format','references']});assert.equal(validation.valid,true,'Actual selected consumer original schema/references refused: '+JSON.stringify(validation.findings));
  // The three immutable input frames are identical. This only exercises the
  // maintained API on original data; it is not a native geometry witness.
  const frame={x:548640/12700,y:1409643/12700,width:11094720/12700,height:4899717/12700};const geometry=source.plan.kind==='venn'?{ok:true,nodes:composition.vennNodes(frame,3)}:composition.nativeTreeGeometry(source.plan.kind,frame,source.plan.before.map(r=>({text:r.text,level:r.level-1})));assert.equal(geometry.ok,true);assert.equal(geometry.nodes.length,3);for(const n of geometry.nodes)for(const v of Object.values(n.box))assert.ok(Number.isFinite(v));
  originals.push({caseId,input:{bytes:source.bytes.length,sha256:digest(source.bytes)},layoutId:view.layoutId??view.layout,rawNodes:view.nodes,publicOutline:outline,publicDocumentSha256:digest(JSON.stringify(imported.document)),diagnostics:imported.diagnostics,validation,composition:{originalNodes:geometry.nodes.length,apiAvailable:true,nativeEvidence:false}});
 }
 assert.deepEqual(e.installed,installedIdentity(consumer));assert.deepEqual(e.controller,repositoryIdentity(ROOT,FILES()));assert.equal(e.controller.dirty,false);
 return{schemaVersion:1,profile:SH21_PROFILE,historicalRevision:SH21_REVISION,installed:e.installed,originals,nativeAcceptance:false,registryAcceptance:false};
}
export async function compareSh21Persisted(b,saved,report){
 const consumer=b.envelope.installed.consumer,original=await archiveView(b.bytes,consumer),edited=await archiveView(saved,consumer),plan=b.plan;
 for(const [view,rows]of [[original,plan.before],[edited,plan.after]]){assert.equal(view.layout,plan.layoutId);assert.deepEqual(view.nodes.map(({text,level,parent})=>({text,level,parent})),rows.map(({text,level,parent})=>({text,level,parent})));}
 assert.deepEqual(edited.nodes.slice(0,3).map(r=>r.id),original.nodes.map(r=>r.id));assert.ok(!original.nodes.some(r=>r.id===edited.nodes[3].id));
 // Existing node text style and every raw style/layout/color resource retain
 // exact parsed values, including whitespace and unknown extension content.
 for(let i=0;i<3;i++){const id=original.nodes[i].id,before=structuredClone(original.orderedPoints.find(p=>p[':@']?.['@_modelId']===id)),after=structuredClone(edited.orderedPoints.find(p=>p[':@']?.['@_modelId']===id));assert.ok(before&&after);for(const point of [before,after])for(const body of point['dgm:pt'].filter(n=>Object.hasOwn(n,'dgm:t')))for(const p of body['dgm:t'].filter(n=>Object.hasOwn(n,'a:p')))for(const run of p['a:p'].filter(n=>Object.hasOwn(n,'a:r')))for(const text of run['a:r'].filter(n=>Object.hasOwn(n,'a:t'))){assert.ok(text['a:t'].length===1&&typeof text['a:t'][0]['#text']==='string');text['a:t'][0]['#text']='[bound-text-leaf]';}assert.deepEqual(after,before,'Existing raw node style/property delta requires review');}
 const resources=z=>Object.keys(z).filter(n=>/^ppt\/(?:diagrams\/(?:layout|quickStyle|colors)\d+\.xml|diagrams\/_rels\/[^/]+\.rels|theme\/theme\d+\.xml)$/u.test(n)).sort();assert.deepEqual(resources(edited.zip),resources(original.zip));for(const name of resources(original.zip))assert.deepEqual(edited.ordered.parse(Buffer.from(edited.zip[name]).toString('utf8')),original.ordered.parse(Buffer.from(original.zip[name]).toString('utf8')),'Unknown raw resource/relationship delta: '+name);
 const imports={original:await publicImport(b.bytes,consumer),saved:await publicImport(saved,consumer)};
 // Public import cannot be treated as a text search. Bind its exact native
 // representation: these three layouts have maintained arrangement imports.
 const beforeDoc=imports.original.presentation??imports.original.document??imports.original;
 const afterDoc=imports.saved.presentation??imports.saved.document??imports.saved;
 assert.equal(beforeDoc.slides.length,1);assert.equal(afterDoc.slides.length,1);
 // Compare full documents against the same native outline through a separately
 // imported model witness, prepared by replacing only the native data graph.
 // No generic stale OPF_DATA restoration or diagnostics waiver is allowed.
 const expected=structuredClone(beforeDoc),originalOutline=assertSh21OriginalOutline(beforeDoc,plan);let itemOwner=expected;for(const key of originalOutline.path.slice(0,-1))itemOwner=itemOwner[key];
 // The immutable tree tag authors even its root as {text,level:0}; the current
 // native outline reader represents a plain root as a string after tag refusal.
 // Bind that one source-proven canonical form, never preserve stale tag data.
 itemOwner.items=plan.after.map(r=>r.level===1?r.text:{text:r.text,level:r.level-1});assert.deepEqual(afterDoc,expected,'Current public import must equal the closed four-node native outline and unchanged remaining document');
 const editFinding={code:'smartart-edited',path:'slides.0.items',message:`The ${plan.kind} was edited in PowerPoint; its list is read from the SmartArt's nodes.`};
 assert.deepEqual(imports.saved.diagnostics,[...imports.original.diagnostics,editFinding],'Only the explicit stale-SmartArt-tag refusal is admitted; all other findings require review');
 // Numeric geometry and unchanged-font qualification use the exact current
 // public composition helpers; no text/formatting adjustment is made here.
 const composition=await importSh21Composition(consumer,b.envelope.installed);
 for(const [phase,rows]of [['original',plan.before],['edited',plan.after],['saved-reopened',plan.after]]){const p=report.phases[phase],f=p.frame;const frame={x:f.Left,y:f.Top,width:f.Width,height:f.Height};const nodes=plan.kind==='venn'?composition.vennNodes(frame,rows.length):composition.nativeTreeGeometry(plan.kind,frame,rows.map(r=>({text:r.text,level:r.level-1}))).nodes;assert.equal(nodes.length,rows.length);for(const [i,node]of nodes.entries()){const matches=p.items.filter(item=>item.text===rows[i].text);assert.equal(matches.length,1,'One exact materialized text shape per data node');const item=matches[0];assert.equal(item.fontSize,36,'No shrink/default formatting repair');for(const [actual,expected]of [[item.Left,node.box.x],[item.Top,node.box.y],[item.Width,node.box.width],[item.Height,node.box.height]])assert.ok(Math.abs(actual-expected)<=0.1,'Measured node geometry differs by >0.1pt');}}
 return{imports,rawNodeIdsPreserved:3,newNodes:1,textEdits:1,liveEligibility:false};
}
export async function sh21Admission(b){
 const atOut=n=>at(b.output,n),r=readOwnedJson(atOut('native/report.json')),terminal=readOwnedJson(atOut('native/worker.json')),stageFile=atOut('native/stages.jsonl'),stages=assertOwnedStageWire(readOwnedFile(stageFile,4194304)),saved=readOwnedFile(atOut('native/saved.pptx'),16777216);assert.equal(digest(saved),r.savedSha256);
 const ready=assertSh21Ready(terminal,r,b.request,stages),comparison=await compareSh21Persisted(b,saved,r),files=['execution-envelope.json','execution-request.json','native/report.json','native/worker.json','native/stages.jsonl','native/saved.pptx',...b.request.snapshots.map(s=>s.path)].map(atOut);
 for(const phase of ['original','edited','saved-reopened']){const file=atOut('native/'+phase+'.png'),raster=r.phases[phase].raster;assert.deepEqual(raster,{path:file,sha256:fileIdentity(file).sha256});const png=readOwnedFile(file,16777216);assert.ok(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));assert.equal(png.readUInt32BE(16),1280);assert.equal(png.readUInt32BE(20),720);files.push(file);}
 files.push(b.envelope.node.path,...sourceIdentityFiles(b.envelope.controller,b.envelope.installed,b.envelope.libraries));verifySh21(atOut('execution-envelope.json'),b.envelopeSha256,b.output,true);
 return{admission:makeOwnedAdmission({profile:SH21_PROFILE,policy:SH21_POLICY,requestSha256:b.requestSha256,files,ready}),comparison};
}
async function main(args){const [cmd,...rest]=args,o={};assert.equal(rest.length%2,0);for(let i=0;i<rest.length;i+=2){assert.ok(['--case','--consumer','--envelope','--sha256','--output','--timeout','--require-office'].includes(rest[i]));assert.equal(Object.hasOwn(o,rest[i]),false);o[rest[i]]=rest[i+1];}if(cmd==='create-envelope'){const e=createSh21Envelope({caseId:o['--case'],consumer:o['--consumer']});write(o['--output'],json(e));console.log(JSON.stringify({path:o['--output'],...fileIdentity(o['--output'])}));return;}if(cmd==='verify-source'){const b=bindSh21Envelope(o['--envelope'],o['--sha256']);console.log(JSON.stringify(await verifySh21Source(b)));return;}assert.ok(['true','false'].includes(o['--require-office']??'false'));const office=o['--require-office']==='true',file=o['--envelope'],sha=o['--sha256'],output=o['--output'];if(cmd==='prepare'){console.log(JSON.stringify(prepareSh21(file,sha,output,{timeoutSeconds:Number(o['--timeout']??45),runOfficeRequested:office})));return;}const b=verifySh21(file,sha,output,office);if(cmd==='verify-execution'){await verifySh21Source(b);console.log(JSON.stringify({controller:ROOT,inputPath:at(output,'inputs/case.pptx'),requestSha256:b.requestSha256,plan:b.plan,planFileIdentity:b.request.planFileIdentity}));return;}assert.equal(office,true);assert.ok(['verify-postflight','verify-admission','observe'].includes(cmd));const result=await sh21Admission(b),admissionFile=at(output,'postflight-admission.json');if(cmd==='verify-postflight'){console.log(JSON.stringify(writeOwnedAdmission(admissionFile,result.admission)));return;}assert.deepEqual(readOwnedJson(admissionFile),result.admission);if(cmd==='observe'){const p=readOwnedJson(at(output,'native/supervisor.json'));assert.equal(p.cleanupConfirmed,true);assertOwnedPostflightArtifacts(p.postflight,readOwnedFile(at(output,'postflight.jsonl'),65536),SH21_POLICY,result.admission);write(at(output,'observations.json'),json(result));}console.log(JSON.stringify({ready:result.admission.ready,profile:SH21_PROFILE}));}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main(process.argv.slice(2)).catch(e=>{console.error(e.stack);process.exitCode=1;});
