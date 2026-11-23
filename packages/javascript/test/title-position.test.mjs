// OPF 0.35 design.titlePosition: `top` (the default) or `start`, the heading group beside the body in a column of two fifths of the
// content width on the reading side (titleBesideTemplate on a template, the automatic composition's own column otherwise).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { TITLE_BESIDE_SHARE, composeLayoutAreas, composeSlide, layoutTemplate, renamedLayout, renamedLayoutTitlePosition, titleBesideTemplate } from '../dist/composition.js';
import { applyPatch, validate } from '../dist/index.js';

const HEADINGS = new Set(['title', 'subtitle', 'tag']);
const title = (result) => result.items.find((item) => item.field === 'title');
const body = (result) => result.items.filter((item) => !HEADINGS.has(item.field));
const list = { items: ['Define the problem and who it affects', 'Review the pilot evidence from both teams', 'Agree the next decision and its owner'] };
const slide = (extra = {}) => ({ title: 'Three parts, one decision', blocks: [list], ...extra });
const near = (a, b, tolerance = 0.51) => Math.abs(a - b) <= tolerance;
// The title column of a 1280 x 720 slide at the default padding and gap: two fifths of the content width less one gap.
const padding = 0.08 * 720, gap = 720 / 30, content = 1280 - 2 * padding, column = (content - gap) * TITLE_BESIDE_SHARE[0] / (TITLE_BESIDE_SHARE[0] + TITLE_BESIDE_SHARE[1]);
// 0.34's cycle record: a row with the title at size 2 beside the body at size 3.
const rowCycle = { ...gallery.layouts.cycle, direction: 'row', design: undefined, regions: [{ name: 'title', size: 2 }, { ...gallery.layouts.cycle.regions[1], size: 3 }] };

test('the gallery cycle, matrix and vertical-process are column records that set titlePosition start', () => {
  for (const id of ['cycle', 'matrix', 'vertical-process']) {
    const record = gallery.layouts[id];
    assert.equal(record.direction, 'column', id);
    assert.deepEqual(record.design, { titlePosition: 'start' }, id);
    assert.ok(record.regions.every((region) => region.size === undefined), `${id}: no sizes`);
  }
  assert.equal(gallery.layouts['agenda-split'], undefined, 'agenda-split is removed');
  assert.equal(Object.keys(gallery.layouts).length, 38);
});

test('titleBesideTemplate: the title row gives way to a title column of two fifths; the 0.34 row record compiles the same', () => {
  const beside = titleBesideTemplate(layoutTemplate(gallery.layouts.cycle));
  const row = layoutTemplate(rowCycle);
  for (const key of ['rows', 'columns', 'grid', 'areas', 'regions', 'title', 'subtitle']) assert.deepEqual(beside[key], row[key], key);
  // A record whose title already shares a row with a body region keeps its own placement.
  assert.equal(titleBesideTemplate(row), undefined);
  // A record of two columns under its title: the title column spans the row, both columns keep their shares.
  const two = titleBesideTemplate(layoutTemplate(gallery.layouts['two-column']));
  assert.deepEqual(two.grid, [['title', 'first', 'second']]);
  assert.deepEqual(two.columns, [4, 3, 3]);
  // A subtitle region joins the title's group; a record without a title region gets the column.
  const subtitled = titleBesideTemplate(layoutTemplate({ direction: 'column', regions: [{ name: 'title' }, { name: 'subtitle' }, { name: 'body' }] }));
  assert.equal(subtitled.subtitle, false);
  assert.deepEqual(subtitled.grid, [['title', 'body']]);
  const untitled = titleBesideTemplate(layoutTemplate({ direction: 'column', regions: [{ name: 'body' }] }));
  assert.equal(untitled.title, true);
  assert.deepEqual(untitled.areas.map((area) => area.name), ['title', 'body']);
});

test('the empty layout of a record with start: the title column, and a subtitle region inside it', () => {
  const { areas } = composeLayoutAreas({ direction: 'column', design: { titlePosition: 'start' }, regions: [{ name: 'title' }, { name: 'subtitle' }, { name: 'body' }] });
  const [title, subtitle, body] = ['title', 'subtitle', 'body'].map((name) => areas.find((area) => area.name === name).box);
  assert.ok(near(title.x, padding) && near(title.width, column), JSON.stringify(title));
  assert.ok(subtitle.width > 0 && subtitle.x >= title.x - 0.5 && subtitle.x + subtitle.width <= title.x + title.width + 0.5 && subtitle.y >= title.y, JSON.stringify(subtitle));
  assert.ok(near(body.x, padding + column + gap), JSON.stringify(body));
});

