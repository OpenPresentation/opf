import assert from 'node:assert/strict';
import test from 'node:test';
import {embed} from '../packages/javascript/dist/index.js';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(new URL('../packages/javascript/package.json',import.meta.url));
const {toSvg}=await import(pathToFileURL(require.resolve('@openpresentation/opf-render/svg')));
const {loadFonts}=await import(pathToFileURL(require.resolve('@openpresentation/opf-render/fonts-node')));
import {portableShowcase,assertShowcaseSvg} from './showcase-contract.mjs';
test('showcase preserves authored content and embeds its actual Roboto context',async()=>{
 const authored={design:{theme:'classic',fontScheme:'roboto'},slides:[{title:'One format. Open tools.',text:['Write plain JSON. ',{text:'Keep every word editable.',bold:true}]}]};
 const before=structuredClone(authored),fonts=await loadFonts({pack:'base'});
 assert.throws(()=>assertShowcaseSvg(toSvg(authored,1,{fonts})),/authored Roboto|No local font face/);
 const portable=portableShowcase(authored,embed);assert.deepEqual(authored,before);const content=structuredClone(portable);delete content.catalogs;assert.deepEqual(content,authored);
 assertShowcaseSvg(toSvg(portable,1,{fonts}));
 assert.throws(()=>portableShowcase({...authored,design:{fontScheme:'nonexistent-showcase-font'}},embed),/references must resolve/);
});
