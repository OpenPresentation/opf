import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {composeSlide, fitList, fitRichText, fitText, layoutFurniture, layoutMetric, layoutTable, layoutTimeline, placeTextLines, physicalAlignment, paragraphDirectionAt} from '../dist/composition.js';
import { resolveSlideDirection } from '../dist/composition.js';

// RR-05: right-to-left layout. Alignment is logical (`left` is the start edge), the arrangement mirrors, lists put markers at the
// right, tables run right to left, and every wrapped line shares its paragraph's direction. Left-to-right decks are untouched.
const arabic = 'العنصر الأول مع رقم 2026 وهذه جملة طويلة تلتف على أكثر من سطر واحد داخل الصندوق';
const doc = (extra = {}, slide = {}) => ({language: 'ar', slides: [{title: 'عنوان', ...slide}], ...extra});
const measure = (text, size) => Array.from(text).length * size * 0.5;
const textMeasurement = {measure: (text, size) => measure(text, size)};
const compose = (presentation, slide = presentation.slides[0], options = {}) => composeSlide(slide, {presentation, slideIndex: 0, textMeasurement, ...options});

describe('direction resolution', () => {
  it('derives the deck direction from the presentation language', () => {
    assert.equal(resolveSlideDirection({language: 'ar', slides: []}), 'rtl');
    assert.equal(resolveSlideDirection({language: 'he', slides: [{}]}, 0), 'rtl');
    assert.equal(resolveSlideDirection({language: 'en', slides: []}), 'ltr');
    assert.equal(resolveSlideDirection({slides: []}), 'ltr');
    assert.equal(resolveSlideDirection(undefined), 'ltr');
    assert.equal(resolveSlideDirection({language: 'ar', slides: [{}]}, 9), 'rtl', 'an out-of-range slide index falls back to the deck');
  });

  it('composes a left-to-right deck exactly as before', () => {
    const presentation = {language: 'en', slides: [{title: 'Title', left: {text: 'Left'}, right: {items: ['One', 'Two']}}]};
    const composed = compose(presentation);
    assert.equal(composed.direction, undefined);
    for (const item of composed.items) assert.equal(item.text?.directions, undefined);
    assert.equal(composed.items.find(item => item.field === 'text').box.x < composed.items.find(item => item.field === 'items').box.x, true);
    assert.equal(composed.items.find(item => item.field === 'items').text.listEntries[0].direction, undefined);
    assert.equal(composeSlide(presentation.slides[0], {presentation: {slides: presentation.slides}, slideIndex: 0}).direction, undefined);
  });

  it('lets the host name the direction explicitly', () => {
    const presentation = {slides: [{title: 'x', text: 'a'}]};
    assert.equal(compose(presentation, presentation.slides[0], {direction: 'rtl'}).direction, 'rtl');
    assert.equal(compose(doc(), doc().slides[0], {direction: 'ltr'}).direction, undefined);
  });
});

