import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide, layoutQuote, resolveFontFamilies} from '../dist/composition.js';

// Layout hints and the accent font (spec-gap closure A3, A4 and A6): design.contentDirection sets the
// root mode, design.chartPrimary splits a primary chart from the other content, and fontScheme.accent
// styles the tag and the quote body. Decisions are recorded in docs/design-resolution.md.
const chart = {type: 'chart', chart: {type: 'column', data: {categories: ['A', 'B'], series: [{name: 'S', values: [1, 2]}]}}};
const blocks = [{text: 'First'}, {text: 'Second'}, {text: 'Third'}];
const boxes = result => result.items.filter(item => !['tag', 'title', 'subtitle'].includes(item.field)).map(item => item.box);
const isColumn = result => { const b = boxes(result); return b.every(box => box.x === b[0].x) && b.every((box, i) => i === 0 || box.y > b[i - 1].y); };
const isRow = result => { const b = boxes(result); return b.every(box => box.y === b[0].y) && b.every((box, i) => i === 0 || box.x > b[i - 1].x); };
const rootDecision = result => result.explanation.decisions.find(decision => decision.path === 'slides.0');

test('contentDirection sets the root mode for blocks and root payloads, slide design over deck design', () => {
  const slide = {title: 'Blocks', blocks};
  const auto = composeSlide(slide, {explain: true});
  assert.equal(rootDecision(auto).reason, 'lowest-score');
  const vertical = composeSlide(slide, {presentation: {design: {contentDirection: 'vertical'}}, explain: true});
  assert.ok(isColumn(vertical));
  assert.deepEqual({...rootDecision(vertical), candidates: []}, {path: 'slides.0', mode: 'column', reason: 'configured-mode', selectedColumns: 1, candidates: []});
  assert.deepEqual(boxes(vertical), boxes(composeSlide({...slide, composition: {mode: 'column'}})), 'same geometry as an explicit column mode');
  const horizontal = composeSlide(slide, {presentation: {design: {contentDirection: 'horizontal'}}, explain: true});
  assert.ok(isRow(horizontal));
  assert.equal(rootDecision(horizontal).mode, 'row');
  assert.deepEqual(boxes(horizontal), boxes(composeSlide({...slide, composition: {mode: 'row'}})));
  // The slide design wins over the deck design; an unknown value falls through to the next source.
  assert.ok(isRow(composeSlide({...slide, design: {contentDirection: 'horizontal'}}, {presentation: {design: {contentDirection: 'vertical'}}})));
  assert.deepEqual(boxes(composeSlide(slide, {presentation: {design: {contentDirection: 'diagonal'}}})), boxes(auto));
  // Root payloads follow the same rule (a single leaf stays a single cell).
  const single = composeSlide({title: 'Text', text: 'Body'}, {presentation: {design: {contentDirection: 'vertical'}}, explain: true});
  assert.equal(rootDecision(single).mode, 'column');
  assert.deepEqual(boxes(single), boxes(composeSlide({title: 'Text', text: 'Body'})));
});

