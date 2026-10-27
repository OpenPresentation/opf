import assert from 'node:assert/strict';
import { startStudioPage, studioDeck } from './support/studio-page.mjs';
import { touchAudit } from './support/touch-audit.mjs';

// CE-20, the Studio on touch (STUDIO-SPEC 12, test 15): a coarse pointer at 820px (a tablet: the left panel is a rail) and 390px (a phone: the
// canvas fills the screen and Design, Layers and Review open in a bottom sheet). 44px targets; a long-press opens the context menu; a hold of
// 150ms then movement drags a block; a quick movement does not; the floating action bar offers Duplicate, Delete, Group, Up and Down.
const checks = [];
const mark = (name) => checks.push(name);

async function session(width, height) {
  const app = await startStudioPage({ viewport: { width, height }, context: { hasTouch: true, isMobile: true } });
  const { page } = app;
  await page.evaluate(async ({ d, width, height }) => {
    window.ed = window.opfWs.createOpfEditor(window.makeHost('host', width, height), { document: d, ...window.base(), layout: 'studio' });
    await window.ed.ready;
  }, { d: studioDeck(), width, height });
  await page.waitForFunction(() => document.querySelectorAll('.opf-studio-box').length > 1 && !document.querySelector('.opf-canvas-fonts'));
  return app;
}
// Synthetic touch pointers on the slide (a real finger's events: pointerdown, pointermove, pointerup with pointerType "touch").
const touch = (page, type, point, id = 31) => page.evaluate(({ type, point, id }) => {
  const target = document.elementFromPoint(point.x, point.y);
  target.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: point.x, clientY: point.y, bubbles: true, cancelable: true, isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
}, { type, point, id });
async function center(page, key) {
  const box = await page.locator(`.opf-studio-box[data-key="${key}"]`).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

try {
  // ---- a tablet, 820px -------------------------------------------------------------------------------------------------------------------
  {
    const app = await session(820, 1180);
    const { page, errors } = app;
    try {
      assert.equal(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), true, 'the page has a coarse pointer');
      assert.equal(await page.evaluate(() => document.querySelector('.opf-studio').dataset.width), 'medium');
      assert.equal(await page.locator('.opf-studio-rail').isVisible(), true, 'the left panel is a rail of Slides and Layers');
      const audit = await page.evaluate(touchAudit);
      const small = audit.small.filter((entry) => !/opf-studio-box|opf-studio-divider/.test(entry));
      assert.deepEqual(small, [], 'every control is at least 44px');
      await page.locator('.opf-studio-rail [data-panel=layers]').tap();
      assert.equal(await page.locator('.opf-studio-layers').isVisible(), true, 'the rail opens the layers as an overlay');
      await page.locator('.opf-studio-rail [data-panel=layers]').tap();
      // A long-press opens the context menu.
      const first = await center(page, '/slides/@row/blocks/@first');
      await touch(page, 'pointerdown', first);
      await page.waitForTimeout(650);
      await touch(page, 'pointerup', first);
      await page.locator('.opf-studio-menu[role=menu]').waitFor({ timeout: 3000 });
      assert.deepEqual(await page.evaluate(() => window.ed.selection.map((entry) => entry.key)), ['/slides/@row/blocks/@first']);
      assert.ok(await page.locator('.opf-studio-menu [role=menuitem]', { hasText: 'Duplicate' }).count());
      await page.keyboard.press('Escape');
      // The floating action bar.
      assert.equal(await page.locator('.opf-studio-actionbar').isVisible(), true, 'a selected block shows the action bar');
      const bar = await page.locator('.opf-studio-actionbar').boundingBox();
      assert.ok(bar.y + bar.height <= first.box.y, 'above the selection');
      for (const label of ['Duplicate', 'Delete', 'Group', 'Move up', 'Move down']) {
        const box = await page.locator('.opf-studio-actionbar').getByRole('button', { name: label, exact: true }).boundingBox();
        assert.ok(box.width >= 43.5 && box.height >= 43.5, `${label} is 44px: ${JSON.stringify(box)}`);
      }
      // A quick movement does not drag; a hold of 150ms then movement does.
      const order = () => page.evaluate(() => window.ed.getDocument().slides[0].blocks.map((block) => block.id));
      const second = await center(page, '/slides/@row/blocks/@second');
      await touch(page, 'pointerdown', second);
      await touch(page, 'pointermove', { x: second.x - 30, y: second.y });
      await touch(page, 'pointermove', { x: first.box.x + 4, y: first.y });
      await touch(page, 'pointerup', { x: first.box.x + 4, y: first.y });
      assert.deepEqual(await order(), ['first', 'second', 'third'], 'a quick movement is not a drag');
      await touch(page, 'pointerdown', second);
      await page.waitForTimeout(220);
      await touch(page, 'pointermove', { x: second.x - 30, y: second.y });
      await touch(page, 'pointermove', { x: first.box.x + 4, y: first.y });
      await touch(page, 'pointerup', { x: first.box.x + 4, y: first.y });
      assert.deepEqual(await order(), ['second', 'first', 'third'], 'a hold then movement moves the block');
      assert.deepEqual(errors, []);
      mark('820px: a rail of panels; 44px targets; a long-press opens the context menu; the action bar sits above the selection; hold-then-drag moves, a quick movement does not');
    } finally { await app.close(); }
  }

  // ---- a phone, 390px ----------------------------------------------------------------------------------------------------------------------
  {
    const app = await session(390, 844);
    const { page, errors } = app;
    try {
      assert.equal(await page.evaluate(() => document.querySelector('.opf-studio').dataset.width), 'narrow');
      assert.equal(await page.locator('.opf-studio-right').isVisible(), false, 'the canvas fills the screen');
      assert.equal(await page.locator('.opf-studio-left').isVisible(), false);
      const frame = await page.locator('.opf-studio-frame').boundingBox();
      assert.ok(frame.width > 300, `the slide uses the width: ${frame.width}`);
      await page.locator('.opf-studio-sheetbar [data-sheet=design]').tap();
      assert.equal(await page.locator('.opf-studio-right').isVisible(), true, 'the bottom sheet opens Design');
      assert.equal(await page.locator('.opf-studio-tab[data-tab=design]').getAttribute('aria-selected'), 'true');
      const sheet = await page.locator('.opf-studio-right').boundingBox();
      assert.ok(sheet.y > 300 && sheet.width >= 389, 'as a sheet at the bottom');
      await page.locator('.opf-studio-sheetbar [data-sheet=design]').tap();
      assert.equal(await page.locator('.opf-studio-right').isVisible(), false, 'and closes it');
      await page.locator('.opf-studio-sheetbar [data-sheet=slides]').tap();
      assert.equal(await page.locator('.opf-studio-slides').isVisible(), true, 'the filmstrip opens in the sheet');
      await page.locator('.opf-studio-sheetbar [data-sheet=slides]').tap();
      const audit = await page.evaluate(touchAudit);
      const small = audit.small.filter((entry) => !/opf-studio-box|opf-studio-divider/.test(entry));
      assert.deepEqual(small, [], 'every control is at least 44px');
      assert.deepEqual(errors, []);
      mark('390px: the canvas fills the screen; the bottom sheet opens Design and the filmstrip; 44px targets');
    } finally { await app.close(); }
  }
  console.log(`studio touch browser: ${checks.length} checks passed\n- ${checks.join('\n- ')}`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
