import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const root=new URL('./',import.meta.url),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(await readFile(new URL('manifest.json',root)));
for(const [file,digest] of Object.entries(manifest.files))assert.equal(hash(await readFile(new URL(file,root))),digest,file);
const read=async name=>JSON.parse(gunzipSync(await readFile(new URL(name,root))));
const summary=JSON.parse(await readFile(new URL('summary.json',root)));
let baseline;
for(const platform of ['Linux','macOS','Windows']){
  const data=await read(`painting-${platform}.json.gz`),record=summary.painting[platform];
  assert.equal(data.status,'passed');assert.deepEqual(data.errors,[]);assert.equal(data.node,'v24.20.0');assert.equal(data.browser,'153.0.8010.12');
  assert.equal(hash(gunzipSync(await readFile(new URL(`painting-${platform}.json.gz`,root)))),record.reportSha256);
  assert.deepEqual(data.requests,['https://opf-glyph-paint.test/','https://opf-glyph-paint.test/bundle.js','https://opf-glyph-paint.test/harfbuzz.wasm']);
  assert.equal(data.cases.length,663);assert.equal(new Set(data.cases.map(row=>JSON.stringify([row.id,row.text]))).size,663);
  const supported=data.cases.filter(row=>'ink' in row),rejected=data.cases.filter(row=>!('ink' in row));
  assert.equal(supported.length,650);assert.equal(rejected.length,13);assert.ok(rejected.every(row=>row.rejected==='missing-glyph'));
  for(const row of supported){
    assert.ok(row.ink>0);assert.equal(row.maxChannelDifference,0);assert.equal(row.differingPixels,0);
    assert.equal(row.sourceUnchanged,true);assert.equal(row.logicalText,row.text);assert.deepEqual(row.glyphs,row.expectedGlyphs);assert.equal(row.width,row.expectedWidth);
  }
  assert.equal(data.slides.length,5);
  for(const slide of data.slides){assert.equal(slide.headerInk,155);assert.equal(slide.footerInk,491);assert.equal(slide.logical,true);assert.equal(slide.selected,slide.expected);}
  assert.deepEqual(data.slides.map(slide=>slide.sha256),record.slideHashes);
  const fingerprint={cases:data.cases.map(({id,text,sourceSha256,glyphs,width,rejected})=>({id,text,sourceSha256,glyphs,width,rejected})),slides:record.slideHashes};
  if(baseline)assert.deepEqual(fingerprint,baseline);else baseline=fingerprint;
}
const native=await read('native-metrics-Linux.json.gz');assert.equal(native.observations.length,712);assert.deepEqual(native.errors,[]);
for(const backend of ['fontkit','harfbuzz']){
  const rows=native.observations.filter(row=>row.backend===backend),errors=rows.map(row=>Math.abs(row.measured-row.snapshots[0].advance));
  assert.equal(rows.length,356);
  for(const row of rows){assert.equal(row.measured,row.expected);assert.deepEqual(row.snapshots[1],row.snapshots[0]);assert.deepEqual(row.snapshots[2],row.snapshots[0]);}
  assert.deepEqual({observations:rows.length,failuresAtStrictPointOnePx:errors.filter(error=>error>=.1).length,maxAbsoluteErrorPx:Math.max(...errors)},summary.nativeMetricsLinux[backend]);
}
assert.equal(summary.nativeMetricsLinux.fontkit.failuresAtStrictPointOnePx,5);
assert.equal(summary.nativeMetricsLinux.harfbuzz.failuresAtStrictPointOnePx,0);
const ci=gunzipSync(await readFile(new URL('editor-b6e0fe9-ci.log.gz',root))).toString();
assert.equal((ci.match(/measured: 10 rich input browser workflows passed\./g)??[]).length,2);
assert.equal((ci.match(/estimated: 10 rich input browser workflows passed\./g)??[]).length,1);
console.log('Evidence verified: three exact painting matrices, matching five-slide hashes, preserved Linux native metric failure, and executed editor CI workflows.');
