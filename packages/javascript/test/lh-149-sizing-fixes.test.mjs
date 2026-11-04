// LH-149 (half steps of the type scale for fitted body text), LH-144 (the pages of one paginated slide share its sizes: composition.maxFontSize),
// LH-150 (a ratio such as "4.6 / 5" never breaks at its slash) and LH-151 (text-contrast judges a metric value in the color the engines draw).
import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { bindNoBreak, composeSlide, layoutTable, lineMayStartAt, unbindNoBreak, wrapText } from '../dist/composition.js';
import { validate } from '../dist/index.js';
import { paginate } from '../dist/pagination.js';

const { layouts } = gallery;
const px = (result, value) => Math.round(value / (Math.min(result.width, result.height) / 720) * 100) / 100;
const bodyItems = (result) => result.items.filter((item) => !['title', 'subtitle', 'tag'].includes(item.field) && !item.eyebrow);
const largest = (layout) => Math.max(...layout.parts.filter((part) => part.fit && part.visible !== false).map((part) => part.fit.fontSize));
// LH-17's steps and LH-149's half steps at the default floor (reference px).
const FULL = [16, 18, 21, 24, 28, 32], HALF = [16, 17, 18, 20, 21, 23, 24, 26, 28, 30, 32, 35, 37];

describe('LH-149: jointly sized siblings take the half steps of the type scale', () => {
  const pair = (question, answer) => ({ region: 'questions', text: `${question}\n${answer}` });
  const faq = {
    title: 'What the pilot involves',
    subtitle: 'Illustrative example',
    blocks: [
      pair('Who takes part?', 'Two field teams, with 52 participants in total.'),
      pair('How long does it run?', 'Six weeks, including a baseline measurement.'),
      pair('What happens next?', 'Review completion and task time before expanding.'),
      pair('Who takes part?', 'Two field teams, with 52 participants in total.'),
      pair('How long does it run?', 'Six weeks, including a baseline measurement.'),
      pair('What happens next?', 'Review completion and task time before expanding.'),
    ],
  };

  test('six short FAQ pairs that miss 24 px by a few pixels draw at 23 px, not 21 (PR767 P07, P27)', () => {
    const result = composeSlide(faq, { layout: layouts.faq });
    const sizes = bodyItems(result).map((item) => px(result, item.text.fontSize));
    assert.equal(sizes.length, 6);
    for (const size of sizes) assert.equal(size, 23, JSON.stringify(sizes));
    assert.ok(!result.diagnostics.some((entry) => entry.code === 'text-overflow'));
  });

  test('every fitted body size of a set of siblings is a step or a half step of the scale', () => {
    for (const count of [2, 3, 4, 5, 6]) {
      const slide = { ...faq, blocks: faq.blocks.slice(0, count).concat(faq.blocks.slice(0, count)) };
      const result = composeSlide(slide, { layout: layouts.faq });
      for (const item of bodyItems(result)) {
        const size = px(result, item.text.fontSize);
        assert.ok(HALF.includes(size) || size === 28 || size === 32, `${count} pairs: ${size}`);
      }
    }
    assert.ok(FULL.every((size) => HALF.includes(size)), 'the half steps keep every step of LH-17');
  });

  test('right to left, the same pairs take the same size', () => {
    const arabic = { ...faq, blocks: faq.blocks.map((block) => ({ ...block, text: 'من يشارك؟\nفريقان ميدانيان يضمان اثنين وخمسين مشاركاً في المجموع.' })) };
    const ltr = composeSlide(arabic, { layout: layouts.faq });
    const rtl = composeSlide(arabic, { layout: layouts.faq, direction: 'rtl' });
    assert.deepEqual(bodyItems(rtl).map((item) => item.text.fontSize), bodyItems(ltr).map((item) => item.text.fontSize));
  });
});

