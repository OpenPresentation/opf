import fs from 'fs';
import {pathToFileURL} from 'node:url';
const pkg='C:/opf-work/lh-184-columns/packages/render';
const wanted=JSON.parse(fs.readFileSync('C:/opf-work/lh-184-sheets/v3/keys.json','utf8'));
const {layouts, templateDeck, featureDecks, paginatedDecks} = await import(pathToFileURL(pkg+'/test/layout-template-fixture.mjs').href);
const {toSvg} = await import(pathToFileURL(pkg+'/dist/index.js').href);
const out={};
for (const {keys, deck} of [...Object.keys(layouts).map(templateDeck), ...featureDecks(), ...paginatedDecks()]) {
  if (!keys.some(k=>wanted.includes(k))) continue;
  toSvg(deck,{trace:true}).forEach((svg,i)=>{ if(wanted.includes(keys[i])) { const m=[...svg.matchAll(/font-size="([\d.]+)"/g)].map(x=>+x[1]); out[keys[i]]=[...new Set(m)].sort((a,b)=>a-b).join(','); }});
}
fs.writeFileSync(process.argv[2],JSON.stringify(out,null,1));
