import assert from 'node:assert/strict';
import { startWorkspacePage, deck } from './support/workspace-page.mjs';

// CE-30 in a real browser: what openpresentation.org met adopting the editor. A `present` item in the `toolbar` list of a host that arranges
// the parts with `slots` brings Present, as `export` brings Export.
const checks = [];
const mark = (name) => checks.push(name);

// ---- a listed `present` item works where the host arranges the parts --------------------------------------------------------------------
{
  const app = await startWorkspacePage({ body: '<div id="host" style="width:1000px;height:640px"><div id="bar"></div><div id="canvas" style="width:900px;height:520px"></div></div>' });
  try {
    const mount = (options) => app.page.evaluate(async ({ d, options }) => {
      window.ed?.destroy();
      const host = document.querySelector('#host');
      window.ed = window.opfWs.createOpfEditor(host, { document: d, fonts: window.fonts, catalogs: [window.opfWs.gallery], ...options, slots: { toolbar: host.querySelector('#bar'), canvas: host.querySelector('#canvas') } });
      await window.ed.ready;
      await window.ed.whenIdle();
      return {
        layout: host.querySelector('.opf-workspace')?.dataset.opfLayout ?? null,
        items: [...host.querySelectorAll('#bar .opf-tb > [data-opf-toolbar-item]')].map((node) => node.dataset.opfToolbarItem),
        button: Boolean(host.querySelector('#bar [data-opf-slot="present"] button')),
        presenter: Boolean(window.ed.presenter),
      };
    }, { d: deck(), options });
    const listed = await mount({ toolbar: ['title', 'spacer', 'present', 'export', 'more'] });
    assert.deepEqual(listed, { layout: 'slots', items: ['title', 'spacer', 'present', 'export', 'more'], button: true, presenter: true }, 'the listed present item is built, with its button and the presenter');
    const started = await app.page.evaluate(async () => {
      document.querySelector('#bar [data-opf-slot="present"] button').click();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const running = window.ed.presenter.isRunning();
      window.ed.presenter.stop();
      return running;
    });
    assert.equal(started, true, 'its button starts the presentation');
    mark('`slots` with a `toolbar` list: a listed `present` builds the Present button and the presenter, as a listed `export` builds Export');
    const off = await mount({ toolbar: ['title', 'spacer', 'present', 'export', 'more'], panels: { present: false } });
    assert.deepEqual(off, { layout: 'slots', items: ['title', 'spacer', 'export', 'more'], button: false, presenter: false }, '`panels.present: false` still turns it off');
    mark('`panels.present: false` still leaves the listed item out');
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
}

for (const name of checks) console.log(`ok - ${name}`);
console.log(`embed host checks passed (${checks.length})`);
