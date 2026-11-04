// LH-133 (questions and terms as ruled rows, a grid of short questions under accent rules) and LH-134 (numerals beside a few takeaways,
// an agenda as numbered ruled rows), left to right and right to left.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  composeSlide, fitList, LIST_NUMERAL_GAP, LIST_NUMERAL_SCALE, LIST_ROWS_LABEL_SHARE, NUMERAL_TAKEAWAYS, PAIR_GRID_MIN, pairEntry, questionText, STEP_BADGE,
} from '../dist/composition.js';
import {layouts} from './support/template-samples.mjs';

const {agenda, faq, list: listLayout} = layouts;
const style = {fontFamily: 'sans-serif', fontWeight: 400};
const lists = composed => composed.items.filter(item => item.field === 'items');
const qa = (text, description) => ({region: 'questions', items: [{text, description}]});
const PILOT = [
  qa('How long does the pilot last?', 'Twelve weeks, starting the first Monday of March.'),
  qa('What does it cost?', 'The pilot is free. Pricing starts only after you decide to continue.'),
  qa('Which systems does it connect to?', 'Salesforce, HubSpot, NetSuite and any system with a REST API.'),
  qa('Who owns our data?', 'You do. It stays in your region and is deleted within 30 days on request.'),
  qa('What happens if we stop?', 'You keep every export and report, and nothing renews automatically.'),
];
const RETURNS = [
  qa('How long do I have?', '45 days from delivery.'), qa('Is return shipping free?', 'Yes, in the United States and Canada.'),
  qa('When is my refund?', 'Two business days after inspection.'), qa('Can I exchange instead?', 'Yes, choose exchange in the app.'),
  qa('What if it arrived damaged?', 'Send a photo and we replace it.'), qa('Do gift returns work?', 'Recipients get store credit.'),
];
const TERMS = [
  {text: 'ARR', description: 'Annual recurring revenue: the yearly value of active subscriptions.'},
  {text: 'Churn', description: 'The share of customers who cancel in a period.'},
  {text: 'CAC payback', description: 'Months of gross margin needed to earn back the cost of winning a customer.'},
  {text: 'SLA', description: 'Service level agreement: the uptime and response times we commit to.'},
];
const TAKEAWAYS = [
  {text: 'Triage by severity cut the support backlog by 41%', description: 'Premium accounts gained the most.'},
  {text: 'Guided setup halved the time to first value', description: 'From 21 days to 9.'},
  {text: 'Regional pricing adds $2.1M next year', description: 'Two regions where we trail competitors.'},
];
// The right-to-left tests draw Arabic content, whose paragraphs run right to left.
const ARABIC = {
  PILOT: [qa('كم تستمر التجربة؟', 'اثنا عشر أسبوعا تبدأ في أول يوم اثنين من مارس.'), qa('كم تكلف؟', 'التجربة مجانية، ويبدأ التسعير بعد قرار الاستمرار.'), qa('من يملك بياناتنا؟', 'أنتم. تبقى في منطقتكم وتحذف خلال ثلاثين يوما عند الطلب.'), qa('ماذا يحدث إذا توقفنا؟', 'تحتفظون بكل التقارير ولا يتجدد شيء تلقائيا.')],
  RETURNS: [qa('كم لدي من الوقت؟', 'خمسة وأربعون يوما.'), qa('هل الشحن مجاني؟', 'نعم داخل البلاد.'), qa('متى أسترد المبلغ؟', 'بعد يومين من الفحص.'), qa('هل يمكنني الاستبدال؟', 'نعم من التطبيق.'), qa('ماذا لو وصل تالفا؟', 'أرسل صورة ونستبدله.'), qa('هل تصلح الهدايا؟', 'يحصل المستلم على رصيد.')],
  TERMS: [{text: 'الإيراد', description: 'القيمة السنوية للاشتراكات النشطة.'}, {text: 'التسرب', description: 'نسبة العملاء الذين يلغون في فترة.'}, {text: 'الهامش', description: 'الإيراد مطروحا منه تكلفة تقديم الخدمة.'}],
  TAKEAWAYS: [{text: 'خفض الفرز حسب الخطورة تراكم الدعم', description: 'استفادت الحسابات المميزة أكثر.'}, {text: 'الإعداد الموجه قلص وقت الوصول إلى القيمة', description: 'من 21 يوما إلى 9.'}, {text: 'التسعير الإقليمي يضيف 2.1 مليون', description: 'منطقتان نتأخر فيهما.'}],
  AGENDA: [{text: 'أين نقف', description: 'نتائج الأشهر التسعة الأولى'}, {text: 'ما الذي تغير', description: 'العوامل وراء الأرقام'}, {text: 'خطة 2027', description: 'ثلاث رهانات وميزانياتها'}],
};
const AGENDA = [
  {text: 'Where we stand', description: 'Results from the first nine months'},
  {text: 'What changed', description: 'The drivers behind the numbers'},
  {text: 'The 2027 plan', description: 'Three bets and their budgets'},
];

