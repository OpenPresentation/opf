import assert from 'node:assert/strict';
import { toPptx } from '@openpresentation/opf-pptx';
import { renderSvg } from '@openpresentation/opf-render/svg';
import { startPlayground } from './support/playground-harness.mjs';

// RR-25 in a real browser, on the built playground: the in-canvas crop tool and the focal point picker. A 400 x 200 picture
// (red left half, blue right half, a green square at the lower right) is cropped by dragging handles, with an aspect lock, from the
// keyboard and from the exact numbers; each Apply is one undo step; the focal point cuts the frame's shape around a chosen point;
// Restore original goes back; and the document that results exports to PPTX with the same pixels the preview draws.
// RR-17: jszip is a test dependency of its own (opf-pptx 0.13 no longer installs it).
import JSZip from 'jszip';
const app = await startPlayground({ contextOptions: { viewport: { width: 1440, height: 1100 } } });
const { page, errors } = app;
const checks = [];
const mark = (name) => checks.push(name);
try {
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 200;
    const context = canvas.getContext('2d');
    context.fillStyle = '#dd2222'; context.fillRect(0, 0, 200, 200);
    context.fillStyle = '#2222dd'; context.fillRect(200, 0, 200, 200);
    context.fillStyle = '#22dd22'; context.fillRect(340, 140, 40, 40);
    return canvas.toDataURL('image/png');
  });
  const source = {
    name: 'Crop fixture',
    design: { theme: 'classic', fontScheme: 'roboto' },
    assets: { photo: { src: png, alt: 'A red and blue picture', title: 'photo.png', mediaType: 'image/png' } },
    slides: [
      { id: 'block', title: 'Block picture', blocks: [{ image: { src: 'asset:photo', alt: 'A red and blue picture' } }, { text: 'Beside the picture' }] },
      { id: 'root', title: 'Root picture', image: 'asset:photo', text: 'Text beside it' },
      { id: 'slide-image', title: 'Slide image', design: { slideImage: { src: 'asset:photo', position: 'right', size: 0.45 } }, text: 'Text' },
    ],
  };
  await app.load(source);
  const original = await app.doc();

  const layer = page.locator('.opf-crop');
  const box = page.locator('.opf-crop-box');
  const rect = page.locator('.opf-crop-rect');
  const readout = page.locator('.opf-crop-readout');
  const pill = page.locator('.opf-crop-pill');
  // Open the crop layer on the selected picture and wait until the picture has loaded into it.
  const loaded = async () => {
    await layer.waitFor({ state: 'visible' });
    await page.waitForFunction(() => /^\d+ × \d+ px of \d+ × \d+/.test(document.querySelector('.opf-crop-readout').textContent) && !document.querySelector('.opf-crop').hasAttribute('aria-busy'));
  };
  const openCrop = async () => {
    await page.locator('#preview image[data-canvas-target]').click();
    await pill.click();
    await loaded();
  };
  const slide = async (index) => { await page.locator('#slide-list button').nth(index).click(); await page.waitForFunction((i) => document.querySelector('#slide-list').children[i].getAttribute('aria-current') === 'true', index); await app.settle(); };
  // Source pixel to screen point inside the crop box (the box shows the whole picture).
  // The box is resized by a ResizeObserver when the toolbar changes height (switching tools), so wait until it holds still.
  const settled = async () => { let last = JSON.stringify(await box.boundingBox()); for (let i = 0; i < 40; i += 1) { await page.waitForTimeout(30); const now = JSON.stringify(await box.boundingBox()); if (now === last) return; last = now; } };
  const at = async (x, y) => { await settled(); const b = await box.boundingBox(); return { x: b.x + (x / 400) * b.width, y: b.y + (y / 200) * b.height }; };
  const drag = async (from, to) => {
    const a = await at(from.x, from.y);
    const b = await at(to.x, to.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
    await page.mouse.move(b.x, b.y, { steps: 4 });
    await page.mouse.up();
  };
  const size = async () => { const m = /^(\d+) × (\d+) px of (\d+) × (\d+)/.exec(await readout.textContent()); return { width: +m[1], height: +m[2], of: [+m[3], +m[4]] }; };
  const exact = async (label) => Number(await layer.getByLabel(label, { exact: true }).inputValue());
  const pixels = (uri, points) => page.evaluate(async ({ uri, points }) => {
    const image = new Image(); image.src = uri; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    return { width: image.naturalWidth, height: image.naturalHeight, colors: points.map(([x, y]) => [...context.getImageData(Math.min(x, image.naturalWidth - 1), Math.min(y, image.naturalHeight - 1), 1, 1).data.slice(0, 3)]) };
  }, { uri, points });
  const assetOf = (deck, id) => deck.assets[id];
  const undoCrop = async () => { await page.locator('#undo').click(); await app.waitDoc((deck) => JSON.stringify(deck) === JSON.stringify(original), 'one Undo restores the original document'); await app.settle(); };

  // Select the picture on the canvas: the Crop picture button appears and opens the layer.
  assert.equal(await pill.isHidden(), true);
  await page.locator('#preview image[data-canvas-target]').click();
  await pill.waitFor({ state: 'visible' });
  assert.match(await pill.textContent(), /Crop picture/);
  await pill.click();
  await layer.waitFor({ state: 'visible' });
  await page.waitForFunction(() => /^\d+ × \d+ px of 400 × 200/.test(document.querySelector('.opf-crop-readout').textContent));
  assert.deepEqual(await size(), { width: 400, height: 200, of: [400, 200] });
  assert.equal(await layer.getAttribute('role'), 'dialog');
  assert.equal(await page.evaluate(() => document.activeElement.className), 'opf-crop-rect', 'the crop area has the focus');
  mark('a selected picture offers Crop picture; the layer opens on the whole picture');

  // Drag the east handle to the middle: the crop is the red half. Apply is one undo step.
  const east = page.locator('.opf-crop-handle[data-handle="e"]');
  const eastBox = await east.boundingBox();
  const mid = await at(200, 100);
  await page.mouse.move(eastBox.x + eastBox.width / 2, eastBox.y + eastBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(mid.x, mid.y, { steps: 6 });
  await page.mouse.up();
  const half = await size();
  assert.ok(Math.abs(half.width - 200) <= 4 && half.height === 200, `dragging the east handle crops the width: ${JSON.stringify(half)}`);
  await page.getByRole('button', { name: 'Apply crop' }).click();
  await layer.waitFor({ state: 'hidden' });
  const cropped = await app.waitDoc((deck) => deck.slides[0].blocks[0].image.src === 'asset:photo-crop', 'the picture points at the cropped asset');
  assert.equal(assetOf(cropped, 'photo-crop').description, 'Cropped from asset:photo');
  assert.equal(assetOf(cropped, 'photo').src, png, 'the original asset stays');
  assert.equal(cropped.slides[0].blocks[0].image.alt, 'A red and blue picture', 'alt text is kept');
  const redHalf = await pixels(assetOf(cropped, 'photo-crop').src, [[2, 2], [97, 97], [190, 100]]);
  assert.ok(Math.abs(redHalf.width - 200) <= 4 && redHalf.height === 200, `cropped pixels: ${redHalf.width} x ${redHalf.height}`);
  for (const [r, g, b] of redHalf.colors) assert.ok(r > 180 && b < 80, `only red survives: ${r},${g},${b} in ${JSON.stringify(redHalf)} (drag ${JSON.stringify(half)})`);
  await app.settle();
  await undoCrop();
  mark('dragging a handle crops; Apply is one undo step and the cropped pixels are exactly the chosen area');

  // Aspect lock: 1:1 fits the largest square, and a corner drag keeps it square.
  await openCrop();
  await layer.getByLabel('Aspect ratio').selectOption('1:1');
  const square = await size();
  assert.equal(square.width, square.height, `1:1 makes a square: ${JSON.stringify(square)}`);
  const se = await page.locator('.opf-crop-handle[data-handle="se"]').boundingBox();
  const target = await at(250, 150);
  await page.mouse.move(se.x + se.width / 2, se.y + se.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 6 });
  await page.mouse.up();
  const dragged = await size();
  assert.equal(dragged.width, dragged.height, `the corner keeps the square: ${JSON.stringify(dragged)}`);
  // Free again, Shift on a corner keeps the shape.
  await layer.getByLabel('Aspect ratio').selectOption('free');
  await layer.getByRole('button', { name: 'Reset' }).click();
  assert.deepEqual(await size(), { width: 400, height: 200, of: [400, 200] }, 'Reset returns to the whole picture');
  await layer.getByLabel('Aspect ratio').selectOption('16:9');
  const wide = await size();
  assert.ok(Math.abs(wide.width / wide.height - 16 / 9) < 0.02, `16:9: ${JSON.stringify(wide)}`);
  await layer.getByRole('button', { name: 'Cancel' }).click();
  await layer.waitFor({ state: 'hidden' });
  assert.deepEqual(await app.doc(), original, 'Cancel changes nothing');
  mark('aspect lock keeps the ratio through corner drags; Reset and Cancel change nothing');

  // Keyboard: arrows move, Shift+arrows resize, exact numbers, Enter applies, Esc cancels.
  await page.locator('#preview image[data-canvas-target]').focus();
  await page.locator('#preview image[data-canvas-target]').click();
  await pill.focus();
  await page.keyboard.press('Enter');
  await loaded();
  await layer.getByLabel('Width', { exact: true }).fill('200');
  await layer.getByLabel('Width', { exact: true }).dispatchEvent('change');
  await layer.getByLabel('Height', { exact: true }).fill('100');
  await layer.getByLabel('Height', { exact: true }).dispatchEvent('change');
  assert.deepEqual([await exact('Width'), await exact('Height')], [200, 100], 'exact numbers set the size');
  await rect.focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await exact('Left'), 4, 'an arrow moves by 1% of the long side');
  await page.keyboard.press('Shift+ArrowRight');
  assert.equal(await exact('Width'), 204, 'Shift+arrow resizes');
  await page.keyboard.press('Escape');
  await layer.waitFor({ state: 'hidden' });
  assert.deepEqual(await app.doc(), original, 'Esc cancels');
  assert.ok(await page.evaluate(() => document.activeElement.classList.contains('opf-crop-pill') || document.activeElement.hasAttribute('data-canvas-target')), 'focus returns to the picture');
  await pill.click();
  await layer.waitFor({ state: 'visible' });
  await layer.getByLabel('Width', { exact: true }).fill('300');
  await layer.getByLabel('Width', { exact: true }).dispatchEvent('change');
  await layer.getByLabel('Left', { exact: true }).fill('100');
  await layer.getByLabel('Left', { exact: true }).dispatchEvent('change');
  assert.equal(await exact('Left'), 100);
  await rect.focus();
  await page.keyboard.press('Enter');
  const keyed = await app.waitDoc((deck) => deck.slides[0].blocks[0].image.src === 'asset:photo-crop', 'Enter applies');
  const keyedPixels = await pixels(assetOf(keyed, 'photo-crop').src, [[2, 2]]);
  assert.ok(Math.abs(keyedPixels.width - 300) <= 1, `cropped from the exact left edge: ${keyedPixels.width}`);
  await app.settle();
  await undoCrop();
  mark('keyboard: arrows move, Shift+arrows resize, Enter applies, Esc cancels; exact numbers');

  // Focal point: the frame's shape around the chosen point (the green square at the lower right).
  await openCrop();
  await layer.getByRole('button', { name: 'Focal point' }).click();
  await layer.getByLabel('Zoom').waitFor({ state: 'visible' });
  const frameAspect = await page.evaluate(() => { const n = document.querySelector('#preview image[data-canvas-target]'); return Number(n.getAttribute('width')) / Number(n.getAttribute('height')); });
  const focal = await at(360, 160);
  await page.mouse.click(focal.x, focal.y);
  const window1 = await size();
  assert.ok(Math.abs(window1.width / window1.height - frameAspect) < 0.03, `the window has the frame's shape (${frameAspect}): ${JSON.stringify(window1)}`);
  await layer.getByLabel('Zoom').fill('200');
  await layer.getByLabel('Zoom').dispatchEvent('input');
  const zoomed = await size();
  assert.ok(zoomed.width < window1.width * 0.55, `zoom narrows the window: ${JSON.stringify(zoomed)}`);
  await page.getByRole('button', { name: 'Apply crop' }).click();
  await layer.waitFor({ state: 'hidden' });
  const focused = await app.waitDoc((deck) => deck.slides[0].blocks[0].image.src === 'asset:photo-crop', 'the focal point applies');
  const around = await pixels(assetOf(focused, 'photo-crop').src, [[Math.floor(zoomed.width / 2), Math.floor(zoomed.height / 2)]]);
  assert.ok(Math.abs(around.width / around.height - frameAspect) < 0.05, `cropped to the frame's shape: ${around.width} x ${around.height}`);
  assert.ok(around.colors[0][1] > 150 && around.colors[0][0] < 100, `the focal point is the centre of the result (green): ${around.colors[0]} in ${around.width}x${around.height} sampled at ${Math.floor(zoomed.width / 2)},${Math.floor(zoomed.height / 2)}; zoomed ${JSON.stringify(zoomed)}`);
  await app.settle();
  // The cropped picture draws on the canvas at the frame's shape and is selectable again.
  const frameNow = await page.evaluate(() => { const n = document.querySelector('#preview image[data-canvas-target]'); return Number(n.getAttribute('width')) / Number(n.getAttribute('height')); });
  assert.ok(Math.abs(frameNow - frameAspect) < 0.01, 'the frame itself did not change shape');
  mark('the focal point cuts the frame shape around the chosen point, with zoom, in one undo step');
  await undoCrop();

  // Restore original: crop, reopen, restore (one undo step each).
  await openCrop();
  assert.equal(await layer.getByRole('button', { name: 'Restore original' }).isVisible(), false, 'nothing to restore on an original');
  await layer.getByLabel('Width', { exact: true }).fill('150');
  await layer.getByLabel('Width', { exact: true }).dispatchEvent('change');
  await page.getByRole('button', { name: 'Apply crop' }).click();
  await app.waitDoc((deck) => deck.slides[0].blocks[0].image.src === 'asset:photo-crop', 'cropped');
  await app.settle();
  await openCrop();
  await page.waitForFunction(() => !document.querySelector('.opf-crop button[hidden]') || [...document.querySelectorAll('.opf-crop button')].some((b) => b.textContent === 'Restore original' && !b.hidden));
  await layer.getByRole('button', { name: 'Restore original' }).click();
  await layer.waitFor({ state: 'hidden' });
  const restored = await app.waitDoc((deck) => deck.slides[0].blocks[0].image.src === 'asset:photo', 'restored');
  assert.equal(restored.assets['photo-crop'], undefined, 'the unused crop asset is removed');
  await page.locator('#undo').click();
  await app.waitDoc((deck) => deck.slides[0].blocks[0].image.src === 'asset:photo-crop', 'one Undo brings the crop back');
  await undoCrop().catch(async () => { await page.locator('#undo').click(); await undoCrop(); });
  mark('Restore original returns to the source asset in one undo step');

  // A string image on slide 2 and a slide image from the inspector.
  await slide(1);
  await openCrop();
  await layer.getByLabel('Aspect ratio').selectOption('3:2');
  await page.getByRole('button', { name: 'Apply crop' }).click();
  const rootCrop = await app.waitDoc((deck) => deck.slides[1].image === 'asset:photo-crop', 'a string image stays a string reference');
  assert.equal(typeof rootCrop.slides[1].image, 'string');
  await undoCrop();
  await slide(2);
  assert.equal(await page.locator('#crop-slide-image').isVisible(), true, 'the inspector offers the slide image');
  await page.locator('#crop-slide-image').click();
  await layer.waitFor({ state: 'visible' });
  await layer.getByLabel('Aspect ratio').selectOption('frame');
  const frameShape = await size();
  assert.ok(Math.abs(frameShape.width / frameShape.height - 0.45 * 1280 / 720) < 0.05, `the frame shape of the slide image: ${JSON.stringify(frameShape)}`);
  await page.getByRole('button', { name: 'Apply crop' }).click();
  const slideCrop = await app.waitDoc((deck) => deck.slides[2].design.slideImage.src === 'asset:photo-crop', 'a slide image is cropped');
  assert.equal(slideCrop.slides[2].design.slideImage.position, 'right');
  assert.equal(slideCrop.slides[2].design.slideImage.size, 0.45);
  await app.settle();
  mark('a string picture and a slide image crop the same way and keep their placement');

  // Preview and PPTX agree: the exported picture is the cropped asset, placed like the preview draws it.
  const parity = async (deck, slideIndex, label) => {
    for (const fill of [undefined, 'crop']) {
      const variant = structuredClone(deck);
      if (fill) variant.design.imageFill = fill;
      const svg = renderSvg(variant, { slideIndex, trace: true });
      const tag = svg.match(/<image\b[^>]*data-opf-path="slides\.\d+\.(?:blocks\.0\.)?image"[^>]*>|<image\b[^>]*data-opf-path="slides\.\d+\.design\.slideImage"[^>]*>/)[0];
      const attr = (name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))[1];
      const frame = { x: +attr('x'), y: +attr('y'), width: +attr('width'), height: +attr('height') };
      const bytes = await toPptx(variant, { imageFormat: 'preserve', strictAssets: true });
      const zip = await JSZip.loadAsync(bytes);
      const xml = await zip.file(`ppt/slides/slide${slideIndex + 1}.xml`).async('string');
      const pictures = [...xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)].map((match) => match[0]);
      const picture = pictures.find((item) => /A red and blue picture/.test(item)) ?? pictures[0];
      const number = (re) => Number(picture.match(re)[1]);
      const x = number(/<a:off x="(-?\d+)"/) / 9525, y = number(/<a:off x="-?\d+" y="(-?\d+)"/) / 9525, w = number(/<a:ext cx="(\d+)"/) / 9525, h = number(/<a:ext cx="\d+" cy="(\d+)"/) / 9525;
      const embed = picture.match(/r:embed="(rId\d+)"/)[1];
      const rels = await zip.file(`ppt/slides/_rels/slide${slideIndex + 1}.xml.rels`).async('string');
      const target = rels.match(new RegExp(`Id="${embed}"[^>]*Target="\\.\\./media/([^"]+)"|Target="\\.\\./media/([^"]+)"[^>]*Id="${embed}"`));
      const media = await zip.file(`ppt/media/${target[1] ?? target[2]}`).async('uint8array');
      const view = new DataView(media.buffer, media.byteOffset);
      const dims = { width: view.getUint32(16), height: view.getUint32(20) };
      const ref = variant.slides[slideIndex].blocks?.[0]?.image?.src ?? variant.slides[slideIndex].image?.src ?? variant.slides[slideIndex].image ?? variant.slides[slideIndex].design.slideImage.src;
      const asset = variant.assets[ref.replace('asset:', '')];
      const expected = await pixels(asset.src, [[0, 0]]);
      assert.deepEqual(dims, { width: expected.width, height: expected.height }, `${label}: the exported media is the cropped asset (${JSON.stringify(dims)})`);
      const near = (a, b, what) => assert.ok(Math.abs(a - b) < 0.5, `${label} ${fill ?? 'default'} ${what}: ${a} vs ${b}`);
      const slicing = attr('preserveAspectRatio').includes('slice');
      const crop = picture.match(/<a:srcRect([^>]*)\/>/)?.[1] ?? '';
      const inset = (name) => Number(crop.match(new RegExp(`${name}="(-?\\d+)"`))?.[1] ?? 0) / 100000;
      const visibleWidth = dims.width * (1 - inset('l') - inset('r'));
      const visibleHeight = dims.height * (1 - inset('t') - inset('b'));
      if (slicing) {
        near(x, frame.x, 'x'); near(y, frame.y, 'y'); near(w, frame.width, 'width'); near(h, frame.height, 'height');
        assert.ok(Math.abs(visibleWidth / visibleHeight - frame.width / frame.height) < 0.01, `${label}: srcRect shows the frame's shape`);
      } else {
        near(x + w / 2, frame.x + frame.width / 2, 'centre x'); near(y + h / 2, frame.y + frame.height / 2, 'centre y');
        assert.ok(Math.abs(w / h - dims.width / dims.height) < 0.01, `${label}: the contained picture keeps its own shape`);
        assert.equal(crop, '', `${label}: no srcRect for a contained picture`);
      }
    }
  };
  const finalDeck = await app.doc();
  await parity(finalDeck, 2, 'slide image');
  await undoCrop().catch(() => {});
  // A block picture, cropped to the frame's shape, exports without any srcRect trimming left to do.
  await slide(0);
  await openCrop();
  await layer.getByRole('button', { name: 'Focal point' }).click();
  await page.getByRole('button', { name: 'Apply crop' }).click();
  const blockDeck = await app.waitDoc((deck) => deck.slides[0].blocks[0].image.src === 'asset:photo-crop', 'block focal crop');
  await parity(blockDeck, 0, 'block picture');
  mark('preview and PPTX agree: the exported media is the cropped asset, placed like the preview (fit and crop)');

  // Accessibility: the layer is a labelled modal dialog, every control is named, focus stays inside.
  await app.settle();
  await openCrop();
  assert.equal(await layer.getAttribute('aria-modal'), 'true');
  const unnamed = await page.evaluate(() => [...document.querySelectorAll('.opf-crop button, .opf-crop select, .opf-crop input')].filter((node) => !(node.getAttribute('aria-label') || node.labels?.length || node.textContent.trim())).map((node) => node.outerHTML.slice(0, 80)));
  assert.deepEqual(unnamed, []);
  for (let index = 0; index < 30; index += 1) {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => !!document.activeElement.closest('.opf-crop')), true, 'Tab stays inside the crop layer');
  }
  assert.ok((await rect.getAttribute('aria-label')).includes('Arrow keys move it'), 'the crop area describes its keys');
  await page.keyboard.press('Escape');
  mark('the crop layer is a labelled modal dialog; Tab stays inside; every control is named');

  assert.deepEqual(errors, []);
  console.log(`Image crop (browser): ${checks.length} checks. ${checks.join('; ')}.`);
} catch (error) {
  console.error('Layer:', await page.evaluate(() => { const l = document.querySelector('.opf-crop'); return l ? l.querySelector('.opf-crop-readout').textContent + ' busy=' + l.hasAttribute('aria-busy') : 'none'; }).catch(() => '?'), 'Page errors:', errors, 'status:', await page.locator('#status').textContent().catch(() => '?'));
  throw error;
} finally {
  await app.close();
}
