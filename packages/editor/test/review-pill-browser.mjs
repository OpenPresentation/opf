import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { startPartPage } from './support/part-page.mjs';

// CE-29 in a real browser: the review pill (src/review-pill.js) on a bare page with the package stylesheet. Covers every state (checking, valid,
// issues by severity, unavailable), the accessible name, the click and keyboard open, the menu item, disabled, density, a coarse pointer, an iframe
// document, axe in light and dark, and destroy.
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const checks = [];
const mark = (name) => checks.push(name);

const app = await startPartPage({ entry: './src/review-pill.js' });
const { page, errors } = app;
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });
const counts = (error, warning, info, extra = {}) => ({ error, warning, info, total: error + warning + info, all: error + warning + info, sources: ['schema'], unavailable: false, ...extra });
const read = () => ev(() => {
  const el = window.pill.element;
  const icon = el.querySelector('svg');
  return { text: el.textContent, name: el.getAttribute('aria-label'), state: el.dataset.state, severity: el.dataset.severity ?? null, disabled: el.disabled, icon: icon ? icon.innerHTML : null, iconColor: icon ? getComputedStyle(icon).color : null, border: getComputedStyle(el).borderTopColor, color: getComputedStyle(el).color };
});
const token = (name) => ev((n) => { const probe = document.createElement('i'); probe.style.color = `var(${n})`; document.querySelector('#host').append(probe); const c = getComputedStyle(probe).color; probe.remove(); return c; }, name);

