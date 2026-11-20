// Extended chart archive matrix from the same nine tracked source fixtures.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {assertClassicChartData,assertNativeBoxData,assertNativePictureFallback,assertSignedParetoComboData} from './chart-data-contract.mjs';
import {realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {fixtureWriter,installedEngines} from './generate.mjs';
import {loadFixtureSource} from './fixture-source.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>Buffer.from(`${JSON.stringify(value,null,2)}\n`);

// Keep the reference check independent of exporter availability in tooling tests.
// It authenticates the entire archive, without XML normalization or exceptions.
export function assertReviewedFallbackArchive(bytes,entry,id){
  assert.equal(hash(bytes),entry.sha256,`${id}: reviewed fallback archive changed`);
}

export async function generateChartModes({consumer,output,engines}={}){
  const root=await realpath(output),installed=await realpath(consumer);
  assert.ok(root!==installed&&!root.startsWith(installed+path.sep),'chart outputs cannot live in installed consumer');
  const {chartFixture,chartBaselines}=await loadFixtureSource();
  const {core,pptx,gallery,fflate}=engines??await installedEngines(consumer);
  assert.ok(pptx?.toPptx&&pptx?.fromPptx&&gallery?.layouts&&fflate?.unzipSync&&fflate?.strFromU8);
  const require=createRequire(path.join(installed,'package.json'));
  const peer=createRequire(require.resolve('@openpresentation/opf-pptx/package.json'));
  const {XMLParser}=peer('fast-xml-parser');
  const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseAttributeValue:false,parseTagValue:false,trimValues:false});
  const {chartDrawPlan,resolveChartData}=core;
  const contracts={parser,fflate};
  const {put,files}=fixtureWriter(root),cases=[];
  for(const [name,deck] of Object.entries(chartFixture.decks))for(const mode of ['fallback','auto','native']){
    const id=`chart-mode-${name}-${mode}`,diagnostics=[],options={catalogs:[gallery],chartex:mode,onDiagnostic:issue=>diagnostics.push(issue)};
    const plans=deck.slides.map(slide=>chartDrawPlan(slide.chart,resolveChartData(slide.chart)));
    const bytes=await pptx.toPptx(deck,options);
    assert.deepEqual(bytes,await pptx.toPptx(deck,{catalogs:[gallery],chartex:mode}),`${id}: nondeterministic archive`);
    const archive=`chart-modes/${name}-${mode}.pptx`,record=await put(archive,bytes),parts=fflate.unzipSync(bytes);
    const imported=await pptx.fromPptx(bytes,{catalogs:[gallery]});
    await put(`chart-modes/${name}-${mode}-imported.opf.json`,json(imported));
    const chartExParts=Object.keys(parts).filter(file=>/^ppt\/charts\/chartEx\d+\.xml$/.test(file));
    const shapeCounts=Object.entries(parts).filter(([file])=>/^ppt\/slides\/slide\d+\.xml$/.test(file)).map(([,data])=>[...fflate.strFromU8(data).matchAll(/<p:(?:sp|pic|graphicFrame)\b/g)].length);
    if(mode==='fallback'){
      assert.equal(chartExParts.length,0,`${id}: fallback emitted chartEx`);
      const entry=chartFixture.entries[name];
      assertReviewedFallbackArchive(bytes,entry,id);
      assert.equal(bytes.byteLength,entry.bytes,id+': reviewed archive size');
      assert.deepEqual(diagnostics.map(issue=>issue.code+(issue.adaptation?'/'+issue.adaptation:'')),entry.diagnostics,id+': reviewed ordered diagnostics');
      assert.equal(Object.keys(parts).filter(file=>/^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(file)).length,entry.layoutParts,id+': reviewed layouts');
      assert.equal(Object.keys(parts).filter(file=>/^ppt\/tags\/opfLayout\d+\.xml$/.test(file)).length,entry.layoutTagParts,id+': reviewed layout tags');
      assert.ok(Object.entries(parts).filter(([file])=>/^ppt\/slides\/slide\d+\.xml$/.test(file)).every(([,data])=>!fflate.strFromU8(data).includes('AlternateContent')),id+': no alternate content in fallback');
    }
    // RR-105: chartex charts write no classic part, so a classic chart's part number is read from its slide, never assumed from its position.
    const classicNumber=index=>{const found=[...fflate.strFromU8(parts['ppt/slides/_rels/slide'+(index+1)+'.xml.rels']).matchAll(/Type="[^"]*\/relationships\/chart" Target="\.\.\/charts\/chart(\d+)\.xml"/g)];assert.equal(found.length,1,id+': one classic chart on slide '+(index+1));return Number(found[0][1]);};
    const maps=deck.slides.filter((slide,index)=>slide.chart.type==='world'&&plans[index].type==='world').length;
    // RR-105: category aggregation cannot paint signed values; keep every row in classic columns in every mode.
    const negativeHistograms=new Set(deck.slides.map(({chart},index)=>chart.type==='histogram'&&plans[index].columns.length>1&&plans[index].rows.some(row=>row.slice(1).some(value=>typeof value==='number'&&value<0))?index:null).filter(index=>index!==null));
    const signedParetos=new Set(deck.slides.map(({chart},index)=>mode!=='fallback'&&plans[index].type==='pareto'&&plans[index].columns.length===2&&plans[index].rows.some(row=>typeof row[1]==='number'&&row[1]<0)?index:null).filter(index=>index!==null));
    const forcedClassic=deck.slides.filter((slide,index)=>slide.chart.type==='pareto'&&slide.chart.data.columns.length>2||slide.chart.type==='world'&&plans[index].type!=='world'||negativeHistograms.has(index)||signedParetos.has(index)).length;
    assert.equal(chartExParts.length,mode==='fallback'?0:deck.slides.length-forcedClassic-(mode==='auto'?maps:0),id+': exact current chartEx count');
    assert.ok(!diagnostics.some(issue=>issue.adaptation==='series-dropped'),id+': no dropped series');
    for(const [index,slide] of deck.slides.entries()){
      const chart=slide.chart,pareto=chart.type==='pareto'&&chart.data.columns.length>2,world=chart.type==='world',box=chart.type==='box-and-whisker'&&chart.data.columns.length>2,negativeHistogram=negativeHistograms.has(index);
      if(signedParetos.has(index)){
        // Expected contract is independently constructed from this fixture's resolved values, not exporter metadata.
        const plan=plans[index],bars=plan.rows.filter(row=>typeof row[1]==='number').slice().sort((a,b)=>b[1]-a[1]);
        const total=bars.reduce((sum,row)=>sum+Math.max(0,row[1]),0);let running=0;
        const cumulativeName=plan.columns[1]+' — cumulative share';
        const data={columns:[...plan.columns,cumulativeName],rows:bars.map(row=>{running+=Math.max(0,row[1]);return[row[0],row[1],total?running/total:0];})};
        assertSignedParetoComboData(parts,classicNumber(index),data,contracts,id);
        const actual=imported.slides[index].chart;
        assert.equal(actual.type,'combo',id+': signed Pareto imports its actual editable combo');
        assert.deepEqual(actual.data.rows,data.rows,id+': complete sorted/derived public data');
        assert.deepEqual(actual.data.columns.map(column=>typeof column==='string'?column:column.name),data.columns,id+': actual series headings');
        assert.equal(actual.data.columns[2].format,'0%',id+': cumulative public format');
        const notices=diagnostics.filter(issue=>issue.path==='slides.'+index+'.chart'&&issue.code==='chart-data-adapted');
        assert.equal(notices.length,1,id+': one signed Pareto adaptation');assert.equal(notices[0].adaptation,'signed-pareto-combo');
        assert.match(notices[0].message,/negative.*descending.*static.*Import returns/s,id+': explicit representation/edit/import limitations');
        continue;
      }
      if(!pareto&&!world&&!box&&!negativeHistogram)continue;
      assert.deepEqual(imported.slides[index].chart.data,chart.data,id+': complete authored data/import mapping');
      // Box fallback deliberately groups samples under its column heading;
      // OPF_DATA separately restores Q1/Q2/Q3, checked above.
      const plotted=box?{columns:chart.data.columns,rows:chart.data.rows.map(row=>[chart.data.columns[0],...row.slice(1)])}:chart.data;
      // RR-105: a native box chart or map has no classic part (its mc:Fallback is the preview's picture); its workbook holds the same values.
      if(box&&mode!=='fallback')assertNativeBoxData(parts,plotted,contracts,id);
      else if(world&&plans[index].type==='world'&&mode==='native')assertNativePictureFallback(parts,index+1,plotted,contracts,id);
      else assertClassicChartData(parts,classicNumber(index),plotted,contracts,id);
      if(negativeHistogram){
        assert.equal(imported.slides[index].chart.type,'column',id+': signed categorical histogram imports its actual column representation');
        const notices=diagnostics.filter(issue=>issue.path==='slides.'+index+'.chart'&&issue.code==='chart-data-adapted');
        assert.equal(notices.length,1,id+': one signed-histogram adaptation');
        assert.equal(notices[0].adaptation,'chartex-fallback',id+': explicit data-domain fallback');
        assert.match(notices[0].message,/categorical histogram.*negative/i,id+': truthful limitation');
        assert.doesNotMatch(notices[0].message,/pass chartex|does not write|not yet accepted/,id+': native is not an override');
      }
      if(pareto||world&&plans[index].type!=='world'){
        assert.equal(imported.slides[index].chart.type,'column',id+': core column fallback import');
        assert.ok(diagnostics.some(issue=>issue.code==='chart-data-adapted'&&issue.adaptation==='chart-fallback'&&issue.path==='slides.'+index+'.chart'),id+': explicit current column fallback diagnostic');
      }
      if(world&&plans[index].type==='world'){
        assert.equal(imported.slides[index].chart.type,mode==='native'?'world':'column',id+': map/native versus classic fallback import');
        assert.ok(diagnostics.some(issue=>mode==='native'?issue.code==='chart-map-geodata':issue.code==='chart-data-adapted'&&issue.adaptation==='chartex-fallback'),id+': map mode diagnostic');
      }
    }
    cases.push({id,mode,chart:name,input:archive,archiveSha256:record.sha256,approvedFallbackSha256:mode==='fallback'?chartFixture.entries[name].sha256:null,chartExParts:chartExParts.length,slideCount:deck.slides.length,automaticControlEligible:deck.slides.length>=1&&deck.slides.length<=3&&shapeCounts.every(count=>count<=30),xmlShapeCounts:shapeCounts,roundTripEqual:isDeepStrictEqual(imported,deck),diagnostics,importedChartTypes:imported.slides.map(slide=>slide.chart?.type),nativeAcceptance:'pending'});
  }
  // Keep the single-series positive distinct from the current multi-series fallback.
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
  assert.equal(cases.filter(item=>item.input).length,30,'retain all 30 current positive chart archives');
  await put('inspection/chart-modes.json',json(cases));
  return {cases,files,chartBaselines};
}
