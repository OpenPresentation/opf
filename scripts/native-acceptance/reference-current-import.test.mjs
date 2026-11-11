// Current workspace public exports/imports only; no genuine consumer or Office claim.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {toPptx,fromPptx} from '../../packages/pptx/dist/index.js';
import {loadFonts} from '../../packages/render/dist/fonts-node.js';
import {gallery} from '../../packages/gallery/dist/index.js';
import {resolveChartData,validate} from '../../packages/javascript/dist/index.js';
import {readReferenceSources} from './reference-chart-fixtures.mjs';
import {archiveDependencies,inspectReferenceArchive,inspectCurrentReferenceStrokes} from './reference-chart-archive.mjs';
import {compareReferenceWitnessImports,compareCurrentReferenceWitnessImports} from './reference-chart-profile.mjs';
import {digest} from './identity.mjs';

const deps=archiveDependencies(),options={catalogs:[gallery],seed:1,timestamp:'2026-01-01T00:00:00Z',date:'2026-10-10',provenance:'full'};
const chartOf=slide=>slide.chart??slide.blocks.find(block=>block.chart).chart;
let prepared;
function fixtures(){
  prepared??=(async()=>{
    const rows=[];let fonts;
    for(const source of readReferenceSources()){
      const deck=structuredClone(source.document),original=structuredClone(deck),diagnostics=[];
      assert.equal(validate(deck,{catalogs:[gallery],only:['format','references']}).valid,true);
      fonts??=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:deck,renderOptions:{catalogs:[gallery]}});
      await fonts.ensure(deck,{renderOptions:{catalogs:[gallery]}});
      const bytes=Buffer.from(await toPptx(deck,{...options,fonts})),document=await fromPptx(bytes,{catalogs:[gallery],onDiagnostic:row=>diagnostics.push(row)});
      assert.deepEqual(deck,original,'Public export must preserve the entire authored source');
      const imported={document,diagnostics},imports={original:imported,'saved-reopened':imported};
      rows.push({source:deck,bytes,imports,archive:inspectReferenceArchive(bytes,deps)});
    }
    return rows;
  })();
  return prepared;
}
const compare=(f,imports=f.imports,bytes=f.bytes)=>compareCurrentReferenceWitnessImports(f.source,imports,{original:bytes,'saved-reopened':bytes},resolveChartData,deps);
function mutatePart(bytes,part,change){const parts=deps.unzipSync(bytes);assert.ok(parts[part]);const old=deps.strFromU8(parts[part]),next=change(old);assert.notEqual(next,old,'Mutation must change actual archive bytes');parts[part]=deps.strToU8(next);return Buffer.from(deps.zipSync(parts));}
function replaceOnce(xml,from,to){assert.equal(xml.split(from).length,2,'Exact mutation anchor required');return xml.replace(from,to);}
function ownership(bytes,part,change){return mutatePart(bytes,part,xml=>{let count=0;const next=xml.replace(/(<opf:references\b[^>]*\bdata=")([0-9A-Fa-f]+)(")/gu,(_all,start,hex,end)=>{count++;const value=JSON.parse(Buffer.from(hex,'hex').toString('utf8'));change(value);return start+Buffer.from(JSON.stringify(value)).toString('hex')+end;});assert.equal(count,1);return next;});}
function helper(f,slide,reference,change){const chart=f.archive.slides[slide-1].shapes.find(shape=>shape.kind==='chart'),id=chart.chart.ownership.helpers.find(row=>row.index===reference).id;return mutatePart(f.bytes,chart.chartPart,xml=>{let count=0;const next=xml.replace(/<c:ser\b[^>]*>[\s\S]*?<\/c:ser>/gu,series=>{const matches=[...series.matchAll(/<opf:reference\b[^>]*\bdata="([0-9A-Fa-f]+)"/gu)];if(matches.length===0)return series;assert.equal(matches.length,1);if(JSON.parse(Buffer.from(matches[0][1],'hex').toString('utf8')).id!==id)return series;count++;return change(series);});assert.equal(count,1);return next;});}

