import assert from 'node:assert/strict';
import {examples} from '@openpresentation/opf/examples';
import {toPptx,fromPptx} from '../dist/index.js';
import {loadOfficeFontRegistry} from '@openpresentation/opf-render/fonts-node';
import {unzipSync} from 'fflate';
import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {readFile} from 'node:fs/promises';
const fonts=await loadOfficeFontRegistry({fallbackFamily:"Roboto",strictGlyphs:false});
// Structural corpus gate: explicitly substitute fonts and images. This does
// not establish source-asset, typography, rendering or native viewer fidelity.
const substituteAssets = true;
const syntheticImage = new Uint8Array(await readFile(new URL('./fixtures/images/wide.png', import.meta.url)));
let substitutedAssets = 0;
const report={decks:examples.length,slides:0,exported:0,imported:0,failures:[],duplicates:[],invalidXml:[],invalidGeometry:[],invalidTables:[]};
for(const {file,deck} of examples){
 report.slides+=deck.slides.length;
 try{
  const bytes=await toPptx(deck,{textMeasurement:fonts.textMeasurement,...(substituteAssets ? {imageResolver:async () => {substitutedAssets++;return syntheticImage;}} : {})});report.exported++;
  const entries=unzipSync(bytes);
  for(const [part,data] of Object.entries(entries)){
   if(!/^ppt\/slides\/slide\d+\.xml$/.test(part))continue;
   const xml=new TextDecoder().decode(data),valid=XMLValidator.validate(xml);
   if(valid!==true)report.invalidXml.push({file,part,error:valid});
   const parsed = new XMLParser({ignoreAttributes:false}).parse(xml);
   const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node['a:tbl']) {
     const tables = [node['a:tbl']].flat();
     for (const table of tables) {
      const columns = [table['a:tblGrid']?.['a:gridCol'] ?? []].flat().length;
      for (const row of [table['a:tr'] ?? []].flat()) {
       const cells = [row['a:tc'] ?? []].flat().length;
       if (columns !== cells || !columns) report.invalidTables.push({file,part,columns,cells});
      }
     }
    }
    for (const value of Object.values(node)) if (typeof value === 'object') visit(value);
   };
   visit(parsed);
   const ids=[...xml.matchAll(/<p:cNvPr\b[^>]*\bid="([^"]+)"/g)].map(m=>m[1]);
   if(new Set(ids).size!==ids.length)report.duplicates.push({file,part,ids});
   for(const match of xml.matchAll(/<a:(?:off|ext)\b[^>]*\/>/g))for(const attr of match[0].matchAll(/(?:x|y|cx|cy)="([^"]+)"/g))if(!Number.isFinite(Number(attr[1])))report.invalidGeometry.push({file,part,value:attr[1]});
  }
  const imported=await fromPptx(bytes);
  if(imported.slides.length!==deck.slides.length)throw new Error('Slide count changed');report.imported++;
 }catch(error){report.failures.push({file,code:error.code,message:error.message,details:error.details,issues:error.issues?.slice(0,3)});}
}
assert.equal(report.exported, report.decks, JSON.stringify(report.failures));
assert.equal(report.imported, report.decks, JSON.stringify(report.failures));
for (const key of ['failures', 'duplicates', 'invalidXml', 'invalidGeometry', 'invalidTables']) {
 assert.deepEqual(report[key], [], key);
}
console.log(`Corpus structure passed: ${report.decks} decks, ${report.slides} slides, ${substitutedAssets} explicitly substituted images; fallback fonts, valid slide XML, unique IDs, finite geometry, table grids and imported slide counts.`);
