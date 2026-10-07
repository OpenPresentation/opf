// FA-10: rich headline text in the preview. `title`, `subtitle`, `tag` and `quote.text` accept TextRun[]; the SVG draws core's
// rich lines (run colors, bold, links, citation markers) and a string heading draws exactly as before.
import assert from 'node:assert/strict';
import { svgToPdf, renderSlideSvg } from '../dist/index.js';

const deck = {
  references: [{ id: 'r1', text: 'Annual report' }],
  slides: [
    {
      tag: ['Q3 ', { text: 'review', italic: true }],
      title: ['Revenue grew ', { text: '28%', color: '#C00000' }, { text: ' year on year', cite: 'r1' }],
      subtitle: [{ text: 'Read the ', bold: true }, { text: 'report', link: 'https://example.com/report' }],
      text: 'Body',
    },
    { title: 'Voices', quote: { text: ['Cut review time by ', { text: '40%', bold: true, color: '#1D4ED8' }, { text: ' in a quarter', cite: 'r1' }], attribution: 'Ada, VP Operations' } },
    { title: 'Plain title', subtitle: 'Plain subtitle', text: 'Plain', quote: undefined },
  ],
};
delete deck.slides[2].quote;

const opts = { trace: true };
const first = renderSlideSvg(deck, 0, { ...opts });
const second = renderSlideSvg(deck, 1, { ...opts });
const third = renderSlideSvg(deck, 2, { ...opts });

// Title: one colored run, the other runs in the heading fill, bold weight from the heading default.
assert.match(first, /data-opf-rich-text="true"/);
assert.match(first, /<tspan[^>]*fill="#C00000"[^>]*font-weight="700"[^>]*>28%<\/tspan>/, 'the accent word draws in its own color at the heading weight');
assert.match(first, /<tspan[^>]*>Revenue grew <\/tspan>/);
assert.match(first, /aria-label="Revenue grew 28% year on year"/, 'the accessible name is the title plain text');
// Markers: the title claim and (on slide 2) the quote text each draw a superscript marker, numbered in reading order.
const markers = svg => [...svg.matchAll(/data-opf-marker="([^"]+)"/g)].map(match => match[1]);
assert.deepEqual(markers(first), ['1']);
assert.deepEqual(markers(second), ['1']);
// The subtitle link and the tag italic.
assert.match(first, /<a href="https:\/\/example.com\/report"/);
assert.match(first, /font-style="italic"[^>]*>review<\/tspan>/);
// The footnote area lists the reference on both slides.
assert.match(first, /Annual report/);
assert.match(second, /Annual report/);
// Quote: the body keeps the straight quotation marks around the runs, the colored run keeps its color, the footer is plain text.
assert.match(second, /data-opf-rich-text="true"/);
assert.match(second, /<tspan[^>]*>(&quot;|")Cut review time by <\/tspan>/);
assert.match(second, /<tspan[^>]*fill="#1D4ED8"[^>]*>40%<\/tspan>/);
assert.match(second, /Ada, VP Operations/);
// A string heading draws as plain text, without rich-text lines.
assert.doesNotMatch(third, /data-opf-rich-text/);
// The PDF export draws the same SVG.
const pdf = await svgToPdf(first);
assert.ok(pdf.length > 500);
console.log('Rich headings passed.');
