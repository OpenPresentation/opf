import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { startWorkspacePage, deck } from './workspace-page.mjs';

// A current viewBox can still be clipped by the thumbnail's CSS viewport.
// Check the actual screen transform and painted title/body, using the real renderer.
export async function runThumbnailPaintedFitRegression({ artifactDir } = {}) {
  if (artifactDir) mkdirSync(artifactDir, { recursive: true });
  const app = await startWorkspacePage({ body: '', viewport: { width: 1280, height: 900 } });
  const { page, errors } = app;
  const observations = [];
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const makeDeck = () => deck(3, { design: { theme: 'classic', fontScheme: 'roboto', dimensions: { widthInches: 13.3333333333, heightInches: 7.5 } } });
  const mount = async kind => {
    await ev(async ({ kind, value }) => {
      window.fitEditor?.destroy();
      document.querySelector('#painted-fit')?.remove();
      const host = document.createElement('div');
      host.id = 'painted-fit';
      host.style.cssText = 'width:1000px;height:760px';
      document.body.append(host);
      window.fitSourceState = null;
      let slots;
      if (kind === 'manager') {
        host.innerHTML = '<nav id="fit-manager" style="width:300px"></nav>';
        slots = { slides: host.querySelector('#fit-manager') };
      }
      window.fitEditor = window.opfWs.createOpfEditor(host, {
        document: value, fonts: window.fonts, catalogs: [window.opfWs.gallery],
        ...(slots ? { slots } : {}), fit: 'contain',
        on: { source: state => { window.fitSourceState = state; } },
      });
      await window.fitEditor.ready;
    }, { kind, value: makeDeck() });
  };
  const editDimensions = async (widthInches, heightInches, source = false) => {
    await ev(({ widthInches, heightInches, source }) => {
      const next = structuredClone(window.fitEditor.getDocument());
      next.design.dimensions = { widthInches, heightInches };
      if (source) {
        if (!window.fitEditor.setSourceText(JSON.stringify(next))) throw Error('Current source was not applied');
      } else window.fitEditor.session.set('design.dimensions', next.design.dimensions);
    }, { widthInches, heightInches, source });
  };
  const sourceAndStrip = async ratio => {
    await page.waitForFunction(ratio => {
      const host = document.querySelector('#painted-fit');
      const same = svg => svg && Math.abs(svg.viewBox.baseVal.width / svg.viewBox.baseVal.height - ratio) < .001;
      const thumbs = [...host.querySelectorAll('.opf-thumbs-frame > svg')];
      return same(host.querySelector('.opf-canvas-preview > svg')) && thumbs.length > 0 && thumbs.every(same) && window.fitSourceState?.status.kind === 'valid';
    }, ratio);
    const current = await ev(() => ({
      document: window.fitEditor.getDocument(),
      source: window.fitEditor.sourcePane.editor.api.getValue(),
      verdict: window.fitSourceState,
    }));
    assert.deepEqual(JSON.parse(current.source), current.document, 'current source and committed document agree');
    assert.equal(current.verdict.text, current.source, 'verdict binds the exact current source');
  };
  const capture = async (phase, ratio) => {
    await page.waitForFunction(ratio => {
      const svgs = [...document.querySelectorAll('#painted-fit .slide-card .thumbnail svg')];
      return svgs.length === 3 && svgs.every(svg => Math.abs(svg.viewBox.baseVal.width / svg.viewBox.baseVal.height - ratio) < .001);
    }, ratio);
    await ev(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const thumbnails = await ev(() => [...document.querySelectorAll('#painted-fit .slide-card .thumbnail')].map((frame, index) => {
      const svg = frame.querySelector('svg'), box = svg.viewBox.baseVal;
      const rect = frame.getBoundingClientRect();
      const clip = { left: rect.left + frame.clientLeft, top: rect.top + frame.clientTop, right: rect.left + frame.clientLeft + frame.clientWidth, bottom: rect.top + frame.clientTop + frame.clientHeight };
      const transform = (box, matrix) => {
        const points = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]].map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix));
        return { left: Math.min(...points.map(p => p.x)), top: Math.min(...points.map(p => p.y)), right: Math.max(...points.map(p => p.x)), bottom: Math.max(...points.map(p => p.y)) };
      };
      const matrix = svg.getScreenCTM();
      const texts = [...svg.querySelectorAll('text')];
      const labels = ['Slide ' + (index + 1), 'Words on slide ' + (index + 1)].map(text => {
        const node = texts.find(node => node.textContent === text);
        return { text, bounds: node ? transform(node.getBBox(), node.getScreenCTM()) : null };
      });
      return { index, clip, viewBox: { width: box.width, height: box.height }, paintedSlide: transform(box, matrix), matrix: { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d }, preserveAspectRatio: { align: svg.preserveAspectRatio.baseVal.align, meetOrSlice: svg.preserveAspectRatio.baseVal.meetOrSlice }, labels };
    }));
    observations.push({ phase, ratio, thumbnails });
    if (artifactDir) await page.screenshot({ path: path.join(artifactDir, phase + '.png'), fullPage: true });
    for (const thumb of thumbnails) {
      const inside = bounds => bounds.left >= thumb.clip.left - 1 && bounds.top >= thumb.clip.top - 1 && bounds.right <= thumb.clip.right + 1 && bounds.bottom <= thumb.clip.bottom + 1;
      assert.ok(thumb.matrix.a > 0 && Math.abs(thumb.matrix.a - thumb.matrix.d) < .0001 && Math.abs(thumb.matrix.b) < .0001 && Math.abs(thumb.matrix.c) < .0001, phase + ': uniform, unskewed painted scale');
      assert.deepEqual(thumb.preserveAspectRatio, { align: 6, meetOrSlice: 1 }, phase + ': actual SVG uses xMidYMid meet');
      assert.ok(inside(thumb.paintedSlide), phase + ': complete painted slide fits thumbnail frame');
      assert.ok(Math.abs((thumb.paintedSlide.right - thumb.paintedSlide.left) / (thumb.paintedSlide.bottom - thumb.paintedSlide.top) - ratio) < .001, phase + ': painted aspect ratio');
      for (const label of thumb.labels) {
        assert.ok(label.bounds && label.bounds.right > label.bounds.left && label.bounds.bottom > label.bounds.top, phase + ': title/body really painted: ' + label.text);
        assert.ok(inside(label.bounds), phase + ': painted title/body is visible: ' + label.text);
      }
    }
    console.log(JSON.stringify({ paintedThumbnailFit: phase, ratio, thumbnails: thumbnails.length }));
  };
  try {
    await mount('manager');
    await capture('manager-wide', 16 / 9);
    for (const [width, height, name] of [[7.5, 10, 'portrait'], [10, 7.5, 'four-three'], [13.3333333333, 7.5, 'wide-again']]) {
      await editDimensions(width, height);
      await capture('manager-' + name, width / height);
    }
    await mount('default');
    await sourceAndStrip(16 / 9);
    const original = await ev(() => window.fitEditor.getDocument());
    for (const [width, height, name] of [[10, 7.5, 'four-three'], [7.5, 10, 'portrait'], [13.3333333333, 7.5, 'wide']]) {
      await editDimensions(width, height, true);
      await sourceAndStrip(width / height);
      const current = await ev(() => window.fitEditor.getDocument());
      assert.equal(current.name, original.name, 'same-title metadata edit retains the deck title');
      assert.deepEqual(current.slides, original.slides, 'same-title/count metadata edit preserves every slide');
      assert.equal(await ev(() => window.fitEditor.setView('sorter')), true);
      await capture('later-sorter-' + name, width / height);
      assert.equal(await ev(() => window.fitEditor.setView('slide')), true);
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ thumbnailPaintedFitRegression: 'passed', phases: observations.length, realRenderer: true }));
    return observations;
  } finally {
    await ev(() => { window.fitEditor?.destroy(); document.querySelector('#painted-fit')?.remove(); });
    if (artifactDir) writeFileSync(path.join(artifactDir, 'observations.json'), JSON.stringify(observations, null, 2) + '\n');
    await app.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await runThumbnailPaintedFitRegression({ artifactDir: process.argv[2] });
}
