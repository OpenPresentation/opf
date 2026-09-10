// Run against the immutable core #67 evidence bundle after its manifest check.
// This imports existing native files; it does not launch Office or render them.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fromPptx} from '../../../dist/index.js';
const [evidenceRoot,output,mode='after']=process.argv.slice(2);
assert.ok(evidenceRoot&&output);assert.ok(['before','after'].includes(mode));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async file=>JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
const runtimeSha256=hash(await readFile(new URL('../../../dist/index.js',import.meta.url)));
const results=[],outliers=[];
const cellText=value=>typeof value==='string'?value:Array.isArray(value)?value.map(cellText).join(''):value&&typeof value==='object'?cellText(value.value??value.text):String(value??'');
for(const node of ['20','24']) {
  const tableRoot=path.join(evidenceRoot,`raw/table-node${node}-bounded-01`);
  const g=await json(tableRoot+'/generation.json'),n=await json(tableRoot+'/native.json');
  assert.equal(n.generationSha256,hash(await readFile(tableRoot+'/generation.json')));
  let tableImports=0,characters=0;
  for(const phase of ['original','reopened','edited'])for(const [index,slide]of g.expected.entries()) {
    const actual=n[phase][index];assert.equal(actual.cells.length,slide.cells.length);
    for(const [j,cell]of slide.cells.entries()) {
      const runs=structuredClone(cell.runs);if(phase==='edited'&&cell.row===2&&cell.column===1)runs[0].text='Native '+runs[0].text;
      const expectedCharacters=runs.flatMap(run=>Array.from(run.text,character=>({character,color:run.color})));
      assert.deepEqual(actual.cells[j],{row:cell.row,column:cell.column,text:runs.map(run=>run.text).join(''),characters:expectedCharacters});characters+=expectedCharacters.length;
    }
    assert.equal(actual.pngSha256,hash(await readFile(tableRoot+'/'+actual.png)));
    assert.equal(n.original[index].pngSha256,n.reopened[index].pngSha256);
  }
  for(const phase of ['original','saved','edited'])for(let cycle=0;cycle<=2;cycle++) {
    const file=cycle?`table-${phase}-reexport-${cycle}.pptx`:`table-colors${phase==='original'?'':'-'+phase}.pptx`;
    const bytes=await readFile(tableRoot+'/'+file);
    if(!cycle)assert.equal(hash(bytes),phase==='original'?g.pptxSha256:n[phase+'Sha256']);
    const document=await fromPptx(bytes);assert.equal(document.slides.length,6);
    for(const [index,slide]of document.slides.entries()) {
      const table=slide.table??slide.blocks?.find(block=>block.type==='table')?.table;assert.ok(table);
      for(const cell of g.expected[index].cells) {
        const value=cell.row===1?table.columns[cell.column-1]:table.rows[cell.row-2][cell.column-1];
        assert.equal(cellText(value),(phase==='edited'&&cell.row===2&&cell.column===1?'Native ':'')+cell.runs.map(run=>run.text).join(''));
      }
      tableImports++;
    }
  }
  const codeRoot=path.join(evidenceRoot,`raw/code-node${node}-bounded-01`),code=await json(codeRoot+'/generation.json');let codeImports=0;
  for(const deck of code.decks) {
    const native=await json(codeRoot+`/runs/${deck.id}/native.json`);assert.equal(native.generationSha256,hash(await readFile(codeRoot+'/generation.json')));
    assert.equal(native.decks.length,1);const record=native.decks[0];assert.equal(record.id,deck.id);
    for(const slide of record.slides) {
      assert.equal(slide.rasterSha256,hash(await readFile(codeRoot+`/${deck.id}-native-${slide.slide}.png`)));
      for(const line of slide.lines) {assert.equal(line.glyphsInsideCell,true);for(const tab of line.tabTargets)assert.ok(tab.errorPoints<=.02);}
    }
    for(const phase of ['original','saved','edited']) {
      const bytes=await readFile(codeRoot+`/${deck.id}${phase==='original'?'':'-'+phase}.pptx`);
      assert.equal(hash(bytes),phase==='original'?deck.pptxSha256:record[phase+'Sha256']);
      const document=await fromPptx(bytes);assert.equal(document.slides.length,deck.document.slides.length);
      for(const [index,slide]of document.slides.entries()) {
        let expected=structuredClone(deck.document.slides[index].code);
        if(phase==='edited') {if(typeof expected==='string')expected='NATIVE '+expected;else {expected.source='NATIVE '+expected.source;if(expected.filename)expected.filename='Saved '+expected.filename;}}
        assert.deepEqual(slide.blocks,[{type:'code',code:expected}]);codeImports++;
      }
    }
  }
  const quoteRoot=path.join(evidenceRoot,`raw/quote-node${node}-bounded-02`),quote=await json(quoteRoot+'/generation.json');let quoteImports=0;
  for(const deck of quote.decks) {
    for(const [file,digest]of Object.entries(deck.hashes)){assert.equal(path.basename(file),file);assert.equal(hash(await readFile(quoteRoot+'/'+file)),digest);}
    const native=await json(quoteRoot+`/runs/${deck.id}/native.json`);assert.equal(native.generationSha256,hash(await readFile(quoteRoot+'/generation.json')));
    const record=native.decks[0];assert.equal(native.decks.length,1);assert.equal(record.id,deck.id);assert.equal(record.editsReopened,deck.slides);
    for(const slide of record.slides) {assert.ok(slide.glyphsInsideCell&&slide.bodyBottom<=slide.footerTop);assert.equal(slide.rasterSha256,hash(await readFile(quoteRoot+`/${deck.id}-native-${slide.slide}.png`)));}
    for(const phase of ['original','saved','edited']) {
      const file=`${deck.id}${phase==='original'?'':'-native-'+phase}.pptx`,bytes=await readFile(quoteRoot+'/'+file);
      assert.equal(hash(bytes),phase==='original'?deck.hashes[file]:record[phase+'Sha256']);
      const document=await fromPptx(bytes);assert.equal(document.slides.length,deck.slides);
      for(const [index,slide]of document.slides.entries()) {
        const expected=deck.layouts[index].parts.flatMap(part=>part.fit.lines.filter(line=>line!=='').map(text=>({type:'text',text})));
        assert.equal(slide.title,phase==='edited'?`Native edit ${deck.id} slide ${index+1}`:'A quote and its source');
        if(slide.subtitle!==undefined) {
          assert.equal(slide.subtitle,expected[0].text);assert.deepEqual(slide.blocks,expected.slice(1));
          outliers.push({node,file,pptxSha256:hash(bytes),slide:index+1,expectedBodyLine:expected[0].text,actualSubtitle:slide.subtitle});
        } else assert.deepEqual(slide.blocks,expected);
        quoteImports++;
      }
    }
  }
  results.push({nativeNode:node,tableImports,nativeTableCharacterColorObservations:characters,codeImports,quoteImports});
}
await writeFile(output,JSON.stringify({evidenceCommit:'2024141c116e81608d3c6632b02c7bcbcd2a2bcc',node:process.version,runtimeSha256,reviewerSha256:hash(await readFile(new URL(import.meta.url))),mode,results,quoteRoleOutliers:outliers,scope:'Fresh imports of retained native fixtures and extra table export/import cycles; exact current content, native edits, raw character-color and reported bound/tab observations. No new Office execution, semantic quote recovery, font identity or native raster equivalence claim.'},null,2)+'\n');
assert.equal(outliers.length,mode==='before'?36:0);
console.log(`Native content review: 108 table + 48 code + 72 quote imports; ${outliers.length} quote-role outliers (${mode}).`);
