import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fromPptx} from '../dist/index.js';
const out=path.resolve(process.argv[2]),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const generation=JSON.parse(await readFile(path.join(out,'generation.json'),'utf8'));
for(const [name,wanted] of Object.entries(generation.runtime)) {
  const parts=name.split('/'),scoped=name.startsWith('@'),packageName=parts.slice(0,2).join('/');
  const file=scoped?path.join(path.dirname(fileURLToPath(import.meta.resolve(packageName+'/package.json'))),...parts.slice(2)):fileURLToPath(new URL('../'+name,import.meta.url));
  assert.equal(hash(await readFile(file)),wanted,`Unchanged partial-check runtime: ${name}`);
}
const imports=[],rasters=[];
for(const phase of ['original','saved']) {
  const file=phase==='original'?'charts.pptx':'charts-saved.pptx',bytes=await readFile(path.join(out,file));
  if(phase==='original')assert.equal(hash(bytes),generation.pptxSha256);
  const deck=await fromPptx(bytes);assert.equal(deck.slides.length,8);
  for(const [index,slide] of deck.slides.entries()) {
    const chart=slide.chart??slide.blocks?.find(block=>block.chart)?.chart;
    assert.deepEqual(chart?.data,generation.expected[index].data);imports.push({phase,slide:index+1,file,sha256:hash(bytes),data:chart.data});
  }
}
for(let slide=1;slide<=8;slide++) {
  const original=await readFile(path.join(out,`original-${slide}.png`)),reopened=await readFile(path.join(out,`reopened-${slide}.png`));
  assert.equal(hash(original),hash(reopened));rasters.push({slide,originalSha256:hash(original),reopenedSha256:hash(reopened)});
}
const result={node:process.version,verifierSha256:hash(await readFile(new URL(import.meta.url))),generationSha256:hash(await readFile(path.join(out,'generation.json'))),imports,rasters,
  scope:'PARTIAL: eight original and eight actual native-saved chart data imports agree; eight original/reopened native PNG pairs are byte-identical. No final native.json or edited deck exists while the original Office worker waits in ChartData.Activate for slide 2. Full native chart colors and embedded-workbook edit/reimport gates are not passed.'};
await writeFile(path.join(out,'partial-comparison.json'),JSON.stringify(result,null,2)+'\n');
console.log('Partial native chart evidence: 16 exact data imports and eight unchanged native save/reopen raster pairs. Embedded workbook gate remains open.');
