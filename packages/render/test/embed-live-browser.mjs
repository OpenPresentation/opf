// FR-08: the web player shows an embedded page live only when its host allows it (`present(deck, { embeds })`), in a sandboxed frame over the
// static form; a page on the presenting page's own origin is never shown live, whatever the host answers; a click on a live frame never changes the
// slide, and the slide keys keep working while the frame has no focus. The pages are local: addresses on a test host are answered by the test, and
// nothing leaves the machine.
//   node test/embed-live-browser.mjs
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = "import {present} from '../dist/player.js'; import {mountLiveEmbeds, isSameOriginPage, LIVE_EMBED_SANDBOX} from '../dist/live-embeds.js'; import {toSvg} from '../dist/svg.js'; window.opf = {present, mountLiveEmbeds, isSameOriginPage, LIVE_EMBED_SANDBOX, toSvg};";
const bundle = await build({stdin: {contents: entry, resolveDir: path.join(root, 'test'), sourcefile: 'embed-entry.js', loader: 'js'}, bundle: true, platform: 'browser', format: 'iife', write: false, minify: true, logLevel: 'error'});
const script = bundle.outputFiles[0].text;

const picture = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const deck = {
  name: 'Embeds', language: 'en-US', assets: {shot: picture},
  slides: [
    {id: 'live', title: 'Live', embed: {src: 'https://frame.example.test/dashboard', title: 'Revenue dashboard', aspectRatio: 1.6, preview: 'asset:shot'}},
    {id: 'own', title: 'Own origin', embed: {src: 'https://host.example.test/other', title: 'Own page', preview: 'asset:shot'}},
    {id: 'last', title: 'Last', text: 'End'},
  ],
};
const framed = '<!doctype html><meta charset="utf-8"><title>Framed</title><body style="margin:0;background:#fffbe6"><input id="field" aria-label="Field"><script>window.keys=[];addEventListener("keydown",e=>window.keys.push(e.key));</script></body>';
const hostPage = '<!doctype html><html lang="en"><meta charset="utf-8"><title>Host</title><body style="margin:0"><div id="stage" style="position:relative;width:960px;height:540px"></div><script src="/bundle.js"></script></body></html>';

