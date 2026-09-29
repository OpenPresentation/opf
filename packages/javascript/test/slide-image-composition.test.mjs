import assert from 'node:assert/strict';
import test from 'node:test';
import { composeSlide } from '../dist/composition.js';
import { validatePresentation } from '../dist/index.js';

const photo = 'data:image/png;base64,iVBORw0KGgo=';
const within = (box, area) => box.x >= area.x - 1e-6 && box.y >= area.y - 1e-6
  && box.x + box.width <= area.x + area.width + 1e-6 && box.y + box.height <= area.y + area.height + 1e-6;
const overlaps = (a, b) => a.x < b.x + b.width - 1e-6 && a.x + a.width > b.x + 1e-6 && a.y < b.y + b.height - 1e-6 && a.y + a.height > b.y + 1e-6;

test('deck slide images apply to reserving layouts and same-source slide images', () => {
  const presentation = { design: { slideImage: { src: photo, position: 'left' } } };
  const slide = { title: 'Heading', text: 'Body' };
  const plain = composeSlide(slide, { presentation });
  assert.equal(plain.slideImage, undefined);
  // Unchanged geometry: existing decks with an unused deck-level slideImage keep their layout.
  assert.deepEqual(plain, composeSlide(slide, {}));
  assert.equal(composeSlide(slide, { presentation, layout: { slideImage: false } }).slideImage, undefined);
  const reserved = composeSlide(slide, { presentation, layout: { slideImage: true } });
  assert.equal(reserved.slideImage.path, 'design.slideImage');
  assert.equal(reserved.slideImage.sourcePath, 'design.slideImage');
  assert.equal(reserved.slideImage.value, photo);
  assert.equal(reserved.slideImage.replacesContent, false);
  // The slide's own image naming the same source links it to the deck treatment without a layout opt-in.
  const linked = composeSlide({ title: 'Heading', image: { src: photo, alt: 'Harbor' } }, { presentation, layout: { slideImage: false } });
  assert.equal(linked.slideImage.replacesContent, true);
  assert.equal(linked.slideImage.path, 'design.slideImage');
  assert.equal(linked.slideImage.sourcePath, 'slides.0.image');
  assert.deepEqual(linked.items.map(item => item.field), ['title']);
  const unrelated = composeSlide({ title: 'Heading', image: 'data:image/png;base64,AAAA' }, { presentation });
  assert.equal(unrelated.slideImage, undefined);
  // A deck-level source-less treatment still needs the layout opt-in.
  assert.equal(composeSlide({ title: 'Heading', image: photo }, { presentation: { design: { slideImage: { position: 'left' } } } }).slideImage, undefined);
});

test('band positions give the image one side and compose content in the rest', () => {
  for (const [position, region] of Object.entries({
    left: { x: 0, y: 0, width: 640, height: 720 }, right: { x: 640, y: 0, width: 640, height: 720 },
    top: { x: 0, y: 0, width: 1280, height: 360 }, bottom: { x: 0, y: 360, width: 1280, height: 360 },
  })) {
    const result = composeSlide({ title: 'Heading', text: 'Body', design: { slideImage: { src: photo, position } } });
    assert.deepEqual(result.slideImage.region, region, position);
    assert.deepEqual(result.slideImage.box, region, position);
    assert.equal(result.slideImage.path, 'slides.0.design.slideImage');
    for (const item of result.items) assert.equal(overlaps(item.box, region), false, `${position} ${item.field}`);
    assert.equal(overlaps(result.contentBox, region), false, position);
  }
  const background = composeSlide({ title: 'Heading', text: 'Body', design: { slideImage: { src: photo, position: 'background' } } });
  assert.deepEqual(background.slideImage.box, { x: 0, y: 0, width: 1280, height: 720 });
  assert.deepEqual(background.items.map(item => item.box), composeSlide({ title: 'Heading', text: 'Body' }).items.map(item => item.box));
});

test('a root image with the same source becomes the slide image instead of content', () => {
  const slide = { title: 'Heading', image: { src: photo, alt: 'Harbor' }, design: { slideImage: { src: photo, position: 'right' } } };
  const result = composeSlide(slide, { layout: { placeholders: [{ type: 'title' }, { type: 'picture' }, { type: 'text' }] } });
  assert.equal(result.slideImage.replacesContent, true);
  assert.equal(result.slideImage.sourcePath, 'slides.0.image');
  assert.deepEqual(result.slideImage.value, { src: photo, alt: 'Harbor' });
  assert.deepEqual(result.items.map(item => item.field), ['title']);
  // A source-less treatment places the slide's own image.
  const placed = composeSlide({ title: 'Heading', image: photo, design: { slideImage: { position: 'top' } } });
  assert.equal(placed.slideImage.value, photo);
  assert.equal(placed.items.some(item => item.field === 'image'), false);
  // A different root image stays content next to the slide image.
  const other = composeSlide({ title: 'Heading', image: 'data:image/png;base64,AAAA', design: { slideImage: { src: photo, position: 'left' } } });
  assert.equal(other.slideImage.replacesContent, false);
  const content = other.items.find(item => item.field === 'image');
  assert.ok(content && within(content.box, other.contentBox));
});

test('fill follows imageFill, crop by default', () => {
  const slide = fill => ({ title: 'Heading', design: { slideImage: { src: photo, position: 'background' }, ...(fill ? { imageFill: fill } : {}) } });
  assert.equal(composeSlide(slide()).slideImage.fill, 'crop');
  assert.equal(composeSlide(slide('fit')).slideImage.fill, 'fit');
  assert.equal(composeSlide({ title: 'Heading', design: { slideImage: { src: photo, position: 'left' } } }, { presentation: { design: { imageFill: 'fit' } } }).slideImage.fill, 'fit');
});

test('asset shorthand uses the layout alignment and missing sources stay inactive', () => {
  const layout = { slideImage: true, slideImageAlignment: 'Bottom' };
  assert.equal(composeSlide({ title: 'Heading' }, { presentation: { design: { slideImage: 'asset:hero' } }, layout }).slideImage.position, 'bottom');
  assert.equal(composeSlide({ title: 'Heading' }, { presentation: { design: { slideImage: { src: 'asset:hero' } } }, layout: { slideImage: true } }).slideImage.position, 'background');
  assert.equal(composeSlide({ title: 'Heading', design: { slideImage: { position: 'left' } } }).slideImage, undefined);
});

test('slide image documents validate against the published schema', () => {
  const deck = { $schema: 'https://openpresentation.org/schema/opf/v1', name: 'Slide image', assets: { hero: { src: photo, alt: 'Harbor' } },
    design: { slideImage: { src: 'asset:hero', position: 'background' }, imageFill: 'crop' },
    slides: [{ title: 'Heading', image: 'asset:hero', design: { slideImage: { src: 'asset:hero', position: 'right' } } }] };
  assert.equal(validatePresentation(deck).valid, true);
});
