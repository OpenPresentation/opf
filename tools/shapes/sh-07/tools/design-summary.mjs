// node design-summary.mjs: per family and design, the whole-slide result (the default design's thresholds) and the converter result
// (geometry outside the text and text placement, same limits). Writes ../designs/summary.md and prints the table.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const root = 'C:/opf-work/shapes/sh-07';
const L = { hot: 0.5, mad: 1.0, mad1280: 2.0, text: 1.5 };
const designs = [['default', root], ['light', `${root}/designs/light`], ['serif', `${root}/designs/serif`], ['segoe', `${root}/designs/segoe`], ['japanese', `${root}/designs/japanese`]];
const load = (dir, file) => existsSync(`${dir}/shapes/${file}`) ? JSON.parse(readFileSync(`${dir}/shapes/${file}`, 'utf8')) : [];
const data = designs.map(([name, dir]) => ({ name, scores: load(dir, 'scores.json'), geometry: new Map(load(dir, 'geometry.json').map((r) => [r.id, r])), text: new Map(load(dir, 'textpos.json').map((r) => [r.id, r])) }));
const families = [...new Set(data[0].scores.map((r) => r.family))];
const rows = [];
for (const family of families) {
  const cells = data.map((d) => {
    const list = d.scores.filter((r) => r.family === family && !r.missing);
    if (!list.length) return '';
    const whole = list.filter((r) => r.hot > L.hot || r.hot1280 > L.hot || r.mad > L.mad || r.mad1280 > L.mad1280);
    const geometry = list.filter((r) => { const g = d.geometry.get(r.id); return Boolean(g) && (g.geometryHot > L.hot || g.geometryMad > L.mad1280); });
    const text = list.filter((r) => { const t = d.text.get(r.id); return Boolean(t) && (Math.abs(t.dyMedian) > L.text || Math.abs(t.dxMedian) > L.text); });
    const mad = Math.max(...list.map((r) => r.mad)), hot = Math.max(...list.map((r) => r.hot1280));
    const strict = whole.length || text.length ? `over (${[...new Set([...whole, ...text].map((r) => r.id.slice(-1)))].join(',')})` : 'pass';
    return `${strict}; geometry ${geometry.length ? 'FAIL' : 'pass'}; mad ${mad}, hot ${hot} %`;
  });
  rows.push(`| ${family} | ${cells.join(' | ')} |`);
}
const table = [`| Family | ${designs.map(([n]) => n).join(' | ')} |`, `| --- | ${designs.map(() => '---').join(' | ')} |`, ...rows].join('\n');
writeFileSync(`${root}/designs/summary.md`, `# SH-07 per design\n\nEach cell: the whole-slide result against the default design's thresholds (hot <= ${L.hot} % at 320 and 1280, mad <= ${L.mad} at 320 and <= ${L.mad1280} at 1280, median text offset <= ${L.text} px; "over (a,b)" names the sources over), the geometry result (outside every text body: hot <= ${L.hot} %, mad <= ${L.mad1280} at 1280), and the worst mad (320) and hot (1280).\n\nDesigns: default (engine default, dark navy, Aptos); light (classic, forest-green, aptos); serif (minimal, burnt-orange, georgia); segoe (bold, deep-purple, segoe-ui); japanese (classic, steel-blue, yu-gothic, ja-JP, five families with Japanese labels).\n\n${table}\n`);
console.log(table);
