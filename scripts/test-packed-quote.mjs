// Copied into the isolated installed-tarball consumer by test-packed-ecosystem.
import assert from 'node:assert/strict';
import {createEditorSession} from '@openpresentation/opf-editor';
import {loadBundledFontRegistry} from '@openpresentation/opf-render/fonts-node';
import {resolvePresentation,renderSvg} from '@openpresentation/opf-render/svg';
import {toPptx,fromPptx} from '@openpresentation/opf-pptx';
const {textMeasurement}=await loadBundledFontRegistry();
const options={textMeasurement};
const source={design:{fontScheme:'roboto'},slides:[{title:'Installed quote',quote:{text:'Retain the selected source.',attribution:'Reviewer',source:'Recorded interview'}}]};
const editor=createEditorSession(source);
const before=editor.document;
assert.ok(editor.paginateSlide(0,options).change,'A single-page readability policy must be committed');
const accepted=editor.document;
assert.equal(accepted.slides.length,1);
assert.equal(accepted.slides[0].composition.minFontSize,24);
assert.deepEqual(accepted.slides[0].quote,before.slides[0].quote);
const item=resolvePresentation(accepted,options).slides[0].geometry.items.find(item=>item.field==='quote');
assert.ok(item.quoteLayout.parts.every(part=>part.fit.fontSize>=24));
assert.equal(item.text,item.quoteLayout.parts[0].fit);
assert.match(renderSvg(accepted,options),/Reviewer - Recorded interview/);
assert.equal(editor.paginateSlide(0,options).change,null);
editor.undo();assert.deepEqual(editor.document,before);
editor.redo();assert.deepEqual(editor.document,accepted);
const imported=await fromPptx(await toPptx(accepted,options));
assert.equal(imported.slides.length,1);
// opf-pptx imports current native body lines as schema-valid TextRun[] (FF-32 keeps their font, size and
// color). Compare the exact visible characters and block order, not the run formatting.
const visible=text=>Array.isArray(text)?text.map(run=>typeof run==='string'?run:run.text).join(''):text;
assert.deepEqual(imported.slides[0].blocks.map(block=>visible(block.text)),['"Retain the selected source."','Reviewer - Recorded interview']);
console.log('Packed quote editor passed: accepted one-page policy, source preservation, actual fonts, SVG/PPTX, undo/redo and editable native text reimport. Quote semantics are not reconstructed on import.');
