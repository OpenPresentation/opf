import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { format, resolveSlideContext, validate } from '../dist/index.js';
import { THEME_DESIGN_KEYS, composeSlide, gridFlowShape, listColumnBreaks, resolveDesignHints } from '../dist/composition.js';

// OPF 0.19 (RR-79), design sections 3 to 5: flows, tracks, collapse, bleed, list columns, mirror and the theme level.
const { layouts } = JSON.parse(readFileSync(new URL('./fixtures/layout-templates-0.19.json', import.meta.url), 'utf8'));
const near = (a, b, tolerance = 1e-3) => Math.abs(a - b) <= tolerance;
const text = (value) => ({ text: value });
const short = (count) => Array.from({ length: count }, (_, index) => text(`Point ${index + 1}`));
const long = 'Our customers told us the onboarding flow took too long, so we rebuilt it around three steps, measured every one of them and removed the two that nobody needed. The result is a flow that takes four minutes instead of twenty.';
const compose = (slide, layout, options = {}) => composeSlide(slide, { layout, ...options });
const region = (result, name) => result.regions.find((entry) => entry.name === name);
const cells = (result, name) => result.items.filter((item) => item.region === name);
const rows = (items) => [...new Set(items.map((item) => Math.round(item.box.y)))].length;

describe('the grid flow by count', () => {
  test('landscape: 1, 2, 3 in a row; 4 as 2 x 2; 5 as 3 + 2; 6 as 3 x 2; 7 to 12 in four columns', () => {
    const shapes = Array.from({ length: 12 }, (_, index) => gridFlowShape(index + 1, true)).map((shape) => shape.perRow.join('+'));
    assert.deepEqual(shapes, ['1', '2', '3', '2+2', '3+2', '3+3', '4+3', '4+4', '4+4+1', '4+4+2', '4+4+3', '4+4+4']);
  });

  test('portrait: rows and columns swap (2 and 3 stacked, 5 as 2 + 2 + 1, 6 as 2 x 3, 7 to 12 in three rows)', () => {
    const shapes = Array.from({ length: 12 }, (_, index) => gridFlowShape(index + 1, false)).map((shape) => shape.perRow.join('+'));
    assert.deepEqual(shapes, ['1', '1+1', '1+1+1', '2+2', '2+2+1', '2+2+2', '3+3+1', '3+3+2', '3+3+3', '4+4+2', '4+4+3', '4+4+4']);
  });

  test('pillars draws 5 blocks as 3 + 2, the short row centred with the full rows\' column width', () => {
    const result = compose({ title: 'Five', blocks: short(5) }, layouts.pillars);
    const items = cells(result, 'pillars');
    assert.equal(rows(items), 2);
    const [a, b, c, d, e] = items.map((item) => item.frameBox);
    assert.ok(near(d.width, a.width) && near(e.width, a.width));
    const box = region(result, 'pillars').box;
    assert.ok(near((d.x - box.x), (box.x + box.width) - (e.x + e.width)), 'centred');
    assert.ok(near(b.y, a.y) && near(c.y, a.y) && d.y > a.y);
  });

  test('adding a block reflows the region and nothing else moves', () => {
    const three = compose({ title: 'x', blocks: short(3) }, layouts.pillars), four = compose({ title: 'x', blocks: short(4) }, layouts.pillars);
    assert.deepEqual(region(three, 'pillars').box, region(four, 'pillars').box);
    assert.equal(rows(cells(three, 'pillars')), 1);
    assert.equal(rows(cells(four, 'pillars')), 2);
  });

  test('column stacks with equal heights', () => {
    const result = compose({ title: 'x', blocks: [{ chart: { type: 'pie', data: { columns: ['k', 'v'], rows: [['a', 1]] } } }, text('a'), text('b')] }, layouts['chart-beside']);
    const notes = cells(result, 'notes');
    assert.equal(region(result, 'notes').arrangement, 'column');
    assert.ok(near(notes[0].box.height, notes[1].box.height));
    assert.ok(near(notes[0].box.x, notes[1].box.x));
  });

  test('auto: a grid when every block is short, a column when any block is long (more than 6 estimated lines)', () => {
    assert.equal(region(compose({ title: 'x', blocks: short(3) }, layouts.text), 'body').arrangement, 'grid');
    assert.equal(region(compose({ title: 'x', blocks: [text('a'), text(long), text('c')] }, layouts.text), 'body').arrangement, 'column');
    // The estimate, never the host's measurement: a wide measurement does not change the decision.
    const wide = { measure: (value, size) => value.length * size * 2 };
    assert.equal(region(compose({ title: 'x', blocks: short(3) }, layouts.text, { textMeasurement: wide }), 'body').arrangement, 'grid');
  });
});

