// With the worker on, a quick fix followed by one Undo brings the syntax problem back at once. The pane's syntax check in the worker used to
// return early when the text equalled the last applied text; after Undo the findings were cleared but that text was the broken one again,
// so the problem stayed hidden until the next key. The main-thread check never had that guard. OPF_BROWSER_ENGINE=webkit runs it on WebKit.
import assert from 'node:assert/strict';
import { engineName, mod, startKeyboardSuite } from './support/source-keyboard.mjs';

const suite = await startKeyboardSuite();
const broken = '{\n  "name": "x",\n  "slides": [\n    { "title": "A", "design": }\n  ]\n}\n';
const problem = (page) => page.evaluate(() => [...document.querySelectorAll('.opf-source-finding-message')].map((node) => node.textContent));
const waitProblem = (page, present, message) => page.waitForFunction(
  ([want]) => [...document.querySelectorAll('.opf-source-finding-message')].some((node) => /`design` needs a value/.test(node.textContent)) === want,
  [present],
  { timeout: 5000 },
).catch(async () => { throw new Error(`${message}: ${JSON.stringify(await problem(page))}`); });
try {
  for (const mode of ['on', 'off']) {
    const page = await suite.openPage(`?worker=${mode}&applyDelay=1500`);
    suite.problems.length = 0;
    await page.evaluate((text) => { const { api } = demo.pane.editor; api.focus(); api.replace(0, api.getValue().length, text); }, broken);
    await page.evaluate(() => demo.pane.whenIdle());
    await waitProblem(page, true, `worker ${mode}: the missing value is a problem`);
    // The fix is checked for syntax after 150 ms (the problem goes), but with a long apply delay the text is not applied yet, so the applied text
    // is still the broken one when Undo brings it back (the case the guard got wrong).
    await page.evaluate(() => {
      const fix = [...document.querySelectorAll('.opf-source-finding-fix')].find((node) => node.textContent === 'Add { }');
      fix.click();
      const text = demo.pane.getText();
      if (!text.includes('"design": {}')) throw new Error(`the fix did not write an object: ${text}`);
    });
    await waitProblem(page, false, `worker ${mode}: the syntax check clears the problem before the text is applied`);
    await page.evaluate((meta) => {
      demo.pane.editor.view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', metaKey: meta, ctrlKey: !meta, bubbles: true, cancelable: true }));
    }, mod === 'Meta');
    assert.equal(await page.evaluate(() => demo.pane.getText()), broken, `worker ${mode}: one Undo restores the broken text`);
    await waitProblem(page, true, `worker ${mode}: the problem is back after one Undo, without another key`);
    assert.equal(await page.evaluate(() => demo.pane.checkerStats().worker > 0), mode === 'on', `worker ${mode}: the check ran where it should`);
    await page.close();
  }
  assert.deepEqual(suite.problems, [], 'no page or console error');
  console.log(`Source worker: a quick fix then one Undo shows the syntax problem again at once, with the worker on and off (${engineName} ${suite.browserVersion}).`);
} finally { await suite.close(); }