test('LH-133: questions and terms are read from content, in any script', () => {
  for (const text of ['How long does it last?', '¿Cuánto cuesta?', 'كم تكلف؟', '費用はいくらですか？', 'Is it “free?”']) assert.equal(questionText(text), true, text);
  for (const text of ['How long it lasts', 'Who? We do.', '', 'Line one?\nLine two?']) assert.equal(questionText(text), false, text);
  assert.equal(pairEntry({text: 'Who owns our data?', description: 'You do.'}), 'question');
  assert.equal(pairEntry({text: 'CAC payback', description: 'Months to earn back acquisition cost.'}), 'term');
  assert.equal(pairEntry({text: 'An explicit decision', description: 'Agree the evidence.'}), 'label');
  assert.equal(pairEntry({text: 'Who owns our data?'}), undefined, 'no answer, no pair');
  assert.equal(pairEntry({text: 'Churn', description: 'Cancellations.', level: 1}), undefined, 'a nested entry is no pair');
});

test('LH-133: fitList sets questions in a column of LIST_ROWS_LABEL_SHARE, terms in the accent, sibling labels in one column', () => {
  const box = {x: 0, y: 0, width: 1000, height: 600};
  const questions = fitList([{text: 'Who owns our data?', description: 'You do.'}, {text: 'What does it cost?', description: 'Nothing.'}], box, 28, 16, {style, rows: true, pairs: 'question'});
  for (const entry of questions.listEntries) {
    assert.equal(entry.textBox.width, LIST_ROWS_LABEL_SHARE * box.width);
    assert.ok(entry.descriptionBox.x >= LIST_ROWS_LABEL_SHARE * box.width, 'the answer beside its question');
    assert.equal(entry.accent, undefined);
  }
  const terms = fitList(TERMS, box, 28, 16, {style, rows: true, pairs: 'term'});
  assert.ok(terms.listEntries.every(entry => entry.accent === true));
  assert.equal(terms.rules.length, TERMS.length - 1);
  // One entry is a row when its column is shared: measured over every sibling label, its answer at the list size.
  const one = fitList([TERMS[0]], box, 28, 16, {style, rows: true, rowLabels: TERMS.map(term => term.text)});
  const all = fitList(TERMS, box, 28, 16, {style, rows: true});
  assert.equal(one.listEntries[0].descriptionBox.x, all.listEntries[0].descriptionBox.x, 'the same answer column');
  assert.equal(one.listEntries[0].description.fontSize, one.fontSize, 'the answer keeps the list size');
  assert.equal(one.listEntries[0].heading, undefined, 'not a heading list');
});

