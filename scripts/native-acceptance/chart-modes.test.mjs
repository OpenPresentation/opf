import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {assertClassicChartData,assertNativeBoxData} from './chart-data-contract.mjs';
import {CHART_FIXTURE_PATHS,loadChartFixtureSource} from './fixture-source.mjs';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {assertReviewedFallbackArchive,generateChartModes} from './chart-modes.mjs';
import {installedEngines} from './generate.mjs';

test('source-candidate fallback references retain both published histories and exact theme-only review',async()=>{
  const fixture=JSON.parse(await readFile(new URL('./fixtures/chartex-fallback-main.json',import.meta.url)));
  const review=JSON.parse(await readFile(new URL('../../docs/evidence/rr-68-native-chart-master-name-2026-10-15/comparison.json',import.meta.url)));
  const candidate=JSON.parse(await readFile(new URL('../../docs/evidence/rr-68-native-chart-master-name-2026-10-15/source-candidate-theme-category.json',import.meta.url)));
  const current=candidate.cases.slice(0,9);
  assert.equal(fixture.source.sourceCandidateDefaultThemeReview.sourceCandidate.commit,'560571c7ced447484c55c673c8fbeb8f69f838a4');
  assert.equal(fixture.source.sourceCandidateDefaultThemeReview.sourceCandidate.registryAcceptance,false);
  assert.equal(candidate.publishedPptx.gitHead,'9690abd12af8d7a4d6f29a28709517f0b6569301');
  assert.deepEqual(current.map(item=>item.name),Object.keys(fixture.entries));
  assert.equal(review.archives.length,9);
  assert.equal(review.partsCompared,1079);
  assert.equal(review.changedParts,9);
  assert.deepEqual(review.archives.map(item=>item.name),Object.keys(fixture.entries));
  for(const item of review.archives){
    const next=current.find(entry=>entry.name===item.name);
    assert.equal(next.oldSha256,item.currentArchiveSha256);
    assert.equal(next.oldBytes,item.currentBytes);
    assert.equal(fixture.entries[item.name].sha256,next.currentSha256);
    assert.equal(fixture.entries[item.name].bytes,next.currentBytes);
    assert.equal(next.allOtherPartsByteIdentical,true);
    assert.equal(next.diagnosticsByteIdentical,true);
    assert.deepEqual(next.changedParts.map(part=>part.part).sort(),['docProps/app.xml','ppt/theme/theme1.xml','ppt/theme/theme2.xml']);
    assert.ok(next.changedParts.every(part=>part.onlyDefaultThemeDisplayIdentityChanged));
    assert.notEqual(item.currentArchiveSha256,item.oldArchiveSha256);
    assert.equal(item.diagnosticsByteEqual,true);
    assert.equal(item.changedParts.length,1);
    assert.match(item.changedParts[0].part,/^ppt\/slideMasters\/slideMaster\d+\.xml$/);
    assert.equal(item.changedParts[0].onlyMissingMasterNameAdded,true);
    assert.equal(item.changedParts[0].currentBytes-item.changedParts[0].oldBytes,20);
  }
  assert.equal(review.archives[0].oldArchiveSha256,'b69933578667102cc1b2ffa59e97574aa90d6e27442c5e59677ff1a0c16a71f2');
});

test('whole-archive reference guard rejects any byte drift and unknown references',()=>{
  const bytes=Buffer.from('archive bytes: chart, master, ZIP metadata');
  const entry={sha256:createHash('sha256').update(bytes).digest('hex')};
  assert.doesNotThrow(()=>assertReviewedFallbackArchive(bytes,entry,'control'));
  for(let index=0;index<bytes.length;index++){
    const changed=Buffer.from(bytes);changed[index]^=1;
    assert.throws(()=>assertReviewedFallbackArchive(changed,entry,'changed'),/reviewed fallback archive changed/);
  }
  assert.throws(()=>assertReviewedFallbackArchive(bytes,{sha256:'unknown'},'unknown'),/reviewed fallback archive changed/);
});