describe('mirrored arrangement', () => {
  it('draws the left region at the right and the right region at the left', () => {
    const presentation = doc({}, {left: {text: 'يسار'}, right: {text: 'يمين'}});
    const composed = compose(presentation);
    const [first, second] = ['left', 'right'].map(side => composed.items.find(item => item.path === `slides.0.${side}.text`));
    assert.equal(composed.direction, 'rtl');
    assert.ok(first.box.x > second.box.x, 'the authored left region is the rightmost');
    const mirrored = compose({...presentation, language: 'en'});
    assert.ok(mirrored.items.find(item => item.path === 'slides.0.left.text').box.x < mirrored.items.find(item => item.path === 'slides.0.right.text').box.x);
    // Same sizes, only the places swap.
    assert.equal(first.box.width, mirrored.items.find(item => item.path === 'slides.0.left.text').box.width);
    assert.equal(first.box.x, mirrored.items.find(item => item.path === 'slides.0.right.text').box.x);
  });

  it('puts the first column at the right and keeps the weights with their tracks', () => {
    const slide = {title: 'عنوان', blocks: [{text: 'أ'}, {text: 'ب'}, {text: 'ج'}], composition: {mode: 'row', weights: [3, 1, 1]}};
    const ltr = compose({language: 'en', slides: [slide]}), rtl = compose({language: 'ar', slides: [slide]});
    const boxes = composed => composed.items.filter(item => item.field === 'text' && item.path.includes('blocks')).map(item => item.box);
    const left = boxes(ltr), right = boxes(rtl);
    assert.equal(right[0].width, left[0].width, 'the first column keeps its weight');
    assert.ok(right[0].x > right[1].x && right[1].x > right[2].x, 'columns run right to left');
    const track = rtl.flows[0].columns;
    assert.ok(Math.abs((rtl.flows[0].box.x + track[0].offset) - right[0].x) < 1e-6, 'flow tracks mirror with the boxes');
  });

  it('mirrors a placed image, the cover logo and header/footer zones', () => {
    const presentation = {language: 'ar', organization: {id: 'acme', name: 'Acme', logo: 'logo.png'}, design: {footer: {left: {text: 'يسار'}, right: {text: 'يمين'}}}, slides: [{title: 'x', blocks: [{image: './a.png', placement: {edge: 'left'}}, {text: 'نص'}]}]};
    const composed = compose(presentation);
    const placed = composed.items.find(item => item.field === 'image');
    assert.equal(placed.image.placement.edge, 'right');
    assert.ok(placed.image.region.x > 0);
    const english = compose({...presentation, language: 'en'});
    assert.equal(english.items.find(item => item.field === 'image').image.placement.edge, 'left');
    const parts = composed.furniture.parts.filter(part => part.type === 'text');
    const leftPart = parts.find(part => part.zone === 'left'), rightPart = parts.find(part => part.zone === 'right');
    assert.ok(leftPart.box.x > rightPart.box.x, 'the authored left zone is drawn at the right');
    assert.equal(leftPart.alignment, 'right');
    assert.equal(rightPart.alignment, 'left');
    assert.equal(leftPart.fit.directions, undefined, 'zone alignment is physical');
  });

  it('mirrors cover logos', () => {
    const presentation = {language: 'ar', organization: {id: 'acme', name: 'Acme', logo: 'data:image/png;base64,AAAA'}, slides: [{layout: 'title', title: 'عنوان'}]};
    const layout = {id: 'title', placeholders: [{type: 'title'}]};
    const composed = compose(presentation, presentation.slides[0], {layout});
    assert.equal(composed.logo.anchor, 'right');
    assert.ok(composed.logo.box.x + composed.logo.box.width > composed.width / 2);
    assert.equal(compose({...presentation, language: 'en'}, presentation.slides[0], {layout}).logo.anchor, 'left');
  });
});