test('a record with titlePosition start draws as the 0.34 row record did', () => {
  for (const blocks of [[{ items: ['Plan', 'Build', 'Measure', 'Learn'] }], [{ items: ['Plan', 'Build', 'Measure', 'Learn', 'Review', 'Adjust'] }]]) {
    const input = { title: 'A review loop', blocks };
    assert.deepEqual(composeSlide(input, { layout: gallery.layouts.cycle }).items.map((item) => item.box), composeSlide(input, { layout: rowCycle }).items.map((item) => item.box));
  }
});

test('start on a template: the title column at the reading side, the body beside it', () => {
  const top = composeSlide(slide(), { layout: gallery.layouts.list });
  const start = composeSlide(slide({ design: { titlePosition: 'start' } }), { layout: gallery.layouts.list });
  assert.equal(start.design.titlePosition, 'start');
  assert.equal(start.design.sources?.titlePosition ?? 'slide', 'slide');
  const area = start.headingAreas.find((entry) => entry.name === 'title').box, region = start.regions.find((entry) => entry.name === 'body').box;
  assert.ok(near(area.x, padding) && near(area.width, column), JSON.stringify(area));
  assert.ok(near(region.x, padding + column + gap), JSON.stringify(region));
  assert.ok(near(area.y, region.y) && near(area.height, region.height), 'the column runs down beside the body');
  assert.ok(title(start).box.x + title(start).box.width <= region.x, 'the title stays in its column');
  // The list keeps its size: nothing shrinks.
  assert.ok(body(start).every((item, index) => item.text.fontSize >= body(top)[index].text.fontSize - 1e-6));
  // A right-to-left deck draws the column at the right; design.mirror swaps the side; both together put it back at the left.
  const right = composeSlide(slide({ design: { titlePosition: 'start' } }), { layout: gallery.layouts.list, direction: 'rtl' });
  assert.ok(right.headingAreas[0].box.x > right.regions[0].box.x);
  const mirrored = composeSlide(slide({ design: { titlePosition: 'start', mirror: true } }), { layout: gallery.layouts.list });
  assert.ok(mirrored.headingAreas[0].box.x > mirrored.regions[0].box.x);
  const back = composeSlide(slide({ design: { titlePosition: 'start', mirror: true } }), { layout: gallery.layouts.list, direction: 'rtl' });
  assert.ok(back.headingAreas[0].box.x < back.regions[0].box.x);
});

test('precedence: slide, deck, theme, layout record, then top', () => {
  const record = gallery.layouts.cycle, input = { title: 'A review loop', blocks: [{ items: ['Plan', 'Build', 'Measure', 'Learn'] }] };
  const besideOf = (result) => result.headingAreas.find((entry) => entry.name === 'title').box.width < 1000;
  assert.equal(besideOf(composeSlide(input, { layout: record })), true, 'the record');
  assert.equal(besideOf(composeSlide({ ...input, design: { titlePosition: 'top' } }, { layout: record })), false, 'the slide over the record');
  assert.equal(besideOf(composeSlide(input, { layout: record, presentation: { design: { titlePosition: 'top' } } })), false, 'the deck over the record');
  assert.equal(besideOf(composeSlide(input, { layout: record, themeDesign: { titlePosition: 'top' } })), false, 'the theme over the record');
  assert.equal(besideOf(composeSlide(input, { layout: gallery.layouts.list, themeDesign: { titlePosition: 'start' } })), true, 'the theme over a top record');
});