test('contentDirection precedence: an explicit composition.mode (slide or layout record) wins; the hint beats the layout direction', () => {
  const slide = {title: 'Blocks', blocks};
  const vertical = {design: {contentDirection: 'vertical'}};
  // An explicit slide composition.mode is authoritative.
  const explicit = composeSlide({...slide, composition: {mode: 'row'}}, {presentation: vertical, explain: true});
  assert.ok(isRow(explicit));
  assert.deepEqual(boxes(explicit), boxes(composeSlide({...slide, composition: {mode: 'row'}})));
  // So is the layout record's composition.mode: pptx.gallery derives contentDirection from the layout's
  // own slideLayoutDirection, and the hint must never flatten the layout's grid (chart-2x stays 2x2).
  const rowLayout = {id: 'row-layout', slideLayoutDirection: 'Horizontal', composition: {mode: 'row', gap: 0.06}, placeholders: [{type: 'title'}, {type: 'text'}, {type: 'text'}]};
  const kept = composeSlide(slide, {layout: rowLayout, presentation: vertical, explain: true});
  assert.ok(isRow(kept));
  assert.deepEqual(boxes(kept), boxes(composeSlide(slide, {layout: rowLayout})));
  assert.equal(kept.composition.gap, 0.06);
  const gridLayout = {id: 'chart-2x', composition: {mode: 'grid', columns: 2}, placeholders: [{type: 'title'}, {type: 'chart'}, {type: 'text'}, {type: 'chart'}, {type: 'text'}]};
  const four = {title: 'Grid', blocks: [chart, {text: 'a'}, chart, {text: 'b'}]};
  for (const hint of ['horizontal', 'vertical']) {
    const result = composeSlide({...four, design: {contentDirection: hint}}, {layout: gridLayout, explain: true});
    assert.deepEqual(boxes(result), boxes(composeSlide(four, {layout: gridLayout})), `${hint} keeps the 2x2 grid`);
    assert.equal(rootDecision(result).mode, 'grid');
  }
  // The layout's slideLayoutDirection is only a hint below the design value.
  const directionLayout = {id: 'direction-layout', slideLayoutDirection: 'Horizontal', placeholders: [{type: 'title'}, {type: 'text'}]};
  assert.ok(isRow(composeSlide(slide, {layout: directionLayout})));
  assert.ok(isColumn(composeSlide(slide, {layout: directionLayout, presentation: vertical})));
  // Without a hint the layout direction still applies, so existing decks are unchanged.
  assert.ok(isColumn(composeSlide(slide, {layout: {...directionLayout, slideLayoutDirection: 'Vertical'}, presentation: {design: {}}})));
});

test('contentDirection leaves promoted regions and nested groups untouched', () => {
  const regions = {title: 'Regions', left: {text: 'L'}, right: {text: 'R'}};
  const twoColumn = {id: 'two-column', slideLayoutDirection: 'Horizontal', composition: {mode: 'row', gap: 0.06}, placeholders: [{type: 'title'}, {type: 'list'}, {type: 'list'}]};
  for (const layout of [twoColumn, undefined]) {
    const control = composeSlide(regions, {layout, explain: true});
    const hinted = composeSlide(regions, {layout, presentation: {design: {contentDirection: 'vertical'}}, explain: true});
    assert.deepEqual(hinted.items.map(item => item.box), control.items.map(item => item.box));
    assert.equal(rootDecision(hinted).reason, 'promoted-regions');
    assert.deepEqual(hinted.flows, control.flows);
  }
  const nested = {title: 'Group', blocks: [{composition: {mode: 'row'}, blocks: [{text: 'a'}, {text: 'b'}]}, {text: 'c'}]};
  const result = composeSlide(nested, {presentation: {design: {contentDirection: 'vertical'}}, explain: true});
  assert.equal(rootDecision(result).mode, 'column');
  const group = result.explanation.decisions.find(decision => decision.path === 'slides.0.blocks.0');
  assert.equal(group.mode, 'row');
  const [a, b] = result.items.filter(item => item.path.startsWith('slides.0.blocks.0.'));
  assert.equal(a.box.y, b.box.y, 'the group keeps its own row');
});

