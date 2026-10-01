import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide, layoutFurniture} from '../dist/composition.js';
import {PICTURE_BULLET_SCALE} from '../dist/index.js';

// Two geometry decisions recorded in docs/design-resolution.md and docs/dynamic-composition.md:
// the picture-bullet box (measured against desktop PowerPoint) and the alignment of furniture image parts.
const png = (width, height) => {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
};
const uri = (type, bytes) => `data:image/${type};base64,${Buffer.from(bytes).toString('base64')}`;
const be16 = value => [value >> 8, value & 255], le16 = value => [value & 255, value >> 8], le24 = value => [value & 255, (value >> 8) & 255, value >> 16];
const jpeg = (width, height) => uri('jpeg', [0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, ...be16(height), ...be16(width), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
const gif = (width, height) => uri('gif', [...Buffer.from('GIF89a'), ...le16(width), ...le16(height), 0, 0, 0]);
const webp = (width, height) => uri('webp', [...Buffer.from('RIFF'), 30, 0, 0, 0, ...Buffer.from('WEBPVP8X'), 10, 0, 0, 0, 0, 0, 0, 0, ...le24(width - 1), ...le24(height - 1)]);
const svg = markup => `data:image/svg+xml;base64,${Buffer.from(markup).toString('base64')}`;
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} vs ${expected}`);

test('a picture bullet draws as a square 0.65 of the font size with its bottom on the baseline and its left at the marker', () => {
  assert.equal(PICTURE_BULLET_SCALE, 0.65);
  const presentation = {design: {listBullet: 'image', logo: png(64, 64)}};
  const result = composeSlide({title: 'List', items: ['One', {text: 'Two', level: 1}, 'Three']}, {presentation});
  const entries = result.items.find(item => item.field === 'items').text.listEntries;
  assert.equal(entries.length, 3);
  for (const entry of entries) {
    const side = entry.marker.fontSize * 0.65;
    assert.deepEqual(entry.bulletBox, {x: entry.marker.x, y: entry.marker.y - side, width: side, height: side});
  }
  // PowerPoint's measured sizes at 25 px text (18.75 pt) and 16 px text (12 pt): about 16 and 10 px.
  near(25 * PICTURE_BULLET_SCALE, 16.25, 'a 25 px list');
  near(16 * PICTURE_BULLET_SCALE, 10.4, 'a 16 px list');
  const plain = composeSlide({title: 'List', items: ['One']}, {});
  assert.equal(plain.items.find(item => item.field === 'items').text.listEntries[0].bulletBox, undefined, 'glyph markers carry no box');
});

test('furniture images and logos align like the zone text: left edge, centered, right edge', () => {
  const presentation = {design: {logo: {icon: png(128, 128)}, header: {left: {image: png(128, 128)}, center: {logo: true}, right: {image: png(128, 128)}}, footer: {left: {logo: true}, right: {text: 'Right'}}}};
  const layout = layoutFurniture({}, {presentation});
  const zoneX = {left: 1280 * 0.07, center: 1280 * 0.37, right: 1280 * 0.67}, zoneWidth = 1280 * 0.26;
  const images = layout.parts.filter(part => part.type === 'image');
  assert.equal(images.length, 4);
  for (const part of images) {
    near(part.box.width, part.box.height, `${part.kind} ${part.zone} ${part.field} is as wide as it is tall`);
    const expected = part.zone === 'left' ? zoneX.left : part.zone === 'center' ? zoneX.center + (zoneWidth - part.box.width) / 2 : zoneX.right + zoneWidth - part.box.width;
    near(part.box.x, expected, `${part.kind} ${part.zone} ${part.field} x`);
  }
  // The text of the same zone still spans the full zone box, so its left and right edges are the images' edges.
  const right = layout.parts.find(part => part.type === 'text' && part.zone === 'right');
  near(right.box.x + right.box.width, images.find(part => part.zone === 'right').box.x + images.find(part => part.zone === 'right').box.width, 'right edges meet');
  // Vertical placement is unchanged: the header band starts at 2.5% of the height.
  near(images.find(part => part.kind === 'header').box.y, 720 * 0.025, 'header image top');
  assert.deepEqual(layout.parts.map(part => part.alignment), layout.parts.map(part => part.zone));
});

test('a furniture image keeps its own proportions, capped at the zone; unreadable sources are square', () => {
  const place = (image, zone = 'right') => layoutFurniture({}, {presentation: {design: {header: {[zone]: {image}}}}}).parts[0];
  const wide = place(png(400, 100));
  near(wide.box.width, wide.box.height * 4, 'a 4:1 PNG');
  near(wide.box.x + wide.box.width, 1280 * 0.93, 'the wide image still ends at the zone edge');
  const tall = place(png(50, 100), 'left');
  near(tall.box.width, tall.box.height / 2, 'a 1:2 PNG');
  near(tall.box.x, 1280 * 0.07, 'the tall image starts at the zone edge');
  const huge = place(png(4000, 100), 'center');
  near(huge.box.width, 1280 * 0.26, 'an extreme ratio is capped at the zone');
  near(huge.box.x, 1280 * 0.37, 'a capped centered image fills the zone');
  for (const [name, image] of [['JPEG', jpeg(300, 100)], ['GIF', gif(300, 100)], ['WebP', webp(300, 100)]]) near(place(image).box.width / place(image).box.height, 3, `a 3:1 ${name}`);
  const vector = place(svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><rect width="300" height="100"/></svg>'));
  near(vector.box.width, vector.box.height * 3, 'an SVG viewBox');
  const sized = place(svg('<svg xmlns="http://www.w3.org/2000/svg" width="200px" height="50"/>'));
  near(sized.box.width, sized.box.height * 4, 'SVG width and height');
  for (const unreadable of ['./assets/logo.svg', 'https://example.com/logo.png', 'asset:missing', 'data:image/png;base64,not-a-png']) {
    const part = place(unreadable);
    near(part.box.width, part.box.height, `${unreadable} falls back to a square`);
  }
});

test('asset references resolve through the deck assets for the image proportions', () => {
  const presentation = {assets: {wordmark: {src: png(300, 100)}, alias: 'asset:wordmark', loop: 'asset:loop'}, design: {header: {right: {image: 'asset:alias'}}, footer: {left: {image: 'asset:loop'}}}};
  const [header, footer] = layoutFurniture({}, {presentation}).parts;
  near(header.box.width, header.box.height * 3, 'a chain of references');
  near(footer.box.width, footer.box.height, 'a reference loop is unreadable');
});
