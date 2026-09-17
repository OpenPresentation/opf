import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fromPptx} from '../../opf-pptx/dist/index.js';
import {prepareNodeFonts} from '../../opf-render/dist/fonts-node.js';
const [root,output]=process.argv.slice(2);assert.ok(root&&output);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async file=>JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
const {options}=await prepareNodeFonts(),openHashes=new Set(await Promise.all(options.fontFiles.map(async file=>hash(await readFile(file)))));
const results=[],rasterSets=[];
for(const [node,attempt]of [['20','01'],['24','03']]){
  const directory=path.join(root,`raw/font-native-node${node}-${attempt}`),generation=await json(directory+'/generation.json'),native=await json(directory+'/native.json'),pdf=await json(directory+'/pdf-fonts.json');
  const expected=generation.fonts.map(face=>[face.family,face.bold,face.italic]);assert.equal(expected.length,9);
  for(const face of generation.fonts){const digest=hash(await readFile(directory+'/'+face.file));assert.equal(digest,face.sha256);assert.ok(openHashes.has(digest),'Native fixture must use the exact bundled open font bytes');}
  const parseName=name=>{const parts=name.replace(/^[A-Z]{6}\+/,'').split(',');assert.ok(parts.length<=2);const style=parts[1]??'';assert.ok(['','Bold','Italic','BoldItalic'].includes(style));return [parts[0],style.includes('Bold'),style.includes('Italic')];};
  const reported=pdf.pages.flatMap(page=>page.fontNames);const observed=[...new Set(reported)].map(parseName);
  const keys=values=>values.map(value=>JSON.stringify(value)).sort();assert.deepEqual(keys(observed),keys(expected));
  let imports=0;const documents=[];
  for(const file of ['selection.pptx','selection-saved.pptx']){
    const bytes=await readFile(directory+'/'+file);assert.equal(hash(bytes),file==='selection.pptx'?generation.pptxSha256:native.savedSha256);
    const actual=await fromPptx(bytes);assert.equal(actual.slides.length,7);assert.deepEqual(actual,await json(directory+'/'+file+'.import.opf.json'));documents.push(actual);imports+=actual.slides.length;
  }
  assert.deepEqual(documents[0],documents[1]);
  assert.equal(native.phases.length,2);
  for(const phase of native.phases){const seen=new Set(phase.slides.flatMap(slide=>slide.runs.map(run=>JSON.stringify([run.family,run.bold,run.italic]))));for(const face of keys(expected))assert.ok(seen.has(face));}
  const rasters=[];
  for(const page of pdf.pages){assert.equal(hash(await readFile(directory+'/'+page.raster)),page.rasterSha256);rasters.push(page.rasterSha256);}
  assert.equal(rasters.length,7);rasterSets.push(rasters);
  results.push({nativeNode:node,imports,outputFaces:observed.length,pdfRasters:rasters.length,rawPdfFontNames:pdf.rawPdfFontNames});
}
assert.deepEqual(rasterSets[0],rasterSets[1]);
await writeFile(output,JSON.stringify({evidenceCommit:'719ad1e9f3b205d3a3e2ba2f2141954936dcc521',node:process.version,reviewerSha256:hash(await readFile(new URL(import.meta.url))),converterSha256:hash(await readFile(new URL('../../opf-pptx/dist/index.js',import.meta.url))),results,scope:'28 fresh native original/saved slide imports; native character family/style presence and independently parsed retained PDF glyph-name observations; all nine fixture files match exact bundled open bytes; seven PDF raster pairs identical across native runtimes. No private PDF extraction, Office execution, glyph-level physical file identity, synthetic-effect absence or image-native acceptance claimed.'},null,2)+'\n');
console.log('28 native font slide imports, nine exact bundled faces, native/PDF output names and seven cross-runtime raster pairs verified.');