test('chartPrimary splits the first chart from a synthetic container of the other nodes', () => {
  const slide = {title: 'Chart', blocks: [{text: 'Intro'}, chart, {text: 'Support'}, {items: ['a', 'b']}]};
  const control = composeSlide(slide, {explain: true});
  const gap = 720 / 30, width = control.contentBox.width, height = control.contentBox.height;
  for (const [side, expect] of [
    ['left', {mode: 'row', columns: 2, chart: box => box.x === control.contentBox.x && Math.abs(box.width - (width - gap) * 3 / 5) < 1e-6}],
    ['right', {mode: 'row', columns: 2, chart: box => Math.abs(box.x + box.width - (control.contentBox.x + width)) < 1e-6 && Math.abs(box.width - (width - gap) * 3 / 5) < 1e-6}],
    ['top', {mode: 'column', columns: 1, chart: box => box.y === control.contentBox.y && Math.abs(box.height - (height - gap) * 3 / 5) < 1e-6}],
    ['bottom', {mode: 'column', columns: 1, chart: box => Math.abs(box.y + box.height - (control.contentBox.y + height)) < 1e-6 && Math.abs(box.height - (height - gap) * 3 / 5) < 1e-6}],
  ]) {
    for (const [slideInput, options] of [[slide, {presentation: {design: {chartPrimary: side}}}], [{...slide, design: {chartPrimary: side}}, {presentation: {design: {chartPrimary: 'none'}}}], [slide, {layout: {id: 'chart-2x', contentTypeChartPrimary: side[0].toUpperCase() + side.slice(1), composition: {mode: 'grid', columns: 2}, placeholders: [{type: 'title'}, {type: 'chart'}, {type: 'text'}, {type: 'chart'}, {type: 'text'}]}}]]) {
      const result = composeSlide(slideInput, {...options, explain: true});
      const chartItem = result.items.find(item => item.field === 'chart');
      assert.ok(expect.chart(chartItem.box), `${side}: chart box ${JSON.stringify(chartItem.box)}`);
      assert.deepEqual({...rootDecision(result), candidates: []}, {path: 'slides.0', mode: expect.mode, reason: 'chart-primary', selectedColumns: expect.columns, candidates: []});
      assert.deepEqual(result.groups, [], 'the synthetic container records no group');
      assert.deepEqual(result.flows.map(flow => flow.path), ['slides.0'], 'and no flow');
      assert.deepEqual(result.explanation.decisions.map(decision => decision.path), ['slides.0'], 'and no decision');
      const rest = result.items.filter(item => !['title', 'chart'].includes(item.field));
      assert.deepEqual(rest.map(item => item.path), ['slides.0.blocks.0.text', 'slides.0.blocks.2.text', 'slides.0.blocks.3.items'], 'source order is kept');
      for (const item of rest) {
        const overlapX = item.box.x < chartItem.box.x + chartItem.box.width - 1e-6 && chartItem.box.x < item.box.x + item.box.width - 1e-6;
        const overlapY = item.box.y < chartItem.box.y + chartItem.box.height - 1e-6 && chartItem.box.y < item.box.y + item.box.height - 1e-6;
        assert.ok(!(overlapX && overlapY), 'the rest stays in its own track');
        assert.ok(item.box.x >= control.contentBox.x - 1e-6 && item.box.x + item.box.width <= control.contentBox.x + width + 1e-6);
        assert.ok(item.box.y >= control.contentBox.y - 1e-6 && item.box.y + item.box.height <= control.contentBox.y + height + 1e-6);
      }
      assert.deepEqual(result.composition, composeSlide(slideInput, {layout: options.layout}).composition, 'the reported slide composition is the ordinary layout/slide merge');
    }
  }
  // 'none' and unknown values keep the automatic grid, and a design 'none' overrides a layout side.
  const none = composeSlide(slide, {presentation: {design: {chartPrimary: 'none'}}, explain: true});
  assert.deepEqual(none.items.map(item => item.box), control.items.map(item => item.box));
  assert.equal(rootDecision(none).reason, 'lowest-score');
  assert.deepEqual(composeSlide(slide, {presentation: {design: {chartPrimary: 'middle'}}}).items.map(item => item.box), control.items.map(item => item.box));
  const layoutLeft = {id: 'chart-text', contentTypeChartPrimary: 'Left', placeholders: [{type: 'title'}, {type: 'chart'}, {type: 'text'}]};
  assert.equal(rootDecision(composeSlide(slide, {layout: layoutLeft, explain: true})).reason, 'chart-primary');
  assert.equal(rootDecision(composeSlide(slide, {layout: layoutLeft, presentation: {design: {chartPrimary: 'none'}}, explain: true})).reason, 'lowest-score');
  assert.equal(rootDecision(composeSlide(slide, {layout: {...layoutLeft, contentTypeChartPrimary: 'None'}, explain: true})).reason, 'lowest-score');
  // A root chart payload beside nothing else is a single cell; two root blocks (chart and text) split 3:2.
  const pair = composeSlide({title: 'Pair', blocks: [chart, {text: 'Support'}]}, {presentation: {design: {chartPrimary: 'right'}}});
  const [chartBox, textBox] = [pair.items.find(item => item.field === 'chart').box, pair.items.find(item => item.field === 'text').box];
  assert.ok(textBox.x < chartBox.x && Math.abs(textBox.width / chartBox.width - 2 / 3) < 1e-6);
});

