// FR-03: a `slide:<id>` link in the editor. The slide picker lists the slides (a slide with no id is listed, disabled); the link follows its
// slide when slides are reordered (it names an id, not a position); deleting the target slide is reported by validation
// (`opf/slide-link-unknown`), and a session that rejects invalid edits refuses the deletion.
import assert from 'node:assert/strict';
import {gallery} from '@openpresentation/gallery';
import {createEditorSession} from '../src/index.js';
import {slideLinkOptions} from '../src/slide-link-options.js';

const deck = () => ({
  name: 'Agenda',
  slides: [
    {id: 'agenda', title: 'Agenda', blocks: [{text: [{text: 'Pricing', link: 'slide:pricing'}]}, {shape: 'roundRect', text: 'Go', link: 'slide:pricing'}]},
    {id: 'pricing', title: 'Pricing', text: 'Plans'},
    {title: 'No id', text: 'x'},
  ],
});

assert.deepEqual(slideLinkOptions(deck()).map(option => [option.value, option.label, option.disabled === true]), [
  ['slide:agenda', '1. Agenda', false],
  ['slide:pricing', '2. Pricing', false],
  ['slide:#2', '3. No id (needs an id)', true],
]);
assert.deepEqual(slideLinkOptions({}), []);
assert.equal(slideLinkOptions({slides: [{id: 's', title: [{text: 'Rich '}, {text: 'title'}]}]})[0].label, '1. Rich title');

const unknown = editor => editor.validation.findings.filter(finding => finding.ruleId === 'opf/slide-link-unknown');

// Reordering keeps every link valid: the link names an id.
{
  const editor = createEditorSession(deck(), {catalogs: [gallery]});
  assert.equal(unknown(editor).length, 0);
  const slides = structuredClone(editor.presentation.slides);
  editor.set('slides', [slides[1], slides[0], slides[2]]);
  assert.equal(unknown(editor).length, 0, 'a reorder leaves the links valid');
  assert.equal(editor.get('slides.1.blocks.0.text.0.link'), 'slide:pricing');
  // The picker's value is a link the schema accepts.
  editor.set('slides.1.blocks.1.link', slideLinkOptions(editor.presentation)[1].value);
  assert.equal(editor.get('slides.1.blocks.1.link'), 'slide:agenda');
}

// Deleting the target slide is reported, one finding per link, at the path of the link.
{
  const editor = createEditorSession(deck(), {catalogs: [gallery]});
  editor.set('slides', structuredClone(editor.presentation.slides).filter(slide => slide.id !== 'pricing'));
  assert.deepEqual(unknown(editor).map(finding => finding.path), ['/slides/0/blocks/0/text/0/link', '/slides/0/blocks/1/link']);
  assert.equal(unknown(editor)[0].severity, 'error');
  // And undo brings the target back and clears the report.
  editor.undo();
  assert.equal(unknown(editor).length, 0);
}

// A session that rejects invalid edits refuses the deletion and keeps the document.
{
  const editor = createEditorSession(deck(), {catalogs: [gallery], rejectInvalid: true});
  assert.throws(() => editor.set('slides', structuredClone(editor.presentation.slides).filter(slide => slide.id !== 'pricing')), error => error.code === 'invalid-opf-edit');
  assert.equal(editor.presentation.slides.length, 3);
  // A link to a slide that does not exist is refused when it is typed too.
  assert.throws(() => editor.set('slides.0.blocks.1.link', 'slide:nowhere'), error => error.code === 'invalid-opf-edit');
  editor.set('slides.0.blocks.1.link', 'slide:agenda');
}
console.log('editor slide links: ok');
