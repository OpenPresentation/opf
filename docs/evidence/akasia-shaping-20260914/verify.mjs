import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('./',import.meta.url);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=async name=>JSON.parse(await readFile(new URL(name,root),'utf8'));
const manifest=await read('manifest.json');
for(const item of manifest.files) {
  const bytes=await readFile(new URL(item.file,root));
  assert.equal(bytes.length,item.bytes,item.file); assert.equal(hash(bytes),item.sha256,item.file);
}
const fontkit=await read('fontkit-matrix.json'),python=await read('harfbuzz-matrix.json');
const javascript=await read('javascript-matrix.json'),browser=await read('browser-matrix.json');
const sourceHash=hash(await readFile(new URL('fontkit-matrix.json',root)));
for(const report of [python,javascript,browser])assert.equal(report.sourceSha256,sourceHash);
assert.equal(fontkit.fontkit,'2.0.4'); assert.equal(fontkit.faces.length,12); assert.equal(fontkit.samples.length,8568);
assert.equal(python.binding,'0.56.1'); assert.equal(javascript.binding,'harfbuzzjs@1.6.1');
for(const report of [python,javascript,browser]) {assert.equal(report.harfbuzz,'14.4.0');assert.equal(report.results.length,8568);}
assert.deepEqual(browser.errors,[]); assert.deepEqual(browser.externalRequests,[]);
assert.equal(browser.nodeAndBrowserGlyphRunsMatch,true);
assert.equal(browser.browserGlyphRunsSha256,hash(Buffer.from(JSON.stringify(javascript.results.map(({id,glyphs,width,outline})=>({id,glyphs,width,outline}))))));
assert.deepEqual(new Set(browser.requests.map(item=>item.path)),new Set(['/','/model.mjs','/hb/index.mjs','/hb/harfbuzz.js','/hb/harfbuzz.wasm']));
for(const asset of browser.requests.filter(item=>item.path!=='/'))assert.ok(manifest.browserAssets.some(item=>item.path===asset.path&&item.sha256===asset.sha256));
assert.equal(hash(await readFile(new URL('wrapping.png',root))),browser.screenshotSha256);
const ids=new Set(),outliers=[];
for(const [index,item]of fontkit.samples.entries()) {
  assert.ok(!ids.has(item.id));ids.add(item.id);
  const h=python.results[index],j=javascript.results[index],b=browser.results[index];
  for(const value of [h,j,b])assert.equal(value.id,item.id);
  assert.equal(b.text,item.text);assert.deepEqual(item.codepoints,[...item.text].map(value=>value.codePointAt(0)));
  const scalar=String.fromCodePoint(item.cp);
  assert.equal(item.text,item.form==='composed'?scalar:scalar.normalize('NFD'));
  assert.notEqual(scalar,scalar.normalize('NFD')); // Only explicitly generated fixture pairs.
  assert.deepEqual(j.glyphs,h.glyphs);
  const face=fontkit.faces.find(face=>face.id===item.face);assert.ok(face);
  const advance=h.glyphs.reduce((sum,glyph)=>sum+glyph.xAdvance,0)*32/face.unitsPerEm;
  assert.equal(advance,h.harfbuzzAt32);assert.equal(advance,j.harfbuzzAt32);assert.equal(advance,b.browserAt32);
  assert.equal(j.width*32,advance);assert.equal(b.harfbuzzAt32,advance);assert.equal(b.harfbuzzDelta,0);
  assert.equal(b.fontkitAt32,item.fontkitAt32);assert.equal(b.fontkitDelta,b.browserAt32-item.fontkitAt32);
  if(Math.abs(b.fontkitDelta)>=.1)outliers.push(b);
}
assert.equal(outliers.length,460);assert.equal(new Set(outliers.map(item=>item.cp)).size,46);
assert.ok(outliers.every(item=>item.form==='decomposed'));
assert.equal(Math.max(...outliers.map(item=>Math.abs(item.fontkitDelta))),5.203125);
for(const face of fontkit.faces) {
  const expected=manifest.fonts.find(item=>item.file===face.file);assert.ok(expected);
  assert.equal(face.sha256,expected.sha256);assert.equal(face.weight,expected.weight);assert.equal(face.italic,expected.italic);
  const cases=fontkit.samples.filter(item=>item.face===face.id);assert.equal(cases.length,714);
  assert.equal(cases.filter(item=>item.form==='composed').length,357);
  const summary=browser.summary.find(item=>item.file===face.file);assert.equal(summary.cases,714);
  assert.equal(summary.fontkitOutside01,outliers.filter(item=>item.face===face.id).length);
  assert.equal(summary.harfbuzzOutside01,0);assert.equal(summary.maxHarfbuzzDelta,0);
}
assert.equal(javascript.fits.length,3);
for(const [index,item]of javascript.fits.entries()) {
  const observed=browser.lines[index];assert.equal(observed.id,item.id);
  const boundaries=new Set([0,item.text.length,...[...new Intl.Segmenter('und',{granularity:'grapheme'}).segment(item.text)].map(segment=>segment.index)]);
  for(const [modeIndex,mode]of ['before','after'].entries()) {
    const fit=item[mode],lines=observed.modes[modeIndex].lines;assert.equal(fit.fontSize,32);
    assert.equal(fit.sourceLines.map(line=>item.text.slice(line.start,line.nextStart)).join(''),item.text);
    assert.equal(lines.length,fit.sourceLines.length);
    for(const [lineIndex,line]of fit.sourceLines.entries()) {
      for(const offset of [line.start,line.end,line.nextStart])assert.ok(boundaries.has(offset));
      assert.equal(lines[lineIndex].text,item.text.slice(line.start,line.end));assert.equal(lines[lineIndex].expected,line.width);
      assert.ok(Number.isFinite(lines[lineIndex].actual));
      assert.equal(lines[lineIndex].outside,lines[lineIndex].actual>item.width+.01);
      if(mode==='after') {assert.ok(!lines[lineIndex].outside);assert.ok(Math.abs(lines[lineIndex].actual-line.width)<.1);}
    }
  }
}
const under=browser.lines[0],over=browser.lines[1];
assert.equal(under.modes[0].lines.length,1);assert.equal(under.modes[0].lines[0].outside,true);
assert.equal(under.modes[0].lines[0].expected,233.90625);assert.equal(under.modes[0].lines[0].actual,285.9375);
assert.equal(under.modes[1].lines.length,2);assert.equal(over.modes[0].lines.length,2);assert.equal(over.modes[1].lines.length,1);
assert.deepEqual([...new Set(javascript.mappingControl.glyphs.map(glyph=>glyph.cluster))],[0,1,3,6]);
assert.ok(javascript.mappingControl.glyphs.some(glyph=>glyph.id===0));
const trace=await read('harfbuzz-trace.json');assert.equal(trace.text,'o\u0302\u0301');assert.ok(trace.trace.length>0);
const composed=trace.trace.find(item=>item.message==='end compose');assert.deepEqual(composed.buffer,[{value:7889,cluster:0}]);
const gsub=trace.trace.find(item=>item.message==="start table GSUB script tag 'latn'");assert.deepEqual(gsub.buffer,[{value:329,cluster:0}]);
console.log(JSON.stringify({verified:true,files:manifest.files.length,specimens:8568,retainedFontkitOutliers:460,
  harfbuzzAdvanceOutliers:0,sourcePreservation:true,wrappingCorrection:true,nativeAcceptance:false},null,2));
