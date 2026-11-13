import assert from 'node:assert/strict';
import test from 'node:test';
import {composeSlide} from '../dist/composition.js';
import {paginate} from '../dist/pagination.js';

const entries = Array.from({length: 7}, (_, i) => 'Item '+(i+1)+': Customers told us onboarding took too long, so we rebuilt it around th');
const title = 'A longer title that may need a second line on the slide';
const slide = (block = {items: entries}) => ({title, composition: {minFontSize: 24, maxFontSize: 24}, blocks: [block]});
const listOf = result => result.items.find(item => item.field === 'items');
const columnsOf = item => item.listColumns ?? [{start: 0, end: item.value.length, text: item.text, box: item.box}];
const textEntries = item => columnsOf(item).flatMap(column => column.text.listEntries);
const maxLine = item => Math.max(...textEntries(item).flatMap(entry => entry.text.lines.map(line => [...line.trim()].length)));
const fontsOf = item => [...new Set(textEntries(item).flatMap(entry => entry.text.richLines.flatMap(line => line.fragments.map(fragment => fragment.fontSize))))];
const fitFailures = result => result.diagnostics.filter(issue => ['text-overflow', 'small-cell'].includes(issue.code));
const complete = (item, source) => {
  assert.deepEqual(textEntries(item).map(entry => entry.index), source.map((_, i) => i), 'every source entry is drawn once in column reading order');
  assert.deepEqual(textEntries(item).map(entry => entry.value), source, 'complete source values stay unchanged');
};

for (const cap of [20, 24, 28]) test('a '+cap+'px cap makes a same-size readable column alternative eligible without shrinking', () => {
  const source = slide(); source.composition = {minFontSize: cap, maxFontSize: cap};
  const frozen = structuredClone(source), result = composeSlide(source), item = listOf(result);
  assert.deepEqual(source, frozen);
  assert.equal(item.listColumns?.length, 2);
  assert.equal(result.composition.maxFontSize, cap);
  assert.deepEqual(fontsOf(item), [cap]);
  assert.ok(maxLine(item) <= 70);
  assert.deepEqual(fitFailures(result), []);
  complete(item, entries);
});

test('a fixed one-column choice and authored run sizes are preserved', () => {
  const fixed = listOf(composeSlide(slide({items: entries, columns: 1})));
  assert.equal(fixed.listColumns, undefined);
  assert.equal(maxLine(fixed), 78);
  assert.deepEqual(fontsOf(fixed), [24]);
  const sized = entries.map(text => [{text, fontSize: 18}]);
  const explicit = listOf(composeSlide(slide({items: sized})));
  assert.equal(explicit.listColumns, undefined);
  assert.deepEqual(fontsOf(explicit), [24]);
  complete(explicit, sized);
});

test('short readable capped entries keep one column and the layout-first opt-out stays effective', () => {
  const short = entries.map((_, i) => 'A clear decision '+(i+1));
  const kept = listOf(composeSlide(slide({items: short})));
  assert.equal(kept.listColumns, undefined);
  assert.deepEqual(fontsOf(kept), [24]);
  complete(kept, short);
  assert.equal(listOf(composeSlide(slide(), {fill: false})).listColumns, undefined);
});

test('uncapped lists retain the existing larger-type and no-worse-alternative contracts', () => {
  const source = slide(); delete source.composition.maxFontSize;
  const larger = listOf(composeSlide(source));
  assert.equal(larger.listColumns, undefined);
  assert.ok(larger.text.fontSize > 24);
  const words = n => Array.from({length: n}, (_, i) => ['growth', 'revenue', 'customers', 'market', 'platform', 'strategy', 'quarter', 'team'][i % 8]).join(' ');
  const dense = {title: 'Fourteen points', items: Array.from({length: 14}, (_, i) => 'Point '+(i+1)+': '+words(10))};
  assert.deepEqual(composeSlide(dense), composeSlide(dense, {fill: false}));
});

test('rich formatting and RTL column reading order survive the same-cap measure correction', () => {
  const rich = entries.map(text => [{text: text.slice(0, 8), bold: true}, {text: text.slice(8), language: 'en-US'}]);
  const source = slide({items: rich}), frozen = structuredClone(source), result = composeSlide(source, {direction: 'rtl'}), item = listOf(result);
  assert.deepEqual(source, frozen);
  assert.equal(item.listColumns?.length, 2);
  assert.ok(item.listColumns[0].box.x > item.listColumns[1].box.x, 'first source column is at the RTL start edge');
  assert.deepEqual(fontsOf(item), [24]);
  assert.ok(maxLine(item) <= 70);
  assert.deepEqual(fitFailures(result), []);
  assert.ok(textEntries(item).every(entry => entry.text.richLines.flatMap(line => line.fragments).some(fragment => fragment.style.fontWeight === 700)));
  complete(item, rich);
});

