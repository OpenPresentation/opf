import assert from 'node:assert/strict';
import { startWorkspacePage, deck } from './support/workspace-page.mjs';

// CE-17: the hooks a host needs to replace its own code editor with the source pane, in a real browser and in all three formats (JSON, YAML, Markdown):
//   - the `cursor` event (and `getCursor`): the pointer, the id path and the selection under the caret, through `createOpfEditor` and React;
//   - `revealPath`: scroll to a pointer or a range without moving the caret or the focus;
//   - `setDecorations`: a host's own marks and line classes, by path or range, apart from the editor's own.
const checks = [];
const mark = (name) => checks.push(name);
const pageEntry = `
  import * as React from 'react';
  import { createRoot } from 'react-dom/client';
  window.R = { React, createRoot };
  import { mountJsonCodeEditor } from './src/json-editor.js';
  window.mountJson = mountJsonCodeEditor;
`;
const app = await startWorkspacePage({ bundle: { extraEntry: pageEntry } });
const { page, errors } = app;
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const FORMATS = ['json', 'yaml', 'md'];

try {
  await ev(async (d) => {
    document.body.insertAdjacentHTML('beforeend', '<button id="elsewhere" type="button">Elsewhere</button>');
    window.events = [];
    window.optionEvents = [];
    window.ed = window.opfWs.createOpfEditor(document.querySelector('#host'), {
      document: d, fonts: window.fonts, catalogs: [window.opfWs.gallery], layout: 'source', source: { cursorDelay: 20 },
      on: { cursor: (event) => window.events.push(event) }, onCursor: (event) => window.optionEvents.push(event),
    });
    await window.ed.ready;
    window.pane = window.ed.sourcePane;
    window.sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    window.place = async (needle, length = 0) => {
      const at = window.pane.getText().indexOf(needle);
      if (at < 0) throw new Error(`"${needle}" is not in the source`);
      window.pane.editor.api.setSelection(at, at + length);
      await window.sleep(120);
      return at;
    };
  }, deck(40));

  assert.equal(await ev(() => window.ed.sourceCursor), null, 'no event before the caret moves');

  for (const format of FORMATS) {
    await ev((f) => { window.pane.setFormat(f); window.events.length = 0; window.optionEvents.length = 0; }, format);

    // ---- the cursor event -----------------------------------------------------------------------------------------------------------------
    const at = await ev(() => window.place('Slide 20'));
    let events = await ev(() => window.events);
    assert.equal(events.length, 1, `${format}: one event for one move`);
    assert.deepEqual(events[0], { pointer: '/slides/19/title', idPath: '/slides/@s20/title', from: at, to: at, head: at, part: 'value', format }, `${format}: the pointer, the id path and the offsets`);
    assert.equal((await ev(() => window.optionEvents)).length, 1, `${format}: the onCursor option hears it too`);
    assert.deepEqual(await ev(() => window.ed.sourceCursor), events[0], `${format}: sourceCursor is the latest event`);
    assert.ok(await ev(() => Object.isFrozen(window.ed.sourceCursor)), `${format}: the event is frozen`);
    assert.deepEqual(await ev(() => window.pane.getCursor()), events[0], `${format}: getCursor reads the same place at once`);
    assert.equal(await ev(() => document.activeElement === document.querySelector('#elsewhere') || !window.pane.editor.api.hasFocus()), true, `${format}: no focus was needed`);

    // The same place again, and a move inside the same field, are told only when something changed.
    await ev(() => window.place('Slide 20'));
    assert.equal((await ev(() => window.events)).length, 1, `${format}: the same place is not told again`);
    await ev(() => window.place('Slide 20', 5));
    events = await ev(() => window.events);
    assert.equal(events.length, 2, `${format}: a selection is a new event`);
    assert.equal(events[1].to - events[1].from, 5, `${format}: from and to are the selection`);
    assert.equal(events[1].pointer, '/slides/19/title');

    // Moves made in one go are coalesced into the last.
    await ev(async () => {
      const text = window.pane.getText();
      for (const n of [3, 7, 11, 15]) window.pane.editor.api.setSelection(text.indexOf(`Slide ${n}`));
      await window.sleep(150);
    });
    events = await ev(() => window.events);
    assert.equal(events.length, 3, `${format}: quick moves give one event`);
    assert.equal(events[2].pointer, '/slides/14/title', `${format}: the last place wins`);

    // Other positions: another field, a key, between members, outside the document.
    await ev(() => window.place('Words on slide 4'));
    assert.equal((await ev(() => window.ed.sourceCursor)).pointer, '/slides/3/text', `${format}: a text field`);
    assert.equal((await ev(() => window.ed.sourceCursor)).idPath, '/slides/@s4/text');
    await ev(() => { window.pane.editor.api.setSelection(0); return window.sleep(120); });
    const top = await ev(() => window.ed.sourceCursor);
    assert.ok(['none', 'between', 'value', 'key'].includes(top.part), `${format}: the start of the text has a part (${top.part})`);
    assert.ok(!top.pointer.startsWith('/slides/'), `${format}: the start of the text is not in a slide (${top.pointer})`);
    await ev(() => window.place('Slide 5', 3));
    assert.equal((await ev(() => window.ed.sourceCursor)).pointer, '/slides/4/title');

    // Typing changes the offsets: the event follows, once the edit is applied (the id path comes from the session's document).
    await ev(async () => {
      const text = window.pane.getText();
      window.pane.editor.api.setSelection(text.indexOf('Slide 6') + 7);
      window.pane.editor.api.replace(text.indexOf('Slide 6') + 7, text.indexOf('Slide 6') + 7, 'x');
      await window.pane.whenIdle();
      await window.sleep(150);
    });
    const typed = await ev(() => window.ed.sourceCursor);
    assert.equal(typed.pointer, '/slides/5/title', `${format}: typing keeps the field`);
    assert.equal(typed.idPath, '/slides/@s6/title');
    assert.equal(await ev(() => window.ed.getDocument().slides[5].title), 'Slide 6x', `${format}: the edit reached the document`);
    await ev(() => window.ed.session.set('slides.5.title', 'Slide 6'));
    await ev(() => window.pane.whenIdle());
    mark(`${format}: cursor event (pointer, id path, from/to/head, coalescing, no repeat, typing)`);

    // ---- reveal ------------------------------------------------------------------------------------------------------------------------------
    await ev(() => { window.place('Slide 2'); return window.sleep(120); });
    await ev(() => { window.pane.editor.view.scrollDOM.scrollTop = 0; document.querySelector('#elsewhere').focus(); window.events.length = 0; });
    const before = await ev(() => ({ selection: window.pane.editor.api.getSelection(), scroll: window.pane.editor.view.scrollDOM.scrollTop }));
    assert.equal(before.scroll, 0);
    const revealed = await ev(() => window.pane.revealPath('/slides/35/title'));
    assert.ok(revealed && revealed.exact && revealed.line > 20, `${format}: reveal reports the place (${JSON.stringify(revealed)})`);
    assert.ok(revealed.to > revealed.from);
    await wait(150);
    const after = await ev(() => ({ selection: window.pane.editor.api.getSelection(), scroll: window.pane.editor.view.scrollDOM.scrollTop, active: document.activeElement?.id, focus: window.pane.editor.api.hasFocus(), events: window.events.length }));
    assert.ok(after.scroll > 100, `${format}: the pane scrolled (${after.scroll})`);
    assert.deepEqual(after.selection, before.selection, `${format}: the caret did not move`);
    assert.equal(after.active, 'elsewhere', `${format}: the focus stayed where it was`);
    assert.equal(after.focus, false);
    assert.equal(after.events, 0, `${format}: revealing is not a cursor move`);
    const shown = await ev((range) => {
      const view = window.pane.editor.view, box = view.scrollDOM.getBoundingClientRect(), rect = view.coordsAtPos(range.from);
      return rect !== null && rect.top >= box.top && rect.bottom <= box.bottom;
    }, revealed);
    assert.ok(shown, `${format}: the revealed text is in view`);

    // A range works, with a start alignment; an unknown path is placed at its nearest container or refused.
    await ev(() => { window.pane.editor.view.scrollDOM.scrollTop = 0; });
    const byRange = await ev(() => { const text = window.pane.getText(), from = text.indexOf('Slide 30'); return window.pane.revealPath({ from, to: from + 8 }, { align: 'start' }); });
    assert.equal(byRange.exact, true);
    await wait(150);
    assert.ok((await ev(() => window.pane.editor.view.scrollDOM.scrollTop)) > 100, `${format}: a range reveals too`);
    const near = await ev(() => window.pane.revealPath('/slides/3/nonsense'));
    await wait(50);
    assert.ok(near === null || near.exact === false, `${format}: a missing field is not exact`);
    await assert.rejects(ev(() => window.pane.revealPath(42)), /revealPath needs/);

    // focus and select do what they say.
    await ev(() => { window.pane.revealPath('/slides/9/title', { focus: true, select: true, part: 'value' }); });
    await wait(150);
    const selected = await ev(() => ({ focus: window.pane.editor.api.hasFocus(), selection: window.pane.editor.api.getSelection(), text: window.pane.getText(), last: window.events.at(-1) }));
    assert.equal(selected.focus, true, `${format}: focus: true focuses`);
    assert.match(selected.text.slice(...selected.selection), /Slide 10/, `${format}: select: true selects the value`);
    assert.equal(selected.last?.pointer, '/slides/9/title', `${format}: selecting is a cursor move`);

    // flash: the first line is marked for a moment and then cleared.
    await ev(() => { document.querySelector('#elsewhere').focus(); window.pane.revealPath('/slides/12/title', { flash: true }); });
    assert.equal(await page.locator('.opf-source-code .cm-line.opf-source-flash').count(), 1, `${format}: flash marks one line`);
    await page.waitForFunction(() => document.querySelectorAll('.opf-source-flash').length === 0, undefined, { timeout: 4000 });
    mark(`${format}: revealPath (pointer, range, no focus or caret move, select, focus, flash)`);

    // ---- decorations -----------------------------------------------------------------------------------------------------------------------
    const problems = await ev(() => window.pane.getProblems().length);
    await ev(() => window.pane.clearDecorations());
    const count = (selector) => page.locator(`.opf-source-code ${selector}`).count();
    await ev(() => {
      const text = window.pane.getText(), from = text.indexOf('Slide 3');
      window.pane.revealPath('/slides/2/title', { align: 'center' });
      window.pane.setDecorations([
        { path: '/slides/2/title', kind: 'error', label: 'Needs a better title' },
        { range: { from, to: from + 7 }, kind: 'info' },
        { path: '/slides/2/text', kind: 'added', line: true },
        { path: '/slides/90/title', kind: 'error' },
      ], { group: 'validation' });
      window.pane.setDecorations([{ path: '/slides/2/text', kind: 'agent-touched', label: 'Edited by the agent' }], { group: 'agent' });
    });
    const drawn = await ev(() => window.pane.getDecorations());
    assert.equal(drawn.filter((item) => item.group === 'validation').length, 3, `${format}: a path that is not in the text is not drawn`);
    assert.equal(drawn.filter((item) => item.group === 'agent').length, 1);
    assert.deepEqual(drawn.map((item) => item.from), [...drawn.map((item) => item.from)].sort((a, b) => a - b), `${format}: in position order`);
    const error = drawn.find((item) => item.kind === 'error');
    assert.equal(error.label, 'Needs a better title');
    assert.equal(error.path, '/slides/2/title');
    assert.match(await ev((item) => window.pane.getText().slice(item.from, item.to), error), /Slide 3/, `${format}: the path is on its field`);
    await page.waitForSelector('.opf-source-code .opf-source-decoration-error');
    assert.match(await page.locator('.opf-source-code .opf-source-decoration-error').first().textContent(), /Slide 3/, `${format}: the mark is drawn over the field`);
    assert.equal(await page.locator('.opf-source-code .opf-source-decoration-error').first().getAttribute('title'), 'Needs a better title');
    assert.equal(await count('.opf-source-decoration-info'), 1);
    assert.ok(await count('.cm-line.opf-source-decoration-added') >= 1, `${format}: a line decoration puts the class on the line`);
    assert.equal(await count('.opf-source-decoration-agent-touched'), 1, `${format}: another kind and another group`);
    assert.equal(await ev(() => window.pane.getProblems().length), problems, `${format}: the editor's own problems are untouched`);
    assert.equal(await ev(() => window.ed.getDocument().slides[2].title), 'Slide 3', 'the document is untouched');

    // The decorations follow the text: typing above moves them, and so does a format switch (a path is placed again in the new text).
    await ev(async () => {
      const text = window.pane.getText();
      window.pane.editor.api.replace(text.indexOf('Slide 1'), text.indexOf('Slide 1'), 'Intro ', { userEvent: 'input.replace' });
      await window.pane.whenIdle();
      await window.sleep(300);
    });
    assert.equal(await ev(() => window.ed.getDocument().slides[0].title), 'Intro Slide 1', `${format}: the edit above was applied`);
    const moved = await ev(() => window.pane.getDecorations('validation').map((item) => window.pane.getText().slice(item.from, item.to).split('\n')[0]));
    assert.ok(moved.some((text) => /Slide 3/.test(text)), `${format}: the marks stayed on their text after typing (${JSON.stringify(moved)})`);
    await ev(() => window.ed.session.set('slides.0.title', 'Slide 1'));
    await ev(() => window.pane.whenIdle());
    const other = FORMATS[(FORMATS.indexOf(format) + 1) % 3];
    await ev((f) => window.pane.setFormat(f), other);
    const switched = await ev(() => window.pane.getDecorations('validation').filter((item) => item.path));
    assert.equal(switched.length, 2, `${format} to ${other}: paths are drawn again in the new format`);
    assert.match(await ev((item) => window.pane.getText().slice(item.from, item.to), switched.find((item) => item.kind === 'error')), /Slide 3/, `${format} to ${other}: still on the title`);
    await ev((f) => window.pane.setFormat(f), format);

    // Clear one group, then all; a replace is a replace.
    await ev(() => window.pane.clearDecorations('agent'));
    assert.equal(await count('.opf-source-decoration-agent-touched'), 0, `${format}: one group clears`);
    assert.ok(await count('.opf-source-decoration-error') >= 1, `${format}: the others stay`);
    await ev(() => window.pane.setDecorations([{ path: '/slides/4/title', kind: 'warning' }], { group: 'validation' }));
    assert.equal(await count('.opf-source-decoration-error'), 0, `${format}: setting a group replaces it`);
    assert.equal(await count('.opf-source-decoration-warning'), 1);
    await assert.rejects(ev(() => window.pane.setDecorations([{ kind: 'error' }])), /needs a path/);
    await ev(() => window.pane.setDecorations(null, { group: 'validation' }));
    assert.equal(await count('[class*="opf-source-decoration"]'), 0, `${format}: null clears`);
    await ev(() => window.pane.setDecorations([{ path: '/slides/5/title' }, { path: '/slides/6/title', kind: 'My Kind!' }]));
    assert.equal(await count('.opf-source-decoration-highlight'), 1, `${format}: the default kind is highlight`);
    assert.equal(await count('.opf-source-decoration-my-kind-'), 1, `${format}: a kind is made safe for a class name`);
    await ev(() => window.pane.clearDecorations());
    assert.equal((await ev(() => window.pane.getDecorations())).length, 0);
    assert.equal(await count('[class*="opf-source-decoration"]'), 0, `${format}: clearDecorations() removes them all`);
    mark(`${format}: decorations (path, range, line, groups, follow edits and format switches, clear, kinds)`);
  }

  // ---- CRLF text in the code editor itself: offsets are those of the text as `getValue()` returns it, a line break counting as two ------------------
  const crlf = await ev(async () => {
    const code = JSON.stringify({ name: 'A', slides: [{ id: 'a', title: 'One' }, { id: 'b', title: 'Two' }] }, null, 2).replaceAll('\n', '\r\n');
    const parent = document.createElement('div');
    parent.style.cssText = 'width:600px;height:200px';
    document.body.append(parent);
    const editor = window.mountJson(parent, { code, label: 'CRLF', onChange() {} });
    const at = code.indexOf('Two');
    editor.api.setSelection(at, at + 3);
    editor.setDecorations('host', [{ from: at - 1, to: at + 4, className: 'crlf-mark', title: 'two' }, { from: code.indexOf('"a"'), to: code.indexOf('"a"') + 1, className: 'crlf-line', line: true }]);
    editor.reveal(at, at + 3, { align: 'nearest' });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const marked = parent.querySelector('.crlf-mark')?.textContent;
    const lined = parent.querySelectorAll('.cm-line.crlf-line').length;
    const result = { head: editor.api.getHead(), at, marked, lined, decorations: editor.getDecorations().map((item) => [item.from, item.to, item.line]), text: code.slice(code.indexOf('"a"') - 4, code.indexOf('"a"') + 6) };
    editor.destroy();
    parent.remove();
    return result;
  });
  assert.equal(crlf.head, crlf.at + 3, 'CRLF: the head is a source offset');
  assert.equal(crlf.marked, '"Two"', 'CRLF: a mark is on its text');
  assert.equal(crlf.lined, 1);
  assert.deepEqual(crlf.decorations.map((item) => item[2]), [true, false], 'CRLF: a line and a mark');
  mark('CRLF text: head, marks, line classes and reveal use source offsets');

  // ---- destroy leaves nothing behind ------------------------------------------------
  assert.equal(await ev(() => { const events = window.events.length; window.ed.destroy(); return events > 0 && window.ed.destroyed; }), true);
  await wait(100);
  assert.equal(await page.locator('.opf-source-code').count(), 0, 'destroy removes the pane');

  // ---- React: the onCursor prop and useOpfCursor -------------------------------------------------------------------------------------------
  await ev((d) => {
    const { React, createRoot } = window.R, h = React.createElement;
    const { OpfEditor, useOpfCursor } = window.opfWs.react;
    window.reactEvents = [];
    function App() {
      const [editor, setEditor] = React.useState(null);
      const cursor = useOpfCursor(editor);
      return h('div', null,
        h('output', { id: 'pointer' }, cursor?.pointer ?? 'none'),
        h('output', { id: 'idpath' }, cursor?.idPath ?? 'none'),
        h(OpfEditor, { id: 'react-editor', style: { width: 1100, height: 600 }, document: d, fonts: window.fonts, catalogs: [window.opfWs.gallery], layout: 'source', source: { cursorDelay: 20, format: 'yaml' },
          onEditor: (value) => { window.reactEditor = value; setEditor(value); }, onCursor: (event) => window.reactEvents.push(event.pointer) }));
    }
    const host = document.createElement('div');
    document.body.append(host);
    createRoot(host).render(h(React.StrictMode, null, h(App)));
  }, deck(10));
  await page.waitForFunction(() => window.opfWs && document.querySelector('#react-editor .opf-source-code .cm-content'), undefined, { timeout: 30000 });
  assert.equal(await page.locator('#pointer').textContent(), 'none', 'the hook is null before the caret moves');
  // Click into the pane (the caret lands somewhere), then move it to the last slide's title.
  await page.locator('#react-editor .cm-content').click();
  await ev(() => { const api = window.reactEditor.sourcePane.editor.api; api.setSelection(api.getValue().indexOf('Slide 10')); });
  await page.waitForFunction(() => /^\/slides\/9(\/|$)/.test(document.querySelector('#pointer').textContent), undefined, { timeout: 5000 });
  const pointer = await page.locator('#pointer').textContent();
  assert.match(pointer, /^\/slides\/9(\/|$)/, `the hook follows the caret to the last slide in the YAML (${pointer})`);
  assert.match(await page.locator('#idpath').textContent(), /^\/slides\/@s10/, 'and has the id path');
  assert.ok((await ev(() => window.reactEvents)).includes(pointer), 'the onCursor prop heard the same');
  mark('React: the onCursor prop and useOpfCursor follow the caret (StrictMode)');

  assert.deepEqual(errors, [], `no page errors: ${errors.join('\n')}`);
  console.log(`source-hooks-browser: ${checks.length} checks passed\n${checks.map((name) => `  - ${name}`).join('\n')}`);
} finally {
  await app.close();
}
