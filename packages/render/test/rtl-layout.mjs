import assert from 'node:assert/strict';
import {resolvePresentation, renderSlideSvg} from '../dist/svg.js';

// RR-05: right-to-left layout in the preview. Authored alignment is logical (`left` is the start edge), so a right-to-left
// paragraph is drawn against the right edge; the composition mirrors (the `left` region is drawn at the right, tables run right
// to left, list markers sit at the right, column charts reverse their categories). A left-to-right deck is drawn as before.
const attribute = (attrs, name) => new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];
const texts = svg => [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map(([, attrs, body]) => ({
  attrs, body: body.replace(/<[^>]*>/g, '').replace(/[⁦-⁩]/g, ''), x: Number(attribute(attrs, 'x')), anchor: attribute(attrs, 'text-anchor'), path: attribute(attrs, 'data-opf-path'),
}));
const arabic = 'العنصر الأول مع رقم 2026';
const slides = [
  {title: 'عنوان العرض', items: [arabic, 'English item', 'العنصر الثاني: PowerPoint 365']},
  {title: 'مناطق', left: {text: 'النص الأيسر'}, right: {items: ['عنصر ١', 'عنصر ٢']}},
  {title: 'جدول', table: {columns: ['المؤشر', 'القيمة', 'الحالة'], rows: [['الإيرادات', '12', 'جيد']]}},
  {title: 'مخطط', chart: {type: 'column', data: {columns: ['شهر', 'قيمة'], rows: [['يناير', 12], ['فبراير', 15], ['مارس', 18]]}}},
  {title: 'نص طويل', text: `${arabic} ${arabic} ${arabic} ${'abc '.repeat(40)}`.trim()},
];
const rtlDeck = {language: 'arabic', slides}, ltrDeck = {language: 'english', slides};
const render = (deck, index) => texts(renderSlideSvg(deck, index, {trace: true}));
const find = (list, text, from = 0) => list.find(item => item.body.includes(text) && list.indexOf(item) >= from);

// Titles and body text start at the right edge.
{
  const rtl = render(rtlDeck, 0), ltr = render(ltrDeck, 0);
  const title = find(rtl, 'عنوان العرض');
  assert.equal(title.anchor, 'end', 'a right-to-left title is anchored at its end');
  assert.ok(title.x > 1000, 'and drawn against the right edge');
  assert.equal(find(ltr, 'عنوان العرض').anchor, 'start');
  assert.ok(find(ltr, 'عنوان العرض').x < 100, 'a left-to-right deck is unchanged');
  // The resolved geometry reports the direction and keeps the authored alignment logical.
  const bound = resolvePresentation(rtlDeck).slides[0];
  assert.equal(bound.geometry.direction, 'rtl');
  assert.equal(bound.geometry.items.find(item => item.field === 'title').alignment, 'left');
  assert.equal(resolvePresentation(ltrDeck).slides[0].geometry.direction, undefined);
}

// List markers: right-to-left entries mark at the right; a Latin entry keeps the left-to-right list shape.
{
  const rtl = render(rtlDeck, 0);
  const markers = rtl.filter(item => item.body === '•');
  assert.equal(markers.length, 3);
  assert.deepEqual(markers.map(marker => marker.anchor), ['end', undefined, 'end']);
  assert.ok(markers[0].x > 1000 && markers[1].x < 100, 'the Arabic markers are at the right, the Latin one at the left');
  const first = find(rtl, 'العنصر الأول'), latin = find(rtl, 'English item');
  assert.equal(first.anchor, 'end');
  assert.ok(first.x < markers[0].x, 'the text sits left of its marker');
  assert.ok(latin.x > markers[1].x, 'a Latin entry keeps its text right of the marker');
  const ltr = render(ltrDeck, 0).filter(item => item.body === '•');
  assert.ok(ltr.every(marker => marker.x < 100 && marker.anchor === undefined), 'a left-to-right deck keeps left markers');
}

// Regions mirror: the authored left region is drawn at the right.
{
  const rtl = render(rtlDeck, 1), ltr = render(ltrDeck, 1);
  assert.ok(find(rtl, 'النص الأيسر').x > find(rtl, 'عنصر ١').x, 'the left region is at the right in a right-to-left deck');
  assert.ok(find(ltr, 'النص الأيسر').x < find(ltr, 'عنصر ١').x);
}

// Tables run right to left: the first column is the rightmost.
{
  const rtl = render(rtlDeck, 2), ltr = render(ltrDeck, 2);
  assert.ok(find(rtl, 'المؤشر').x > find(rtl, 'الحالة').x);
  assert.ok(find(ltr, 'المؤشر').x < find(ltr, 'الحالة').x);
}

// Column charts reverse their categories and put the value axis at the right (c:catAx orientation maxMin in the export).
{
  const rtl = render(rtlDeck, 3), ltr = render(ltrDeck, 3);
  assert.ok(find(rtl, 'يناير').x > find(rtl, 'مارس').x, 'the first category is at the right');
  assert.ok(find(ltr, 'يناير').x < find(ltr, 'مارس').x);
  const axis = text => {
    const value = text.find(item => item.body === '20' || item.body === '15' || item.body === '10');
    return value;
  };
  assert.ok(axis(rtl).x > 700, 'value labels are at the right');
  assert.ok(axis(ltr).x < 200, 'value labels stay at the left in a left-to-right deck');
}

// Every wrapped line of a right-to-left paragraph is anchored at the right edge, including a line of only Latin letters.
{
  const lines = render(rtlDeck, 4).filter(item => item.path === 'slides.4.text');
  assert.ok(lines.length >= 2, 'the paragraph wraps');
  assert.ok(lines.every(line => line.anchor === 'end'), 'all lines start at the right edge');
  assert.ok(/^[a-z ]+$/.test(lines.at(-1).body), 'the last line holds only Latin letters');
  // PowerPoint ignores edge whitespace on a right-aligned right-to-left line (native check 2026-10-02): a wrapped line that keeps its
  // trailing space draws without it, so the glyph edge stays on the box edge.
  assert.ok(lines.every(line => line.body === line.body.trim()), 'no edge whitespace on right-aligned right-to-left lines');
}

console.log('RTL layout passed: logical alignment, bullet side, mirrored regions, table columns, chart categories and per-paragraph line direction.');
