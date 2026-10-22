// Empirical Windows native font study; no runtime policy is inferred from a fit.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.resolve('@openpresentation/opf-render/package.json'));
const {create}=require('fontkit');
const [mode,directory='artifacts/native-font-advances']=process.argv.slice(2);
assert.ok(['generate','compare'].includes(mode));
const root=path.resolve(directory),hash=b=>createHash('sha256').update(b).digest('hex');
await mkdir(root,{recursive:true});
const load=async f=>JSON.parse((await readFile(path.join(root,f),'utf8')).replace(/^\uFEFF/,''));
const write=(f,value)=>writeFile(path.join(root,f),JSON.stringify(value,null,2)+'\n');
const harness={};for(const file of ['native-font-advances.mjs','native-font-advances.ps1'])harness[file]=hash(await readFile(new URL(file,import.meta.url)));
if(mode==='generate'){
  const samples=['0','42','Left','Right  ','Exact','context','flat','Latency','Completion','milliseconds across all completed production requests','AVATAR To Wa','office afflict efficient','a\u0301 café Ω Δ','Привет 123','مرحبا','  leading  trailing  '];
  const fonts=[],cases=[];
  for(const [family,regular,bold]of [['Calibri','calibri.ttf','calibrib.ttf'],['Arial','arial.ttf','arialbd.ttf'],['Times New Roman','times.ttf','timesbd.ttf'],['Courier New','cour.ttf','courbd.ttf']])for(const [file,weight]of [[regular,400],[bold,700]]){
    const bytes=await readFile(path.join(process.env.WINDIR??'C:/Windows','Fonts',file)),font=create(bytes);
    fonts.push({family,weight,file,sha256:hash(bytes),version:font.version,postscriptName:font.postscriptName,unitsPerEm:font.unitsPerEm});
    for(const requestedSize of [9,10.125,12,13.5,18,24,42.75,57])for(const text of samples){
      const size=Math.round(requestedSize*100)/100;
      const missing=[...new Set(Array.from(text).filter(c=>!font.hasGlyphForCodePoint(c.codePointAt(0))))];
      if(missing.length){cases.push({id:cases.length,family,weight,requestedSize,size,text,missing});continue;}
      const nominal=font.layout(text),features={liga:false,clig:false,calt:false,kern:size>=12},run=font.layout(text,features);
      const advance=r=>r.positions.reduce((s,p)=>s+p.xAdvance,0)/font.unitsPerEm*size;
      const predicted=run.glyphs.reduce((s,g,i)=>s+Math.round(g.advanceWidth/font.unitsPerEm*size*8)/8+(run.positions[i].xAdvance-g.advanceWidth)/font.unitsPerEm*size,0);
      cases.push({id:cases.length,family,weight,requestedSize,size,text,nominal:advance(nominal),featureControlled:advance(run),predicted,glyphCount:run.glyphs.length});
    }
  }
  await write('generation.json',{node:process.version,harness,fonts,cases,scope:'Local reference-font bytes only. Test hypothesis: disable optional liga/clig/calt, use default native kerning threshold 12pt, and quantize base glyph advances to 1/8pt before preserving GPOS adjustments. This is an empirical candidate, not a shipped font profile or general native-fidelity guarantee.'});
  console.log(`Prepared ${cases.length} cases across ${fonts.length} reference faces; ${cases.filter(c=>c.missing).length} explicit missing-glyph cases.`);
}else{
  const generation=await load('generation.json'),native=await load('native.json');assert.deepEqual(generation.harness,harness);
  assert.equal(native.generationSha256,hash(await readFile(path.join(root,'generation.json'))));
  const eligible=generation.cases.filter(c=>!c.missing);assert.equal(native.cases.length,eligible.length);
  const results=native.cases.map((actual,i)=>{
    const c=eligible[i];assert.equal(actual.id,c.id);assert.equal(actual.text,c.text);assert.equal(actual.font,c.family);assert.equal(actual.size,c.size);assert.equal(actual.bold,c.weight>=600?-1:0);
    assert.equal(actual.kerning,12);assert.equal(actual.spacing,0);
    const nativeFontNames={latin:actual.font,complexScript:actual.complexScriptFont,eastAsian:actual.eastAsianFont};
    return {...c,nativeFontNames,unresolvedThemeSlots:Object.entries(nativeFontNames).filter(([,name])=>name.startsWith('+')).map(([slot])=>slot),nativeLanguage:actual.language,nativeWidth:actual.width,nominalError:actual.width-c.nominal,controlledError:actual.width-c.featureControlled,predictedError:actual.width-c.predicted};
  });
  const tolerance=.02,groups=generation.fonts.map(font=>{const rows=results.filter(r=>r.family===font.family&&r.weight===font.weight);return {family:font.family,weight:font.weight,cases:rows.length,nominalWithinTolerance:rows.filter(r=>Math.abs(r.nominalError)<=tolerance).length,predictedWithinTolerance:rows.filter(r=>Math.abs(r.predictedError)<=tolerance).length,maxNominalError:Math.max(...rows.map(r=>Math.abs(r.nominalError))),maxPredictedError:Math.max(...rows.map(r=>Math.abs(r.predictedError)))};});
  await write('comparison.json',{harness,powerPoint:native.executableVersion,windows:native.windowsBuild,tolerancePoints:tolerance,groups,results,scope:'Exploratory native source-character advance measurements, not a conformance pass. Each sample uses a fresh native textbox, explicit UTF-8 input and requested Latin/complex-script/East-Asian font names. Office may retain a theme token in a font slot; all reported names are recorded. These names do not establish the actual font file used for every glyph. Reference file hashes describe fontkit inputs only. Matching a finite matrix does not identify the native implementation or establish browser/native glyph outlines, baselines, raster equivalence, arbitrary scripts, fonts or other application versions. Outliers remain in results; no default measurement behavior changes.'});
  console.log(JSON.stringify(groups,null,2));
}
