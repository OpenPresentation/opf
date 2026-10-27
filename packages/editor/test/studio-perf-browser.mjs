import assert from 'node:assert/strict';
import { startStudioPage } from './support/studio-page.mjs';

// CE-20, the Studio at 300 slides (STUDIO-SPEC 12, test 16): a selection is painted (overlay, layers, Design panel, status) in under 50ms at
// p95; a structural commit (the drop of a drag, through the slide adapter: one validated change, the canvas and the overlay redrawn) in under
// 150ms at p95; the filmstrip draws only the thumbnails it shows, and more as it scrolls; memory is stable over 200 edits.
const deck = {
  name: 'Three hundred slides',
  language: 'en-US',
  design: { theme: 'classic', fontScheme: 'roboto' },
  slides: Array.from({ length: 300 }, (_, index) => ({
    id: `s${index + 1}`,
    title: `Slide ${index + 1}`,
    composition: { mode: 'row' },
    blocks: [
      { id: `s${index + 1}-a`, text: `First block on slide ${index + 1}` },
      { id: `s${index + 1}-b`, items: ['One point', 'Another point'] },
      { id: `s${index + 1}-c`, metric: { value: index + 1, label: 'Slide number' } },
    ],
  })),
};
const p95 = (values) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * 0.95))];
const app = await startStudioPage({ args: ['--js-flags=--expose-gc'] });
const { page, errors } = app;
const ev = (fn, arg) => page.evaluate(fn, arg);
try {
  await ev(async (d) => {
    window.ed = window.opfWs.createOpfEditor(window.makeHost(), { document: d, ...window.base(), layout: 'studio' });
    await window.ed.ready;
  }, deck);
  await page.waitForFunction(() => document.querySelectorAll('.opf-studio-box').length > 3 && !document.querySelector('.opf-canvas-fonts'), undefined, { timeout: 60000 });
  await ev(() => window.ed.setSlide(150));
  await page.waitForFunction(() => window.ed.selection[0]?.key === '/slides/@s151');
  await page.waitForTimeout(300);

  // Selection paint.
  const select = await ev(() => {
    const keys = ['/slides/@s151/blocks/@s151-a', '/slides/@s151/blocks/@s151-b', '/slides/@s151/blocks/@s151-c', '/slides/@s151', '/slides/@s151/title'];
    const times = [];
    for (let round = 0; round < 60; round += 1) {
      const start = performance.now();
      window.ed.select([keys[round % keys.length]]);
      times.push(performance.now() - start);
    }
    return times;
  });
  console.log(`selection paint: p95 ${p95(select).toFixed(1)}ms, median ${p95(select.slice().sort((a, b) => a - b).slice(0, 30)).toFixed(1)}ms`);
  assert.ok(p95(select) < 50, `selection paint p95 under 50ms: ${p95(select).toFixed(1)}ms`);

  // A drop commit: the move a drag lands, one change through the adapter, timed until the canvas has drawn it. The font gate checks the
  // document before the canvas draws it: its analysis keeps each slide's faces and families, so a commit that changes one slide analyzes
  // that slide and no other (opf#906; before it, about 250ms of each commit at 300 slides was the gate composing every slide).
  const stats = () => ev(() => ({ ...window.fonts.analysisStats }));
  const statsBefore = await stats();
  const rounds = 30;
  const commit = await ev(async (count) => {
    const times = [];
    window.ed.select(['/slides/@s151/blocks/@s151-a']);
    for (let round = 0; round < count; round += 1) {
      const id = round % 2 ? 'studio.move.earlier' : 'studio.move.later';
      const start = performance.now();
      const ok = window.ed.commands.run(id);
      times.push(performance.now() - start);
      if (!ok) throw new Error(`${id} did not run`);
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
    return times;
  }, rounds);
  const statsAfter = await stats();
  const work = { slides: statsAfter.slides - statsBefore.slides, designs: statsAfter.designs - statsBefore.designs, decks: statsAfter.decks - statsBefore.decks };
  console.log(`drop commit: p95 ${p95(commit).toFixed(1)}ms; font analysis over ${rounds} commits: ${JSON.stringify(work)}`);
  // The work, which no runner's speed changes: at most one slide composed for its faces and one slide design resolved per edit.
  assert.ok(work.slides <= rounds, `${rounds} commits of one slide composed ${work.slides} slides for the font gate (at most one per edit)`);
  assert.ok(work.designs <= rounds, `${rounds} commits of one slide resolved ${work.designs} slide designs (at most one per edit)`);
  // The time: STUDIO-SPEC's 150ms at p95 on a developer laptop (115 to 125ms measured). A shared CI runner is two to three times slower
  // (316ms on the first CI run, its selection paint 2.7 times the laptop's), so on CI the bound is three times the budget; a commit that
  // composes the whole deck again (about 400ms on a laptop, 740ms on CI) fails either, and the work count above catches it on any machine.
  // OPF_STUDIO_COMMIT_LIMIT_MS sets the bound.
  const budget = Number(process.env.OPF_STUDIO_COMMIT_LIMIT_MS ?? (process.env.CI ? 450 : 150));
  assert.ok(p95(commit) < budget, `a drop commit p95 under ${budget}ms: ${p95(commit).toFixed(1)}ms`);

  // The filmstrip draws only the visible thumbnails, and more as it scrolls.
  const drawn = () => ev(() => [...document.querySelectorAll('.slide-card .thumbnail')].filter((thumb) => thumb.querySelector('svg')).length);
  const cards = await ev(() => document.querySelectorAll('.slide-card').length);
  assert.equal(cards, 300);
  const first = await drawn();
  assert.ok(first > 0 && first < 60, `only the visible thumbnails are drawn: ${first} of 300`);
  await ev(() => { const strip = document.querySelector('.opf-studio-filmstrip'); strip.scrollTop = strip.scrollHeight; });
  await page.waitForFunction((count) => [...document.querySelectorAll('.slide-card[data-index="299"] .thumbnail svg')].length > 0, first, { timeout: 15000 });
  assert.ok((await drawn()) < 140, 'scrolling draws the slides it shows, not all of them');

  // Memory over 200 edits: what the first 50 settle at, the next 150 do not grow by much (history entries are patches).
  const heap = () => ev(() => { window.gc?.(); return performance.memory?.usedJSHeapSize ?? 0; });
  const edits = (count) => ev(async (n) => {
    for (let round = 0; round < n; round += 1) {
      window.ed.select(['/slides/@s151/blocks/@s151-a']);
      window.ed.commands.run(round % 2 ? 'studio.move.earlier' : 'studio.move.later');
      if (round % 10 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }, count);
  await edits(50);
  await page.waitForTimeout(500);
  const settled = await heap();
  await edits(150);
  await page.waitForTimeout(500);
  const after = await heap();
  const growth = (after - settled) / (1024 * 1024);
  console.log(`memory: ${(settled / 1048576).toFixed(1)}MB after 50 edits, ${(after / 1048576).toFixed(1)}MB after 200 (${growth.toFixed(1)}MB)`);
  if (settled) assert.ok(growth < 40, `memory is stable over 200 edits: grew ${growth.toFixed(1)}MB`);
  assert.deepEqual(errors, []);
  console.log('studio perf browser: selection paint, drop commit, lazy filmstrip and memory checks passed');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await app.close();
}