try {
  await ev(() => {
    window.opens = 0;
    window.pill = window.part.createReviewPill(document.querySelector('#host'), { onOpen: () => { window.opens += 1; } });
  });

  // ---- states ------------------------------------------------------------------------------------------------------------------------
  let s = await read();
  assert.equal(s.text, 'Checking…');
  assert.equal(s.state, 'checking');
  assert.equal(s.name, 'Review: Checking…');
  assert.equal(await ev(() => window.pill.element.tagName), 'BUTTON');
  assert.equal(await ev(() => window.pill.element.type), 'button');
  mark('before the first update the pill reads Checking…');

  await ev((c) => window.pill.update(c), counts(0, 0, 0));
  s = await read();
  assert.equal(s.text, 'Valid');
  assert.equal(s.state, 'valid');
  assert.equal(s.severity, null);
  assert.equal(s.name, 'Review: Valid');
  assert.equal(s.iconColor, await token('--opf-ui-success'), 'the dot is the success color');
  const validIcon = s.icon;
  mark('no findings reads Valid with a success dot');

  await ev((c) => window.pill.update(c), counts(2, 1, 0));
  s = await read();
  assert.equal(s.text, '3 issues');
  assert.equal(s.state, 'issues');
  assert.equal(s.severity, 'error');
  assert.match(s.name, /^Review: 3 issues \(2 errors, 1 warning\)$/);
  assert.ok(s.name.includes('2 errors, 1 warning'));
  assert.equal(s.iconColor, await token('--opf-ui-danger'));
  assert.equal(s.border, await token('--opf-ui-danger'));
  const errorIcon = s.icon;
  assert.notEqual(errorIcon, validIcon, 'the error glyph differs from the valid dot');
  mark('errors read "3 issues" in the error color, and the name carries the counts');

  await ev((c) => window.pill.update(c), counts(0, 2, 1));
  s = await read();
  assert.equal(s.severity, 'warning');
  assert.equal(s.name, 'Review: 3 issues (2 warnings, 1 note)');
  assert.equal(s.iconColor, await token('--opf-ui-warn'));
  assert.notEqual(s.icon, errorIcon, 'the warning glyph differs from the error glyph (not color alone)');
  const warningIcon = s.icon;

  await ev((c) => window.pill.update(c), counts(0, 0, 1));
  s = await read();
  assert.equal(s.text, '1 issue');
  assert.equal(s.severity, 'info');
  assert.equal(s.name, 'Review: 1 issue (1 note)');
  assert.notEqual(s.icon, warningIcon);
  mark('warnings and notes use their own glyph and color');

  await ev((c) => window.pill.update(c), counts(1, 0, 0, { unavailable: true }));
  s = await read();
  assert.equal(s.state, 'unavailable');
  assert.equal(s.text, 'Review unavailable');
  assert.equal(s.name, 'Review unavailable');
  assert.equal(s.disabled, true, 'an unavailable review cannot be opened');
  assert.equal(await ev(() => window.pill.element.isConnected && getComputedStyle(window.pill.element).display !== 'none'), true, 'it stays visible');
  assert.equal((await ev(() => window.pill.menuItems()[0].disabled)), true);
  mark('an unavailable review stays visible, muted and disabled');

  await ev(() => window.pill.update(null));
  assert.equal((await read()).text, 'Checking…', 'update(null) goes back to Checking…');
  assert.equal((await read()).disabled, false);

  // ---- opening -----------------------------------------------------------------------------------------------------------------------
  await ev((c) => window.pill.update(c), counts(1, 0, 0));
  await page.locator('.opf-review-pill').click();
  assert.equal(await ev(() => window.opens), 1);
  await page.locator('.opf-review-pill').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  assert.equal(await ev(() => window.opens), 3, 'Enter and Space open it');
  assert.equal(await ev(() => document.activeElement === window.pill.element), true, 'focus stays on the pill');
  const outline = await ev(() => getComputedStyle(window.pill.element).outlineStyle);
  assert.notEqual(outline, 'none', 'the keyboard focus is visible');
  mark('click, Enter and Space call onOpen');

  // ---- the menu item, disabled, density -----------------------------------------------------------------------------------------------
  const menu = await ev(() => window.pill.menuItems().map(({ id, label, disabled }) => ({ id, label, disabled })));
  assert.deepEqual(menu, [{ id: 'review', label: 'Review (1)', disabled: false }]);
  await ev(() => window.pill.menuItems()[0].run());
  assert.equal(await ev(() => window.opens), 4, 'the menu item opens the panel too');
  await ev((c) => window.pill.update(c), counts(0, 0, 0));
  assert.equal(await ev(() => window.pill.menuItems()[0].label), 'Review');
  await ev((c) => window.pill.update(c), counts(3, 1, 0));
  assert.equal(await ev(() => window.pill.menuItems()[0].label), 'Review (4)');
  mark('menuItems offers Review (N) and runs onOpen');

  await ev(() => window.pill.setDisabled(true));
  assert.equal((await read()).disabled, true);
  await ev(() => window.pill.element.click());
  assert.equal(await ev(() => window.opens), 4, 'a disabled pill does not open');
  assert.equal(await ev(() => window.pill.menuItems()[0].disabled), true);
  await ev(() => window.pill.setDisabled(false));
  assert.equal((await read()).disabled, false);
  const heightBefore = await ev(() => window.pill.element.getBoundingClientRect().height);
  assert.equal(heightBefore, 32);
  await ev(() => window.pill.setDensity('touch'));
  assert.equal(await ev(() => window.pill.element.getBoundingClientRect().height), 40);
  await ev(() => window.pill.setDensity('comfortable'));
  assert.equal(await ev(() => window.pill.element.getBoundingClientRect().height), 32);
  mark('setDisabled and setDensity work');

  // ---- labels ------------------------------------------------------------------------------------------------------------------------
  await ev(() => {
    window.german = window.part.createReviewPill(document.querySelector('#host'), { labels: { checking: 'Prüfe…', valid: 'Gültig', issues: (n) => `${n} Probleme`, error: (n) => `${n} Fehler`, warning: (n) => `${n} Warnungen`, name: (view) => `Prüfung: ${view.text}` } });
  });
  assert.equal(await ev(() => window.german.element.textContent), 'Prüfe…');
  await ev((c) => window.german.update(c), counts(2, 0, 0));
  assert.equal(await ev(() => window.german.element.textContent), '2 Probleme');
  assert.equal(await ev(() => window.german.element.getAttribute('aria-label')), 'Prüfung: 2 Probleme');
  await ev(() => window.german.destroy());
  mark('labels override the text and the name');

  // ---- an iframe document -------------------------------------------------------------------------------------------------------------
  const framed = await ev(() => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const inner = frame.contentDocument.createElement('div');
    frame.contentDocument.body.append(inner);
    const made = window.part.createReviewPill(inner);
    made.update({ error: 0, warning: 1, info: 0, total: 1 });
    const result = { owner: made.element.ownerDocument === frame.contentDocument, svg: made.element.querySelector('svg').ownerDocument === frame.contentDocument, text: made.element.textContent };
    made.destroy();
    frame.remove();
    return result;
  });
  assert.deepEqual(framed, { owner: true, svg: true, text: '1 issue' });
  mark('it builds in the container\'s own document (an iframe)');

  // ---- axe, light and dark -----------------------------------------------------------------------------------------------------------
  await page.addScriptTag({ content: axeSource });
  const axe = async () => (await ev(async () => (await window.axe.run(document, { rules: Object.fromEntries(['region', 'document-title', 'html-has-lang', 'landmark-one-main', 'page-has-heading-one'].map((id) => [id, { enabled: false }])) })).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)));
  for (const [error, warning, info, extra] of [[0, 0, 0], [2, 1, 0], [0, 2, 0], [0, 0, 2], [0, 0, 0, { unavailable: true }]]) {
    await ev((c) => window.pill.update(c), counts(error, warning, info, extra));
    assert.deepEqual(await axe(), [], `axe is clean in light for ${JSON.stringify([error, warning, info, extra])}`);
  }
  await ev(() => { document.querySelector('#host').dataset.theme = 'dark'; document.body.style.background = getComputedStyle(document.querySelector('#host')).getPropertyValue('--opf-ui-bg'); document.querySelector('#host').style.background = 'var(--opf-ui-bg)'; });
  for (const [error, warning, info, extra] of [[0, 0, 0], [2, 1, 0], [0, 2, 0], [0, 0, 2], [0, 0, 0, { unavailable: true }]]) {
    await ev((c) => window.pill.update(c), counts(error, warning, info, extra));
    assert.deepEqual(await axe(), [], `axe is clean in dark for ${JSON.stringify([error, warning, info, extra])}`);
  }
  await ev(() => { delete document.querySelector('#host').dataset.theme; document.querySelector('#host').style.background = ''; });
  mark('axe finds nothing in light and dark, in every state');

  // ---- destroy -----------------------------------------------------------------------------------------------------------------------
  await ev((c) => window.pill.update(c), counts(1, 0, 0));
  await ev(() => { window.pill.destroy(); window.pill.destroy(); window.pill.update({ error: 1, warning: 0, info: 0, total: 1 }); window.pill.element.click(); });
  assert.equal(await ev(() => document.querySelectorAll('.opf-review-pill').length), 0, 'destroy removes the element');
  assert.equal(await ev(() => window.opens), 4, 'a destroyed pill never calls onOpen');
  mark('destroy removes the pill, is safe twice and ignores later calls');

  assert.deepEqual(errors, []);
} finally {
  await app.close();
}

