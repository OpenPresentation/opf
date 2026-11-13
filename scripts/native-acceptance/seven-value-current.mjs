// Current-corpus admission. Historical checkpoint03 remains a separate contract.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest,fileIdentity} from './identity.mjs';
import {inspectSevenArchive,archiveDependencies} from './seven-chart-archive.mjs';
import {bindSingleSevenValueTarget,comparePersistedSevenValueEdit} from './seven-value-archive.mjs';
import {assertSevenValueRawPreservation} from './seven-value-raw.mjs';
import {currentSignedParetoContext} from './seven-signed-pareto.mjs';

export const CURRENT_SEVEN_FIXTURE='packages/pptx/test/fixtures/chartex-fallback-main.json';
// RR-105 (#1290, 2026-11-12, chart workbook properties): the fixture's `source` review record and `entries` export hashes moved; its
// `decks` (and `decks['all-seven']`, the only part this route reads) are byte-identical, checked by comparing JSON.stringify of
// `decks` and of `decks['all-seven']` against f3f0b2b1f. Previous: a4ade4939074e2f1b63f989e7e82c0ce83e162a470305341b3daee049de1e7b8.
// RR-105 (#1290, 2026-11-12, notes page size): the fixture's `source` review record and `entries` export hashes moved again; `decks`
// is byte-identical to 885219b9c (JSON.stringify compared). Previous: 7bb6762cbebe0a704485dcb35021952480fde034ec73b0d89a78bd186b21a0c0, 73099 bytes.
// RR-105 (#1290, 2026-11-12, document properties): the fixture's `source` review record and `entries` export hashes moved again; `decks`
// is byte-identical to 6e4da7119 (JSON.stringify compared). Previous: 6941c0b445ad2ad8cd930cd23b15435e57fb6eada0631c57f5b38566d7a5482b, 77459 bytes.
// RR-105 (#1290, 2026-11-12, Company from the organization): the fixture's `source` review record and `entries` export hashes moved
// again; `decks` is byte-identical to af10f356f (JSON.stringify compared). Previous: 462a069d533106c5a8e856b34fb204ecdb803a97c5db7441f47f5f87834c8858, 81848 bytes.
// RR-105 (#1290, 2026-11-12, default alt text): the fixture's `source` review record and `entries` export hashes moved again;
// `decks` is byte-identical to ed9f0f909 (JSON.stringify compared). Previous: cc7c4ea6175a67089ad6bf800a3a05a6d0cffdb8ce87e1c824efaaa34e6f6dc8, 86226 bytes.
// RR-105 (#1290, 2026-11-12, layout names): the fixture's `source` review record and `entries` export hashes moved again;
// `decks` is byte-identical to 6d0ba7d86 (JSON.stringify compared). Previous: 5012eee13db635e6228479af1681adb1e9a9cd1c51dd6254d517bbcfb3aadd91, 90652 bytes.
export const CURRENT_SEVEN_FIXTURE_SHA256='9db434794ee429312f7f7ea5f494aa0b0295ac54bc7c25497e414135f5b04852';
export const CURRENT_VALUE_PROFILE='seven-chart-treemap-single-value-edit-v1';
export function currentSevenSource(root=fileURLToPath(new URL('../../',import.meta.url))){
 const bytes=fs.readFileSync(path.join(root,CURRENT_SEVEN_FIXTURE));
 assert.equal(digest(bytes),CURRENT_SEVEN_FIXTURE_SHA256,'Current source fixture identity changed');
 return JSON.parse(bytes).decks['all-seven'];
}
export function currentSevenArchiveContext(root=fileURLToPath(new URL('../../',import.meta.url)),source=currentSevenSource(root)){
 assert.deepEqual(source,currentSevenSource(root));const file=path.join(root,CURRENT_SEVEN_FIXTURE);
 return currentSignedParetoContext(source,{path:file,...fileIdentity(file)});
}
export function classifyCurrentSeven(archive,source){
 assert.equal(source.slides.length,7);assert.equal(archive.slides.length,7);
 return source.slides.map((slide,index)=>{
  // RR-105: a chartex chart's mc:Fallback is a picture of OPF's preview (shape kind 'picture'); only an export without a rasterizer
  // keeps the classic chart there.
  const charts=archive.slides[index].shapes.filter(shape=>shape.kind==='chart'),pictures=archive.slides[index].shapes.filter(shape=>shape.kind==='picture'),type=slide.chart.type;
  if(type==='histogram'||type==='world'){
   assert.equal(charts.length,1,'Current adapted source must expose one direct chart');assert.equal(pictures.length,0,'A direct chart has no fallback picture');
   assert.equal(charts[0].branch,'direct');assert.equal(charts[0].chart.family,'classic');assert.equal(charts[0].chart.construct,'c:barChart');
   assert.equal(charts[0].chart.series.length,1);assert.deepEqual(charts[0].chart.series[0]['c:val'].values,slide.chart.data.rows.map(row=>row[1]));
   assert.deepEqual(charts[0].chart.series[0]['c:cat'].values,slide.chart.data.rows.map(row=>row[0]));
   assert.deepEqual(charts[0].chart.workbook.cells,[slide.chart.data.columns,...slide.chart.data.rows].flatMap((row,index)=>row.map((value,column)=>({cell:String.fromCharCode(65+column)+(index+1),value}))),'Current classic adaptation must preserve its complete untransformed source table');
   return{slideIndex:index+1,sourceType:type,representation:'classic-column-fallback',editableHere:false,nativeTypeQualified:false};
  }
  if(type==='pareto'){
   assert.equal(charts.length,1);assert.equal(pictures.length,0);assert.equal(charts[0].branch,'direct');assert.equal(charts[0].chart.family,'classic');assert.equal(charts[0].chart.construct,'currentSignedParetoComboV1');
   return{slideIndex:index+1,sourceType:type,representation:'unreviewed-static-signed-pareto-classic-combo',editableHere:false,nativeTypeQualified:false};
  }
  if(type==='treemap'){
   assert.equal(charts.length+pictures.length,2,'Treemap requires Choice plus Fallback');assert.deepEqual([...charts,...pictures].map(shape=>shape.branch),['choice','fallback']);
   assert.equal(charts[0].chart.family,'chartEx');if(!pictures.length)assert.equal(charts[1].chart.family,'classic');
   return{slideIndex:index+1,sourceType:type,representation:'chartEx-choice',editableHere:true,nativeTypeQualified:false};
  }
  // Do not freeze an unreviewed Pareto/Box/other target to an old native model.
  // Their ACTUAL unedited representation is bound in the envelope and raw guard.
  const branches=[...charts,...pictures];assert.ok(branches.length===1||branches.length===2);assert.ok(pictures.length<=1);
  if(branches.length===1){assert.equal(charts[0].branch,'direct');assert.equal(charts[0].chart.family,'classic');}
  else{assert.deepEqual(branches.map(shape=>shape.branch),['choice','fallback']);assert.equal(charts[0].chart.family,'chartEx');if(!pictures.length)assert.equal(charts[1].chart.family,'classic');}
  return{slideIndex:index+1,sourceType:type,representation:branches.length===1?'unreviewed-classic-fallback':'unreviewed-chartEx-choice',editableHere:false,nativeTypeQualified:false};
 });
}
export function bindCurrentTreemap(input,source,selection,{root,deps=archiveDependencies()}={}){
 assert.deepEqual(source,currentSevenSource(root),'Current source is not the reviewed exact all-seven deck');
 assert.deepEqual(Object.keys(selection).sort(),['newValue','pointIndex','seriesIndex','slideIndex'].sort());
 const archiveContext=currentSevenArchiveContext(root,source),archive=inspectSevenArchive(input,deps,archiveContext),classification=classifyCurrentSeven(archive,source);
 const selected=classification[selection.slideIndex-1];assert.ok(selected?.editableHere&&selected.sourceType==='treemap','Only current treemap is reviewed; fallback/Box/Pareto/other targets refuse');
 const arrays=archive.slides.flatMap(slide=>slide.shapes.filter(shape=>shape.kind==='chart').flatMap(shape=>shape.chart.family==='classic'?shape.chart.series.map(series=>series['c:val'].values):shape.chart.caches.flatMap(cache=>cache.dimensions.filter(dim=>dim.kind==='cx:numDim').map(dim=>dim.values))));
 assert.ok(arrays.length>0);const maximum=Math.max(...arrays.map(values=>values.length));
 // This is a derived current-input result, NOT the historical46-array census.
 assert.equal(maximum,4,'Current input no longer matches the existing four-value action bound');
 const bound=bindSingleSevenValueTarget(input,source,{...selection,branch:'choice'},{deps,archiveContext});
 assert.equal(bound.action.sourceType,'treemap');assert.equal(bound.action.comChartType,117);
 return{...bound,archiveContext,classification,census:{arrays:arrays.length,maximum},representation:'native-treemap-choice'};
}
export function compareCurrentTreemapEdit(options){
 const rebound=bindCurrentTreemap(options.input,options.source,{slideIndex:options.action.slideIndex,seriesIndex:1,pointIndex:options.action.pointIndex,newValue:options.action.newValues[options.action.pointIndex-1]},{root:options.root,deps:options.deps});
 const current={...options,archiveContext:rebound.archiveContext};
 const parsed=comparePersistedSevenValueEdit(current);
 const raw=assertSevenValueRawPreservation(current);
 return{...parsed,profile:CURRENT_VALUE_PROFILE,rawOoxmlStyleFidelity:'strict-current-raw-signature-match',raw,nativeAcceptance:false,registryAcceptance:false,nativeMapQualified:false};
}
