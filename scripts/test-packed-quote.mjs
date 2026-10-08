// Copied into the isolated installed-tarball consumer by test-packed-ecosystem.
import assert from 'node:assert/strict';
import {createEditorSession} from '@openpresentation/opf-editor';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {resolvePresentation,renderSlideSvg} from '@openpresentation/opf-render/svg';
import {toPptx,fromPptx} from '@openpresentation/opf-pptx';
const fonts=await loadFonts();
// OPF 0.15: a host registers the default catalog (the deck names the roboto font scheme); a 0.14 core has no /catalog.
const host=await import('@openpresentation/opf/catalog').then(module=>({catalogs:[module.defaultCatalog]}),()=>({}));
const options={...host,fonts};
const source={design:{fontScheme:'roboto'},slides:[{title:'Installed quote',quote:{text:'Retain the selected source.',attribution:'Reviewer',source:'Recorded interview'}}]};
const editor=createEditorSession(source,host);
const before=editor.presentation;
assert.ok(editor.paginateSlide(0,options).change,'A single-page readability policy must be committed');
const accepted=editor.presentation;
assert.equal(accepted.slides.length,1);
assert.equal(accepted.slides[0].composition.minFontSize,24);
assert.deepEqual(accepted.slides[0].quote,before.slides[0].quote);
const item=resolvePresentation(accepted,options).slides[0].geometry.items.find(item=>item.field==='quote');
assert.ok(item.quoteLayout.parts.every(part=>part.fit.fontSize>=24));
assert.equal(item.text,item.quoteLayout.parts[0].fit);
assert.match(renderSlideSvg(accepted,0,options),/Reviewer - Recorded interview/);
assert.equal(editor.paginateSlide(0,options).change,null);
editor.undo();assert.deepEqual(editor.presentation,before);
editor.redo();assert.deepEqual(editor.presentation,accepted);
const imported=await fromPptx(await toPptx(accepted,options));
assert.equal(imported.slides.length,1);
// opf-pptx imports current native body lines as schema-valid TextRun[] (FF-32 keeps their font, size and
// color). Compare the exact visible characters and block order, not the run formatting.
const visible=text=>Array.isArray(text)?text.map(run=>typeof run==='string'?run:run.text).join(''):text;
// FF-57: an unchanged export restores the quote payload (opf-pptx with OPF_QUOTE_V1 tags); an earlier opf-pptx returns its two native text lines.
// opf-pptx with content topology (spec-gap P1) returns the root quote payload as slides.0.quote; earlier releases return blocks.
const blocks=imported.slides[0].quote!==undefined?[{type:'quote',quote:imported.slides[0].quote}]:imported.slides[0].blocks;
if(blocks.length===1&&blocks[0].type==='quote')assert.deepEqual(blocks[0].quote,accepted.slides[0].quote);
else assert.deepEqual(blocks.map(block=>visible(block.text)),['"Retain the selected source."','Reviewer - Recorded interview']);
console.log('Packed quote editor passed: accepted one-page policy, source preservation, actual fonts, SVG/PPTX, undo/redo and editable native text reimport. An unchanged quote re-imports as its quote payload (FF-57); earlier opf-pptx releases return native text lines.');
