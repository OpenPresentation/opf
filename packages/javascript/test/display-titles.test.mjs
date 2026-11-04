// LH-130: the gallery cover and section set their display title low at the start edge, with the tag as its eyebrow or, without a tag,
// a short accent rule above it (a heading region's own `anchor` and the title region's `rule`). LH-148: a heading LH-129 grows keeps the
// line breaks WI-4 balanced at its role size, so it stays at the largest step that keeps them.
import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layoutTemplateIssues, composeSlide, measureText, TITLE_RULE_SIZE } from '../dist/composition.js';

const { layouts } = gallery;
const field = (result, name) => result.items.find((item) => item.field === name);
const bottomOf = (box) => box.y + box.height;
const lines = (item) => item.text.lines.map((line) => line.trim());

test('a section sets its group at the foot of the slide, start-aligned, with its tag as the eyebrow and no rule', () => {
  for (const direction of ['ltr', 'rtl']) {
    const result = composeSlide({ tag: 'Part 1', title: 'Where we stand', subtitle: 'Results from the first nine months of 2026' }, { layout: layouts.section, direction });
    assert.equal(field(result, 'title').alignment, 'left', 'the title is start-aligned (left is the start edge, mirrored in a right-to-left deck)');
    assert.ok(Math.abs(bottomOf(field(result, 'subtitle').box) - bottomOf(result.contentBox)) < 2, `${direction}: the group ends at the foot`);
    assert.equal(result.titleRule, undefined, 'a tag takes the rule\'s place');
  }
});

test('a cover with no tag draws the rule half a gap above its title, at the start edge of its first line', () => {
  const slide = { title: 'Third-quarter customer review', subtitle: 'Renata Alvarez, November 4, 2026' };
  const ltr = composeSlide(slide, { layout: layouts.cover }), rtl = composeSlide(slide, { layout: layouts.cover, direction: 'rtl' });
  for (const result of [ltr, rtl]) {
    const title = field(result, 'title'), rule = result.titleRule;
    assert.ok(rule, 'the rule is composed');
    assert.equal(rule.path, 'slides.0.title');
    assert.deepEqual([rule.box.width, rule.box.height], [TITLE_RULE_SIZE.width, TITLE_RULE_SIZE.height]);
    assert.ok(rule.box.y + rule.box.height < title.box.y && title.box.y - (rule.box.y + rule.box.height) < 24, 'the rule sits just above the title');
    assert.ok(Math.abs(bottomOf(field(result, 'subtitle').box) - bottomOf(result.contentBox)) < 2, 'the group ends at the foot');
  }
  assert.ok(Math.abs(ltr.titleRule.box.x - field(ltr, 'title').box.x) < 1, 'left to right: at the left edge of the title');
  // The rule follows the title's first line: a Latin title in a right-to-left deck is a left-to-right paragraph and starts at the left.
  assert.ok(Math.abs(rtl.titleRule.box.x - field(rtl, 'title').box.x) < 1, 'a Latin title in a right-to-left deck: at the left edge');
  // An Arabic title in a right-to-left deck starts at the right edge.
  const arabic = composeSlide({ title: 'مراجعة العملاء للربع الثالث' }, { layout: layouts.cover, direction: 'rtl' });
  assert.ok(Math.abs(arabic.titleRule.box.x + arabic.titleRule.box.width - (field(arabic, 'title').box.x + field(arabic, 'title').box.width)) < 1);
});

test('the rule never costs a body its room: a section with blocks below its grid draws none, and its blocks keep their size', () => {
  const blocks = Array.from({ length: 4 }, (_, index) => ({ text: `Note ${index + 1}: a longer paragraph that explains what this part of the deck covers and why it matters to the decision.` }));
  const slide = { title: 'Where we stand', blocks };
  const result = composeSlide(slide, { layout: layouts.section });
  const plain = composeSlide(slide, { layout: { ...layouts.section, regions: [{ name: 'title', size: 1 }] } });
  assert.equal(result.titleRule, undefined);
  for (const item of result.items.filter((entry) => entry.field === 'text')) assert.equal(item.text.fontSize, plain.items.find((entry) => entry.path === item.path).text.fontSize, item.path);
});

test('a heading region takes an anchor and the title a rule; anything else is still a body rule', () => {
  assert.deepEqual(layoutTemplateIssues({ regions: [{ name: 'title', anchor: 'bottom', rule: true }] }), []);
  const issues = layoutTemplateIssues({ regions: [{ name: 'title', anchor: 'low', rule: 'yes' }, { name: 'subtitle', rule: true, accepts: ['text'] }] });
  assert.deepEqual(issues.map((issue) => issue.path).sort(), ['/regions/0/anchor', '/regions/0/rule', '/regions/1/accepts', '/regions/1/rule']);
});

test('LH-148: a grown title keeps the lines WI-4 balanced at its role size, at the largest step that keeps them', () => {
  // Bold text a little wider than the estimate, as a real display face draws it: at 56 px "A clearer decision." no longer fits half
  // the slide beside the picture, so growing to 56 px would break "A smaller pilot. A / clearer decision.".
  const textMeasurement = { measure: (text, size, style) => measureText(text, size) * (style.fontWeight >= 700 ? 1.05 : 1) };
  const slide = { title: 'A smaller pilot. A clearer decision.', subtitle: 'Illustrative example', blocks: [{ image: { src: 'data:image/png;base64,iVBORw0KGgo=', alt: 'Two green ridges' } }] };
  const grown = composeSlide(slide, { layout: layouts.cover, textMeasurement }), kept = composeSlide(slide, { layout: layouts.cover, textMeasurement, fill: false });
  assert.deepEqual(lines(field(kept, 'title')), ['A smaller pilot.', 'A clearer decision.']);
  assert.deepEqual(lines(field(grown, 'title')), lines(field(kept, 'title')), 'the grown title keeps its balanced break');
  assert.ok(field(grown, 'title').text.fontSize >= field(kept, 'title').text.fontSize);
});

test('a display title that would wrap at a larger step grows onto two balanced lines, never smaller than on one line', () => {
  const slide = { tag: 'Part 4', title: 'Where the money goes. Why it pays back.', subtitle: 'Budget, payback and the two scenarios we model' };
  const grown = composeSlide(slide, { layout: layouts.section }), kept = composeSlide(slide, { layout: layouts.section, fill: false });
  const title = field(grown, 'title');
  assert.equal(lines(field(kept, 'title')).length, 1);
  assert.ok(title.text.fontSize > field(kept, 'title').text.fontSize);
  assert.deepEqual(lines(title), ['Where the money goes.', 'Why it pays back.'], 'two lines, broken at the sentence');
  assert.ok(field(grown, 'subtitle').text.fontSize >= field(kept, 'subtitle').text.fontSize);
  // A title on the slide beside a body keeps its lines: the growth is only for headings that are the slide's whole message.
  const withBody = composeSlide({ ...slide, blocks: [{ text: 'A note below the grid.' }] }, { layout: layouts.section });
  assert.equal(lines(field(withBody, 'title')).length, lines(field(composeSlide({ ...slide, blocks: [{ text: 'A note below the grid.' }] }, { layout: layouts.section, fill: false }), 'title')).length);
});