test('current package authority and immutable native witness have explicit distinct identities',async()=>{
  const {chartFixture,chartBaselines}=await loadChartFixtureSource();
  assert.deepEqual(CHART_FIXTURE_PATHS,['packages/pptx/test/fixtures/chartex-fallback-main.json','scripts/native-acceptance/fixtures/chartex-fallback-main.json']);
  for(const record of [chartBaselines.current,chartBaselines.historicalNative]){
    const bytes=await readFile(new URL('../../'+record.path,import.meta.url));
    assert.equal(record.sha256,createHash('sha256').update(bytes).digest('hex'));
  }
  assert.equal(chartBaselines.historicalNative.sha256,'867c384ba2a1733e7bba738b8e2f797b8efbee0b3083a22bea391c6a32994b1e');
  assert.equal(chartBaselines.nativeAcceptance,false);assert.equal(chartBaselines.registryAcceptance,false);
  const canonical=JSON.parse(await readFile(new URL('../../'+CHART_FIXTURE_PATHS[0],import.meta.url)));
  assert.deepEqual(chartFixture,canonical,'one current lock authority, not a copied native baseline');
  const historical=JSON.parse(await readFile(new URL('./fixtures/chartex-fallback-main.json',import.meta.url)));
  assert.deepEqual(chartFixture.decks,historical.decks);
  assert.ok(Object.keys(chartFixture.entries).every(name=>chartFixture.entries[name].sha256!==historical.entries[name].sha256));
});

