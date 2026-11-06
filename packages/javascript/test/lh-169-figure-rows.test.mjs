// LH-169: a list whose entries each lead with a short figure and carry a description draws as a row of figures (metrics): the figure
// bold in the accent at display size over an accent rule, its label under it at the size the list drew it. LH-170: a lone short note
// that closes the body (a `verdict` region's text, or the paragraph after a row of figures) draws as the full-width band on the emphasis
// surface under the body. Left to right and right to left; lists and notes that must not change, as they are on main.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { composeSlide, EMPHASIS_NOTE_LINES, figureList, figureText } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

const compose = (slide, language = 'en') => {
  const context = resolveSlideContext({ name: 'LH-169', language, slides: [slide] }, 0, { catalogs: [gallery] });
  return composeSlide(context.slide, context.options);
};
const item = (result, path) => result.items.find((entry) => entry.path === `slides.0.${path}`);
const lineCount = (fit) => ('richLines' in fit ? fit.richLines.length : fit.lines.length);

const TEXT = {
  en: {
    title: 'Field technicians lose an hour a day to paperwork',
    figures: [['62 minutes a day', 'Average time technicians spend on forms after each visit'], ['1 in 6 reports', 'Sent back for missing details, which doubles the effort'], ['9 days', 'Typical delay before a completed job can be invoiced']],
    mixed: [['62 minutes a day', 'Average time spent on forms'], ['Paper forms', 'Still used at four of nine depots'], ['9 days', 'Typical delay before invoicing']],
    note: 'Replace the paper forms with a mobile checklist that fills in the customer, the parts and the photos automatically. Technicians finish the report on site in about twelve minutes, and the office invoices the same day.',
    pros: ['Frees about $3.2M of capital tied up in the building', 'Peak-season capacity without temporary hiring', 'Operator already runs the carriers we use'],
    cons: ['Per-order cost rises about 6% in year one', 'Less control over packing quality', 'Exit takes six months and a transition fee'],
    labels: ['Pros', 'Cons'],
    verdict: 'Recommendation: negotiate a two-year term with exit rights before committing.',
  },
  ar: {
    title: 'يخسر الفنيون ساعة يوميًا في الأعمال الورقية',
    figures: [['٦٢ دقيقة يوميًا', 'متوسط الوقت المستغرق في النماذج بعد كل زيارة'], ['١ من ٦ تقارير', 'يُعاد لنقص التفاصيل فيتضاعف الجهد'], ['٩ أيام', 'التأخير المعتاد قبل إصدار الفاتورة']],
    mixed: [['٦٢ دقيقة يوميًا', 'متوسط الوقت المستغرق في النماذج'], ['النماذج الورقية', 'ما زالت مستخدمة في أربعة مستودعات'], ['٩ أيام', 'التأخير المعتاد قبل الفوترة']],
    note: 'استبدلوا النماذج الورقية بقائمة تحقق على الهاتف تملأ بيانات العميل والقطع والصور تلقائيًا، فينهي الفني التقرير في الموقع خلال اثنتي عشرة دقيقة تقريبًا.',
    pros: ['يحرر نحو ٣٫٢ مليون دولار من رأس المال', 'سعة إضافية في موسم الذروة', 'المشغّل يعمل بالفعل مع شركات النقل لدينا'],
    cons: ['ترتفع تكلفة الطلب نحو ٦٪ في السنة الأولى', 'تحكم أقل في جودة التغليف', 'الخروج يستغرق ستة أشهر ورسوم انتقال'],
    labels: ['المزايا', 'العيوب'],
    verdict: 'التوصية: التفاوض على عقد لمدة عامين مع حق الخروج قبل الالتزام.',
  },
};
const entries = (pairs) => pairs.map(([text, description]) => ({ text, description }));

