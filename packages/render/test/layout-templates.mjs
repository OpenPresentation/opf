import assert from 'node:assert/strict';
import { resolvePresentation, toSvg } from '../dist/index.js';
import * as harness from './catalog-harness.mjs';
import { featureDecks, layouts, paginatedDecks, templateDeck } from './layout-template-fixture.mjs';

// OPF 0.19 (RR-81): the renderer draws layout-template slides from core's geometry (SlideComposition.regions and the
// items core places in them) and adds nothing of its own: cards are core's frameBox, a bled region reaches the slide edge
// with no card, a list in columns draws every column core broke it into, and with trace every item of a region is grouped
// under data-opf-region. Golden changes are reviewed separately without promoting baselines here.
const attr = (attrs, name) => new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];
const near = (a, b, message) => assert.ok(Math.abs(Number(a) - b) <= 0.006, `${message}: ${a} vs ${b}`);
const openTags = (svg) => [...svg.matchAll(/<([a-z]+)\b([^>]*?)\/?>/g)].map((match) => ({ name: match[1], attrs: match[2], index: match.index }));

let regionItems = 0, cards = 0, bled = 0, columnLists = 0;
const decks = [...Object.keys(layouts).map(templateDeck), ...featureDecks()];
for (const { keys, deck } of decks) {
  const resolved = resolvePresentation(deck);
  const traced = toSvg(deck, { trace: true }), plain = toSvg(deck);
  for (const bound of resolved.slides) {
    const key = keys[bound.index], svg = traced[bound.index], geometry = bound.geometry;
    assert.ok(Array.isArray(geometry.regions), `${key}: core composed the template's regions`);
    const tags = openTags(svg);
    const regionOf = new Map(geometry.regions.map((region) => [region.name, region]));
    // Every traced content path (headings and blocks) resolves against the source deck, so an editor can edit through it.
    for (const tag of tags) {
      const path = attr(tag.attrs, 'data-opf-path');
      if (!path || !/^slides\.\d+\.(blocks|title|subtitle|tag)\b/.test(path)) continue;
      const value = path.split('.').reduce((node, part) => (node === undefined || node === null ? undefined : node[part]), deck);
      assert.notEqual(value, undefined, `${key}: traced path ${path} resolves against the source`);
    }
    for (const item of geometry.items) {
      const own = tags.filter((tag) => attr(tag.attrs, 'data-opf-path') === item.path);
      if (item.region === undefined) {
        // Headings and anything else outside a region are not grouped.
        assert.ok(own[0], `${key}: ${item.path} is drawn`);
        assert.ok(!svg.slice(Math.max(0, own[0].index - 60), own[0].index).includes('data-opf-region'), `${key}: ${item.path} is not in a region group`);
        continue;
      }
      regionItems++;
      const region = regionOf.get(item.region);
      assert.ok(region, `${key}: ${item.path} names a region of the slide (${item.region})`);
      // The first element an item draws opens right after its region group.
      const first = own[0];
      assert.ok(first, `${key}: ${item.path} is drawn`);
      const opener = `<g data-opf-region="${item.region}">`;
      assert.equal(svg.slice(first.index - opener.length, first.index), opener, `${key}: ${item.path} is grouped under its region`);
      // Cards are core's frameBox, drawn as the item's first element; a bled region never has one.
      const card = own.find((tag) => tag.name === 'rect' && attr(tag.attrs, 'stroke') !== undefined && attr(tag.attrs, 'rx') !== undefined && attr(tag.attrs, 'stroke-dasharray') === undefined);
      if (item.frameBox) {
        cards++;
        assert.ok(!region.bleed, `${key}: ${item.path} has a card in a bled region`);
        assert.equal(card, first, `${key}: ${item.path} draws its card first`);
        near(attr(card.attrs, 'x'), item.frameBox.x, `${key}: ${item.path} card x`);
        near(attr(card.attrs, 'y'), item.frameBox.y, `${key}: ${item.path} card y`);
        near(attr(card.attrs, 'width'), item.frameBox.width, `${key}: ${item.path} card width`);
        near(attr(card.attrs, 'height'), item.frameBox.height, `${key}: ${item.path} card height`);
      } else {
        assert.equal(card, undefined, `${key}: ${item.path} draws no card core did not compose`);
      }
      // A bled region reaches the slide edge: its picture is drawn at core's box, which touches the edges of the slide.
      if (region.bleed && item.field === 'image' && !region.collapsed) {
        bled++;
        const picture = own.find((tag) => tag.name === 'image');
        assert.ok(picture, `${key}: ${item.path} draws its picture`);
        const box = { x: Number(attr(picture.attrs, 'x')), y: Number(attr(picture.attrs, 'y')), width: Number(attr(picture.attrs, 'width')), height: Number(attr(picture.attrs, 'height')) };
        // WI-3: a picture shown whole is drawn in its own frame at the top of the bled cell, which is core's `item.image.box`.
        assert.deepEqual(box, { x: item.image.box.x, y: item.image.box.y, width: item.image.box.width, height: item.image.box.height }, `${key}: ${item.path} picture box`);
        assert.ok(item.image.box.x >= item.box.x - 0.01 && item.image.box.y >= item.box.y - 0.01 && item.image.box.x + item.image.box.width <= item.box.x + item.box.width + 0.01, `${key}: ${item.path} frame inside the bled cell`);
        // The bled cell, which holds the whole picture, reaches the slide edge; a contained picture's own frame sits inside it.
        const cell = item.box, edges = [cell.x <= 0.01, cell.y <= 0.01, cell.x + cell.width >= geometry.width - 0.01, cell.y + cell.height >= geometry.height - 0.01].filter(Boolean).length;
        assert.ok(edges >= 2, `${key}: ${item.path} bleeds to the slide edge (${JSON.stringify(cell)})`);
      }
      // A list in columns: every column core broke it into is drawn in its own box, with every item exactly once and the
      // numbering continuing across the columns.
      if (item.listColumns) {
        columnLists++;
        const mine = tags.filter((tag) => tag.index > first.index && attr(tag.attrs, 'data-opf-list-column') !== undefined).slice(0, item.listColumns.length);
        assert.equal(mine.length, item.listColumns.length, `${key}: ${item.path} draws ${item.listColumns.length} columns`);
        item.listColumns.forEach((column, index) => {
          const drawn = mine[index].attrs;
          assert.equal(attr(drawn, 'data-opf-list-column'), String(index));
          assert.equal(attr(drawn, 'data-opf-list-start'), String(column.start));
          assert.equal(attr(drawn, 'data-opf-list-end'), String(column.end));
          near(attr(drawn, 'data-opf-box-x'), column.box.x, `${key}: column ${index} x`);
          near(attr(drawn, 'data-opf-box-width'), column.box.width, `${key}: column ${index} width`);
          if (index) assert.equal(column.start, item.listColumns[index - 1].end, `${key}: columns are contiguous`);
        });
        const count = item.value.length;
        assert.equal(item.listColumns.at(-1).end, count, `${key}: the columns hold the whole list`);
        // Every item of the payload is drawn exactly once, in the column core put it in, at the path core traced.
        const entries = item.listColumns.flatMap((column) => column.text.listEntries.map((entry) => ({ ...entry, column })));
        assert.deepEqual(entries.map((entry) => entry.index), Array.from({ length: count }, (_, index) => index), `${key}: each item in one column, in order`);
        for (const entry of entries) {
          assert.ok(entry.index >= entry.column.start && entry.index < entry.column.end, `${key}: item ${entry.index} in its column`);
          const texts = tags.filter((tag) => tag.name === 'g' && attr(tag.attrs, 'data-opf-path') === entry.textPath);
          assert.equal(texts.length, 1, `${key}: ${entry.textPath} drawn once`);
          // Every traced path resolves against the source: a plain-string item is traced at its own index.
          if (typeof item.value[entry.index] === 'string') assert.equal(entry.textPath, `${item.path}.${entry.index}`, `${key}: ${entry.textPath} is a source path`);
        }
        if (item.payload.numbering === 'arabic') {
          const markers = [...svg.matchAll(/<text\b[^>]*aria-hidden="true"[^>]*>(\d+)\.<\/text>/g)].map((match) => Number(match[1]));
          assert.deepEqual(markers, Array.from({ length: count }, (_, index) => index + 1), `${key}: numbering continues across columns`);
        }
        // Without trace the columns are drawn the same, with no trace attributes.
        assert.ok(!plain[bound.index].includes('data-opf-list-column') && !plain[bound.index].includes('data-opf-region'), `${key}: untraced output carries no trace`);
        for (const column of item.listColumns) for (const entry of column.text.listEntries) {
          assert.ok(plain[bound.index].includes(`>${entry.marker.text}</text>`), `${key}: untraced marker ${entry.marker.text}`);
        }
      }
    }
  }
}
assert.ok(regionItems > 900, `region items checked: ${regionItems}`);
assert.ok(cards > 0 && cards < regionItems, `cards checked: ${cards}`);
assert.ok(bled >= 25, `bled pictures checked: ${bled}`);
assert.ok(columnLists >= 5, `lists in columns checked: ${columnLists}`);

