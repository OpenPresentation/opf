// FR-08: an embed in the editor. The insert menu makes `{ embed: "<https address>" }`; the inspector's fields edit the address, the title, the
// aspect ratio and the preview as one validated, undoable change each (a block's id stays); a video and an embed convert to each other; an
// embed takes a caption; the canvas and the outline name it by its title or its site.
import assert from 'node:assert/strict';
import {gallery} from '@openpresentation/gallery';
import {createEditorSession} from '../src/index.js';
import {createContentBlock, prepareBlockInsert} from '../src/blocks.js';
import {EMBED_ASPECT_PRESETS, editedEmbed, prepareEmbed, readEmbed, setEmbed} from '../src/embed-options.js';
import {blockConversionTargets, convertBlock} from '../src/block-convert.js';
import {describeBlock} from '../src/slide-scene.js';
import {CAPTIONABLE_FIELDS} from '../src/annotations.js';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const deck = () => ({
  name: 'Embeds', assets: {shot: png},
  slides: [
    {id: 'one', title: 'One', blocks: [{id: 'page', embed: 'https://app.example.com/dashboards/revenue'}, {text: 'Beside'}]},
    {id: 'two', title: 'Two', embed: {src: 'https://www.prototype.example.com/checkout', title: 'Checkout prototype', aspectRatio: 1.6, preview: 'asset:shot'}},
    {id: 'three', title: 'Three', blocks: [{video: {src: 'https://cdn.example.com/demo.mp4', title: 'Demo'}}]},
  ],
});
const session = () => createEditorSession(deck(), {rejectInvalid: true, catalogs: [gallery]});

// The insert menu: only an https address is an embed.
assert.deepEqual(createContentBlock('embed', {source: ' https://app.example.com/dashboard '}), {embed: 'https://app.example.com/dashboard'});
for (const bad of ['', '   ', 'http://app.example.com/', 'app.example.com', 'javascript:alert(1)', './page.html', undefined]) assert.throws(() => createContentBlock('embed', {source: bad}), /https address/, JSON.stringify(bad));
{
  const inserted = prepareBlockInsert(deck(), 'slides.0', createContentBlock('embed', {source: 'https://maps.example.com/office'}), 2);
  assert.deepEqual(inserted.presentation.slides[0].blocks[2], {embed: 'https://maps.example.com/office'});
  assert.equal(inserted.presentation.slides[0].blocks[0].id, 'page', 'the other blocks keep their ids');
}

// Reading: whichever form it was written in.
assert.deepEqual(readEmbed(deck(), 'slides.0.blocks.0'), {path: 'slides.0.blocks.0', src: 'https://app.example.com/dashboards/revenue', title: undefined, aspectRatio: undefined, preview: undefined});
assert.deepEqual(readEmbed(deck(), 'slides.1'), {path: 'slides.1', src: 'https://www.prototype.example.com/checkout', title: 'Checkout prototype', aspectRatio: 1.6, preview: 'asset:shot'});
assert.throws(() => readEmbed(deck(), 'slides.0.blocks.1'), error => error.code === 'invalid-embed');

// Editing: the shorthand grows into the object and collapses back, each change validated, the block's id kept.
{
  const editor = session();
  setEmbed(editor, 'slides.0.blocks.0', {title: 'Revenue dashboard'});
  assert.deepEqual(editor.presentation.slides[0].blocks[0], {id: 'page', embed: {src: 'https://app.example.com/dashboards/revenue', title: 'Revenue dashboard'}});
  setEmbed(editor, 'slides.0.blocks.0', {aspectRatio: EMBED_ASPECT_PRESETS[2].value, preview: 'asset:shot'});
  assert.deepEqual(editor.presentation.slides[0].blocks[0].embed, {src: 'https://app.example.com/dashboards/revenue', title: 'Revenue dashboard', aspectRatio: 4 / 3, preview: 'asset:shot'});
  setEmbed(editor, 'slides.0.blocks.0', {src: 'https://app.example.com/dashboards/costs'});
  assert.equal(editor.presentation.slides[0].blocks[0].embed.src, 'https://app.example.com/dashboards/costs');
  setEmbed(editor, 'slides.0.blocks.0', {title: null, aspectRatio: null, preview: null});
  assert.deepEqual(editor.presentation.slides[0].blocks[0], {id: 'page', embed: 'https://app.example.com/dashboards/costs'}, 'back to the shorthand, with the id');
  assert.equal(editor.canUndo ?? true, true);
  editor.undo();
  assert.equal(typeof editor.presentation.slides[0].blocks[0].embed, 'object', 'one undo step per change');
  // A slide's own embed is edited the same way.
  setEmbed(editor, 'slides.1', {preview: null});
  assert.equal(editor.presentation.slides[1].embed.preview, undefined);
  // No change is no patch.
  assert.deepEqual(setEmbed(editor, 'slides.1', {title: 'Checkout prototype'}).patches, []);
}
for (const bad of [{src: 'http://app.example.com/'}, {src: 'app.example.com'}, {src: ''}, {title: ''}, {title: 3}, {aspectRatio: 0}, {aspectRatio: 11}, {aspectRatio: 'wide'}, {preview: 'photo.png'}, {preview: 7}, {sandbox: 'allow-scripts'}]) {
  assert.throws(() => prepareEmbed(deck(), 'slides.0.blocks.0', bad), error => error.code === 'invalid-embed', JSON.stringify(bad));
}
assert.throws(() => editedEmbed(deck(), 'slides.0.blocks.0', {src: null}), error => error.code === 'invalid-embed');
// A preview that names an asset the deck does not have is refused by the document check, as any missing asset.
assert.throws(() => prepareEmbed(deck(), 'slides.0.blocks.0', {preview: 'asset:nope'}));

// Conversions: video to embed and back keep the address and the title, only for https; an image does not become one.
{
  const targets = blockConversionTargets(deck(), 'slides.2.blocks.0');
  assert.deepEqual(targets.map(target => [target.kind, target.available]), [['embed', true]]);
  const editor = session();
  convertBlock(editor, 'slides.2.blocks.0', 'embed');
  assert.deepEqual(editor.presentation.slides[2].blocks[0], {embed: {src: 'https://cdn.example.com/demo.mp4', title: 'Demo'}});
  assert.deepEqual(blockConversionTargets(editor.presentation, 'slides.2.blocks.0').map(target => target.kind), ['video']);
  convertBlock(editor, 'slides.2.blocks.0', 'video');
  assert.deepEqual(editor.presentation.slides[2].blocks[0], {video: {src: 'https://cdn.example.com/demo.mp4', title: 'Demo'}});
  const local = createEditorSession({slides: [{title: 'x', blocks: [{video: 'asset:demo'}]}], assets: {demo: 'https://cdn.example.com/demo.mp4'}}, {rejectInvalid: true});
  assert.equal(blockConversionTargets(local.presentation, 'slides.0.blocks.0').find(target => target.kind === 'embed').available, false, 'an asset: reference is not an https address');
  assert.deepEqual(blockConversionTargets({slides: [{title: 'x', blocks: [{image: 'https://cdn.example.com/a.png'}]}]}, 'slides.0.blocks.0'), []);
}

// Naming and captions.
assert.equal(describeBlock({embed: 'https://www.app.example.com/x'}), 'Embed: app.example.com');
assert.equal(describeBlock({embed: {src: 'https://app.example.com/x', title: 'Revenue dashboard'}}), 'Embed: Revenue dashboard');
assert.ok(CAPTIONABLE_FIELDS.includes('embed'));
console.log('embed editor: ok');
