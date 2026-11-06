import assert from 'node:assert/strict';
import { gallery } from '@openpresentation/gallery';
import { galleryIconSets } from '@openpresentation/gallery/icon-sets';
import { createEditorSession } from '../src/index.js';
import { mergeCatalogs } from '../src/catalogs.js';
import {
  deckIconName, deckIcons, iconGlyph, iconTargetForSelection, listIconSets, loadIconSets, prepareIcon, prepareSvgIcon, readIcon,
  removeIcon, searchIcons, setIcon, setIconGlyph, setSvgIcon,
} from '../src/icon-options.js';

// LH-166: the icon of a list entry, a metric and a group is set, changed and removed as one undoable patch each; a pasted SVG goes into the
// deck's `icons` map under a name and is referenced by it; search reads the sets the host registered (the editor bundles none); an SVG that
// cannot be an icon is refused with the opf/icon-invalid finding's message.
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 12l5 5L20 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
const BAD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><script>alert(1)</script><path d="M4 12l5 5L20 6"/></svg>';
const deck = () => ({
  slides: [
    { id: 'list', title: 'Why us', blocks: [
      { items: ['Fast', { text: 'Safe', description: 'Always' }, { text: 'Nested', level: 1 }] },
      { metric: { value: 42, label: 'Users' } },
      { metric: 7 },
      { blocks: [{ text: 'Inside' }, { text: 'Group' }], composition: { mode: 'row' } },
    ] },
    { id: 'inline', title: 'Inline', items: ['One', 'Two'] },
    { id: 'metric', title: 'Metric', metric: { value: 3, label: 'Three' } },
  ],
});
const session = (options = {}) => createEditorSession(deck(), { catalogs: [gallery, galleryIconSets], ...options });

// --- the target of a selection
const presentation = deck();
assert.deepEqual(iconTargetForSelection(presentation, 'slides.0.blocks.0.items.1.text'), { target: 'item', path: 'slides.0.blocks.0.items.1' });
assert.deepEqual(iconTargetForSelection(presentation, 'slides.0.blocks.0.items.0'), { target: 'item', path: 'slides.0.blocks.0.items.0' });
assert.deepEqual(iconTargetForSelection(presentation, 'slides.1.items.1'), { target: 'item', path: 'slides.1.items.1' }, 'the slide\'s own list');
assert.deepEqual(iconTargetForSelection(presentation, 'slides.0.blocks.1'), { target: 'metric', path: 'slides.0.blocks.1.metric' });
assert.deepEqual(iconTargetForSelection(presentation, 'slides.0.blocks.1.metric.value'), { target: 'metric', path: 'slides.0.blocks.1.metric' });
assert.deepEqual(iconTargetForSelection(presentation, 'slides.2.metric'), { target: 'metric', path: 'slides.2.metric' }, 'a metric a slide holds inline');
assert.equal(iconTargetForSelection(presentation, 'slides.2.title'), undefined, 'the slide\'s title is not its metric');
assert.deepEqual(iconTargetForSelection(presentation, 'slides.0.blocks.3'), { target: 'group', path: 'slides.0.blocks.3' });
assert.equal(iconTargetForSelection(presentation, 'slides.0.blocks.3.blocks.0.text'), undefined, 'a text inside a group has no icon of the group');
assert.equal(iconTargetForSelection(presentation, 'slides.0.blocks.0'), undefined, 'a list block is not an entry');
assert.equal(iconTargetForSelection(presentation, 'slides.9.blocks.0'), undefined);
assert.equal(iconTargetForSelection(presentation, 'not a path ['), undefined);
assert.deepEqual(readIcon(presentation, 'slides.0.blocks.0.items.0'), { target: 'item', path: 'slides.0.blocks.0.items.0', icon: undefined, scalar: true, nested: false });
assert.equal(readIcon(presentation, 'slides.0.blocks.0.items.2').nested, true);
assert.equal(readIcon(presentation, 'slides.0.blocks.2').scalar, true, 'a bare metric value');