for (const direction of ['ltr', 'rtl']) {
  const rtl = direction === 'rtl', language = rtl ? ARABIC : {PILOT, RETURNS, TERMS, TAKEAWAYS, AGENDA};
  test(`LH-134 (${direction}): fitList draws numerals in a column at the start of each row`, () => {
    const box = {x: 100, y: 0, width: 1000, height: 600}, size = 30;
    const display = fitList(language.TAKEAWAYS, box, size, 16, {style, rows: true, numbering: 'arabic', numerals: 'display', direction});
    for (const [index, entry] of display.listEntries.entries()) {
      const {badge} = entry;
      assert.equal(badge.label, String(index + 1));
      assert.equal(badge.fontSize, size * LIST_NUMERAL_SCALE);
      assert.equal(entry.marker.none, true, 'no marker beside the numeral');
      assert.equal(entry.marker.number.value, index + 1, 'the number is kept');
      // At the start of the row, the text one column and LIST_NUMERAL_GAP em further.
      if (rtl) { assert.ok(Math.abs(badge.numeral.x + badge.numeral.width - (box.x + box.width)) < 1e-6); assert.ok(entry.textBox.x + entry.textBox.width <= badge.numeral.x - size * LIST_NUMERAL_GAP + 1e-6); }
      else { assert.equal(badge.numeral.x, box.x); assert.ok(entry.textBox.x >= badge.numeral.x + badge.numeral.width + size * LIST_NUMERAL_GAP - 1e-6); }
      // The top of the digits (0.7 em) on the label's capitals: the numeral reaches below the label.
      const labelBaseline = entry.textBox.y + entry.text.richLines[0].baseline, numeralBaseline = badge.cy + .35 * badge.fontSize;
      assert.ok(Math.abs((numeralBaseline - .7 * badge.fontSize) - (labelBaseline - .7 * size)) < 1e-6);
    }
    assert.equal(display.rules.length, language.TAKEAWAYS.length - 1);
    const single = fitList(['One', 'Two'], box, size, 16, {style, rows: true, numbering: 'arabic', numerals: 'display', direction});
    assert.equal(single.listEntries[0].badge.fontSize, size * STEP_BADGE, 'a takeaway of one paragraph: a badge-sized numeral');
    const row = fitList(language.AGENDA, box, size, 16, {style, rows: true, numbering: 'arabic', numerals: 'row', direction});
    assert.deepEqual(row.listEntries.map(entry => entry.badge.label), ['01', '02', '03']);
    for (const entry of row.listEntries) {
      assert.ok(Math.abs(entry.badge.cy + .35 * entry.badge.fontSize - (entry.textBox.y + entry.text.richLines[0].baseline)) < 1e-6, 'on the label baseline');
      assert.ok(rtl ? entry.descriptionBox.x + entry.descriptionBox.width <= entry.textBox.x : entry.descriptionBox.x >= entry.textBox.x + entry.textBox.width, 'the description in a second column');
    }
  });

  test(`LH-133 (${direction}): one-question blocks of a FAQ stack as ruled rows, their answers in one column`, () => {
    const composed = composeSlide({title: 'Frequently asked questions', blocks: language.PILOT}, {layout: faq, direction});
    const items = lists(composed);
    assert.equal(items.length, language.PILOT.length, 'every block drawn');
    assert.equal(new Set(items.map(item => item.box.x)).size, 1, 'one column');
    assert.equal(new Set(items.map(item => item.text.listEntries[0].descriptionBox.x)).size, 1, 'the answers share one edge');
    for (const item of items) {
      const [entry] = item.text.listEntries;
      assert.ok(rtl ? entry.descriptionBox.x < entry.textBox.x : entry.descriptionBox.x > entry.textBox.x, 'the answer beside the question, after it in reading order');
      assert.equal(entry.description.fontSize, item.text.fontSize, 'question and answer at one size');
    }
    const rules = items.flatMap(item => item.text.rules ?? []);
    assert.equal(rules.length, language.PILOT.length - 1, 'a hairline between two rows');
    assert.ok(rules.every(rule => !rule.accent));
    // Between the rows: under the text above, over the text below.
    const sorted = [...items].sort((a, b) => a.box.y - b.box.y);
    for (let index = 1; index < sorted.length; index++) {
      const [rule] = sorted[index].text.rules, above = sorted[index - 1].text.listEntries[0];
      assert.ok(rule.y > Math.max(above.textBox.y + above.textBox.height, above.descriptionBox.y + above.descriptionBox.height) && rule.y < sorted[index].box.y);
    }
    // The size guard: no block reads smaller than the grid the region drew before (its answers were the list size).
    const grid = composeSlide({title: 'Frequently asked questions', blocks: language.PILOT.map(block => ({...block, items: [{...block.items[0], text: block.items[0].text.replace(/[?؟]$/u, '')}]}))}, {layout: faq, direction});
    assert.ok(lists(grid).every(item => item.text.rules === undefined), 'without question marks: the grid the region drew before');
    assert.ok(Math.min(...items.map(item => item.text.fontSize)) >= Math.min(...lists(grid).map(item => item.text.fontSize)) - 1e-6);
  });

  test(`LH-133 (${direction}): ${PAIR_GRID_MIN} or more short questions stay a grid, each cell under an accent rule`, () => {
    const items = lists(composeSlide({title: 'Questions we hear about returns', blocks: language.RETURNS}, {layout: faq, direction}));
    assert.ok(new Set(items.map(item => item.box.x)).size > 1, 'a grid');
    for (const item of items) {
      assert.equal(item.text.rules.length, 1);
      const [rule] = item.text.rules, top = item.text.listEntries[0].textBox.y;
      assert.equal(rule.accent, true);
      assert.ok(Math.abs(rule.x - item.box.x) < .01 && Math.abs(rule.width - item.box.width) < .01, 'across its cell');
      assert.ok(rule.y < top, 'over its cell');
      assert.equal(item.text.listEntries[0].heading, true, 'each cell keeps its question as a heading');
    }
  });

  test(`LH-133 (${direction}): a lone list of terms is a glossary, its terms in the accent`, () => {
    const [glossary] = lists(composeSlide({title: 'Terms used in this review', blocks: [{region: 'questions', items: language.TERMS}]}, {layout: faq, direction}));
    assert.ok(glossary.text.listEntries.every(entry => entry.accent === true));
    assert.equal(glossary.text.rules.length, language.TERMS.length - 1);
    // Features named in two words are labels, not a glossary: rows (LH-08) in the text color.
    const features = [{text: 'Offline mode', description: 'Work without a connection.'}, {text: 'Shared workspaces', description: 'One place for a team.'}, {text: 'Faster search', description: 'Results in 200 ms.'}];
    const [named] = lists(composeSlide({title: 'What is new', blocks: [{region: 'body', items: features}]}, {layout: listLayout, direction}));
    assert.ok(named.text.listEntries.every(entry => entry.accent === undefined));
  });

  test(`LH-134 (${direction}): a lone numbered list of ${NUMERAL_TAKEAWAYS} or fewer takeaways draws display numerals beside ruled rows`, () => {
    const composed = composeSlide({title: 'Three things to remember', blocks: [{region: 'body', numbering: 'arabic', items: language.TAKEAWAYS}]}, {layout: listLayout, direction});
    const [item] = lists(composed), [steps] = composed.steps;
    assert.equal(steps.form, 'column');
    assert.equal(steps.connector, undefined, 'numerals have no connector');
    assert.deepEqual(steps.badges.map(badge => badge.label), ['1', '2', '3']);
    assert.ok(steps.badges.every(badge => badge.numeral && badge.fontSize === item.text.fontSize * LIST_NUMERAL_SCALE));
    assert.deepEqual(steps.badges.map(badge => badge.list?.index), [0, 1, 2], 'the authored numbering is named for an exporter');
    assert.equal(item.text.rules.length, language.TAKEAWAYS.length - 1);
    // More than NUMERAL_TAKEAWAYS entries, or a list without numbering, keeps its markers.
    const six = Array.from({length: NUMERAL_TAKEAWAYS + 1}, (_, index) => `Point ${index + 1}`);
    assert.equal(composeSlide({title: 'Six', blocks: [{region: 'body', numbering: 'arabic', items: six}]}, {layout: listLayout, direction}).steps, undefined);
    assert.equal(composeSlide({title: 'Bullets', blocks: [{region: 'body', items: language.TAKEAWAYS}]}, {layout: listLayout, direction}).steps, undefined);
  });

  test(`LH-134 (${direction}): an agenda with descriptions draws numbered ruled rows; one entry without keeps every badge`, () => {
    const composed = composeSlide({title: 'Today’s agenda', blocks: [{items: language.AGENDA}]}, {layout: agenda, direction});
    const [steps] = composed.steps, [item] = lists(composed);
    assert.deepEqual(steps.badges.map(badge => badge.label), ['01', '02', '03']);
    assert.ok(steps.badges.every(badge => badge.numeral && badge.fontSize === item.text.fontSize), 'numerals at the list size');
    assert.ok(steps.badges.every(badge => badge.list === undefined), 'an unnumbered agenda is numbered as drawing only (LH-07)');
    assert.equal(item.text.rules.length, language.AGENDA.length - 1);
    // Two lists of one agenda, one entry without a description: badges for both, so the agenda is drawn one way.
    const mixed = composeSlide({title: 'Today’s agenda', blocks: [{items: language.AGENDA}, {items: rtl ? ['الخطوات التالية', 'الختام'] : ['Next steps', 'Close']}]}, {layout: agenda, direction});
    assert.ok(lists(mixed).every(item => item.text.listEntries.every(entry => !entry.badge?.numeral)), 'no numbered rows');
    assert.ok((mixed.steps ?? []).flatMap(entry => entry.badges).every(badge => !badge.numeral));
    // A numbered agenda names its numbers, so the export keeps them.
    const numbered = composeSlide({title: 'Today’s agenda', blocks: [{numbering: 'arabic', items: language.AGENDA}]}, {layout: agenda, direction});
    assert.deepEqual(numbered.steps[0].badges.map(badge => badge.list?.number.value), [1, 2, 3]);
  });
}
