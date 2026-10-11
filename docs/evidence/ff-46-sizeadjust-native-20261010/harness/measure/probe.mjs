import {loadFonts} from '@openpresentation/opf-render/fonts-node';
const t0=Date.now();
const {registry, fontFiles} = await loadFonts({pack:'office', scripts:'all'});
const d = registry.describeFaces();
console.log(d.length, fontFiles.length, Date.now()-t0, 'ms');
for (const [i,f] of d.entries()) if (/Naskh|Sans Thai|Sans KR|Devanagari|Sans JP|^Noto Sans$|Ethiopic/.test(f.family)) console.log(f.family, f.weight, f.italic, f.scripts?.join?.(','), f.fallbackOnly, fontFiles[i].replace(/.*node_modules./,''));
