// RR-105 finding 30: a chart that is the slide's only body fills a portrait body up to 2:3, centered.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide, CHART_LONE_MAX_HEIGHT_RATIO} from '../dist/composition.js';

const charts = (slide, width = 1280, height = 720) => composeSlide(slide, {width, height}).items.filter((item) => item.field === 'chart');

for (const [name, width, height] of [['9:16', 720, 1280], ['4:5', 720, 900], ['1:1', 720, 720], ['4:3', 960, 720], ['16:9', 1280, 720]]) {
  test(`${name}: a lone chart fills its body up to 2:3 portrait, centered`, () => {
    const slide = {title: 'Volume rose every quarter', chart: {type: 'column', data: {columns: ['Quarter', 'Containers'], rows: [['Q1', 210], ['Q2', 236], ['Q3', 251], ['Q4', 274]]}}};
    const result = composeSlide(slide, {width, height}), item = result.items.find((entry) => entry.field === 'chart');
    const title = result.items.find((entry) => entry.field === 'title');
    assert.ok(item.box.height <= item.box.width * CHART_LONE_MAX_HEIGHT_RATIO + 0.01, JSON.stringify(item.box));
    // The body under the title: the chart either fills it or stops at 2:3 and stands in its middle.
    const top = title.box.y + title.box.height;
    if (item.box.height < item.box.width * CHART_LONE_MAX_HEIGHT_RATIO - 0.5) assert.ok(item.box.height > (height - top) * 0.6, `${name} fills its body: ${JSON.stringify(item.box)}`);
    else {
      const above = item.box.y - top, below = height - (item.box.y + item.box.height);
      assert.ok(above > 0 && below > 0 && Math.abs(above - below) < height * 0.1, JSON.stringify(item.box));
    }
  });
}

test('9:16: the lone chart is 2:3 and centered between the title and the slide margin', () => {
  const lone = charts({title: 'Volume rose every quarter', chart: {type: 'column', data: {columns: ['Quarter', 'Containers'], rows: [['Q1', 210], ['Q2', 236], ['Q3', 251], ['Q4', 274]]}}}, 720, 1280)[0];
  assert.ok(Math.abs(lone.box.height / lone.box.width - 1.5) < 0.001, JSON.stringify(lone.box));
  assert.ok(lone.box.height > 1280 * 0.6, 'more than the top half of the slide');
});
