import assert from 'node:assert/strict';
import { startStudioPage } from './support/studio-page.mjs';

// LH-166 in the Studio (createOpfEditor with layout "studio"): a selected group has its icon picker in the Design panel, with a host-registered
// icon set (the editor bundles none, so this host registers a tiny one), a pasted SVG that goes into the deck's icons, and the validator's
// refusal; each choice is one undo step (Ctrl/Cmd+Z), and the picker is gone for a block that has no icon of its own.
const checks = [];
const mark = (name) => checks.push(name);
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 12l5 5L20 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
const BAD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><foreignObject width="24" height="24"><div>hi</div></foreignObject></svg>';
const deck = {
  name: 'Growth review',
  language: 'en-US',
  design: { theme: 'classic', fontScheme: 'roboto' },
  slides: [{ id: 'growth', title: 'Where the growth came from', blocks: [
    { id: 'lead', text: 'Enterprise led the growth, and mid-market held steady through the third quarter.' },
    { id: 'pair', composition: { mode: 'row' }, blocks: [{ id: 'left', text: 'Enterprise +38%' }, { id: 'right', text: 'Mid-market +4%' }] },
  ] }],
};
const TINY = { name: 'Tiny', license: 'MIT', copyright: 'Test', viewBox: [0, 0, 24, 24], style: 'stroke', icons: { star: 'M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z', check: 'M4 12l5 5L20 6' }, tags: { star: ['favorite', 'rating'] } };
const app = await startStudioPage();
const { page, errors } = app;
const ev = (fn, arg) => page.evaluate(fn, arg);
const panel = page.locator('.opf-studio-design');
const doc = () => ev(() => window.ed.getDocument());
const keys = () => ev(() => window.ed.selection.map((entry) => entry.key));
async function select(key) {
  await page.keyboard.press('Escape');
  const box = await page.locator(`.opf-studio-box[data-key="${key}"]`).boundingBox();
  await page.mouse.click(box.x + 6, box.y + 6);
  for (let step = 0; step < 3 && (await keys())[0] !== key && (await keys())[0]?.startsWith(key); step += 1) await page.keyboard.press('Shift+Enter');
  await page.waitForFunction((wanted) => window.ed.selection[0]?.key === wanted, key, { timeout: 5000 });
}
const waitDoc = (predicate, message, arg) => page.waitForFunction(({ source, arg }) => new Function('d', 'arg', `return (${source})(d, arg)`)(window.ed.getDocument(), arg), { source: predicate.toString(), arg }, { timeout: 8000 }).catch(async () => assert.fail(`${message}: ${JSON.stringify(await doc()).slice(0, 400)}`));
const undo = () => page.keyboard.press(`${mod}+z`);

try {
  await ev(async ({ d, tiny }) => {
    window.ed?.destroy();
    window.ed = window.opfWs.createOpfEditor(window.makeHost(), { document: d, fonts: window.fonts, catalogs: [window.opfWs.gallery, { source: window.opfWs.gallery.source, iconSets: { tiny } }], layout: 'studio' });
    await window.ed.ready;
  }, { d: deck, tiny: TINY });
  await page.waitForFunction(() => window.ed?.mounted && document.querySelectorAll('.opf-studio-box').length > 1 && !document.querySelector('.opf-canvas-fonts'), undefined, { timeout: 30000 });

  await select('/slides/@growth/blocks/@lead');
  assert.equal(await panel.locator('.opf-icon-picker').isHidden(), true, 'a text block has no icon of its own');
  mark('no picker for a text block');

  await select('/slides/@growth/blocks/@pair');
  await page.waitForFunction(() => document.querySelector('.opf-studio-design').dataset.mode === 'group');
  const choose = panel.getByRole('button', { name: 'Choose icon…', exact: true });
  await choose.waitFor();
  assert.equal(await panel.locator('[data-role="icon-label"]').textContent(), 'Group icon');
  await choose.click();
  assert.deepEqual(await panel.getByLabel('Icon set', { exact: true }).locator('option').allTextContents(), ['All sets', 'Tiny (MIT)'], 'the Studio host registered one set');
  await panel.getByLabel('Search icons', { exact: true }).fill('rating');
  await page.waitForFunction(() => document.querySelector('.opf-ip-tile')?.dataset.icon === 'tiny:star');
  await panel.locator('.opf-ip-tile[data-icon="tiny:star"]').click();
  await waitDoc((d) => d.slides[0].blocks[1].icon === 'tiny:star', 'the group has the icon');
  await page.waitForFunction(() => /tiny:star/.test(document.querySelector('[data-role="icon-value"]').textContent));
  await undo();
  await waitDoc((d) => !('icon' in d.slides[0].blocks[1]), 'one undo removes it');
  mark('a group gets an icon from a registered set, one undo step');

  await panel.locator('[data-role="icon-paste"] summary').click();
  await panel.getByLabel('SVG source', { exact: true }).fill(BAD);
  const before = await doc();
  await panel.getByRole('button', { name: 'Use this SVG', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-role="icon-svg-error"]').textContent !== '');
  assert.match(await panel.locator('[data-role="icon-svg-error"]').textContent(), /foreignObject/i);
  assert.deepEqual(await doc(), before);
  mark('an SVG that cannot be an icon is refused with the finding message');

  await panel.getByLabel('SVG source', { exact: true }).fill(SVG);
  await panel.getByLabel('Name in this deck', { exact: true }).fill('tick');
  await panel.getByRole('button', { name: 'Use this SVG', exact: true }).click();
  await waitDoc((d, svg) => d.icons?.tick === svg && d.slides[0].blocks[1].icon === 'tick', 'the SVG is in the deck icons and referenced by name', SVG);
  await undo();
  await waitDoc((d) => !('icons' in d) && !('icon' in d.slides[0].blocks[1]), 'one undo takes the icon and its map entry back');
  mark('a pasted SVG goes into the deck icons under its name, one undo step');
} catch (error) {
  console.error(error);
  await page.screenshot({ path: 'artifacts/icon-picker-studio-browser-failure.png' }).catch(() => {});
  process.exitCode = 1;
} finally {
  if (errors.length) { console.error('page errors:', errors); process.exitCode = 1; }
  await app.close();
}
if (!process.exitCode) console.log(`icon picker studio browser: ${checks.length} checks passed\n- ${checks.join('\n- ')}`);
