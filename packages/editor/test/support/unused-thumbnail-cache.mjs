import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startWorkspacePage, deck } from './workspace-page.mjs';

const dimensions = { widthInches: 13.3333333333, heightInches: 7.5 };
const makeDeck = () => deck(20, { design: { theme: 'classic', fontScheme: 'roboto', dimensions } });
const near = (value, expected) => Math.abs(value - expected) < 0.001;

// Count real renderer selections, not elapsed time or a mocked thumbnail result.
// The wrapper's relative import bypasses this alias and forwards every request.
export async function runUnusedThumbnailCacheRegression({ artifactDir } = {}) {
  if (artifactDir) mkdirSync(artifactDir, { recursive: true });
  const app = await startWorkspacePage({
    body: '',
    viewport: { width: 1280, height: 900 },
    bundle: { alias: { '@openpresentation/opf-render/svg': fileURLToPath(new URL('./counted-svg.mjs', import.meta.url)) } },
  });
  const { page, errors } = app;
  const observations = [];
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const reset = () => ev(() => { window.__opfThumbnailRenderCalls = []; });
  const settle = async (ratio, { strip = false, manager = false } = {}) => {
    await page.waitForFunction(({ ratio, strip, manager }) => {
      const host = document.querySelector('#cache-regression');
      const sameRatio = svg => svg && Math.abs(svg.viewBox.baseVal.width / svg.viewBox.baseVal.height - ratio) < 0.001;
      if (!sameRatio(host?.querySelector('.opf-canvas-preview > svg'))) return false;
      const thumbs = [...host.querySelectorAll('.opf-thumbs-frame > svg')];
      if (strip && (!thumbs.length || thumbs.some(svg => !sameRatio(svg)))) return false;
      const managed = [...host.querySelectorAll('.slide-card .thumbnail svg')];
      return !manager || (managed.length === 20 && managed.every(sameRatio));
    }, { ratio, strip, manager }, { timeout: 15000 });
    await ev(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  const capture = async (phase, ratio, options = {}) => {
    await settle(ratio, options);
    const result = await ev(() => {
      const host = document.querySelector('#cache-regression');
      const ratioOf = svg => svg.viewBox.baseVal.width / svg.viewBox.baseVal.height;
      return {
        calls: window.__opfThumbnailRenderCalls,
        canvasRatio: ratioOf(host.querySelector('.opf-canvas-preview > svg')),
        thumbnailRatios: [...host.querySelectorAll('.opf-thumbs-frame > svg')].map(ratioOf),
        managedRatios: [...host.querySelectorAll('.slide-card .thumbnail svg')].map(ratioOf),
        sourceText: window.cacheEditor.sourcePane?.editor.api.getValue() ?? null,
        sourceVerdict: window.cacheSourceState,
        document: window.cacheEditor.getDocument(),
        managerPresent: Boolean(window.cacheEditor.slideManager),
      };
    });
    const resultRow = { phase, calls: result.calls, canvasRatio: result.canvasRatio, thumbnails: result.thumbnailRatios.length, managed: result.managedRatios.length };
    observations.push(resultRow);
    console.log(JSON.stringify({ thumbnailWork: resultRow }));
    assert.ok(near(result.canvasRatio, ratio), phase + ': current canvas dimensions');
    assert.ok(result.thumbnailRatios.every(value => near(value, ratio)), phase + ': every drawn strip thumbnail uses current metadata');
    if (options.manager) {
      assert.equal(result.managedRatios.length, 20, phase + ': actual manager renders all requested slides');
      assert.ok(result.managedRatios.every(value => near(value, ratio)), phase + ': every manager thumbnail uses current metadata');
    }
    if (options.noUnusedBatch) {
      assert.ok(!result.calls.some(call => Array.isArray(call.selection) && call.selection.length === 20), phase + ': no unused whole-deck render batch');
    }
    if (options.strip) {
      assert.ok(result.thumbnailRatios.length > 0 && result.thumbnailRatios.length < 20, phase + ': actual visible strip remains lazy');
    }
    if (options.source) {
      assert.deepEqual(JSON.parse(result.sourceText), result.document, phase + ': the source and committed document agree');
      assert.equal(result.sourceVerdict?.text, result.sourceText, phase + ': verdict belongs to current exact source');
      assert.equal(result.sourceVerdict?.status.kind, 'valid', phase + ': current source is valid');
    }
    if (artifactDir) await page.screenshot({ path: path.join(artifactDir, phase + '.png'), fullPage: true });
    return result;
  };
  const mount = async (kind) => {
    await ev(async ({ kind, document: value }) => {
      window.cacheEditor?.destroy();
      document.querySelector('#cache-regression')?.remove();
      const host = document.createElement('div');
      host.id = 'cache-regression';
      host.style.cssText = 'width:1000px;height:760px';
      document.body.append(host);
      window.cacheSourceState = null;
      let slots;
      if (kind !== 'default') {
        host.innerHTML = '<div id="bar"></div><div id="source" style="height:150px"></div><div id="canvas" style="height:420px;width:1000px"></div><div id="navigator"></div><div id="thumbs" style="width:1000px;overflow:hidden"></div><div id="manager"></div>';
        slots = { canvas: host.querySelector('#canvas') };
        if (kind === 'org') Object.assign(slots, { source: host.querySelector('#source'), navigator: host.querySelector('#navigator'), thumbnails: host.querySelector('#thumbs'), toolbar: host.querySelector('#bar'), overlay: host });
        if (kind === 'manager') slots.slides = host.querySelector('#manager');
      }
      window.__opfThumbnailRenderCalls = [];
      window.cacheEditor = window.opfWs.createOpfEditor(host, {
        document: value, fonts: window.fonts, catalogs: [window.opfWs.gallery],
        ...(slots ? { slots } : {}),
        fit: 'contain',
        on: { source: state => { window.cacheSourceState = state; } },
      });
      await window.cacheEditor.ready;
    }, { kind, document: makeDeck() });
  };
  const editDimensions = async (widthInches, heightInches, source = false) => {
    await reset();
    await ev(({ widthInches, heightInches, source }) => {
      const next = structuredClone(window.cacheEditor.getDocument());
      next.design.dimensions = { widthInches, heightInches };
      if (source) {
        if (!window.cacheEditor.setSourceText(JSON.stringify(next))) throw new Error('Current source was not applied');
      } else window.cacheEditor.session.set('design.dimensions', next.design.dimensions);
    }, { widthInches, heightInches, source });
  };
  try {
    await mount('canvas');
    await capture('canvas-initial', 16 / 9, { noUnusedBatch: true });
    await editDimensions(10, 7.5);
    await capture('canvas-four-three', 4 / 3, { noUnusedBatch: true });

    await mount('org');
    const original = await capture('org-initial', 16 / 9, { strip: true, source: true, noUnusedBatch: true });
    for (const [width, height, label] of [[10, 7.5, 'four-three'], [7.5, 10, 'portrait']]) {
      await editDimensions(width, height, true);
      const current = await capture('org-' + label, width / height, { strip: true, source: true, noUnusedBatch: true });
      assert.equal(current.document.name, original.document.name, 'same-title edit retains the title');
      assert.deepEqual(current.document.slides, original.document.slides, 'same-title/count edit changes metadata only');
    }

    await mount('manager');
    await capture('manager-initial', 16 / 9, { manager: true });
    await editDimensions(7.5, 10);
    await capture('manager-portrait', 0.75, { manager: true });

    await mount('default');
    await capture('default-initial', 16 / 9, { strip: true, source: true, noUnusedBatch: true });
    await editDimensions(10, 7.5, true);
    await capture('default-before-sorter', 4 / 3, { strip: true, source: true, noUnusedBatch: true });
    await reset();
    assert.equal(await ev(() => window.cacheEditor.setView('sorter')), true);
    await capture('default-sorter', 4 / 3, { manager: true });
    assert.equal(await ev(() => window.cacheEditor.setView('slide')), true);
    await editDimensions(7.5, 10, true);
    await capture('default-hidden-sorter-edit', 0.75, { strip: true, source: true, noUnusedBatch: true });
    await reset();
    assert.equal(await ev(() => window.cacheEditor.setView('sorter')), true);
    await capture('default-sorter-portrait', 0.75, { manager: true });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ unusedThumbnailCacheRegression: 'passed', phases: observations.length, realRenderer: true, timingAssertions: false }));
    return observations;
  } catch (error) {
    const state = await ev(() => ({
      document: window.cacheEditor?.getDocument(),
      canvas: document.querySelector('#cache-regression .opf-canvas-preview > svg')?.getAttribute('viewBox'),
      calls: window.__opfThumbnailRenderCalls,
    }));
    console.error(JSON.stringify({ failedRegressionState: state, browserErrors: errors }));
    throw error;
  } finally {
    if (artifactDir) writeFileSync(path.join(artifactDir, 'observations.json'), JSON.stringify(observations, null, 2) + '\n');
    await app.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await runUnusedThumbnailCacheRegression({ artifactDir: process.argv[2] });
}
