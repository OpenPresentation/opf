// LH-155: the gallery closing takes LH-130's cover treatment (a display title at the start edge, low, under the accent rule, with the
// contact lines below it), keeps its body at least as large as the centered closing had, and over a busy picture goes where the picture
// reads (LH-158's scores). LH-138 (caption half): a picture's caption "Name: detail" draws its name in bold.
import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

const { layouts } = gallery;
const titleOf = (result) => result.items.find((item) => item.field === 'title');
const bodyOf = (result) => result.items.filter((item) => item.field !== 'title' && item.text);
const contacts = { items: ['Renata Alvarez, VP Customer Success', 'renata.alvarez@northwind.example', '+1 415 555 0142'] };
const pilot = { text: 'Write to hello@northwind.example or book a 20-minute walkthrough at northwind.example/pilot.' };
const closing = (title, details, extra = {}) => ({ title, blocks: [{ region: 'details', ...details }], ...extra });
const PHOTO = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#101820"/></svg>').toString('base64');
const grid = (lower) => {
  const columns = 32, rows = 18, values = new Float32Array(columns * rows), high = new Float32Array(columns * rows);
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const busy = lower === 'busy' && row >= rows / 2, value = busy && (row + column) % 2 ? 0.6 : 0.004;
    values[row * columns + column] = value; high[row * columns + column] = busy ? 0.6 : 0.006;
  }
  return { columns, rows, values, high };
};

for (const direction of ['ltr', 'rtl']) {
  test(`LH-155 (${direction}): the closing sets a display title low at the start edge under the accent rule, the contact lines below it`, () => {
    for (const details of [pilot, contacts]) {
      const result = composeSlide(closing(direction === 'rtl' ? 'شكرا لكم' : 'Thank you', details), { layout: layouts.closing, direction, darkBackground: true });
      const title = titleOf(result), body = bodyOf(result);
      assert.equal(title.alignment, 'left', 'the title is start-aligned (left is the start edge in either direction)');
      assert.ok(body.every((item) => item.alignment === title.alignment), 'the contact lines share the start edge');
      assert.ok(title.text.fontSize >= 70, `the title is a display title (${title.text.fontSize})`);
      assert.ok(result.titleRule, 'the accent rule stands above the title');
      assert.ok(result.titleRule.box.y + result.titleRule.box.height <= title.box.y + 1, 'the rule is above the title');
      const edge = direction === 'rtl' ? (box) => box.x + box.width - result.titleRule.box.width : (box) => box.x;
      assert.ok(Math.abs(result.titleRule.box.x - edge(title.box)) < 1, 'the rule starts at the title\'s start edge');
      assert.ok(body.every((item) => item.box.y >= title.box.y + title.box.height - 1), 'the contact lines are under the title');
      const foot = Math.max(...body.map((item) => item.box.y + item.box.height));
      assert.ok(Math.abs(foot - (result.contentBox.y + result.contentBox.height)) < 2, 'the group stands at the foot of the content box');
      assert.ok(body.every((item) => item.text.fontSize >= 32), 'the contact lines keep the role size or more');
    }
  });

  test(`LH-155 (${direction}): the rule never costs the contact lines their size`, () => {
    // Five paragraphs fill the closing: the rule's room would set them smaller, so the slide has no rule.
    const blocks = ['Greenbasket Markets should focus the next cycle on cut shrink across produce and prepared foods without hurting freshness while making the operating tradeoffs clear to retail grocery stakeholders.', 'North Metro Police Academy should focus the next cycle on update scenario training around de-escalation and reporting while making the operating tradeoffs clear to public safety stakeholders.', 'Orbital Ridge Systems should focus the next cycle on prepare fleet support teams for the next launch window while making the operating tradeoffs clear to aerospace stakeholders.', 'Brightpath Analytics should focus the next cycle on launch an integrated campaign around the new benchmark report while making the operating tradeoffs clear to marketing stakeholders.', 'Harborline Bank should focus the next cycle on prioritize digital branch upgrades by customer value and risk while making the operating tradeoffs clear to financial services stakeholders.'].map((text) => ({ region: 'details', text }));
    const full = composeSlide({ title: 'Cold Chain Waste Reduction Review: cold chain waste reduction review', blocks }, { layout: layouts.closing, direction });
    const bare = composeSlide({ title: 'Cold Chain Waste Reduction Review: cold chain waste reduction review', blocks }, { layout: { ...layouts.closing, regions: layouts.closing.regions.map((region) => region.name === 'title' ? { name: 'title' } : region) }, direction });
    assert.equal(full.titleRule, undefined, 'no room for the rule');
    assert.equal(Math.min(...bodyOf(full).map((item) => item.text.fontSize)), Math.min(...bodyOf(bare).map((item) => item.text.fontSize)), 'the body keeps the size it has without the rule');
  });

  test(`LH-155 (${direction}): over a picture the closing stays low only where the measured picture is calm, else goes where it reads (LH-158)`, () => {
    const slide = closing('Start your free pilot this month', pilot, { design: { background: { type: 'image', src: PHOTO, tone: 'dark' } } });
    const compose = (extra) => composeSlide(slide, { layout: layouts.closing, direction, darkBackground: true, ...extra });
    const calm = compose({ pictureLuminance: () => grid('calm') }), busy = compose({ pictureLuminance: () => grid('busy') }), estimated = compose({});
    const plain = composeSlide({ title: slide.title, blocks: slide.blocks }, { layout: layouts.closing, direction });
    assert.ok(titleOf(calm).box.y > titleOf(estimated).box.y + 50, 'low over a calm band, centered without a measurement');
    // Wave 7 integration: the stack is placed by LH-158's scores, so a busy lower half sends it to the calm top, not the middle.
    assert.ok(titleOf(busy).box.y < titleOf(estimated).box.y - 50, 'over a busy lower half the stack goes to the calm top');
    assert.equal(busy.pictureText?.anchor, 'top');
    assert.equal(calm.pictureText?.anchor, 'bottom');
    assert.equal(estimated.pictureText, undefined, 'nothing measured, nothing scored');
    assert.equal(titleOf(calm).box.y, titleOf(plain).box.y, 'a calm picture keeps the plain background\'s low anchor');
    for (const result of [calm, busy, estimated]) assert.ok(result.titleRule, 'the rule stays');
  });
}

