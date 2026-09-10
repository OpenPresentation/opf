import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {prepareNodeFonts} from '@openpresentation/opf-render/fonts-node';
import {fromPptx} from '../dist/index.js';
import {sha,json,fingerprint} from './native-evidence.mjs';
const [mode,directory]=process.argv.slice(2);assert.ok(['generate','compare'].includes(mode));
const root=path.resolve(directory),runtime=await fingerprint(['test/font-variants.mjs','test/native-font-selection.mjs','test/native-font-selection.ps1','test/native-font-pdf.py','test/native-open-fonts.ps1']);
const write=(f,v)=>writeFile(path.join(root,f),JSON.stringify(v,null,2)+'\n');
if(mode==='generate'){
 await mkdir(root,{recursive:true});await assert.rejects(readFile(path.join(root,'generation.json')),e=>e.code==='ENOENT');
 execFileSync(process.execPath,['test/font-variants.mjs',path.join(root,'selection.json')],{stdio:'inherit'});
 const require=createRequire(new URL('../../opf-render/package.json',import.meta.url)),{create}=require('fontkit'),{options}=await prepareNodeFonts();
 const fonts=[];await mkdir(path.join(root,'fonts'));
 for(const [index,source]of options.fontFiles.entries()){
  const bytes=await readFile(source),font=create(bytes),file=`fonts/face-${index}.ttf`,style=font['OS/2'].fsSelection;
  await copyFile(source,path.join(root,file));await writeFile(path.join(root,`fonts/face-${index}.license.txt`),options.embeddedFonts[index].license);
  fonts.push({file,sha256:sha(bytes),family:font.getName('fontFamily','en'),bold:!!style.bold,italic:!!style.italic,postscriptName:font.postscriptName});
 }
 assert.equal(fonts.length,9);
 await write('generation.json',{node:process.version,runtime,fonts,pptxSha256:sha(await readFile(path.join(root,'selection.pptx'))),sourceSha256:sha(await readFile(path.join(root,'selection.opf.json'))),selectionSha256:sha(await readFile(path.join(root,'selection.json'))),slides:7});
}else{
 const g=await json(path.join(root,'generation.json')),native=await json(path.join(root,'native.json')),pdf=await json(path.join(root,'pdf-fonts.json'));
 assert.deepEqual(runtime,g.runtime);assert.equal(sha(await readFile(path.join(root,'selection.pptx'))),g.pptxSha256);assert.equal(native.generationSha256,sha(await readFile(path.join(root,'generation.json'))));
 const worker=await json(path.join(root,'worker.json'));assert.equal(worker.exitCode,0);assert.equal(worker.timedOut,false);
 const registrations=await json(path.join(root,'font-registration.json'));assert.equal(registrations.length,9);assert.ok(registrations.every(r=>r.added>0&&r.removed));
 assert.equal(pdf.generationSha256,native.generationSha256);assert.equal(pdf.pdfSha256,native.privatePdfSha256);assert.equal(pdf.passed,true);
 const key=f=>JSON.stringify([f.family,f.bold,f.italic]),required=new Set(g.fonts.map(key));
 const imports=[];
 for(const phase of native.phases){
  assert.equal(phase.slides.length,7);const seen=new Set(phase.slides.flatMap(s=>s.runs.map(key)));for(const face of required)assert.ok(seen.has(face),`Native character style missing: ${face}`);
  for(const slide of phase.slides)assert.equal(sha(await readFile(path.join(root,slide.png))),slide.sha256);
 }
 assert.deepEqual(native.phases[0].slides.map(s=>s.sha256),native.phases[1].slides.map(s=>s.sha256));
 for(const file of ['selection.pptx','selection-saved.pptx']){
  const bytes=await readFile(path.join(root,file));if(file.includes('-saved'))assert.equal(sha(bytes),native.savedSha256);
  const imported=await fromPptx(bytes);await write(file+'.import.opf.json',imported);imports.push(imported);
 }
 assert.deepEqual(imports[1],imports[0]);
 await write('comparison.json',{node:process.version,passed:true,nativeFaces:9,nativeSlides:14,identicalSaveReopenPngPairs:7,identicalCurrentContentSlideImports:14,temporaryFontRegistrationsRemoved:9,pdfFontFaces:pdf.observedFaces,scope:'Nine serialized physical font styles are observed in native character properties and native PDF output font names. This identifies output faces, not each glyph physical file, and does not establish browser/native pixel equivalence.'});
 console.log('Nine native styles and PDF output font names verified; seven stable save/reopen rasters, 14 identical current-content imports, nine temporary font registrations removed.');
}
