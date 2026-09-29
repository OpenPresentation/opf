// The native quote comparator's visible-content contract, not a formatting oracle.
import assert from 'node:assert/strict';
import {validatePresentation} from '@openpresentation/opf';

export function assertNativeQuoteImport(slide, expectedLines, expectedTitle) {
  const validation=validatePresentation({slides:[slide]});
  assert.equal(validation.valid,true,JSON.stringify(validation.errors));
  assert.ok(expectedLines.every(line=>typeof line==='string'));
  assert.equal(slide.title,expectedTitle);
  // Retain every block and structural key. Only the schema-valid rich value in
  // each existing text block is projected to its exact current visible string.
  const current=slide.blocks?.map(block=>{
    assert.equal(block.type,'text');
    return {...block,text:Array.isArray(block.text)
      ? block.text.map(run=>typeof run==='string'?run:run.text).join('')
      : block.text};
  });
  assert.deepEqual(current,expectedLines.map(text=>({type:'text',text})),
    'Every current body/footer line survives in exact order and multiplicity');
}