// LH-138 (caption half): a picture's caption splits at the first colon into a bold name and its detail, as Claude Design draws n16 and n44.
const SVG = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="#c9ced4"/></svg>').toString('base64');
const runsOf = (caption) => caption.fit.richLines.flatMap((line) => line.fragments.map((fragment) => ({ text: fragment.text, bold: fragment.style.fontWeight >= 600 || fragment.run?.bold === true })));
const captionOf = (caption, layout = 'two-column') => {
  const result = composeSlide({ title: 'Before and after', blocks: [{ region: 'first', image: { src: SVG, alt: 'A table' }, caption }, { region: 'second', image: { src: SVG, alt: 'Another table' } }] }, { layout: layouts[layout] });
  return result.items.find((item) => item.caption)?.caption;
};

test('LH-138: a picture caption with a colon draws its name in bold and its detail in the regular weight', () => {
  const caption = captionOf('Before: loose boxes, tape and paper shared across the table');
  assert.ok(Array.isArray(caption.text), 'the caption is composed as runs');
  assert.deepEqual(caption.text.map((run) => typeof run === 'string' ? run : [run.text, run.bold]), [['Before:', true], ' loose boxes, tape and paper shared across the table']);
  assert.equal(caption.value, 'Before: loose boxes, tape and paper shared across the table', 'the document is unchanged');
  const drawn = runsOf(caption);
  assert.ok(drawn.some((run) => run.bold && run.text.startsWith('Before')), 'the name is bold');
  assert.ok(drawn.some((run) => !run.bold && run.text.includes('loose')), 'the detail is regular');
});

test('LH-138: only a short name before the first colon and a space is a name', () => {
  for (const text of ['Fresno campus', 'Opened at 10:30 on Monday', 'See https://example.org for the plan', 'Note:', ': no name', 'The whole of the following sentence is far too long to be a name: detail']) {
    assert.equal(typeof captionOf(text).text, 'string', `"${text}" stays one run`);
  }
  assert.deepEqual(captionOf('Reno fulfillment center: 210,000 square feet: opened in June').text.map((run) => typeof run === 'string' ? run : run.text), ['Reno fulfillment center:', ' 210,000 square feet: opened in June'], 'the first colon splits');
  const own = [{ text: 'Before: ', italic: true }, 'loose boxes'];
  assert.deepEqual(captionOf(own).text, own, 'runs the author formatted stay as written');
});

test('LH-138: a chart caption is not split', () => {
  const result = composeSlide({ title: 'Revenue', blocks: [{ chart: { type: 'column', categories: ['A', 'B'], series: [{ name: 'S', values: [1, 2] }] }, caption: 'Source: finance team' }] }, { layout: layouts.chart });
  assert.equal(typeof result.items.find((item) => item.caption).caption.text, 'string');
});
