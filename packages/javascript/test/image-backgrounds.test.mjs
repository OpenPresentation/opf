import assert from 'node:assert/strict';
import test from 'node:test';
import { composeSlide, fitImage, imageBackground } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';
import { check, errorsOf } from './support/validation.mjs';

// FA-22: a picture background is the slide's canvas fill. It fills the whole slide, never moves content, and carries
// fit, focus, opacity, an overlay and alt text. composeSlide reports it as SlideComposition.backgroundImage.

// A 4x2 PNG header (aspect 2): enough for core to read the picture's proportions without decoding pixels.
const png = (width, height) => {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
};
const wide = png(400, 200);
const canvas = { x: 0, y: 0, width: 1280, height: 720 };
const deck = (slide, design) => ({ $schema: 'https://openpresentation.org/schema/opf/v1', name: 'Backgrounds', ...(design ? { design } : {}), slides: [slide] });
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-4, `${label}: ${actual} vs ${expected}`);
const inside = (point, box) => point.x >= box.x - 1e-6 && point.x <= box.x + box.width + 1e-6 && point.y >= box.y - 1e-6 && point.y <= box.y + box.height + 1e-6;

test('the object form composes a whole-canvas frame with fit, focus, opacity and alt', () => {
  const result = composeSlide({ title: 'Shipping, rebuilt', design: { background: { type: 'image', src: './images/harbour.jpg', alt: 'Container ships at dawn', fit: 'contain', focus: { x: 0.5, y: 0.7 }, opacity: 0.8 } } });
  assert.deepEqual(result.backgroundImage, { path: 'slides.0.design.background', src: './images/harbour.jpg', alt: 'Container ships at dawn', fit: 'contain', focus: { x: 0.5, y: 0.7 }, box: canvas, opacity: 0.8 });
  // Defaults: cover, centered focus, opacity 1 (not reported).
  const plain = composeSlide({ title: 'T', design: { background: { type: 'image', src: 'asset:hero' } } });
  assert.deepEqual(plain.backgroundImage, { path: 'slides.0.design.background', src: 'asset:hero', fit: 'cover', focus: { x: 0.5, y: 0.5 }, box: canvas });
});

test('the background chain is the slide, then the deck, then the theme; a colour background has no picture', () => {
  const background = { type: 'image', src: 'asset:deck' };
  assert.equal(composeSlide({ title: 'T' }, { presentation: { design: { background } } }).backgroundImage.path, 'design.background');
  assert.equal(composeSlide({ title: 'T', design: { background: 'dark1' } }, { presentation: { design: { background } } }).backgroundImage, undefined);
  assert.equal(composeSlide({ title: 'T' }, { themeBackground: 'asset:theme' }).backgroundImage.path, 'theme');
  assert.equal(composeSlide({ title: 'T' }, { presentation: { design: { background: '#ffffff' } }, themeBackground: 'asset:theme' }).backgroundImage, undefined);
  // resolveSlideContext passes the resolved theme's background, here a theme record the document embeds.
  const presentation = { ...deck({ title: 'T' }, { theme: 'textured' }), catalogs: { custom: { themes: { textured: { name: 'Textured', background: { type: 'image', src: 'asset:texture', fit: 'tile' } } } } } };
  const context = resolveSlideContext(presentation, 0);
  assert.deepEqual(context.options.themeBackground, { type: 'image', src: 'asset:texture', fit: 'tile' });
  const tiled = composeSlide(presentation.slides[0], context.options).backgroundImage;
  assert.equal(tiled.fit, 'tile');
  assert.equal(tiled.picture, undefined, 'a tile has no fit placement');
});

test('a full-bleed background never moves content: headings and body compose as without it', () => {
  for (const slide of [{ title: 'Heading', text: 'Body' }, { title: 'Cover title', subtitle: 'A cover' }]) {
    const bare = composeSlide(slide);
    const over = composeSlide({ ...slide, design: { background: { type: 'image', src: wide, overlay: { color: 'dark1', opacity: 0.4 } } } });
    assert.deepEqual(over.items.map((item) => item.box), bare.items.map((item) => item.box));
    assert.deepEqual(over.contentBox, bare.contentBox);
  }
});

