// RR-105 finding 06: a radar in a narrow box draws its legend under the web and the axis core composed, and its web fills the box.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {toSvg, resolvePresentation} from './catalog-harness.mjs';

const skills = {columns: ['Skill', 'Team A', 'Team B'], rows: [['Design', 4, 3], ['Research', 3, 5], ['Build', 5, 4], ['Test', 2, 4], ['Ship', 4, 3]]};
const deck = {design: {fontScheme: 'roboto', background: 'light1'}, slides: [{title: 'Two teams, five skills', blocks: ['radar', 'radar-with-markers', 'filled-radar'].map((type) => ({chart: {type, data: skills}}))}]};
const escape = (text) => text.replace(/\./g, '\.');

test('three radars in a row: legend row under the web, rings 0 to 6, a web at least a third of its box wide', () => {
  const svg = toSvg(deck, 1, {trace: true});
  const items = resolvePresentation(deck).slides[0].geometry.items.filter((item) => item.field === 'chart');
  items.forEach((item, index) => {
    const path = `slides.0.blocks.${index}.chart`, legend = item.chart.layer.radar.legendBox;
    // The legend names: a text box per series (data-opf-box-y), inside core's bottom legend box.
    const names = [...svg.matchAll(new RegExp(String.raw`<g data-opf-box-height="[\d.]+" data-opf-box-width="[\d.]+" data-opf-box-x="[\d.]+" data-opf-box-y="([\d.]+)" data-opf-path="${escape(path)}\.data\.columns\.[12]"`, 'g'))].map(([, y]) => Number(y));
    assert.equal(names.length, 2, path);
    for (const y of names) assert.ok(y >= legend.y - 1 && y <= legend.y + legend.height, `${path}: name at ${y}, legend ${JSON.stringify(legend)}`);
    // The value axis ends at 6 (core's axis), not 10.
    const ticks = [...svg.matchAll(new RegExp(String.raw`<text [^>]*data-opf-path="${escape(path)}"[^>]*>(\d+)<`, 'g'))].map(([, value]) => Number(value));
    assert.equal(Math.max(...ticks), 6, `${path} ticks ${ticks}`);
    // The web: the series outline spans at least a third of the box's width.
    const d = new RegExp(String.raw`<path d="([^"]+)" data-opf-path="${escape(path)}\.data\.columns\.2"`).exec(svg)?.[1];
    assert.ok(d, path);
    const xs = [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(([, x]) => Number(x));
    assert.ok(Math.max(...xs) - Math.min(...xs) >= item.box.width / 3, `${path}: web ${Math.max(...xs) - Math.min(...xs)} wide in a box ${item.box.width}`);
  });
});
