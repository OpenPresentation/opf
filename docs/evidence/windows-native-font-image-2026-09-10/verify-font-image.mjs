import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const here=new URL('./',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
const bytes=f=>readFile(new URL(f,here)),json=async f=>JSON.parse((await bytes(f)).toString().replace(/^\uFEFF/,''));
for(const file of await readdir(here,{recursive:true}))assert.ok(!file.toLowerCase().endsWith('.pdf'),'Private PDFs excluded');
for(const binding of await json('bindings.json')){
 const dir=binding.generation.slice(0,-'generation.json'.length),g=await json(binding.generation);
 if(g.sourceSha256)assert.equal(sha(await bytes(dir+'selection.opf.json')),g.sourceSha256);
 if(g.selectionSha256)assert.equal(sha(await bytes(dir+'selection.json')),g.selectionSha256);
 for(const deck of g.decks??[])assert.equal(sha(await bytes(dir+deck.id+'.opf.json')),deck.sourceSha256);
 if(!dir.includes('/font-')){
  const undo=await json(dir+'editor-undo.json');assert.equal(undo.passed,true);assert.ok(undo.undoRestoresDocumentAndPptx&&undo.redoRestoresDocumentAndPptx&&undo.sourceUnchanged&&undo.staleGuardRejected);assert.equal(undo.atomicUndoDepth,1);
  assert.equal(undo.originalPptxSha256,g.decks.find(d=>d.id==='images-fit').pptxSha256);assert.equal(undo.editedPptxSha256,g.decks.find(d=>d.id==='images-editor-redo').pptxSha256);continue;
 }
 const native=await json(dir+'native.json'),pdf=await json(dir+'pdf-fonts.json'),worker=await json(dir+'worker.json'),registrations=await json(dir+'font-registration.json');
 assert.equal(worker.exitCode,0);assert.equal(worker.timedOut,false);assert.equal(worker.timeoutSeconds,45);
 assert.equal(native.generationSha256,sha(await bytes(binding.generation)));assert.equal(pdf.generationSha256,native.generationSha256);assert.equal(pdf.pdfSha256,native.privatePdfSha256);
 assert.equal(pdf.extractorSha256,sha(await bytes(binding.verifiers+'/native-font-pdf.py')));assert.equal(registrations.length,9);
 for(const registration of registrations){assert.ok(registration.added>0&&registration.removed);assert.equal(sha(await bytes(dir+registration.file)),registration.sha256);assert.equal(g.fonts.find(f=>f.file===registration.file).sha256,registration.sha256);}
 assert.equal(native.phases.length,2);
 for(const phase of native.phases){assert.equal(phase.slides.length,7);for(const slide of phase.slides)assert.equal(sha(await bytes(dir+slide.png)),slide.sha256);}
 assert.deepEqual(native.phases[0].slides.map(s=>s.sha256),native.phases[1].slides.map(s=>s.sha256));
 for(const page of pdf.pages)assert.equal(sha(await bytes(dir+page.raster)),page.rasterSha256);
 assert.equal(pdf.passed,!dir.includes('node24-02'));
 if(pdf.passed){
  assert.deepEqual(pdf.expectedFaces,pdf.observedFaces);assert.equal(pdf.observedFaces.length,9);
  assert.equal(sha(await bytes(dir+'selection-saved.pptx')),native.savedSha256);
  assert.deepEqual(await json(dir+'selection.pptx.import.opf.json'),await json(dir+'selection-saved.pptx.import.opf.json'));
 }
}
for(const name of ['images-native-node24-01','images-native-node24-02']){
 const root='raw/'+name+'/runs/images-fit/',worker=await json(root+'worker.json'),failure=await json(root+'failure.json');assert.equal(worker.exitCode,1);assert.equal(worker.timedOut,false);assert.equal(failure.stage,'open-original');assert.equal(failure.phases.length,0);
}
for(const name of ['image-open-opf-png','image-open-vendor-png']){
 const root='raw/'+name+'/',g=await json(root+'generation.json'),worker=await json(root+'worker.json');assert.equal(worker.exitCode,1);assert.equal(worker.timedOut,false);assert.equal(sha(await bytes(root+'source.pptx')),g.pptxSha256);
}
const timeout=await json('raw/image-native-created-01/worker.json');assert.equal(timeout.timedOut,true);assert.equal(timeout.timeoutSeconds,45);assert.equal(timeout.exitCode,-1);
console.log('Native font proofs, nine-face cleanup, editor undo sources and all failed image attempts verified; native image gate remains blocked.');