test('LH-169: a figure is a short number with its unit; steps, clock times, years, dates and sentences are not', () => {
  for (const text of ['62 minutes a day', '1 in 6 reports', '9 days', '$3.2M', '+12%', '~40 ms', '€18.4M revenue', '99.98%', '٦٢ دقيقة يوميًا', '١ من ٦ تقارير'])
    assert.equal(figureText(text), true, text);
  for (const text of ['Paper forms', '1. Kickoff', '2) Build', '9:00 Welcome', '2019', '2019 launch', '2024–2026', '12 May', '3rd March', 'Twelve days', '62 minutes a day spent on forms', '9 days.', ''])
    assert.equal(figureText(text), false, text);
  assert.equal(figureList(entries(TEXT.en.figures)), true);
  // Every entry a figure with its label; 2 to 4 of them.
  assert.equal(figureList(entries(TEXT.en.mixed)), false, 'only some entries lead with a figure');
  assert.equal(figureList(['$3.2M', '12%', '9 days']), false, 'figures without labels stay a list');
  assert.equal(figureList(entries(TEXT.en.figures.slice(0, 1))), false, 'one figure is a metric, not a row');
  assert.equal(figureList(entries([...TEXT.en.figures, ...TEXT.en.figures])), false, 'more than four figures stay a list');
  assert.equal(figureList([{ text: '9 days', description: 'Delay' }, { text: '3 weeks', description: 'Setup', level: 1 }]), false, 'a nested entry');
});

for (const language of ['en', 'ar']) {
  const text = TEXT[language], rtl = language === 'ar';
  test(`LH-169 with LH-170: a row of figures and the note beside it (n15, ${language})`, () => {
    const result = compose({ layout: 'two-column', title: text.title, blocks: [{ items: entries(text.figures) }, { text: text.note }] }, language);
    const list = item(result, 'blocks.0.items'), note = item(result, 'blocks.1.text');
    // LH-170: the paragraph beside the figures is the band at the foot of the body, on the emphasis surface, across the body.
    assert.equal(result.emphasis?.source, 'foot-band');
    assert.equal(result.emphasis.path, 'slides.0.blocks.1');
    assert.equal(note.emphasis, true);
    assert.ok(lineCount(note.text) <= EMPHASIS_NOTE_LINES);
    assert.ok(Math.abs(result.emphasis.box.x - result.contentBox.x) < 1 && Math.abs(result.emphasis.box.width - result.contentBox.width) < 1, 'the band spans the body');
    assert.ok(note.text.fontSize >= 28 - 1e-6, 'the note keeps its size');
    // LH-169: the list is a row of three columns across the body, each one figure over its label.
    assert.equal(list.listColumns?.length, 3);
    assert.ok(list.box.width > result.contentBox.width * 0.9, 'the row takes the body width once the note leaves the column beside it');
    const columns = [...list.listColumns].sort((a, b) => a.box.x - b.box.x);
    assert.deepEqual(list.listColumns.map((column) => column.start), [0, 1, 2]);
    assert.deepEqual(columns.map((column) => column.start), rtl ? [2, 1, 0] : [0, 1, 2], 'reading order, from the right in a right-to-left deck');
    const figures = list.listColumns.map((column) => column.text.listEntries[0]);
    assert.ok(figures.every((entry) => entry.accent && entry.heading), 'each figure is an accent heading');
    assert.ok(figures.every((entry) => entry.text.richLines.length === 1), 'every figure on one line (LH-39)');
    assert.equal(new Set(figures.map((entry) => entry.text.fontSize)).size, 1, 'one figure size for the row (LH-157)');
    assert.ok(figures[0].text.fontSize > list.text.fontSize, 'the figure reads above the list size');
    assert.ok(figures.every((entry) => Math.abs(entry.description.fontSize - list.text.fontSize * 0.82) < 0.05), 'each label at the size the list draws its descriptions');
    assert.equal(list.text.rules?.filter((rule) => rule.accent).length, 3, 'an accent rule over each figure');
    assert.ok(list.text.fontSize >= 32 - 1e-6, 'the list keeps its size');
    assert.deepEqual(figures.map((entry) => [entry.textPath, entry.descriptionPath]), [0, 1, 2].map((index) => [`slides.0.blocks.0.items.${index}.text`, `slides.0.blocks.0.items.${index}.description`]));
    assert.ok(list.box.y + list.box.height <= result.emphasis.box.y, 'the row sits above the band');
  });

  test(`LH-169: a list where only some entries lead with a figure stays a list (${language})`, () => {
    const result = compose({ title: text.title, blocks: [{ items: entries(text.mixed) }] }, language);
    assert.equal(item(result, 'blocks.0.items').listColumns, undefined);
  });

  test(`LH-170: a comparison's verdict is the band; a long one stays text (n18, ${language})`, () => {
    const column = (region, label, bullets) => ({ region, composition: { mode: 'column' }, blocks: [{ text: [{ text: label, bold: true }] }, { bullets }] });
    const slide = (verdict) => ({ layout: 'comparison', title: text.title, blocks: [column('first', text.labels[0], text.pros), column('second', text.labels[1], text.cons), { region: 'verdict', text: verdict }] });
    const result = compose(slide(text.verdict), language), verdict = item(result, 'blocks.2.text');
    assert.equal(result.emphasis?.source, 'foot-band');
    assert.equal(verdict.emphasis, true);
    assert.ok(verdict.text.fontSize >= 28 - 1e-6);
    assert.ok(result.emphasis.box.y >= result.contentBox.y + result.contentBox.height - 1e-6, 'the band sits under the body');
    for (const entry of [item(result, 'blocks.0.blocks.1.bullets'), item(result, 'blocks.1.blocks.1.bullets')]) assert.ok(entry.box.y + entry.box.height <= result.emphasis.box.y, 'the lists sit above the band');
    const long = compose(slide(Array.from({ length: 5 }, () => text.verdict).join(' ')), language);
    assert.equal(long.emphasis, undefined, `a verdict longer than ${EMPHASIS_NOTE_LINES} lines across the band stays text`);
  });
}

