// LH-132: team portraits at card size (across the top of the card for 2 to 4 people, beside the text for 5 or 6, the avatar for more),
// a testimonial's photo as a tall portrait beside the quote, and the author's `portrait` option, left to right and right to left.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, PORTRAIT_FOCUS_Y, PORTRAIT_SIDE_SHARE } from '../dist/composition.js';
import { layouts } from './support/template-samples.mjs';
import { check, errorsOf } from './support/validation.mjs';

const face = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" width="100" height="140"><rect width="100" height="140" fill="#eee"/><circle cx="50" cy="56" r="22" fill="#a76"/></svg>').toString('base64')}`;
const names = [['Amara Okafor', 'Chief executive', 'Founded the company in 2016.'], ['Daniel Reyes', 'Chief technology officer', 'Leads the platform team.'], ['Mei Tanaka', 'Chief financial officer', 'Joined in 2023.'], ['Samuel Adeyemi', 'Chief operating officer', 'Runs fulfillment.'], ['Lena Fischer', 'Head of customer success', 'Built onboarding.'], ['Tomas Herrera', 'Support operations lead', 'Owns staffing.'], ['Priya Nair', 'Onboarding manager', 'Launched 60 customers.'], ['Jonas Berg', 'Solutions engineer', 'Integrations.']];
const person = ([name, role, line], portrait) => ({ region: 'people', composition: { mode: 'column' }, blocks: [{ image: { src: face, alt: name }, shape: 'circle', ...(portrait ? { portrait } : {}) }, { items: [{ text: name, description: `${role}\n${line}` }] }] });
const team = (count, portrait, direction = 'ltr') => composeSlide({ title: 'The team', blocks: names.slice(0, count).map((entry, index) => person(entry, index === 0 ? portrait : undefined)) }, { layout: layouts.team, direction });
const pictures = (result) => result.items.filter((item) => item.field === 'image');
const texts = (result) => result.items.filter((item) => item.field === 'items');
const findings = (result) => result.diagnostics.filter((entry) => entry.code === 'text-overflow' || entry.code === 'small-cell');
const sameBox = (a, b) => ['x', 'y', 'width', 'height'].every((key) => Math.abs(a[key] - b[key]) < 0.01);

for (const direction of ['ltr', 'rtl']) {
  test(`LH-132 (${direction}): four people draw their portraits across the top of four equal cards in one row`, () => {
    const result = team(4, undefined, direction), avatar = team(4, 'avatar', direction);
    assert.deepEqual(findings(result), []);
    const images = pictures(result), words = texts(result);
    assert.equal(images.length, 4);
    for (const [index, image] of images.entries()) {
      const card = image.frameBox, text = words[index];
      assert.ok(card && sameBox(card, text.frameBox), 'the picture and the text share one card');
      assert.equal(image.image.shape.kind, 'rounded');
      assert.equal(image.image.fit, 'cover');
      assert.deepEqual(image.image.focus, { x: 0.5, y: PORTRAIT_FOCUS_Y });
      assert.ok(image.image.box.height >= image.image.box.width * 0.75 - 0.5, 'never flatter than 4:3');
      assert.ok(image.image.box.y + image.image.box.height <= text.box.y + 0.5, 'the portrait is above the text');
      assert.ok(image.image.box.width > card.width * 0.8, 'at the card width');
      assert.ok(Math.abs(card.y - images[0].frameBox.y) < 0.01 && Math.abs(card.height - images[0].frameBox.height) < 0.01, 'equal cards');
    }
    const xs = images.map((image) => image.frameBox.x);
    assert.deepEqual([...xs].sort((a, b) => (direction === 'rtl' ? b - a : a - b)), xs, 'one row in reading order');
    // The size guard: no name, role or line is smaller than with the avatars.
    texts(avatar).forEach((item, index) => assert.ok(words[index].text.fontSize >= item.text.fontSize - 1e-9, `${item.path}: ${words[index].text.fontSize} < ${item.text.fontSize}`));
    assert.ok(images[0].image.box.width > pictures(avatar)[0].image.box.width * 1.5, 'the portrait is bigger than the avatar');
  });

  test(`LH-132 (${direction}): six people draw their portraits beside the text, at the start side`, () => {
    const result = team(6, undefined, direction), avatar = team(6, 'avatar', direction);
    assert.deepEqual(findings(result), []);
    for (const [index, image] of pictures(result).entries()) {
      const text = texts(result)[index], card = image.frameBox;
      assert.equal(image.image.shape.kind, 'rounded');
      assert.ok(Math.abs(image.image.box.width - PORTRAIT_SIDE_SHARE * (card.width - 2 * (image.image.box.x - card.x < card.width / 2 ? image.image.box.x - card.x : card.x + card.width - image.image.box.x - image.image.box.width))) < 2, 'about 40% of the card');
      if (direction === 'ltr') assert.ok(image.image.box.x + image.image.box.width <= text.box.x + 0.5, 'start side is the left');
      else assert.ok(text.box.x + text.box.width <= image.image.box.x + 0.5, 'start side is the right');
      assert.ok(image.image.box.height > image.image.box.width, 'a tall portrait');
    }
    texts(avatar).forEach((item, index) => assert.ok(texts(result)[index].text.fontSize >= item.text.fontSize - 1e-9, item.path));
  });
}