// Overflow and pagination. A sample slide whose content does not fit at minFontSize (even in list columns) carries core's
// text-overflow and draws its overflow past its cell, as OPF does everywhere; core's paginate resolves it on the same layout.
// Every page paginate makes draws with no text-overflow (from core or from the renderer) and with every element of a region
// inside that region's box (trace attributes; the box already includes bleed, the tolerance covers strokes and rounding).
const TOLERANCE = 1.5;
// Each region group of a traced SVG with the open tags it contains, skipping what a clip or transform positions.
const regionGroups = (svg) => {
  const groups = [], stack = [];
  for (const match of svg.matchAll(/<(\/?)([a-zA-Z]+)\b([^>]*?)(\/?)>/g)) {
    const [, closing, name, attrs, selfClosing] = match;
    if (closing) { if (name === 'g' || name === 'defs' || name === 'clipPath') stack.pop(); continue; }
    const region = attr(attrs, 'data-opf-region');
    const hidden = name === 'defs' || name === 'clipPath' || attr(attrs, 'transform') !== undefined || attr(attrs, 'clip-path') !== undefined;
    const parent = stack.at(-1);
    const frame = { group: region !== undefined ? { region, tags: [] } : parent?.group, hidden: hidden || parent?.hidden };
    if (region !== undefined) groups.push(frame.group);
    else if (frame.group && !frame.hidden) frame.group.tags.push({ name, attrs });
    if (!selfClosing && (name === 'g' || name === 'defs' || name === 'clipPath')) stack.push(frame);
  }
  return groups;
};
const outside = (tag, box) => {
  const n = (name) => Number(attr(tag.attrs, name));
  const right = box.x + box.width + TOLERANCE, bottom = box.y + box.height + TOLERANCE, left = box.x - TOLERANCE, top = box.y - TOLERANCE;
  const rect = (x, y, w, h) => x < left || y < top || x + w > right || y + h > bottom;
  if ((tag.name === 'rect' || tag.name === 'image') && attr(tag.attrs, 'width') !== undefined) return rect(n('x') || 0, n('y') || 0, n('width'), n('height'));
  if (attr(tag.attrs, 'data-opf-box-width') !== undefined) {
    if (rect(n('data-opf-box-x'), n('data-opf-box-y'), n('data-opf-box-width'), n('data-opf-box-height'))) return true;
  }
  const lines = attr(tag.attrs, 'data-opf-rich-lines');
  if (lines) return JSON.parse(lines.replaceAll('&quot;', '"')).some((line) => line.y < top || line.y + line.height > bottom);
  if (tag.name === 'text' && attr(tag.attrs, 'y') !== undefined) return n('x') < left || n('x') > right || n('y') < top || n('y') > bottom;
  if (tag.name === 'circle') return n('cx') - n('r') < left || n('cx') + n('r') > right || n('cy') - n('r') < top || n('cy') + n('r') > bottom;
  if (tag.name === 'line') return [n('x1'), n('x2')].some((x) => x < left || x > right) || [n('y1'), n('y2')].some((y) => y < top || y > bottom);
  return false;
};
let paginatedPages = 0, checkedElements = 0;
const overflowing = new Map(decks.flatMap(({ keys, deck }) => resolvePresentation(deck).slides.map((bound) => [keys[bound.index], bound.geometry.diagnostics.filter((entry) => entry.code === 'text-overflow').length])));
const paginated = paginatedDecks();
assert.ok(paginated.length >= 10, `overflowing sample slides paginated: ${paginated.length}`);
// The check bites: unpaginated, these slides draw region elements outside their region box.
for (const { keys, deck } of [templateDeck('agenda'), templateDeck('table-beside')]) {
  const svgs = toSvg(deck, { trace: true });
  for (const bound of resolvePresentation(deck).slides) {
    if (!['agenda 5 long', 'agenda 6 long', 'table-beside 5 long', 'table-beside 6 long'].includes(keys[bound.index])) continue;
    const boxes = new Map(bound.geometry.regions.map((region) => [region.name, region.box]));
    assert.ok(regionGroups(svgs[bound.index]).some((group) => group.tags.some((tag) => outside(tag, boxes.get(group.region)))), `${keys[bound.index]}: overflow is drawn outside its region before pagination`);
  }
}
for (const name of ['agenda 5 long', 'agenda 6 long', 'list 5 long', 'list 6 long', 'faq 5 long', 'faq 6 long', 'table-beside 5 long', 'table-beside 6 long', 'timeline 5 long', 'timeline 6 long']) {
  assert.ok(overflowing.get(name) > 0, `${name} carries text-overflow before pagination`);
  assert.ok(paginated.some(({ source }) => source === name), `${name} is paginated`);
}
for (const { source, keys, deck } of paginated) {
  assert.ok(overflowing.get(source) > 0, `${source} carries text-overflow before pagination`);
  assert.ok(keys.length > 1, `${source} continues on more than one page`);
  const drawn = [];
  const svgs = toSvg(deck, { trace: true, onDiagnostic: (entry) => drawn.push(entry) });
  assert.deepEqual(drawn.filter((entry) => entry.code === 'text-overflow'), [], `${source}: the renderer reports no text-overflow on its pages`);
  for (const bound of resolvePresentation(deck).slides) {
    const key = keys[bound.index], geometry = bound.geometry;
    paginatedPages++;
    assert.equal(deck.slides[bound.index].layout, source.split(' ')[0], `${key}: continues on the same layout`);
    assert.deepEqual(geometry.diagnostics.filter((entry) => entry.code === 'text-overflow'), [], `${key}: no text-overflow`);
    const boxes = new Map(geometry.regions.map((region) => [region.name, region.box]));
    for (const group of regionGroups(svgs[bound.index])) {
      const box = boxes.get(group.region);
      assert.ok(box, `${key}: ${group.region} is a region of the page`);
      for (const tag of group.tags) {
        checkedElements++;
        assert.ok(!outside(tag, box), `${key}: <${tag.name}> of ${group.region} lies outside its region box ${JSON.stringify(box)}: ${tag.attrs.slice(0, 200)}`);
      }
    }
    // Blocks no region accepts (a layout with no overflow region) are drawn below the grid, untagged: inside the slide.
    for (const item of geometry.items) {
      if (item.region !== undefined || ['tag', 'title', 'subtitle'].includes(item.field)) continue;
      const box = item.frameBox ?? item.box;
      assert.ok(box.x >= -TOLERANCE && box.y >= -TOLERANCE && box.x + box.width <= geometry.width + TOLERANCE && box.y + box.height <= geometry.height + TOLERANCE, `${key}: ${item.path} below the grid lies inside the slide`);
    }
  }
}
assert.ok(checkedElements > 1000, `paginated elements checked: ${checkedElements}`);