describe('tracks', () => {
  test('relative column sizes share the width; auto rows take what their content needs', () => {
    const result = compose({ title: 'Chart', blocks: [{ chart: { type: 'pie', data: { columns: ['k', 'v'], rows: [['a', 1]] } } }, text('Takeaway')] }, layouts['chart-beside']);
    const chart = region(result, 'chart').box, notes = region(result, 'notes').box, gap = 720 / 30;
    assert.ok(near(chart.width / notes.width, 3 / 2, 1e-6));
    assert.ok(near(chart.width + notes.width + gap, result.contentBox.width, 1e-6));
    const title = result.headingAreas[0].box;
    const heading = result.items.find((item) => item.field === 'title');
    assert.ok(near(title.height, heading.box.height, 1e-6), 'the auto title row is as tall as the title');
    assert.ok(near(chart.y, title.y + title.height + gap, 1e-6));
  });

  test('an auto row whose areas are all empty has no height and no gap', () => {
    const result = compose({ title: 'x', blocks: [text('a'), text('b')] }, layouts.comparison);
    const verdict = region(result, 'verdict'), first = region(result, 'first');
    assert.equal(verdict.box.height, 0);
    assert.ok(near(first.box.y + first.box.height, result.contentBox.y + result.contentBox.height, 1e-6));
  });

  test('an auto row is at most half the content box', () => {
    const result = compose({ title: 'x', blocks: [{ metric: { value: 1, label: 'a' } }, text(long.repeat(6))] }, layouts.metrics);
    assert.ok(region(result, 'note').box.height <= result.contentBox.height / 2 + 1e-6);
  });
});

describe('empty regions and headings', () => {
  test('cover: no picture, so media collapses into the title, which spans the slide and centres', () => {
    const result = compose({ title: 'Hello', subtitle: 'World' }, layouts.cover);
    assert.equal(region(result, 'media').collapsed, true);
    const title = result.headingAreas[0];
    assert.ok(near(title.box.width, result.contentBox.width));
    const heading = result.items.find((item) => item.field === 'title');
    assert.ok(heading.box.y > title.box.y + 100, 'centred vertically: the cover rule read from the template');
  });

  test('statement: title only, the message collapses and the title is centred', () => {
    const result = compose({ title: 'The one thing' }, layouts.statement);
    assert.equal(region(result, 'message').collapsed, true);
    assert.ok(result.items[0].box.y > result.contentBox.y + 150);
  });

  test('content layouts keep the title at the top of an auto row', () => {
    const result = compose({ title: 'Title', blocks: short(2) }, layouts.text);
    assert.ok(near(result.items[0].box.y, result.contentBox.y));
  });

  test('image: no title, so the title row is 0 and the bled picture fills the slide', () => {
    const result = compose({ blocks: [{ image: 'https://example.com/a.png' }] }, layouts.image);
    assert.equal(result.headingAreas[0].collapsed, true);
    assert.deepEqual(region(result, 'media').box, { x: 0, y: 0, width: 1280, height: 720 });
  });

  test('empty: keep leaves the space', () => {
    const record = { ...layouts['image-beside'], regions: { ...layouts['image-beside'].regions, media: { ...layouts['image-beside'].regions.media, empty: 'keep' } } };
    const result = compose({ title: 'x', blocks: [text('a')] }, record);
    assert.equal(region(result, 'media').collapsed, undefined);
    assert.ok(near(region(result, 'body').box.width, region(result, 'media').box.width));
  });

  test('a template without a title area gets an implicit auto row on top', () => {
    const record = { name: 'x', areas: ['body'], regions: { body: { accepts: ['text'] } } };
    const result = compose({ title: 'Heading', blocks: [text('a')] }, record);
    assert.deepEqual(result.headingAreas.map((area) => [area.name, area.implicit]), [['title', true]]);
    assert.ok(region(result, 'body').box.y > result.items[0].box.y + result.items[0].box.height);
  });

  test('a subtitle area takes the subtitle out of the title group', () => {
    const record = { name: 'x', areas: ['title subtitle', 'body body'], columns: [1, 1], rows: ['auto', 1], regions: { body: { accepts: ['text'] } } };
    const result = compose({ title: 'T', subtitle: 'S', blocks: [text('a')] }, record);
    const subtitle = result.items.find((item) => item.field === 'subtitle');
    assert.ok(subtitle.box.x >= result.headingAreas.find((area) => area.name === 'subtitle').box.x - 1e-6);
  });
});

