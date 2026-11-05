// LH-158: where a cover's or section's heading group goes on a picture background. Candidates (top, middle, bottom; start or centered;
// the panel) are scored on the host's measured grid, with its optional `busy` and `salient` weights; the background's `textPlacement`
// picks one outright; an `overlay` key leaves no scrim and no panel; an unmeasured picture keeps wave 6's position. Left to right and
// right to left.
import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { choosePictureText, composeSlide, PICTURE_TEXT_PLACEMENTS, scorePictureText } from '../dist/composition.js';
import { validate } from '../dist/index.js';

const { layouts } = gallery;
const PHOTO = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#101820"/></svg>').toString('base64');
const columns = 32, rows = 18;
// A luminance grid: `busyAt(row, column)` cells alternate black and white (each cell keeps its darkest and lightest pixel), the rest a calm dark gray.
const grid = (busyAt = () => false, calm = 0.004, extra = {}) => {
  const values = new Float32Array(columns * rows), high = new Float32Array(columns * rows);
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const busy = busyAt(row, column);
    values[row * columns + column] = busy ? 0.004 : calm; high[row * columns + column] = busy ? 0.9 : calm * 1.4;
  }
  return { columns, rows, values, high, ...extra };
};
const weights = (at) => ({ columns, rows, values: Array.from({ length: columns * rows }, (_, index) => at(Math.floor(index / columns), index % columns)) });
// A right-to-left deck's cover is in Arabic, so its start side is the right edge (an English title in it would still start at the left).
let arabic = false;
const cover = (background = {}, extra = {}) => ({ title: arabic ? 'بناء شبكة إمداد أسرع' : 'Building a faster supply network', subtitle: arabic ? 'مراجعة استراتيجية لمجلس الإدارة، أكتوبر 2026' : 'Board strategy review, October 2026', design: { background: { type: 'image', src: PHOTO, tone: 'dark', ...background } }, ...extra });
const compose = (slide, direction, extra = {}, layout = 'cover') => composeSlide(slide, { layout: layouts[layout], direction, darkBackground: true, ...extra });
const title = (result) => result.items.find((item) => item.field === 'title');

