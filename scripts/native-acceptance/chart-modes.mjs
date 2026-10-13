// Extended chart archive matrix from the same nine tracked source fixtures.
import assert from 'node:assert/strict';
import {realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {fixtureWriter,installedEngines} from './generate.mjs';
import {loadFixtureSource} from './fixture-source.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>Buffer.from(`${JSON.stringify(value,null,2)}\n`);

export async function generateChartModes({consumer,output,engines}={}){
  const root=await realpath(output),installed=await realpath(consumer);
  assert.ok(root!==installed&&!root.startsWith(installed+path.sep),'chart outputs cannot live in installed consumer');
  const {chartFixture}=await loadFixtureSource();
  const {pptx,gallery,fflate}=engines??await installedEngines(consumer);
  assert.ok(pptx?.toPptx&&pptx?.fromPptx&&gallery?.layouts&&fflate?.unzipSync&&fflate?.strFromU8);
  const {put,files}=fixtureWriter(root),cases=[];
  for(const [name,deck] of Object.entries(chartFixture.decks))for(const mode of ['fallback','auto','native']){
    const id=`chart-mode-${name}-${mode}`,diagnostics=[],options={catalogs:[gallery],chartex:mode,onDiagnostic:issue=>diagnostics.push(issue)};
    const multiPareto=deck.slides.some(slide=>slide.chart?.type==='pareto'&&slide.chart.data.columns.length>2);
    if(mode==='native'&&multiPareto){
      let failure;try{await pptx.toPptx(deck,options);}catch(error){failure=error;}
      assert.ok(failure,`${id}: native multi-series Pareto must refuse`);
      assert.equal(failure.code,'unsupported-chart-data');assert.ok(failure.details.path.includes('chart'));assert.equal(failure.details.series.length,3);
      cases.push({id,mode,chart:name,rejected:true,code:failure.code,details:failure.details,partialArchive:false,nativeAcceptance:'ineligible'});continue;
    }
    const bytes=await pptx.toPptx(deck,options);
    assert.deepEqual(bytes,await pptx.toPptx(deck,{catalogs:[gallery],chartex:mode}),`${id}: nondeterministic archive`);
    const archive=`chart-modes/${name}-${mode}.pptx`,record=await put(archive,bytes),parts=fflate.unzipSync(bytes);
    const imported=await pptx.fromPptx(bytes,{catalogs:[gallery]});
    await put(`chart-modes/${name}-${mode}-imported.opf.json`,json(imported));
    const chartExParts=Object.keys(parts).filter(file=>/^ppt\/charts\/chartEx\d+\.xml$/.test(file));
    const shapeCounts=Object.entries(parts).filter(([file])=>/^ppt\/slides\/slide\d+\.xml$/.test(file)).map(([,data])=>[...fflate.strFromU8(data).matchAll(/<p:(?:sp|pic|graphicFrame)\b/g)].length);
    if(mode==='fallback'){
      assert.equal(chartExParts.length,0,`${id}: fallback emitted chartEx`);
      assert.equal(hash(bytes),chartFixture.entries[name].sha256,`${id}: reviewed fallback archive changed`);
    }
    if(mode==='native')assert.equal(chartExParts.length,deck.slides.length,`${id}: chartEx count`);
    if(multiPareto){
      for(const [index,slide] of deck.slides.entries())if(slide.chart?.type==='pareto'){
        assert.deepEqual(imported.slides[index].chart.data,slide.chart.data,`${id}: Pareto data changed`);
        assert.equal(imported.slides[index].chart.type,'column',`${id}: Pareto fallback type`);
      }
      assert.ok(diagnostics.some(issue=>issue.code==='chart-data-adapted'&&issue.adaptation==='chartex-fallback'));
      assert.ok(!diagnostics.some(issue=>issue.adaptation==='series-dropped'));
    }
    cases.push({id,mode,chart:name,input:archive,archiveSha256:record.sha256,approvedFallbackSha256:mode==='fallback'?chartFixture.entries[name].sha256:null,chartExParts:chartExParts.length,slideCount:deck.slides.length,automaticControlEligible:deck.slides.length>=1&&deck.slides.length<=3&&shapeCounts.every(count=>count<=30),xmlShapeCounts:shapeCounts,roundTripEqual:isDeepStrictEqual(imported,deck),diagnostics,importedChartTypes:imported.slides.map(slide=>slide.chart?.type),nativeAcceptance:'pending'});
  }
  // The historical fixture's multi-series Pareto must reject native mode. A
  // separate positive single-series case proves native Pareto still works.
  const single={slides:[{title:'Supported single-series Pareto',chart:{type:'pareto',data:{columns:['Category','Only'],rows:[['A',10],['B',20]]}}}]};
  await put('sources/chart-pareto-single.opf.json',json(single));
  for(const mode of ['auto','fallback','native']){
    const id=`chart-mode-pareto-single-${mode}`,diagnostics=[],options={catalogs:[gallery],chartex:mode,onDiagnostic:issue=>diagnostics.push(issue)};
    const bytes=await pptx.toPptx(single,options);
    assert.deepEqual(bytes,await pptx.toPptx(single,{catalogs:[gallery],chartex:mode}),`${id}: nondeterministic archive`);
    const parts=fflate.unzipSync(bytes),chartExParts=Object.keys(parts).filter(file=>/^ppt\/charts\/chartEx\d+\.xml$/.test(file));
    assert.equal(chartExParts.length,mode==='fallback'?0:1,`${id}: chartEx count`);
    const imported=await pptx.fromPptx(bytes,{catalogs:[gallery]});
    assert.deepEqual(imported.slides[0].chart.data,single.slides[0].chart.data,`${id}: authored Pareto data changed`);
    const input=`chart-modes/pareto-single-${mode}.pptx`,record=await put(input,bytes);
    await put(`chart-modes/pareto-single-${mode}-imported.opf.json`,json(imported));
    cases.push({id,mode,chart:'pareto-single',input,archiveSha256:record.sha256,chartExParts:chartExParts.length,slideCount:1,automaticControlEligible:true,roundTripEqual:isDeepStrictEqual(imported,single),diagnostics,nativeAcceptance:'pending'});
  }
  assert.equal(cases.length,30,'nine fixtures plus single-series Pareto, each in three modes');
  assert.equal(cases.filter(item=>item.input).length,29,'retain all 29 positive chart archives');
  await put('inspection/chart-modes.json',json(cases));
  return {cases,files};
}