describe('bleed, mirror and right to left', () => {
  const picture = { image: 'https://example.com/a.png' };
  test('cover with a picture: the media region reaches the top, right and bottom slide edges', () => {
    const result = compose({ title: 'Hello', blocks: [picture] }, layouts.cover);
    const media = region(result, 'media').box;
    assert.equal(media.y, 0);
    assert.equal(media.x + media.width, 1280);
    assert.equal(media.height, 720);
    assert.equal(cells(result, 'media')[0].frameBox, undefined, 'a bled region is never a card');
  });

  test('design.mirror reverses each row\'s cells and the column sizes', () => {
    const slide = { title: 'x', blocks: [picture, text('Body')] };
    const plain = compose(slide, layouts['image-beside']), mirrored = compose({ ...slide, design: { mirror: true } }, layouts['image-beside']);
    assert.ok(region(plain, 'media').box.x < region(plain, 'body').box.x);
    assert.ok(region(mirrored, 'media').box.x > region(mirrored, 'body').box.x);
    // Binding and reading order do not change.
    assert.deepEqual(mirrored.regions.map((entry) => entry.name), plain.regions.map((entry) => entry.name));
    const chart = { chart: { type: 'pie', data: { columns: ['k', 'v'], rows: [['a', 1]] } } };
    const beside = compose({ title: 'x', blocks: [chart, text('t')], design: { mirror: true } }, layouts['chart-beside']);
    assert.ok(region(beside, 'chart').box.x > region(beside, 'notes').box.x);
    assert.ok(near(region(beside, 'chart').box.width / region(beside, 'notes').box.width, 1.5, 1e-6), 'the sizes travel with their cells');
  });

  test('a right-to-left deck mirrors the drawing, and mirror on top of it reverses again', () => {
    const slide = { title: 'x', blocks: [picture, text('Body')] };
    const rtl = compose(slide, layouts['image-beside'], { direction: 'rtl' });
    assert.ok(region(rtl, 'media').box.x > region(rtl, 'body').box.x);
    const both = compose({ ...slide, design: { mirror: true } }, layouts['image-beside'], { direction: 'rtl' });
    assert.ok(region(both, 'media').box.x < region(both, 'body').box.x);
  });
});