for (const direction of ['ltr', 'rtl']) {
  const setDirection = () => { arabic = direction === 'rtl'; };
  test(`LH-158 (${direction}): the group goes to the band that reads, and every candidate is reported with its score`, () => {
    setDirection();
    const busyBottom = compose(cover(), direction, { pictureLuminance: () => grid((row) => row >= 9) });
    const busyTop = compose(cover(), direction, { pictureLuminance: () => grid((row) => row < 9) });
    const unmeasured = compose(cover(), direction);
    assert.equal(busyBottom.pictureText.placement, 'top-start', 'a busy lower half sends the group to the calm top');
    assert.equal(busyBottom.pictureText.source, 'measured');
    assert.deepEqual(busyBottom.pictureText.candidates.map((candidate) => candidate.placement).slice(0, 6), PICTURE_TEXT_PLACEMENTS.slice(0, 6), 'the six placements, in order');
    assert.ok(busyBottom.pictureText.candidates.find((candidate) => candidate.placement === 'top-start').reads);
    assert.ok(!busyBottom.pictureText.candidates.find((candidate) => candidate.placement === 'bottom-start').reads);
    assert.equal(busyTop.pictureText.placement, 'bottom-start', 'the layout\'s own low anchor reads and stays');
    assert.ok(title(busyBottom).box.y < title(unmeasured).box.y - 50 && title(busyTop).box.y > title(unmeasured).box.y + 50);
    assert.equal(unmeasured.pictureText, undefined, 'no measurement, no report: wave 6 centers the group');
    assert.equal(title(busyBottom).alignment, title(unmeasured).alignment, 'the start alignment stays');
    assert.equal(busyBottom.backgroundImage.scrims, undefined, 'a placement that reads needs no scrim');
  });

  test(`LH-158 (${direction}): no band reads, so the scrim carries the lightest place; a scrim above the limit gives way to the panel`, () => {
    setDirection();
    // Mid-gray everywhere: white text needs a light scrim anywhere, so the layout's own place keeps it.
    const scrimmed = compose(cover(), direction, { pictureLuminance: () => grid(() => false, 0.25) });
    assert.equal(scrimmed.pictureText.placement, 'bottom-start');
    assert.equal(scrimmed.pictureText.scrim, true);
    assert.ok(scrimmed.backgroundImage.scrims?.length && scrimmed.backgroundImage.scrims[0].form !== 'panel');
    // Black and white detail everywhere: the scrim would hide most of the picture, so the group sits on the panel.
    const paneled = compose(cover(), direction, { pictureLuminance: () => grid(() => true) });
    const { panel } = paneled.pictureText;
    assert.equal(paneled.pictureText.placement, 'panel');
    assert.equal(panel.edge, direction === 'rtl' ? 'right' : 'left', 'the panel stands on the start side');
    assert.ok(panel.box.width >= 0.4 * paneled.width - 0.5 && panel.box.width <= 0.5 * paneled.width + 0.5 && panel.box.height === paneled.height);
    const scrim = paneled.backgroundImage.scrims[0];
    assert.equal(scrim.form, 'panel'); assert.equal(scrim.opacity, 1); assert.deepEqual(scrim.box, panel.box);
    for (const item of paneled.items) assert.ok(item.box.x >= panel.box.x - 0.5 && item.box.x + item.box.width <= panel.box.x + panel.box.width + 0.5, `${item.field} sits on the panel`);
    // The panel is offered only where the group keeps the sizes it has across the slide in the same pass; the title stays at least at its role size.
    assert.ok(title(paneled).text.fontSize >= 54 - 1e-6);
  });

  test(`LH-158 (${direction}): a host's salient weights keep the text off the subject`, () => {
    setDirection();
    // A calm picture whose subject (a face) stands at the start edge: luminance alone would set the group over it.
    const start = (column) => direction === 'rtl' ? column >= 27 : column < 5;
    const plain = compose(cover(), direction, { pictureLuminance: () => grid() });
    const salient = compose(cover(), direction, { pictureLuminance: () => grid(() => false, 0.004, { salient: weights((row, column) => start(column) ? 1 : 0) }) });
    assert.equal(plain.pictureText.placement, 'bottom-start');
    assert.notEqual(salient.pictureText.placement, 'bottom-start', 'the face is avoided');
    const chosen = salient.pictureText.candidates.find((candidate) => candidate.placement === salient.pictureText.placement);
    assert.ok(chosen.reads && chosen.salient < 0.5);
    assert.ok(salient.pictureText.candidates.find((candidate) => candidate.placement === 'bottom-start').salient === 1);
    // The subject on the end side leaves the start side free in either direction.
    const end = compose(cover(), direction, { pictureLuminance: () => grid(() => false, 0.004, { salient: weights((row, column) => !start(column) && (direction === 'rtl' ? column < 6 : column >= 26) ? 1 : 0) }) });
    assert.equal(end.pictureText.placement, 'bottom-start');
  });

  test(`LH-158 (${direction}): the author's textPlacement and overlay win`, () => {
    setDirection();
    const busy = { pictureLuminance: () => grid((row) => row >= 9) };
    const picked = compose(cover({ textPlacement: 'middle-center' }), direction, busy);
    assert.equal(picked.pictureText.placement, 'middle-center'); assert.equal(picked.pictureText.source, 'authored');
    assert.equal(title(picked).alignment, 'center');
    const unmeasured = compose(cover({ textPlacement: 'top-start' }), direction);
    assert.equal(unmeasured.pictureText.placement, 'top-start', 'an explicit placement needs no measurement');
    assert.deepEqual(unmeasured.pictureText.candidates, []);
    const panel = compose(cover({ textPlacement: 'panel' }), direction);
    assert.equal(panel.pictureText.placement, 'panel'); assert.equal(panel.backgroundImage.scrims[0].form, 'panel');
    // An overlay key leaves no scrim and no panel: the group goes to the least busy band, seen through the overlay.
    const overlaid = compose(cover({ overlay: { color: '#000000', opacity: 0.35 } }), direction, { pictureLuminance: () => grid(() => true) });
    assert.notEqual(overlaid.pictureText.placement, 'panel');
    assert.ok(!overlaid.pictureText.scrim && !overlaid.pictureText.candidates.some((candidate) => candidate.placement === 'panel' || candidate.scrim !== undefined));
    const offPanel = compose(cover({ overlay: false, textPlacement: 'panel' }), direction);
    assert.equal(offPanel.pictureText, undefined, 'a panel cannot be drawn with an overlay key, so the layout\'s position stays');
  });

  test(`LH-158 (${direction}): a section's group and a group beside a body follow the same rule; no picture changes nothing`, () => {
    setDirection();
    const section = compose({ tag: 'Part 3', title: 'Where the network grows', subtitle: 'Three regions, one plan', design: { background: { type: 'image', src: PHOTO, tone: 'dark' } } }, direction, { pictureLuminance: () => grid((row) => row >= 9) }, 'section');
    assert.equal(section.pictureText.placement, 'top-start');
    assert.ok(section.items.find((item) => item.field === 'tag').box.y < section.height / 3);
    const plain = composeSlide({ title: 'Building a faster supply network' }, { layout: layouts.cover, direction, pictureLuminance: () => grid(() => true) });
    assert.equal(plain.pictureText, undefined);
  });
}

