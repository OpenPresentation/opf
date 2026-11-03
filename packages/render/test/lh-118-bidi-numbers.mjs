// LH-117, LH-118, LH-120 in the preview: a column of numbers written as text is drawn at the end of its cells; a signed or percent number
// in right-to-left text is a left-to-right isolate ("+16%", not "16%+"); the English trend word is drawn only in an English deck (the arrow
// takes its place elsewhere); and a bar chart's category labels wrap onto two lines before they are ellipsized.
import assert from 'node:assert/strict';
import { toSvg } from './catalog-harness.mjs';

const LRI = String.fromCharCode(0x2066), PDI = String.fromCharCode(0x2069);
const attributesOf = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const texts = (svg) => [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map(([, a, body]) => ({ ...attributesOf(a), raw: body, body: body.replace(/<[^>]*>/g, '') }));
let checks = 0;

// LH-118: a right-to-left metric value, delta and table cells isolate their signed numbers; bare digits are left alone.
{
  const deck = { language: 'ar', design: { fontScheme: 'roboto' }, slides: [{ title: 'أداء المبيعات', blocks: [
    { metric: { value: '+16%', label: 'نمو المبيعات السنوي', delta: '+8 نقاط', trend: 'up' } },
    { table: { columns: ['المنطقة', 'التغير'], rows: [['الخليج', '+3%'], ['مصر', '-2.5%']] } },
    { text: 'تدريب 1,200 موظف' },
  ] }] };
  const svg = toSvg(deck, 1, { trace: true });
  const all = texts(svg);
  const raw = (path) => all.filter((entry) => entry['data-opf-path'] === path).map((entry) => entry.body).join('|');
  assert.ok(raw('slides.0.blocks.0.metric.value').includes(`${LRI}+16%${PDI}`), 'the metric value is a left-to-right isolate');
  assert.ok(raw('slides.0.blocks.0.metric.delta').includes(`${LRI}+8${PDI}`), 'the delta number is a left-to-right isolate');
  assert.ok(svg.includes(`${LRI}+3%${PDI}`) && svg.includes(`${LRI}-2.5%${PDI}`), 'numeric table cells are isolates');
  assert.ok(!svg.includes(`${LRI}1,200`), 'bare digits are not isolated');
  // The trend word (English) is not drawn in an Arabic deck; the arrow still is.
  assert.equal(all.filter((entry) => entry['data-opf-path'] === 'slides.0.blocks.0.metric.trend').length, 0, 'no trend word');
  assert.match(svg, /aria-label="Trend: up"/);
  checks += 6;
}

// A left-to-right deck draws no isolate and keeps its trend word.
{
  const svg = toSvg({ design: { fontScheme: 'roboto' }, slides: [{ title: 'Growth', metric: { value: '+16%', label: 'Annual growth', trend: 'up' } }] }, 1, { trace: true });
  assert.ok(!svg.includes(LRI), 'no isolate left to right');
  assert.equal(texts(svg).filter((entry) => entry['data-opf-path'] === 'slides.0.metric.trend').map((entry) => entry.body.trim()).join(''), 'up');
  checks += 2;
}

// LH-117: the cells (and header) of a column of numbers written as text end at the cell's right edge.
{
  const svg = toSvg({ design: { fontScheme: 'roboto' }, slides: [{ title: 'Pricing', table: { columns: ['Region', 'Price', 'Status'], rows: [['North', '$42', 'Hold'], ['South', '$38', '+3%']] } }] }, 1, { trace: true });
  const anchors = (column) => texts(svg).filter((entry) => /^slides\.0\.table\.(columns|rows\.\d+)\.\d+$/.test(entry['data-opf-path'] ?? '') && entry['data-opf-path'].endsWith(`.${column}`)).map((entry) => entry['text-anchor']);
  assert.ok(anchors(1).length === 3 && anchors(1).every((anchor) => anchor === 'end'), `price column: ${anchors(1)}`);
  assert.ok(anchors(2).every((anchor) => anchor !== 'end'), `status column (one number in two): ${anchors(2)}`);
  checks += 2;
}

// LH-120: a bar label too wide for its gutter wraps onto two lines at a space before it is ellipsized, even where its row is shorter
// than two full lines.
{
  const slide = { title: 'Why customers churn', composition: { weights: [1, 1, 1] }, blocks: [
    { items: ['Low product usage in the first 90 days', 'Slow response on critical tickets', 'Price increase without notice'] },
    { chart: { type: 'bar', data: { columns: ['Driver', 'Share (%)'], rows: [['Low usage', 34], ['Support delays', 24], ['Price', 19], ['Integrations', 14], ['Champion left the account', 9]] } } },
    { quote: { text: 'We did not leave over a feature. We left because nobody called.', attribution: 'Exit interview' } },
  ] };
  const svg = toSvg({ design: { fontScheme: 'roboto' }, slides: [slide] }, 1, { trace: true });
  const labels = texts(svg).filter((entry) => /^slides\.0\.blocks\.1\.chart\.data\.rows\.\d+\.0$/.test(entry['data-opf-path'] ?? '')).map((entry) => entry.body);
  assert.ok(labels.join(' ').includes('Integrations'), `the longest word fits its gutter: ${labels}`);
  assert.ok(!labels.some((label) => label.includes('…') && !label.startsWith('Champion')), `only a label longer than two lines is ellipsized: ${labels}`);
  assert.ok(labels.length > 5, `a label wraps onto a second line: ${labels}`);
  checks += 3;
}

console.log(`LH-117/118/120 preview passed: ${checks} checks (bidi-safe numbers, trend word only in English, numeric columns end-aligned, bar labels wrap).`);
