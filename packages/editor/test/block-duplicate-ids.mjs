import assert from 'node:assert/strict';
import {createEditorSession} from '../dist/index.js';
import {prepareBlockDuplicate} from '../dist/blocks.js';
import {collectReservedPresentationIds} from '../dist/presentation-ids.js';
for (const block of [{text:'Plain'}, {id:'b',text:'Identified'}, {id:'group',blocks:[{id:'b',text:'Nested'},{blocks:[{id:'deep',items:['Keep']}]}]}]) {
  const deck={slides:[{id:'s',blocks:[block]},{id:'b-2',blocks:[{id:'deep-2',text:'Other'}]}]};
  const before=structuredClone(deck),editor=createEditorSession(deck,{rejectInvalid:true});
  const result=prepareBlockDuplicate(deck,'slides.0.blocks.0');
  assert.deepEqual(deck,before,'prepare never mutates input');
  editor.applyPatch(result.patches);
  const ids=collectReservedPresentationIds(editor.presentation);
  assert.equal(new Set(ids).size,ids.length,'copies remap all subtree IDs against whole presentation');
  const copied=editor.presentation.slides[0].blocks[1];
  const strip=value=>Array.isArray(value)?value.map(strip):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>key!=='id').map(([key,v])=>[key,strip(v)])):value;
  assert.deepEqual(strip(copied),strip(block),'complete payload and formatting preserved');
  if(!block.id)assert.deepEqual(copied,block,'id-less blocks stay id-less');
  const after=editor.presentation;editor.undo();assert.deepEqual(editor.presentation,before);editor.redo();assert.deepEqual(editor.presentation,after);
}
console.log('Block duplication: root/nested/reserved IDs, id-less content and exact undo/redo.');