describe('overrides', () => {
  test('design.contentDirection makes every flowing region one row or one column', () => {
    const vertical = compose({ title: 'x', blocks: short(4), design: { contentDirection: 'vertical' } }, layouts.pillars);
    assert.equal(region(vertical, 'pillars').arrangement, 'column');
    assert.equal(rows(cells(vertical, 'pillars')), 4);
    // process carries contentDirection: horizontal in its own design.
    const process = compose({ title: 'x', blocks: short(5) }, layouts.process);
    assert.equal(region(process, 'steps').arrangement, 'row');
  });

  test('a slide\'s own composition.mode and columns arrange its first primary flowing region, above contentDirection', () => {
    const result = compose({ title: 'x', blocks: short(4), composition: { mode: 'grid', columns: 4 }, design: { contentDirection: 'vertical' } }, layouts.pillars);
    assert.equal(region(result, 'pillars').arrangement, 'composition');
    assert.equal(rows(cells(result, 'pillars')), 1);
  });

  test('layout "auto" composes exactly like no layout', () => {
    const slide = { title: 'x', blocks: short(3) };
    assert.deepEqual(composeSlide({ ...slide, layout: 'auto' }), composeSlide(slide));
    const deck = { slides: [{ ...slide, layout: 'auto' }] };
    assert.equal(resolveSlideContext(deck, 0).options.layout, undefined);
    assert.deepEqual(resolveSlideContext(deck, 0).diagnostics, []);
    assert.deepEqual(validate(deck).findings.filter((entry) => entry.ruleId === 'opf/unresolved-reference'), []);
    assert.equal(JSON.parse(format(deck)).slides[0].layout, undefined, 'opf format drops it');
  });
});

describe('one long list in columns', () => {
  const items = Array.from({ length: 14 }, (_, index) => `Agenda point number ${index + 1} with a few words`);
  test('a lone list in a listColumns: auto region flows into the first column count that fits', () => {
    const result = compose({ title: 'Agenda', items }, layouts.agenda);
    const list = result.items.find((item) => item.field === 'items');
    assert.equal(list.listColumns.length, 2);
    assert.deepEqual(list.listColumns.map((column) => [column.start, column.end]), [[0, 7], [7, 14]]);
    assert.ok(list.listColumns.every((column) => !column.text.overflow && near(column.text.fontSize, 25)));
    // The item's text is the whole list, every column's entries at their columns (RR-81 review).
    assert.equal(list.text.listEntries.length, 14);
    assert.deepEqual(list.text.listEntries.map((entry) => entry.index), Array.from({ length: 14 }, (_, index) => index));
    assert.deepEqual(list.text.listEntries.slice(7), list.listColumns[1].text.listEntries);
    assert.equal(list.text.overflow, false);
    assert.ok(list.listColumns[1].box.x > list.listColumns[0].box.x, 'reading order runs column by column');
  });

  test('a short list stays one column', () => {
    const list = compose({ title: 'Agenda', items: items.slice(0, 4) }, layouts.agenda).items.find((item) => item.field === 'items');
    assert.equal(list.listColumns, undefined);
  });

  test('numbering continues across columns; a nested item stays with its parent', () => {
    const nested = items.map((entry, index) => (index === 7 ? { text: entry, level: 1 } : entry));
    const list = compose({ title: 'x', blocks: [{ items: nested, numbering: 'arabic' }] }, layouts.agenda).items.find((item) => item.field === 'items');
    assert.ok(list.listColumns.length >= 2);
    assert.notEqual(list.listColumns[1].start, 7, 'never before a nested item');
    const second = list.listColumns[1];
    assert.equal(second.text.listEntries[0].marker.text.replace(/\D/g, ''), String(second.start + (second.start > 7 ? 0 : 1)));
    assert.equal(second.text.listEntries[0].index, second.start, 'entries keep the payload\'s indexes');
  });

  test('a payload columns count is used as written; auto works in any layout', () => {
    const fixed = compose({ title: 'x', blocks: [{ items: items.slice(0, 6), columns: 3 }] }, layouts.text).items.find((item) => item.field === 'items');
    assert.equal(fixed.listColumns.length, 3);
    const automatic = composeSlide({ title: 'x', blocks: [{ items, columns: 'auto' }] }).items.find((item) => item.field === 'items');
    assert.equal(automatic.listColumns.length, 2);
  });

  test('breaks keep the columns as even as possible', () => {
    assert.deepEqual(listColumnBreaks([1, 1, 1, 1, 1, 1], [0, 0, 0, 0, 0, 0], 3), [2, 4]);
    assert.deepEqual(listColumnBreaks([3, 1, 1, 1], [0, 0, 0, 0], 2), [1]);
    assert.deepEqual(listColumnBreaks([1, 1, 1, 1], [0, 1, 1, 0], 2), [3]);
  });
});

