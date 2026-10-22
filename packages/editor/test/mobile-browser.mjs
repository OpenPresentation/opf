import assert from 'node:assert/strict';
import { startPlayground } from './support/playground-harness.mjs';

// RR-25 in a real browser with phone and tablet emulation (touch, mobile viewport, device pixel ratio): no sideways scrolling from 320px to
// 820px; the bottom bar and the inspector as a bottom sheet that leaves the slide in view; touch selection and text entry on the slide
// (tap to edit, with a target of about 44px); touch find and replace; and touch crop (a handle dragged with a finger, then Apply).
// iPhone and Android are emulated with Chromium (viewport, scale factor, touch and the devices' user agents); the iOS-only
// zoom-on-focus behaviour is covered by the viewport rule the page applies while typing, which is asserted here, not observed on a device.
const devices = [
  { name: 'iPhone SE', viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' },
  { name: 'iPhone 14 Pro', viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' },
  { name: 'Pixel 7', viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36' },
  { name: 'small Android', viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, ua: 'Mozilla/5.0 (Linux; Android 10; SM-A105F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36' },
  { name: 'iPad', viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, ua: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' },
  { name: 'Android tablet', viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, ua: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
];
const source = {
  name: 'Mobile fixture',
  design: { theme: 'classic', fontScheme: 'roboto' },
  assets: {},
  slides: [
    { id: 'one', title: 'Acme grows', text: 'Tap this text to edit it on a phone.', notes: 'Mention Acme.' },
    { id: 'two', title: 'Numbers', items: ['Acme revenue', 'Cost of Acme', 'Profit'] },
    { id: 'three', title: 'Picture', blocks: [{ image: { src: 'asset:photo', alt: 'A picture' } }, { text: 'Beside it' }] },
  ],
};
const checks = [];
const mark = (name) => checks.push(name);

// The widest the page gets, and every visible element that sticks out of the viewport (outside a scroller built to scroll sideways).
const overflow = (page) => page.evaluate(() => {
  const width = document.documentElement.clientWidth;
  const out = [];
  for (const node of document.querySelectorAll('body *')) {
    if (node.closest('svg, #slide-list, .slide-actions, dialog:not([open]), [hidden]')) continue;
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.position === 'fixed' && node.closest('.inspector')) continue;
    const box = node.getBoundingClientRect();
    if (!box.width || !box.height) continue;
    if (box.right > width + 1 && !node.closest('.canvas-scroll, .inspector, .opf-find-results')) out.push(`${node.tagName}.${String(node.className).slice(0, 30)}#${node.id} right=${Math.round(box.right)}`);
  }
  return { scroll: document.documentElement.scrollWidth, client: width, bodyScroll: document.body.scrollWidth, out: out.slice(0, 5) };
});

for (const device of devices.filter((entry) => !process.argv[2] || entry.name.includes(process.argv[2]))) {
  const app = await startPlayground({ contextOptions: { viewport: device.viewport, deviceScaleFactor: device.deviceScaleFactor, isMobile: true, hasTouch: true, userAgent: device.ua } });
  const { page, errors } = app;
  try {
    // A photo for the crop checks, made in the page.
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 400; canvas.height = 200;
      const context = canvas.getContext('2d');
      context.fillStyle = '#dd2222'; context.fillRect(0, 0, 200, 200);
      context.fillStyle = '#2222dd'; context.fillRect(200, 0, 200, 200);
      return canvas.toDataURL('image/png');
    });
    await app.load({ ...source, assets: { photo: { src: png, alt: 'A picture', mediaType: 'image/png' } } });
    const tag = (name) => `${device.name}: ${name}`;
    const preview = page.locator('#preview');

    // No sideways scrolling, bottom bar and the slide in view.
    const widths = await overflow(page);
    assert.ok(widths.scroll <= widths.client && widths.bodyScroll <= widths.client && widths.out.length === 0, tag(`the page scrolls sideways: ${JSON.stringify(widths)}`));
    const bar = page.locator('.mobile-bar');
    assert.equal(await bar.isVisible(), true, tag('the bottom bar shows'));
    const previewBox = await preview.boundingBox();
    assert.ok(previewBox.width >= device.viewport.width - 40 && previewBox.x >= 0, tag(`the slide uses the width: ${JSON.stringify(previewBox)}`));
    assert.ok(previewBox.y + previewBox.height <= device.viewport.height - 40, tag('the slide is on the first screen'));
    assert.equal(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), true, tag('emulates a touch screen'));
    mark(`${device.name} ${device.viewport.width}px: no sideways scroll, bottom bar, the slide on the first screen`);

    // Bottom bar targets are at least 44px; the sheet opens over the bottom and leaves the slide visible.
    for (const button of await bar.locator('button').all()) {
      const box = await button.boundingBox();
      assert.ok(box.height >= 44 && box.width >= 44, tag(`bar button ${await button.textContent()} is ${JSON.stringify(box)}`));
    }
    await page.locator('.inspector').waitFor({ state: 'hidden' });
    await page.touchscreen.tap(...(await centre(page.locator('#bar-edit'))));
    await page.locator('.inspector').waitFor({ state: 'visible' });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.inspector')).transform === 'none');
    const sheet = await page.locator('.inspector').boundingBox();
    assert.ok(sheet.y + sheet.height <= device.viewport.height + 1 && sheet.x >= 0 && sheet.width <= device.viewport.width, tag(`the sheet fits: ${JSON.stringify(sheet)}`));
    assert.ok(sheet.height <= device.viewport.height * 0.65, tag('the sheet leaves room for the slide'));
    assert.equal(await page.locator('#bar-edit').getAttribute('aria-expanded'), 'true');
    const during = await overflow(page);
    assert.ok(during.scroll <= during.client, tag(`sheet open: no sideways scroll ${JSON.stringify(during)}`));
    // The slide can still be reached: scroll it above the sheet.
    await preview.scrollIntoViewIfNeeded();
    const visible = await preview.boundingBox();
    assert.ok(visible.y < sheet.y, tag('the slide is above the sheet'));
    await page.touchscreen.tap(...(await centre(page.locator('#bar-design'))));
    await page.locator('#panel-design').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#panel-content').isHidden(), true);
    await page.touchscreen.tap(...(await centre(page.locator('.sheet-close'))));
    await page.locator('.inspector').waitFor({ state: 'hidden' });
    mark(`${device.name}: the inspector is a bottom sheet (Edit, Design, Done) that leaves the slide in view`);

    // Touch text entry: a tap on the text puts it in edit mode with a target of about 44px.
    const title = page.locator('#preview [data-canvas-target][data-opf-path="slides.0.text"]');
    const hit = await title.locator('.opf-selection').boundingBox();
    assert.ok(hit.height >= 40, tag(`the touch target is ${Math.round(hit.height)}px tall`));
    await page.touchscreen.tap(hit.x + hit.width / 2, hit.y + hit.height / 2);
    await page.locator('.opf-inline-input').waitFor();
    assert.equal(await page.evaluate(() => document.querySelector('meta[name=viewport]').content.includes('maximum-scale=1')), true, tag('no browser zoom while typing'));
    await page.keyboard.press('End');
    await page.keyboard.insertText(' Done.');
    // A tap outside commits.
    await page.touchscreen.tap(...(await centre(page.locator('#page-position'))));
    await app.waitDoc((deck) => deck.slides[0].text === 'Tap this text to edit it on a phone. Done.', 'the text was typed with the touch keyboard');
    await page.waitForFunction(() => !document.querySelector('meta[name=viewport]').content.includes('maximum-scale'));
    mark(`${device.name}: tap enters text editing, typing commits, the page does not zoom while typing`);

    // Touch find and replace, as a sheet above the bar.
    await page.touchscreen.tap(...(await centre(page.locator('#bar-find'))));
    const panel = page.locator('.opf-find');
    await panel.waitFor({ state: 'visible' });
    const panelBox = await panel.boundingBox();
    assert.ok(panelBox.x >= 0 && panelBox.x + panelBox.width <= device.viewport.width + 1 && panelBox.y + panelBox.height <= device.viewport.height, tag(`the find panel fits: ${JSON.stringify(panelBox)}`));
    assert.ok(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.opf-find input[type=text]')).fontSize) >= 16), tag('find fields are at least 16px (no zoom on focus)'));
    await panel.getByLabel('Find', { exact: true }).fill('Acme');
    await page.waitForFunction(() => document.querySelectorAll('.opf-find-result').length >= 3);
    const results = panel.locator('.opf-find-result');
    const target = results.filter({ hasText: 'Slide 2' }).first();
    assert.ok((await target.boundingBox()).height >= 44, tag('result rows are touch sized'));
    await target.scrollIntoViewIfNeeded();
    await page.touchscreen.tap(...(await centre(target)));
    await page.waitForFunction(() => [...document.querySelector('#slide-list').children].findIndex((node) => node.getAttribute('aria-current') === 'true') === 1);
    await panel.getByLabel('Replace with').waitFor({ state: 'hidden' });
    await page.keyboard.press('Control+h');
    await panel.getByLabel('Replace with').fill('Globex');
    await page.touchscreen.tap(...(await centre(panel.getByRole('button', { name: 'Replace all' }))));
    await app.waitDoc((deck) => deck.slides[1].items[0] === 'Globex revenue' && deck.slides[0].notes === 'Mention Globex.', 'touch replace all');
    await page.touchscreen.tap(...(await centre(page.locator('#bar-undo'))));
    await app.waitDoc((deck) => deck.slides[1].items[0] === 'Acme revenue', 'one tap on Undo restores every replacement');
    await page.touchscreen.tap(...(await centre(panel.getByRole('button', { name: 'Close find and replace' }))));
    await panel.waitFor({ state: 'hidden' });
    mark(`${device.name}: find and replace works by touch (sheet, results, replace all, one Undo)`);

    // Touch crop: select the picture, tap the button, drag the east handle with a finger, Apply.
    await page.locator('#slide-list button').nth(2).tap();
    await app.settle();
    const image = page.locator('#preview image[data-canvas-target]');
    const imageBox = await image.boundingBox();
    await page.touchscreen.tap(imageBox.x + imageBox.width / 2, imageBox.y + imageBox.height / 2);
    const pill = page.locator('.opf-crop-pill');
    await pill.waitFor({ state: 'visible' });
    const pillBox = await pill.boundingBox();
    assert.ok(pillBox.height >= 32, tag('the crop button is big enough'));
    await page.touchscreen.tap(...(await centre(pill)));
    const layer = page.locator('.opf-crop');
    await layer.waitFor({ state: 'visible' });
    await page.waitForFunction(() => /px of 400 × 200/.test(document.querySelector('.opf-crop-readout').textContent) && !document.querySelector('.opf-crop').hasAttribute('aria-busy'));
    const fullscreen = await layer.boundingBox();
    assert.ok(fullscreen.width >= device.viewport.width - 1 && fullscreen.height >= device.viewport.height - 1, tag(`the crop layer fills the screen: ${JSON.stringify(fullscreen)}`));
    const handle = await page.locator('.opf-crop-handle[data-handle="e"]').boundingBox();
    assert.ok(handle.width >= 20, tag('crop handles are finger sized'));
    const cdp = await app.context.newCDPSession(page);
    const box = await page.locator('.opf-crop-box').boundingBox();
    const start = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 };
    const end = { x: box.x + box.width / 2, y: start.y };
    const touch = (type, point) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [{ x: point.x, y: point.y, id: 0 }] : [] });
    await touch('touchStart', start);
    for (let step = 1; step <= 6; step += 1) await touch('touchMove', { x: start.x + ((end.x - start.x) * step) / 6, y: start.y });
    await touch('touchEnd');
    await page.waitForFunction(() => { const m = /^(\d+) × \d+ px/.exec(document.querySelector('.opf-crop-readout').textContent); return m && Math.abs(Number(m[1]) - 200) <= 6; });
    // Controls under the picture are reachable and big enough.
    for (const control of await layer.locator('.opf-crop-bar button:visible').all()) assert.ok((await control.boundingBox()).height >= 44, tag('crop buttons are touch sized'));
    const crop = await overflow(page);
    assert.ok(crop.scroll <= crop.client, tag('the crop layer does not scroll sideways'));
    await layer.getByRole('button', { name: 'Apply crop' }).scrollIntoViewIfNeeded();
    // Chromium's raw-touch emulation (CDP) swallows the click of the first tap after a hand-made drag; a real finger does not. Tap a
    // neutral spot first, then Apply.
    await page.touchscreen.tap(4, 4);
    await page.touchscreen.tap(...(await centre(layer.getByRole('button', { name: 'Apply crop' }))));
    const cropped = await app.waitDoc((deck) => deck.slides[2].blocks[0].image.src === 'asset:photo-crop', 'a touch crop applies');
    assert.ok(cropped.assets['photo-crop'].src.startsWith('data:image/png'));
    await layer.waitFor({ state: 'hidden' });
    mark(`${device.name}: crop by touch (the layer fills the screen, a finger drags a handle, Apply is one change)`);

    assert.deepEqual(errors, [], tag('no page errors'));
  } catch (error) {
    console.error(`${device.name}: page errors`, errors, JSON.stringify((await app.doc().catch(() => ({slides: []}))).slides[2]), await page.evaluate(() => document.querySelector('.opf-crop') ? document.querySelector('.opf-crop-readout').textContent + ' / ' + document.querySelector('.opf-crop-error').textContent + ' / ' + document.querySelector('.opf-crop-actions').textContent : 'no layer'), 'status:', await page.locator('#status').textContent().catch(() => '?'));
    throw error;
  } finally {
    await app.close();
  }
}

async function centre(locator) {
  const box = await locator.boundingBox();
  return [box.x + box.width / 2, box.y + box.height / 2];
}
console.log(`Phone and tablet layout (browser): ${checks.length} checks on ${devices.length} emulated devices. ${[...new Set(checks.map((name) => name.replace(/^[^:]+: /, '').replace(/^.*px: /, '')))].join('; ')}.`);
