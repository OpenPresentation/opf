// Direct nested content groups retain all 33 leaves; v1 layout slots no longer exist.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveSlideContext} from '@openpresentation/opf';
import {composeSlide} from '@openpresentation/opf/composition';
import {resolvePresentation} from '@openpresentation/opf-render';
import {createEditorSession} from '../dist/index.js';
import {layoutRegionSummary} from '../dist/layout-templates.js';
import {prepareDimensionSwitch,switchDimension} from '../dist/switches.js';
const deck=JSON.parse(readFileSync(new URL('./fixtures/placeholder-groups.opf.json',import.meta.url)));
const session=createEditorSession(deck,{rejectInvalid:true});
const resolved=resolvePresentation(session.presentation);
let leaves=0;
for(const [index,slide] of deck.slides.entries()) {
 const core=composeSlide(slide,resolveSlideContext(deck,index).options);
 assert.deepEqual(resolved.slides[index].geometry.items.map(item=>[item.path,item.box]),core.items.map(item=>[item.path,item.box]),slide.id);
 leaves+=core.items.filter(item=>!['title','subtitle','tag'].includes(item.field)).length;
 assert.equal(core.slots,undefined);
}
assert.equal(leaves,33);
const record={name:'Explicit regions',areas:['title title','body visual'],regions:{body:{accepts:['text'],flow:'auto'},visual:{accepts:['chart'],flow:'none'}}};
assert.match(layoutRegionSummary(record),/body/);
assert.equal(layoutRegionSummary({}), '');
const original={catalogs:{custom:{layouts:{'explicit-regions':record}}},slides:[{title:'Only title',notes:'Metadata',blocks:[{text:'Preserve this'}]}]};
const editor=createEditorSession(original,{rejectInvalid:true});
const switched=prepareDimensionSwitch(editor.presentation,'layouts','explicit-regions',{slideIndex:0});
assert.deepEqual(switched.presentation.slides[0],{...original.slides[0],layout:'explicit-regions'});
switchDimension(editor,'layouts','explicit-regions',{slideIndex:0});
editor.undo();assert.deepEqual(editor.presentation,original);
editor.redo();assert.deepEqual(editor.presentation,switched.presentation);
console.log('Nested groups: 33 direct content leaves preserve core/renderer geometry; v2 summaries and content-preserving layout switch undo/redo pass.');