describe('paragraph directions and logical alignment', () => {
  it('gives every wrapped line the direction of its paragraph', () => {
    const text = `${arabic} ${'abc '.repeat(12)}`.trim();
    const fit = fitText(text, {x: 0, y: 0, width: 260, height: 1000}, 20, 20, measure, 'rtl');
    assert.ok(fit.lines.length > 2);
    assert.deepEqual(new Set(fit.directions), new Set(['rtl']), 'a Latin-only last line stays right to left');
    const latin = fitText('English paragraph that wraps over several lines in the box', {x: 0, y: 0, width: 160, height: 1000}, 20, 20, measure, 'rtl');
    assert.deepEqual(new Set(latin.directions), new Set(['ltr']), 'a left-to-right paragraph of a right-to-left deck stays left to right, even when a line holds only digits');
    const two = fitText(`${arabic}\nEnglish line\n2026`, {x: 0, y: 0, width: 4000, height: 1000}, 20, 20, measure, 'rtl');
    assert.deepEqual(two.directions, ['rtl', 'ltr', 'rtl'], 'paragraphs between hard breaks decide separately; a paragraph with no strong letter takes the deck direction');
    assert.equal(fitText(text, {x: 0, y: 0, width: 260, height: 1000}, 20, 20, measure).directions, undefined);
  });

  it('reports directions for rich text runs', () => {
    const fit = fitRichText([arabic, {text: ' latin run', bold: true}], {x: 0, y: 0, width: 200, height: 1000}, 20, 20, {style: {fontFamily: 'Base', fontWeight: 400}, textMeasurement, direction: 'rtl'});
    assert.ok(fit.lines.length > 1);
    assert.deepEqual(new Set(fit.directions), new Set(['rtl']));
  });

  it('flips left and right for right-to-left lines only', () => {
    assert.equal(physicalAlignment('left', 'rtl'), 'right');
    assert.equal(physicalAlignment('right', 'rtl'), 'left');
    assert.equal(physicalAlignment('center', 'rtl'), 'center');
    assert.equal(physicalAlignment('left', 'ltr'), 'left');
    assert.equal(physicalAlignment(undefined, undefined), 'left');
    const at = paragraphDirectionAt('أب\nab\n', 'rtl');
    assert.deepEqual([at(0), at(2), at(3), at(5), at(6)], ['rtl', 'rtl', 'ltr', 'ltr', 'rtl']);
    assert.equal(paragraphDirectionAt('أب', 'ltr')(0), 'ltr');
  });

  it('places right-to-left lines at the right edge of a left-aligned item and records the line alignment', () => {
    const lines = [{width: 40, y: 0, baseline: 16, height: 20, outline: null}, {width: 60, y: 20, baseline: 36, height: 20, outline: null}];
    const placed = placeTextLines(lines, {x: 10, y: 0, width: 200, height: 100}, 'left', 0, ['rtl', 'ltr']);
    assert.equal(placed.lines[0].x, 170, 'right edge');
    assert.equal(placed.lines[0].alignment, 'right');
    assert.equal(placed.lines[1].x, 10);
    assert.equal(placed.lines[1].alignment, 'left');
    assert.equal(placeTextLines(lines, {x: 10, y: 0, width: 200, height: 100}, 'left').lines[0].alignment, undefined);
  });

  it('keeps item alignment logical and reports directions on composed text', () => {
    const composed = compose(doc({}, {text: arabic}));
    const body = composed.items.find(item => item.field === 'text');
    assert.equal(body.alignment, 'left');
    assert.ok(body.text.directions.every(direction => direction === 'rtl'));
    const title = composed.items.find(item => item.field === 'title');
    assert.deepEqual(title.text.directions, ['rtl']);
  });

  it('places outline-measured lines at the right edge', () => {
    const measurement = {measure: (text, size) => measure(text, size), outlineBounds: (text, size) => ({x: 0, y: -size * 0.8, width: measure(text, size), height: size})};
    const composed = compose(doc({}, {text: 'نص قصير'}), undefined, {textMeasurement: measurement});
    const body = composed.items.find(item => item.field === 'text');
    const line = body.text.placement.lines[0];
    assert.equal(line.alignment, 'right');
    assert.ok(line.x + line.width <= body.box.x + body.box.width + 0.01);
    assert.ok(line.x + line.width > body.box.x + body.box.width - 3, 'the line ends at the right edge');
  });
});

describe('lists', () => {
  const options = {style: {fontFamily: 'Base', fontWeight: 400, path: 'slides.0.items'}, textMeasurement, direction: 'rtl'};
  const box = {x: 100, y: 20, width: 400, height: 900};

  it('puts markers at the right edge and the text column to their left', () => {
    const fit = fitList(['عنصر أول', {text: 'عنصر ثان', level: 1}, 'English item'], box, 20, 20, options);
    const [first, nested, latin] = fit.listEntries;
    assert.equal(first.direction, 'rtl');
    assert.equal(first.marker.anchor, 'end');
    assert.equal(first.marker.x, box.x + box.width);
    assert.equal(first.textBox.x, box.x);
    assert.equal(first.textBox.width, box.width - first.marker.indent);
    assert.equal(nested.marker.x, box.x + box.width - first.marker.indent, 'a nested marker steps in from the right');
    assert.equal(nested.textBox.width, box.width - 2 * first.marker.indent);
    assert.equal(latin.direction, 'ltr', 'a Latin item keeps the left-to-right layout');
    assert.equal(latin.marker.anchor, undefined);
    assert.equal(latin.marker.x, box.x);
    assert.equal(latin.textBox.x, box.x + latin.marker.indent);
    assert.deepEqual(fit.directions.slice(0, 2), ['rtl', 'rtl']);
  });

  it('mirrors a picture bullet to the right edge', () => {
    const fit = fitList(['عنصر'], box, 20, 20, {...options, bulletImage: {source: 'logo.png', path: 'design.logo'}});
    const entry = fit.listEntries[0];
    assert.equal(entry.bulletBox.x + entry.bulletBox.width, box.x + box.width);
  });

  it('is unchanged without a direction', () => {
    const fit = fitList(['عنصر'], box, 20, 20, {...options, direction: undefined});
    assert.equal(fit.listEntries[0].direction, undefined);
    assert.equal(fit.listEntries[0].marker.x, box.x);
    assert.equal(fit.directions, undefined);
  });

  it('keeps descriptions in the entry column', () => {
    const fit = fitList([{text: 'عنصر', description: 'وصف العنصر'}], box, 20, 20, options);
    const entry = fit.listEntries[0];
    assert.equal(entry.descriptionBox.x, entry.textBox.x);
    assert.equal(entry.descriptionBox.width, entry.textBox.width);
    assert.deepEqual(fit.directions, ['rtl', 'rtl']);
  });
});

