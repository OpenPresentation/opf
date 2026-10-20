// RR-98: the agent handoff dialog (src/agent-handoff-dialog.js) in a real browser: its ARIA, the target switch, that the prompt in the box is
// exactly what `buildAgentHandoff` writes for each target and embeds the deck's exact JSON, the line count, Copy prompt ("Copied" for 1.2 s,
// the clipboard really holds the prompt, and the fallback when the browser refuses), Download .md, the focus trap, Escape, and the focus that
// returns to the opener. The target is chosen with the mouse and with the arrow keys.
import assert from 'node:assert/strict';
import { buildAgentHandoff } from '../src/agent-handoff.js';
import { startFixture, deck } from './support/export-fixture.mjs';

const checks = [];
const mark = (name) => checks.push(name);
const app = await startFixture({ contextOptions: { viewport: { width: 1000, height: 800 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] } });
const { page, errors } = app;
try {
  const dialog = page.getByRole('dialog', { name: 'Agent handoff' });
  const prompt = page.getByRole('textbox', { name: 'Prompt for a coding agent' });
  const radio = (name) => page.getByRole('radio', { name });
  const copyButton = page.getByRole('button', { name: /^(Copy prompt|Copied)$/ });
  const activeLabel = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim());
  const open = () => page.evaluate(() => { window.closes = 0; window.openHandoff({ onClose: () => { window.closes++; } }); });
  const jsonOf = (markdown) => markdown.match(/^(`{3,})json\n([\s\S]*)\n\1$/m)[2];

  // ---- structure and ARIA ------------------------------------------------------------------------------------------------------------------
  await page.locator('#before').focus();
  await open();
  await dialog.waitFor();
  assert.equal(await dialog.getAttribute('aria-modal'), 'true');
  assert.equal(await page.getByRole('heading', { name: 'Agent handoff', level: 2 }).count(), 1, 'the dialog is named by its heading');
  assert.match(await dialog.getAttribute('aria-describedby'), /description/);
  assert.match(await dialog.innerText(), /Paste this into a coding agent\. It carries the deck JSON and tells the agent to install @openpresentation\/opf, validate the deck and render it\./);
  assert.match(await dialog.innerText(), /Nothing is sent anywhere\./);
  const group = page.getByRole('radiogroup');
  assert.equal(await group.count(), 1);
  assert.match(await page.locator('.opf-handoff-render').innerText(), /^Render to$/);
  assert.deepEqual(await page.getByRole('radio').allInnerTexts(), ['PowerPoint (.pptx)', 'PDF', 'SVG slides']);
  assert.equal(await radio('PowerPoint (.pptx)').getAttribute('aria-checked'), 'true', 'the default target is PowerPoint');
  assert.equal(await prompt.getAttribute('readonly'), '', 'the prompt is read-only');
  assert.equal(await prompt.evaluate((n) => getComputedStyle(n).fontFamily.toLowerCase().includes('mono')), true, 'in mono');
  assert.equal(await page.locator('.opf-handoff-file').innerText(), 'deck-handoff.md');
  const box = await dialog.boundingBox();
  assert.ok(box.width <= 680 && box.width > 600, `the dialog is 680px wide: ${box.width}`);
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('[role=radio][aria-checked=true]')), true, 'focus starts on the selected target');
  mark('structure');

  // ---- the prompt, for each target ---------------------------------------------------------------------------------------------------------
  for (const [name, target] of [['PowerPoint (.pptx)', 'pptx'], ['PDF', 'pdf'], ['SVG slides', 'svg']]) {
    await radio(name).click();
    const expected = buildAgentHandoff(deck, { target });
    const shown = await prompt.inputValue();
    assert.equal(shown, expected.markdown, `${target}: the box shows exactly what buildAgentHandoff writes`);
    assert.equal(jsonOf(shown), JSON.stringify(deck, null, 2), `${target}: and embeds the deck's exact JSON`);
    assert.equal(await page.locator('.opf-handoff-count').innerText(), `${expected.lines} lines`, `${target}: the line count`);
    assert.equal(await radio(name).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByRole('radio', { checked: true }).count(), 1);
    assert.match(shown, new RegExp(`deck to ${name.replace(/[()]/g, '\\$&')}\\.`));
  }
  assert.ok((await prompt.inputValue()).includes('npx opf convert deck.opf.json deck.svg'));
  mark('prompt per target');

  // The arrow keys move through the targets (roving tabindex).
  await radio('PowerPoint (.pptx)').click();
  await radio('PowerPoint (.pptx)').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await radio('PDF').getAttribute('aria-checked'), 'true');
  assert.equal(await activeLabel(), 'PDF', 'focus follows the selection');
  await page.keyboard.press('ArrowDown');
  assert.equal(await radio('SVG slides').getAttribute('aria-checked'), 'true');
  await page.keyboard.press('ArrowRight');
  assert.equal(await radio('PowerPoint (.pptx)').getAttribute('aria-checked'), 'true', 'wraps around');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await radio('SVG slides').getAttribute('aria-checked'), 'true');
  await page.keyboard.press('Home');
  assert.equal(await radio('PowerPoint (.pptx)').getAttribute('aria-checked'), 'true');
  await page.keyboard.press('End');
  assert.equal(await radio('SVG slides').getAttribute('aria-checked'), 'true');
  assert.deepEqual(await page.getByRole('radio').evaluateAll((nodes) => nodes.map((n) => n.tabIndex)), [-1, -1, 0], 'only the selected target is a Tab stop');
  assert.equal(await prompt.inputValue(), buildAgentHandoff(deck, { target: 'svg' }).markdown);
  const focusStyle = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return [s.outlineStyle, s.outlineWidth, s.outlineOffset]; });
  assert.deepEqual(focusStyle, ['solid', '2px', '2px'], 'the 2px focus ring');
  mark('target keys');

  // ---- Copy prompt -------------------------------------------------------------------------------------------------------------------------
  await radio('PDF').click();
  const expectedPdf = buildAgentHandoff(deck, { target: 'pdf' }).markdown;
  assert.equal(await copyButton.innerText(), 'Copy prompt');
  assert.equal(await copyButton.evaluate((n) => n.querySelectorAll('svg').length), 1);
  const iconBefore = await copyButton.evaluate((n) => n.querySelector('svg').outerHTML);
  const started = Date.now();
  await copyButton.click();
  await page.waitForFunction(() => document.querySelector('.opf-handoff-copy span').textContent === 'Copied');
  assert.equal(await copyButton.innerText(), 'Copied', 'the button says Copied');
  assert.notEqual(await copyButton.evaluate((n) => n.querySelector('svg').outerHTML), iconBefore, 'with a Check icon');
  assert.equal(await copyButton.evaluate((n) => n.querySelector('svg path').getAttribute('d')), 'M20 6 9 17l-5-5', 'the Lucide Check path');
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), expectedPdf, 'the clipboard holds the prompt');
  await page.waitForFunction(() => /Prompt copied/.test(document.querySelector('.opf-handoff-live').textContent));
  assert.equal(await page.locator('.opf-handoff-live').getAttribute('aria-live'), 'polite');
  await page.waitForTimeout(500);
  assert.equal(await copyButton.innerText(), 'Copied', 'still Copied half a second later');
  await page.waitForFunction(() => document.querySelector('.opf-handoff-copy span').textContent === 'Copy prompt');
  const shownFor = Date.now() - started;
  assert.ok(shownFor >= 1100 && shownFor < 1900, `Copied shows for about 1.2s: ${shownFor}ms`);
  assert.equal(await copyButton.evaluate((n) => n.querySelector('svg path, svg rect') !== null && n.querySelectorAll('svg').length), 1);
  assert.equal(await copyButton.evaluate((n) => n.querySelector('svg rect') !== null), true, 'the Copy icon is back');
  // The copy follows the target: another target, another prompt.
  await radio('SVG slides').click();
  await copyButton.click();
  await page.waitForFunction(() => document.querySelector('.opf-handoff-copy span').textContent === 'Copied');
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), buildAgentHandoff(deck, { target: 'svg' }).markdown);
  await radio('PDF').click();
  assert.equal(await copyButton.innerText(), 'Copy prompt', 'changing the target resets the button');
  mark('copy');

  // When the browser refuses, the prompt is selected for a manual copy and the label stays.
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } }); document.execCommand = () => false; });
  await copyButton.click();
  await page.waitForFunction(() => /Could not copy/.test(document.querySelector('.opf-handoff-live').textContent));
  assert.equal(await copyButton.innerText(), 'Copy prompt', 'no false "Copied"');
  assert.equal(await page.evaluate(() => { const t = document.querySelector('.opf-handoff-prompt'); return t.selectionStart === 0 && t.selectionEnd === t.value.length; }), true, 'the prompt is selected');
  mark('copy refused');

  // ---- Download .md ----------------------------------------------------------------------------------------------------------------------------
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .md' }).click();
  const file = await event;
  assert.equal(file.suggestedFilename(), 'deck-handoff.md');
  assert.equal(await (await import('node:fs/promises')).readFile(await file.path(), 'utf8'), expectedPdf);
  mark('download');

  // ---- focus: trap, Escape, return --------------------------------------------------------------------------------------------------------
  await radio('PDF').click();
  const order = [];
  await radio('PDF').focus();
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); order.push(await activeLabel()); }
  const inside = await page.evaluate(() => document.querySelector('.opf-handoff-dialog').contains(document.activeElement));
  assert.equal(inside, true, 'Tab never leaves the dialog');
  assert.deepEqual(order.slice(0, 6), ['Prompt for a coding agent', 'Close', 'Download .md', 'Copy prompt', 'Close', 'PDF'], 'the order is the prompt, Close, Download, Copy, then around through the X and the target');
  // Shift+Tab from the first stop (the X) wraps to the last (Copy prompt).
  await page.getByRole('button', { name: 'Close', exact: true }).first().focus();
  await page.keyboard.press('Shift+Tab');
  assert.equal(await activeLabel(), 'Copy prompt', 'Shift+Tab from the first stop wraps to the last');
  // Focus pushed out of the dialog comes straight back.
  await page.evaluate(() => document.getElementById('after').focus());
  assert.equal(await page.evaluate(() => document.querySelector('.opf-handoff-dialog').contains(document.activeElement)), true, 'focus cannot be moved to the page behind the dialog');
  mark('focus trap');

  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => window.closes), 1, 'onClose is called once');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'before', 'Escape returns focus to the element that opened the dialog');
  assert.equal(await page.locator('.opf-handoff').count(), 0, 'and removes the dialog');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.closes), 1, 'Escape is not handled once it is closed');

  // Close, the X and the scrim close too, each returning focus.
  for (const how of ['Close', 'X', 'scrim']) {
    await page.locator('#after').focus();
    await open();
    await dialog.waitFor();
    if (how === 'Close') await page.locator('.opf-handoff-close').click();
    else if (how === 'X') await page.getByRole('button', { name: 'Close', exact: true }).first().click();
    else await page.mouse.click(10, 10);
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.activeElement.id), 'after', `${how}: focus returns to the opener`);
    assert.equal(await page.evaluate(() => window.closes), 1);
  }
  // A click inside the dialog does not close it.
  await open();
  await dialog.waitFor();
  await prompt.click();
  await page.locator('.opf-handoff-dialog').click({ position: { x: 5, y: 5 } });
  assert.equal(await dialog.isVisible(), true);
  await page.evaluate(() => window.dialog.destroy());
  assert.equal(await page.locator('.opf-handoff').count(), 0, 'destroy removes it');
  assert.equal(await page.evaluate(() => window.closes), 0, 'destroy is not a close');
  mark('close');

  // ---- options and the touch density ------------------------------------------------------------------------------------------------------
  await page.evaluate(() => window.openHandoff({ target: 'svg', fileName: 'talk.opf.json', specUrl: 'https://example.test/spec', agentGuideUrl: 'https://example.test/agents', density: 'touch' }));
  const custom = buildAgentHandoff(deck, { target: 'svg', fileName: 'talk.opf.json', specUrl: 'https://example.test/spec', agentGuideUrl: 'https://example.test/agents' });
  assert.equal(await prompt.inputValue(), custom.markdown);
  assert.equal(await radio('SVG slides').getAttribute('aria-checked'), 'true');
  assert.ok((await page.getByRole('button', { name: 'Copy prompt' }).boundingBox()).height >= 40, 'touch density makes the buttons 40px');
  // setDocument re-writes the prompt.
  await page.evaluate(() => window.dialog.setDocument({ name: 'Replaced', slides: [{ title: 'New' }] }));
  assert.match(await prompt.inputValue(), /"name": "Replaced"/);
  assert.equal(await page.locator('.opf-handoff-count').innerText(), `${buildAgentHandoff({ name: 'Replaced', slides: [{ title: 'New' }] }, { target: 'svg', fileName: 'talk.opf.json', specUrl: 'https://example.test/spec', agentGuideUrl: 'https://example.test/agents' }).lines} lines`);
  await page.keyboard.press('Escape');
  mark('options');

  // A phone: the dialog fits and the footer buttons are reachable.
  await page.setViewportSize({ width: 390, height: 700 });
  await open();
  await dialog.waitFor();
  const phone = await dialog.boundingBox();
  assert.ok(phone.x >= 0 && phone.x + phone.width <= 390 && phone.y >= 0 && phone.y + phone.height <= 700, `the dialog fits a 390px phone: ${JSON.stringify(phone)}`);
  for (const name of ['Close', 'Download .md', 'Copy prompt']) {
    const buttonBox = await page.getByRole('button', { name, exact: true }).last().boundingBox();
    assert.ok(buttonBox.x >= 0 && buttonBox.x + buttonBox.width <= 390, `${name} is on screen`);
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= 390), true);
  await page.keyboard.press('Escape');
  mark('phone');

  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, browser: app.browser.version(), checks }, null, 2));
} finally {
  await app.close();
}
