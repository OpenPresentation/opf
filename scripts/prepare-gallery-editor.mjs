import {copyFile,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
// MR-34: the editor example and the schema reference of this checkout, vendored into the pptx.gallery site checkout (a sibling
// directory: the sites stay separate repositories). The registry mode (`--registry`, the example of the release plan's editor
// commit built against npm packages) is gone with the release plan; a site takes the editor package from npm.
await import('./build-editor-demo.mjs');await import('./build-spec-reference.mjs');
const source='editor';
const target=new URL('../../pptx-gallery/public/opf-editor/',import.meta.url);
await mkdir(target,{recursive:true});
await rm(new URL('manifest.json',target),{force:true});
// The script font manifest is committed with the editor files; the faces are not (the gallery build copies them from pinned npm packages).
await rm(new URL('script-fonts.json',target),{force:true});
// FF-31: the lazy vendored-font manifest is committed too; its faces (Intos, the open families) are not: the gallery build copies them from the pinned renderer package.
const lazyFonts=existsSync(new URL(`../artifacts/${source}/lazy-fonts.json`,import.meta.url));
if(!lazyFonts)await rm(new URL('lazy-fonts.json',target),{force:true});
// FF-41: an example that loads base-fonts.json ships the other eager faces as separate hash-named files beside it.
const baseFontsFile=new URL(`../artifacts/${source}/base-fonts.json`,import.meta.url);
const baseFonts=existsSync(baseFontsFile)?JSON.parse(await readFile(baseFontsFile,'utf8')).map(face=>face.file):[];
if(!baseFonts.length)await rm(new URL('base-fonts.json',target),{force:true});
for(const file of ['index.html','playground.css','playground.js','fonts.json','gallery.json','galleries.json',...(baseFonts.length?['base-fonts.json',...baseFonts]:[]),...(lazyFonts?['lazy-fonts.json']:[])])await copyFile(new URL(`../artifacts/${source}/${file}`,import.meta.url),new URL(file,target));
const html=await readFile(new URL('index.html',target),'utf8');
await writeFile(new URL('index.html',target),html.replace('http://localhost:3101/spec','/spec'));
await copyFile(new URL('../artifacts/spec/opf-spec.json',import.meta.url),new URL('../../pptx-gallery/data/opf-spec.json',import.meta.url));
console.log('Gallery editor and schema reference synchronized.');
