// Regression test for the 0.26.7 hanging-indent slowdown (opf-editor): filling the source pane with a long document took 8.5 s instead of 0.56 s
// when the stylesheet capped the hang with a percentage (`min(n * 1ch, 40%)` in padding-left and text-indent), because the style and layout of every
// line then depended on the width of its containing block. The cap is now worked out in JavaScript (src/source-wrap.js, hangCap) and the
// stylesheet has no percentage; this test keeps it that way.
// The document is about 900 lines of JSON whose lines are long, wrap at a phone width and are indented by different amounts. It is put into the pane
// the way a visitor (or an end-to-end test) does, with Playwright's `fill` (select all, then insert the text), timed to the frame that shows it, once with
// the hanging indent on and once, in the same page, with it switched off by a style override. The two must stay within RATIO of each other (the bug was
// about 12x; the fix is 1x, since both include the browser's own cost of the input). The test also checks that no hang is wider than 40% of the line.
// OPF_HANG_RATIO raises the limit on a slow machine (default 3); OPF_HANG_ROUNDS sets the rounds (default 3); OPF_BROWSER_ENGINE picks the browser.
import assert from 'node:assert/strict';
import { startKeyboardSuite } from './support/source-keyboard.mjs';

const RATIO = Number(process.env.OPF_HANG_RATIO ?? 3);
const ROUNDS = Number(process.env.OPF_HANG_ROUNDS ?? 3);
const WIDTH = 390;
const LINES = 900;

const sentence = 'a long value that has to wrap onto several rows at phone width and keeps going for a good while longer than a single row can hold';
/** A JSON deck of about `LINES` lines; `salt` makes each document different so that every fill is a real change. */
function deck(salt) {
  const lines = ['{', '  "name": "Hanging indent perf",', '  "slides": ['];
  for (let slide = 0; lines.length < LINES; slide++) {
    lines.push('    {', `      "title": "Slide ${slide} ${salt} ${sentence}",`, '      "items": [');
    for (let item = 0; item < 3; item++) lines.push(`        "Point ${item} ${salt} ${sentence}",`);
    lines.push(`${' '.repeat(40)}"deep": "Nested ${slide} ${salt} ${sentence}",`, '      ]', '    },');
  }
  lines.push('  ]', '}');
  return `${lines.join('\n')}\n`;
}
// The same rules the stylesheet has, without the hang: the line keeps its own padding and no text indent.
const OFF = 'html :is(.opf-ui, .opf-json, .opf-code) .cm-line.cm-line { padding-left: var(--opf-line-start, 6px) !important; text-indent: 0 !important; }';

const suite = await startKeyboardSuite({ viewport: { width: WIDTH, height: 800 } });
const page = await suite.openPage();
try {
  await page.evaluate(() => demo.pane.setFormat('json'));
  const content = page.locator('.opf-source-code .cm-content');
  const hangOff = (off) => page.evaluate(([css, on]) => {
    document.getElementById('hang-off')?.remove();
    if (!on) return;
    const style = document.createElement('style');
    style.id = 'hang-off';
    style.textContent = css;
    document.head.append(style);
  }, [OFF, off]);
  /** Fill the pane with `text` and wait for the frame that shows it; returns the milliseconds. */
  const fill = async (text) => {
    const start = Date.now();
    await content.fill(text);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    return Date.now() - start;
  };

  await fill(deck('warm'));
  const rounds = { on: [], off: [] };
  for (let round = 0; round < ROUNDS; round++) {
    for (const mode of ['off', 'on']) {
      await hangOff(mode === 'off');
      rounds[mode].push(await fill(deck(`${mode}${round}`)));
    }
  }
  const median = (list) => [...list].sort((a, b) => a - b)[list.length >> 1];
  const on = median(rounds.on), off = median(rounds.off);
  console.log(`P-004 filling the pane with ${deck('x').split('\n').length - 1} wrapping JSON lines at ${WIDTH}px: ${on} ms with the hanging indent, ${off} ms without (${(on / off).toFixed(1)}x, limit ${RATIO}x; rounds ${rounds.on.join('/')} against ${rounds.off.join('/')}).`);
  assert.ok(on <= off * RATIO, `filling takes ${on} ms with the hanging indent against ${off} ms without it (over ${RATIO}x)`);

  // The hang is still there, and no line hangs more than 40% of the width of a line.
  await hangOff(false);
  await fill(deck('check'));
  const measure = () => page.evaluate(() => {
    const { contentDOM, defaultCharacterWidth } = demo.pane.editor.view;
    const style = getComputedStyle(contentDOM), width = contentDOM.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const lines = [...document.querySelectorAll('.cm-line')];
    const classes = lines.map((line) => Number(/opf-hang-(\d+)/.exec(line.className)?.[1] ?? -1));
    return { width, column: defaultCharacterWidth, deepest: Math.max(...classes), lowest: Math.min(...classes) };
  });
  const narrow = await measure();
  console.log('P-004 hang check', JSON.stringify(narrow));
  assert.ok(narrow.lowest >= 0, 'every rendered line carries a hang class');
  assert.ok(narrow.deepest >= 2, `lines hang (the deepest by ${narrow.deepest} columns)`);
  assert.ok(narrow.deepest * narrow.column <= narrow.width * 0.4 + 1, `the deepest hang (${narrow.deepest} columns of ${narrow.column.toFixed(2)}px) is within 40% of ${narrow.width.toFixed(1)}px`);
  assert.ok(narrow.deepest >= Math.floor(narrow.width * 0.4 / narrow.column) - 1, `a deep line hangs up to the cap (${narrow.deepest} columns of ${Math.floor(narrow.width * 0.4 / narrow.column)})`);
  // A wider pane lifts the cap without any edit.
  await page.setViewportSize({ width: 700, height: 800 });
  await page.waitForFunction((before) => {
    const classes = [...document.querySelectorAll('.cm-line')].map((line) => Number(/opf-hang-(\d+)/.exec(line.className)?.[1] ?? -1));
    return Math.max(...classes) > before;
  }, narrow.deepest);
  const wide = await measure();
  assert.ok(wide.deepest * wide.column <= wide.width * 0.4 + 1, `the deepest hang (${wide.deepest} columns of ${wide.column.toFixed(2)}px) is within 40% of ${wide.width.toFixed(1)}px`);
  assert.deepEqual(suite.problems, [], 'no page error');
} finally { await page.close(); await suite.close(); }
