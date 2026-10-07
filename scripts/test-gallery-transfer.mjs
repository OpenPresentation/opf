import {readFile} from 'node:fs/promises';
import {parseOpfTransfer,prepareOpfImport} from '../../opf-editor/src/transfer.js';
import {renderSlideSvg} from '../../opf-render/dist/svg.js';
const gallery=JSON.parse(await readFile(new URL('../artifacts/editor/gallery.json', import.meta.url),'utf8'));
let failures=[];
for(const item of gallery.items){try{const result=prepareOpfImport({slides:[{id:'gallery-preview-1',title:'Existing'}]},parseOpfTransfer(JSON.stringify(item.opf)));renderSlideSvg(result.presentation,result.slideIndex);}catch(e){failures.push({id:item.id,error:e.message});}}
console.log(JSON.stringify({examples:gallery.items.length,failures},null,2));if(failures.length)process.exitCode=1;
