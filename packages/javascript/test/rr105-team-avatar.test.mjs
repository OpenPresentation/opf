import assert from 'node:assert/strict';
import test from 'node:test';
import { TEAM_AVATAR, composeSlide } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

// RR-105 (coverage finding 12): `portrait: "avatar"` on a team draws the small circle over the name the schema describes, not the large
// picture of a top portrait. The text grows as a card row's does, up to a list's display size, and the circle scales with the name
// (TEAM_AVATAR.lineRatio times its line height, at least TEAM_AVATAR.least, at most TEAM_AVATAR.widthShare of the card), so the team fills its body.

const NAMES = [['Alice Moreno', 'Operations'], ['Ben Okafor', 'Finance'], ['Chen Wei', 'Engineering'], ['Dana Ruiz', 'Design'], ['Eli Novak', 'Sales'], ['Fatima Haddad', 'Legal']];
const person = ([name, role], portrait, composition) => ({ type: 'group', ...(composition ? { composition } : {}), blocks: [{ image: { src: 'https://example.com/portrait.png', alt: `Portrait of ${name}` }, ...(portrait ? { portrait } : {}) }, { items: [{ text: name, description: `${role}\nLeads the ${role.toLowerCase()} team since 2021.` }] }] });
const composed = (count, portrait, composition) => {
  const deck = { $schema: 'https://openpresentation.org/schema/opf/v1', language: 'en-US', slides: [{ title: 'Team', blocks: NAMES.slice(0, count).map((entry) => person(entry, portrait, composition)) }] };
  const context = resolveSlideContext(deck, 0);
  return composeSlide(context.slide, context.options);
};
const pictures = (result) => result.items.filter((item) => item.field === 'image');
const names = (result) => result.items.filter((item) => item.field === 'items');

for (const count of [2, 3, 4, 6]) {
  test(`a team of ${count} with portrait avatar draws small circles over the names`, () => {
    const result = composed(count, 'avatar'), scale = Math.min(result.width, result.height) / 720;
    const images = pictures(result), texts = names(result);
    assert.equal(images.length, count);
    for (const [index, item] of images.entries()) {
      const box = item.image.box, text = texts[index].box;
      assert.equal(item.image.shape.preset, 'ellipse', 'a circle');
      assert.ok(Math.abs(box.width - box.height) < 0.01, 'as wide as tall');
      const nameLine = TEAM_AVATAR.lineRatio * texts[index].text.fontSize * 1.25 * 1.2;
      assert.ok(box.width <= Math.max(TEAM_AVATAR.least * scale, Math.min(nameLine, texts[index].box.width * TEAM_AVATAR.widthShare)) + 0.01 && box.width >= TEAM_AVATAR.least * scale - 0.01, `${box.width} px across`);
      assert.ok(box.y + box.height <= text.y + 0.01, 'over the name');
      assert.ok(Math.abs(box.x - text.x) < 0.01, 'at the start of the card');
    }
    // The team's text is one size, and never smaller than the same team drawn as top portraits.
    assert.equal(new Set(texts.map((item) => item.text.fontSize)).size, 1);
    // The text grows (up to a list's display size) and the team fills a good share of the body, in its middle.
    const upper = Math.min(...images.map((item) => item.image.box.y)), bottom = Math.max(...texts.map((item) => item.box.y + item.box.height)), body = result.contentBox;
    assert.ok((bottom - upper) / body.height >= (count <= 4 ? 0.4 : 0.6), `fills ${((bottom - upper) / body.height).toFixed(2)}`);
    assert.ok(Math.abs((upper - body.y) - (body.y + body.height - bottom)) < 0.15 * body.height, "in the middle");
    // Never smaller than the same people as plain groups (a group that sets columns is no person), as the avatar team was drawn before.
    const plain = composed(count, undefined, { mode: 'column', columns: 1 });
    assert.ok(texts[0].text.fontSize >= names(plain)[0].text.fontSize - 1e-9, `${texts[0].text.fontSize} >= ${names(plain)[0].text.fontSize}`);
    const top = composed(count, 'top');
    assert.ok(texts[0].text.fontSize >= names(top)[0].text.fontSize - 1e-9, `${texts[0].text.fontSize} >= ${names(top)[0].text.fontSize}`);
    assert.ok(Math.max(...pictures(top).map((item) => item.image.box.width)) > Math.max(...images.map((item) => item.image.box.width)), 'smaller than a portrait');
    // Three people in one row, six in two rows of three.
    assert.equal(new Set(images.map((item) => Math.round(item.image.box.y))).size, count <= 4 ? 1 : 2);
  });
}

test('an authored top portrait and an automatic team are unchanged by the avatar', () => {
  const automatic = composed(3);
  assert.notEqual(pictures(automatic)[0].image.shape.preset, 'ellipse');
  assert.ok(pictures(automatic)[0].image.box.width > 2 * TEAM_AVATAR.least);
});
