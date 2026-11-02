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

// ---- `embed`, `viewer` and `canvas` fit their slide in a short box on a phone -------------------------------------------------------------
// The phone rules of workspace.css (below 760px) stack the source, the slide and the side panel of the full layout; they gave a single-column
// layout a stage of at least 40vh and a main column that did not shrink, so a short embed overflowed and the slide fit to nothing.
{
  const app = await startWorkspacePage({ viewport: { width: 375, height: 812 }, body: '<div id="host" style="width:375px;height:300px"></div>' });
  try {
    for (const layout of ['embed', 'viewer', 'canvas']) {
      const fit = await app.page.evaluate(async ({ d, layout }) => {
        window.ed?.destroy();
        const host = document.querySelector('#host');
        window.ed = window.opfWs.createOpfEditor(host, { document: d, layout, fonts: window.fonts, catalogs: [window.opfWs.gallery] });
        await window.ed.ready;
        await window.ed.whenIdle();
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const box = host.getBoundingClientRect();
        const slide = host.querySelector('.opf-ws-canvas').getBoundingClientRect();
        const svg = host.querySelector('.opf-ws-canvas svg')?.getBoundingClientRect();
        const overflows = [host, ...host.querySelectorAll('.opf-workspace, .opf-ws-body, .opf-ws-main, .opf-ws-stage')]
          .filter((node) => node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1)
          .map((node) => `${node.className || node.id}: ${node.scrollWidth}x${node.scrollHeight} in ${node.clientWidth}x${node.clientHeight}`);
        return {
          phone: matchMedia('(max-width: 760px)').matches,
          slide: [slide.width, slide.height].map(Math.round),
          svg: svg ? [svg.width, svg.height].map(Math.round) : null,
          inside: slide.top >= box.top - 0.5 && slide.bottom <= box.bottom + 0.5 && slide.left >= box.left - 0.5 && slide.right <= box.right + 0.5,
          workspace: Math.round(host.querySelector('.opf-workspace').getBoundingClientRect().height),
          overflows,
        };
      }, { d: deck(), layout });
      assert.equal(fit.phone, true, 'the page is phone width');
      // The canvas layout gives most of a 300px box to its slide row (previous, counter, next and the thumbnails), so its slide is small, but there.
      const least = layout === 'canvas' ? [40, 20] : [300, 150];
      assert.ok(fit.slide[0] >= least[0] && fit.slide[1] >= least[1], `${layout}: the slide has a size in a 375x300 box (${fit.slide.join('x')})`);
      assert.ok(fit.svg && fit.svg[0] >= least[0] - 2 && fit.svg[1] >= least[1] - 2, `${layout}: the slide is drawn (${fit.svg?.join('x')})`);
      assert.equal(fit.inside, true, `${layout}: the slide is inside the box`);
      assert.equal(fit.workspace, 300, `${layout}: the editor is the box's height`);
      assert.deepEqual(fit.overflows, [], `${layout}: nothing overflows`);
      mark(`${layout} at 375x300 on a phone-width page: the slide fits (${fit.slide.join('x')}), nothing overflows`);
    }
    // The full layout keeps the phone stack: the source above the slide, the body scrolls.
    const stacked = await app.page.evaluate(async (d) => {
      window.ed?.destroy();
      const host = document.querySelector('#host');
      host.style.height = '700px';
      window.ed = window.opfWs.createOpfEditor(host, { document: d, fonts: window.fonts, catalogs: [window.opfWs.gallery] });
      await window.ed.ready;
      await window.ed.whenIdle();
      const source = host.querySelector('.opf-ws-source').getBoundingClientRect();
      const main = host.querySelector('.opf-ws-main').getBoundingClientRect();
      return { direction: getComputedStyle(host.querySelector('.opf-ws-body')).flexDirection, below: main.top >= source.bottom - 0.5, stage: getComputedStyle(host.querySelector('.opf-ws-stage')).minHeight };
    }, deck());
    assert.deepEqual(stacked, { direction: 'column', below: true, stage: `${Math.round(812 * 0.4 * 100) / 100}px` }, 'the full layout still stacks on a phone');
    mark('the full layout still stacks the source above the slide on a phone');
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
}

for (const name of checks) console.log(`ok - ${name}`);
console.log(`embed host checks passed (${checks.length})`);