test('all30 current chart archives retain strict locks, every series/cache/workbook and mode/import semantics',async()=>{
  const consumer=process.env.OPF_NATIVE_FIXTURE_CONSUMER?path.resolve(process.env.OPF_NATIVE_FIXTURE_CONSUMER):fileURLToPath(new URL('../..',import.meta.url));
  const require=createRequire(path.join(consumer,'package.json'));
  const peer=createRequire(require.resolve('@openpresentation/opf-pptx/package.json'));
  const fflate=peer('fflate'),{XMLParser}=peer('fast-xml-parser');
  const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,parseAttributeValue:false,trimValues:false});
  const scratch=await mkdtemp(path.join(tmpdir(),'native-chart-current-'));
  try{
    const result=await generateChartModes({consumer,output:scratch});
    assert.equal(result.cases.length,30);assert.ok(result.cases.every(item=>item.input&&!item.rejected));
    assert.equal(result.cases.filter(item=>item.mode==='fallback'&&item.approvedFallbackSha256).length,9);
    for(const mode of ['fallback','auto','native']){
      const pareto=result.cases.find(item=>item.chart==='pareto-multi'&&item.mode===mode);
      assert.equal(pareto.chartExParts,0);assert.deepEqual(pareto.importedChartTypes,['column']);
      assert.deepEqual(pareto.diagnostics.map(issue=>issue.code+'/'+issue.adaptation),['chart-data-adapted/chart-fallback']);
      const seven=result.cases.find(item=>item.chart==='all-seven'&&item.mode===mode);
      assert.equal(seven.chartExParts,mode==='fallback'?0:4);
      assert.equal(seven.importedChartTypes[2],mode==='fallback'?'column':'combo');
      assert.equal(seven.diagnostics.filter(issue=>issue.adaptation==='signed-pareto-combo').length,mode==='fallback'?0:1);
    }
    for(const mode of ['fallback','auto','native']){
      const signed=result.cases.find(item=>item.chart==='histogram-category'&&item.mode===mode);
      assert.equal(signed.chartExParts,0);assert.deepEqual(signed.importedChartTypes,['column']);
      assert.deepEqual(signed.diagnostics.map(issue=>issue.code+'/'+issue.adaptation),['chart-data-adapted/chartex-fallback']);
      assert.match(signed.diagnostics[0].message,/categorical histogram.*negative/i);
      assert.doesNotMatch(signed.diagnostics[0].message,/pass chartex|does not write|not yet accepted/);
    }
    const {chartFixture}=await loadChartFixtureSource(),contract={parser,fflate};
    const bytes=await readFile(path.join(scratch,'chart-modes/pareto-multi-native.pptx'));
    const parts=fflate.unzipSync(bytes),data=chartFixture.decks['pareto-multi'].slides[0].chart.data;
    const historical=JSON.parse(await readFile(new URL('./fixtures/chartex-fallback-main.json',import.meta.url)));
    assert.throws(()=>assertReviewedFallbackArchive(bytes,historical.entries['pareto-multi'],'old-consumer'),/reviewed fallback archive changed/);
    const change=(part,replace)=>{const changed={...parts};changed[part]=fflate.strToU8(replace(fflate.strFromU8(parts[part])));return changed;};
    assert.throws(()=>assertClassicChartData(change('ppt/charts/chart1.xml',xml=>xml.replace(/<c:ser>[\s\S]*?<\/c:ser>/,'')),1,data,contract,'missing-series'),/every numeric series/);
    assert.throws(()=>assertClassicChartData(change('ppt/charts/chart1.xml',xml=>xml.replace('<c:v>Q1</c:v>','<c:v>WRONG</c:v>')),1,data,contract,'wrong-category'),/categories/);
    assert.throws(()=>assertClassicChartData(change('ppt/charts/chart1.xml',xml=>xml.replace('<c:v>4</c:v>','<c:v>400</c:v>')),1,data,contract,'wrong-value'),/values/);
    assert.throws(()=>assertClassicChartData(change('ppt/charts/chart1.xml',xml=>xml.replace('barDir val="col"','barDir val="bar"')),1,data,contract,'wrong-type'),/vertical columns/);
    for(const [from,to] of [['Sheet1!$B$1','Sheet1!$C$1'],['Sheet1!$A$2:$A$4','Sheet1!$B$2:$B$4'],['Sheet1!$B$2:$B$4','Sheet1!$C$2:$C$4']]){
      assert.throws(()=>assertClassicChartData(change('ppt/charts/chart1.xml',xml=>xml.replace(from,to)),1,data,contract,'wrong-formula'),/classic .* formula/);
    }
    assert.throws(()=>assertClassicChartData(change('ppt/charts/chart1.xml',xml=>xml.replace('ptCount val="3"','ptCount val="2"')),1,data,contract,'wrong-cache-count'),/declared classic cache count/);
    const workbook='ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx',nested=fflate.unzipSync(parts[workbook]);
    nested['xl/worksheets/sheet1.xml']=fflate.strToU8(fflate.strFromU8(nested['xl/worksheets/sheet1.xml']).replace('<v>4</v>','<v>400</v>'));
    assert.throws(()=>assertClassicChartData({...parts,[workbook]:fflate.zipSync(nested)},1,data,contract,'wrong-workbook'),/workbook/);
    const boxParts=fflate.unzipSync(await readFile(path.join(scratch,'chart-modes/box-multi-native.pptx'))),boxData=chartFixture.decks['box-multi'].slides[0].chart.data;
    const plotted={columns:boxData.columns,rows:boxData.rows.map(row=>[boxData.columns[0],...row.slice(1)])};
    assertNativeBoxData(boxParts,plotted,contract,'native-box');
    const boxFile=Object.keys(boxParts).find(file=>/^ppt\/charts\/chartEx\d+\.xml$/.test(file));
    const changeBox=replace=>({...boxParts,[boxFile]:fflate.strToU8(replace(fflate.strFromU8(boxParts[boxFile])))});
    for(const [from,to] of [['Sheet1!$B$1','Sheet1!$C$1'],['Sheet1!$A$2:$A$4','Sheet1!$B$2:$B$4'],['Sheet1!$B$2:$B$4','Sheet1!$C$2:$C$4']]){
      assert.throws(()=>assertNativeBoxData(changeBox(xml=>xml.replace(from,to)),plotted,contract,'wrong-native-formula'),/native .* formula/);
    }
    assert.throws(()=>assertNativeBoxData(changeBox(xml=>xml.replace('ptCount="3"','ptCount="2"')),plotted,contract,'wrong-native-count'),/declared native cache count/);
    assert.throws(()=>assertNativeBoxData(changeBox(xml=>xml.replace('r:id="rId1"','r:id="rId999"')),plotted,contract,'wrong-native-relation-id'),/unique embedded workbook relationship/);
    const nativeRels='ppt/charts/_rels/'+path.basename(boxFile)+'.rels';
    const wrongLink={...boxParts,[nativeRels]:fflate.strToU8(fflate.strFromU8(boxParts[nativeRels]).replace('Microsoft_Excel_Worksheet1.xlsx','Microsoft_Excel_Worksheet999.xlsx')),[workbook.replace('1.xlsx','999.xlsx')]:boxParts[workbook]};
    assert.throws(()=>assertNativeBoxData(wrongLink,plotted,contract,'wrong-native-workbook-link'),/native.classic same workbook/);
    boxParts[boxFile]=fflate.strToU8(fflate.strFromU8(boxParts[boxFile]).replace('<cx:pt idx="0">4</cx:pt>','<cx:pt idx="0">400</cx:pt>'));
    assert.throws(()=>assertNativeBoxData(boxParts,plotted,contract,'wrong-native-box'),/native box values/);
  }finally{await rm(scratch,{recursive:true,force:true});}
});