const browser = await chromium.launch({channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined});
const checks = [], errors = [], outside = [];
const mark = name => checks.push(name);
try {
  const context = await browser.newContext({viewport: {width: 1000, height: 640}});
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.stack ?? error.message));
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
  await context.route('https://**/*', route => {
    const url = new URL(route.request().url());
    if (url.host === 'host.example.test' && url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html', body: hostPage});
    if (url.host === 'host.example.test' && url.pathname === '/bundle.js') return route.fulfill({status: 200, contentType: 'text/javascript', body: script});
    if (url.host === 'frame.example.test' || url.host === 'host.example.test') { outside.push(url.href); return route.fulfill({status: 200, contentType: 'text/html', body: framed}); }
    outside.push(url.href);
    return route.abort();
  });
  await page.goto('https://host.example.test/');
  await page.waitForFunction(() => window.opf);

  // ---- the helper alone: the sandbox, the attributes, the same-origin rule --------------------------------------------------------------------
  await page.evaluate((d) => { window.__deck = d; }, deck);
  const pure = await page.evaluate(() => {
    const {isSameOriginPage, LIVE_EMBED_SANDBOX} = window.opf;
    return {sandbox: LIVE_EMBED_SANDBOX, own: isSameOriginPage('https://host.example.test/x', 'https://host.example.test'), differentPort: isSameOriginPage('https://host.example.test:8443/x', 'https://host.example.test'), other: isSameOriginPage('https://frame.example.test/x', 'https://host.example.test'), none: isSameOriginPage('https://host.example.test/x', undefined), opaque: isSameOriginPage('https://host.example.test/x', 'null')};
  });
  assert.deepEqual(pure, {sandbox: 'allow-scripts allow-same-origin allow-popups allow-forms', own: true, differentPort: false, other: false, none: false, opaque: false});
  mark('the sandbox and the same-origin test');

  // ---- nothing is live by default -----------------------------------------------------------------------------------------------------------
  await page.evaluate(async () => { window.session = await window.opf.present(window.__deck, {container: document.getElementById('stage'), fullscreen: false, channel: false}); });
  await page.waitForFunction(() => document.querySelector('[data-opf-player]')?.shadowRoot?.querySelector('svg [data-opf-embed]'));
  const live = () => page.evaluate(() => document.querySelector('[data-opf-player]')?.shadowRoot?.querySelectorAll('[data-opf-live-embed] iframe').length ?? 0);
  assert.equal(await live(), 0, 'without the embeds option no page is live');
  assert.deepEqual(outside, [], 'no page was requested');
  await page.evaluate(() => window.session.close());
  mark('no embeds option: the static form only, nothing requested');

  // ---- the host's list, the same-origin rule, the keys, the click --------------------------------------------------------------------------------------
  await page.evaluate(async () => { window.session = await window.opf.present(window.__deck, {container: document.getElementById('stage'), fullscreen: false, channel: false, embeds: () => true}); });
  await page.waitForFunction(() => document.querySelector('[data-opf-player]')?.shadowRoot?.querySelector('[data-opf-live-embed] iframe'));
  const attributes = await page.evaluate(() => {
    const frame = document.querySelector('[data-opf-player]').shadowRoot.querySelector('[data-opf-live-embed] iframe');
    return {sandbox: frame.getAttribute('sandbox'), referrerpolicy: frame.getAttribute('referrerpolicy'), loading: frame.getAttribute('loading'), title: frame.getAttribute('title'), allow: frame.getAttribute('allow'), src: frame.getAttribute('src')};
  });
  assert.deepEqual(attributes, {sandbox: 'allow-scripts allow-same-origin allow-popups allow-forms', referrerpolicy: 'no-referrer', loading: 'lazy', title: 'Revenue dashboard', allow: null, src: 'https://frame.example.test/dashboard'});
  mark('the player frames a page the host allows, sandboxed, with no referrer and no allow features');
  const slide = () => page.evaluate(() => window.session.slide);

  const frame = page.locator('[data-opf-live-embed] iframe');
  await page.waitForFunction(() => document.querySelector('[data-opf-player]').shadowRoot.querySelector('[data-opf-live-embed]').style.visibility === 'visible');
  const box = await frame.boundingBox();
  await page.mouse.click(box.x + 15, box.y + 15);
  await page.mouse.click(box.x + box.width - 15, box.y + box.height - 15);
  await page.waitForTimeout(250);
  assert.equal(await slide(), 1, 'a click on the frame, in the back zone and in the forward zone, never changes the slide');
  mark('a click on a live frame never changes the slide');

  await page.evaluate(() => { document.activeElement?.blur?.(); document.querySelector('[data-opf-player]').shadowRoot.querySelector('.player').focus(); });
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => window.session.slide === 2);
  assert.equal(await live(), 0, 'the frame is gone with its slide');
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => window.session.slide === 1 && document.querySelector('[data-opf-player]').shadowRoot.querySelector('svg [data-opf-embed]'));
  mark('the slide keys move on and back while the frame has no focus');

  // Slide 2 is an embed on the host page's own origin: never live, whatever the host answered.
  await page.evaluate(() => window.session.goto(2));
  await page.waitForFunction(() => window.session.slide === 2 && document.querySelector('[data-opf-player]').shadowRoot.querySelector('svg [data-opf-embed-src="https://host.example.test/other"]'));
  assert.equal(await live(), 0, 'a page of the presenting page\'s own origin is never shown live');
  assert.equal(await page.evaluate(() => !!document.querySelector('[data-opf-player]').shadowRoot.querySelector('svg a[href="https://host.example.test/other"]')), true, 'it is the static form, linked');
  assert.ok(!outside.some(url => url.endsWith('/other')), 'the own-origin page was never framed');
  mark('a page on the presenting page\'s own origin stays the static form');

  await page.evaluate(() => window.session.close());
  assert.equal(await page.locator('[data-opf-live-embed]').count(), 0);
  assert.deepEqual(errors, [], 'no page errors or console errors');
  console.log(`embed live: ${checks.length} checks passed\n- ${checks.join('\n- ')}`);
} catch (error) {
  console.error('embed live checks so far:\n- ' + checks.join('\n- '));
  console.error({errors, outside});
  throw error;
} finally {
  await browser.close();
}