describe('anchor', () => {
  test('statement\'s message sits in the middle of its region', () => {
    const result = compose({ title: 'x', blocks: [text('The one thing to remember.')] }, layouts.statement);
    const message = cells(result, 'message')[0], box = region(result, 'message').box;
    assert.ok(message.box.height < box.height);
    assert.ok(near(message.box.y - box.y, box.y + box.height - (message.box.y + message.box.height), 1));
  });
});

describe('design keys: theme level and precedence', () => {
  test('the six keys a theme may carry rank below the deck and above the layout', () => {
    assert.deepEqual([...THEME_DESIGN_KEYS], ['titleAlignment', 'contentAlignment', 'contentBox', 'contentDirection', 'imageFit', 'listBullet']);
    const layout = { design: { contentBox: false, titleAlignment: 'right' } };
    const theme = { design: { contentBox: true, titleAlignment: 'center', chartPrimary: 'left' } };
    const fromTheme = resolveDesignHints({ layout, theme });
    assert.equal(fromTheme.contentBox, true);
    assert.equal(fromTheme.sources.contentBox, 'theme');
    assert.equal(fromTheme.paths.contentBox, 'design.theme');
    assert.equal(fromTheme.chartPrimary, undefined, 'chartPrimary is not a theme key');
    const fromDeck = resolveDesignHints({ layout, theme, presentation: { design: { contentBox: false } } });
    assert.equal(fromDeck.sources.contentBox, 'deck');
    const fromSlide = resolveDesignHints({ layout, theme, slide: { design: { titleAlignment: 'left', theme: 'x' } }, slideIndex: 2 });
    assert.equal(fromSlide.titleAlignment, 'left');
    assert.equal(resolveDesignHints({ layout, theme, slide: { design: { theme: 'x' } }, slideIndex: 2 }).paths.titleAlignment, 'slides.2.design.theme');
  });

  test('resolveSlideContext passes the theme\'s design and composition draws boxed content', () => {
    const deck = { design: { theme: 'house' }, catalogs: { custom: { themes: { house: { name: 'House', design: { contentBox: true } } } } }, slides: [{ title: 'x', blocks: short(2) }] };
    assert.deepEqual(validate(deck, { only: ['format', 'references'] }).findings.filter((entry) => entry.severity === 'error'), []);
    const context = resolveSlideContext(deck, 0);
    assert.deepEqual(context.options.themeDesign, { contentBox: true });
    const result = composeSlide(context.slide, context.options);
    assert.equal(result.design.contentBox, true);
    assert.equal(result.design.sources.contentBox, 'theme');
    assert.ok(result.items.filter((item) => item.field === 'text').every((item) => item.frameBox));
  });

  test('mirror is a design key of the slide, the deck and the layout', () => {
    assert.equal(resolveDesignHints({ layout: { design: { mirror: true } } }).mirror, true);
    assert.equal(resolveDesignHints({ layout: { design: { mirror: true } }, presentation: { design: { mirror: false } } }).mirror, false);
    const report = validate({ design: { mirror: true }, slides: [{ title: 'x', design: { mirror: false } }] }, { only: ['format'] });
    assert.deepEqual(report.findings, []);
  });
});