// 0.18 slides (opf-layout/v1 records from the gallery snapshot) carry no template metadata and draw as before.
const v1 = { design: { contentBox: true }, slides: [
  { layout: 'list-2x', title: 'Two lists', blocks: [{ items: ['One', 'Two', 'Three'] }, { items: ['Four', 'Five'] }] },
  { layout: 'image-1x', title: 'Picture', image: { src: 'https://example.com/picture.png', alt: 'Picture' } },
  { title: 'Automatic', blocks: [{ items: Array.from({ length: 16 }, (_, index) => `Item ${index + 1}`) }] },
] };
const v1Resolved = harness.resolvePresentation(v1);
for (const bound of v1Resolved.slides) {
  assert.equal(bound.geometry.regions, undefined, `v1 slide ${bound.index}: no template regions`);
  assert.ok(bound.geometry.items.every((item) => item.region === undefined && item.listColumns === undefined), `v1 slide ${bound.index}: no region or list columns`);
}
for (const svg of harness.toSvg(v1, { trace: true })) {
  assert.ok(!svg.includes('data-opf-region') && !svg.includes('data-opf-list-column'), 'v1 slides carry no template trace');
}
console.log(`Layout templates: ${regionItems} region items, ${cards} cards, ${bled} bled pictures and ${columnLists} lists in columns drawn from core's geometry; ${paginated.length} overflowing slides paginate into ${paginatedPages} pages with no text-overflow and ${checkedElements} region elements inside their region boxes.`);