// RR-105 (supervisor decision 2026-11-12): continuation pages are held to the size every later page reaches, never to the first page's
// smaller one, so pages 2 to 4 set the fallback at 28 px (v0.33.0's size) within the reading measure.
test('paginated arrangement fallback keeps all 35 entries and exact mappings, the continuation pages at their shared 28px', () => {
  const layout = {name: 'Levels', direction: 'column', regions: [{name: 'title'}, {name: 'levels', accepts: ['list'], role: 'primary', flow: 'none', arrangement: 'pyramid'}]};
  const document = {catalogs: {custom: {layouts: {levels: layout}}}, slides: [{layout: 'levels', title: 'Pyramid: a longer title that may need a second line on the slide', blocks: Array.from({length: 5}, () => ({items: [...entries]}))}]};
  const frozen = structuredClone(document), result = paginate(document);
  assert.deepEqual(document, frozen);
  assert.equal(result.presentation.slides.length, 4);
  const mappings = result.pages.flatMap(page => page.mappings);
  assert.deepEqual(mappings.map(map => map.sourcePath), Array.from({length: 5}, (_, i) => 'slides.0.blocks.'+i+'.items'));
  assert.ok(mappings.every(map => map.range.unit === 'items' && map.range.start === 0 && map.range.end === 7));
  assert.deepEqual(result.presentation.slides.flatMap(page => page.blocks.flatMap(block => block.items)), document.slides[0].blocks.flatMap(block => block.items));
  let paintedEntries = 0;
  for (const [i, page] of result.presentation.slides.entries()) {
    const geometry = composeSlide(page, {layout}), lists = geometry.items.filter(item => item.field === 'items');
    assert.ok(lists.length > 0, 'each page paints body lists');
    assert.equal(lists.length, page.blocks.filter(block => Array.isArray(block.items)).length, 'every returned list is painted');
    assert.deepEqual(fitFailures(geometry), []);
    for (const item of lists) {
      paintedEntries += textEntries(item).length;
      complete(item, entries); assert.deepEqual(fontsOf(item), [i > 0 ? 28 : 24]); assert.ok(maxLine(item) <= 70, 'page '+(i+1)+' '+item.path+' lines='+maxLine(item)+' columns='+item.listColumns?.length);
      // The measure holds either way: a narrower column, or (at the continuation pages' 28 px) columns across the body.
      if (i > 0) assert.ok(item.box.width < geometry.contentBox.width || (item.listColumns?.length ?? 1) > 1, 'automatic fallback keeps a readable measure');
    }
    if (i > 0) assert.equal(page.composition.maxFontSize, 28);
  }
  assert.equal(paintedEntries, 35, 'all source entries have actual painted geometry');
});

test('an unreadable column alternative that splits words does not replace an intact capped list', () => {
  const longWords = entries.map((_, i) => String(i)+': '+ 'a'.repeat(85));
  const item = listOf(composeSlide(slide({items: longWords}), {width: 2000, height: 720}));
  assert.equal(item.listColumns, undefined);
  assert.deepEqual(fontsOf(item), [24]);
  complete(item, longWords);
});

test('fallback reflow preserves explicit region and payload counts, opt-out, rich styles and RTL source order', () => {
  const layout = {name: 'Levels', direction: 'column', regions: [{name: 'title'}, {name: 'levels', accepts: ['list'], role: 'primary', flow: 'none', arrangement: 'pyramid'}]};
  for (const constraint of ['region', 'payload', 'opt-out']) {
    const fixed = slide({items: entries, ...(constraint === 'payload' ? {columns: 1} : {})});
    fixed.title = 'Pyramid: a longer title that may need a second line on the slide';
    const record = structuredClone(layout); if (constraint === 'region') record.regions[1].listColumns = 1;
    const result = composeSlide(fixed, {layout: record, ...(constraint === 'opt-out' ? {fill: false} : {})}), item = listOf(result);
    assert.ok(result.diagnostics.some(issue => issue.code === 'arrangement-adapted' && issue.message.includes('drawn as a list')), constraint+' is an actual arrangement fallback');
    assert.equal(item.listColumns, undefined, constraint);
    assert.equal(maxLine(item), 78, constraint);
    assert.deepEqual(fontsOf(item), [24]);
    assert.deepEqual(fitFailures(result), []);
    complete(item, entries);
  }
  const rich = entries.map(text => [{text: text.slice(0, 8), bold: true}, {text: text.slice(8), language: 'en-US'}]);
  const source = slide({items: rich}); source.title = 'Pyramid: a longer title that may need a second line on the slide';
  const result = composeSlide(source, {layout, direction: 'rtl'}), item = listOf(result);
  assert.deepEqual(fontsOf(item), [24]);
  assert.ok(maxLine(item) <= 70);
  assert.deepEqual(fitFailures(result), []);
  complete(item, rich);
});