describe('LH-144: composition.maxFontSize caps the body, and paginate passes the first page sizes along', () => {
  test('a lone paragraph that grows to fill the body stops at the cap', () => {
    const slide = { title: 'Why it matters', text: 'One short message.' };
    const grown = composeSlide(slide);
    const capped = composeSlide({ ...slide, composition: { maxFontSize: 28 } });
    assert.ok(px(grown, bodyItems(grown)[0].text.fontSize) > 28, 'the lone paragraph grows without a cap');
    assert.equal(px(capped, bodyItems(capped)[0].text.fontSize), 28);
  });

  test('a lone timeline, a list, a quote and a metric are set no larger than the cap', () => {
    const timeline = { events: [{ when: 'Q1', what: 'Plan' }, { when: 'Q2', what: 'Build' }, { when: 'Q3', what: 'Ship' }] };
    for (const [name, slide, sizeOf] of [
      ['timeline', { title: 'Plan', timeline }, (item) => largest(item.timelineLayout)],
      ['list', { title: 'Plan', items: ['One', 'Two', 'Three'] }, (item) => item.text.fontSize],
      ['quote', { title: 'Voice', quote: { text: 'It just works.', attribution: 'A customer' } }, (item) => largest(item.quoteLayout)],
      ['metric', { title: 'Growth', metric: { value: '42%', label: 'Growth' } }, (item) => largest(item.metricLayout)],
    ]) {
      const result = composeSlide({ ...slide, composition: { maxFontSize: 24 } });
      const item = bodyItems(result)[0];
      assert.ok(px(result, sizeOf(item)) <= 24 + 1e-6, `${name}: ${px(result, sizeOf(item))}`);
      assert.ok(!result.diagnostics.some((entry) => entry.code === 'text-overflow'), name);
    }
  });

  test('the cap never takes text under the readability floor, and headings keep their sizes', () => {
    const slide = { title: 'Plan', text: 'One short message.' };
    const result = composeSlide({ ...slide, composition: { maxFontSize: 10, minFontSize: 16 } });
    assert.equal(px(result, bodyItems(result)[0].text.fontSize), 16);
    const plain = composeSlide({ ...slide, composition: { minFontSize: 16 } });
    assert.equal(result.items.find((item) => item.field === 'title').text.fontSize, plain.items.find((item) => item.field === 'title').text.fontSize);
  });

  test('a paginated process: no later page reads larger than the first, and the pages carry the cap', () => {
    const events = Array.from({ length: 6 }, (_, event) => ({ when: `Q${event + 1}`, what: `Milestone ${event + 1} with a longer description` }));
    const deck = { slides: [{ layout: 'process', title: 'Process: a longer title that may need a second line on the slide', blocks: Array.from({ length: 9 }, () => ({ timeline: { events } })) }] };
    const { presentation } = paginate(deck, { catalogs: [gallery] });
    assert.ok(presentation.slides.length > 2, `${presentation.slides.length} pages`);
    const sizes = presentation.slides.map((slide) => {
      const result = composeSlide(slide, { layout: layouts.process });
      return Math.max(...bodyItems(result).map((item) => px(result, largest(item.timelineLayout))));
    });
    for (const [page, size] of sizes.entries()) assert.ok(size <= sizes[0] + 1e-6, `page ${page + 1} draws ${size} px, page 1 ${sizes[0]} px: ${sizes}`);
    assert.equal(presentation.slides[0].composition?.maxFontSize, undefined, 'the first page is the slide as written');
    for (const slide of presentation.slides.slice(1)) assert.equal(slide.composition.maxFontSize, sizes[0]);
    assert.ok(validate(presentation, { only: ['format'] }).valid, 'the pages are valid OPF');
  });

  test('an invalid cap is refused', () => {
    assert.throws(() => composeSlide({ title: 'T', text: 'x', composition: { maxFontSize: 4 } }), /maxFontSize/);
  });
});

