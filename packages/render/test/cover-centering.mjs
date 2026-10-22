import assert from 'node:assert/strict';
import {resolvePresentation, toSvg} from './catalog-harness.mjs';

// Core centers the heading group of cover slides (no body payload on a
// heading-only layout). The preview must draw that group exactly where core
// composed it: traced boxes equal the composed boxes and the drawn text sits
// inside its box. Content slides keep their top-aligned headings. The deck names gallery layouts and the roboto font
// scheme, so it renders with the host catalog registered (./catalog-harness.mjs).
const num = (attrs, name) => Number(new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1]);
const tracedBox = (svg, path) => {
  const attrs = [...svg.matchAll(/<g\b([^>]*)>/g)].map(match => match[1]).find(candidate => candidate.includes(`data-opf-path="${path}"`) && candidate.includes('data-opf-box-y='));
  assert.ok(attrs, `${path}: traced box`);
  return {x: num(attrs, 'data-opf-box-x'), y: num(attrs, 'data-opf-box-y'), width: num(attrs, 'data-opf-box-width'), height: num(attrs, 'data-opf-box-height')};
};
const near = (a, b, message) => assert.ok(Math.abs(a - b) <= 0.006, `${message}: ${a} vs ${b}`);
const headings = items => items.filter(item => ['tag', 'title', 'subtitle'].includes(item.field));

const deck = {design: {fontScheme: 'roboto', header: {left: {text: 'Header'}}, footer: {right: {text: '{{slide.number}}'}}}, slides: [
  {layout: 'title-subtitle', tag: 'Kickoff', title: 'Cover slide title', subtitle: 'A supporting line'},
  {layout: 'title', title: 'A cover title that is long enough to wrap onto a second line when drawn at the cover size'},
  {layout: 'title-subtitle', title: 'Centered cover', subtitle: 'Centered subtitle', design: {titleAlignment: 'center', contentAlignment: 'center'}},
  {layout: 'text-1x', title: 'Content title', text: 'Body text stays below the title.'},
]};
const resolved = resolvePresentation(deck);
let checked = 0;
for (const bound of resolved.slides) {
  const svg = toSvg(deck, bound.index + 1, {trace: true});
  const items = headings(bound.geometry.items);
  assert.ok(items.length, `slide ${bound.index}: headings`);
  for (const item of items) {
    const box = tracedBox(svg, item.path);
    near(box.x, item.box.x, `${item.path} x`);
    near(box.y, item.box.y, `${item.path} y`);
    near(box.width, item.box.width, `${item.path} width`);
    near(box.height, item.box.height, `${item.path} height`);
    checked++;
  }
  const first = items[0].box, last = items.at(-1).box;
  const furniture = bound.geometry.furniture;
  const gap = bound.geometry.height / 30, padding = 0.08 * Math.min(bound.geometry.width, bound.geometry.height);
  const top = Math.max(padding, furniture.headerBottom + gap * 0.5), bottom = Math.min(bound.geometry.height - padding, furniture.footerTop - gap * 0.5);
  if (bound.index < 3) {
    // Cover: the whole group is centered between header and footer furniture, and the tag/title/subtitle share x and width.
    near((first.y + last.y + last.height) / 2, (top + bottom) / 2, `slide ${bound.index}: group center`);
    for (const item of items) { near(item.box.x, items[0].box.x, `${item.path} shared x`); near(item.box.width, items[0].box.width, `${item.path} shared width`); }
  } else {
    // Content: the title keeps the top origin and the body follows it.
    near(first.y, top, 'content title origin');
    const body = bound.geometry.items.find(item => item.field === 'text');
    assert.ok(body.box.y >= last.y + last.height - 1e-6, 'body follows the title');
  }
  // Drawn heading text lies inside its composed box, so no line escapes the recentered group.
  for (const item of items) {
    const box = tracedBox(svg, item.path);
    const texts = [...svg.matchAll(/<text\b([^>]*)>/g)].map(match => match[1]).filter(attrs => attrs.includes(`data-opf-path="${item.path}"`));
    assert.ok(texts.length, `${item.path}: drawn text`);
    for (const attrs of texts) {
      const y = num(attrs, 'y');
      assert.ok(y > box.y && y < box.y + box.height + 1, `${item.path}: text baseline ${y} inside ${box.y}..${box.y + box.height}`);
      checked++;
    }
  }
}
assert.ok(resolved.slides[1].geometry.items.find(item => item.field === 'title').text.lines.length > 1, 'the wrapped cover wraps');
assert.equal(checked, 16);
console.log(`Cover centering passed ${checked} preview-to-composition checks.`);
