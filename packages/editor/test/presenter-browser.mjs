import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { startPresenterPage } from './support/presenter-page.mjs';

// RR-98: the presenter (src/presenter.js) in a real browser, on a bare host page with the real module, the real CSS and the renderer's browser fonts
// handle. Covers start, the Fullscreen API and the overlay fallback, every key, the click zones, swipes, the counter, hidden slides, onExit and
// onSlideChange, focus, the dialog and live-region semantics, preloading, the fonts gate, the letterbox, destroy and no network. The Present button
// is in test/present-button-browser.mjs.
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const checks = [];
const mark = (name) => checks.push(name);
const app = await startPresenterPage({ hasTouch: true });
const { page, context, errors, requests } = app;
try {
  const shown = () => page.evaluate(() => window.presenter.getSlide());
  const counter = () => page.locator('.opf-presenter-counter').textContent();
  const live = () => page.locator('.opf-presenter-live').textContent();
  const log = () => page.evaluate(() => structuredClone(window.log));
  const title = () => page.evaluate(() => document.querySelector('.opf-presenter-slide svg')?.getAttribute('aria-label'));
  // The shown slide once it is `index`: touch events reach the page a little later on a slow machine.
  const shownBecomes = async (index, message) => {
    await page.waitForFunction((wanted) => window.presenter.getSlide() === wanted, index, { timeout: 3000 }).catch(() => {});
    assert.equal(await shown(), index, `${message}; input seen by the page: ${JSON.stringify(await page.evaluate(() => window.inputLog?.slice(-12)))}`);
  };
  const press = async (key, times = 1) => { for (let i = 0; i < times; i++) await page.keyboard.press(key); };
  // Mount a presenter on `count` slides with the slides in `hidden` hidden; every callback is logged in the page.
  const mount = (count, hidden = [], extra = '{}') => page.evaluate(([n, h, extraSource]) => {
    window.presenter?.destroy();
    window.log = { exits: [], changes: [] };
    window.editor = window.makeEditor(n, h);
    const extra = new Function(`return (${extraSource})`)();
    window.presenter = window.opfPresent.createPresenter(document.getElementById('host'), {
      editor: window.editor, fonts: window.fonts,
      onExit: (index) => window.log.exits.push(index), onSlideChange: (index) => window.log.changes.push(index), ...extra,
    });
  }, [count, hidden, extra]);
  const open = async (index) => {
    await page.waitForFunction(() => !document.fullscreenElement); // a stop() before this one is still leaving full screen
    await page.locator('#opener').focus();
    return page.evaluate((i) => window.presenter.start(i), index);
  };

  await page.evaluate(() => { window.realRequest = Element.prototype.requestFullscreen; window.realWebkit = Element.prototype.webkitRequestFullscreen; });
  const realFullscreen = () => page.evaluate(() => { Element.prototype.requestFullscreen = window.realRequest; Element.prototype.webkitRequestFullscreen = window.realWebkit; });

  // ---- structure, start and the dialog semantics ----------------------------------------------------------------------------------------
  await mount(5, [1, 4]);
  const root = page.locator('.opf-presenter');
  assert.equal(await root.isHidden(), true, 'nothing shows until start()');
  assert.equal(await page.locator('#host > .opf-presenter').count(), 1, 'the element is mounted in the container');
  assert.equal(await root.getAttribute('role'), 'dialog');
  assert.equal(await root.getAttribute('aria-modal'), 'true');
  assert.equal(await root.getAttribute('aria-label'), 'Presentation');
  assert.equal(await page.evaluate(() => window.presenter.element === document.querySelector('.opf-presenter')), true, 'element is the root');
  assert.equal(await page.evaluate(() => Object.keys(window.presenter).sort().join()), 'destroy,element,getSlide,goTo,isRunning,next,previous,start,stop');
  assert.equal(await shown(), -1, 'no slide is shown before start()');
  assert.deepEqual(await page.evaluate(() => window.svgCalls ?? []), [], 'nothing is drawn until start()');
  mark('hidden until start, role=dialog aria-modal with a label');

  const mode = await open(0);
  assert.equal(mode, 'fullscreen', 'the browser gave the element full screen');
  assert.equal(await page.evaluate(() => document.fullscreenElement === window.presenter.element), true, 'the Fullscreen API is used on the presenter\'s own element');
  assert.equal(await root.getAttribute('data-mode'), 'fullscreen');
  assert.equal(await root.isVisible(), true);
  assert.equal(await page.evaluate(() => document.activeElement === window.presenter.element), true, 'focus moves into the dialog on start');
  assert.equal(await title(), 'Slide 1', 'the first slide is drawn');
  assert.equal(await live(), 'Slide 1 of 3', 'the live region announces the position among the shown slides');
  assert.equal(await page.locator('.opf-presenter-live').getAttribute('aria-live'), 'polite');
  assert.equal(await page.locator('.opf-presenter-live').getAttribute('role'), 'status');
  assert.equal(await page.evaluate(() => window.presenter.isRunning()), true);
  mark('start() goes full screen on its own element, focuses the dialog, draws slide 1 and announces it');

  // The slide fills the viewport and is letterboxed on black.
  const slideBox = () => page.evaluate(() => { const box = document.querySelector('.opf-presenter-slide svg > rect').getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; });
  const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1, `${message}: ${actual} is not ${expected}`);
  let box = await slideBox();
  near(box.width, 1000, 'a wide window fills the width'); near(box.height, 562.5, 'at 16:9'); near(box.y, 18.75, 'with equal bars above and below');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.opf-presenter')).backgroundColor), 'rgb(0, 0, 0)', 'the bars are black');
  mark('the slide fills the viewport and letterboxes on black');

  // ---- keys ---------------------------------------------------------------------------------------------------------------------------------
  assert.equal(await counter(), '01 / 03', 'hidden slides are not counted');
  for (const key of ['ArrowRight', ' ', 'PageDown', 'Enter']) {
    await page.evaluate(() => window.presenter.goTo(0));
    await press(key);
    assert.equal(await shown(), 2, `${JSON.stringify(key)} goes forward, over the hidden slide`);
  }
  for (const key of ['ArrowLeft', 'PageUp', 'Backspace']) {
    await page.evaluate(() => window.presenter.goTo(3));
    await press(key);
    assert.equal(await shown(), 2, `${key} goes back`);
  }
  await press('Home');
  assert.equal(await shown(), 0, 'Home goes to the first slide');
  await press('End');
  assert.equal(await shown(), 3, 'End goes to the last slide that is not hidden');
  assert.equal(await counter(), '03 / 03');
  assert.equal(await live(), 'Slide 3 of 3');
  await press('ArrowRight');
  assert.equal(await shown(), 3, 'forward stops at the last slide');
  await press('Home');
  await press('ArrowLeft');
  assert.equal(await shown(), 0, 'back stops at the first slide');
  assert.equal(await title(), 'Slide 1');
  await press('ArrowRight');
  assert.equal(await title(), 'Slide 3', 'the hidden slide 2 is skipped, as the exports skip it');
  assert.equal(await live(), 'Slide 2 of 3');
  await press('End');
  assert.equal(await title(), 'Slide 4', 'the hidden last slide is skipped too');
  assert.deepEqual(await page.evaluate(() => [window.presenter.next(), window.presenter.previous(), window.presenter.goTo(0), window.presenter.goTo(0)]), [false, true, true, false], 'next, previous and goTo report whether the slide changed');
  mark('Right, Space, PageDown and Enter go forward; Left, PageUp and Backspace go back; Home and End jump; hidden slides are skipped');

  // goTo(hidden) shows the next slide that is not hidden; includeHidden shows everything.
  await page.evaluate(() => window.presenter.goTo(4));
  assert.equal(await shown(), 3, 'goTo past the last visible slide shows the last one');
  await page.evaluate(() => window.presenter.goTo(1));
  assert.equal(await shown(), 2, 'goTo a hidden slide shows the next one that is not hidden');
  const before = await log();
  assert.deepEqual(before.changes.slice(0, 1), [2], 'onSlideChange reports deck indexes');
  mark('goTo snaps to a slide that is not hidden, and onSlideChange reports deck indexes');

  // Keys are the presenter's while it is open: the host page does not see them.
  await page.evaluate(() => { window.hostKeys = 0; document.body.addEventListener('keydown', () => { window.hostKeys++; }); });
  await press('ArrowRight');
  assert.equal(await page.evaluate(() => window.hostKeys), 0, 'a handled key does not reach the host page');
  await press('F7');
  assert.equal(await page.evaluate(() => window.hostKeys), 1, 'a key the presenter does not use still does');
  // Modified keys are the browser's.
  await page.evaluate(() => window.presenter.goTo(0));
  await page.keyboard.press('Control+ArrowRight');
  await page.keyboard.press('Alt+ArrowRight');
  assert.equal(await shown(), 0, 'Ctrl and Alt combinations are left alone');
  mark('handled keys stay inside the presenter; modified keys are left to the browser');

  // ---- click zones --------------------------------------------------------------------------------------------------------------------
  await page.evaluate(() => window.presenter.goTo(0));
  await page.mouse.click(700, 300);
  assert.equal(await shown(), 2, 'a click advances');
  await page.mouse.click(500, 300);
  assert.equal(await shown(), 3, 'a click in the middle third advances');
  await page.mouse.click(100, 300);
  assert.equal(await shown(), 2, 'a click on the left third goes back');
  await page.mouse.click(332, 300);
  assert.equal(await shown(), 0, 'the left third ends at one third of the width');
  await page.mouse.click(334, 300);
  assert.equal(await shown(), 2, 'and the next pixel advances');
  mark('click advances, a click on the left third goes back');

  // ---- touch: swipes and taps ---------------------------------------------------------------------------------------------------------
  await page.evaluate(() => {
    window.inputLog = [];
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'click']) document.addEventListener(type, (event) => window.inputLog.push(`${type}:${event.pointerType ?? 'mouse'}@${Math.round(event.clientX)}`), true);
  });
  const cdp = await context.newCDPSession(page);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const swipe = async (fromX, toX, y = 300, toY = y) => {
    await touch('touchStart', fromX, y);
    for (let step = 1; step <= 6; step++) await touch('touchMove', fromX + ((toX - fromX) * step) / 6, y + ((toY - y) * step) / 6);
    await touch('touchEnd');
    await page.waitForTimeout(60);
  };
  await page.evaluate(() => window.presenter.goTo(0));
  await swipe(700, 300);
  await shownBecomes(2, 'swiping left goes forward');
  await swipe(300, 700);
  await shownBecomes(0, 'swiping right goes back');
  await swipe(500, 540, 300);
  assert.equal(await shown(), 0, 'a short drag is not a swipe');
  await swipe(400, 700, 100, 520);
  assert.equal(await shown(), 0, 'a mostly vertical drag is not a swipe');
  await swipe(700, 300);
  await shownBecomes(2, 'a swipe moves once');
  await page.waitForTimeout(700);
  assert.equal(await shown(), 2, 'and the touch does not also click');
  // A tap is a click: the same zones.
  await touch('touchStart', 800, 300); await touch('touchEnd');
  await shownBecomes(3, 'a tap on the right advances');
  await touch('touchStart', 80, 300); await touch('touchEnd');
  await shownBecomes(2, 'a tap on the left third goes back');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.opf-presenter')).touchAction), 'none', 'the browser does not scroll or zoom under a swipe');
  mark('swipe left and right move on touch; short or vertical drags and taps behave');

  // ---- the counter --------------------------------------------------------------------------------------------------------------------
  await page.evaluate(() => window.presenter.goTo(0));
  await page.mouse.move(10, 10); // park the pointer, then wait for the counter to hide
  await page.waitForFunction(() => document.querySelector('.opf-presenter').dataset.chrome === 'hidden', undefined, { timeout: 4000 });
  const opacity = () => page.evaluate(() => getComputedStyle(document.querySelector('.opf-presenter-counter')).opacity);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.opf-presenter-counter')).opacity === '0'); // the fade is 120ms
  assert.equal(await page.locator('.opf-presenter-counter').getAttribute('aria-hidden'), 'true', 'the live region announces; the counter is only for the eyes');
  assert.equal(await opacity(), '0', 'the counter is hidden until the pointer moves');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.opf-presenter')).cursor), 'none', 'the cursor hides with it');
  await page.mouse.move(400, 300); await page.mouse.move(420, 310);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.opf-presenter-counter')).opacity === '1');
  assert.equal(await counter(), '01 / 03', 'the counter reads like the navigator: 01 / 03');
  const chip = await page.evaluate(() => { const style = getComputedStyle(document.querySelector('.opf-presenter-counter')); return { family: style.fontFamily, size: style.fontSize }; });
  assert.match(chip.family, /Geist Mono|ui-monospace|Menlo|monospace/, 'in the mono face');
  assert.equal(chip.size, '11.5px');
  await page.waitForTimeout(1200);
  assert.equal(await opacity(), '1', 'still shown before the 2 seconds are up');
  await page.mouse.move(430, 320); // moving again restarts the 2 seconds
  await page.waitForTimeout(1200);
  assert.equal(await opacity(), '1', 'a new move restarts the timer');
  await page.waitForFunction(() => document.querySelector('.opf-presenter').dataset.chrome === 'hidden', undefined, { timeout: 4000 });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.opf-presenter-counter')).opacity === '0');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.opf-presenter')).cursor), 'none');
  await page.evaluate(() => window.presenter.goTo(3));
  assert.equal(await counter(), '03 / 03', 'the counter text follows the slide while hidden');
  assert.equal(await opacity(), '0', 'moving slides by key does not show it');
  mark('the counter shows on pointer move, hides after 2 seconds, and the cursor hides with it');

  // ---- preloading ---------------------------------------------------------------------------------------------------------------------
  await page.evaluate(() => window.presenter.stop());
  await page.evaluate(() => { window.svgCalls = []; window.log.exits = []; });
  await open(2);
  await page.waitForTimeout(200);
  const drawn = await page.evaluate(() => window.svgCalls.flatMap((call) => call.slides.map((n) => n - 1)));
  assert.ok(drawn.includes(0) && drawn.includes(3), `the neighbors of the shown slide were drawn ahead (${drawn})`);
  assert.ok(!drawn.includes(1) && !drawn.includes(4), 'hidden slides are not drawn');
  await page.evaluate(() => window.presenter.stop());
  await page.evaluate(() => { window.svgCalls = []; });
  await open(0);
  await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(() => window.svgCalls.flatMap((call) => call.slides.map((n) => n - 1))), [0, 2], 'the first slide and the next one that is not hidden');
  const instant = await page.evaluate(() => {
    window.svgCalls = [];
    window.presenter.goTo(2);
    return { calls: window.svgCalls.length, hasSvg: document.querySelector('.opf-presenter-slide svg')?.getAttribute('aria-label') === 'Slide 3' };
  });
  assert.equal(instant.calls, 0, 'advancing to a preloaded slide draws nothing');
  assert.equal(instant.hasSvg, true);
  await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(() => window.svgCalls.flatMap((call) => call.slides.map((n) => n - 1))), [3], 'and the new neighbor is drawn in the background');
  await page.evaluate(() => window.presenter.stop());
  await page.evaluate(() => { window.log.exits = []; });
  await open(3);
  mark('the next and previous slides are drawn ahead, so advancing draws nothing');

  // ---- exit: Esc, the button, stop(), leaving full screen, destroy ----------------------------------------------------------------------
  const focusReturned = () => page.waitForFunction(() => document.activeElement?.id === 'opener', undefined, { timeout: 3000 }); // once full screen has ended
  const exits = async () => (await log()).exits;
  await press('End');
  await press('Escape');
  assert.deepEqual(await exits(), [3], 'Esc calls onExit with the deck index of the slide it showed');
  assert.equal(await root.isHidden(), true);
  await focusReturned();
  assert.equal(await page.evaluate(() => document.fullscreenElement === null), true, 'and full screen ends');
  assert.equal(await page.evaluate(() => window.presenter.isRunning()), false);
  mark('Esc exits with onExit(index), returns focus to the opener and leaves full screen');

  await open(2);
  assert.equal(await shown(), 2);
  await page.mouse.move(500, 300);
  const closeButton = page.getByRole('button', { name: 'Exit presentation' });
  assert.equal(await closeButton.getAttribute('title'), 'Exit (Esc)');
  await closeButton.click();
  assert.deepEqual(await exits(), [3, 2], 'the exit button calls onExit too, and does not also move a slide');
  await focusReturned();

  await open(3);
  await page.evaluate(() => window.presenter.stop());
  await page.evaluate(() => window.presenter.stop());
  assert.deepEqual(await exits(), [3, 2, 3], 'stop() calls onExit once, and stopping a stopped presenter does nothing');

  // Closing before the browser answered the full screen request (a quick Esc, the close button, F5 then Esc) must not leave the page in full
  // screen behind a hidden presenter: the request resolves after stop() saw no full screen to leave, so the presenter gives the screen back then.
  await page.waitForFunction(() => !document.fullscreenElement);
  await page.locator('#opener').focus();
  const early = await page.evaluate(async () => {
    const answer = window.presenter.start(0);
    window.presenter.stop();
    return { answer: await answer, running: window.presenter.isRunning() };
  });
  assert.deepEqual(early, { answer: 'overlay', running: false }, 'stop() before the browser answered: the start resolves as overlay and nothing runs');
  await page.waitForFunction(() => !document.fullscreenElement, undefined, { timeout: 5000 }); // never stays full screen behind the hidden presenter
  await page.waitForTimeout(300); // a late full screen would show up here
  assert.equal(await page.evaluate(() => document.fullscreenElement), null, 'full screen did not start after the presentation was closed');
  assert.equal(await root.isHidden(), true);
  await focusReturned();
  assert.deepEqual(await exits(), [3, 2, 3, 0], 'and onExit was called once for it');
  assert.equal(await page.evaluate(() => window.presenter.isRunning()), false);

  // The browser ends full screen with Esc (that key never reaches the page) or the host exits it: the presentation ends with it.
  await open(0);
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => document.fullscreenElement === window.presenter.element), true);
  await page.evaluate(() => document.exitFullscreen());
  await page.waitForFunction(() => !window.presenter.isRunning());
  assert.deepEqual(await exits(), [3, 2, 3, 0, 2], 'leaving full screen ends the presentation with onExit(index)');
  await focusReturned();

  await open(0);
  await page.evaluate(() => window.presenter.destroy());
  assert.deepEqual(await exits(), [3, 2, 3, 0, 2, 0], 'destroy() while open exits first');
  assert.equal(await page.locator('.opf-presenter').count(), 0, 'and removes the element');
  mark('every way out calls onExit(index): Esc, the button, stop(), leaving full screen, destroy()');

  // ---- axe: the open dialog with its counter and exit button shown --------------------------------------------------------------------
  await mount(3);
  await open(0);
  await page.mouse.move(500, 300); await page.mouse.move(520, 310);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.opf-presenter-counter')).opacity === '1');
  await page.addScriptTag({ content: axeSource });
  const axe = await page.evaluate(() => window.axe.run({ include: [['.opf-presenter']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }));
  assert.deepEqual(axe.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`), [], 'axe: the presenter dialog');
  await page.evaluate(() => window.presenter.stop());
  await page.evaluate(() => { window.log.exits = []; });
  mark('axe finds no violation in the presenter dialog');

  // ---- the overlay fallback -----------------------------------------------------------------------------------------------------------
  await mount(4);
  await page.evaluate(() => { Element.prototype.requestFullscreen = () => Promise.reject(new TypeError('Fullscreen is not allowed here.')); });
  assert.equal(await open(1), 'overlay', 'a refused full screen gives the overlay');
  assert.equal(await root.getAttribute('data-mode'), 'overlay');
  assert.equal(await page.evaluate(() => document.fullscreenElement), null);
  const overlay = await page.evaluate(() => { const element = window.presenter.element, box = element.getBoundingClientRect(); return { position: getComputedStyle(element).position, width: box.width, height: box.height, x: box.x, y: box.y, z: getComputedStyle(element).zIndex, covers: document.elementFromPoint(500, 300)?.closest('.opf-presenter') === element }; });
  assert.deepEqual({ ...overlay }, { position: 'fixed', width: 1000, height: 600, x: 0, y: 0, z: '2000', covers: true }, 'the overlay is fixed and covers the window');
  assert.equal(await title(), 'Slide 2');
  await page.setViewportSize({ width: 600, height: 1000 });
  box = await slideBox();
  near(box.width, 600, 'a tall window fills the width'); near(box.height, 337.5, 'at 16:9'); near(box.y, (1000 - 337.5) / 2, 'centered');
  await page.setViewportSize({ width: 1000, height: 600 });
  await press('ArrowRight');
  assert.equal(await title(), 'Slide 3', 'the overlay navigates like full screen');
  await press('Escape');
  assert.deepEqual(await exits(), [2], 'Esc exits the overlay');
  await focusReturned();
  // A browser without the API at all.
  await page.evaluate(() => { Element.prototype.requestFullscreen = undefined; Element.prototype.webkitRequestFullscreen = undefined; });
  assert.equal(await open(0), 'overlay', 'no Fullscreen API: the overlay');
  await page.evaluate(() => window.presenter.stop());
  await realFullscreen();
  mark('the fixed overlay is the fallback when full screen is refused or missing, and letterboxes a tall window');

  // ---- focus --------------------------------------------------------------------------------------------------------------------------
  await mount(3);
  await page.evaluate(() => { Element.prototype.requestFullscreen = () => Promise.reject(new Error('no')); });
  await open(0);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.className), 'opf-presenter-close', 'Tab reaches the exit button');
  await page.waitForFunction(() => getComputedStyle(document.activeElement).opacity === '1', undefined, { timeout: 2000 }); // which shows while it has focus (a 120ms fade)
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement === window.presenter.element), true, 'Tab stays inside the dialog');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement.className), 'opf-presenter-close');
  await page.keyboard.press('Enter');
  assert.deepEqual(await exits(), [0], 'Enter on the exit button exits (it does not advance)');
  await open(0);
  await page.evaluate(() => document.getElementById('field').focus());
  assert.equal(await page.evaluate(() => document.activeElement === window.presenter.element), true, 'the page behind cannot take focus');
  await page.evaluate(() => window.presenter.stop());
  await realFullscreen();
  mark('focus is trapped in the dialog and the exit button is keyboard reachable');

  // ---- onSlideChange and the start index ----------------------------------------------------------------------------------------------
  await mount(5, [0, 1], '{ slideIndex: 1 }');
  assert.equal(await open(undefined), 'fullscreen');
  assert.equal(await shown(), 2, 'a hidden start slide opens the next one that is not hidden');
  assert.deepEqual((await log()).changes, [2], 'and the host is told which one');
  await press('ArrowRight');
  assert.deepEqual((await log()).changes, [2, 3]);
  await page.evaluate(() => window.presenter.start(4));
  assert.equal(await shown(), 4, 'start() while open goes to that slide');
  await page.evaluate(() => window.presenter.stop());
  await mount(3);
  await open(1);
  assert.deepEqual((await log()).changes, [], 'a slide that opens as asked is not a change');
  await page.evaluate(() => window.presenter.stop());
  await page.evaluate(() => window.presenter.start(99));
  assert.equal(await shown(), 2, 'a slide past the end opens the last one');
  await page.evaluate(() => window.presenter.stop());
  mark('start() takes slideIndex; a hidden or out-of-range start opens the nearest slide that is shown');

  // A deck where every slide is hidden has nothing to present.
  await mount(2, [0, 1]);
  await open(0);
  assert.match(await page.locator('.opf-presenter-message').innerText(), /No visible slides/);
  assert.equal(await shown(), -1);
  assert.equal(await counter(), '00 / 00');
  await press('ArrowRight');
  await press('Escape');
  assert.deepEqual(await exits(), [-1], 'with nothing shown, onExit says -1');
  await mount(2, [0, 1], '{ includeHidden: true }');
  await open(0);
  assert.equal(await title(), 'Slide 1', 'includeHidden presents hidden slides too');
  await page.evaluate(() => window.presenter.stop());
  mark('a deck with only hidden slides says so; includeHidden presents them');

  // ---- the fonts gate and a plain presentation ----------------------------------------------------------------------------------------
  await mount(2, [], `{ fonts: (() => { const handle = Object.assign(Object.create(window.fonts), {
      pending: () => (window.fontsReleased ? [] : ['Fake Sans 400']),
      ensure: () => new Promise((resolve) => { window.releaseFonts = () => { window.fontsReleased = true; resolve(); }; }),
    }); return handle; })() }`);
  await page.evaluate(() => { window.fontsReleased = false; });
  await open(0);
  assert.equal(await page.locator('.opf-presenter-message').innerText(), 'Loading fonts…', 'the faces a deck needs load before it draws');
  assert.equal(await page.locator('.opf-presenter-slide svg').count(), 0);
  await page.evaluate(() => window.releaseFonts());
  await page.locator('.opf-presenter-slide svg').waitFor();
  assert.equal(await title(), 'Slide 1');
  assert.equal(await page.locator('.opf-presenter-message').isHidden(), true);
  await page.evaluate(() => window.presenter.stop());
  // A presentation object instead of a session; a function that returns it.
  await page.evaluate(() => {
    window.presenter.destroy();
    window.plain = window.makeDeck(3, [2], 'Plain');
    window.presenter = window.opfPresent.createPresenter(document.getElementById('host'), { presentation: () => window.plain, fonts: window.fonts, renderOptions: { catalogs: [window.opfPresent.gallery] }, labels: { dialog: 'Deck', position: (n, total) => `${n}/${total}` } });
  });
  await open(0);
  assert.equal(await root.getAttribute('aria-label'), 'Deck', 'labels can be replaced');
  assert.equal(await live(), '1/2');
  assert.equal(await title(), 'Slide 1');
  await press('End');
  assert.equal(await title(), 'Slide 2', 'a plain presentation works like a session');
  await page.evaluate(() => window.presenter.stop());
  assert.equal(await page.evaluate(() => { try { window.opfPresent.createPresenter(document.body, {}); return 'created'; } catch (error) { return error.constructor.name; } }), 'TypeError', 'a presenter needs a deck');
  mark('the fonts gate shows "Loading fonts…" until the faces are in; a plain presentation works');

  // ---- touch density ------------------------------------------------------------------------------------------------------------------
  await mount(2, [], '{ density: "touch" }');
  await open(0);
  assert.deepEqual(await page.locator('.opf-presenter-close').evaluate((node) => { const box = node.getBoundingClientRect(); return [box.width, box.height]; }), [40, 40], 'touch density makes the exit button 40px');
  await page.evaluate(() => window.presenter.stop());
  await mount(2);
  await open(0);
  assert.deepEqual(await page.locator('.opf-presenter-close').evaluate((node) => { const box = node.getBoundingClientRect(); return [box.width, box.height]; }), [32, 32], 'and it is 32px by default');
  await page.evaluate(() => window.presenter.stop());
  mark('the exit button is 32px, or 40px with density: "touch"');

  // ---- no network, no errors ----------------------------------------------------------------------------------------------------------
  assert.deepEqual(requests, [], 'presenting makes no network request');
  assert.deepEqual(errors, [], 'no page errors or console errors');
  mark('no network request and no console error');
  console.log(`presenter: ${checks.length} checks passed\n- ${checks.join('\n- ')}`);
} catch (error) {
  console.error('presenter checks so far:\n- ' + checks.join('\n- '));
  console.error({ errors, requests });
  throw error;
} finally {
  await app.close();
}
