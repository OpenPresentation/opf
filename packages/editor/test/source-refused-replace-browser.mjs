import assert from 'node:assert/strict';
import { startWorkspacePage } from './support/workspace-page.mjs';

// 0.34.1: a host that opens a deck the session refuses over the one the source pane shows (pptx.dev's Inspector: a session with
// `rejectInvalid`, `setDocument(doc, { text })`, then `setSourceText` when it is refused). The refused deck's findings name places in its
// own text; the pane once drew them against the text it still showed, a quick fix for a place that text lacks threw ("Can not delete in
// empty document"), `setDocument` threw that error instead of returning false, and the host got the old text back as the pane's text.
const checks = [];
const mark = (name) => checks.push(name);
const app = await startWorkspacePage({ body: '<div id="host" style="width:900px;height:700px"></div>' });
const { page, errors } = app;
const ev = (fn, arg) => page.evaluate(fn, arg);

const slides = (count, extra = {}) => Array.from({ length: count }, (_, index) => ({ id: `s${index + 1}`, title: `Slide ${index + 1}`, ...extra }));
const first = { name: 'Five slides', slides: slides(5) };
const firstText = JSON.stringify(first, null, 2);
// `body` is not a slide key: each slide has an `additionalProperties` error at /slides/N/body, and slide 6 is a place the first text lacks.
const second = { name: 'Six slides', slides: slides(6, { body: 'text' }) };
const secondText = JSON.stringify(second, null, 2);

try {
  for (const rejectInvalid of [true, false]) {
    const result = await ev(async ({ first, firstText, second, secondText, rejectInvalid }) => {
      document.querySelector('#host')?.replaceChildren();
      const session = window.opfWs.createEditorSession(first, { rejectInvalid, catalogs: [window.opfWs.gallery] });
      const ed = window.opfWs.createOpfEditor(document.querySelector('#host'), { session, catalogs: [window.opfWs.gallery], fonts: window.fonts, layout: 'source', source: { format: 'json', text: firstText } });
      await ed.ready;
      const shownBefore = ed.readSource().text;
      const sourceTexts = [];
      ed.on('source', (event) => sourceTexts.push(event.text));
      let returned, thrown = null;
      try { returned = ed.setDocument(second, { text: secondText, format: 'json', rebase: false }); }
      catch (error) { thrown = String(error?.message ?? error); }
      // A refused deck is loaded as a draft, as the host does after `setDocument` returns false.
      if (returned === false) ed.setSourceText(secondText, { format: 'json', rebase: false });
      const pane = ed.sourcePane;
      const text = ed.readSource().text;
      const rows = [...document.querySelectorAll('.opf-source-finding-item')].map((item) => ({
        path: item.querySelector('.opf-source-finding-path')?.textContent ?? '',
        fixes: [...item.querySelectorAll('.opf-source-finding-fix')].map((button) => button.textContent),
      }));
      const out = { shownBefore, returned, thrown, text, sourceTexts, rows, problems: pane.getProblems().length };
      ed.destroy();
      return out;
    }, { first, firstText, second, secondText, rejectInvalid });
    const label = rejectInvalid ? 'refused' : 'accepted';
    assert.equal(result.shownBefore, firstText, `${label}: the pane starts on the first text`);
    assert.equal(result.thrown, null, `${label}: setDocument does not throw`);
    assert.equal(result.returned, !rejectInvalid, `${label}: setDocument says whether the session took the deck`);
    assert.equal(result.text, secondText, `${label}: the pane shows the new text`);
    assert.ok(!result.sourceTexts.includes(firstText), `${label}: no source event reports the old text`);
    const paths = result.rows.map((row) => row.path);
    for (let index = 0; index < 6; index++) assert.ok(paths.includes(`/slides/${index}/body`), `${label}: the finding at /slides/${index}/body is listed (${JSON.stringify(paths)})`);
    // The new text has the place, so its fix is offered as before.
    assert.ok(result.rows.find((row) => row.path === '/slides/5/body').fixes.includes('Remove property'), `${label}: Remove property is offered for the new text`);
    assert.ok(result.problems >= 6, `${label}: the problems are drawn in the new text`);
    mark(`${label}: setDocument over a 5-slide deck opens the 6-slide deck's text with its findings, throws nothing and reports no old text`);
  }
  assert.deepEqual(errors, [], 'no page errors');
  for (const name of checks) console.log(`ok - ${name}`);
} finally {
  await app.close();
}
