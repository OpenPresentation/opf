import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {access,readFile,realpath,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const [manifestArgument,outputArgument,...caseArguments]=process.argv.slice(2);
assert.ok(manifestArgument&&outputArgument&&caseArguments.length,
  'Usage: node audit.mjs MANIFEST OUTPUT_REPORT RUN_DIRECTORY=CASE_ID [...]');
assert.equal(process.versions.node.split('.')[0],'24','Furniture semantic audit requires Node 24.');
const scriptPath=fileURLToPath(import.meta.url), manifestPath=await realpath(manifestArgument);
const outputPath=path.resolve(outputArgument);
try { await access(outputPath); throw new Error(`Preserve existing audit output: ${outputPath}`); }
catch(error) { if(error.code!=='ENOENT') throw error; }

const bytes=await readFile(manifestPath), manifest=JSON.parse(bytes);
const sha=value=>createHash('sha256').update(value).digest('hex');
const fileHash=async file=>sha(await readFile(file));
assert.equal(process.version,manifest.node,'Use the exact Node version recorded by the fixture manifest.');
assert.equal(await fileHash(manifest.generator.path),manifest.generator.sha256,'Fixture generator changed.');
assert.equal(await fileHash(manifest.publicRegistry.lockFile),manifest.publicRegistry.lockSha256,'Registry consumer lock changed.');
for(const pkg of manifest.publicRegistry.packages){
  assert.equal(await fileHash(pkg.manifestPath),pkg.manifestSha256,`${pkg.name} manifest changed.`);
  assert.equal(await fileHash(pkg.entrypoint),pkg.entrypointSha256,`${pkg.name} entrypoint changed.`);
}
for(const entry of manifest.publicRegistry.esmEntrypoints)
  assert.equal(await fileHash(entry.path),entry.sha256,`${entry.name} recorded public ESM entrypoint changed.`);

const entry=name=>manifest.publicRegistry.esmEntrypoints.find(item=>item.name===name);
const pptxEntry=entry('@openpresentation/opf-pptx'), coreEntry=entry('@openpresentation/opf');
assert.ok(pptxEntry&&coreEntry,'Recorded public importer/core entrypoints are missing.');
const [{fromPptx},{validatePresentation}]=await Promise.all([import(pptxEntry.url),import(coreEntry.url)]);

function dataUriHash(src){
  const match=/^data:[^;,]+;base64,(.*)$/.exec(src);
  return match?sha(Buffer.from(match[1],'base64')):sha(Buffer.from(src));
}
function normalize(value){
  if(Array.isArray(value)) return value.map(normalize);
  if(value&&typeof value==='object'){
    if(typeof value.src==='string') return {srcSha256:dataUriHash(value.src),...(value.alt!==undefined?{alt:value.alt}:{})};
    return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,normalize(item)]));
  }
  return value;
}
function semanticSummary(deck){
  return normalize({organization:deck.organization,design:{header:deck.design?.header,footer:deck.design?.footer},slides:deck.slides.map(slide=>({
    title:slide.title,section:slide.section,localDesign:{header:slide.design?.header,footer:slide.design?.footer},
    effectiveHeader:slide.design?.header??deck.design?.header,effectiveFooter:slide.design?.footer??deck.design?.footer,blocks:slide.blocks,
  }))});
}

