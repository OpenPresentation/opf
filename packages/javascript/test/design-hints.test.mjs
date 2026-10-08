import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide, resolveDesignHints, DESIGN_HINT_KEYS} from '../dist/composition.js';
import * as root from '../dist/index.js';

// FA-17: every shared design key resolves with one merge, per key: slide design, then deck design, then the
// layout record's design, then the engine default. SlideComposition.design carries the result, so the render and
// PPTX engines read the same values composition used.
const layout = id => design => ({id, design, placeholders: [{type: 'title'}, {type: 'text'}]});
const asset = name => `data:image/png;base64,${name}`;
// One value per key that the engine default does not already produce, plus an opposing value to override with.
const KEYS = {
  titleAlignment: ['center', 'right'],
  contentAlignment: ['center', 'right'],
  contentBox: [true, false],
  contentDirection: ['vertical', 'horizontal'],
  chartPrimary: ['left', 'top'],
  imageFit: ['contain', 'stretch'],
  listBullet: ['image', 'character'],
};

test('the shared key list; the helper is an engine name on the composition entry, not the root', () => {
  assert.deepEqual([...DESIGN_HINT_KEYS].sort(), Object.keys(KEYS).sort());
  assert.equal(typeof resolveDesignHints, 'function');
  assert.equal(root.resolveDesignHints, undefined);
});

for (const [key, [layoutValue, otherValue]] of Object.entries(KEYS)) {
  test(`${key}: layout only, deck over layout, slide over deck`, () => {
    const record = layout('l')({[key]: layoutValue});
    const slide = {title: 'T', text: 'Body', layout: 'l'};
    // Layout only.
    let hints = resolveDesignHints({slide, layout: record, presentation: {design: {}}, slideIndex: 3});
    assert.equal(hints[key], layoutValue);
    assert.equal(hints.sources[key], 'layout');
    assert.equal(hints.paths[key], 'slides.3.layout');
    // No layout, deck or slide value: absent, so the engine default applies.
    assert.equal(resolveDesignHints({slide, layout: layout('plain')({}), slideIndex: 3})[key], undefined);
    // The deck's value beats the layout's.
    hints = resolveDesignHints({slide, layout: record, presentation: {design: {[key]: otherValue}}, slideIndex: 3});
    assert.equal(hints[key], otherValue);
    assert.equal(hints.sources[key], 'deck');
    assert.equal(hints.paths[key], 'design.' + key);
    // The slide's value beats both.
    hints = resolveDesignHints({slide: {...slide, design: {[key]: layoutValue}}, layout: record, presentation: {design: {[key]: otherValue}}, slideIndex: 3});
    assert.equal(hints[key], layoutValue);
    assert.equal(hints.sources[key], 'slide');
    assert.equal(hints.paths[key], `slides.3.design.${key}`);
    // Per key: another key the slide sets does not hide this one.
    const other = Object.keys(KEYS).find(name => name !== key);
    hints = resolveDesignHints({slide: {...slide, design: {[other]: KEYS[other][1]}}, layout: record, presentation: {design: {}}});
    assert.equal(hints[key], layoutValue);
    assert.equal(hints.sources[other], 'slide');
    // The composed slide reports the same effective value.
    assert.equal(composeSlide(slide, {layout: record, presentation: {design: {}}}).design[key], layoutValue);
    assert.equal(composeSlide(slide, {layout: record, presentation: {design: {[key]: otherValue}}}).design[key], otherValue);
    assert.equal(composeSlide({...slide, design: {[key]: layoutValue}}, {layout: record, presentation: {design: {[key]: otherValue}}}).design[key], layoutValue);
  });
}

test('a value the schema does not allow is skipped so the next level answers', () => {
  const hints = resolveDesignHints({slide: {design: {contentAlignment: 'justify', contentBox: 'yes'}}, presentation: {design: {contentAlignment: 'middle'}}, layout: layout('l')({contentAlignment: 'center', contentBox: true})});
  assert.equal(hints.contentAlignment, 'center');
  assert.equal(hints.sources.contentAlignment, 'layout');
  assert.equal(hints.contentBox, true);
});

test('host-resolved deck values rank with the deck design, below the slide and above the layout', () => {
  const record = layout('l')({titleAlignment: 'center', contentAlignment: 'center', contentBox: true});
  const hints = resolveDesignHints({slide: {design: {contentAlignment: 'left'}}, layout: record, deck: {titleAlignment: 'right', contentAlignment: 'right'}});
  assert.deepEqual([hints.titleAlignment, hints.contentAlignment, hints.contentBox], ['right', 'left', true]);
  assert.deepEqual(hints.sources, {titleAlignment: 'deck', contentAlignment: 'slide', contentBox: 'layout'});
});

const alignments = result => Object.fromEntries(result.items.map(item => [item.field, item.alignment]));

