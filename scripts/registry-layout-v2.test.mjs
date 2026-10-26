import assert from 'node:assert/strict';
import test from 'node:test';
import {verifyV2LayoutChoices} from './registry-layout-v2.mjs';
function fixture(){
 const ids='cover section agenda agenda-split statement closing text list quote two-column pillars comparison process timeline faq metrics scorecard image image-beside gallery chart chart-beside table table-beside code hero dashboard team logos'.split(' ');
 const gallery={layouts:Object.fromEntries(ids.map(id=>[id,{name:id}]))};
 const previews={layoutPreviews:Object.fromEntries(ids.map(id=>[id,'<svg/>'])),layoutPreviewIndex:{records:ids.map(id=>({id,bytes:7}))},getLayoutPreview:()=>'<svg/>',hasLayoutPreview:()=>true};
 const editor={getJsonFieldContext:(original)=>({original,options:ids.map(id=>({value:id,label:id,source:'Loaded catalog',sourceLabel:'Provided by app',regions:'text'}))}),replaceFieldOption:(c,id)=>{const d=JSON.parse(c.original);d.slides[0].layout=id;return JSON.stringify(d);},fieldOptionEdit:(c,id)=>({from:0,to:c.original.length,insert:editor.replaceFieldOption(c,id)})};
 return {gallery,previews,editor,validate:()=>({valid:true,findings:[]})};
}
test('all29 choices preserve content and exact edit semantics',()=>assert.deepEqual(verifyV2LayoutChoices(fixture()),{choices:29,previews:29,contentPreserved:true}));
test('reject missing choices, preview drift, ownership drift, content loss and invalid application',()=>{
 for(const mutate of [
  f=>delete f.gallery.layouts.text,
  f=>delete f.previews.layoutPreviews.text,
  f=>f.previews.layoutPreviewIndex.records[0].bytes++,
  f=>{f.previews.getLayoutPreview=()=>'<svg >';},
  f=>{const original=f.editor.getJsonFieldContext;f.editor.getJsonFieldContext=(...a)=>{const c=original(...a);c.options[0].source='Document catalog';return c;};},
  f=>{f.editor.replaceFieldOption=()=>JSON.stringify({slides:[{layout:'cover'}]});},
  f=>{f.validate=()=>({valid:false,findings:['invalid references']});}
 ]){const f=fixture();mutate(f);assert.throws(()=>verifyV2LayoutChoices(f));}
});
