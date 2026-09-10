// Evaluate Akasia release bytes against public upstream metric data only.
// This deliberately never opens any proprietary reference font binary.
import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import {createFontRegistry} from '../../../../opf-render/dist/fonts.js';
const require=createRequire(new URL('../../../../opf-render/package.json',import.meta.url)),fontkit=require('fontkit');
const [fontDirectory,dataDirectory,output]=process.argv.slice(2);assert.ok(fontDirectory&&dataDirectory&&output);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const ofl=await readFile(path.join(fontDirectory,'OFL.txt'));assert.ok(ofl.includes('SIL OPEN FONT LICENSE'));
const files=(await readdir(fontDirectory)).filter(file=>/^Akasia-.*\.ttf$/.test(file)).sort();assert.equal(files.length,12);
const entries=[],records=[];
for(const file of files) {
  const bytes=await readFile(path.join(fontDirectory,file)),font=fontkit.create(bytes),style=file.slice(7,-4),metadata=await readFile(path.join(dataDirectory,`aptos-${style}.json`)),reference=JSON.parse(metadata);
  const weight=font['OS/2'].usWeightClass,italic=font['OS/2'].fsSelection.italic;
  const expected=Object.keys(reference.advances).map(Number),actual=[...new Set(font.characterSet)],missing=expected.filter(cp=>!font.hasGlyphForCodePoint(cp));
  const deltas=[];let advancesChecked=0;
  for(const cp of expected.filter(cp=>font.hasGlyphForCodePoint(cp))) {
    const got=font.glyphForCodePoint(cp).advanceWidth/font.unitsPerEm,want=reference.advances[cp]/reference.upem;
    if(got!==want)deltas.push({codepoint:cp,actualEm:got,upstreamEm:want});advancesChecked++;
  }
  let pairsChecked=0,pairsMissing=0;const pairDeltas=[];
  for(const [left,right,want]of reference.kern) {
    if(!font.hasGlyphForCodePoint(left)||!font.hasGlyphForCodePoint(right)){pairsMissing++;continue;}
    const run=font.layout(String.fromCodePoint(left,right),{kern:true,liga:false,clig:false,calt:false});
    const got=run.positions.reduce((sum,p)=>sum+p.xAdvance,0)-font.glyphForCodePoint(left).advanceWidth-font.glyphForCodePoint(right).advanceWidth;
    if(got/font.unitsPerEm!==want/reference.upem)pairDeltas.push({left,right,actualEm:got/font.unitsPerEm,upstreamEm:want/reference.upem});pairsChecked++;
  }
  const ligatures=reference.ligatures.map(({codepoints,advance})=>{const run=font.layout(String.fromCodePoint(...codepoints));return {codepoints,glyphs:run.glyphs.length,actualEm:run.positions.reduce((sum,p)=>sum+p.xAdvance,0)/font.unitsPerEm,upstreamEm:advance/reference.upem};});
  records.push({file,sha256:sha(bytes),bytes:bytes.length,upstreamMetricSha256:sha(metadata),family:font.familyName,preferredFamily:font.getName('preferredFamily','en'),subfamily:font.subfamilyName,postscript:font.postscriptName,weight,italic,unitsPerEm:font.unitsPerEm,ascent:font.ascent,descent:font.descent,lineGap:font.lineGap,embeddingFlags:font['OS/2'].fsType,features:font.availableFeatures,coverage:{reportedEntries:font.characterSet.length,uniqueCodepoints:actual.length,upstreamCodepoints:expected.length,missing,extra:actual.filter(cp=>!Object.hasOwn(reference.advances,cp))},advancesChecked,advanceDeltas:deltas,pairsChecked,pairsMissing,pairDeltas,ligatures});
  entries.push({data:bytes,weight,italic,license:'OFL-1.1'});
}
const registry=createFontRegistry(entries,{substitutionPolicy:'none'});
const samples={latin:'AVATAR Toffee office affine 0123456789',greek:'Καλημέρα κόσμε Ελληνικά',cyrillic:'Привет мир Кириллица',combining:'A\u0301 a\u0308 o\u0302\u0301 n\u0303',currency:'€ £ ¥ $ ₹ ₿',arabic:'مرحبا بالعالم',hebrew:'שלום עולם',cjk:'世界你好',math:'∑ √ ∞ ≠ ≤ ≥'};
for(const record of records) {
  const style={fontFamily:'Akasia',fontWeight:record.weight,italic:record.italic};
  try {record.registryResolution=registry.resolveFont(style);record.samples=Object.entries(samples).map(([name,text])=>{try{return {name,text,widthAt32:registry.textMeasurement.measure(text,32,style),outlineAt32:registry.textMeasurement.outlineBounds(text,32,style)};}catch(error){return {name,text,errorCode:error.code,details:error.details};}});}catch(error){record.registryError={code:error.code,message:error.message};}
}
await writeFile(output,JSON.stringify({node:process.version,reviewerSha256:sha(await readFile(new URL(import.meta.url))),fontkitVersion:JSON.parse(await readFile(path.resolve(path.dirname(require.resolve('fontkit')),'../package.json'),'utf8')).version,release:'v0.0.2',releaseCommit:'18009a0d8cce4417dae9ca1253f57d9f55c033ce',releaseZipSha256:'ab87e75a4534c21d6d8e44d4299205f4f0863fccd2c6a8bb23049abac3949d7f',licenseSha256:sha(ofl),records,scope:'Actual openly licensed Akasia files versus public upstream metric JSON at the release commit. This is not an independent comparison with Aptos font binaries and does not establish native Office selection, full-script shaping, visual similarity, line wrapping or complete-slide equivalence.'},null,2)+'\n');
console.log(JSON.stringify(records.map(r=>({style:r.postscript,missing:r.coverage.missing.length,advanceDeltas:r.advanceDeltas.length,pairDeltas:r.pairDeltas.length,ligatureDeltas:r.ligatures.filter(l=>l.actualEm!==l.upstreamEm).length,resolution:r.registryResolution??r.registryError})),null,2));