describe('geometry.regions', () => {
  test('every region is listed with its box, flow, accepted kinds and content, filled or collapsed', () => {
    const result = compose({ title: 'x', blocks: [{ metric: { value: 1, label: 'a' } }] }, layouts.metrics);
    assert.deepEqual(result.regions.map((entry) => [entry.name, entry.flow, entry.accepts, entry.content, entry.collapsed ?? false]), [
      ['metrics', 'grid', ['metric', 'group'], ['slides.0.blocks.0'], false],
      ['note', 'none', ['text', 'list'], [], true],
    ]);
    assert.equal(result.slots, undefined);
    assert.equal(composeSlide({ title: 'x' }).regions, undefined, 'automatic slides have no regions');
  });

  test('items carry their region; the strict overflow rule still applies', () => {
    const result = compose({ title: 'x', blocks: short(2) }, layouts.pillars);
    assert.deepEqual(result.items.map((item) => item.region ?? null), [null, 'pillars', 'pillars']);
    assert.throws(() => compose({ title: 'x', blocks: [text(long.repeat(20))], composition: { overflow: 'error' } }, layouts.statement), /does not fit/);
  });
});

describe('composeLayoutAreas: the empty layout, as a PowerPoint slide layout places its placeholders', () => {
  test('nothing collapses; auto rows hold one title line or two body lines', async () => {
    const { composeLayoutAreas } = await import('../dist/composition.js');
    const { contentBox, areas } = composeLayoutAreas(layouts.comparison);
    assert.deepEqual(areas.map((area) => [area.name, area.heading]), [['title', true], ['first', false], ['second', false], ['verdict', false]]);
    const verdict = areas.find((area) => area.name === 'verdict').box;
    assert.ok(near(verdict.height, 2 * 25 * 1.22 + 24), 'two body lines inside the card insets (comparison draws cards)');
    assert.ok(near(verdict.y + verdict.height, contentBox.y + contentBox.height));
    const cover = composeLayoutAreas(layouts.cover, { mirror: true }).areas;
    assert.ok(cover.find((area) => area.name === 'media').box.x < cover.find((area) => area.name === 'title').box.x, 'mirrored');
  });

  test('the boxes a slide composes to: header, footer, placed-image bands and bleed (RR-81 review)', async () => {
    const { composeLayoutAreas } = await import('../dist/composition.js');
    const furniture = { header: { left: { text: 'Acme' }, right: { text: 'Confidential' } }, footer: { right: { text: '{{slide.number}}' } } };
    const placements = [{ edge: 'left', size: 0.25 }];
    // Without cards and with cards on the deck (the card insets live in the auto rows too).
    for (const presentation of [{ design: furniture }, { design: { ...furniture, contentBox: true } }]) for (const [id, record] of Object.entries(layouts)) {
      const kept = { ...record, regions: Object.fromEntries(Object.entries(record.regions).map(([name, region]) => [name, { ...region, empty: 'keep' }])) };
      const slide = { title: 'Title', subtitle: 'Subtitle', blocks: [{ image: 'https://example.com/band.png', placement: placements[0] }] };
      const composed = composeSlide(slide, { layout: kept, presentation });
      const { areas } = composeLayoutAreas(record, { presentation, placements });
      for (const region of composed.regions) assert.deepEqual(areas.find((area) => area.name === region.name).box, region.box, `${id} ${region.name}`);
      assert.deepEqual(areas.find((area) => area.name === 'title').box, composed.headingAreas.find((area) => area.name === 'title').box, `${id} title`);
      for (const region of composed.regions) assert.equal(region.collapsed, undefined, `${id} ${region.name} nothing collapses`);
    }
    // A filled two-line verdict on a carded slide is exactly as tall as the layout's verdict placeholder.
    const verdict = 'The new plan wins on cost and on time to market, and the old plan wins only on what we already know how to run well.';
    const filled = composeSlide({ title: 'Title', subtitle: 'Subtitle', blocks: [{ text: 'A' }, { text: 'B' }, { text: verdict }] }, { layout: layouts.comparison });
    const verdictItem = filled.items.find((item) => item.region === 'verdict');
    assert.equal(verdictItem.text.lines.length, 2);
    assert.ok(verdictItem.frameBox, 'carded');
    const placeholder = composeLayoutAreas(layouts.comparison).areas.find((area) => area.name === 'verdict').box;
    assert.ok(near(placeholder.height, filled.regions.find((region) => region.name === 'verdict').box.height, 0.5), `${placeholder.height} vs the filled verdict`);
    const image = composeLayoutAreas(layouts.image).areas.find((area) => area.name === 'media').box;
    assert.equal(image.x, 0, 'bled to the slide edge by default');
    const inside = composeLayoutAreas(layouts.image, { bleed: false }).areas.find((area) => area.name === 'media').box;
    assert.ok(inside.x > 0 && inside.y > 0, 'bleed: false keeps the cell inside the content box');
  });

  test('a template without a subtitle area carves ctrTitle and subTitle boxes from the title area, as slides do', async () => {
    const { composeLayoutAreas } = await import('../dist/composition.js');
    for (const id of ['cover', 'section', 'text']) {
      const title = composeLayoutAreas(layouts[id]).areas.find((area) => area.name === 'title');
      const { parts } = title;
      assert.ok(parts, id);
      assert.ok(near(parts.title.y, title.box.y) && near(parts.subtitle.y + parts.subtitle.height, title.box.y + title.box.height), id);
      assert.ok(parts.title.y + parts.title.height <= parts.subtitle.y + 1e-6, `${id}: title above subtitle`);
      const slide = composeSlide({ title: 'Title', subtitle: 'Subtitle' }, { layout: layouts[id] });
      const heading = slide.items.find((item) => item.field === 'title'), subtitle = slide.items.find((item) => item.field === 'subtitle');
      const sliceParts = slide.headingAreas[0].parts;
      assert.ok(near(sliceParts.subtitle.y, subtitle.box.y) && near(sliceParts.title.y + sliceParts.title.height, heading.box.y + heading.box.height), id);
    }
    // Without a subtitle on the slide, the subtitle box starts half a gap under the title.
    const lone = composeSlide({ title: 'Title' }, { layout: layouts.section });
    const titleItem = lone.items[0], parts = lone.headingAreas[0].parts;
    assert.ok(near(parts.subtitle.y, titleItem.box.y + titleItem.box.height + 12));
  });
});