// Host-registered gallery2 layouts preserve all three alignment choices in traced text.
const anchors = {left: 'start', center: 'middle', right: 'end'};
let aligned = 0;
for (const id of Object.keys(layouts)) for (const alignment of Object.keys(anchors)) {
  const deck = {slides: [{layout: id, title: 'Alignment probe', blocks: [{text: 'Region alignment probe'}],
    design: {titleAlignment: alignment, contentAlignment: alignment}}]};
  const bound = harness.resolvePresentation(deck).slides[0];
  assert.deepEqual(bound.layout, layouts[id], `${id}: the host resolves the actual gallery2 record`);
  for (const [path, value] of [['slides.0.title', 'Alignment probe'], ['slides.0.blocks.0.text', 'Region alignment probe']]) {
    assert.ok(bound.geometry.items.some(item => item.path === path && item.value === value), `${id}/${alignment}: authored ${path} is composed`);
  }
  const svg = harness.toSvg(deck, 1, {trace: true});
  const tags = openTags(svg);
  let drawn = 0;
  for (const item of bound.geometry.items.filter(item => item.type === 'text' && typeof item.value === 'string')) {
    assert.equal(item.alignment, alignment, `${id}/${alignment}: ${item.path} composed alignment`);
    const texts = tags.filter(tag => tag.name === 'text' && attr(tag.attrs, 'data-opf-path') === item.path);
    assert.ok(texts.length, `${id}/${alignment}: ${item.path} traced text`);
    for (const text of texts) assert.equal(attr(text.attrs, 'text-anchor') ?? 'start', anchors[alignment], `${id}/${alignment}: ${item.path} SVG anchor`);
    drawn += texts.length;
  }
  assert.ok(drawn, `${id}/${alignment}: actual aligned text was checked`);
  aligned++;
}
assert.equal(aligned, 87);
console.log(`Gallery2 alignment: ${aligned} registered layout/alignment cases preserve traced anchors.`);
