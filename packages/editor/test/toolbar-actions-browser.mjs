import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { startPartPage } from './support/part-page.mjs';

// CE-29 in a real browser: the toolbar actions part (src/toolbar-actions.js) on a bare page with the package stylesheet. Covers the buttons (label,
// icon from path data and from an element, title, primary), run, enabled and pressed with refresh(), setActions (and focus kept), validation,
// setDisabled, menuItems, labels, density, a coarse pointer, an iframe document, axe in light and dark, and destroy.
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const checks = [];
const mark = (name) => checks.push(name);

const app = await startPartPage({ entry: './src/toolbar-actions.js' });
const { page, errors } = app;
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });
const buttons = () => ev(() => [...document.querySelectorAll('.opf-actions-button')].map((b) => ({ id: b.dataset.action, text: b.textContent, title: b.title, disabled: b.disabled, pressed: b.getAttribute('aria-pressed'), primary: b.classList.contains('is-primary'), icon: !!b.querySelector('svg.opf-actions-icon'), name: b.getAttribute('aria-label') })));

try {
  await ev(() => {
    window.log = [];
    window.state = { shared: false, canPublish: true, busy: false };
    window.makeActions = () => [
      { id: 'share', label: 'Share', title: 'Share this deck', icon: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13', run: () => window.log.push('share') },
      { id: 'publish', label: 'Publish', primary: true, run: () => { window.log.push('publish'); window.state.busy = true; }, enabled: () => window.state.canPublish && !window.state.busy },
      { id: 'notes', label: 'Notes', pressed: () => window.state.shared, run: () => { window.state.shared = !window.state.shared; window.log.push('notes'); } },
    ];
    window.host = document.querySelector('#host');
    window.bar = window.part.createToolbarActions(window.host, { actions: window.makeActions() });
  });

  // ---- the buttons -------------------------------------------------------------------------------------------------------------------
  assert.deepEqual(await buttons(), [
    { id: 'share', text: 'Share', title: 'Share this deck', disabled: false, pressed: null, primary: false, icon: true, name: null },
    { id: 'publish', text: 'Publish', title: '', disabled: false, pressed: null, primary: true, icon: false, name: null },
    { id: 'notes', text: 'Notes', title: '', disabled: false, pressed: 'false', primary: false, icon: false, name: null },
  ]);
  assert.equal(await ev(() => window.bar.element.getAttribute('role')), 'group');
  assert.equal(await ev(() => window.bar.element.getAttribute('aria-label')), 'Actions');
  assert.equal(await ev(() => window.bar.element.querySelector('svg').getAttribute('aria-hidden')), 'true', 'the icon is decorative: the visible label names the button');
  mark('each action is a labelled button; icon, title, primary and pressed show');

  const style = await ev(() => {
    const css = (el) => getComputedStyle(el);
    const probe = (name) => { const i = document.createElement('i'); i.style.color = `var(${name})`; window.host.append(i); const c = css(i).color; i.remove(); return c; };
    const [share, publish] = window.bar.element.querySelectorAll('button');
    return { primaryBg: css(publish).backgroundColor, accent: probe('--opf-ui-accent'), accentFg: probe('--opf-ui-accent-fg'), primaryColor: css(publish).color, plainBg: css(share).backgroundColor, surface: probe('--opf-ui-surface'), height: share.getBoundingClientRect().height };
  });
  assert.equal(style.primaryBg, style.accent, 'primary uses the accent token');
  assert.equal(style.primaryColor, style.accentFg);
  assert.equal(style.plainBg, style.surface);
  assert.equal(style.height, 32);
  mark('primary is styled with the accent tokens');

  // ---- run, enabled, pressed, refresh --------------------------------------------------------------------------------------------------
  await page.locator('[data-action=share]').click();
  assert.deepEqual(await ev(() => window.log), ['share']);
  await page.locator('[data-action=notes]').click();
  assert.equal(await page.locator('[data-action=notes]').getAttribute('aria-pressed'), 'true', 'a click re-reads pressed');
  await page.locator('[data-action=notes]').click();
  assert.equal(await page.locator('[data-action=notes]').getAttribute('aria-pressed'), 'false');
  await page.locator('[data-action=publish]').click();
  assert.equal(await page.locator('[data-action=publish]').isDisabled(), true, 'a click re-reads enabled (run made the host busy)');
  await page.locator('[data-action=publish]').click({ force: true }).catch(() => {});
  assert.deepEqual(await ev(() => window.log), ['share', 'notes', 'notes', 'publish'], 'a disabled action does not run');
  await ev(() => { window.state.busy = false; window.state.shared = true; });
  assert.equal(await page.locator('[data-action=publish]').isDisabled(), true, 'host state is not watched');
  await ev(() => window.bar.refresh());
  assert.equal(await page.locator('[data-action=publish]').isDisabled(), false, 'refresh() re-reads enabled');
  assert.equal(await page.locator('[data-action=notes]').getAttribute('aria-pressed'), 'true', 'refresh() re-reads pressed');
  await ev(() => { window.state.canPublish = false; window.bar.refresh(); });
  assert.equal(await page.locator('[data-action=publish]').isDisabled(), true);
  await ev(() => { window.state.canPublish = true; window.bar.refresh(); });
  await page.locator('[data-action=share]').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  assert.equal((await ev(() => window.log)).filter((entry) => entry === 'share').length, 3, 'Enter and Space run the focused button');
  assert.notEqual(await ev(() => getComputedStyle(document.activeElement).outlineStyle), 'none', 'focus is visible');
  await ev(() => { window.bar.setActions([{ id: 'boom', label: 'Boom', run() {}, enabled: () => { throw new Error('host bug'); }, pressed: () => { throw new Error('host bug'); } }]); });
  assert.deepEqual((await buttons()).map((b) => [b.id, b.disabled, b.pressed]), [['boom', true, 'false']], 'a throwing enabled() or pressed() counts as false');
  mark('run, enabled, pressed and refresh() follow the host state');

  // ---- setActions --------------------------------------------------------------------------------------------------------------------
  await ev(() => window.bar.setActions(window.makeActions()));
  await page.locator('[data-action=share]').focus();
  await ev(() => window.bar.setActions([...window.makeActions(), { id: 'extra', label: 'Extra', run() {} }]));
  assert.equal(await ev(() => document.activeElement?.dataset.action), 'share', 'a focused button keeps the focus across setActions');
  assert.equal((await buttons()).length, 4);
  await ev(() => window.bar.setActions([]));
  assert.equal(await ev(() => window.bar.element.hidden), true, 'no actions hides the group');
  assert.equal(await ev(() => getComputedStyle(window.bar.element).display), 'none');
  await ev(() => window.bar.setActions(window.makeActions()));
  assert.equal(await ev(() => window.bar.element.hidden), false);
  const thrown = await ev(() => {
    const attempts = [
      [{ label: 'x', run() {} }], [{ id: 'x', run() {} }], [{ id: 'x', label: 'x' }],
      [{ id: 'a', label: 'a', run() {} }, { id: 'a', label: 'b', run() {} }], [null],
    ];
    return attempts.map((list) => { try { window.bar.setActions(list); return 'ok'; } catch (error) { return error.name; } });
  });
  assert.deepEqual(thrown, ['TypeError', 'TypeError', 'TypeError', 'TypeError', 'TypeError'], 'a malformed action is a TypeError');
  assert.equal((await buttons()).length, 3, 'a rejected list leaves the old buttons alone');
  mark('setActions replaces the buttons, keeps focus, hides when empty and validates');

  // ---- icons from an element -----------------------------------------------------------------------------------------------------------
  const icon = await ev(() => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', '8'); circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12');
    svg.append(circle);
    window.bar.setActions([{ id: 'dot', label: 'Dot', icon: svg, run() {} }]);
    const made = window.bar.element.querySelector('svg');
    return { copied: made !== svg, circle: !!made.querySelector('circle'), cls: made.getAttribute('class'), aria: made.getAttribute('aria-hidden'), width: made.getBoundingClientRect().width, original: svg.parentNode === null };
  });
  assert.deepEqual(icon, { copied: true, circle: true, cls: 'opf-icon opf-actions-icon', aria: 'true', width: 16, original: true });
  const badIcon = await ev(() => { try { window.bar.setActions([{ id: 'x', label: 'x', icon: 42, run() {} }]); return 'ok'; } catch (error) { return error.name; } });
  assert.equal(badIcon, 'TypeError');
  await ev(() => window.bar.setActions(window.makeActions()));
  mark('an SVG element icon is copied in; anything else is rejected');

  // ---- setDisabled, menuItems --------------------------------------------------------------------------------------------------------
  const items = await ev(() => window.bar.menuItems().map(({ id, label, disabled, pressed }) => ({ id, label, disabled, pressed })));
  assert.deepEqual(items, [
    { id: 'actions:share', label: 'Share', disabled: false, pressed: undefined },
    { id: 'actions:publish', label: 'Publish', disabled: false, pressed: undefined },
    { id: 'actions:notes', label: 'Notes', disabled: false, pressed: true },
  ]);
  await ev(() => window.bar.menuItems()[0].run());
  await ev(() => window.bar.menuItems()[2].run());
  assert.equal((await ev(() => window.log)).at(-2), 'share');
  assert.equal(await page.locator('[data-action=notes]').getAttribute('aria-pressed'), 'false', 'running a menu item refreshes the buttons');
  await ev(() => { window.state.canPublish = false; });
  assert.equal(await ev(() => window.bar.menuItems()[1].disabled), true, 'menuItems reads enabled() now');
  await ev(() => window.state.canPublish = true);
  const before = await ev(() => window.log.length);
  await ev(() => window.bar.setDisabled(true));
  assert.deepEqual((await buttons()).map((b) => b.disabled), [true, true, true]);
  await ev(() => window.bar.menuItems().forEach((item) => item.run()));
  assert.equal(await ev(() => window.log.length), before, 'disabled: neither the buttons nor the menu run');
  assert.equal(await ev(() => window.bar.menuItems().every((item) => item.disabled)), true);
  await ev(() => window.bar.setDisabled(false));
  assert.deepEqual((await buttons()).map((b) => b.disabled), [false, false, false]);
  mark('menuItems mirrors the actions; setDisabled disables buttons and menu items');

  // ---- labels, density ---------------------------------------------------------------------------------------------------------------
  const german = await ev(() => { const mine = window.part.createToolbarActions(window.host, { labels: { group: 'Aktionen' }, actions: [{ id: 'a', label: 'Teilen', run() {} }] }); const name = mine.element.getAttribute('aria-label'); mine.destroy(); return name; });
  assert.equal(german, 'Aktionen');
  await ev(() => window.bar.setDensity('touch'));
  assert.equal(await ev(() => window.bar.element.querySelector('button').getBoundingClientRect().height), 40);
  await ev(() => window.bar.setDensity('comfortable'));
  assert.equal(await ev(() => window.bar.element.querySelector('button').getBoundingClientRect().height), 32);
  mark('labels and density');

  // ---- an iframe document -------------------------------------------------------------------------------------------------------------
  const framed = await ev(() => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const inner = frame.contentDocument.createElement('div');
    frame.contentDocument.body.append(inner);
    const made = window.part.createToolbarActions(inner, { actions: [{ id: 'a', label: 'Teilen', icon: 'M5 12h14', run() {} }] });
    const result = { owner: made.element.ownerDocument === frame.contentDocument, svg: made.element.querySelector('svg').ownerDocument === frame.contentDocument };
    made.destroy();
    frame.remove();
    return result;
  });
  assert.deepEqual(framed, { owner: true, svg: true });
  mark('it builds in the container\'s own document (an iframe)');

  // ---- axe, light and dark -----------------------------------------------------------------------------------------------------------
  await page.addScriptTag({ content: axeSource });
  const axe = () => ev(async () => (await window.axe.run(document, { rules: Object.fromEntries(['region', 'document-title', 'html-has-lang', 'landmark-one-main', 'page-has-heading-one'].map((id) => [id, { enabled: false }])) })).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`));
  assert.deepEqual(await axe(), []);
  await ev(() => { window.host.dataset.theme = 'dark'; window.host.style.background = 'var(--opf-ui-bg)'; });
  assert.deepEqual(await axe(), []);
  await ev(() => { window.bar.setDisabled(true); });
  assert.deepEqual(await axe(), []);
  await ev(() => { window.bar.setDisabled(false); delete window.host.dataset.theme; window.host.style.background = ''; });
  mark('axe finds nothing in light and dark');

  // ---- destroy -----------------------------------------------------------------------------------------------------------------------
  const logged = await ev(() => window.log.length);
  await ev(() => { const stale = window.bar.element.querySelector('button'); window.bar.destroy(); window.bar.destroy(); window.bar.setActions(window.makeActions()); window.bar.refresh(); stale.click(); });
  assert.equal(await ev(() => document.querySelectorAll('.opf-actions').length), 0);
  assert.equal(await ev(() => window.log.length), logged, 'a destroyed bar never runs an action');
  mark('destroy removes the bar, is safe twice and ignores later calls');

  assert.deepEqual(errors, []);
} finally {
  await app.close();
}

// ---- a coarse pointer: 44px -------------------------------------------------------------------------------------------------------------
const touch = await startPartPage({ entry: './src/toolbar-actions.js', viewport: { width: 390, height: 800 }, context: { hasTouch: true, isMobile: true } });
try {
  assert.equal(await touch.page.evaluate(() => matchMedia('(pointer: coarse)').matches), true);
  const sizes = await touch.page.evaluate(() => {
    window.part.createToolbarActions(document.querySelector('#host'), { actions: [{ id: 'a', label: 'Share', run() {} }, { id: 'b', label: 'Publish', primary: true, icon: 'M5 12h14', run() {} }] });
    return [...document.querySelectorAll('.opf-actions-button')].map((b) => { const box = b.getBoundingClientRect(); return [Math.round(box.width), Math.round(box.height)]; });
  });
  for (const [width, height] of sizes) assert.ok(width >= 44 && height >= 44, `an action button is at least 44px: ${width}x${height}`);
  mark('under a coarse pointer every action button is at least 44px');
  assert.deepEqual(touch.errors, []);
} finally {
  await touch.close();
}

console.log(`toolbar actions browser: ${checks.length} checks passed`);
for (const name of checks) console.log(`  - ${name}`);