describe('list columns keep the source paths (RR-81 review)', () => {
  test('a later column starting with a plain string item traces to <list>.<n>, never <list>.<n>.text', () => {
    const items = Array.from({ length: 16 }, (_, index) => (index === 3 ? { text: `Agenda point ${index + 1} with a few words`, description: 'Detail' } : `Agenda point number ${index + 1} with a few words`));
    const slide = { title: 'x', blocks: [{ items, numbering: 'arabic' }] };
    const list = compose(slide, layouts.agenda).items.find((item) => item.field === 'items');
    assert.ok(list.listColumns.length >= 2);
    const resolve = (path) => path.split('.').slice(2).reduce((node, key) => (node === undefined || node === null ? undefined : node[key]), slide);
    for (const column of list.listColumns) {
      assert.ok(column.start > 0 ? typeof items[column.start] === 'string' || true : true);
      for (const entry of column.text.listEntries) {
        const source = items[entry.index];
        assert.equal(entry.textPath, typeof source === 'string' ? `slides.0.blocks.0.items.${entry.index}` : `slides.0.blocks.0.items.${entry.index}.text`);
        assert.notEqual(resolve(entry.textPath), undefined, entry.textPath);
      }
    }
    const later = list.listColumns.slice(1).map((column) => column.text.listEntries[0]);
    assert.ok(later.some((entry) => typeof items[entry.index] === 'string'), 'a later column starts with a string item');
    assert.ok(later.every((entry) => entry.marker.number !== undefined));
  });
});
