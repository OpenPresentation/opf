import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {composeSlide,layoutTemplateIssues} from '@openpresentation/opf/composition';
import {editorialDeck} from '../scripts/editorial-previews.mjs';
import {templateDeck} from '../../../scripts/gallery-stability-fixtures.mjs';
for(const id of ['org-chart','hierarchy','venn'])test('SH21: '+id+' record and maintained samples retain their semantic arrangement',()=>{
 const record=JSON.parse(readFileSync(new URL('../catalog/layouts/'+id+'.json',import.meta.url),'utf8'));assert.deepEqual(layoutTemplateIssues(record),[]);assert.equal(record.regions[1].arrangement,id);
 for(const make of [editorialDeck,templateDeck]){const deck=make(id,record),slide=deck.slides[0],composed=composeSlide(slide,{layout:record});assert.equal(composed.arrangements.length,1);assert.equal(composed.arrangements[0].kind,id);assert.ok(!composed.diagnostics.some(d=>d.code==='arrangement-adapted'));assert.ok(composed.arrangements[0].fontSize>=32);if(id!=='venn'){const values=slide.blocks.find(block=>block.items).items;assert.equal(values[0].level,0);assert.ok(values.slice(1).every(value=>value.level>0));}
 }
});
