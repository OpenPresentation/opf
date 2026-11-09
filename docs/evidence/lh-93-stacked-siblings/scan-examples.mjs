// Draw every bundled slide containing a horizontal stack plus another horizontal chart; no golden writes.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const[root,out]=process.argv.slice(2),load=relative=>import(pathToFileURL(path.join(root,relative)).href);
const[{examples},{loadFonts},{gallery},{toSvg},{toPng}]=await Promise.all(['packages/javascript/dist/examples.js','packages/render/dist/fonts-node.js','packages/gallery/dist/index.js','packages/render/dist/svg.js','packages/render/dist/png.js'].map(load));
const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual'}),report=[];await fs.mkdir(out,{recursive:true});
const types=value=>!value||typeof value!=='object'?[]:[...(value.chart&&typeof value.chart.type==='string'?[value.chart.type]:[]),...Object.values(value).flatMap(types)];
for(const{file,deck}of examples)for(const[index,slide]of deck.slides.entries()){
 const found=types(slide),horizontal=found.filter(type=>['bar','stacked-bar','100pct-stacked-bar'].includes(type));
 if(horizontal.length<2||!horizontal.some(type=>type!=='bar'))continue;
 await fonts.ensure(deck);const name=path.basename(file,'.opf.json')+'-s'+(index+1),svg=toSvg(deck,index+1,{fonts,catalogs:[gallery]}),png=await toPng(deck,index+1,{fonts,catalogs:[gallery],scale:.5});
 await fs.writeFile(path.join(out,name+'.svg'),svg);await fs.writeFile(path.join(out,name+'.png'),png);report.push({file,slide:index+1,name,types:horizontal,sha256:createHash('sha256').update(svg).digest('hex')});
}
await fs.writeFile(path.join(out,'scan.json'),JSON.stringify(report,null,2)+'\n');console.log(report.length+' candidate bundled slides');
