import {copyFile,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
const registry=process.argv.includes('--registry');
if(registry)await import('./build-registry-gallery-editor.mjs');
else{await import('./build-editor-demo.mjs');await import('./build-spec-reference.mjs');}
const source=registry?'registry-gallery-editor':'editor';
const target=new URL('../../pptx-gallery/public/opf-editor/',import.meta.url);
await mkdir(target,{recursive:true});
if(!registry)await rm(new URL('manifest.json',target),{force:true});
// The script font manifest is committed with the editor files; the faces are not (the gallery build copies them from pinned npm packages).
const scriptFonts=registry&&existsSync(new URL('../artifacts/registry-gallery-editor/script-fonts.json',import.meta.url));
if(!scriptFonts)await rm(new URL('script-fonts.json',target),{force:true});
// FF-31: the lazy vendored-font manifest is committed too; its faces (Intos, the open families) are not: the gallery build copies them from the pinned renderer package.
const lazyFonts=existsSync(new URL(`../artifacts/${source}/lazy-fonts.json`,import.meta.url));
if(!lazyFonts)await rm(new URL('lazy-fonts.json',target),{force:true});
// FF-41: an example that loads base-fonts.json ships the other eager faces as separate hash-named files beside it. A rebuild replaces
// the previous set, so a face whose bytes changed does not leave its old file behind.
const baseFontsFile=new URL(`../artifacts/${source}/base-fonts.json`,import.meta.url);
const baseFonts=registry&&existsSync(baseFontsFile)?JSON.parse(await readFile(baseFontsFile,'utf8')).map(face=>face.file):[];
if(registry&&existsSync(new URL('manifest.json',target))){
  for(const file of Object.keys(JSON.parse(await readFile(new URL('manifest.json',target),'utf8')).files??{}))if(/-[0-9a-f]{12}\.ttf$/.test(file)&&!baseFonts.includes(file))await rm(new URL(file,target),{force:true});
}
if(!baseFonts.length)await rm(new URL('base-fonts.json',target),{force:true});
for(const file of ['index.html','playground.css','playground.js','fonts.json','gallery.json','galleries.json',...(baseFonts.length?['base-fonts.json',...baseFonts]:[]),...(registry?['manifest.json','playground.js.LEGAL.txt','opf-spec.json']:[]),...(scriptFonts?['script-fonts.json']:[]),...(lazyFonts?['lazy-fonts.json']:[])])await copyFile(new URL(`../artifacts/${source}/${file}`,import.meta.url),new URL(file,target));
const html=await readFile(new URL('index.html',target),'utf8');
await writeFile(new URL('index.html',target),html.replace('http://localhost:3101/spec','/spec'));
await copyFile(new URL(`../artifacts/${registry?'registry-gallery-editor':'spec'}/opf-spec.json`,import.meta.url),new URL('../../pptx-gallery/data/opf-spec.json',import.meta.url));
console.log('Gallery editor and schema reference synchronized.');