describe('tables', () => {
  const table = {columns: ['أ', 'ب', 'ج'], rows: [['1', '2', '3'], [{value: 'Latin'}, 'x', 'y']]};
  const box = {x: 50, y: 50, width: 600, height: 400};

  it('lays the columns out from the right', () => {
    const ltr = layoutTable(table, box), rtl = layoutTable(table, box, {direction: 'rtl'});
    const header = layout => layout.rows[0].cells.map(cell => cell.box.x);
    assert.deepEqual(header(ltr), [50, 250, 450]);
    assert.deepEqual(header(rtl), [450, 250, 50]);
    assert.equal(rtl.rows[0].cells[0].column, 0, 'columns keep their logical index');
    assert.equal(rtl.rows[0].cells[0].direction, 'rtl');
    assert.equal(rtl.rows[2].cells[0].direction, 'ltr', 'a Latin cell is left to right');
    assert.equal(ltr.rows[0].cells[0].direction, undefined);
    assert.equal(ltr.height, rtl.height);
  });

  it('mirrors merged cells inside their span', () => {
    const merged = {columns: ['a', 'b', 'c'], rows: [[{value: 'wide', colSpan: 2}, null, 'c']]};
    const rtl = layoutTable(merged, box, {direction: 'rtl'});
    const wide = rtl.rows[1].cells.find(cell => cell.colSpan === 2);
    assert.equal(wide.box.x, 250);
    assert.equal(wide.box.width, 400);
  });
});

describe('metric and timeline', () => {
  const box = {x: 0, y: 0, width: 400, height: 300};

  it('aligns an Arabic metric to the right and a Latin one to the left', () => {
    const arabicMetric = layoutMetric({value: '12.4', label: 'الإيرادات'}, box, {direction: 'rtl'});
    assert.equal(arabicMetric.alignment, 'right');
    assert.equal(layoutMetric({value: '12.4', label: 'Revenue'}, box, {direction: 'rtl'}).alignment, 'left');
    assert.equal(layoutMetric({value: '12.4', label: 'الإيرادات'}, box).alignment, 'left');
    assert.equal(layoutMetric({value: '12.4', label: 'الإيرادات'}, box, {direction: 'rtl', align: 'center'}).alignment, 'center');
  });

  it('runs a timeline right to left', () => {
    const events = [{when: '2024', what: 'بداية'}, {when: '2025', what: 'نمو'}, {when: '2026', what: 'توسع'}];
    const ltr = layoutTimeline(events, box), rtl = layoutTimeline(events, box, {direction: 'rtl'});
    const xs = layout => layout.markers.map(marker => marker.x);
    assert.ok(xs(ltr)[0] < xs(ltr)[2]);
    assert.ok(xs(rtl)[0] > xs(rtl)[2], 'the first event is at the right');
    assert.ok(rtl.connector.x1 < rtl.connector.x2, 'the connector keeps a positive width');
    const vertical = layoutTimeline(events, {...box, width: 120, height: 400}, {direction: 'rtl'});
    if (vertical.arrangement === 'vertical') assert.ok(vertical.markers[0].x > 60, 'the marker rail is at the right');
  });
});

describe('furniture', () => {
  it('derives its direction like composition', () => {
    const presentation = {language: 'ar', design: {footer: {left: {text: 'يسار'}}}, slides: [{title: 'x'}]};
    const layout = layoutFurniture(presentation.slides[0], {presentation, slideIndex: 0});
    assert.equal(layout.parts[0].zone, 'left');
    assert.equal(layout.parts[0].alignment, 'right');
    assert.ok(layout.parts[0].box.x > 640);
  });
});