test('LH-158: scorePictureText and choosePictureText as a host calls them', () => {
  const picture = { x: 0, y: 0, width: 1280, height: 720 };
  const places = ['top', 'middle', 'bottom'].map((anchor, index) => ({ anchor, alignment: 'start', measure: 1164, box: { x: 58, y: 80 + index * 220, width: 600, height: 150 } }));
  const candidates = scorePictureText({ grid: grid((row) => row < 6), picture, text: '#FFFFFF', scrim: '#000000', places });
  assert.equal(candidates.length, 3);
  assert.ok(!candidates[0].reads && candidates[1].reads && candidates[2].reads);
  assert.equal(choosePictureText(candidates, { anchor: 'top', alignment: 'start' }, ['top', 'middle', 'bottom']).candidate.placement, 'middle-start', 'the reading band with the lowest score, ties in order');
  assert.equal(choosePictureText(candidates, { anchor: 'bottom', alignment: 'start' }, ['bottom', 'middle', 'top']).candidate.placement, 'bottom-start', 'the layout\'s own place when it reads');
  assert.equal(scorePictureText({ grid: { columns: 2, rows: 2, values: [0] }, picture, text: '#FFFFFF', places }), undefined, 'an unusable grid is no measurement');
  const busy = scorePictureText({ grid: grid(() => false, 0.004, { busy: weights((row) => row >= 6 ? 0.8 : 0) }), picture, text: '#FFFFFF', places });
  assert.ok(busy[0].reads && !busy[1].reads && busy[1].busy === 0.8, 'a host\'s busy weight counts as luminance spread');
});

test('LH-158: textPlacement is a schema key of an image background', () => {
  assert.equal(validate({ $schema: 'https://openpresentation.org/schema/opf/v1', name: 'Placement', language: 'en-US', slides: [{ title: 'A', design: { background: { type: 'image', src: PHOTO, textPlacement: 'top-start' } } }] }).valid, true);
  assert.equal(validate({ $schema: 'https://openpresentation.org/schema/opf/v1', name: 'Placement', language: 'en-US', slides: [{ title: 'A', design: { background: { type: 'image', src: PHOTO, textPlacement: 'left' } } }] }).valid, false);
});
