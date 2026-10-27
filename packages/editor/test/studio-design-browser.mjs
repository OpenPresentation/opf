import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { startStudioPage } from './support/studio-page.mjs';

// The Studio's Design panel shows options, not explanations (owner feedback on CE-20): for a selected text block and a selected group, in light
// and dark, there is no helper paragraph or warning list; every option is a visible control with a short name; an option or action that does not
// apply is disabled with its reason as its tooltip and accessible description; the structural actions are one row of named icon buttons whose
// tooltips show their shortcuts; the internal path is a copyable chip under Advanced; and axe finds no serious or critical violation.
const checks = [];
const mark = (name) => checks.push(name);
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const deck = {
  name: 'Growth review',
  language: 'en-US',
  design: { theme: 'classic', fontScheme: 'roboto' },
  slides: [{ id: 'growth', title: 'Where the growth came from', blocks: [
    { id: 'lead', text: 'Enterprise led the growth, and mid-market held steady through the third quarter.' },
    { id: 'pair', composition: { mode: 'row' }, blocks: [{ id: 'left', text: 'Enterprise +38%' }, { id: 'right', text: 'Mid-market +4%' }] },
  ] }],
};
const app = await startStudioPage();
const { page, errors } = app;
const ev = (fn, arg) => page.evaluate(fn, arg);
const keys = () => ev(() => window.ed.selection.map((entry) => entry.key));
const panel = page.locator('.opf-studio-design');
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';

async function mount(scheme) {
  await ev(async ({ d, scheme }) => {
    window.ed?.destroy();
    window.ed = window.opfWs.createOpfEditor(window.makeHost(), { document: d, ...window.base(), layout: 'studio', theme: { colorScheme: scheme } });
    await window.ed.ready;
  }, { d: deck, scheme });
  await page.waitForFunction(() => window.ed?.mounted && document.querySelectorAll('.opf-studio-box').length > 1 && !document.querySelector('.opf-canvas-fonts'), undefined, { timeout: 30000 });
}
// Select a block by a click near its corner; a click that lands on a child climbs to the block with Shift+Enter (select parent).
async function select(key) {
  await page.keyboard.press('Escape');
  const box = await page.locator(`.opf-studio-box[data-key="${key}"]`).boundingBox();
  await page.mouse.click(box.x + 6, box.y + 6);
  for (let step = 0; step < 3 && (await keys())[0] !== key && (await keys())[0]?.startsWith(key); step += 1) await page.keyboard.press('Shift+Enter');
  await page.waitForFunction((wanted) => window.ed.selection[0]?.key === wanted, key, { timeout: 5000 }).catch(async () => assert.fail(`select ${key}: got ${JSON.stringify(await keys())}`));
}
// Visible text in paragraphs and list items of the panel, other than its live regions (the status and error lines, empty until something happens).
const helperText = () => panel.evaluate((root) => [...root.querySelectorAll('p, li')]
  .filter((node) => node.checkVisibility() && node.textContent.trim() && !node.matches('[role=status], [role=alert], [aria-live]'))
  .map((node) => node.textContent.trim()));
async function axe(label) {
  if (!(await ev(() => Boolean(window.axe)))) await page.addScriptTag({ content: axeSource });
  const found = await ev(() => window.axe.run(document.querySelector('.opf-studio-design'), { resultTypes: ['violations'] }).then((result) => result.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact)).map((violation) => `${violation.id}: ${violation.nodes.slice(0, 3).map((node) => node.target.join(' ')).join(' | ')}`)));
  assert.deepEqual(found, [], `axe (${label}) has no serious or critical violations`);
}
// The accessibility tree's name, description and disabled state of the nodes matching `role` (Chromium, through the DevTools protocol).
async function axNodes(role) {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  await cdp.detach();
  return nodes.filter((node) => node.role?.value === role && !node.ignored).map((node) => ({
    name: node.name?.value ?? '',
    description: node.description?.value ?? '',
    disabled: node.properties?.some((property) => property.name === 'disabled' && property.value.value === true) ?? false,
  }));
}