const clone=value=>structuredClone(value);
const fixtureById=id=>manifest.fixtures.find(item=>item.id===id);
const casesById={
  'baseline-inherited-local':{fixtureId:'baseline-inherited-local',exact:'expectedSemanticImport'},
  'baseline-explicit-flags':{fixtureId:'baseline-explicit-flags',exact:'expectedSemanticImport'},
  'text-clear':{fixtureId:'baseline-inherited-local',plan:'text-clear.json'},
  'delete-image':{fixtureId:'baseline-inherited-local',plan:'delete-image.json'},
  'reorder':{fixtureId:'baseline-inherited-local',plan:'reorder.json'},
  'duplicate-tagged-shape':{fixtureId:'baseline-inherited-local',plan:'duplicate-tagged-shape.json'},
  'missing-tag':{fixtureId:'baseline-inherited-local',plan:'missing-tag.json'},
  'changed-tag':{fixtureId:'baseline-inherited-local',plan:'changed-tag.json'},
  'metadata-disagreement':{fixtureId:'baseline-inherited-local',plan:'metadata-disagreement.json'},
};
const plansRoot=path.join(path.dirname(manifest.output),'furniture-plans-01');
const diagnosticCodes=items=>items.map(item=>item.code);
function assertInvalidCount(diagnostics,count,label){
  assert.equal(diagnostics.filter(item=>item.code==='invalid-furniture-provenance').length,count,`${label}: invalid-furniture-provenance count changed.`);
}
function textClearExpected(){
  const expected=clone(fixtureById('baseline-inherited-local').expectedSemanticImport), inherited=expected.design.header;
  delete expected.design.header;
  for(const index of [0,2]){
    expected.slides[index].localDesign.header=clone(inherited);
    expected.slides[index].effectiveHeader=clone(inherited);
  }
  expected.slides[0].localDesign.header.left.text='  Native edited header\twords\r\n\r\n';
  expected.slides[0].effectiveHeader=clone(expected.slides[0].localDesign.header);
  expected.slides[1].localDesign.header.left.text='Native local label';
  delete expected.slides[1].localDesign.header.left.image.alt;
  expected.slides[1].effectiveHeader=clone(expected.slides[1].localDesign.header);
  expected.slides[2].localDesign.header.left.text='\r\n\r\n';
  expected.slides[2].effectiveHeader=clone(expected.slides[2].localDesign.header);
  return expected;
}
function deleteImageExpected(){
  const expected=clone(fixtureById('baseline-inherited-local').expectedSemanticImport), inherited=expected.design.header;
  delete expected.design.header;
  for(const index of [0,2]){
    expected.slides[index].localDesign.header=clone(inherited);
    expected.slides[index].effectiveHeader=clone(inherited);
  }
  delete expected.slides[1].section;
  delete expected.slides[1].localDesign.header;
  delete expected.slides[1].effectiveHeader;
  expected.slides[1].blocks=[
    {type:'text',text:'  Registry Organization  '},{type:'text',text:'  Beta section  '},
    {type:'text',text:'  Local image label  '},{type:'text',text:'Scalar body local — exact.'},
  ];
  return expected;
}
function reorderExpected(){
  const baseline=fixtureById('baseline-inherited-local').expectedSemanticImport, expected=clone(baseline);
  const slides=[clone(baseline.slides[2]),clone(baseline.slides[0]),clone(baseline.slides[1])];
  delete expected.design.footer;
  const visible=[['  Inherited footer  ','3'],['  Inherited footer  ','1'],['  Local footer  ','2']];
  for(const [index,slide] of slides.entries()){
    delete slide.localDesign.footer; delete slide.effectiveFooter;
    slide.blocks.push(...visible[index].map(text=>({type:'text',text})));
  }
  expected.slides=slides;
  return expected;
}
function metadataDisagreementExpected(){
  const expected=clone(fixtureById('variant-metadata-disagreement').registryImport);
  for(const block of expected.slides[0].blocks)
    if(block.type==='text'&&block.text==='  Disagreed Organization  ') block.text='  Native Disagreed Organization  ';
  return expected;
}
function validateActionCase(caseId,actual,diagnostics){
  const baselineDiagnostics=fixtureById('baseline-inherited-local').diagnostics;
  switch(caseId){
    case 'text-clear':
      assert.deepEqual(actual,textClearExpected(),'text-clear: exact current semantic content changed.');
      assert.deepEqual(diagnosticCodes(diagnostics),diagnosticCodes(baselineDiagnostics),'text-clear: diagnostic sequence changed.');
      return ['exact edited/cleared text and alt','global-to-local header reconciliation','no invalid provenance'];
    case 'delete-image':
      assert.deepEqual(actual,deleteImageExpected(),'delete-image: exact fallback/current semantic content changed.');
      assertInvalidCount(diagnostics,1,caseId);
      assert.ok(!JSON.stringify(actual).includes(manifest.inputs.image.sha256),'delete-image: deleted image was resurrected.');
      return ['deleted image not resurrected','invalid local header retained as current text','unaffected furniture recovered'];
    case 'reorder':
      assert.deepEqual(actual,reorderExpected(),'reorder: exact reordered/current semantic content changed.');
      assertInvalidCount(diagnostics,3,caseId);
      return ['slide order follows native order','headers recover','stale visible slide numbers remain ordinary text'];
    case 'missing-tag':
      assert.deepEqual(actual,fixtureById('variant-missing-shape-tag').registryImport,'missing-tag: semantic fallback differs from controlled missing-tag expectation.');
      assert.deepEqual(diagnosticCodes(diagnostics),diagnosticCodes(fixtureById('variant-missing-shape-tag').diagnostics),'missing-tag: diagnostic sequence changed.');
      return ['damaged header not consumed','current native header text retained','valid slides and footers recovered'];
    case 'changed-tag':
      assert.deepEqual(actual,fixtureById('variant-changed-shape-tag').registryImport,'changed-tag: semantic fallback differs from controlled changed-tag expectation.');
      assert.deepEqual(diagnosticCodes(diagnostics),diagnosticCodes(fixtureById('variant-changed-shape-tag').diagnostics),'changed-tag: diagnostic sequence changed.');
      return ['unmatched identity invalidates slide furniture','current native furniture retained','valid slides recovered'];
    case 'metadata-disagreement':
      assert.deepEqual(actual,metadataDisagreementExpected(),'metadata-disagreement: exact current metadata fallback changed.');
      assertInvalidCount(diagnostics,3,caseId);
      assert.ok(!JSON.stringify(actual).includes('  Registry Organization  ')||JSON.stringify(actual).includes('  Native Disagreed Organization  '));
      return ['organization omitted on disagreement','current disagreeing/repeated words retained','footers recovered'];
    case 'duplicate-tagged-shape': {
      const controlled=clone(fixtureById('variant-missing-shape-tag').registryImport), observed=clone(actual);
      const observedBlocks=observed.slides[0].blocks; observed.slides[0].blocks=[]; controlled.slides[0].blocks=[];
      assert.deepEqual(observed,controlled,'duplicate-tagged-shape: unaffected semantic structure changed.');
      const expectedTexts=fixtureById('variant-missing-shape-tag').registryImport.slides[0].blocks.map(block=>block.text);
      expectedTexts.push('  Inherited header\twords');
      assert.deepEqual(observedBlocks.map(block=>block.text).sort(),expectedTexts.sort(),'duplicate-tagged-shape: current duplicated text was not retained exactly.');
      assert.ok(observedBlocks.every(block=>block.type==='text'),'duplicate-tagged-shape: unexpected fallback block type.');
      assertInvalidCount(diagnostics,1,caseId);
      return ['duplicated tagged part invalidates header','both current duplicate texts retained','unaffected furniture recovered'];
    }
    default: throw new Error(`No semantic action validator for ${caseId}.`);
  }
}

