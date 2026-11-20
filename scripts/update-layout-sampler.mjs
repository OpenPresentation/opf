// Refresh the exhaustive sampler from current authored gallery records while preserving existing slide ordinals/content.
// Run after the final catalog is assembled: node scripts/update-layout-sampler.mjs [--check]. Never writes golden baselines.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {applyPatch,embed,updateFromCatalog} from '@openpresentation/opf';
import {gallery} from '@openpresentation/gallery';
import {editorialDeck} from '../packages/gallery/scripts/editorial-previews.mjs';
export function updatedLayoutSampler(before,catalog=gallery){
 const document=structuredClone(before),ids=Object.keys(catalog.layouts),known=new Set(ids),found=new Set();
 for(const slide of document.slides){if(!slide.layout)continue;const id=String(slide.layout).replace(/^default:/,'');assert.ok(known.has(id),'Unknown sampler layout '+id);assert.ok(!found.has(id),'Duplicate sampler layout '+id);found.add(id);}
 const added=ids.filter(id=>!found.has(id));for(const id of added)document.slides.push({...editorialDeck(id,catalog.layouts[id]).slides[0],id:'layout-'+id});
 // New layouts append, so every existing native acceptance witness keeps its authored slide ordinal.
 const embedded=embed(document,{catalogs:[catalog]});assert.deepEqual(embedded.unresolved,[]);
 const changes=updateFromCatalog(embedded.document,[catalog],ids.map(reference=>({kind:'layouts',reference}))),updated=applyPatch(embedded.document,changes.patch);
 updated.description='All '+ids.length+' default layouts and '+before.slides.filter(slide=>!slide.layout).length+' dynamic compositions (no layout record), on one fictional six-week pilot story. Existing slide identities and order are preserved; newly added layouts append. The layout slides use the editorial example content of the gallery layout previews. Used to compare layouts with other designers and to review layout changes before and after.';
 assert.deepEqual(updated.slides.slice(0,before.slides.length),before.slides,'Every existing authored slide stays unchanged');
 assert.equal(new Set(updated.slides.filter(slide=>slide.layout).map(slide=>String(slide.layout).replace(/^default:/,''))).size,ids.length);
 return{document:updated,added,updatedRecords:changes.changes.map(change=>change.reference)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const file=new URL('../examples/technical/layout-sampler.opf.json',import.meta.url),before=readFileSync(file,'utf8'),result=updatedLayoutSampler(JSON.parse(before)),text=JSON.stringify(result.document,null,2)+'\n';
 if(process.argv.includes('--check'))assert.equal(before,text,'Run node scripts/update-layout-sampler.mjs after catalog assembly');else writeFileSync(file,text);
 console.log(JSON.stringify({layouts:Object.keys(gallery.layouts).length,slides:result.document.slides.length,added:result.added,updatedRecords:result.updatedRecords}));
}
