// Independent imports of immutable native evidence; no Office automation.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fromPptx} from '../../opf-pptx/dist/index.js';
const [root,output]=process.argv.slice(2);assert.ok(root&&output);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async file=>JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
const results=[];
for(const node of ['20','24']){
  const directory=path.join(root,`raw/quote-coordinated-node${node}-01`),generationBytes=await readFile(directory+'/generation.json'),generation=JSON.parse(generationBytes);
  let imports=0,rasters=0;
  for(const deck of generation.decks){
    for(const [file,digest]of Object.entries(deck.hashes)){assert.equal(path.basename(file),file);assert.equal(hash(await readFile(directory+'/'+file)),digest);}
    const native=await json(directory+`/runs/${deck.id}/native.json`);assert.equal(native.generationSha256,hash(generationBytes));
    assert.equal(native.decks.length,1);const record=native.decks[0];assert.equal(record.id,deck.id);assert.equal(record.editsReopened,deck.slides);
    for(const slide of record.slides){assert.ok(slide.glyphsInsideCell&&slide.bodyBottom<=slide.footerTop);assert.equal(slide.rasterSha256,hash(await readFile(directory+`/${deck.id}-native-${slide.slide}.png`)));rasters++;}
    for(const phase of ['original','saved','edited']){
      const file=`${deck.id}${phase==='original'?'':'-native-'+phase}.pptx`,bytes=await readFile(directory+'/'+file);
      assert.equal(hash(bytes),phase==='original'?deck.hashes[file]:record[phase+'Sha256']);
      const document=await fromPptx(bytes);assert.equal(document.slides.length,deck.slides);
      for(const [index,slide]of document.slides.entries()){
        const expected=deck.layouts[index].parts.flatMap(part=>part.fit.lines.filter(line=>line!=='').map(text=>({type:'text',text})));
        assert.equal(slide.title,phase==='edited'?`Native edit ${deck.id} slide ${index+1}`:'A quote and its source');
        assert.equal(slide.subtitle,undefined);assert.deepEqual(slide.blocks,expected);imports++;
      }
    }
  }
  results.push({nativeNode:node,imports,rasters});
}
await writeFile(output,JSON.stringify({evidenceCommit:'28ae661a606d0a70ff39d98aac32e84240dbbb23',node:process.version,reviewerSha256:hash(await readFile(new URL(import.meta.url))),converterSha256:hash(await readFile(new URL('../../opf-pptx/dist/index.js',import.meta.url))),results,scope:'72 fresh imports of native original/saved/edited quote slides verify exact current title/body/footer line order and multiplicity. Raw native bounds and 24 raster hashes checked. No new Office execution, semantic quote recovery, pixel equivalence or exact native font identity claim.'},null,2)+'\n');
console.log('72 native quote imports pass exact roles, order, multiplicity and current title edits.');