// --- sets, searched by name and tags; the editor bundles none
{
  const bare = createEditorSession(deck());
  assert.deepEqual(listIconSets(bare), []);
  assert.deepEqual((await searchIcons(bare, 'truck')).icons, []);
  await assert.rejects(searchIcons(bare, 'truck', { set: 'lucide' }), (error) => error.code === 'unknown-icon-set');
}
// the gallery's icon sets share the gallery's source and still reach the session; a repeated catalog is registered once
assert.equal(mergeCatalogs([gallery, galleryIconSets]).length, 2, 'galleryIconSets is kept beside gallery although both have one source');
assert.equal(mergeCatalogs([gallery, galleryIconSets], [galleryIconSets, gallery]).length, 2, 'the same objects are not registered twice');
assert.equal(mergeCatalogs([gallery], [{ source: gallery.source, themes: {} }]).length, 1, 'a later catalog with the same source and no icon sets is still dropped');
const editor = session();
const before = listIconSets(editor);
assert.deepEqual(before.map((entry) => [entry.id, entry.loaded]), [['lucide', false], ['tabler', false]], 'registered, not loaded until used');
const found = await searchIcons(editor, 'truck');
assert.ok(found.total > 0 && found.icons.some((entry) => entry.icon === 'lucide:truck'));
assert.equal(found.icons[0].icon, 'lucide:truck', 'the whole name first, the first registered set breaking ties');
assert.deepEqual(Object.keys(found.icons[0]).sort(), ['icon', 'name', 'set', 'tags']);
assert.ok(found.sets.every((entry) => entry.license && entry.icons > 100));
assert.deepEqual(listIconSets(editor).map((entry) => entry.loaded), [true, true]);
const tabler = await searchIcons(editor, 'truck', { set: 'tabler', limit: 3 });
assert.ok(tabler.returned <= 3 && tabler.icons.every((entry) => entry.set === 'tabler'));
const tagged = await searchIcons(editor, 'delivery');
assert.ok(tagged.total > 0, 'a keyword of the source package matches');
assert.ok((await searchIcons(editor, '')).total > 1000, 'an empty query browses every icon');
assert.equal((await searchIcons(editor, 'zzzzqqqq')).total, 0);
const paged = await searchIcons(editor, 'arrow', { limit: 5, offset: 5 });
assert.deepEqual(paged.icons.map((entry) => entry.icon), (await searchIcons(editor, 'arrow', { limit: 10 })).icons.slice(5).map((entry) => entry.icon));
const glyph = setIconGlyph((await loadIconSets(editor)).get('lucide'), 'truck');
assert.equal(glyph.viewBox, '0 0 24 24');
assert.ok(glyph.parts.length >= 1 && glyph.parts.every((part) => part.d && ['stroke', 'fill'].includes(part.mode)));
assert.equal(setIconGlyph((await loadIconSets(editor)).get('lucide'), 'no-such-icon'), undefined);

