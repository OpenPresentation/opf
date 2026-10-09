import assert from 'node:assert/strict';
import {paginate} from '@openpresentation/opf/pagination';
import {resolvePresentation, toSvg} from './catalog-harness.mjs';
import {slideInfo} from '../src/deck-runtime.js';

// FA-31: {{slide.number}}, {{slide.section}} and {{deck.slideCount}} are drawn from the substituted slide, in body text,
// titles and footer text alike, with the values of the rendered deck (after pagination). Core resolves them.
const long = 'Pagination keeps this paragraph whole where it can and splits it where it cannot. '.repeat(60);
const make = body => ({
  name: 'Slide variables',
  design: {fontScheme: 'roboto', footer: {left: {text: '{{slide.section}}'}, right: {text: 'Page {{slide.number}} of {{deck.slideCount}}'}}},
  slides: [
    {section: 'Intro', title: 'Overview', text: 'This is slide {{slide.number}} of {{deck.slideCount}} in {{slide.section}}.', notes: 'Notes for slide {{slide.number}}'},
    {section: 'Details', title: 'Details {{slide.number}}/{{deck.slideCount}}', blocks: [{text: body}]},
    {title: 'Last', text: 'Closing on {{slide.number}}'},
  ],
});
const deck = make('Short body.');
const before = structuredClone(deck);

// Unpaginated: the body token and the footer token draw the same number on every slide.
const svgs = toSvg(deck, {trace: true});
assert.deepEqual(deck, before, 'the input document is not changed');
assert.ok(svgs[0].includes('This is slide 1 of 3 in Intro.'), 'body text carries the number, the count and the section');
assert.ok(svgs[0].includes('Page 1 of 3'), 'the footer carries the same number and count');
assert.ok(svgs[2].includes('Closing on 3') && svgs[2].includes('Page 3 of 3'));
assert.ok(!svgs.join('').includes('{{slide.') && !svgs.join('').includes('{{deck.'), 'no token is drawn as written');

// Furniture geometry: one slideNumber field per substituted token, fixed text for the count and the section.
const parts = resolvePresentation(deck).slides[0].geometry.furniture.parts;
assert.deepEqual(parts.map(part => [part.zone, part.field, part.text]), [['left', 'text', 'Intro'], ['right', 'text', 'Page 1 of 3']]);
assert.deepEqual(parts[1].fields, [{type: 'slideNumber', start: 5, end: 6}]);

// An escaped token is the literal text.
const escaped = toSvg({slides: [{title: 'Escape', text: String.raw`Write \{{slide.number}} to show the slide number`}]}, 1);
assert.ok(escaped.includes('Write {{slide.number}} to show the slide number'));

// A slide without a section draws empty text for {{slide.section}}.
assert.ok(toSvg({slides: [{title: 'No section {{slide.section}}!'}]}, 1).includes('No section !'));

// Pagination: the slides core splits show consecutive numbers, and the count is the paginated count.
const pages = paginate(make(long));
const paginated = pages.presentation;
assert.ok(paginated.slides.length > 3, `the long slide paginates (${paginated.slides.length} slides)`);
assert.ok(JSON.stringify(paginated).includes('{{deck.slideCount}}'), 'paginate returns the source tokens, not values');
const count = paginated.slides.length;
const rendered = toSvg(paginated);
assert.equal(rendered.length, count);
const titles = [];
rendered.forEach((svg, index) => {
  assert.ok(svg.includes(`Page ${index + 1} of ${count}`), `slide ${index + 1} footer`);
  if (index === 0) assert.ok(svg.includes(`This is slide 1 of ${count} in Intro.`));
});
const detailPages = paginated.slides.map((slide, index) => ({slide, index})).filter(({slide}) => slide.section === 'Details');
assert.ok(detailPages.length > 1, 'the section repeats on every page of the split slide');
for (const {index} of detailPages) {
  assert.ok(rendered[index].includes(`Details ${index + 1}/${count}`), `the title of page ${index + 1} holds its own number and the paginated count`);
  titles.push(index + 1);
}
assert.deepEqual(titles, titles.map((_, i) => titles[0] + i), 'consecutive numbers across the split slide');
assert.ok(rendered[count - 1].includes(`Closing on ${count}`) && rendered[count - 1].includes(`Page ${count} of ${count}`));

// The slide facts a counter, label or speaker view shows hold the same values.
assert.equal(slideInfo(deck, 0).notes, 'Notes for slide 1');
assert.equal(slideInfo(paginated, 1).title.startsWith('Details 2/'), true);
assert.equal(slideInfo(deck, 1).section, 'Details');

console.log(`Slide variables passed: body, title, notes and footer agree on ${count} slides (3 authored, ${count - 3} added by pagination).`);
