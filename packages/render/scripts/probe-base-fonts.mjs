import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
if(process.argv.length!==4)throw new Error('Usage: node scripts/probe-base-fonts.mjs <renderer-checkout> <output-directory>');
const root=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]);
const {loadBundledFontRegistry}=await import(pathToFileURL(path.join(root,'dist/fonts-node.js')));
const {svgToPng}=await import(pathToFileURL(path.join(root,'dist/index.js')));
const fonts=await loadBundledFontRegistry(),results=[];
await mkdir(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const [i,face] of fonts.embeddedFonts.entries()){
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="120"><rect width="900" height="120" fill="white"/><text x="30" y="75" font-family="${face.family}" font-weight="${face.weight}" font-style="${face.italic?'italic':'normal'}" font-size="42">Office AVATAR 0123 — typography</text></svg>`;
 const defaultPng=await svgToPng(svg,{loadSystemFonts:false});
 const measuredPng=await svgToPng(svg,{fontFiles:fonts.fontFiles,useBundledFonts:false,loadSystemFonts:false});
 await writeFile(path.join(out,`${i}-default.png`),defaultPng);
 await writeFile(path.join(out,`${i}-complete.png`),measuredPng);
 results.push({family:face.family,weight:face.weight,italic:face.italic,fileSha256:hash(await readFile(fonts.fontFiles[i])),defaultSha256:hash(defaultPng),completeSha256:hash(measuredPng),same:hash(defaultPng)===hash(measuredPng)});
}
await writeFile(path.join(out,'report.json'),JSON.stringify({node:process.version,results},null,2)+'\n');
console.log(JSON.stringify(results.map(({family,weight,italic,same})=>({family,weight,italic,same})),null,2));