test('cover, contain, stretch and tile: the frame is the canvas and the fit placement follows the picture', () => {
  for (const [fit, image, crop] of [
    ['cover', null, null],
    ['contain', { x: 0, y: 40, width: 1280, height: 640 }, { left: 0, top: -0.0625, right: 0, bottom: -0.0625 }],
    ['stretch', canvas, { left: 0, top: 0, right: 0, bottom: 0 }],
  ]) {
    const result = composeSlide({ title: 'T', design: { background: { type: 'image', src: wide, fit } } });
    assert.deepEqual(result.backgroundImage.box, canvas, fit);
    if (fit === 'cover') {
      // A 2:1 picture on a 16:9 canvas covers it at 1440 x 720 and crops the sides around the center.
      assert.deepEqual(result.backgroundImage.picture, { image: { x: -80, y: 0, width: 1440, height: 720 }, crop: { left: 0.055556, top: 0, right: 0.055556, bottom: 0 } });
    } else {
      assert.deepEqual(result.backgroundImage.picture.image, image, fit);
      assert.deepEqual(result.backgroundImage.picture.crop, crop, fit);
    }
  }
  assert.equal(composeSlide({ title: 'T', design: { background: { type: 'image', src: wide, fit: 'tile' } } }).backgroundImage.fit, 'tile');
  // URLs and paths are never fetched: no placement, engines call fitImage with the aspect they read.
  assert.equal(composeSlide({ title: 'T', design: { background: './photo.jpg' } }).backgroundImage.picture, undefined);
});

test('focus at a corner stays inside the visible crop on a 16:9 and a 4:3 deck', () => {
  for (const frame of [{ x: 0, y: 0, width: 1280, height: 720 }, { x: 0, y: 0, width: 960, height: 720 }]) {
    for (const aspect of [0.5, 1, 2, 3]) {
      for (const focus of [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0.9, y: 0.15 }, { x: 0.5, y: 0.5 }]) {
        const { image, crop } = fitImage(frame, 'cover', aspect, focus);
        // The picture covers the frame...
        assert.ok(image.x <= frame.x + 1e-6 && image.y <= frame.y + 1e-6 && image.x + image.width >= frame.x + frame.width - 1e-6 && image.y + image.height >= frame.y + frame.height - 1e-6);
        // ...and the focus point of the picture lands in the frame.
        assert.ok(inside({ x: image.x + focus.x * image.width, y: image.y + focus.y * image.height }, frame), `${frame.width}x${frame.height} aspect ${aspect} focus ${JSON.stringify(focus)}`);
        for (const side of ['left', 'top', 'right', 'bottom']) assert.ok(crop[side] >= 0, 'cover only crops');
      }
    }
  }
  // Center focus is a center crop; a corner focus aligns that corner.
  assert.deepEqual(fitImage({ x: 0, y: 0, width: 1280, height: 720 }, 'cover', 2, { x: 0, y: 0 }).image, { x: 0, y: 0, width: 1440, height: 720 });
  assert.deepEqual(fitImage({ x: 0, y: 0, width: 1280, height: 720 }, 'cover', 2, { x: 1, y: 1 }).image, { x: -160, y: 0, width: 1440, height: 720 });
  // Contain and stretch ignore focus.
  assert.deepEqual(fitImage(canvas, 'contain', 2, { x: 0, y: 0 }), fitImage(canvas, 'contain', 2));
  near(fitImage(canvas, 'cover', 2, { x: 0.25, y: 0.5 }).image.x, 0, 'a focus left of center is clamped at the edge');
});

test('recolor applies to the background picture as on an image block: grayscale or duotone', () => {
  const recolor = (value) => composeSlide({ title: 'T', design: { background: { type: 'image', src: wide, opacity: 0.5, recolor: value, overlay: { color: 'dark1', opacity: 0.3, edge: 'top' } } } }).backgroundImage;
  assert.deepEqual(recolor('grayscale').recolor, { type: 'grayscale' });
  const duotone = recolor({ dark: 'accent1', light: '#FFFFFF' });
  assert.deepEqual(duotone.recolor, { type: 'duotone', dark: 'accent1', light: '#FFFFFF' });
  assert.equal(duotone.opacity, 0.5);
  assert.equal(duotone.overlay.edge, 'top');
  assert.equal(recolor(undefined).recolor, undefined);
});

