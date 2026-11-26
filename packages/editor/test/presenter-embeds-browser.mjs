import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { startPresenterPage } from './support/presenter-page.mjs';

// FR-08: the presenter shows an embedded page live only when its host allows it (the `embeds` option, none by default), in a sandboxed frame
// over the static form; a click on the frame never changes the slide, the slide keys keep working while the frame does not have focus, and
// Tab enters the frame only after a click on it. The page the frame shows is a local test page served for an address that never leaves the
// machine. `node test/presenter-embeds-browser.mjs [screenshot-dir]` also saves a picture of the slide with its live frame.
const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });
const checks = [];
const mark = (name) => checks.push(name);
const app = await startPresenterPage();
const { page, context, errors } = app;
const framed = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Framed page</title><body style="margin:0;background:#fffbe6;font:20px sans-serif"><p>A live page</p><input id="field" aria-label="Field"><script>window.keys=[];addEventListener('keydown',event=>window.keys.push(event.key));</script></body></html>`;
const requested = [];
await page.route(/^https:\/\/(frame|blocked)\.example\.test\//, (route) => {
  requested.push(route.request().url());
  return route.fulfill({ status: 200, contentType: 'text/html', body: framed });
});
try {
  const picture = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const deck = {
    name: 'Embeds', design: { theme: 'classic', fontScheme: 'roboto' }, assets: { shot: picture },
    slides: [
      { id: 'live', title: 'Live', embed: { src: 'https://frame.example.test/dashboard', title: 'Revenue dashboard', aspectRatio: 1.6, preview: 'asset:shot' } },
      { id: 'blocked', title: 'Blocked', embed: 'https://blocked.example.test/page' },
      { id: 'text', title: 'Text', text: 'Last' },
    ],
  };
  const make = (embeds) => page.evaluate(([d, source]) => {
    window.presenter?.destroy();
    window.editor = window.opfPresent.createEditorSession(d, { rejectInvalid: true, catalogs: [window.opfPresent.gallery] });
    // eslint-disable-next-line no-new-func
    const embeds = source ? new Function('src', source) : undefined;
    window.presenter = window.opfPresent.createPresenter(document.getElementById('host'), { editor: window.editor, fonts: window.fonts, ...(embeds ? { embeds } : {}) });
  }, [deck, embeds]);
  const shown = () => page.evaluate(() => window.presenter.getSlide());
  const open = async (index) => {
    await page.waitForFunction(() => !document.fullscreenElement);
    await page.evaluate((i) => window.presenter.start(i), index);
    await page.waitForFunction((i) => window.presenter.getSlide() === i && document.querySelector('.opf-presenter-slide svg'), index);
  };
  const frameCount = () => page.locator('.opf-presenter [data-opf-live-embed] iframe').count();
  const save = (name) => (shots ? page.screenshot({ path: `${shots}/${name}.png` }) : undefined);

  // ---- nothing is live by default --------------------------------------------------------------------------------------------------------
  await make();
  await open(0);
  await page.waitForSelector('.opf-presenter [data-opf-embed]');
  assert.equal(await frameCount(), 0, 'without an embeds option no page is shown live');
  assert.equal(await page.locator('.opf-presenter a[href="https://frame.example.test/dashboard"][target="_blank"]').count(), 1, 'the static form is a link that opens a new tab');
  await page.evaluate(() => window.presenter.stop());
  assert.deepEqual(requested, [], 'the page was never loaded');
  mark('no embeds option: the static form, linked, and the page is never loaded');

  // ---- the host's list --------------------------------------------------------------------------------------------------------------------
  await make('return src.startsWith("https://frame.example.test/");');
  await open(0);
  await page.waitForSelector('.opf-presenter [data-opf-live-embed] iframe');
  const frame = page.locator('.opf-presenter [data-opf-live-embed] iframe');
  const attributes = await frame.evaluate((node) => ({ sandbox: node.getAttribute('sandbox'), referrerpolicy: node.getAttribute('referrerpolicy'), loading: node.getAttribute('loading'), title: node.getAttribute('title'), allow: node.getAttribute('allow'), tabindex: node.getAttribute('tabindex'), src: node.getAttribute('src') }));
  assert.deepEqual(attributes, { sandbox: 'allow-scripts allow-same-origin allow-popups allow-forms', referrerpolicy: 'no-referrer', loading: 'lazy', title: 'Revenue dashboard', allow: null, tabindex: '-1', src: 'https://frame.example.test/dashboard' });
  mark('a page the host allows is a sandboxed frame with no referrer, lazy, titled, with no allow features');
  await page.waitForFunction(() => document.querySelector('.opf-presenter [data-opf-live-embed]')?.style.visibility === 'visible');
  assert.deepEqual(requested, ['https://frame.example.test/dashboard']);
  const placed = await page.evaluate(() => {
    const area = document.querySelector('.opf-presenter [data-opf-link-area]').getBoundingClientRect(), box = document.querySelector('.opf-presenter [data-opf-live-embed]').getBoundingClientRect();
    return { dx: Math.abs(area.left - box.left), dy: Math.abs(area.top - box.top), dw: Math.abs(area.width - box.width), dh: Math.abs(area.height - box.height), width: box.width };
  });
  assert.ok(placed.width > 200 && placed.dx < 1.5 && placed.dy < 1.5 && placed.dw < 1.5 && placed.dh < 1.5, JSON.stringify(placed));
  assert.equal(await page.locator('.opf-presenter svg a[href="https://frame.example.test/dashboard"]').count(), 1, 'the static form stays under the frame');
  mark('the frame sits exactly over the static form, which stays under it');
  await save('live-frame');

  // ---- the slide keys keep working while the frame does not have focus ------------------------------------------------------------------------
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('.opf-presenter iframe')), false);
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => window.presenter.getSlide() === 1 && document.querySelector('.opf-presenter [data-opf-embed-src="https://blocked.example.test/page"]'));
  assert.equal(await frameCount(), 0, 'a page the host does not list stays the static form');
  assert.deepEqual(requested, ['https://frame.example.test/dashboard'], 'the blocked page was never loaded');
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => window.presenter.getSlide() === 0 && document.querySelector('.opf-presenter iframe'));
  mark('the slide keys move on and back while the frame has no focus; an unlisted page is not framed');

  // ---- a click on the frame never changes the slide; Tab enters it only after a click -------------------------------------------------------------
  await page.waitForFunction(() => document.querySelector('.opf-presenter [data-opf-live-embed]')?.style.visibility === 'visible');
  const box = await frame.boundingBox();
  assert.ok(box.x < 333 || box.x + box.width / 2 > 333);
  await page.mouse.click(box.x + 20, box.y + 20);
  await page.waitForTimeout(250);
  assert.equal(await shown(), 0, 'a click on the frame in the back zone does not go back');
  await page.mouse.click(box.x + box.width - 20, box.y + box.height - 20);
  await page.waitForTimeout(250);
  assert.equal(await shown(), 0, 'a click on the frame in the forward zone does not advance');
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('.opf-presenter iframe')), true, 'a click puts focus in the frame');
  assert.equal(await frame.getAttribute('tabindex'), '0', 'Tab may enter the frame after a click on it');
  mark('a click on the frame (back and forward zones) keeps the slide and focuses the frame; only then does Tab reach it');

  const inner = page.frames().find((entry) => entry.url().startsWith('https://frame.example.test/'));
  await inner.locator('#field').click();
  await page.keyboard.press('ArrowRight');
  assert.equal(await shown(), 0, 'keys typed in the frame go to the page, not the slide');
  assert.ok((await inner.evaluate(() => window.keys)).includes('ArrowRight'));
  mark('keys go to the page while the frame has focus');

  // ---- leaving -----------------------------------------------------------------------------------------------------------------------------
  await page.evaluate(() => window.presenter.stop());
  assert.equal(await page.locator('[data-opf-live-embed]').count(), 0, 'closing the presentation removes the frames');
  await open(0);
  await page.waitForSelector('.opf-presenter [data-opf-live-embed] iframe');
  await page.evaluate(() => window.presenter.goTo(2));
  await page.waitForFunction(() => window.presenter.getSlide() === 2 && document.querySelector('.opf-presenter-slide svg'));
  assert.equal(await frameCount(), 0, 'a slide with no embed has no frame');
  await page.evaluate(() => window.presenter.stop());
  mark('frames go with their slide and with the presentation');

  // ---- a host that answers badly --------------------------------------------------------------------------------------------------------------
  await make('throw new Error("no");');
  await open(0);
  await page.waitForSelector('.opf-presenter [data-opf-embed]');
  assert.equal(await frameCount(), 0, 'a failing list shows nothing live');
  await page.evaluate(() => window.presenter.stop());
  await make('return "yes";');
  await open(0);
  await page.waitForSelector('.opf-presenter [data-opf-embed]');
  assert.equal(await frameCount(), 0, 'only true shows a page live');
  await page.evaluate(() => window.presenter.stop());
  mark('a list that throws or answers anything but true shows nothing live');

  assert.deepEqual(errors, [], 'no page errors or console errors');
  console.log(`presenter embeds: ${checks.length} checks passed\n- ${checks.join('\n- ')}`);
} catch (error) {
  console.error('presenter embeds checks so far:\n- ' + checks.join('\n- '));
  console.error({ errors });
  throw error;
} finally {
  await app.close();
}