test('LH-170: the note after a row of metrics is the band; a long one stays text, and a featured pair keeps its card', () => {
  const metrics = [{ metric: { value: '52', label: 'Trial participants' } }, { metric: { value: '84%', label: 'Task completion' } }, { metric: { value: '6.2 min', label: 'Median task time' } }];
  const short = compose({ layout: 'metrics', title: 'Pilot outcomes in three measures', blocks: [...metrics, { text: 'Test with two teams for six weeks. Measure task completion and time before deciding what to scale.' }] });
  assert.equal(short.emphasis?.source, 'foot-band');
  assert.equal(short.emphasis.path, 'slides.0.blocks.3');
  const paragraph = Array.from({ length: 4 }, () => 'The pilot ran for six weeks with two teams in two regions, and the teams asked to keep the checklist after it ended.').join(' ');
  assert.equal(compose({ layout: 'metrics', title: 'Pilot outcomes', blocks: [...metrics, { text: paragraph }] }).emphasis, undefined);
  // One metric is no row of figures: its note stays text.
  assert.equal(compose({ layout: 'metrics', title: 'Pilot outcomes', blocks: [metrics[0], { text: 'Test with two teams for six weeks, then measure task completion and time before deciding what to scale.' }] }).emphasis, undefined);
  // An author's `emphasis: false` keeps the note as text.
  assert.equal(compose({ layout: 'metrics', title: 'Pilot outcomes', blocks: [...metrics, { text: 'Test with two teams for six weeks.', emphasis: false }] }).emphasis, undefined);
  // n17: a before and after pair keeps its featured card; the verdict under it stays text (one surface a slide).
  const pair = compose({ layout: 'comparison', title: 'Contract turnaround, before and after e-signature', blocks: [
    { region: 'first', composition: { mode: 'column' }, blocks: [{ text: [{ text: 'Before', bold: true }] }, { metric: { value: '11 days', label: 'From quote to signed contract', description: 'Printed, signed and scanned by hand' } }] },
    { region: 'second', composition: { mode: 'column' }, blocks: [{ text: [{ text: 'After', bold: true }] }, { metric: { value: '3 days', label: 'From quote to signed contract', description: 'Standard templates and electronic signature', delta: '-8 days', trend: 'down', sentiment: 'positive' } }] },
    { region: 'verdict', text: 'Standard legal templates and e-signature removed eight days from every deal.' }] });
  assert.equal(pair.emphasis?.source, 'featured');
});

test('LH-169: steps, years and figures without labels stay lists', () => {
  for (const blocks of [
    [{ items: [{ text: '1. Kickoff', description: 'Agree goals and owners' }, { text: '2. Build', description: 'Set up accounts and data' }, { text: '3. Launch', description: 'Train teams and go live' }] }],
    [{ items: [{ text: '2019', description: 'Founded in Lisbon' }, { text: '2022', description: 'Opened the Berlin office' }, { text: '2025', description: 'Reached 400 customers' }] }],
    [{ bullets: ['$3.2M', '12%', '9 days'] }],
    [{ items: entries(TEXT.en.figures), numbering: { style: 'arabic' } }],
  ]) {
    const result = compose({ title: 'Lists', blocks });
    assert.equal(result.items.find((entry) => entry.field === 'items' || entry.field === 'bullets').listColumns, undefined, JSON.stringify(blocks).slice(0, 60));
  }
});
