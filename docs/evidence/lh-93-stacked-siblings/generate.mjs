// Run one process per source checkout: <source-root> <fresh-output>. No Office or golden mutation.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const[root,out]=process.argv.slice(2);assert.ok(root&&out);
const load=relative=>import(pathToFileURL(path.join(root,relative)).href);
const[{loadFonts},{gallery},{toPptx},{toSvg,resolvePresentation},{toPng}]=await Promise.all(['packages/render/dist/fonts-node.js','packages/gallery/dist/index.js','packages/pptx/dist/index.js','packages/render/dist/svg.js','packages/render/dist/png.js'].map(load));
const deck=JSON.parse(await fs.readFile(new URL('witness.opf.json',import.meta.url),'utf8')),fonts=await loadFonts({pack:'office',substitutionPolicy:'visual'}),options={fonts,catalogs:[gallery]};
await fs.mkdir(out,{recursive:true});
const sourceCommit=execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={sourceCommit,sourceHashes:{},files:{},slides:[]};
for(const file of ['packages/javascript/src/chart-marks.ts','packages/javascript/src/composition.ts'])report.sourceHashes[file]=hash(await fs.readFile(path.join(root,file)));
const bytes=await toPptx(deck,{...options,seed:93,timestamp:'2026-11-08T00:00:00Z',zipDate:'2026-11-08T00:00:00Z'});await fs.writeFile(path.join(out,'witness.pptx'),bytes);report.files['witness.pptx']=hash(bytes);
const svgs=toSvg(deck,options),pngs=await toPng(deck,{...options,scale:.5}),geometry=resolvePresentation(deck,options);
for(const[i,svg]of svgs.entries()){
 for(const[ext,data]of[['svg',svg],['png',pngs[i]]]){const file='slide-'+(i+1)+'.'+ext;await fs.writeFile(path.join(out,file),data);report.files[file]=hash(data);}
 report.slides.push({slide:i+1,title:deck.slides[i].title,charts:geometry.slides[i].geometry.items.filter(item=>item.chart).map(item=>({box:item.box,plot:item.chart.layer?.plot,rows:item.chart.layer?.rows,stack:item.chart.layer?.stack,valueAxis:item.chart.valueAxis}))});
}
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({sourceCommit,slides:report.slides.length,pptx:report.files['witness.pptx']}));
