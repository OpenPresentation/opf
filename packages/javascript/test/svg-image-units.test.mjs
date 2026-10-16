import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide, intrinsicImageAspect, intrinsicImageSize} from '../dist/composition.js';
const svg = attributes => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" ${attributes}><rect width="100%" height="100%"/></svg>`);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test('absolute SVG lengths use common CSS pixel units', () => {
  for (const attrs of ['width="2in" height="72pt"', 'width="5.08cm" height="25.4mm"', 'width="192px" height="96"', 'width=" 2IN " height=" 72PT "']) {
    const source = svg(attrs), size = intrinsicImageSize(source);
    assert.equal(size.svg, true);
    close(size.width, 192); close(size.height, 96);
    close(intrinsicImageAspect(source), 2);
  }
});
test('same-unit and unitless proportions remain correct, with existing asset references/cache semantics', () => {
  for (const attrs of ['width="2" height="1"', 'width="2cm" height="1cm"', 'width="2pt" height="1pt"']) close(intrinsicImageAspect(svg(attrs)), 2);
  const source = svg('width="192px" height="96px"');
  const assets = {logo: source};
  assert.deepEqual(intrinsicImageSize('asset:logo', assets), {width: 192, height: 96, svg: true});
  const first = intrinsicImageSize(source); first.width = 1;
  assert.equal(intrinsicImageSize(source).width, 192, 'returned dimensions cannot mutate cached bytes');
});
test('viewBox supplies relative or missing dimensions without guessing a viewport or font', () => {
  for (const attrs of ['viewBox="0 0 200 100"', 'width="100%" height="50%" viewBox="0 0 200 100"', 'width="2em" height="1em" viewBox="0 0 200 100"', 'width="192px" height="1em" viewBox="0 0 200 100"']) close(intrinsicImageAspect(svg(attrs)), 2);
  for (const attrs of ['width="2em" height="1em"', 'width="100%" height="50%"', 'width="192px" height="1em"', 'viewBox="0 0 0 100"']) assert.equal(intrinsicImageAspect(svg(attrs)), undefined);
  assert.equal(intrinsicImageAspect('https://example.org/logo.svg'), undefined, 'no image fetch is added');
});
test('actual composition places equivalent mixed-unit and pixel SVGs identically', () => {
  const image = source => composeSlide({image: source, fit: 'contain'}).items.find(item => item.field === 'image').image;
  const mixed = image(svg('width="2in" height="72pt"'));
  const pixels = image(svg('width="192px" height="96px"'));
  assert.deepEqual(mixed, pixels);
  close(mixed.picture.image.width / mixed.picture.image.height, 2);
});