// --- set, change and remove an icon on an entry, a metric and a group, each one undo step
const baseline = structuredClone(editor.presentation);
const entry = setIcon(editor, 'slides.0.blocks.0.items.0', 'lucide:truck');
assert.equal(entry.changed, true);
assert.deepEqual(editor.presentation.slides[0].blocks[0].items[0], { text: 'Fast', icon: 'lucide:truck' }, 'a bare entry becomes an object');
assert.equal(readIcon(editor.presentation, 'slides.0.blocks.0.items.0.text').icon, 'lucide:truck');
assert.equal(setIcon(editor, 'slides.0.blocks.0.items.0', 'lucide:truck').changed, false, 'nothing to do when it already has it');
const changed = setIcon(editor, 'slides.0.blocks.0.items.0', 'tabler:rocket');
assert.deepEqual(changed.patches, [{ op: 'replace', path: '/slides/0/blocks/0/items/0/icon', value: 'tabler:rocket' }]);
const second = setIcon(editor, 'slides.0.blocks.0.items.1', 'lucide:shield-check');
assert.deepEqual(second.patches, [{ op: 'add', path: '/slides/0/blocks/0/items/1/icon', value: 'lucide:shield-check' }], 'an object entry only gains the key');
assert.equal(editor.presentation.slides[0].blocks[0].items[1].description, 'Always', 'the rest of the entry is untouched');
setIcon(editor, 'slides.0.blocks.1', 'lucide:users');
assert.deepEqual(editor.presentation.slides[0].blocks[1].metric, { value: 42, label: 'Users', icon: 'lucide:users' });
setIcon(editor, 'slides.0.blocks.2.metric', 'lucide:users');
assert.deepEqual(editor.presentation.slides[0].blocks[2].metric, { value: 7, icon: 'lucide:users' }, 'a bare metric becomes { value, icon }');
setIcon(editor, 'slides.0.blocks.3', 'lucide:layers');
assert.equal(editor.presentation.slides[0].blocks[3].icon, 'lucide:layers');
setIcon(editor, 'slides.2.metric.value', 'tabler:chart-bar');
assert.equal(editor.presentation.slides[2].metric.icon, 'tabler:chart-bar');
setIcon(editor, 'slides.1.items.1', 'lucide:check');
assert.deepEqual(editor.presentation.slides[1].items[1], { text: 'Two', icon: 'lucide:check' });
assert.equal(editor.validation.valid, true);
// each change was one undo step
let steps = 0;
while (editor.canUndo) { editor.undo(); steps++; }
assert.equal(steps, 8, 'seven icons set and one changed: eight steps, one per change');
assert.deepEqual(editor.presentation, baseline, 'undo takes every icon back');
editor.redo();
assert.equal(editor.presentation.slides[0].blocks[0].items[0].icon, 'lucide:truck');
while (editor.canRedo) editor.redo();
// removal
const removed = removeIcon(editor, 'slides.0.blocks.0.items.0');
assert.deepEqual(removed.patches, [{ op: 'remove', path: '/slides/0/blocks/0/items/0/icon' }]);
assert.equal(removeIcon(editor, 'slides.0.blocks.0.items.0').changed, false, 'removing none changes nothing');
removeIcon(editor, 'slides.0.blocks.1');
assert.equal(editor.presentation.slides[0].blocks[1].metric.icon, undefined);
removeIcon(editor, 'slides.0.blocks.3');
assert.equal(Object.hasOwn(editor.presentation.slides[0].blocks[3], 'icon'), false);
editor.undo();
assert.equal(editor.presentation.slides[0].blocks[3].icon, 'lucide:layers', 'undo of a removal brings the icon back');

// --- refusals
const strict = session();
assert.throws(() => setIcon(strict, 'slides.0.blocks.0', 'lucide:truck'), (error) => error.code === 'content-action-refused', 'a list block is not an entry');
assert.throws(() => setIcon(strict, 'slides.0.title', 'lucide:truck'), (error) => error.code === 'content-action-refused');
assert.throws(() => setIcon(strict, 'slides.0.blocks.0.items.2', 'lucide:truck'), (error) => error.code === 'content-action-refused' && /nested/.test(error.message));
assert.throws(() => setIcon(strict, 'slides.0.blocks.0.items.0', 'Not An Icon'), (error) => error.code === 'invalid-icon');
assert.throws(() => setIcon(strict, 'slides.0.blocks.0.items.0', 5), (error) => error.code === 'invalid-icon');
await loadIconSets(strict);
assert.throws(() => setIcon(strict, 'slides.0.blocks.0.items.0', 'lucide:trucks'), (error) => error.code === 'icon-unknown' && error.details.ruleId === 'opf/icon-unknown' && /no icon trucks/.test(error.message), 'a loaded set names the unknown icon');
assert.throws(() => setIcon(strict, 'slides.0.blocks.0.items.0', 'nowhere:truck'), (error) => error.code === 'icon-unknown');
assert.throws(() => setIcon(strict, 'slides.0.blocks.0.items.0', 'unknown-deck-name'), (error) => error.code === 'icon-unknown');
assert.deepEqual(strict.presentation, deck(), 'a refusal changes nothing');
assert.equal(strict.canUndo, false);
// a nested entry that already has an icon can still lose it
{
  const nested = createEditorSession({ slides: [{ items: ['a', { text: 'b', level: 1, icon: 'lucide:truck' }] }] }, { catalogs: [gallery, galleryIconSets] });
  assert.equal(removeIcon(nested, 'slides.0.items.1').changed, true);
}