test('start on an automatic slide: the headings in the start column, the body beside them from the top', () => {
  const top = composeSlide(slide()), start = composeSlide(slide({ design: { titlePosition: 'start' } }));
  const heading = title(start);
  assert.ok(near(heading.box.x, padding) && heading.box.width <= column + 0.5, JSON.stringify(heading.box));
  assert.ok(near(start.contentBox.x, padding + column + gap), JSON.stringify(start.contentBox));
  assert.ok(start.contentBox.y < heading.box.y, 'the body starts above the centered title');
  assert.ok(body(start).every((item) => item.box.x >= heading.box.x + heading.box.width));
  assert.ok(body(start).every((item, index) => item.text.fontSize >= body(top)[index].text.fontSize - 1e-6), 'no text smaller');
  // Right to left, and mirrored.
  const rtl = composeSlide(slide({ design: { titlePosition: 'start' } }), { direction: 'rtl' });
  assert.ok(title(rtl).box.x > rtl.contentBox.x);
  const mirrored = composeSlide(slide({ design: { titlePosition: 'start', mirror: true } }));
  assert.ok(title(mirrored).box.x > mirrored.contentBox.x);
  // A subtitle stays with the title in the column.
  const subtitled = composeSlide(slide({ subtitle: 'What we cover', design: { titlePosition: 'start' } }));
  const sub = subtitled.items.find((item) => item.field === 'subtitle');
  assert.ok(near(sub.box.x, padding) && sub.box.y > title(subtitled).box.y);
});

test('a cover, promoted regions and a portrait canvas keep the title on top', () => {
  const cover = { title: 'Quarterly review', subtitle: 'Design options' };
  assert.deepEqual(composeSlide({ ...cover, design: { titlePosition: 'start' } }).items, composeSlide(cover).items);
  const promoted = { title: 'What the pilot asks of us', blocks: [{ region: 'start', text: 'The pilot shows a clear gain.' }, { region: 'end', items: ['Two teams', 'Six weeks'] }] };
  assert.deepEqual(composeSlide({ ...promoted, design: { titlePosition: 'start' } }).items.map((item) => item.box), composeSlide(promoted).items.map((item) => item.box));
  const portrait = { width: 720, height: 1280 };
  assert.deepEqual(composeSlide(slide({ design: { titlePosition: 'start' } }), { ...portrait, layout: gallery.layouts.list }).items.map((item) => item.box), composeSlide(slide(), { ...portrait, layout: gallery.layouts.list }).items.map((item) => item.box));
  assert.deepEqual(composeSlide(slide({ design: { titlePosition: 'start' } }), portrait).items.map((item) => item.box), composeSlide(slide(), portrait).items.map((item) => item.box));
});

test('agenda-split resolves nowhere; the safe fix writes agenda and the title position', () => {
  assert.equal(renamedLayout('layouts', 'agenda-split'), 'agenda');
  assert.equal(renamedLayout('layouts', 'default:agenda-split'), 'default:agenda');
  assert.equal(renamedLayoutTitlePosition('layouts', 'agenda-split'), 'start');
  assert.equal(renamedLayoutTitlePosition('layouts', 'flow'), undefined);
  const deck = { slides: [{ layout: 'agenda-split', title: 'Three parts', blocks: [list] }, { layout: 'agenda-split', design: { contentBox: true }, title: 'Three parts', blocks: [list] }, { layout: 'agenda-split', design: { titlePosition: 'top' }, title: 'Three parts', blocks: [list] }] };
  const report = validate(deck, { catalogs: [gallery] });
  const findings = report.findings.filter((finding) => finding.ruleId === 'opf/unresolved-reference');
  assert.equal(findings.length, 3);
  assert.match(findings[0].message, /removed layout 'agenda-split' \(use 'agenda' with design\.titlePosition 'start'\)/);
  assert.deepEqual(findings.map((finding) => finding.fixes[0].patch), [
    [{ op: 'replace', path: '/slides/0/layout', value: 'agenda' }, { op: 'add', path: '/slides/0/design', value: { titlePosition: 'start' } }],
    [{ op: 'replace', path: '/slides/1/layout', value: 'agenda' }, { op: 'add', path: '/slides/1/design/titlePosition', value: 'start' }],
    [{ op: 'replace', path: '/slides/2/layout', value: 'agenda' }],
  ]);
  assert.ok(findings.every((finding) => finding.fixes[0].safe && finding.fixes[0].id === 'rename-layout'));
  const fixed = findings.reduce((document, finding) => applyPatch(document, finding.fixes[0].patch), deck);
  assert.equal(validate(fixed, { catalogs: [gallery] }).findings.filter((finding) => finding.ruleId === 'opf/unresolved-reference').length, 0);
  assert.deepEqual(fixed.slides.map((entry) => entry.design), [{ titlePosition: 'start' }, { contentBox: true, titlePosition: 'start' }, { titlePosition: 'top' }]);
});
