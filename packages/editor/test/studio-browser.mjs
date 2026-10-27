import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { startStudioPage, studioDeck } from './support/studio-page.mjs';

// CE-20, the Studio's acceptance tests (STUDIO-SPEC.md section 12) in a real browser: `createOpfEditor(el, { layout: "studio" })` on the
// workspace test page. 1 mount and destroy, 2 selection, 3 drag, 4 group, 5 dividers, 6 insert and slides, 7 clipboard, 8 text, 9 zoom,
// 10 source, 11 undo, 12 presets, 13 the layout handoff, 14 accessibility (axe in each panel state, a keyboard-only run, live announcements)
// and 17 read-only. Touch (15) is test/studio-touch-browser.mjs, performance (16) test/studio-perf-browser.mjs and React test/studio-react-browser.mjs.
const checks = [];
const mark = (name) => checks.push(name);
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const app = await startStudioPage();
const { page, errors } = app;
const ev = (fn, arg) => page.evaluate(fn, arg);
const keys = () => ev(() => window.ed.selection.map((entry) => entry.key));
const status = () => ev(() => document.querySelector('.opf-studio-message').textContent);
const settle = () => page.waitForFunction(() => window.ed?.mounted && !/Loading fonts/.test(document.querySelector('.opf-studio-message')?.textContent ?? '') && !document.querySelector('.opf-canvas-fonts'), undefined, { timeout: 30000 });
// The center of an overlay box, in client pixels.
async function center(key) {
  const box = await page.locator(`.opf-studio-box[data-key="${key}"]`).boundingBox();
  assert.ok(box, `the overlay has a box for ${key}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}
const press = async (combo) => page.keyboard.press(combo);
// A click with modifier keys held (page.mouse.click takes none).
async function clickAt(point, { modifiers = [], count = 1 } = {}) {
  for (const key of modifiers) await page.keyboard.down(key);
  await page.mouse.click(point.x, point.y, { clickCount: count });
  for (const key of [...modifiers].reverse()) await page.keyboard.up(key);
}
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
async function mount(extra = {}, deck = studioDeck()) {
  await ev(async ({ d, extra }) => {
    window.ed?.destroy();
    window.events = [];
    window.ed = window.opfWs.createOpfEditor(window.makeHost(), { document: d, ...window.base(), layout: 'studio', ...extra, on: { selection: (event) => window.events.push(['selection', event.source, event.items.map((item) => item.key)]), command: (event) => window.events.push(['command', event.id, event.ok]) } });
    await window.ed.ready;
  }, { d: deck, extra });
  await settle();
  await page.waitForFunction(() => document.querySelectorAll('.opf-studio-box').length > 1);
}
async function axe(label) {
  await page.addScriptTag({ content: axeSource });
  const found = await ev(() => window.axe.run(document.querySelector('#host'), { resultTypes: ['violations'] }).then((result) => result.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact)).map((violation) => `${violation.id}: ${violation.nodes.slice(0, 3).map((node) => node.target.join(' ')).join(' | ')}`)));
  assert.deepEqual(found, [], `axe (${label}) has no serious or critical violations`);
}

try {
  await ev(() => {
    const live = new Map();
    for (const target of [document, window]) {
      const add = target.addEventListener.bind(target), remove = target.removeEventListener.bind(target);
      target.addEventListener = (type, listener, options) => { const key = `${target === document ? 'document' : 'window'}:${type}`; live.set(key, (live.get(key) ?? new Set()).add(listener)); return add(type, listener, options); };
      target.removeEventListener = (type, listener, options) => { const key = `${target === document ? 'document' : 'window'}:${type}`; live.get(key)?.delete(listener); return remove(type, listener, options); };
    }
    const observers = new Set();
    for (const name of ['ResizeObserver', 'MutationObserver', 'IntersectionObserver']) {
      const Base = window[name];
      window[name] = class extends Base { constructor(callback, options) { super(callback, options); observers.add(this); } disconnect() { observers.delete(this); super.disconnect(); } };
    }
    window.leaks = () => ({ listeners: Object.fromEntries([...live].map(([key, set]) => [key, set.size]).filter(([, count]) => count)), observers: observers.size });
  });
  // One mount and destroy first: the libraries add their stylesheets to <head> once per document.
  await mount();
  await ev(() => { window.ed.destroy(); window.ed = null; });
  const baseline = await ev(() => window.leaks());

  // ---- 1. mount -----------------------------------------------------------------------------------------------------------------------
  await mount();
  const shell = await ev(() => {
    const host = document.querySelector('#host');
    return {
      layout: window.ed.layout, preset: host.querySelector('.opf-studio').dataset.preset,
      bar: host.querySelector('.opf-studio-bar[role=toolbar]') !== null, left: host.querySelector('.opf-studio-left .opf-slides') !== null,
      layers: host.querySelectorAll('.opf-studio-tree [role=treeitem]').length, canvas: host.querySelector('.opf-studio-frame .opf-canvas svg') !== null,
      right: [...host.querySelectorAll('.opf-studio-tabs [role=tab]')].map((tab) => tab.textContent), status: host.querySelector('.opf-studio-status [role=status]') !== null,
      review: host.querySelector('[data-opf-slot=review] *') !== null, aria: host.querySelector('.opf-studio-frame').getAttribute('aria-label'), svgHidden: host.querySelector('.opf-canvas svg').getAttribute('aria-hidden'),
    };
  });
  assert.equal(shell.layout, 'studio');
  assert.equal(shell.preset, 'studio');
  assert.ok(shell.bar && shell.left && shell.canvas && shell.status && shell.review, JSON.stringify(shell));
  assert.ok(shell.layers >= 5, `the layers tree lists the slide: ${shell.layers}`);
  assert.deepEqual(shell.right, ['Design', 'Review']);
  assert.match(shell.aria, /^Slide 1 of 5/);
  assert.equal(shell.svgHidden, 'true', 'the slide SVG is aria-hidden; the overlay boxes are what is focused');
  assert.deepEqual(await keys(), ['/slides/@row'], 'the Studio opens with the first slide selected');
  await ev(() => { window.ed.destroy(); });
  assert.equal(await ev(() => document.querySelector('#host').childElementCount), 0, 'destroy() leaves the element empty');
  assert.deepEqual(await ev(() => window.leaks()), baseline, 'destroy() removes every listener and observer');
  mark('1: the Studio mounts the bar, both side panels, the canvas, the status line and Review; destroy() leaves the element empty and no listener');

  // ---- 2. selection -------------------------------------------------------------------------------------------------------------------
  await mount();
  const first = await center('/slides/@row/blocks/@first');
  await page.mouse.click(first.x, first.y);
  assert.deepEqual(await keys(), ['/slides/@row/blocks/@first'], 'a click on a text block selects it');
  const second = await center('/slides/@row/blocks/@second');
  await clickAt(second, { modifiers: ['Shift'] });
  assert.deepEqual(await keys(), ['/slides/@row/blocks/@first', '/slides/@row/blocks/@second'], 'Shift+click on a sibling makes two');
  // A block of another group replaces the selection, and the status line says why.
  await ev(() => window.ed.setSlide(1));
  await page.waitForFunction(() => window.ed.selection[0]?.key === '/slides/@grouped');
  await page.waitForFunction(() => document.querySelector('.opf-studio-box[data-key="/slides/@grouped/blocks/@pair/blocks/@left"]'));
  await clickAt(await center('/slides/@grouped/blocks/@lead'));
  await clickAt(await center('/slides/@grouped/blocks/@pair/blocks/@left'), { modifiers: ['Shift'] });
  assert.deepEqual(await keys(), ['/slides/@grouped/blocks/@pair/blocks/@left'], 'Shift+click on a non-sibling replaces the selection');
  assert.match(await status(), /Multiple selection works within one group/);
  // Esc walks block, group, slide, deck; Enter on a group selects its first child.
  await press('Escape');
  assert.deepEqual(await keys(), ['/slides/@grouped/blocks/@pair']);
  await press('Escape');
  assert.deepEqual(await keys(), ['/slides/@grouped']);
  await press('Escape');
  assert.deepEqual(await keys(), [], 'Esc from the slide selects nothing: the deck');
  assert.equal(await ev(() => document.querySelector('.opf-studio-design').dataset.mode), 'deck', 'the Design panel shows the deck');
  await ev(() => window.ed.select(['/slides/@grouped/blocks/@pair']));
  await ev(() => window.ed.focus('canvas'));
  await page.locator('.opf-studio-box[data-key="/slides/@grouped/blocks/@pair"]').focus();
  await press('Enter');
  assert.deepEqual(await keys(), ['/slides/@grouped/blocks/@pair/blocks/@left'], 'Enter on a group selects its first child');
  // The layers follow, and a click in the layers selects on the canvas.
  assert.equal(await page.locator('.opf-studio-row[data-key="/slides/@grouped/blocks/@pair/blocks/@left"]').getAttribute('aria-selected'), 'true');
  await page.locator('.opf-studio-row[data-key="/slides/@grouped/blocks/@lead"] > .opf-studio-row-label').click();
  assert.deepEqual(await keys(), ['/slides/@grouped/blocks/@lead']);
  assert.equal(await page.locator('.opf-studio-box[data-key="/slides/@grouped/blocks/@lead"]').getAttribute('aria-pressed'), 'true');
  await page.locator('.opf-studio-row[data-key="/slides/@grouped/blocks/@pair"] > .opf-studio-row-label').click({ modifiers: ['Shift'] });
  assert.deepEqual(await keys(), ['/slides/@grouped/blocks/@lead', '/slides/@grouped/blocks/@pair'], 'Shift+click in the layers selects a range of siblings');
  mark('2: a click selects; Shift+click adds a sibling and replaces a non-sibling with the reason; Esc walks block, group, slide, deck; Enter selects the first child; canvas and layers stay in step');

  // ---- 3. drag ------------------------------------------------------------------------------------------------------------------------
  await ev(() => window.ed.setSlide(0));
  await page.waitForFunction(() => window.ed.selection[0]?.key === '/slides/@row');
  const depth = () => ev(() => window.ed.session.snapshot().undoDepth);
  const order = (slide) => ev((index) => window.ed.getDocument().slides[index].blocks.map((block) => block.id ?? (block.blocks ? 'group' : '?')), slide);
  let before = await depth();
  await clickAt(await center('/slides/@row/blocks/@second'));
  {
    const from = await center('/slides/@row/blocks/@second');
    const to = await center('/slides/@row/blocks/@first');
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - 10, from.y, { steps: 2 });
    await page.mouse.move(to.box.x + 6, to.y, { steps: 6 });
    assert.equal(await page.locator('.opf-studio-drop').isVisible(), true, 'the drop line shows');
    assert.equal(await page.locator('.opf-studio-drop').getAttribute('data-state'), 'ok');
    await page.mouse.up();
  }
  assert.deepEqual(await order(0), ['second', 'first', 'third'], 'dragging block 2 before block 1 moves it');
  assert.equal(await depth(), before + 1, 'the drag is one undo step');
  assert.deepEqual(await keys(), ['/slides/@row/blocks/@second'], 'the moved block stays selected');
  assert.match(await status(), /Moved Text before Text/);
  await press(`${mod}+z`);
  assert.deepEqual(await order(0), ['first', 'second', 'third']);
  // Into a group: the group is highlighted while the pointer is over its body; Esc cancels mid-drag.
  await ev(() => window.ed.setSlide(1));
  await page.waitForFunction(() => document.querySelector('.opf-studio-box[data-key="/slides/@grouped/blocks/@pair"]'));
  await clickAt(await center('/slides/@grouped/blocks/@lead'));
  {
    const from = await center('/slides/@grouped/blocks/@lead');
    const group = await center('/slides/@grouped/blocks/@pair');
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y + 10, { steps: 2 });
    await page.mouse.move(group.x, group.y, { steps: 6 });
    assert.equal(await page.locator('.opf-studio-box[data-key="/slides/@grouped/blocks/@pair"]').getAttribute('data-into'), 'true', 'dragging over a group highlights it');
    before = await depth();
    await press('Escape');
    await page.mouse.up();
    assert.equal(await depth(), before, 'Esc cancels mid-drag: nothing changes');
    assert.match(await status(), /Move cancelled/);
  }
  // A refused drop shows its reason and changes nothing.
  await ev(() => window.ed.setSlide(2));
  await page.waitForFunction(() => document.querySelector('.opf-studio-box[data-key="/slides/@layout/blocks/@words-1"]'));
  await clickAt(await center('/slides/@layout/blocks/@words-1'));
  {
    const from = await center('/slides/@layout/blocks/@words-1');
    const media = await center('/slides/@layout#media');
    before = await depth();
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 10, from.y, { steps: 2 });
    await page.mouse.move(media.x, media.y, { steps: 6 });
    assert.equal(await page.locator('.opf-studio-drop').getAttribute('data-state'), 'refused');
    assert.match(await page.locator('.opf-studio-drop').getAttribute('title'), /accepts only image and chart/);
    await page.mouse.up();
    assert.equal(await depth(), before, 'a refused drop changes nothing');
    assert.match(await status(), /Region media accepts only image and chart/);
  }
  mark('3: a drag is one undo step with a drop line; a group shows the "into" highlight; Esc cancels; a refused drop says why and changes nothing');

  // ---- 4. group and ungroup ------------------------------------------------------------------------------------------------------------
  await ev(() => window.ed.setSlide(0));
  await page.waitForFunction(() => window.ed.selection[0]?.key === '/slides/@row');
  const original = await ev(() => window.ed.getDocument());
  await clickAt(await center('/slides/@row/blocks/@first'));
  await clickAt(await center('/slides/@row/blocks/@second'), { modifiers: ['Shift'] });
  before = await depth();
  await press(`${mod}+g`);
  assert.equal(await depth(), before + 1, 'Mod+G is one step');
  const grouped = await ev(() => window.ed.getDocument().slides[0].blocks);
  assert.equal(grouped.length, 2);
  assert.deepEqual(grouped[0].blocks.map((block) => block.id), ['first', 'second']);
  assert.match(await status(), /Grouped 2 blocks/);
  const groupKey = (await keys())[0];
  assert.match(groupKey, /^\/slides\/@row\/blocks\/@group-1$/, 'the new group is selected, by its new id');
  await press(`${mod}+Shift+g`);
  assert.deepEqual(await ev(() => window.ed.getDocument().slides[0]), original.slides[0], 'ungroup restores the slide');
  await press(`${mod}+z`);
  await press(`${mod}+z`);
  assert.deepEqual(await ev(() => window.ed.getDocument()), original, 'undoing both restores the document, deep-equal');
  assert.deepEqual(await keys(), ['/slides/@row/blocks/@first', '/slides/@row/blocks/@second'], 'undo restores the selection of the change it undoes');
  mark('4: Mod+G groups two siblings in one step; Shift+Mod+G restores the slide; undo restores the document and the selection');

  // ---- 5. dividers ---------------------------------------------------------------------------------------------------------------------
  await clickAt(await center('/slides/@row/blocks/@first'));
  const divider = page.locator('.opf-studio-divider').first();
  await divider.waitFor();
  {
    const box = await divider.boundingBox();
    const frame = await page.locator('.opf-studio-frame').boundingBox();
    before = await depth();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + frame.width * 0.12, box.y + box.height / 2, { steps: 6 });
    const ratio = await page.locator('.opf-studio-ratio').textContent();
    assert.match(ratio, /^\d+(\.5)? : \d+(\.5)?$/, `the ratio badge reads the snapped value: ${ratio}`);
    await page.mouse.up();
    assert.equal(await depth(), before + 1, 'a divider drag is one change');
    const weights = await ev(() => window.ed.getDocument().slides[0].composition.weights);
    assert.ok(weights.every((weight) => Number.isInteger(weight * 2)), `snapped weights: ${weights}`);
    assert.match(await status(), /Resized to/);
    await press(`${mod}+z`);
  }
  {
    const box = await divider.boundingBox();
    const frame = await page.locator('.opf-studio-frame').boundingBox();
    await page.keyboard.down('Shift');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + frame.width * 0.071, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    const weights = await ev(() => window.ed.getDocument().slides[0].composition.weights);
    assert.ok(weights.some((weight) => !Number.isInteger(weight * 2)), `Shift drags freely: ${weights}`);
    await press(`${mod}+z`);
  }
  {
    await divider.focus();
    const now = Number(await divider.getAttribute('aria-valuenow'));
    await press('ArrowRight');
    await page.waitForFunction((value) => Number(document.querySelector('.opf-studio-divider').getAttribute('aria-valuenow')) > value, now);
    await divider.focus();
    await press('Enter');
    const weights = await ev(() => window.ed.getDocument().slides[0].composition.weights);
    assert.equal(weights[0], weights[1], 'Enter equalizes the pair');
  }
  // The first resize of a content-sized column starts from what is drawn: the divider does not jump.
  await ev(() => window.ed.setSlide(3));
  await page.waitForFunction(() => document.querySelector('.opf-studio-box[data-key="/slides/@stack/blocks/@a"]'));
  await clickAt(await center('/slides/@stack/blocks/@a'));
  {
    const stackDivider = page.locator('.opf-studio-divider').first();
    const frame = await page.locator('.opf-studio-frame').boundingBox();
    const was = await stackDivider.boundingBox();
    await stackDivider.focus();
    await press('ArrowDown');
    await page.waitForFunction(() => window.ed.getDocument().slides[3].composition.weights);
    const now = await page.locator('.opf-studio-divider').first().boundingBox();
    const jump = Math.abs(now.y - was.y) / frame.height;
    assert.ok(jump < 0.06, `the first nudge of a content-sized column moves the divider a step, not ${Math.round(jump * 100)}% of the slide`);
    await press(`${mod}+z`);
  }
  mark('5: a divider drag is one change with a snapped ratio badge; Shift drags freely; arrows change aria-valuenow; Enter equalizes; a content-sized column does not jump');

  // ---- 6. insert and slides --------------------------------------------------------------------------------------------------------------
  await ev(() => window.ed.setSlide(0));
  await page.waitForFunction(() => window.ed.selection[0]?.key === '/slides/@row');
  await clickAt(await center('/slides/@row/blocks/@first'));
  before = await depth();
  await page.locator('[data-studio=insert]').click();
  await page.locator('.opf-studio-menu [role=menuitem]', { hasText: 'Chart' }).first().click();
  assert.equal(await depth(), before + 1);
  const inserted = await ev(() => window.ed.getDocument().slides[0].blocks[1]);
  assert.ok(inserted.chart, 'Insert ▸ Chart adds a chart after the primary');
  assert.match((await keys())[0], /^\/slides\/@row\/blocks\/@/, 'and selects it');
  assert.equal(await ev(() => window.ed.selection[0].path), '/slides/0/blocks/1');
  await press(`${mod}+z`);
  // Dragging Insert ▸ Image onto a region that accepts only text is refused.
  await ev(() => window.ed.setSlide(2));
  await page.waitForFunction(() => document.querySelector('.opf-studio-box[data-key="/slides/@layout#words"]'));
  {
    before = await depth();
    await page.locator('[data-studio=insert]').click();
    const item = page.locator('.opf-studio-menu [role=menuitem]', { hasText: 'Image' }).first();
    const from = await item.boundingBox();
    const words = await center('/slides/@layout#words');
    await page.mouse.move(from.x + 20, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y + from.height / 2 + 10, { steps: 3 });
    await page.mouse.move(words.x, words.y, { steps: 8 });
    assert.equal(await page.locator('.opf-studio-drop').getAttribute('data-state'), 'refused', 'the drop line refuses');
    await page.mouse.up();
    assert.equal(await depth(), before, 'nothing is inserted');
    assert.match(await status(), /accepts only text/);
  }
  // An empty region shows a placeholder with its accepted kinds and a + that inserts into it.
  {
    const placeholder = page.locator('.opf-studio-placeholder[data-key="/slides/@layout#media"]');
    assert.match(await placeholder.textContent(), /image, chart/, 'the empty region names what it accepts');
    before = await depth();
    await placeholder.getByRole('button', { name: 'Insert into region media' }).click();
    assert.equal(await page.locator('.opf-studio-menu [role=menuitem]', { hasText: 'Text' }).first().getAttribute('aria-disabled'), 'true', 'a kind the region refuses is off');
    await page.locator('.opf-studio-menu [role=menuitem]', { hasText: 'Chart' }).first().click();
    const blocks = await ev(() => window.ed.getDocument().slides[2].blocks);
    assert.equal(blocks.at(-1).region, 'media', 'the chart goes into the region');
    assert.ok(blocks.at(-1).chart);
    assert.equal(await depth(), before + 1);
    await press(`${mod}+z`);
  }
  // + Slide with a layout adds the slide after the current one.
  await ev(() => window.ed.setSlide(0));
  {
    const count = await ev(() => window.ed.getDocument().slides.length);
    await page.locator('[data-studio=slide]').click();
    const choice = page.locator('.opf-studio-slidemenu .opf-studio-menu-group [role=menuitem]').first();
    const label = (await choice.textContent()).trim();
    await choice.click();
    const after = await ev(() => window.ed.getDocument());
    assert.equal(after.slides.length, count + 1);
    assert.equal(await ev(() => window.ed.slideIndex), 1, 'the new slide is shown');
    assert.ok(typeof after.slides[1].layout === 'string', `the new slide after the current one has the layout (${label})`);
    await press(`${mod}+z`);
  }
  // Enter in the filmstrip adds a slide after the focused one with its layout.
  {
    const count = await ev(() => window.ed.getDocument().slides.length);
    await page.locator('.slide-card[data-index="2"]').click();
    await page.locator('.slide-card[data-index="2"]').focus();
    await press('Enter');
    const after = await ev(() => window.ed.getDocument().slides);
    assert.equal(after.length, count + 1);
    assert.equal(after[3].layout, 'text-and-media', 'Enter in the filmstrip adds a slide with the same layout');
    await press(`${mod}+z`);
  }
  mark('6: Insert ▸ Chart adds after the primary and selects it; an image dragged onto a text-only region is refused; + Slide adds after the current slide; Enter in the filmstrip repeats the layout; an empty region offers + for the kinds it accepts');

  // ---- 7. clipboard ------------------------------------------------------------------------------------------------------------------------
  await ev(() => window.ed.setSlide(0));
  await page.waitForFunction(() => window.ed.selection[0]?.key === '/slides/@row');
  await clickAt(await center('/slides/@row/blocks/@first'));
  await press(`${mod}+c`);
  assert.match(await status(), /Copied 1 block/);
  await ev(() => window.ed.setSlide(1));
  await page.waitForFunction(() => window.ed.selection[0]?.key === '/slides/@grouped');
  await page.locator('.opf-studio-box[data-key="/slides/@grouped"]').focus();
  before = await depth();
  await press(`${mod}+v`);
  {
    const blocks = await ev(() => window.ed.getDocument().slides[1].blocks);
    assert.equal(blocks.length, 3, 'the block is pasted on the other slide');
    assert.equal(blocks[2].text, 'First block of text');
    assert.notEqual(blocks[2].id, 'first', 'with a fresh id');
    assert.equal(await depth(), before + 1, 'paste is one step');
    assert.deepEqual(await keys(), [`/slides/@grouped/blocks/@${blocks[2].id}`], 'and selected');
  }
  // Slides copied in one editor paste into another, the catalog records they use namespaced where they differ.
  await ev(async (d) => {
    const host = window.makeHost('host2', 1400, 860);
    d.catalogs.custom.layouts['text-and-media'] = { name: 'Another layout of the same id', direction: 'column', regions: [{ name: 'main' }] };
    window.other = window.opfWs.createOpfEditor(host, { document: d, ...window.base(), layout: 'studio' });
    await window.other.ready;
  }, studioDeck());
  await page.waitForFunction(() => document.querySelectorAll('#host2 .slide-card').length === 5);
  await page.locator('#host .slide-card[data-index="2"]').click();
  await page.locator('#host .slide-card[data-index="2"]').focus();
  await press(`${mod}+c`);
  assert.match(await status(), /Copied 1 slide/);
  await page.locator('#host2 .slide-card[data-index="0"]').click();
  await page.locator('#host2 .slide-card[data-index="0"]').focus();
  await press(`${mod}+v`);
  {
    const other = await ev(() => window.other.getDocument());
    assert.equal(other.slides.length, 6, 'the slide is pasted in the other editor');
    const pasted = other.slides[1];
    assert.equal(pasted.title, 'Layout slide');
    assert.notEqual(pasted.layout, 'text-and-media', `its layout record is renamed (${pasted.layout}), since the other deck has a different one of that id`);
    assert.ok(other.catalogs.custom.layouts[pasted.layout?.replace(/^custom:/, '')] ?? other.catalogs.custom.layouts[pasted.layout], 'and the record comes along');
  }
  await ev(() => { window.other.destroy(); document.querySelector('#host2').remove(); });
  mark('7: copy a block, select another slide, paste: one step, fresh ids; slides copied between two editors paste with their catalog records namespaced');

  // ---- 8. text ---------------------------------------------------------------------------------------------------------------------------
  await ev(() => window.ed.setSlide(0));
  await page.waitForFunction(() => window.ed.selection[0]?.key === '/slides/@row');
  {
    const text = await page.locator('.opf-studio-canvas [data-opf-path="slides.0.blocks.0.text"] text').first().boundingBox();
    before = await depth();
    await clickAt({ x: text.x + text.width * 0.5, y: text.y + text.height / 2 }, { count: 2 });
    await page.locator('.opf-inline-input').waitFor();
    const caret = await ev(() => ({ tag: document.activeElement.tagName, start: document.activeElement.selectionStart, end: document.activeElement.selectionEnd, length: document.activeElement.value.length }));
    assert.equal(caret.tag, 'TEXTAREA', 'a double-click enters editing');
    assert.ok(caret.start === caret.end && caret.start > 0 && caret.start < caret.length, `with the caret at the pointer: ${JSON.stringify(caret)}`);
    await page.keyboard.type('X');
    await press('Escape');
    const value = await ev(() => window.ed.getDocument().slides[0].blocks[0].text);
    assert.equal(value.length, 'First block of text'.length + 1);
    assert.ok(value.includes('X') && !value.startsWith('X') && !value.endsWith('X'), `typed at the caret: ${value}`);
    assert.deepEqual(await keys(), ['/slides/@row/blocks/@first'], 'Esc commits and keeps the block selected');
    assert.equal(await ev(() => document.activeElement.dataset.key), '/slides/@row/blocks/@first', 'focus is back on the block');
    assert.equal(await depth(), before + 1);
    // Typing on a selected text node replaces its text.
    before = await depth();
    await page.keyboard.type('Hello');
    await press('Escape');
    assert.equal(await ev(() => window.ed.getDocument().slides[0].blocks[0].text), 'Hello', 'typing on a selected text node replaces its text');
    assert.equal(await depth(), before + 1, 'as one step');
    await press(`${mod}+z`);
    await press(`${mod}+z`);
    assert.equal(await ev(() => window.ed.getDocument().slides[0].blocks[0].text), 'First block of text');
  }
  mark('8: a double-click edits with the caret at the pointer; typing on a selected text node replaces it; Esc commits and keeps the selection');

  // ---- 9. zoom ----------------------------------------------------------------------------------------------------------------------------
  {
    await page.locator('.opf-studio-box[data-key="/slides/@row/blocks/@first"]').focus();
    await press(`${mod}+Equal`);
    assert.equal(await ev(() => window.ed.zoom), 1.5, 'Mod+= steps the zoom');
    assert.equal(await page.locator('.opf-studio-zoomlabel').textContent(), '150%');
    await press('Shift+Digit1');
    assert.equal(await ev(() => window.ed.zoom), 1, 'Shift+1 fits');
    // A two-finger pinch (synthetic touch pointers) zooms around the midpoint.
    const zoomed = await ev(() => {
      const viewport = document.querySelector('.opf-studio-viewport');
      const box = viewport.getBoundingClientRect();
      const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
      const fire = (type, id, x) => viewport.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: cy, bubbles: true, cancelable: true, isPrimary: id === 21 }));
      fire('pointerdown', 21, cx - 50); fire('pointerdown', 22, cx + 50);
      for (let step = 1; step <= 5; step += 1) { fire('pointermove', 21, cx - 50 - step * 10); fire('pointermove', 22, cx + 50 + step * 10); }
      fire('pointerup', 21, cx - 100); fire('pointerup', 22, cx + 100);
      return window.ed.zoom;
    });
    assert.ok(Math.abs(zoomed - 2) < 0.05, `a pinch to twice the distance zooms to about 200%: ${zoomed}`);
    // Space and a drag pan.
    await page.locator('.opf-studio-box[data-key="/slides/@row/blocks/@first"]').focus();
    const scroll = await ev(() => document.querySelector('.opf-studio-viewport').scrollLeft);
    const view = await page.locator('.opf-studio-viewport').boundingBox();
    await page.keyboard.down('Space');
    await page.mouse.move(view.x + view.width / 2, view.y + view.height / 2);
    await page.mouse.down();
    await page.mouse.move(view.x + view.width / 2 - 120, view.y + view.height / 2, { steps: 4 });
    await page.mouse.up();
    await page.keyboard.up('Space');
    assert.ok(await ev(() => document.querySelector('.opf-studio-viewport').scrollLeft) > scroll + 60, 'Space and a drag pan the viewport');
    await ev(() => window.ed.fit());
  }
  mark('9: Shift+1 fits, Mod+= steps, a pinch zooms around the fingers, Space and a drag pan');

  // ---- 10. source -----------------------------------------------------------------------------------------------------------------------------
  {
    await page.locator('.opf-studio-box[data-key="/slides/@row/blocks/@first"]').focus();
    await press('Control+Backquote');
    await page.locator('.opf-studio-sourcearea .cm-editor').waitFor();
    assert.notEqual(await ev(() => document.querySelector('.opf-studio').dataset.source), 'off', 'Ctrl+` opens the split');
    await clickAt(await center('/slides/@row/blocks/@third'));
    assert.equal(await ev(() => document.activeElement.dataset.key), '/slides/@row/blocks/@third', 'a canvas selection keeps focus on the slide');
    await page.waitForFunction(() => document.querySelector('.opf-source-flash'), undefined, { timeout: 5000 });
    const visible = await ev(() => { const line = document.querySelector('.opf-source-flash'); const box = line.getBoundingClientRect(); const pane = document.querySelector('.opf-studio-sourcearea .cm-scroller').getBoundingClientRect(); return box.top >= pane.top && box.bottom <= pane.bottom; });
    assert.ok(visible, 'and reveals its range in the source');
    await ev(() => window.ed.sourcePane.revealPath('/slides/1/blocks/1', { select: true, focus: true }));
    await page.waitForFunction(() => window.ed.selection[0]?.key === '/slides/@grouped/blocks/@pair', undefined, { timeout: 5000 });
    assert.equal(await ev(() => window.ed.slideIndex), 1, 'moving the cursor into /slides/1/blocks/1 shows its slide and selects that block');
    assert.equal(await page.locator('.opf-studio-row[data-key="/slides/@grouped/blocks/@pair"]').getAttribute('aria-selected'), 'true', 'the layers follow the source');
    const text = await ev(() => window.ed.sourcePane.editor.api.getValue());
    await ev(() => { const api = window.ed.sourcePane.editor.api; api.replace(0, api.getValue().length, '{ not json'); window.ed.sourcePane.getText(); });
    await page.waitForFunction(() => document.querySelector('.opf-studio-viewport').hasAttribute('inert'));
    assert.match(await ev(() => document.querySelector('.opf-studio-validity').textContent), /Source has errors/);
    await ev((value) => { const api = window.ed.sourcePane.editor.api; api.replace(0, api.getValue().length, value); window.ed.sourcePane.getText(); }, text);
    await page.waitForFunction(() => !document.querySelector('.opf-studio-viewport').hasAttribute('inert'));
    await page.locator('.opf-studio-box').first().focus();
    await press('Control+Backquote');
    assert.equal(await ev(() => document.querySelector('.opf-studio').dataset.source), 'off');
  }
  mark('10: Ctrl+` opens the source; a canvas selection reveals its range without moving focus; the source cursor selects on the canvas; invalid text locks the canvas');

  // ---- 11. undo: each command is one step and undo restores the selection ---------------------------------------------------------------
  await ev(() => window.ed.setSlide(0));
  await page.waitForFunction(() => window.ed.selection[0]?.key === '/slides/@row');
  for (const [label, keysPressed, expectChange] of [['duplicate', `${mod}+d`, true], ['move later', ']', true], ['move earlier', '[', true], ['delete', 'Delete', true]]) {
    await clickAt(await center('/slides/@row/blocks/@second'));
    const selected = await keys();
    const start = await depth();
    const doc = await ev(() => window.ed.getDocument());
    await press(keysPressed);
    assert.equal(await depth(), start + (expectChange ? 1 : 0), `${label} is one step`);
    await press(`${mod}+z`);
    assert.deepEqual(await ev(() => window.ed.getDocument()), doc, `undoing ${label} restores the document`);
    assert.deepEqual(await keys(), selected, `undoing ${label} restores the selection`);
  }
  mark('11: duplicate, move and delete are one step each; undo restores the document and the selection');

  // ---- 12. presets ------------------------------------------------------------------------------------------------------------------------------
  {
    await clickAt(await center('/slides/@row/blocks/@third'));
    const snapshot = await ev(() => ({ doc: window.ed.getDocument(), depth: window.ed.session.snapshot().undoDepth, slide: window.ed.slideIndex, selection: window.ed.selection.map((entry) => entry.key) }));
    await ev(() => { window.layoutEvents = []; window.ed.on('layout', (event) => window.layoutEvents.push(event.layout)); });
    assert.equal(await ev(() => window.ed.setLayout('playground')), true);
    assert.equal(await ev(() => window.ed.layout), 'playground');
    assert.equal(await ev(() => document.querySelector('.opf-studio').dataset.preset), 'playground');
    assert.equal(await page.locator('.opf-studio-sourcearea .cm-editor').isVisible(), true, 'the Playground shows the source beside the slide');
    assert.equal(await page.locator('.opf-studio-left').isVisible(), false);
    assert.equal(await ev(() => window.ed.canvas.textEntry), 'click', 'the Playground types straight into the slide');
    assert.deepEqual(await ev(() => ({ doc: window.ed.getDocument(), depth: window.ed.session.snapshot().undoDepth, slide: window.ed.slideIndex })), { doc: snapshot.doc, depth: snapshot.depth, slide: snapshot.slide });
    await page.locator('[data-studio=open-studio]').click();
    assert.equal(await ev(() => window.ed.layout), 'studio');
    assert.deepEqual(await ev(() => ({ doc: window.ed.getDocument(), depth: window.ed.session.snapshot().undoDepth, slide: window.ed.slideIndex, selection: window.ed.selection.map((entry) => entry.key) })), snapshot, 'back in the Studio: the same document, history, slide and selection');
    assert.deepEqual(await ev(() => window.layoutEvents), ['playground', 'studio']);
  }
  mark('12: setLayout("playground") and back keeps the document, the history, the slide and the selection');

  // ---- 13. Edit layout -----------------------------------------------------------------------------------------------------------------------
  {
    await ev(() => window.ed.session.applyPatch([{ op: 'add', path: '/slides/5', value: { id: 'two', title: 'Two columns', layout: 'two-column', blocks: [{ id: 'l', text: 'Left words' }, { id: 'r', text: 'Right words' }] } }]));
    await ev(() => window.ed.setSlide(5));
    await page.waitForFunction(() => window.ed.selection[0]?.key === '/slides/@two');
    await clickAt(await center('/slides/@two/blocks/@l'));
    const kept = await keys();
    before = await depth();
    let dialogs = 0;
    page.on('dialog', (dialog) => { dialogs += 1; dialog.dismiss(); });
    assert.equal(await ev(() => window.ed.commands.run('studio.layout.edit')), true);
    assert.equal(await ev(() => window.ed.view), 'layouts');
    assert.match(await page.locator('.opf-studio-crumbs').textContent(), /Slide 6.*Layout two-column-custom/);
    await page.locator('[data-handoff=apply]').click();
    const doc = await ev(() => window.ed.getDocument());
    assert.equal(doc.slides[5].layout, 'two-column-custom', '"Use on this slide" applies the fork');
    assert.ok(doc.catalogs.custom.layouts['two-column-custom'], 'the fork is in the deck');
    assert.equal(await depth(), before + 1, 'as one step');
    assert.equal(await ev(() => window.ed.view), 'slide', 'and returns to the slide');
    assert.deepEqual(await keys(), kept, 'with its selection');
    await ev(() => window.ed.commands.run('studio.layout.edit'));
    assert.match(await page.locator('.opf-studio-crumbs').textContent(), /Layout two-column-custom/, 'a deck layout is edited in place');
    await page.locator('[data-handoff=back]').click();
    assert.equal(await ev(() => window.ed.view), 'slide');
    assert.equal(dialogs, 0, 'Back with no change returns without a prompt');
  }
  mark('13: Edit layout forks a gallery layout as <id>-custom, Use on this slide applies it as one step and returns to the slide; Back with no change asks nothing');

  // ---- 14. accessibility -------------------------------------------------------------------------------------------------------------------------
  await mount();
  await axe('a slide selected');
  await clickAt(await center('/slides/@row/blocks/@first'));
  await axe('a block selected, with dividers');
  await page.locator('[data-studio=insert]').click();
  await axe('the Insert menu');
  await press('Escape');
  await page.locator('.opf-studio-box[data-key="/slides/@row/blocks/@first"]').focus();
  await press('Shift+F10');
  await page.locator('.opf-studio-menu').waitFor();
  await axe('the context menu');
  await press('Escape');
  await press('Shift+Slash');
  await page.locator('.opf-studio-shortcuts').waitFor();
  await axe('the shortcut sheet');
  await press('Escape');
  await page.locator('[data-studio=source]').click();
  await page.locator('.opf-studio-sourcearea .cm-editor').waitFor();
  await axe('the source split');
  await page.locator('[data-studio=source]').click();
  await page.locator('.opf-studio-tab[data-tab=review]').click();
  await axe('the Review tab');
  await page.locator('.opf-studio-tab[data-tab=design]').click();
  // The keyboard alone: tab to the slide, select, go in and out, move, group, duplicate, delete, edit text, undo.
  {
    await mount();
    await page.locator('[data-studio=file]').focus();
    let guard = 0;
    while (!(await ev(() => document.activeElement?.classList.contains('opf-studio-box'))) && guard++ < 60) await press('Tab');
    assert.ok(guard < 60, 'Tab reaches the slide');
    assert.deepEqual(await keys(), ['/slides/@row']);
    await press('Enter');
    assert.deepEqual(await keys(), ['/slides/@row/title'], 'Enter goes into the slide');
    await press('ArrowRight');
    assert.deepEqual(await keys(), ['/slides/@row/blocks/@first']);
    await press('Shift+Enter');
    assert.deepEqual(await keys(), ['/slides/@row'], 'Shift+Enter selects the parent');
    await press('Enter');
    await press('ArrowRight');
    await press('ArrowRight');
    assert.deepEqual(await keys(), ['/slides/@row/blocks/@second']);
    await press('[');
    assert.deepEqual(await order(0), ['second', 'first', 'third'], '[ moves earlier');
    assert.match(await status(), /Moved Text before Text/, 'and the live region says where it went');
    await press(`${mod}+a`);
    assert.equal((await keys()).length, 4, 'Mod+A selects every sibling (the title too)');
    await press('Escape');
    await press('Enter');
    await press('ArrowRight');
    await press('Shift+ArrowRight');
    await press('Escape');
    await press('Enter');
    await press('ArrowRight');
    assert.deepEqual(await keys(), ['/slides/@row/blocks/@second']);
    // Into the layers by Shift+Tab, a range by Shift+ArrowDown, then group and ungroup.
    let hops = 0;
    while (!(await ev(() => document.activeElement?.closest?.('.opf-studio-tree') !== null)) && hops++ < 40) await press('Shift+Tab');
    assert.ok(hops < 40, 'Shift+Tab reaches the layers');
    while ((await ev(() => document.activeElement.dataset.key)) !== '/slides/@row/blocks/@second' && hops++ < 80) await press('ArrowDown');
    await press('Shift+ArrowDown');
    assert.deepEqual(await keys(), ['/slides/@row/blocks/@second', '/slides/@row/blocks/@first'], 'Shift+ArrowDown in the layers selects a range');
    await press(`${mod}+g`);
    assert.match(await status(), /Grouped 2 blocks/, 'Mod+G groups from the layers');
    await press(`${mod}+Shift+g`);
    assert.deepEqual(await order(0), ['second', 'first', 'third'], 'Shift+Mod+G ungroups');
    await press('Enter');
    assert.equal(await ev(() => document.activeElement.classList.contains('opf-studio-box')), true, 'Enter in the layers goes to the canvas');
    for (let step = 0; step < 6 && (await keys())[0] !== '/slides/@row/blocks/@second'; step += 1) await press('ArrowLeft');
    assert.deepEqual(await keys(), ['/slides/@row/blocks/@second'], `the arrows select siblings again: ${JSON.stringify(await ev(() => document.activeElement.dataset.key))}`);
    await press(`${mod}+d`);
    assert.equal((await order(0)).length, 4, 'Mod+D duplicates');
    await press('Delete');
    assert.equal((await order(0)).length, 3, 'Delete removes');
    assert.match(await status(), /Deleted/);
    await press('F2');
    await page.locator('.opf-inline-input').waitFor();
    await page.keyboard.type(' again');
    await press('Escape');
    assert.match(await ev(() => window.ed.getDocument().slides[0].blocks.map((block) => block.text).join('|')), / again/);
    await press(`${mod}+z`);
    await press('PageDown');
    assert.equal(await ev(() => window.ed.slideIndex), 1, 'PageDown goes to the next slide');
    await press('PageUp');
    assert.equal(await ev(() => window.ed.slideIndex), 0);
  }
  mark('14: axe finds no serious or critical violation with a slide, a block, the Insert menu, the context menu, the shortcut sheet, the source split and Review; the keyboard alone selects, moves, groups, duplicates, deletes and edits, with live announcements');

  // ---- 17. read-only ---------------------------------------------------------------------------------------------------------------------------
  {
    await mount({ readOnly: true });
    const list = await ev(() => window.ed.commands.list());
    for (const id of ['studio.delete', 'studio.group', 'studio.duplicate', 'studio.paste', 'studio.move.earlier', 'studio.insert.text', 'studio.slide.new']) {
      const entry = list.find((command) => command.id === id);
      assert.equal(entry.enabled, false, `${id} is off`);
    }
    assert.equal(list.find((command) => command.id === 'studio.slide.new').reason, 'This editor is read-only.');
    await clickAt(await center('/slides/@row/blocks/@first'));
    assert.deepEqual(await keys(), ['/slides/@row/blocks/@first'], 'selection still works');
    const doc = await ev(() => window.ed.getDocument());
    await press('Delete');
    assert.deepEqual(await ev(() => window.ed.getDocument()), doc, 'Delete changes nothing');
    assert.match(await status(), /read-only/);
    await press(`${mod}+Equal`);
    assert.equal(await ev(() => window.ed.zoom), 1.5, 'zoom still works');
    assert.equal(await ev(() => window.ed.present()), true, 'Present still works');
    await page.keyboard.press('Escape');
  }
  mark('17: read-only disables every structural command with a reason; selection, zoom and Present still work');
} catch (error) {
  console.error(error);
  await page.screenshot({ path: 'artifacts/studio-browser-failure.png' }).catch(() => {});
  process.exitCode = 1;
} finally {
  if (errors.length) { console.error('page errors:', errors); process.exitCode = 1; }
  await app.close();
}
if (!process.exitCode) console.log(`studio browser: ${checks.length} checks passed\n- ${checks.join('\n- ')}`);