const cases=[];
for(const value of caseArguments){
  const separator=value.lastIndexOf('=');
  assert.ok(separator>0&&separator<value.length-1,`Invalid case argument: ${value}`);
  const runDirectory=await realpath(value.slice(0,separator)), caseId=value.slice(separator+1), spec=casesById[caseId];
  assert.ok(spec,`Unknown semantic case: ${caseId}`);
  const fixtureId=spec.fixtureId, fixture=fixtureById(fixtureId);
  assert.equal(await fileHash(fixture.file),fixture.sha256,`${fixtureId}: fixture source changed.`);
  const reportPath=path.join(runDirectory,'report.json'), reportBytes=await readFile(reportPath);
  const report=JSON.parse(reportBytes.toString('utf8').replace(/^\uFEFF/,''));
  assert.equal(report.cleanupConfirmed,true,`${runDirectory}: cleanup is not confirmed.`);
  assert.equal(report.officeOperationsStopped,false,`${runDirectory}: Office operations stopped.`);
  assert.equal(report.lastStage,'worker.complete',`${runDirectory}: worker is incomplete.`);
  assert.equal(report.lastStatus,'success',`${runDirectory}: worker did not succeed.`);
  assert.equal(path.resolve(report.source.path),path.resolve(fixture.file),`${runDirectory}: source path does not select ${fixtureId}.`);
  assert.equal(report.source.sha256,fixture.sha256,`${runDirectory}: source hash differs from the fixture manifest.`);
  const savedPath=await realpath(report.saved.path), savedSha256=await fileHash(savedPath);
  assert.equal(savedSha256,report.saved.sha256,`${runDirectory}: saved hash differs from report.`);
  assert.equal(savedSha256,report.reopened.sha256,`${runDirectory}: reopened hash differs from report.`);
  let plan=null;
  if(spec.plan){
    const planPath=await realpath(path.join(plansRoot,spec.plan)), planBytes=await readFile(planPath);
    plan=JSON.parse(planBytes.toString('utf8').replace(/^\uFEFF/,''));
    assert.equal(report.actionPlan.path,planPath,`${runDirectory}: action-plan path changed.`);
    assert.equal(report.actionPlan.sha256,sha(planBytes),`${runDirectory}: action-plan hash changed.`);
    assert.equal(report.actionPlan.snapshotSha256,sha(planBytes),`${runDirectory}: action-plan snapshot hash changed.`);
    assert.deepEqual(report.actionPlan.actions,plan,`${runDirectory}: executed action plan changed.`);
    assert.deepEqual(report.actionPlan.completed,plan.map((action,index)=>({index:index+1,op:action.op,status:'success'})),`${runDirectory}: completed actions changed.`);
  }else{
    assert.equal(report.actionPlan.actions.length,0,`${runDirectory}: baseline audit requires zero actions.`);
    assert.equal(report.actionPlan.completed.length,0,`${runDirectory}: baseline audit found completed actions.`);
  }
  const diagnostics=[], imported=await fromPptx(await readFile(savedPath),{onDiagnostic:item=>diagnostics.push(item)});
  assert.equal(validatePresentation(imported).valid,true,`${runDirectory}: imported presentation is invalid.`);
  // Compare the manifest's persisted JSON representation. The generator's
  // in-memory summary carries undefined keys that JSON intentionally omits.
  const actual=JSON.parse(JSON.stringify(semanticSummary(imported)));
  let acceptance;
  if(spec.exact){
    assert.deepEqual(actual,fixture[spec.exact],`${runDirectory}: exact semantic summary changed.`);
    assert.deepEqual(diagnosticCodes(diagnostics),diagnosticCodes(fixture.diagnostics),`${runDirectory}: diagnostic code sequence changed.`);
    acceptance=['exact persisted generator semanticSummary','exact diagnostic-code sequence'];
  }else acceptance=validateActionCase(caseId,actual,diagnostics);
  cases.push({
    runDirectory,caseId,fixtureId,passed:true,acceptance,
    source:{path:fixture.file,sha256:fixture.sha256},
    nativeReport:{path:reportPath,sha256:sha(reportBytes),savedPath,savedSha256},
    actionPlan:spec.plan?{path:path.join(plansRoot,spec.plan),actions:plan}:null,semanticSummary:actual,diagnostics,
  });
}

const result={
  schemaVersion:1,passed:true,scope:'Offline current-registry semantic reimport of completed, cleanup-confirmed native furniture lifecycle reports. No Office, COM, UI, or native edit is performed.',
  generatedAt:new Date().toISOString(),node:{version:process.version,executable:process.execPath},
  audit:{path:scriptPath,sha256:await fileHash(scriptPath)},
  fixtureManifest:{path:manifestPath,sha256:sha(bytes),generator:manifest.generator},
  publicRegistry:manifest.publicRegistry,cases,
};
await writeFile(outputPath,`${JSON.stringify(result,null,2)}\n`,{flag:'wx'});
console.log(`Furniture semantic audit passed ${cases.length} completed run(s): ${outputPath}`);