describe('LH-150: a ratio never breaks at its slash', () => {
  const ratio = (text) => `Participant satisfaction rose to ${text} in the pilot`;
  test('"4.6 / 5" stays on one line at every width that holds it', () => {
    for (let width = 120; width <= 600; width += 7) {
      const lines = wrapText(ratio('4.6 / 5'), width, 20).map((line) => line.trim());
      assert.ok(!lines.some((line) => /^\/|^5\b|\/$|4\.6$/u.test(line)), `${width}: ${JSON.stringify(lines)}`);
    }
  });

  test('the no-break spaces the PPTX export writes, and back', () => {
    for (const text of ['4.6 / 5', '$2 / $3', '3.8 ∕ 5', '1 / 2 / 2024']) {
      const bound = bindNoBreak(text);
      assert.ok(!/ /u.test(bound), `${text}: ${JSON.stringify(bound)}`);
      assert.equal(unbindNoBreak(bound), text);
    }
    for (const text of ['Q1 / Q2', 'yes / no', 'and/or', '4.6 /5x']) assert.equal(bindNoBreak(text), text, text);
  });

  test('an unspaced ratio is not cut at its slash inside a word', () => {
    assert.equal(lineMayStartAt('4.6/5', 3), false);
    assert.equal(lineMayStartAt('4.6/5', 4), false);
    assert.equal(lineMayStartAt('and/or', 4), true);
  });

  test('a table cell keeps the ratio whole: the column grows to hold it', () => {
    const table = { columns: ['Measure', 'Baseline', 'Pilot'], rows: [['Participant satisfaction', '3.8 / 5', '4.6 / 5'], ['Task completion', '68%', '84%']] };
    const layout = layoutTable(table, { x: 0, y: 0, width: 360, height: 300 });
    for (const cell of layout.rows.flatMap((row) => row.cells)) if (/\//u.test(String(cell.value))) assert.equal(cell.fit.lines.length, 1, JSON.stringify(cell.fit.lines));
  });

  test('a metric value written as a ratio is one figure', () => {
    const result = composeSlide({ title: 'Satisfaction', blocks: [{ metric: { value: '4.6 / 5', label: 'Participant satisfaction' } }, { metric: { value: '3.8 / 5', label: 'Baseline' } }, { metric: { value: '92%', label: 'On time' } }] });
    for (const item of bodyItems(result)) {
      const value = item.metricLayout.parts.find((part) => part.role === 'value');
      assert.equal(value.fit.lines.length, 1, `${value.text}: ${JSON.stringify(value.fit.lines)}`);
    }
  });
});

describe('LH-151: text-contrast judges a metric value in the color the engines draw', () => {
  // PR767's homogeneous-metric-2col: the default design draws its cards in #172C52 and its accent #2874A6 at 2.73:1 there.
  const metrics = { layout: 'two-column', title: 'Two peer columns of metric', blocks: [{ metric: { value: '84%', label: 'Task completion', description: 'Up from 68% at baseline' } }, { metric: { value: '6.2', unit: 'min', label: 'Median task time', description: 'Down from 9.4 min before the pilot' } }] };
  const contrast = (design, slide) => validate({ language: 'en-US', ...(design ? { design } : {}), slides: [slide] }, { only: ['text-contrast'], catalogs: [gallery] }).findings;

  test('a value on a dark card is drawn in the light text color (metricValueColor), so it has no warning', () => {
    assert.deepEqual(contrast(undefined, metrics).map((finding) => finding.path), []);
    assert.deepEqual(contrast(undefined, { title: 'Scorecard', layout: 'scorecard', blocks: metrics.blocks.concat(metrics.blocks) }).map((finding) => finding.path), []);
  });

  test('a value that really is unreadable still warns', () => {
    const findings = contrast({ background: '#FFFFFF', colorScheme: { accent1: '#E8EEF4', dark1: '#1F2937', light1: '#FFFFFF' } }, metrics);
    assert.ok(findings.some((finding) => /metric\/value$/u.test(finding.path)), JSON.stringify(findings.map((finding) => finding.path)));
  });
});