test('all four actual current public sources retain exact S4 Line and raw current ownership proof',async()=>{
  const rows=await fixtures();assert.equal(rows.length,4);
  for(const f of rows){const result=compare(f);assert.deepEqual(result.findings,[]);for(const phase of ['original','saved-reopened']){assert.equal(result.currentLineEvidence[phase].archiveSha256,digest(f.bytes));assert.ok(result.currentLineEvidence[phase].evidence.every(row=>typeof row.written==='string'));}}
  const f=rows[0],result=compare(f),first=chartOf(f.imports.original.document.slides[0]),defaults=chartOf(f.imports.original.document.slides[1]);
  assert.equal(first.referenceLines[1].stroke.width,1.5);assert.equal(Object.hasOwn(defaults.referenceLines[0],'stroke'),false);
  const evidence=result.currentLineEvidence.original.evidence,neutral=evidence.find(row=>row.slide===2&&row.reference===0);
  assert.equal(neutral.strokePresent,false);assert.equal(neutral.written,'12700|595959|255|dash');assert.equal(neutral.neutralContext.length,4);
  assert.deepEqual(compareReferenceWitnessImports(f.source,f.imports,f.archive.canvas,resolveChartData).map(({phase,slide,reference,code})=>({phase,slide,reference,code})),['original','saved-reopened'].flatMap(phase=>[{phase,slide:1,reference:1,code:'import-reference-value-label-style-differs'},{phase,slide:2,reference:0,code:'import-reference-value-label-style-differs'}]),'Legacy EMU/default-stroke expectations are unchanged, not silently upgraded');
});
test('historical immutable EMU receipt stays on the exact legacy path',async()=>{
  const folder=new URL('./test-fixtures/reference-width/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',folder))),bytes=fs.readFileSync(new URL('reference-native-lines.pptx',folder));
  assert.equal(bytes.length,manifest.bytes);assert.equal(digest(bytes),manifest.sha256);
  const source=readReferenceSources()[0].document,diagnostics=[],document=await fromPptx(bytes,{catalogs:[gallery],onDiagnostic:row=>diagnostics.push(row)}),result={document,diagnostics};
  assert.deepEqual(compareReferenceWitnessImports(source,{original:result,'saved-reopened':result},inspectReferenceArchive(bytes,deps).canvas,resolveChartData),[]);
});
for(const [name,change]of Object.entries({
  'missing written':row=>{delete row.helpers[1].written;},
  'stale written':row=>{row.helpers[1].written='1|087E8B|255|dot';},
  'foreign authored stroke':row=>{row.helpers[1].stroke.width=17;},
  'duplicate helper index':row=>{row.helpers[1].index=0;},
  'foreign helper id':row=>{row.helpers[1].id='Foreign';},
  'extra ownership property':row=>{row.helpers[1].future=true;},
}))test('current actual archive refuses '+name,async()=>{const f=(await fixtures())[0],part=f.archive.slides[0].shapes.find(shape=>shape.kind==='chart').chartPart,candidate=ownership(f.bytes,part,change);assert.throws(()=>compare(f,f.imports,candidate));});
test('authored absence cannot be replaced by an explicit materialized default in ownership',async()=>{
  const f=(await fixtures())[0],part=f.archive.slides[1].shapes.find(shape=>shape.kind==='chart').chartPart;
  const candidate=ownership(f.bytes,part,row=>{row.helpers[0].stroke={width:4/3,dash:'dash'};});assert.throws(()=>compare(f,f.imports,candidate));
});
for(const [name,from,to]of [
  ['EMU width','w="14288"','w="14289"'],['literal color','val="087E8B"','val="087E8C"'],
  ['dash','<a:prstDash val="dot"/>','<a:prstDash val="solid"/>'],
  ['alpha','<a:srgbClr val="087E8B">','<a:srgbClr val="087E8B"><a:alpha val="50000"/>'],
])test('current actual paint refuses changed '+name,async()=>{const f=(await fixtures())[0],candidate=helper(f,1,1,xml=>replaceOnce(xml,from,to));assert.throws(()=>compare(f,f.imports,candidate));});
for(const [name,from,to]of [
  ['scheme','val="tx1"','val="tx2"'],['transform value','<a:lumOff val="35000"/>','<a:lumOff val="35001"/>'],
  ['transform order','<a:lumMod val="65000"/><a:lumOff val="35000"/>','<a:lumOff val="35000"/><a:lumMod val="65000"/>'],
])test('current actual default paint refuses '+name,async()=>{const f=(await fixtures())[0],candidate=helper(f,2,0,xml=>replaceOnce(xml,from,to));assert.throws(()=>compare(f,f.imports,candidate));});
test('coherently changing native paint and written receipt cannot change the authored source',async()=>{
  const f=(await fixtures())[0],part=f.archive.slides[0].shapes.find(shape=>shape.kind==='chart').chartPart;
  for(const [from,to,written]of [['w="14288"','w="14289"','14289|087E8B|255|dot'],['val="087E8B"','val="087E8C"','14288|087E8C|255|dot']]){const changed=helper(f,1,1,xml=>replaceOnce(xml,from,to)),candidate=ownership(changed,part,row=>{row.helpers[1].written=written;});assert.throws(()=>compare(f,f.imports,candidate));}
});
test('current default requires actual theme, color map and unambiguous relationships',async()=>{
  const f=(await fixtures())[0],proof=inspectCurrentReferenceStrokes(f.bytes,f.source,deps),context=proof.evidence.find(row=>row.slide===2).neutralContext;
  assert.equal(context.length,4);const [slide,layout,master,theme]=context.map(row=>row.path);
  for(const [part,from,to]of [[theme,'<a:dk1><a:srgbClr val="000000"/></a:dk1>','<a:dk1><a:srgbClr val="010101"/></a:dk1>'],[master,'tx1="dk1"','tx1="lt1"'],[layout,'<a:masterClrMapping/>','<a:overrideClrMapping tx1="dk1"/>'],[slide,'<a:masterClrMapping/>','<a:overrideClrMapping tx1="dk1"/>']]){const candidate=mutatePart(f.bytes,part,xml=>replaceOnce(xml,from,to));assert.throws(()=>compare(f,f.imports,candidate));}
  const relationship=slide.replace(/\/([^/]+)$/u,'/_rels/$1.rels');
  const candidate=mutatePart(f.bytes,relationship,xml=>{const rows=[...xml.matchAll(/<Relationship\s[^>]*Type="[^"]*\/slideLayout"[^>]*\/>/gu)];assert.equal(rows.length,1);return xml.replace('</Relationships>',rows[0][0].replace(/Id="[^"]+"/u,'Id="duplicate-layout"')+'</Relationships>');});assert.throws(()=>compare(f,f.imports,candidate));
});
for(const [name,change]of Object.entries({
  width:c=>{c.referenceLines[0].stroke.width=17;},color:c=>{c.referenceLines[0].stroke.color='#123456';},dash:c=>{c.referenceLines[0].stroke.dash='dot';},
  'missing explicit stroke':c=>{delete c.referenceLines[0].stroke;},'materialized absent stroke':(_c,d)=>{chartOf(d.slides[1]).referenceLines[0].stroke={width:4/3,dash:'dash'};},
  value:c=>{c.referenceLines[0].value++;},label:c=>{c.referenceLines[0].label+='changed';},axis:c=>{c.referenceLines[0].axis='secondary';},endpoint:c=>{c.referenceLines[0].labelPosition='start';},
  'authored data':c=>{c.data.rows[0][1]++;},'helper count':c=>{c.referenceLines.push(c.referenceLines[0]);},'visible extra shape':(_c,d)=>{d.slides[0].shapes=[{shape:'rectangle'}];},
}))test('current import keeps exact shared-phase '+name+' checks',async()=>{const f=(await fixtures())[0],imports=structuredClone(f.imports);for(const result of Object.values(imports))change(chartOf(result.document.slides[0]),result.document);assert.notDeepEqual(compare(f,imports).findings,[]);});
test('current comparison retains full-document and diagnostic phase equality',async()=>{
  const f=(await fixtures())[0];for(const change of [r=>{r.document.name='Foreign';},r=>{r.diagnostics.push({code:'foreign-warning'});},r=>{r.document.slides[0].blocks=[...(r.document.slides[0].blocks??[]),{chart:structuredClone(chartOf(r.document.slides[0]))}];}]){const imports=structuredClone(f.imports);change(imports['saved-reopened']);assert.notDeepEqual(compare(f,imports).findings,[]);}
  assert.throws(()=>compareCurrentReferenceWitnessImports(f.source,f.imports,{original:f.bytes},resolveChartData,deps));
  const source=structuredClone(f.source);source.name+=' changed';assert.throws(()=>compareCurrentReferenceWitnessImports(source,f.imports,{original:f.bytes,'saved-reopened':f.bytes},resolveChartData,deps));
});