// --- pasting an SVG: it goes into `icons` and is referenced by its name, in one step
const pasted = session();
const before2 = structuredClone(pasted.presentation);
const one = setSvgIcon(pasted, 'slides.0.blocks.0.items.0', SVG, { name: 'Check Mark' });
assert.equal(one.name, 'check-mark');
assert.deepEqual(pasted.presentation.icons, { 'check-mark': SVG });
assert.deepEqual(pasted.presentation.slides[0].blocks[0].items[0], { text: 'Fast', icon: 'check-mark' });
assert.deepEqual(one.patches.map((patch) => patch.op + ' ' + patch.path), ['add /icons', 'test /slides/0/blocks/0/items/0', 'replace /slides/0/blocks/0/items/0']);
assert.equal(pasted.validation.valid, true);
assert.equal(deckIcons(pasted.presentation)[0].kind, 'glyph');
assert.equal(iconGlyph(pasted.presentation, 'check-mark').parts[0].mode, 'stroke', 'the deck icon draws as parts');
assert.equal(iconGlyph(pasted.presentation, 'nope'), undefined);
{ const small = session(); setSvgIcon(small, 'slides.1.items.0', SVG, { name: 'tick' }); assert.equal(small.composeSlide(1).icons.length, 1, 'the composed slide draws the pasted icon'); }
pasted.undo();
assert.deepEqual(pasted.presentation, before2, 'one undo takes the entry and the icons map back');
pasted.redo();
// the same SVG again is reused, not duplicated
const again = setSvgIcon(pasted, 'slides.0.blocks.0.items.1', `  ${SVG}\n`);
assert.equal(again.name, 'check-mark');
assert.deepEqual(Object.keys(pasted.presentation.icons), ['check-mark']);
assert.equal(pasted.presentation.slides[0].blocks[0].items[1].icon, 'check-mark');
// another SVG with no name takes a free one; a taken name is refused unless it replaces
const other = SVG.replace('M4 12l5 5L20 6', 'M5 5l14 14');
assert.equal(setSvgIcon(pasted, 'slides.0.blocks.1', other).name, 'icon');
assert.equal(setSvgIcon(pasted, 'slides.0.blocks.3', SVG.replace('stroke-width="2"', 'stroke-width="3"')).name, 'icon-2');
assert.throws(() => setSvgIcon(pasted, 'slides.1.items.0', other.replace('5 5', '6 6'), { name: 'icon' }), (error) => error.code === 'icon-name-taken');
assert.equal(setSvgIcon(pasted, 'slides.1.items.0', other.replace('5 5', '6 6'), { name: 'icon', replace: true }).name, 'icon');
assert.match(pasted.presentation.icons.icon, /6 6/);
assert.equal(deckIconName('My Logo!'), 'my-logo');
assert.equal(deckIconName('9 lives'), 'lives');
assert.equal(deckIconName('???'), 'icon');
// the <title> names it when no name is given
assert.equal(setSvgIcon(session(), 'slides.0.blocks.0.items.0', SVG.replace('<path', '<title>Tick</title><path')).name, 'tick');
// a multicolor SVG is a picture
const picture = session();
setSvgIcon(picture, 'slides.0.blocks.1', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#ff0000"/><path d="M8 12h8" stroke="#0000ff" stroke-width="2"/></svg>', { name: 'two-color' });
assert.equal(deckIcons(picture.presentation)[0].kind, 'picture');
assert.ok(iconGlyph(picture.presentation, 'two-color').picture.svg.includes('<svg'));

// --- an SVG that cannot be an icon is refused with the finding's message, and nothing changes
const invalid = session();
for (const [svg, pattern] of [
  [BAD, /script/i],
  ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><image href="https://example.com/a.png" width="24" height="24"/></svg>', /image|raster|external|picture/i],
  ['<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L5 5"/></svg>', /no viewBox/],
  ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0L5 5"', /well-formed/],
  ['<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0L5 5"/></svg>', /./],
  ['just words', /./],
]) {
  let caught;
  try { setSvgIcon(invalid, 'slides.0.blocks.0.items.0', svg, { name: 'bad' }); } catch (error) { caught = error; }
  assert.ok(caught, `refused: ${svg.slice(0, 40)}`);
  assert.equal(caught.code, 'icon-invalid');
  assert.equal(caught.details.ruleId, 'opf/icon-invalid');
  assert.match(caught.message, pattern);
  // the message is the validator's own, word for word
  const document = { icons: { bad: svg }, slides: [{ items: [{ text: 'x', icon: 'bad' }] }] };
  const { validate } = await import('@openpresentation/opf');
  const finding = validate(document, { only: ['opf/icon-invalid'] }).findings.find((entry) => entry.ruleId === 'opf/icon-invalid');
  assert.equal(caught.message, finding.message);
}
assert.throws(() => setSvgIcon(invalid, 'slides.0.blocks.0.items.0', '   '), (error) => error.code === 'icon-invalid');
assert.deepEqual(invalid.presentation, deck(), 'a refused SVG leaves the deck as it was');
assert.equal(invalid.canUndo, false);

// --- removing the last use of a deck icon drops it from the map (and the map when it empties); others stay
const prune = session();
setSvgIcon(prune, 'slides.0.blocks.0.items.0', SVG, { name: 'mark' });
setSvgIcon(prune, 'slides.0.blocks.0.items.1', SVG, { name: 'mark' });
removeIcon(prune, 'slides.0.blocks.0.items.0');
assert.deepEqual(Object.keys(prune.presentation.icons), ['mark'], 'still used once');
const last = removeIcon(prune, 'slides.0.blocks.0.items.1');
assert.equal(Object.hasOwn(prune.presentation, 'icons'), false, 'the map goes with its last icon');
assert.deepEqual(last.patches.map((patch) => patch.op + ' ' + patch.path), ['remove /slides/0/blocks/0/items/1/icon', 'remove /icons']);
prune.undo();
assert.deepEqual(Object.keys(prune.presentation.icons), ['mark'], 'one undo brings both back');
assert.equal(prune.presentation.slides[0].blocks[0].items[1].icon, 'mark');
// changing a deck icon to a set icon prunes it too, unless asked not to
const swap = session();
setSvgIcon(swap, 'slides.1.items.0', SVG, { name: 'mark' });
setIcon(swap, 'slides.1.items.0', 'lucide:truck');
assert.equal(Object.hasOwn(swap.presentation, 'icons'), false);
setSvgIcon(swap, 'slides.1.items.1', SVG, { name: 'keep' });
assert.deepEqual(prepareIcon(swap.presentation, 'slides.1.items.1', null, { prune: false }).patches, [{ op: 'remove', path: '/slides/1/items/1/icon' }]);
assert.deepEqual(Object.keys(prepareIcon(swap.presentation, 'slides.1.items.1', null).presentation).includes('icons'), false);
// a hand-authored entry the deck's other icons use is never touched
const handmade = createEditorSession({ icons: { a: SVG, b: SVG.replace('M4 12', 'M5 12') }, slides: [{ items: [{ text: 'x', icon: 'a' }] }] });
setIcon(handmade, 'slides.0.items.0', null);
assert.deepEqual(Object.keys(handmade.presentation.icons), ['b'], 'only the icon that lost its last use goes');

// --- the prepare forms leave the session alone, and a dry run skips the icon check
assert.equal(prepareIcon(editor.presentation, 'slides.1.items.0', 'lucide:truck').presentation.slides[1].items[0].icon, 'lucide:truck');
assert.equal(Object.hasOwn(editor.presentation.slides[1].items[0] ?? {}, 'icon'), false);
assert.equal(prepareSvgIcon(deck(), 'slides.1.items.0', SVG, { name: 'x' }).name, 'x');
assert.equal(prepareIcon(deck(), 'slides.1.items.0', 'lucide:nope', { validate: false }).changed, true);

// --- the composed slide draws what was chosen (the sets are loaded by search)
const drawn = session();
await searchIcons(drawn, 'truck');
setIcon(drawn, 'slides.1.items.0', 'lucide:truck');
setIcon(drawn, 'slides.1.items.1', 'tabler:rocket');
assert.equal(drawn.composeSlide(1).icons.length, 2);

console.log('LH-166 editor icons: targets, search, set, change, remove, pasted SVG, refusals, pruning and undo checked.');
