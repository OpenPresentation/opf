// FA-17: the editor's composition (canvas, pagination, accepted text) applies a layout record's `design`
// as the lowest-precedence default, below the deck's design and the slide's design, per key.
import assert from 'node:assert/strict';
import {createEditorSession} from '../dist/index.js';
import {resolvePresentation} from '@openpresentation/opf-render';

const record = {$schema: 'https://openpresentation.org/schema/opf-layout/v1', id: 'centered', name: 'Centered', design: {titleAlignment: 'center', contentAlignment: 'right', contentBox: true}, placeholders: [{type: 'title'}, {type: 'text'}]};
const document = {design: {fontScheme: 'roboto'}, catalogs: {layouts: {records: [record]}}, slides: [{layout: 'centered', title: 'Heading', text: 'Body'}]};
const alignment = (editor, field) => editor.composeSlide(0).items.find(item => item.field === field).alignment;
const frames = editor => editor.composeSlide(0).items.filter(item => item.frameBox).length;

let editor = createEditorSession(structuredClone(document), {rejectInvalid: true});
assert.equal(alignment(editor, 'title'), 'center', 'layout titleAlignment');
assert.equal(alignment(editor, 'text'), 'right', 'layout contentAlignment');
assert.equal(frames(editor), 1, 'layout contentBox');
assert.deepEqual(editor.composeSlide(0).items, resolvePresentation(editor.presentation).slides[0].geometry.items, 'editor and preview compose the same items');

// The deck's design overrides the layout key by key; the slide's design overrides both.
editor.set('design.titleAlignment', 'left');
assert.equal(alignment(editor, 'title'), 'left');
assert.equal(alignment(editor, 'text'), 'right', 'the other key still comes from the layout');
editor.set('slides.0.design', {contentAlignment: 'center', contentBox: false});
assert.equal(alignment(editor, 'text'), 'center');
assert.equal(frames(editor), 0);
assert.equal(alignment(editor, 'title'), 'left', 'deck over layout');
editor.undo(); editor.undo();
assert.equal(alignment(editor, 'title'), 'center', 'undo restores the layout default');
console.log('Editor layout design applied: layout, deck and slide alignment and content box resolve with one merge in the editor composition.');
