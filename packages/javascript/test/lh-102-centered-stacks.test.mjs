// LH-102: an automatic stack of paragraphs and lists, and a body of promoted regions that each run the body's full height, sit in the
// middle of the body under the headings when they fill too little of it, instead of at its top over an empty foot.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

const headings = new Set(['title', 'subtitle', 'tag']);
const body = (result) => result.items.filter((item) => !headings.has(item.field));
const findings = (result) => result.diagnostics.filter((entry) => ['text-overflow', 'small-cell', 'layout-unplaced'].includes(entry.code));
const textHeight = (item) => { const fit = item.text; return typeof fit.height === 'number' ? fit.height : Math.max(fit.lines.length * fit.lineHeight, fit.placement?.height ?? 0); };
// The space above the body's text (from the foot of the headings) and below it (to the foot of the content box).
const margins = (result) => {
  const items = body(result), title = result.items.find((item) => item.field === 'title');
  const top = Math.min(...items.map((item) => item.box.y)), bottom = Math.max(...items.map((item) => item.box.y + textHeight(item)));
  return { above: top - (title.box.y + title.box.height), below: result.contentBox.y + result.contentBox.height - bottom };
};

describe('LH-102: under-filled automatic bodies center', () => {
  test('a stack of paragraphs sits in the middle of the body', () => {
    const result = composeSlide({
      title: 'Evidence Pack', composition: { mode: 'column' },
      blocks: [
        { text: 'Relay Cloud should focus the next cycle on balance platform reliability work with customer-facing commitments while making the operating tradeoffs clear to engineering stakeholders.' },
        { text: 'Image backgrounds use a fixed image fill.' },
        { text: 'Participants said the checklist made the next step obvious.' },
        { text: 'Narrative beats describe authoring intent without constraining slide structure.' },
      ],
    });
    assert.deepEqual(findings(result), []);
    const { above, below } = margins(result);
    assert.ok(above > 60, `space above ${above}`);
    assert.ok(Math.abs(above - below) < 0.25 * (above + below), `above ${above}, below ${below}`);
    // The blocks still read top to bottom in source order.
    const ys = body(result).map((item) => item.box.y);
    assert.deepEqual([...ys].sort((a, b) => a - b), ys);
  });

  for (const direction of ['ltr', 'rtl']) {
    test(`${direction}: full-height promoted regions set their blocks as one band in the middle of the body`, () => {
      const result = composeSlide({
        title: 'Operating Choice',
        'left+center': { items: ['Standardize the intake path', 'Keep escalation rules visible'] },
        right: { text: 'Decision owners need one place to see what changed.' },
      }, { direction });
      assert.deepEqual(findings(result), []);
      const [list, text] = [body(result).find((item) => item.field === 'items'), body(result).find((item) => item.field === 'text')];
      assert.ok(Math.abs(list.box.y - text.box.y) < 1, 'one band');
      const { above, below } = margins(result);
      assert.ok(above > 60 && below > 60, `above ${above}, below ${below}`);
      // The regions keep their columns: the list at the start edge.
      if (direction === 'rtl') assert.ok(list.box.x > text.box.x); else assert.ok(list.box.x < text.box.x);
    });
  }

  test('a body that fills the slide keeps its top', () => {
    const long = 'Northgate Museum should focus the next cycle on prepare a self-running lobby deck with concise navigation cues while making the operating tradeoffs clear to visitor orientation stakeholders. ';
    const result = composeSlide({ title: 'Decision Options', composition: { mode: 'column' }, blocks: Array.from({ length: 5 }, () => ({ text: long.repeat(2).trim() })) });
    assert.ok(margins(result).above < 40);
  });
});