test('chartPrimary does not apply with regions, an explicit mode, no chart, only charts, or a nested chart', () => {
  const side = {presentation: {design: {chartPrimary: 'left'}}};
  const cases = [
    [{title: 'Regions', left: chart, right: {text: 'R'}}, 'promoted-regions'],
    [{title: 'Explicit', composition: {mode: 'grid', columns: 2}, blocks: [chart, {text: 'a'}]}, 'configured-mode'],
    [{title: 'Explicit', composition: {mode: 'auto'}, blocks: [chart, {text: 'a'}]}, 'lowest-score'],
    [{title: 'No chart', blocks}, 'lowest-score'],
    [{title: 'Only charts', blocks: [chart, chart]}, 'lowest-score'],
    [{title: 'One chart', chart: chart.chart}, 'lowest-score'],
    [{title: 'Nested', blocks: [{blocks: [chart, {text: 'a'}]}, {text: 'b'}]}, 'lowest-score'],
  ];
  for (const [slide, reason] of cases) {
    const control = composeSlide(slide, {explain: true}), hinted = composeSlide(slide, {...side, explain: true});
    assert.deepEqual(hinted.items.map(item => item.box), control.items.map(item => item.box), slide.title);
    assert.equal(rootDecision(hinted).reason, reason, slide.title);
    assert.deepEqual(hinted.groups, control.groups);
  }
  // contentDirection yields to chartPrimary at the root, since both only apply without an explicit mode.
  const both = composeSlide({title: 'Both', blocks: [chart, {text: 'a'}]}, {presentation: {design: {chartPrimary: 'top', contentDirection: 'horizontal'}}, explain: true});
  assert.equal(rootDecision(both).mode, 'column');
  assert.equal(rootDecision(both).reason, 'chart-primary');
});

test('fontScheme.accent resolves only when defined and styles the tag and the quote body', () => {
  assert.equal(resolveFontFamilies({major: 'Aptos Display', minor: 'Aptos'}).accent, undefined);
  assert.equal('accent' in resolveFontFamilies({}), false);
  assert.equal(resolveFontFamilies({accent: 'Impact'}).accent, 'Impact');
  assert.equal(resolveFontFamilies({accent: {family: 'Impact', weight: 700}}).accent, 'Impact');
  assert.equal(resolveFontFamilies({accent: {weight: 700}}).accent, undefined);
  assert.equal(resolveFontFamilies({accent: ''}).accent, undefined);
  const fonts = {heading: 'Heading Face', body: 'Body Face', code: 'Code Face', accent: 'Accent Face'};
  const slide = {tag: 'Eyebrow', title: 'Title', subtitle: 'Sub', blocks: [{text: 'Body'}, {quote: {text: 'Quoted', attribution: 'Someone'}}, {code: 'x = 1'}]};
  const result = composeSlide(slide, {fonts});
  const family = field => result.items.find(item => item.field === field).textStyle.fontFamily;
  assert.equal(family('tag'), 'Accent Face');
  assert.equal(family('title'), 'Heading Face');
  assert.equal(family('subtitle'), 'Body Face');
  assert.equal(family('text'), 'Body Face');
  assert.equal(family('code'), 'Code Face');
  const quote = result.items.find(item => item.field === 'quote').quoteLayout;
  assert.equal(quote.parts.find(part => part.role === 'body').style.fontFamily, 'Accent Face');
  assert.equal(quote.parts.find(part => part.role === 'footer').style.fontFamily, 'Body Face');
  assert.equal(layoutQuote('Q', {x: 0, y: 0, width: 400, height: 200}, {fonts}).parts[0].requestedStyle.fontFamily, 'Accent Face');
  // Without an accent family nothing changes.
  const plain = composeSlide(slide, {fonts: {heading: 'Heading Face', body: 'Body Face', code: 'Code Face'}});
  assert.equal(plain.items.find(item => item.field === 'tag').textStyle.fontFamily, 'Body Face');
  assert.equal(plain.items.find(item => item.field === 'quote').quoteLayout.parts[0].style.fontFamily, 'Heading Face');
  assert.deepEqual(plain.items.map(item => item.box), result.items.map(item => item.box), 'estimated geometry is font-independent');
});