test('native eligibility counterexamples keep nonnegative categories and negative raw observations',async()=>{
  const consumer=process.env.OPF_NATIVE_FIXTURE_CONSUMER?path.resolve(process.env.OPF_NATIVE_FIXTURE_CONSUMER):fileURLToPath(new URL('../..',import.meta.url));
  const {pptx,gallery,fflate}=await installedEngines(consumer);
  const examples=[
    {name:'nonnegative category values including zero',data:{columns:['Category','Value'],rows:[['A',42],['B',0],['C',19]]},aggregation:true,values:[42,0,19]},
    {name:'negative raw observations',data:{columns:['Value'],rows:[[-8],[-3],[0],[4],[19]]},aggregation:false,values:[-8,-3,0,4,19]},
  ];
  for(const mode of ['auto','native'])for(const item of examples){
    const diagnostics=[],source={slides:[{chart:{type:'histogram',data:item.data}}]};
    const bytes=await pptx.toPptx(source,{catalogs:[gallery],chartex:mode,onDiagnostic:issue=>diagnostics.push(issue)});
    const parts=fflate.unzipSync(bytes),names=Object.keys(parts).filter(file=>/^ppt\/charts\/chartEx\d+\.xml$/.test(file));
    assert.equal(names.length,1,item.name+': native chart retained in '+mode);
    const xml=fflate.strFromU8(parts[names[0]]);
    assert.equal(xml.includes('<cx:aggregation/>'),item.aggregation,item.name+': aggregation identity');
    assert.equal(xml.includes('<cx:binning '),!item.aggregation,item.name+': raw binning identity');
    const values=[...xml.matchAll(/<cx:numDim type="val">[\s\S]*?<cx:lvl[^>]*>([\s\S]*?)<\/cx:lvl>/g)].flatMap(([,block])=>[...block.matchAll(/<cx:pt idx="\d+">([^<]*)<\/cx:pt>/g)].map(([,value])=>Number(value)));
    assert.deepEqual(values,item.values,item.name+': complete native values');
    const imported=await pptx.fromPptx(bytes,{catalogs:[gallery]});
    assert.equal(imported.slides.length,1);
    assert.equal(imported.slides[0].chart.type,'histogram',item.name+': native type preserved');
    assert.deepEqual(imported.slides[0].chart.data,item.data,item.name+': complete imported values');
    assert.deepEqual(diagnostics.filter(issue=>issue.code==='chart-data-adapted'),[],item.name+': no guard adaptation');
  }
});