try {
  for (const scheme of ['light', 'dark']) {
    await mount(scheme);
    // ---- a selected text block -------------------------------------------------------------------------------------------------------------
    await select('/slides/@growth/blocks/@lead');
    await panel.locator('[data-role="arrange"]').waitFor();
    assert.deepEqual(await helperText(), [], `${scheme}: a selected text block shows no helper paragraphs or warning lists`);
    assert.equal(await panel.locator('.opf-dc-help, .opf-studio-field-help, .opf-dc-warnings').count(), 0, 'and no help or warning nodes at all');
    // One row of named icon buttons; a tooltip shows the shortcut, or why the action does not apply.
    const tools = await panel.locator('[data-role="arrange"] button').evaluateAll((nodes) => nodes.map((node) => [node.getAttribute('aria-label'), node.title, node.getAttribute('aria-disabled') === 'true']));
    assert.deepEqual(tools.map((entry) => entry[0]), ['Move up', 'Move down', 'Group with the next block', 'Ungroup', 'Duplicate', 'Delete'], 'the structural actions are one toolbar row');
    const tip = Object.fromEntries(tools.map(([name, title, disabled]) => [name, { title, disabled }]));
    assert.match(tip.Duplicate.title, /^Duplicate \((⌘|Ctrl\+)D\)$/, 'a tooltip shows the shortcut');
    assert.match(tip['Move down'].title, /^Move down \(\]\)$/);
    assert.deepEqual(tip.Ungroup, { title: 'Ungroup: This block is not inside a group.', disabled: true }, 'a disabled action says why in its tooltip');
    // Disabled actions stay focusable, so their reason is reachable from the keyboard.
    await panel.getByRole('button', { name: 'Ungroup', exact: true }).focus();
    assert.equal(await ev(() => document.activeElement?.getAttribute('aria-label')), 'Ungroup');
    // Every content type is listed; the ones this text cannot become are disabled with the reason as their tooltip.
    const options = await panel.getByLabel('Content type').locator('option').evaluateAll((nodes) => nodes.map((node) => [node.textContent, node.disabled, node.title]));
    const metric = options.find((entry) => entry[0] === 'Metric');
    assert.deepEqual(metric.slice(1), [true, 'Metric: The first line is longer than 24 characters.'], 'an unavailable type is disabled with a short reason');
    assert.deepEqual(options.find((entry) => entry[0] === 'Table').slice(1), [true, 'Table: This text has no table structure.']);
    // The reason is in the accessibility tree: the option's and the button's description.
    const ax = await axNodes('option');
    assert.deepEqual(ax.find((node) => node.name === 'Metric'), { name: 'Metric', description: 'Metric: The first line is longer than 24 characters.', disabled: true }, 'a disabled option exposes its reason');
    const ungroupAx = (await axNodes('button')).find((node) => node.name === 'Ungroup');
    assert.deepEqual(ungroupAx, { name: 'Ungroup', description: 'Ungroup: This block is not inside a group.', disabled: true }, 'a disabled action exposes its reason');
    // The internal path is a copyable chip under Advanced, hidden until Advanced opens.
    const chip = panel.locator('.opf-studio-path');
    assert.equal(await chip.isVisible(), false, 'no path in the panel until Advanced opens');
    assert.equal(await panel.getByText('slides.0.blocks.0').count() === 0 || !(await panel.getByText('slides.0.blocks.0').first().isVisible()), true);
    await panel.locator('.opf-studio-design-advanced > summary').click();
    assert.equal(await chip.getAttribute('aria-label'), 'Copy path slides.0.blocks.0');
    assert.equal(await chip.isVisible(), true);
    await axe(`${scheme}, a text block, Advanced open`);
    await panel.locator('.opf-studio-design-advanced > summary').click();
    mark(`${scheme}: a text block shows controls, not explanations; reasons and shortcuts are tooltips; the path is a chip under Advanced; axe is clean`);

    // ---- a selected group --------------------------------------------------------------------------------------------------------------------
    await select('/slides/@growth/blocks/@pair');
    await page.waitForFunction(() => document.querySelector('.opf-studio-design').dataset.mode === 'group');
    assert.deepEqual(await helperText(), [], `${scheme}: a selected group shows no helper paragraphs`);
    assert.deepEqual(await panel.getByRole('group', { name: 'Arrangement' }).getByRole('button').evaluateAll((nodes) => nodes.map((node) => [node.getAttribute('aria-label'), node.title, node.getAttribute('aria-pressed')])), [['Auto', 'Auto', 'false'], ['Grid', 'Grid', 'false'], ['Row', 'Row', 'true'], ['Column', 'Column', 'false']], 'the arrangement is four named icon segments');
    assert.match(await panel.locator('[data-field="gap"]').getAttribute('title'), /shorter side/, 'the gap unit is a tooltip');
    const groupTools = await panel.locator('[data-role="arrange"] button').evaluateAll((nodes) => Object.fromEntries(nodes.map((node) => [node.getAttribute('aria-label'), node.getAttribute('aria-disabled') === 'true'])));
    assert.equal(groupTools.Ungroup, false, 'a selected group can be ungrouped from the toolbar');
    assert.equal(groupTools['Group with the next block'], true, 'the last block has nothing to group with');
    await axe(`${scheme}, a group`);
    mark(`${scheme}: a group shows its arrangement as icon segments and its units as tooltips; axe is clean`);
  }

  // The toolbar runs the same commands as the shortcuts: Duplicate, then Undo.
  await select('/slides/@growth/blocks/@lead');
  await panel.getByRole('button', { name: 'Duplicate', exact: true }).click();
  await page.waitForFunction(() => window.ed.getDocument().slides[0].blocks.length === 3);
  await page.keyboard.press(`${mod}+z`);
  await page.waitForFunction(() => window.ed.getDocument().slides[0].blocks.length === 2);
  // Ungroup from the toolbar dissolves the selected group in one undoable step.
  await select('/slides/@growth/blocks/@pair');
  await page.waitForFunction(() => document.querySelector('.opf-studio-design').dataset.mode === 'group');
  await panel.getByRole('button', { name: 'Ungroup', exact: true }).click();
  await page.waitForFunction(() => window.ed.getDocument().slides[0].blocks.length === 3);
  await page.keyboard.press(`${mod}+z`);
  await page.waitForFunction(() => window.ed.getDocument().slides[0].blocks.length === 2);
  mark('the toolbar duplicates and ungroups, each one undo step');
} catch (error) {
  console.error(error);
  await page.screenshot({ path: 'artifacts/studio-design-browser-failure.png' }).catch(() => {});
  process.exitCode = 1;
} finally {
  if (errors.length) { console.error('page errors:', errors); process.exitCode = 1; }
  await app.close();
}
if (!process.exitCode) console.log(`studio design browser: ${checks.length} checks passed\n- ${checks.join('\n- ')}`);
