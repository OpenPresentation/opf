// The old standalone control reconstructs the former reference walk by omitting only its missed slide-language record.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=fileURLToPath(new URL('./',import.meta.url));
const load=relative=>import(pathToFileURL(path.join(root,relative)).href);
const [{embed,validate},{gallery},{loadFonts},{toSvg,resolvePresentation},{toPng}]=await Promise.all(['packages/javascript/dist/index.js','packages/gallery/dist/index.js','packages/render/dist/fonts-node.js','packages/render/dist/svg.js','packages/render/dist/png.js'].map(load));
const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual'}),report={scope:'Original catalog-backed rendering versus no-registered-catalog standalone rendering. Old control reproduces omitted slide-language record; it is not an old-source PPTX export.',examples:[],files:{}};
for(const name of ['multilingual-slides','localized-timeline']){
 const document=JSON.parse(await fs.readFile(path.join(root,'examples/technical/'+name+'.opf.json'),'utf8'));delete document.catalogs;
 await fonts.ensure(document);
 const fixed=embed(document,{catalogs:[gallery]}).document,originalSvg=toSvg(document,{fonts,catalogs:[gallery]}),fixedSvg=toSvg(fixed,{fonts,catalogs:[]});
 assert.deepEqual(fixedSvg,originalSvg);
 const entry={name,slides:originalSvg.length,exactSvgEquality:originalSvg.map((svg,i)=>svg===fixedSvg[i]),standaloneUnresolved:validate(fixed,{catalogs:[]}).findings.filter(x=>x.ruleId==='opf/unresolved-reference')};
 if(name==='multilingual-slides'){
  const old=structuredClone(fixed);delete old.catalogs.default.fontSchemes['noto-sans-arabic'];
  entry.titleFontSizes={};
  for(const [label,deck,catalogs]of [['catalog-backed',document,[gallery]],['old-standalone-control',old,[]],['fixed-standalone',fixed,[]]]){
   const svg=toSvg(deck,2,{fonts,catalogs}),png=await toPng(deck,2,{fonts,catalogs,scale:.5});
   await fs.writeFile(path.join(out,label+'.svg'),svg);await fs.writeFile(path.join(out,label+'.png'),png);
   const title=resolvePresentation(deck,{fonts,catalogs},{slides:[1]}).slides[1].geometry.items.find(x=>x.field==='title');entry.titleFontSizes[label]=Number(/font-size="([^"]+)"/.exec(svg)[1]); assert.equal(title.text.fontSize,54,'core intended size remains 54px');
  }
  assert.deepEqual(entry.titleFontSizes,{'catalog-backed':54,'old-standalone-control':34.5,'fixed-standalone':54});
 }
 report.examples.push(entry);
}
for(const name of (await fs.readdir(out)).filter(x=>/\.(png|svg)$/.test(x)))report.files[name]=createHash('sha256').update(await fs.readFile(path.join(out,name))).digest('hex');
await fs.writeFile(path.join(out,'svg-proof.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.examples));
