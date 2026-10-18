import assert from 'node:assert/strict';
import {test} from 'node:test';
import {layoutFurniture} from '../dist/composition.js';
import {validate} from '../dist/validator.js';

// RR-91: footer and header zones sit on the content inset, and a zone takes the width of empty neighbours.
const INSET = 0.08 * 720, GUTTER = 1280 * 0.02, COLUMN = (1280 - 2 * INSET - 2 * GUTTER) / 3, CONTENT_RIGHT = 1280 - INSET;
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: ${actual} vs ${expected}`);
const source = 'Source: Company filings, FY2026 Q3 earnings release, analyst consensus (Bloomberg, 2026-10-01) and internal finance dashboard exports; see appendix B for definitions.';
const parts = (footer, options = {}) => layoutFurniture({}, {presentation: {design: {footer}}, ...options}).parts;
const box = (footer, zone, options) => parts(footer, options).find(part => part.zone === zone).box;

test('a lone zone starts on the content inset and spans the content width', () => {
  for (const zone of ['left', 'center', 'right']) {
    const {x, width} = box({[zone]: {text: source}}, zone);
    near(x, INSET, `${zone} x`);
    near(width, 1280 - 2 * INSET, `${zone} width`);
  }
  // The long source that wrapped to four lines in a 26% zone now needs two.
  assert.equal(parts({left: {text: source}})[0].fit.lines.length, 2);
  // Portrait and a custom padding move the inset with the composition.
  near(box({left: {text: 'x'}}, 'left', {width: 720, height: 1280}).x, 0.08 * 720, 'portrait');
  near(box({left: {text: 'x'}}, 'left', {width: 720, height: 1280}).width, 720 - 2 * 0.08 * 720, 'portrait width');
  const padded = layoutFurniture({composition: {padding: 0.05}}, {presentation: {design: {footer: {left: {text: 'x'}}}}}).parts[0].box;
  near(padded.x, 0.05 * 720, 'padding x');
  near(padded.width, 1280 - 2 * 0.05 * 720, 'padding width');
});

test('zones with occupied neighbours are columns; empty zones lend their width', () => {
  const all = {left: {text: 'L'}, center: {text: 'C'}, right: {text: 'R'}};
  near(box(all, 'left').x, INSET, 'left column x');
  near(box(all, 'left').width, COLUMN, 'left column');
  near(box(all, 'center').x, INSET + COLUMN + GUTTER, 'center column x');
  near(box(all, 'center').width, COLUMN, 'center column');
  near(box(all, 'right').x + box(all, 'right').width, CONTENT_RIGHT, 'right column ends on the inset');
  // Left and right share the free centre; one gutter remains between them.
  const [left, right] = [box({left: {text: 'L'}, right: {text: 'R'}}, 'left'), box({left: {text: 'L'}, right: {text: 'R'}}, 'right')];
  near(left.x, INSET, 'left x');
  near(right.x + right.width, CONTENT_RIGHT, 'right edge');
  near(right.x - (left.x + left.width), GUTTER, 'one gutter between the zones');
  assert.ok(left.width > COLUMN && right.width > COLUMN);
  // Left and centre: the centre keeps its own column and stays centred on the slide.
  const lc = {left: {text: 'L'}, center: {text: 'C'}};
  near(box(lc, 'center').x + box(lc, 'center').width / 2, 640, 'a centre zone stays centred on the slide');
  assert.ok(box(lc, 'left').x + box(lc, 'left').width <= box(lc, 'center').x - GUTTER + 1e-6, 'no overlap');
  // A zone with no content (empty text, false flags) is empty.
  near(box({left: {text: source}, center: {text: ''}, right: {socials: false}}, 'left').width, 1280 - 2 * INSET, 'empty zones are lent');
});

test('right-to-left mirrors the zones and their lent width', () => {
  const rtl = {direction: 'rtl'};
  const lone = parts({left: {text: source}}, rtl)[0];
  assert.equal(lone.alignment, 'right');
  near(lone.box.x, INSET, 'a lone zone spans the content width');
  near(lone.box.x + lone.box.width, CONTENT_RIGHT, 'and ends on the right inset');
  const both = parts({left: {text: 'L'}, right: {text: 'R'}}, rtl);
  const authoredLeft = both.find(part => part.zone === 'left'), authoredRight = both.find(part => part.zone === 'right');
  assert.equal(authoredLeft.alignment, 'right');
  near(authoredLeft.box.x + authoredLeft.box.width, CONTENT_RIGHT, 'authored left is drawn at the right');
  near(authoredRight.box.x, INSET, 'authored right is drawn at the left');
});

const deck = footer => ({$schema: 'https://openpresentation.org/schema/opf/v1', language: 'en-US', design: {footer}, slides: [{title: 'Results', text: 'Revenue grew.'}]});
const wrapFindings = document => validate(document).findings.filter(finding => finding.ruleId === 'opf/furniture-wraps');

test('opf/furniture-wraps warns when a header or footer zone wraps past two lines', () => {
  // Three lines in a column, two across the content width.
  const crowded = wrapFindings(deck({left: {text: source}, center: {text: 'Centre'}, right: {text: '{{slide.number}}'}}));
  assert.equal(crowded.length, 1);
  assert.equal(crowded[0].severity, 'warning');
  assert.equal(crowded[0].path, '/design/footer/left/text');
  assert.match(crowded[0].help, /caption/);
  assert.match(crowded[0].help, /speaker notes/);
  assert.equal(wrapFindings(deck({left: {text: source}})).length, 0, 'two lines across the whole width is fine');
  assert.equal(wrapFindings(deck({left: {text: `${source} ${source}`}})).length, 1);
  assert.equal(wrapFindings(deck({left: {text: 'Short'}})).length, 0);
  // A header is covered too, and a deck-level zone is reported once for all slides.
  const header = {...deck({}), design: {header: {left: {text: `${source} ${source}`}}}, slides: [{title: 'A'}, {title: 'B'}]};
  assert.equal(wrapFindings(header).length, 1);
  assert.equal(wrapFindings(header)[0].path, '/design/header/left/text');
});