test('LH-132: eight people keep the avatar; the author chooses with portrait', () => {
  for (const image of pictures(team(8))) assert.equal(image.image.shape.kind, 'circle');
  for (const image of pictures(team(3, 'avatar'))) assert.equal(image.image.shape.kind, 'circle');
  const side = team(4, 'side');
  for (const [index, image] of pictures(side).entries()) {
    assert.equal(image.image.shape.kind, 'rounded');
    assert.ok(image.image.box.x + image.image.box.width <= texts(side)[index].box.x + 0.5, 'portrait: side puts it beside the text');
  }
  // An authored focus and shape win.
  const own = composeSlide({ title: 'The team', blocks: names.slice(0, 4).map((entry, index) => index ? person(entry) : { ...person(entry), blocks: [{ image: { src: face, alt: 'A' }, shape: 'rectangle', focus: { x: 0.2, y: 0.1 } }, person(entry).blocks[1]] }) }, { layout: layouts.team });
  assert.equal(pictures(own)[0].image.shape.kind, 'rectangle');
  assert.deepEqual(pictures(own)[0].image.focus, { x: 0.2, y: 0.1 });
});

const quote = (photo, portrait, direction = 'ltr', count = 1) => composeSlide({ title: 'Why they switched', blocks: Array.from({ length: count }, () => ({ region: 'quotes', quote: { text: 'We cut stockouts by a third in the first quarter, and my planners finally trust the forecast.', attribution: 'Priya Raman', role: 'VP Operations, Brightwater Foods', ...(photo ? { photo: { src: face, alt: 'Priya Raman' } } : {}), ...(portrait ? { portrait } : {}) } })) }, { layout: layouts.quote, direction });
const parts = (item) => Object.fromEntries(item.quoteLayout.parts.map((part) => [part.role, part.fit.fontSize]));

for (const direction of ['ltr', 'rtl']) {
  test(`LH-132 (${direction}): a testimonial's photo is a tall portrait beside the quote, at the avatar's sizes`, () => {
    const [item] = quote(true, undefined, direction).items.filter((entry) => entry.quoteLayout);
    const [avatar] = quote(true, 'avatar', direction).items.filter((entry) => entry.quoteLayout);
    const photo = item.quoteLayout.photo, body = item.quoteLayout.parts.find((part) => part.role === 'body');
    assert.equal(photo.shape.preset, 'roundRect');
    assert.deepEqual(photo.focus, { x: 0.5, y: PORTRAIT_FOCUS_Y });
    assert.ok(photo.box.height > photo.box.width, 'tall');
    if (direction === 'ltr') assert.ok(photo.box.x + photo.box.width < body.box.x, 'beside the text, at the start');
    else assert.ok(body.box.x + body.box.width < photo.box.x, 'beside the text, at the start (right)');
    for (const [role, size] of Object.entries(parts(avatar))) assert.ok(parts(item)[role] >= size - 1e-9, `${role}: ${parts(item)[role]} < ${size}`);
    assert.equal(avatar.quoteLayout.photo.shape.preset, 'ellipse', 'portrait: avatar keeps the circle');
    assert.equal(avatar.quoteLayout.photo.focus, undefined);
  });
}

test('LH-132: a quote without a photo, and quotes side by side, are as before', () => {
  const [plain] = quote(false).items.filter((entry) => entry.quoteLayout);
  assert.equal(plain.quoteLayout.photo, undefined);
  for (const item of quote(true, undefined, 'ltr', 3).items.filter((entry) => entry.quoteLayout)) assert.equal(item.quoteLayout.photo.shape.preset, 'ellipse');
  // The author's side portrait applies whatever the width.
  for (const item of quote(true, 'side', 'ltr', 3).items.filter((entry) => entry.quoteLayout)) assert.equal(item.quoteLayout.photo.shape.preset, 'roundRect');
});

test('LH-132: portrait is an image option and a quote field', () => {
  const deck = (slides) => ({ $schema: 'https://openpresentation.org/schema/opf/v1', name: 'Portraits', slides });
  assert.equal(check(deck([{ title: 'Team', layout: 'team', blocks: [person(names[0], 'top'), person(names[1])] }])).valid, true);
  assert.equal(check(deck([{ title: 'Quote', blocks: [{ quote: { text: 'Yes.', photo: { src: face, alt: 'A' }, portrait: 'side' } }] }])).valid, true);
  assert.equal(check(deck([{ title: 'Quote', blocks: [{ quote: { text: 'Yes.', portrait: 'top' } }] }])).valid, false, 'a quote has no top portrait');
  assert.equal(check(deck([{ title: 'Team', blocks: [{ image: { src: face, alt: 'A' }, portrait: 'large' }] }])).valid, false);
  const text = check(deck([{ title: 'Heading', blocks: [{ text: 'Body', portrait: 'top' }] }]));
  assert.deepEqual(errorsOf(text).map((f) => [f.ruleId, f.path]), [['opf/image-option-unsupported-payload', '/slides/0/blocks/0/portrait']]);
});
