// Explicit current-full-seven context, NEVER generic mixed-chart eligibility.
import assert from 'node:assert/strict';
import path from 'node:path';
import {assertSignedParetoComboData} from './chart-data-contract.mjs';
// RR-105 (#1290, 2026-11-12, chart workbook properties): the fixture file identity (sha256 and the byte count asserted below) moved because
// its `source` review record and `entries` export hashes moved; `decks` and `decks['all-seven']`, the source this context binds, are
// byte-identical (JSON.stringify compared against f3f0b2b1f). Previous: a4ade4939074e2f1b63f989e7e82c0ce83e162a470305341b3daee049de1e7b8, 68672 bytes.
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
export const SIGNED_PARETO_FIXTURE_SHA256='9db434794ee429312f7f7ea5f494aa0b0295ac54bc7c25497e414135f5b04852';
export const SIGNED_PARETO_FULL_SEVEN=Object.freeze({bytes:184592,sha256:'04c92723efe8485678dc087ab88506486542aee860ad7bc4db11005600ab55fb',producer:'6ea0cfb31dd7712fe6f09cddf98b2cbfb3484df3'});
const sourceData={columns:['Region','Value'],rows:[['North',42],['South',31],['East',-8],['West',19]]};
const plotted={columns:['Region','Value','Value — cumulative share'],rows:[['North',42,0.45652173913043476],['South',31,0.7934782608695652],['West',19,1],['East',-8,1]]};
const frozen=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(frozen);Object.freeze(value);}return value;};
const token=Object.freeze({kind:'current-full-seven-static-signed-pareto-v1'});
export function currentSignedParetoContext(source,fixture){
 assert.deepEqual(Object.keys(fixture).sort(),['path','bytes','sha256'].sort());assert.ok(path.isAbsolute(fixture.path));assert.equal(fixture.bytes,95027);assert.equal(fixture.sha256,SIGNED_PARETO_FIXTURE_SHA256);
 assert.equal(source.slides.length,7);assert.equal(source.slides[2].chart.type,'pareto');assert.deepEqual(source.slides[2].chart.data,sourceData);
 return frozen({token,fixture:structuredClone(fixture),source:structuredClone(source)});
}
export function assertCurrentSignedParetoContext(context,source){
 assert.ok(context&&context.token===token,'Explicit bound current signed-Pareto context required');assert.deepEqual(Object.keys(context).sort(),['token','fixture','source'].sort());
 assert.deepEqual(Object.keys(context.fixture).sort(),['path','bytes','sha256'].sort());assert.ok(path.isAbsolute(context.fixture.path));assert.equal(context.fixture.sha256,SIGNED_PARETO_FIXTURE_SHA256);assert.equal(context.fixture.bytes,95027);assert.equal(context.source.slides.length,7);assert.equal(context.source.slides[2].chart.type,'pareto');assert.deepEqual(context.source.slides[2].chart.data,sourceData);
 if(source)assert.deepEqual(source,context.source,'Signed-Pareto context differs from the separately bound entire source deck');return context;
}
export function assertCurrentSevenPublicData(document,source,context){
 assertCurrentSignedParetoContext(context,source);assert.equal(document.slides.length,7);
 for(let index=0;index<7;index++){
  if(index===2){
   assert.equal(document.slides[index].chart.type,'combo','Current signed Pareto imports its ACTUAL static combo, never old Pareto intent');
   assert.deepEqual(document.slides[index].chart.data,{columns:['Region','Value',{name:'Value — cumulative share',format:'0%'}],rows:plotted.rows},'Exact reviewed sorted/static cumulative public table required');
  }else assert.deepEqual(document.slides[index].chart.data,source.slides[index].chart.data,'Other original public data must remain exactly authored');
 }
}
export function inspectCurrentSignedPareto({parts,file,plot,book,deps,readSeries,context,slideIndex}){
 assertCurrentSignedParetoContext(context);assert.equal(slideIndex,3,'Only current whole-seven source Pareto may use the opt-in variant');assert.equal(file,'ppt/charts/chart3.xml','Unknown mixed part rename requires review');
 assert.deepEqual(Object.keys(plot).filter(key=>key.endsWith('Chart')),['c:barChart','c:lineChart']);
 assert.ok(plot['c:barChart']&&!Array.isArray(plot['c:barChart'])&&plot['c:lineChart']&&!Array.isArray(plot['c:lineChart']),'Exactly one bar and one line construct required');
 assert.deepEqual(Object.keys(plot).filter(key=>key.endsWith('Ax')),['c:catAx','c:valAx'],'Only the two reviewed axis kinds are allowed');
 const parser=new deps.XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,parseAttributeValue:false,trimValues:false});
 assertSignedParetoComboData(parts,3,plotted,{parser,fflate:deps},'bound-current-seven-signed-pareto');
 const list=value=>Array.isArray(value)?value:[value],bar=plot['c:barChart'],line=plot['c:lineChart'];
 for(const group of [bar,line])for(const series of list(group['c:ser']))for(const field of ['c:xVal','c:yVal','c:bubbleSize'])assert.equal(series[field],undefined,'Unknown extra numeric data vector requires review');
 assert.equal(line['c:grouping'].val,'standard');
 // Office omits the zero overlap on this exact one-bar-series clustered group.
 // Retain that raw omission; any present overlap must be exactly zero.
 if(Object.hasOwn(bar,'c:overlap'))assert.deepEqual(bar['c:overlap'],{val:'0'},'Current signed Pareto overlap must remain zero');
 assert.equal(line['c:marker'].val,'1');
 const pairIds=[bar,line].map(group=>list(group['c:axId']).map(axis=>axis.val));
 assert.deepEqual(pairIds,[['2094734554','2094734552'],['2094734555','2094734553']],'Unreviewed current axis identity/association change');
 const axes=[...list(plot['c:catAx']).map(node=>({kind:'category',node})),...list(plot['c:valAx']).map(node=>({kind:'value',node}))];
 const primary=axes.find(axis=>axis.node['c:axId'].val===pairIds[0][1]).node,secondary=axes.find(axis=>axis.node['c:axId'].val===pairIds[1][1]).node;
 // These are ACTUAL retained FULL-seven values, not inferred from a viewport or
 // copied from the first single-case witness. No dynamic scaling waiver.
 assert.equal(primary['c:scaling']['c:min'].val,'-20');assert.equal(primary['c:scaling']['c:max'].val,'50');assert.equal(primary['c:majorUnit'].val,'20');assert.equal(secondary['c:majorUnit'].val,'0.2');
 const groups=[bar,line].map((node,index)=>({construct:index?'c:lineChart':'c:barChart',axisIds:pairIds[index],series:list(node['c:ser']).map(series=>readSeries(series,book)),properties:structuredClone(node)}));
 assert.equal(groups[0].series.length,1);assert.equal(groups[1].series.length,1);
 return{family:'classic',construct:'currentSignedParetoComboV1',series:groups.flatMap(group=>group.series),groups,axes:structuredClone(axes),workbook:book};
}
