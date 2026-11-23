// LH-115 follow-up (0.35.1) in the preview: a bar chart on the rows of a short table draws its parts together. The value axis title sits
// right under the tick labels, not at the foot of the chart box, and the chart's caption stands on the table's top line. Core decides the
// header and the rows (composition.ts); this asserts what the preview draws from them.
import assert from 'node:assert/strict';
import { toSvg } from './catalog-harness.mjs';

const attributesOf = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const texts = (svg) => [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map(([, a, body]) => ({ ...attributesOf(a), body: body.replace(/<[^>]*>/g, '').trim() }));
const rects = (svg) => [...svg.matchAll(/<rect\b([^>]*)>/g)].map(([, a]) => attributesOf(a));
const deck = (count) => ({
  design: { fontScheme: 'roboto', colorScheme: 'cool-horizon', variant: 'light1' },
  datasets: { taskTimes: { columns: ['Prototype', 'Minutes'], rows: [['Prototype A', 5.8], ['Prototype B', 6.7], ['Prototype C', 4.9], ['Prototype D', 7.3]].slice(0, count) } },
  slides: [{
    title: 'Compare the two prototypes', subtitle: 'Illustrative data · median task time, minutes',
    chart: { type: 'bar', data: { dataset: 'taskTimes' }, axisTitles: { category: 'Prototype', value: 'Median task time (min)' }, dataLabels: { content: ['value'] } },
    table: { dataset: 'taskTimes' },
  }],
});
let checks = 0;

for (const count of [2, 4]) {
  const svg = toSvg(deck(count), 1, { trace: true });
  const all = texts(svg);
  const title = all.find((entry) => entry['data-opf-path'] === 'slides.0.chart.axisTitles.value');
  assert.ok(title, `${count}: the value axis title is drawn`);
  const ticks = all.filter((entry) => entry['data-opf-path'] === 'slides.0.chart' && /^\d+$/.test(entry.body));
  assert.ok(ticks.length >= 2, `${count}: tick labels`);
  const tickY = Math.max(...ticks.map((entry) => Number(entry.y))), titleY = Number(title.y);
  // One line under the tick labels (the chart text line is 1.5 text sizes, about 28 px here), not the foot of a 4:3 box.
  assert.ok(titleY > tickY && titleY - tickY < 45, `${count}: the title ${titleY} sits right under the tick labels ${tickY}`);
  const caption = all.find((entry) => entry.body === 'Median task time (min) by prototype');
  assert.ok(caption, `${count}: the caption is drawn`);
  // The table's header row is its topmost filled rect on the table's path.
  const header = rects(svg).filter((rect) => (rect['data-opf-path'] ?? '').startsWith('slides.0.table') && rect.fill && rect.fill !== 'none').sort((a, b) => Number(a.y) - Number(b.y))[0];
  assert.ok(header, `${count}: the table's header row`);
  assert.ok(Number(caption.y) > Number(header.y) && Number(caption.y) < Number(header.y) + Number(header.height), `${count}: the caption ${caption.y} stands on the table's header row ${header.y}`);
  checks += 5;
}

console.log(`chart-rows-together: ${checks} checks passed`);
