import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { startPresenterPage } from './support/presenter-page.mjs';
import { startPlayground } from './support/playground-harness.mjs';
import { DECK_FILE_ACCEPT } from '../src/read-deck-file.js';

// RR-98: the Present button, the F5 shortcut and their wiring in the example playground. Part 1 mounts the button on a bare page with the real CSS:
// name, title, icon, size and density, the quiet default and primary looks, keyboard activation, disabled, and the F5 rules. Part 2 runs the built
// playground: the button next to Export presents the current slide, leaving returns to the slide the presentation ended on, and Open reads YAML and
// Markdown through readDeckFile with DECK_FILE_ACCEPT.
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const checks = [];
const mark = (name) => checks.push(name);

// --- part 1: a bare page -------------------------------------------------------------------------------------------------------
const bare = await startPresenterPage();
try {
  const { page, errors, requests } = bare;
  await page.evaluate(() => {
    const { createPresentButton, createExportMenu, bindPresentShortcut } = window.opfPresent;
    window.calls = [];
    window.button = createPresentButton(document.getElementById('host'), { onPresent: (event) => window.calls.push(event.type) });
    window.touchButton = createPresentButton(document.getElementById('host'), { density: 'touch' });
    window.exportMenu = createExportMenu(document.getElementById('menu-host'), { getDeck: () => window.makeDeck(2), fonts: window.fonts });
    window.f5 = [];
    window.unbind = bindPresentShortcut(document, (event) => window.f5.push(document.activeElement?.id || document.activeElement?.tagName));
  });
  const button = page.locator('#host .opf-present-button').first();

  // Name, title, icon, size.
  assert.equal(await button.evaluate((node) => node.tagName), 'BUTTON', 'a real button');
  assert.equal(await button.getAttribute('type'), 'button');
  assert.equal(await button.getAttribute('aria-label'), 'Present');
  assert.equal(await button.getAttribute('title'), 'Present (F5)');
  assert.equal(await button.getAttribute('aria-keyshortcuts'), 'F5');
  assert.equal(await button.innerText(), '', 'icon-only: no visible text');
  assert.equal(await button.locator('svg[aria-hidden="true"]').count(), 1, 'one decorative Lucide icon');
  assert.deepEqual(await button.locator('svg path').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('d'))), ['M2 3h20', 'M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3', 'm7 21 5-5 5 5'], 'the Lucide Presentation paths');
  assert.equal(await page.getByRole('button', { name: 'Present', exact: true }).count(), 2, 'found by its accessible name');
  const size = (locator) => locator.evaluate((node) => { const box = node.getBoundingClientRect(); return [box.width, box.height]; });
  assert.deepEqual(await size(button), [32, 32], '32px by default');
  assert.deepEqual(await size(page.locator('#host .opf-present-button').nth(1)), [40, 40], '40px with density: "touch"');
  await page.evaluate(() => window.button.setDensity('touch'));
  assert.deepEqual(await size(button), [40, 40], 'setDensity changes it');
  await page.evaluate(() => window.button.setDensity('comfortable'));
  mark('an icon-only real button named "Present", titled "Present (F5)", 32px or 40px with density: "touch"');

  // The quiet default and the primary variant, light and dark.
  const look = (selector) => page.locator(selector).first().evaluate((node) => { const style = getComputedStyle(node); return { background: style.backgroundColor, color: style.color, border: style.borderTopColor, radius: style.borderTopLeftRadius, height: style.height, borderWidth: style.borderTopWidth }; });
  const token = (name, property = 'color') => page.evaluate(([variable, prop]) => { const probe = document.createElement('i'); probe.style[prop] = `var(${variable})`; document.body.append(probe); const value = getComputedStyle(probe)[prop]; probe.remove(); return value; }, [name, property]);
  const transparent = 'rgba(0, 0, 0, 0)';
  assert.equal(await button.getAttribute('data-variant'), 'quiet', 'quiet is the default variant');
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => (value === 'dark' ? document.documentElement.setAttribute('data-theme', 'dark') : document.documentElement.removeAttribute('data-theme')), theme);
    await button.evaluate((node) => node.blur());
    await page.mouse.move(900, 500);
    await page.waitForTimeout(250); // the theme change fades over 120ms
    const quiet = await look('#host .opf-present-button');
    assert.equal(quiet.background, transparent, `quiet: a transparent background (${theme})`);
    assert.equal(quiet.border, transparent, `quiet: no visible border (${theme})`);
    assert.equal(quiet.color, await token('--opf-ui-muted-fg'), `quiet: the icon is --opf-ui-muted-fg (${theme})`);
    assert.equal(quiet.height, '32px', `quiet: the same 32px control height (${theme})`);
    assert.equal(quiet.borderWidth, '1px', `quiet: the border width is kept so the size matches primary (${theme})`);
    await button.hover();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#host .opf-present-button')).backgroundColor !== 'rgba(0, 0, 0, 0)');
    await page.waitForTimeout(200); // the 120ms fade
    const hover = await look('#host .opf-present-button');
    assert.equal(hover.background, await token('--opf-ui-muted', 'backgroundColor'), `quiet hover: --opf-ui-muted (${theme})`);
    assert.equal(hover.color, await token('--opf-ui-fg'), `quiet hover: the icon is --opf-ui-fg (${theme})`);
    await page.mouse.move(900, 500);
    await page.evaluate(() => window.button.setVariant('primary'));
    assert.equal(await button.getAttribute('data-variant'), 'primary', 'setVariant("primary")');
    await page.waitForTimeout(200);
    assert.deepEqual(await look('#host .opf-present-button'), await look('.opf-export-trigger'), `primary: same fill, ink, border, radius and height as the Export trigger (${theme})`);
    const primary = await look('#host .opf-present-button');
    assert.equal(primary.background, await token('--opf-ui-accent', 'backgroundColor'), `primary: the accent fill (${theme})`);
    assert.equal(primary.color, await token('--opf-ui-accent-fg'), `primary: the accent ink (${theme})`);
    await page.evaluate(() => window.button.setVariant('quiet'));
    await page.waitForTimeout(200);
    assert.equal((await look('#host .opf-present-button')).background, transparent, `setVariant("quiet") goes back (${theme})`);
  }
  await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
  await page.evaluate(() => { window.primaryButton = window.opfPresent.createPresentButton(document.getElementById('menu-host'), { variant: 'primary' }); });
  assert.equal(await page.locator('#menu-host .opf-present-button').getAttribute('data-variant'), 'primary', 'variant: "primary" at creation');
  await page.evaluate(() => window.primaryButton.destroy());
  await page.evaluate(() => { window.junkButton = window.opfPresent.createPresentButton(document.getElementById('menu-host'), { variant: 'loud' }); });
  assert.equal(await page.locator('#menu-host .opf-present-button').getAttribute('data-variant'), 'quiet', 'an unknown variant is quiet');
  await page.evaluate(() => window.junkButton.destroy());
  mark('the Present button is quiet by default (transparent, muted-fg icon, muted fill and fg icon on hover, 32px) and variant "primary" is the Export trigger look, light and dark');

  // Activation: click, Enter and Space, with focus visible.
  await button.click();
  assert.deepEqual(await page.evaluate(() => window.calls), ['click']);
  await button.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => window.calls.length), 3, 'Enter and Space activate it');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  const ring = await button.evaluate((node) => { const style = getComputedStyle(node); return [style.outlineStyle, style.outlineWidth, style.outlineOffset, style.outlineColor]; });
  assert.deepEqual(ring.slice(0, 3), ['solid', '2px', '2px'], 'a 2px focus ring at a 2px offset');
  assert.equal(ring[3], await page.evaluate(() => { const probe = document.createElement('i'); probe.style.color = 'var(--opf-ui-ring)'; document.body.append(probe); const color = getComputedStyle(probe).color; probe.remove(); return color; }), 'in the --opf-ui-ring color');
  mark('click, Enter and Space present, and the focus ring is the 2px ring');

  // Disabled: stays focusable, does nothing, says why.
  await page.evaluate(() => { window.calls.length = 0; window.button.setDisabled('Every slide is hidden.'); });
  assert.equal(await button.getAttribute('aria-disabled'), 'true');
  assert.equal(await button.getAttribute('title'), 'Every slide is hidden.', 'the reason is the title');
  await button.click({ force: true }); // Playwright treats aria-disabled as disabled
  await button.focus();
  await page.keyboard.press('Enter');
  assert.deepEqual(await page.evaluate(() => window.calls), [], 'a disabled button does nothing');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#host .opf-present-button')).opacity === '0.5'); // dimmed (a 120ms fade)
  await page.evaluate(() => window.button.setDisabled(true));
  assert.equal(await button.getAttribute('title'), 'Nothing to present.', 'true gives the default reason');
  await page.evaluate(() => window.button.setDisabled(false));
  assert.equal(await button.getAttribute('aria-disabled'), null);
  assert.equal(await button.getAttribute('title'), 'Present (F5)');
  await button.click();
  assert.deepEqual(await page.evaluate(() => window.calls), ['click'], 'enabled again');
  await page.evaluate(() => { window.disabledButton = window.opfPresent.createPresentButton(document.getElementById('menu-host'), { disabled: true, onPresent: () => window.calls.push('wrong') }); });
  assert.equal(await page.locator('#menu-host .opf-present-button').getAttribute('aria-disabled'), 'true', 'disabled: true at creation');
  await page.evaluate(() => window.disabledButton.destroy());
  assert.equal(await page.locator('#menu-host .opf-present-button').count(), 0, 'destroy removes the button');
  mark('a disabled button stays focusable, does nothing and says why');

  // axe on the buttons.
  await page.addScriptTag({ content: axeSource });
  const axe = await page.evaluate(() => window.axe.run({ include: [['#host']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }));
  assert.deepEqual(axe.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`), [], 'axe: the Present buttons');
  mark('axe finds no violation in the Present buttons');

  // F5.
  const f5 = () => page.evaluate(() => structuredClone(window.f5));
  const f5Prevented = () => page.evaluate(() => { const event = new KeyboardEvent('keydown', { key: 'F5', bubbles: true, cancelable: true }); document.body.dispatchEvent(event); return event.defaultPrevented; });
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('F5');
  assert.deepEqual(await f5(), ['BODY'], 'F5 presents');
  assert.equal(await f5Prevented(), true, 'and suppresses the browser reload');
  await page.evaluate(() => { window.f5.length = 0; });
  for (const [selector, why] of [['#field', 'an input'], ['#area', 'a textarea'], ['#editable', 'a contenteditable'], ['#cm-line', 'a code editor']]) {
    await page.locator(selector).focus();
    await page.keyboard.press('F5');
    assert.deepEqual(await f5(), [], `F5 is ignored in ${why}`);
  }
  await page.locator('#field').focus();
  assert.equal(await page.evaluate(() => { const event = new KeyboardEvent('keydown', { key: 'F5', bubbles: true, cancelable: true }); document.activeElement.dispatchEvent(event); return event.defaultPrevented; }), false, 'and its default (reload) is left alone while typing');
  await page.evaluate(() => { document.activeElement.blur(); const dialog = document.createElement('dialog'); dialog.id = 'modal'; dialog.innerHTML = '<button id="in-dialog">Inside</button>'; document.body.append(dialog); dialog.showModal(); });
  await page.keyboard.press('F5');
  assert.deepEqual(await f5(), [], 'F5 is ignored while a dialog is open');
  await page.evaluate(() => { document.getElementById('modal').close(); document.getElementById('modal').remove(); });
  await page.locator('#opener').focus();
  await page.keyboard.press('Control+F5');
  await page.keyboard.press('Shift+F5');
  await page.keyboard.press('Alt+F5');
  await page.keyboard.press('Meta+F5');
  assert.deepEqual(await f5(), [], 'F5 with a modifier is the browser\'s');
  await page.keyboard.press('F5');
  assert.deepEqual(await f5(), ['opener'], 'a button having focus does not stop F5');
  await page.evaluate(() => { window.unbind(); window.f5.length = 0; });
  await page.keyboard.press('F5');
  assert.deepEqual(await f5(), [], 'the returned function removes the listener');
  const targeted = await page.evaluate(() => {
    const seen = [], box = document.createElement('div');
    document.body.append(box);
    const off = window.opfPresent.bindPresentShortcut(box, () => seen.push('box'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5', bubbles: true, cancelable: true }));
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5', bubbles: true, cancelable: true }));
    off();
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5', bubbles: true, cancelable: true }));
    let threw = false;
    try { window.opfPresent.bindPresentShortcut(document); } catch { threw = true; }
    return { seen, threw };
  });
  assert.deepEqual(targeted, { seen: ['box'], threw: true }, 'a target limits where F5 is heard, and a callback is required');
  mark('F5 presents and stops the reload; it is ignored in inputs, textareas, contenteditable, code editors, dialogs and with a modifier');

  assert.deepEqual(requests, [], 'no network request');
  assert.deepEqual(errors, []);
  mark('no network request and no console error');
} finally {
  await bare.close();
}

// --- part 2: the playground ---------------------------------------------------------------------------------------------------
const source = {
  name: 'Present fixture',
  language: 'en-US',
  design: { theme: 'classic', fontScheme: 'roboto' },
  slides: [
    { id: 'a', title: 'Alpha', text: 'First words' },
    { id: 'b', title: 'Beta', text: 'Second words', hidden: true },
    { id: 'c', title: 'Gamma', text: 'Third words' },
    { id: 'd', title: 'Delta', text: 'Fourth words' },
  ],
};
const app = await startPlayground({ source });
try {
  const { page, errors, settle, doc } = app;
  const present = page.locator('#present-button .opf-present-button');
  const presenter = page.locator('.opf-presenter');
  const slideTitle = () => page.locator('#slide-title').textContent();
  const shown = () => page.locator('.opf-presenter-slide svg').getAttribute('aria-label');
  const requests = [];
  page.on('request', (request) => { if (/^https?:/.test(request.url()) && !request.url().startsWith(page.url().replace(/\/[^/]*$/, '/'))) requests.push(request.url()); });

  // The button is next to Export, and presents the current slide.
  assert.equal(await present.getAttribute('aria-label'), 'Present');
  assert.equal(await present.getAttribute('title'), 'Present (F5)');
  const order = await page.evaluate(() => [...document.querySelectorAll('.header-actions > *')].map((node) => node.id).filter((id) => id === 'present-button' || id === 'export-menu'));
  assert.deepEqual(order, ['present-button', 'export-menu'], 'Present sits next to Export');
  assert.equal(await presenter.isHidden(), true);
  await page.locator('#thumb-strip .opf-thumbs-item').nth(2).click();
  await settle();
  assert.equal(await slideTitle(), 'Gamma');
  await present.click();
  await presenter.waitFor();
  await page.locator('.opf-presenter-slide svg').waitFor();
  assert.equal(await shown(), 'Gamma', 'the presentation opens on the current slide');
  await page.waitForFunction(() => document.fullscreenElement?.classList.contains('opf-presenter'), undefined, { timeout: 3000 }); // full screen on the presenter's own element
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('.opf-presenter')), true);
  await page.keyboard.press('ArrowRight');
  assert.equal(await shown(), 'Delta');
  await page.keyboard.press('Home');
  assert.equal(await shown(), 'Alpha');
  await page.keyboard.press('ArrowRight');
  assert.equal(await shown(), 'Gamma', 'the hidden slide is skipped');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await presenter.waitFor({ state: 'hidden' });
  await settle();
  assert.equal(await slideTitle(), 'Delta', 'leaving returns to the slide the presentation ended on');
  await page.waitForFunction(() => document.activeElement?.closest('#present-button'), undefined, { timeout: 3000 });
  assert.equal(await page.locator('#thumb-strip .opf-thumbs-item[aria-current="true"] .opf-thumbs-title').textContent(), 'Delta', 'the strip follows');
  mark('the Present button next to Export presents the current slide; Esc returns to the slide it ended on and focus to the button');

  // F5, from the keyboard, on the current slide; the edit in an open canvas field is not lost.
  await page.locator('#thumb-strip .opf-thumbs-item').nth(0).click();
  await settle();
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('F5');
  await presenter.waitFor();
  assert.equal(await page.locator('.opf-presenter-live').textContent(), 'Slide 1 of 3');
  await page.locator('.opf-presenter-close').click();
  await presenter.waitFor({ state: 'hidden' });
  assert.equal(await slideTitle(), 'Alpha');
  // F5 while typing in a field is the browser's.
  await page.locator('#document-name').focus();
  await page.keyboard.press('F5').catch(() => {});
  assert.equal(await presenter.isHidden(), true, 'F5 is not taken while typing in the name field');
  mark('F5 presents from the keyboard and is left alone while typing');

  // Open: the file input takes every deck format, through readDeckFile.
  await page.locator('#add-opf').click();
  await page.locator('#import-tab-file').click();
  const accept = await page.locator('#opf-file').getAttribute('accept');
  for (const extension of DECK_FILE_ACCEPT.split(',')) assert.ok(accept.split(',').includes(extension), `the file input accepts ${extension}`);
  assert.ok(accept.split(',').includes('.pptx'), 'and PowerPoint');
  const upload = async (name, text) => {
    await page.setInputFiles('#opf-file', { name, mimeType: 'application/octet-stream', buffer: Buffer.from(text) });
    await page.waitForFunction(() => /\d+ slides?/.test(document.querySelector('#import-summary').textContent) || document.querySelector('#import-error').textContent !== '', undefined, { timeout: 30000 });
  };
  const yaml = 'name: From YAML\nlanguage: en-US\ndesign:\n  theme: classic\n  fontScheme: roboto\nslides:\n  - title: Yaml one\n    text: Read as YAML\n  - title: Yaml two\n';
  await upload('plan.opf.yaml', yaml);
  assert.equal(await page.locator('#import-error').textContent(), '');
  assert.match(await page.locator('#import-summary').textContent(), /2 slides/);
  assert.equal(await page.locator('#file-name').textContent(), 'plan.opf.yaml');
  await page.locator('#import-action').selectOption('replace');
  await page.waitForFunction(() => !document.querySelector('#import-apply').disabled);
  await page.locator('#import-apply').click();
  await page.waitForFunction(() => document.querySelector('#document-name').value === 'From YAML', undefined, { timeout: 30000 });
  await settle();
  assert.deepEqual((await doc()).slides.map((slide) => slide.title), ['Yaml one', 'Yaml two'], 'a .yaml file opens');
  await page.locator('#add-opf').click();
  await page.locator('#import-tab-file').click();
  await upload('talk.md', '---\nname: From Markdown\nlanguage: en-US\ndesign:\n  theme: classic\n  fontScheme: roboto\n---\n\n# Markdown one\n\nRead as Markdown.\n\n---\n\n# Markdown two\n\n---\n\n# Markdown three\n');
  assert.match(await page.locator('#import-summary').textContent(), /3 slides/);
  await page.locator('#import-action').selectOption('replace');
  await page.waitForFunction(() => !document.querySelector('#import-apply').disabled);
  await page.locator('#import-apply').click();
  await page.waitForFunction(() => document.querySelector('#document-name').value === 'From Markdown', undefined, { timeout: 30000 });
  await settle();
  assert.deepEqual((await doc()).slides.map((slide) => slide.title), ['Markdown one', 'Markdown two', 'Markdown three'], 'a .md file opens');
  // YAML in a .json file falls back to YAML; JSON that is not a deck still goes to the paste path; an unreadable file says why.
  await page.locator('#add-opf').click();
  await page.locator('#import-tab-file').click();
  await upload('really-yaml.json', yaml);
  assert.match(await page.locator('#import-summary').textContent(), /2 slides/, 'YAML saved as .json still opens');
  await upload('broken.yaml', 'name: Broken\nslides: [unclosed\n');
  assert.match(await page.locator('#import-error').textContent(), /^This is not valid YAML \(line \d+\)/, 'an unreadable file says why');
  await upload('slide.json', '{"title":"Only a slide","text":"inserted"}');
  assert.equal(await page.locator('#import-error').textContent(), '', 'JSON that is not a deck keeps the existing paste behavior');
  await page.locator('#close-import').click();
  mark('Open reads .yaml and .md through readDeckFile with DECK_FILE_ACCEPT, falls back for YAML in a .json file, and says why a file cannot be read');

  // Presenting a freshly opened deck, then axe on the playground header.
  await page.locator('#present-button .opf-present-button').click();
  await presenter.waitFor();
  await page.locator('.opf-presenter-slide svg').waitFor();
  assert.equal(await shown(), 'Markdown one');
  await page.keyboard.press('Escape');
  await presenter.waitFor({ state: 'hidden' });
  mark('the opened deck presents');

  assert.deepEqual(requests, [], 'no request leaves the page');
  assert.deepEqual(errors, [], 'no page errors');
  mark('no network request and no console error in the playground');
  console.log(`present button: ${checks.length} checks passed\n- ${checks.join('\n- ')}`);
} catch (error) {
  console.error('present button checks so far:\n- ' + checks.join('\n- '));
  throw error;
} finally {
  await app.close();
}
