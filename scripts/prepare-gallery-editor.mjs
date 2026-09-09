import {copyFile,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
const registry=process.argv.includes('--registry');
if(registry)await import('./build-registry-gallery-editor.mjs');
else{await import('./build-editor-demo.mjs');await import('./build-spec-reference.mjs');}
const source=registry?'registry-gallery-editor':'editor';
const target=new URL('../../pptx-gallery/public/opf-editor/',import.meta.url);
await mkdir(target,{recursive:true});
if(!registry)await rm(new URL('manifest.json',target),{force:true});
for(const file of ['index.html','playground.css','playground.js','fonts.json','gallery.json','galleries.json',...(registry?['manifest.json','playground.js.LEGAL.txt']:[])])await copyFile(new URL(`../artifacts/${source}/${file}`,import.meta.url),new URL(file,target));
const html=await readFile(new URL('index.html',target),'utf8');
await writeFile(new URL('index.html',target),html.replace('http://localhost:3101/spec','/spec'));
await copyFile(new URL(`../artifacts/${registry?'registry-gallery-editor':'spec'}/opf-spec.json`,import.meta.url),new URL('../../pptx-gallery/data/opf-spec.json',import.meta.url));
console.log('Gallery editor and schema reference synchronized.');
