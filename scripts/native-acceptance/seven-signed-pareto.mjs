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
// RR-105 (opf#1293, 2026-11-13, theme font references): the fixture's `source` review record and `entries` export hashes moved again;
// `decks` and `decks['all-seven']` are byte-identical to f75d6876b (JSON.stringify compared). Previous:
// 9db434794ee429312f7f7ea5f494aa0b0295ac54bc7c25497e414135f5b04852, 95027 bytes.
// 0.35 layout-record change (owner decision 2026-11-18): layout tags only; the fixture's `source` review record and `entries` export hashes moved,
// `decks` and `decks['all-seven']` are byte-identical to 1f47d14a7 (JSON.stringify compared). Previous: 0cb03a44684d456be94905c7382e34db19f8f1def7d984388f06fcb10b3de255, 99005 bytes.
// 0.35 region names (owner decision 2026-11-18): layout tags and placeholder names only; the fixture's `source` review record and `entries`
// export hashes moved (32 ppt/tags/opfLayout*.xml parts and 32 slide layouts whose only change is the placeholder names from region names),
// `decks` and `decks['all-seven']` are byte-identical to a8e81dbbb (JSON.stringify compared). Previous: 8d0c1d0ab86f60228cad66a7eebd229e84bf80bc6608d85d12434dec20d2c5ca, 103275 bytes.
// 0.35 one arrangement key (owner decision 2026-11-18): layout tags only; the fixture's `source` review record and `entries` export hashes moved (the 6 ppt/tags/opfLayout*.xml parts of
// agenda, agenda-split, process, flow, vertical-flow and inverted-pyramid, whose record hash changed), `decks` and `decks['all-seven']` are
// byte-identical to 6578ab9db (JSON.stringify compared). Previous: 5de19d097657910b0340229eb12b2a83a15161adc9ff1f6054b95a64996ad4fa, 107253 bytes.
// 0.35 process absorbs flow (owner decision 2026-11-18): layout removed and renamed only; the fixture's `source` review record and `entries` export hashes moved (the
// `flow` slide layout and its ppt/tags/opfLayout*.xml part removed with the later parts renumbered and the master, content-type and rels entries retargeted, `vertical-flow`
// renamed `vertical-process` in its cSld name and tag, the process tag's record hash), `decks` and `decks['all-seven']` are byte-identical to 58735de64 (JSON.stringify compared).
// Previous: 928b07663065f457e6e395cb09036b9169a5018e4affbd1667e19d24b978e5bd, 111231 bytes.
// 0.35 one row-or-column vocabulary (owner decision 2026-11-18): layout tags only; the fixture's `source` review record and `entries` export hashes moved
// (the 24 ppt/tags/opfLayout*.xml parts of the records that said flow none or design.contentDirection, whose record hash changed), `decks` and `decks['all-seven']` are byte-identical to eed73db34 (JSON.stringify compared). Previous: 32c2fc609ac9aada2645e3a49e054833b9b24f03c449af76b9e80937c9cf9ccb, 115209 bytes.
// 0.35 titlePosition (owner decision 2026-11-18): layout removed; layout tags only; the fixture's `source` review record and `entries` export hashes moved
// (the agenda-split slide layout and its ppt/tags/opfLayout*.xml part removed with the later parts renumbered and the master sldLayoutId list, master rels and [Content_Types].xml retargeted; the record hashes of the cycle, matrix and vertical-process tags; no slide layout geometry or placeholder name changed), `decks` and `decks['all-seven']` are byte-identical to 6d60192cb (JSON.stringify compared). Previous: e313155690ef2afcc4607e20961651773e6f2d21cd013a8142ec39bad37ba872, 119187 bytes.
// 0.35 integration merged with main (owner decision 2026-11-18): layout tags, removals and renames only; the fixture's `source` review record and `entries` export hashes moved
// (only the org-chart ppt/tags/opfLayout*.xml part (its record hash; the record's description) differs from the export of the branch before the merge, 2baa023fe; against the export of main 5ffcef407 every part differs only in the ppt/tags/opfLayout*.xml parts, slide-layout placeholder names from the region names, the removed flow and agenda-split slide layouts and tags (later parts renumbered; master sldLayoutId list and rels, [Content_Types].xml and layout/slide rels retargeted) and vertical-flow renamed vertical-process; no slide, chart, media or theme part differs), `decks` and `decks['all-seven']` are byte-identical to 2baa023fe (JSON.stringify compared). Previous: 75a17041a837b7e48ad2326472afbceae4236c5bd1294f4a84a221b57e3f5588, 123165 bytes.
// 0.35 list columns by default (owner decision 2026-11-18): layout tags only; the fixture's `source` review record and `entries` export hashes moved
// (only the ppt/tags/opfLayout*.xml parts of agenda, faq and list differ (their record hashes: the records dropped listColumns); no slide layout, slide, chart, media or theme part differs), `decks` and `decks['all-seven']` are byte-identical to 175b55711 (JSON.stringify compared). Previous: 95f3243a580f78d8406fbfb561da78ab0f1d30654f5cd4bde6b0d80d66632629, 127143 bytes.
// 0.35 script default fonts (owner decision 2026-11-23): the Japanese default is Yu Gothic; the fixture's `source` review record and note and the `world-category` entry's export hash moved
// (only the world-category archive differs, in the family name Meiryo to Yu Gothic in its theme, chart, docProps font list and document tag; the all-seven archive is byte-identical), `decks` and `decks['all-seven']` are byte-identical to 9523eddc3 (JSON.stringify compared). Previous: 11c3bdee061e5a918ccda94af789bfa3aacc20d5e94df9deaf0145e86f20787e, 131121 bytes.
// 0.35.1 column anchors (owner decision 2026-11-23): layout tags only; the fixture's `source` review record and `entries` export hashes moved
// (only the ppt/tags/opfLayout*.xml parts of two-column and three-column differ (their record hashes: the records' anchor went from bottom to middle); no slide layout, slide, chart, media or theme part differs), `decks` and `decks['all-seven']` are byte-identical to 919a4d703 (JSON.stringify compared). Previous: 813dc9dbc56127f4e7de59d55d610bd17a75ce693a35666632b1d585b7786320, 133208 bytes.
// LH-194 to LH-199, the layout-sweep fixes (owner decision 2026-11-24, "Yes, refresh them"): the fixture's `source` review record and `entries` export hashes moved
// (in all nine archives the ppt/tags/opfLayout*.xml parts of agenda, pillars, chart-beside, code, dashboard and team differ (their record hashes: the sweep's anchor, flow and card changes); in all-seven also ppt/charts/chart7.xml, the column chart with negative values, whose plot area is now written with layoutTarget inner (the negative-bar fix); no other part differs), `decks` and `decks['all-seven']` are byte-identical to af413076e (JSON.stringify compared). Previous: 5f18de2c82ef725851fe32fa13550f30154f44d372704017911a68969efcef86, 137186 bytes.
// opf#1415, choices 1 to 3, the chart label fix and option D (owner decision 2026-11-24, "Yes, refresh them"): the fixture's `source` review record and `entries` export hashes moved
// (in all nine archives only ppt/charts/chart*.xml differ: every data label body is written with wrap="none" (choice 2); in pareto-multi the plot area is also written as the preview's plot, layoutTarget inner (the chart label fix); no other part differs), `decks` and `decks['all-seven']` are byte-identical to 6f7548244 (JSON.stringify compared). Previous: 2dbbf5095eb4577ca67ec13e261a6acef349d0857ceda5157c27089552e4f9c3, 141164 bytes.
export const SIGNED_PARETO_FIXTURE_SHA256='7d4ba6e2eb9b105a21797a32b5d8f4ab5e6f051c47dd943ba7788e9bfdb3e395';
export const SIGNED_PARETO_FULL_SEVEN=Object.freeze({bytes:184592,sha256:'04c92723efe8485678dc087ab88506486542aee860ad7bc4db11005600ab55fb',producer:'6ea0cfb31dd7712fe6f09cddf98b2cbfb3484df3'});
const sourceData={columns:['Region','Value'],rows:[['North',42],['South',31],['East',-8],['West',19]]};
const plotted={columns:['Region','Value','Value — cumulative share'],rows:[['North',42,0.45652173913043476],['South',31,0.7934782608695652],['West',19,1],['East',-8,1]]};
const frozen=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(frozen);Object.freeze(value);}return value;};
const token=Object.freeze({kind:'current-full-seven-static-signed-pareto-v1'});
export function currentSignedParetoContext(source,fixture){
 assert.deepEqual(Object.keys(fixture).sort(),['path','bytes','sha256'].sort());assert.ok(path.isAbsolute(fixture.path));assert.equal(fixture.bytes,145142);assert.equal(fixture.sha256,SIGNED_PARETO_FIXTURE_SHA256);
 assert.equal(source.slides.length,7);assert.equal(source.slides[2].chart.type,'pareto');assert.deepEqual(source.slides[2].chart.data,sourceData);
 return frozen({token,fixture:structuredClone(fixture),source:structuredClone(source)});
}
export function assertCurrentSignedParetoContext(context,source){
 assert.ok(context&&context.token===token,'Explicit bound current signed-Pareto context required');assert.deepEqual(Object.keys(context).sort(),['token','fixture','source'].sort());
 assert.deepEqual(Object.keys(context.fixture).sort(),['path','bytes','sha256'].sort());assert.ok(path.isAbsolute(context.fixture.path));assert.equal(context.fixture.sha256,SIGNED_PARETO_FIXTURE_SHA256);assert.equal(context.fixture.bytes,145142);assert.equal(context.source.slides.length,7);assert.equal(context.source.slides[2].chart.type,'pareto');assert.deepEqual(context.source.slides[2].chart.data,sourceData);
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
