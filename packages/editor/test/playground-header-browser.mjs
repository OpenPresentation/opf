import assert from 'node:assert/strict';
import { startPlayground } from './support/playground-harness.mjs';

// CE-30: the playground's top bar (the page pptx.gallery embeds). Since 0.30 it carries more items than fit, and they wrapped into two rows and
// squeezed the deck name to "A pres…". The header actions are now the editor's toolbar (`slots.toolbar`, the page's buttons as items of its own):
// one row on every desktop width with the deck name at least 180px wide, the items that do not fit in ⋯ by priority and reachable by keyboard,
// the autosave line in the bar, and at phone width the existing "More" panel, where every item shows and nothing collapses.
const checks = [];
const mark = (name) => checks.push(name);
const playground = await startPlayground({ contextOptions: { viewport: { width: 1440, height: 900 } } });
const { page, errors } = playground;

// The bar at the current width: the name field, the bar's height, whether the visible items share one row, and what is in ⋯.
const measure = () => page.evaluate(() => {
  const rect = (node) => node.getBoundingClientRect();
  const shown = (node) => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
  const bar = document.querySelector('.document-bar');
  const items = [...document.querySelectorAll('.header-actions .opf-tb > *')].filter(shown);
  const tops = items.map((node) => Math.round(rect(node).top + rect(node).height / 2));
  return {
    name: Math.round(rect(document.querySelector('#document-name')).width),
    bar: Math.round(rect(bar).height),
    rows: new Set(tops.map((top) => Math.round(top / 8))).size,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    autosave: shown(document.querySelector('#autosave-status')) && bar.contains(document.querySelector('#autosave-status')),
    collapsed: window.opfEditor.toolbar.collapsed,
    more: shown(document.querySelector('.header-actions .opf-tb-more-button')),
  };
});
const visible = (name) => page.getByRole('button', { name, exact: true }).isVisible();
const settle = async () => {
  await page.waitForTimeout(100);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
};

try {
  // ---- the contract hosts and their tests depend on ------------------------------------------------------------------------------
  for (const id of ['document-name', 'json', 'apply-json', 'open-json', 'restore-banner', 'autosave-status']) assert.ok(await page.locator(`#${id}`).count(), `#${id} is on the page`);
  assert.equal(await page.evaluate(() => typeof window.opfEditor?.toolbar?.update), 'function', 'window.opfEditor is the handle, with the toolbar');
  for (const name of ['Undo', 'Redo', 'Source', 'Import', 'Save OPF', 'Export', 'Present']) assert.equal(await visible(name), true, `"${name}" is a visible button at 1440px`);
  mark('the ids, window.opfEditor and the buttons hosts press (Undo, Redo, Source, Import, Save OPF, Export, Present) are there at 1440px');

  // ---- one row and a readable name on every desktop width ------------------------------------------------------------------------
  const desktop = {};
  for (const width of [1440, 1920, 1280, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await settle();
    const at = desktop[width] = await measure();
    assert.ok(at.name >= 180, `${width}px: the deck name is ${at.name}px wide (at least 180)`);
    assert.equal(at.rows, 1, `${width}px: the header actions are one row`);
    assert.ok(at.bar <= 60, `${width}px: the bar is one row high (${at.bar}px)`);
    assert.equal(at.overflowX, 0, `${width}px: nothing scrolls sideways`);
    assert.equal(at.autosave, true, `${width}px: the autosave line shows in the bar`);
    assert.equal(await visible('Source'), true, `${width}px: Source stays in the bar on a desktop width`);
    if (width >= 1280) assert.equal(await visible('Import'), true, `${width}px: Import stays in the bar (pptx.gallery's e2e presses it at 1280px and 1440px)`);
    assert.ok(!at.collapsed.includes('save') && !at.collapsed.includes('export') && !at.collapsed.includes('present'), `${width}px: Save OPF, Export and Present stay (${at.collapsed})`);
  }
  assert.ok(desktop[1024].collapsed.length >= desktop[1920].collapsed.length, 'a narrower bar moves more into ⋯');
  mark(`1024-1920px: one row (${desktop[1440].bar}px), the name at least 180px (${desktop[1440].name}px at 1440), the autosave line, Source, Save, Export and Present in the bar (Import too from 1280px)`);

  // ---- a narrow desktop window: the low-priority items move into ⋯ and stay reachable by keyboard -----------------------------------
  await page.setViewportSize({ width: 960, height: 900 });
  await settle();
  const narrow = await measure();
  assert.equal(narrow.rows, 1, '960px: one row');
  assert.ok(narrow.name >= 180, `960px: the deck name is ${narrow.name}px wide`);
  assert.equal(narrow.more, true, '960px: ⋯ shows');
  for (const id of ['import', 'copy', 'properties', 'tools']) assert.ok(narrow.collapsed.includes(id), `960px: ${id} is in ⋯ (${narrow.collapsed})`);
  const more = page.getByRole('button', { name: 'More', exact: true });
  await more.focus();
  await page.keyboard.press('ArrowDown');
  const entries = await page.getByRole('menuitem').allTextContents();
  for (const label of ['Import', 'Copy OPF', 'All properties', 'Import data', 'Fill template', 'List numbering']) assert.ok(entries.includes(label), `⋯ lists "${label}" (${entries})`);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('role')), 'menuitem', 'ArrowDown opens ⋯ on its first entry');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'More', 'Escape closes ⋯ and gives the focus back to it');
  await more.press('Enter');
  await page.getByRole('menuitem', { name: 'All properties', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.locator('#properties-dialog[open]').waitFor({ timeout: 5000 });
  await page.locator('#close-properties').click();
  mark(`960px: ${narrow.collapsed.join(', ')} in ⋯, opened with ArrowDown, closed with Escape, an entry run with Enter`);

  // ---- phone width: the "More" panel shows every item on wrapped rows, nothing in ⋯ (the items collapsed at 960px come back) ----------
  await page.setViewportSize({ width: 800, height: 900 });
  await settle();
  assert.equal(await page.getByRole('navigation', { name: 'Editing tools' }).isVisible(), true, '800px: the phone layout and its Editing tools bar');
  await page.locator('#more-actions').click();
  await settle();
  const phone = await measure();
  assert.deepEqual(phone.collapsed, [], '800px: nothing is in ⋯ inside the More panel');
  assert.equal(phone.more, false, '800px: no ⋯ beside the More button');
  for (const name of ['Source', 'Save OPF', 'Export', 'Import', 'Copy OPF', 'All properties', 'Import data']) assert.equal(await visible(name), true, `800px: "${name}" shows in the More panel`);
  assert.equal(phone.overflowX, 0, '800px: nothing scrolls sideways');
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await page.locator('#source-dialog[open]').waitFor({ timeout: 5000 });
  await page.locator('#close-json').click();
  await page.locator('#more-actions').click();
  mark('800px: More opens the panel with every header item (the ones in ⋯ at 960px included); Source opens the source dialog');

  // ---- back to a desktop width: the bar fits itself again --------------------------------------------------------------------------
  await page.setViewportSize({ width: 1440, height: 900 });
  await settle();
  const again = await measure();
  assert.deepEqual(again.collapsed, desktop[1440].collapsed, 'back at 1440px the same items are in ⋯');
  assert.equal(again.rows, 1);
  mark('back at 1440px the bar collapses the same items again');

  assert.deepEqual(errors, [], 'no page errors');
} finally {
  await playground.close();
}
for (const check of checks) console.log(`ok - ${check}`);
console.log(`CE-30 playground header: ${checks.length} checks ok`);