test('an overlay covers the whole picture, or a band along one edge', () => {
  const whole = composeSlide({ title: 'T', design: { background: { type: 'image', src: wide, overlay: { color: 'dark1', opacity: 0.4 } } } }).backgroundImage.overlay;
  assert.deepEqual(whole, { path: 'slides.0.design.background.overlay', color: 'dark1', opacity: 0.4, box: canvas, shape: { kind: 'rectangle', preset: 'rect', adjust: {}, path: 'M0 0H1280V720H0Z' } });
  const band = composeSlide({ title: 'T', design: { background: { type: 'image', src: wide, overlay: { color: '#000000', opacity: 0.75, edge: 'bottom', size: 0.25 } } } }).backgroundImage.overlay;
  assert.equal(band.edge, 'bottom');
  assert.deepEqual(band.box, { x: 0, y: 540, width: 1280, height: 180 });
  // Default band 0.3; a right-to-left deck mirrors left and right.
  const left = composeSlide({ title: 'T', design: { background: { type: 'image', src: wide, overlay: { color: '#000000', opacity: 0.5, edge: 'left' } } } }).backgroundImage.overlay;
  assert.deepEqual(left.box, { x: 0, y: 0, width: 384, height: 720 });
  const mirrored = composeSlide({ title: 'T', design: { background: { type: 'image', src: wide, overlay: { color: '#000000', opacity: 0.5, edge: 'left' } } } }, { direction: 'rtl' }).backgroundImage.overlay;
  assert.equal(mirrored.edge, 'right');
  assert.deepEqual(mirrored.box, { x: 896, y: 0, width: 384, height: 720 });
});

test('the string shorthand: image sources are cover images, theme slots and hex colours keep their meaning, other strings are invalid', () => {
  for (const [shorthand, valid, picture] of [['asset:x', true, true], ['./x.jpg', true, true], ['../x.jpg', true, true], ['https://cdn.acme.com/x.jpg', true, true], ['data:image/png;base64,AAAA', true, true],
    ['light1', true, false], ['#ffffff', true, false], ['x.jpg', false, false], ['http://cdn.acme.com/x.jpg', false, false], ['/abs/x.jpg', false, false]]) {
    const document = deck({ title: 'T', design: { background: shorthand } }, { theme: 'minimal' });
    const report = check(document);
    assert.equal(report.valid, valid, `${shorthand}: ${JSON.stringify(errorsOf(report).map((e) => e.message))}`);
    const composed = composeSlide(document.slides[0]).backgroundImage;
    assert.equal(composed !== undefined, picture, shorthand);
    if (picture) assert.deepEqual({ src: composed.src, fit: composed.fit }, { src: shorthand, fit: 'cover' });
  }
  assert.deepEqual(imageBackground('asset:x'), { src: 'asset:x', fit: 'cover', focus: { x: 0.5, y: 0.5 } });
  assert.equal(imageBackground('dark1'), undefined);
});

test('the flat image background validates; the 0.14 image wrapper and unknown keys do not', () => {
  const ok = { type: 'image', src: 'asset:hero', alt: 'Harbour', fit: 'tile', focus: { x: 0, y: 1 }, opacity: 0.5, recolor: { dark: 'accent1', light: 'light1' }, overlay: { color: 'text', opacity: 0.3, edge: 'top', size: 0.2 } };
  assert.equal(check(deck({ title: 'T' }, { background: ok })).valid, true);
  for (const bad of [
    { type: 'image', image: { src: 'asset:hero', fit: 'cover' } },
    { type: 'image', src: 'asset:hero', fit: 'crop' },
    { type: 'image', src: 'asset:hero', focus: { x: 2, y: 0 } },
    { type: 'image', src: 'asset:hero', focus: { x: 0.5 } },
    { type: 'image', src: 'asset:hero', overlay: { color: 'dark1' } },
    { type: 'image', src: 'asset:hero', recolor: 'sepia' },
    { type: 'image', src: 'asset:hero', shape: 'circle' },
  ]) assert.equal(check(deck({ title: 'T' }, { background: bad })).valid, false, JSON.stringify(bad));
});

test('text over a picture background: contrast is certain only with a strong full-frame overlay, never with an edge band (the minimal theme draws dark text, so the scrim is light)', async () => {
  const { validate } = await import('../dist/index.js');
  const rules = (background) => validate(deck({ title: 'Quarterly results' }, { theme: 'minimal', background }), { only: ['accessibility'] }).findings.map((f) => f.ruleId);
  assert.ok(rules({ type: 'image', src: wide }).includes('opf/text-on-image'));
  assert.ok(!rules({ type: 'image', src: wide, overlay: { color: '#FFFFFF', opacity: 0.85 } }).includes('opf/text-on-image'));
  assert.ok(rules({ type: 'image', src: wide, overlay: { color: '#FFFFFF', opacity: 0.85, edge: 'bottom' } }).includes('opf/text-on-image'));
});