test('layout titleAlignment and contentAlignment align title and content; the deck and the slide override them per key', () => {
  const record = layout('centered')({titleAlignment: 'center', contentAlignment: 'right'});
  const slide = {title: 'Title', text: 'Body', layout: 'centered'};
  assert.deepEqual(alignments(composeSlide(slide, {layout: record})), {title: 'center', text: 'right'});
  // Without a layout record the engine default (left) applies.
  assert.deepEqual(alignments(composeSlide(slide, {})), {title: 'left', text: 'left'});
  // The deck's design overrides the layout key by key; the other key still comes from the layout.
  assert.deepEqual(alignments(composeSlide(slide, {layout: record, presentation: {design: {titleAlignment: 'left'}}})), {title: 'left', text: 'right'});
  // A host that resolves the deck value itself gets the same answer.
  assert.deepEqual(alignments(composeSlide(slide, {layout: record, titleAlignment: 'left'})), {title: 'left', text: 'right'});
  // The slide's design wins over the deck and the layout.
  assert.deepEqual(alignments(composeSlide({...slide, design: {contentAlignment: 'left'}}, {layout: record, presentation: {design: {contentAlignment: 'center'}}})), {title: 'center', text: 'left'});
});

test('a cover keeps tag, title and subtitle together under the layout titleAlignment', () => {
  const record = {id: 'title-subtitle', design: {titleAlignment: 'center', contentAlignment: 'right'}, placeholders: [{type: 'title'}, {type: 'subtitle'}]};
  const cover = {tag: 'Tag', title: 'Cover', subtitle: 'Sub', layout: 'title-subtitle'};
  assert.deepEqual(alignments(composeSlide(cover, {layout: record})), {tag: 'center', title: 'center', subtitle: 'center'});
  // Only the slide's own contentAlignment splits the group.
  assert.deepEqual(alignments(composeSlide({...cover, design: {contentAlignment: 'left'}}, {layout: record})), {tag: 'left', title: 'center', subtitle: 'left'});
});

test('layout contentBox draws body cards unless the deck or the slide says otherwise', () => {
  const record = layout('cards')({contentBox: true});
  const slide = {title: 'Cards', blocks: [{text: 'a'}, {text: 'b'}]};
  const frames = result => result.items.filter(item => item.frameBox).length;
  assert.equal(frames(composeSlide(slide, {layout: record})), 2);
  assert.equal(frames(composeSlide(slide, {})), 0);
  assert.equal(frames(composeSlide(slide, {layout: record, presentation: {design: {contentBox: false}}})), 0);
  assert.equal(frames(composeSlide({...slide, design: {contentBox: false}}, {layout: record})), 0);
  assert.equal(frames(composeSlide({...slide, design: {contentBox: true}}, {layout: layout('flat')({contentBox: false})})), 2);
});

test('layout listBullet image attaches the deck icon logo, and reports an unresolved logo at the layout reference', () => {
  const record = layout('bullets')({listBullet: 'image'});
  const slide = {title: 'List', items: ['One', 'Two']};
  const presentation = {design: {logo: {icon: asset('icon')}}};
  const withLogo = composeSlide(slide, {layout: record, presentation});
  const item = withLogo.items.find(entry => entry.field === 'items');
  assert.deepEqual(item.bulletImage, {source: asset('icon'), path: 'design.logo.icon'});
  // The deck's `character` beats the layout's `image`.
  assert.equal(composeSlide(slide, {layout: record, presentation: {design: {...presentation.design, listBullet: 'character'}}}).items.find(entry => entry.field === 'items').bulletImage, undefined);
  const unresolved = composeSlide(slide, {layout: record, presentation: {design: {}}, slideIndex: 4});
  assert.deepEqual(unresolved.diagnostics.map(({code, path}) => ({code, path})), [{code: 'unresolved-content', path: 'slides.4.layout'}]);
});

test('layout contentDirection and chartPrimary rank below the deck and slide values, as the other keys do', () => {
  const blocks = [{text: 'First'}, {text: 'Second'}, {text: 'Third'}];
  const mode = (slide, options) => composeSlide(slide, {...options, explain: true}).explanation.decisions.find(decision => decision.path === 'slides.0').mode;
  const record = layout('dir')({contentDirection: 'vertical'});
  assert.equal(mode({title: 'T', blocks}, {layout: record}), 'column');
  assert.equal(mode({title: 'T', blocks}, {layout: record, presentation: {design: {contentDirection: 'horizontal'}}}), 'row');
  assert.equal(mode({title: 'T', blocks, design: {contentDirection: 'horizontal'}}, {layout: record, presentation: {design: {contentDirection: 'vertical'}}}), 'row');
});

test('the effective imageFit is the fit of every image item that sets none, cover by default', () => {
  const record = layout('contain')({imageFit: 'contain'});
  const fit = (slide, options) => composeSlide(slide, options).items.find(item => item.field === 'image').image.fit;
  assert.equal(composeSlide({title: 'T', image: asset('x')}, {layout: record}).design.imageFit, 'contain');
  assert.equal(fit({title: 'T', image: asset('x')}, {layout: record}), 'contain');
  assert.equal(fit({title: 'T', image: asset('x')}, {layout: record, presentation: {design: {imageFit: 'stretch'}}}), 'stretch');
  assert.equal(fit({title: 'T', image: asset('x')}, {}), 'cover');
  assert.equal(composeSlide({title: 'T'}, {}).design.imageFit, undefined);
});