// ---- a coarse pointer: 44px -------------------------------------------------------------------------------------------------------------
const touch = await startPartPage({ entry: './src/review-pill.js', viewport: { width: 390, height: 800 }, context: { hasTouch: true, isMobile: true } });
try {
  assert.equal(await touch.page.evaluate(() => matchMedia('(pointer: coarse)').matches), true, 'the page has a coarse pointer');
  const sizes = await touch.page.evaluate(() => {
    const pill = window.part.createReviewPill(document.querySelector('#host'));
    const out = {};
    for (const [name, counts] of [['checking', null], ['valid', { error: 0, warning: 0, info: 0, total: 0 }], ['issues', { error: 12, warning: 3, info: 0, total: 15 }]]) {
      pill.update(counts);
      const box = pill.element.getBoundingClientRect();
      out[name] = [Math.round(box.width), Math.round(box.height)];
    }
    return out;
  });
  for (const [name, [width, height]] of Object.entries(sizes)) assert.ok(width >= 44 && height >= 44, `the ${name} pill is at least 44px: ${width}x${height}`);
  mark('under a coarse pointer the pill is at least 44px');
  assert.deepEqual(touch.errors, []);
} finally {
  await touch.close();
}

console.log(`review pill browser: ${checks.length} checks passed`);
for (const name of checks) console.log(`  - ${name}`);
