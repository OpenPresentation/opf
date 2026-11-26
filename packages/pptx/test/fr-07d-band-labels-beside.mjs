import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {strFromU8, unzipSync} from 'fflate';
import {gallery} from '@openpresentation/gallery';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {toSvg} from '@openpresentation/opf-render';
import {toPptx} from '../dist/index.js';

// FR-07d (supervisor, 2026-11-26): band labels that do not all stand inside their bands stand beside the plot (a gutter at the end of a
// column, line or area chart's plot; a row above a bar or bullet chart's plot), as data labels outside the plot area at composition's boxes;
// a chart whose labels fit inside exports as before; a chart that names its series beside the last column keeps the legend fallback.

const decks = JSON.parse(readFileSync(new URL('./fixtures/fr-07d-band-label-decks.json', import.meta.url), 'utf8'));
const fontsFor = presentation => loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation, renderOptions: {catalogs: [gallery]}});
const exportDeck = async presentation => {
  const diagnostics = [];
  const bytes = await toPptx(presentation, {catalogs: [gallery], fonts: await fontsFor(presentation), onDiagnostic: d => diagnostics.push(d.code)});
  return {files: unzipSync(bytes), diagnostics};
};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const chartOf = files => strFromU8(files['ppt/charts/chart1.xml']);
const plotOf = xml => {
  const layout = /<c:plotArea>\s*<c:layout>\s*<c:manualLayout>([\s\S]*?)<\/c:manualLayout>/.exec(xml)[1];
  const value = key => Number(new RegExp(`<c:${key} val="([^"]+)"`).exec(layout)[1]);
  return {x: value('x'), y: value('y'), w: value('w'), h: value('h')};
};
const bandLabels = xml => [...xml.matchAll(/<c:ser>[\s\S]*?<\/c:ser>/g)].flatMap(([ser]) => {
  const label = /<c:dLbl><c:idx val="(\d+)"\/>[\s\S]*?<c:x val="([^"]+)"\/><c:y val="([^"]+)"\/>[\s\S]*?algn="(\w+)"/.exec(ser);
  return label ? [{name: /<c:tx>[\s\S]*?<c:v>([^<]*)<\/c:v>/.exec(ser)[1], idx: Number(label[1]), x: Number(label[2]), y: Number(label[3]), align: label[4]}] : [];
});

// The chart parts of the round-3 decks as main exported them before FR-07d (every part and the preview SVG were compared byte for byte
// with main b842f86ea when FR-07d was built; these pin the chart parts).
const INSIDE = {
  'bands-column': '6decd68dae8992e17068be0563b7f02b175e62b90b7334856d0b5fa3f09ddf22',
  'bands-line-reference': '9f10cca4e8da34b6b9f7339f17e77c67db72696d123d9340b573312acb56751c',
  'bullet-kpis': '264042e86998ffff15e56e4bc5c3ba4a235a2d9dee8353991c4b582bbef95404',
  'bullet-rtl': '2273bc39df5bb307031577e1906c6228f9cd749ac3dcaee62143b6e27b868dfb',
};

test('labels that fit inside their bands export as before FR-07d', async () => {
  for (const [name, presentation] of Object.entries(decks.inside)) {
    const {files, diagnostics} = await exportDeck(presentation);
    assert.equal(sha(files['ppt/charts/chart1.xml']), INSIDE[name], `${name}: the chart part is unchanged`);
    assert.ok(!diagnostics.includes('chart-band-labels-in-legend'), name);
  }
});

test('stripes: the labels in a gutter past the plot\'s end (the left right to left), left-aligned, each on its band\'s height', async () => {
  for (const name of ['bands-column', 'bands-line-reference']) {
    const {files, diagnostics} = await exportDeck(decks.beside[name]);
    const xml = chartOf(files), plot = plotOf(xml), labels = bandLabels(xml);
    assert.ok(!diagnostics.includes('chart-band-labels-in-legend'), `${name}: no legend fallback`);
    assert.equal(labels.length, 3, name);
    for (const label of labels) {
      assert.ok(label.x > plot.x + plot.w, `${name}: ${label.name} past the plot's end (${label.x} > ${plot.x + plot.w})`);
      assert.equal(label.align, 'l');
      assert.ok(label.y > plot.y - 0.05 && label.y < plot.y + plot.h, `${name}: ${label.name} beside the plot`);
    }
    assert.equal(new Set(labels.map(label => label.x)).size, 1, `${name}: one column of labels`);
  }
});

test('strips: the labels in a row above the plot, centered, and the plot shorter', async () => {
  for (const name of ['bullet-kpis', 'bullet-rtl']) {
    const {files} = await exportDeck(decks.beside[name]);
    const xml = chartOf(files), plot = plotOf(xml), labels = bandLabels(xml);
    assert.equal(labels.length, 3, name);
    for (const label of labels) {
      assert.equal(label.align, 'ctr');
      assert.ok(label.y < plot.y, `${name}: ${label.name} above the plot`);
      assert.ok(label.x > plot.x - 0.01 && label.x < plot.x + plot.w, `${name}: ${label.name} over the plot`);
    }
  }
});

test('the preview draws the same boxes the export writes', async () => {
  for (const [name, presentation] of Object.entries(decks.beside)) {
    const fonts = await fontsFor(presentation);
    const svg = toSvg(presentation, {fonts, catalogs: [gallery], trace: true})[0];
    const {files} = await exportDeck(presentation);
    const xml = chartOf(files), labels = bandLabels(xml);
    const slide = strFromU8(files['ppt/slides/slide1.xml']);
    const frame = /<p:graphicFrame>[\s\S]*?<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(slide).slice(1).map(Number);
    const boxes = [...svg.matchAll(/<g\b([^>]*)>/g)].map(([, a]) => Object.fromEntries([...a.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]))).filter(g => /\.bands\.\d+\.label$/.test(g['data-opf-path'] ?? ''));
    assert.equal(boxes.length, labels.length, name);
    for (const box of boxes) {
      const text = labels.find(label => Math.abs(label.x * frame[2] / 9525 + frame[0] / 9525 - Number(box['data-opf-box-x'])) < 0.6 && Math.abs(label.y * frame[3] / 9525 + frame[1] / 9525 - Number(box['data-opf-box-y'])) < 0.6);
      assert.ok(text, `${name}: a data label at the preview's box ${box['data-opf-path']}`);
    }
  }
});

test('a chart that names its series beside the last column keeps the legend fallback (a legend of the bands alone)', async () => {
  const {files, diagnostics} = await exportDeck(decks.legend);
  const xml = chartOf(files);
  assert.ok(diagnostics.includes('chart-band-labels-in-legend'));
  assert.equal(bandLabels(xml).length, 0);
  const legend = /<c:legend>[\s\S]*?<\/c:legend>/.exec(xml)[0];
  assert.deepEqual([...legend.matchAll(/<c:idx val="(\d+)"\/><c:delete val="1"\/>/g)].map(m => Number(m[1])).sort(), [3, 4, 5]);
});
