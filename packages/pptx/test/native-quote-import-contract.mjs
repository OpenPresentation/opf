// The native quote comparator's visible-content contract, not a formatting oracle.
import assert from 'node:assert/strict';
import {validatePresentation} from '@openpresentation/opf';

// FF-57: an OPF export tags its quote lines, so its re-import restores the source quote payload. Pass that source payload as
// `expectedQuote` and the slide must hold exactly one `{type: 'quote', quote}` block equal to it, and nothing else.
// Without `expectedQuote` the slide is the degraded form (an edited, damaged or untagged quote): every current body/footer line
// survives as a text block in exact order and multiplicity.
export function assertNativeQuoteImport(slide, expectedLines, expectedTitle, expectedQuote) {
  const validation=validatePresentation({slides:[slide]});
  assert.equal(validation.valid,true,JSON.stringify(validation.errors));
  assert.ok(expectedLines.every(line=>typeof line==='string'));
  assert.equal(slide.title,expectedTitle);
  if(expectedQuote!==undefined) {
    assert.deepEqual(slide.blocks,[{type:'quote',quote:expectedQuote}],
      'The unchanged export restores its quote payload (text, attribution, source) and no loose text block');
    return 'quote';
  }
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
  return 'text';
}
