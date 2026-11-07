// node summary.mjs <sweep>: one gate table for the six arrangements (C:/opf-work/shapes/sh-19/gate.md) and counts by what drew each deck.
import { readFileSync, writeFileSync } from 'node:fs';
const sweep = process.argv[2] ?? 'sweep4', base = 'C:/opf-work/shapes/sh-19';
const rows = [];
for (const k of ['pyramid', 'matrix', 'cycle', 'chevrons', 'flow', 'vertical-flow']) rows.push(...JSON.parse(readFileSync(`${base}/${sweep}/${k}/gate.json`, 'utf8')));
const count = f => rows.filter(f).length;
const opf = rows.filter(r => r.drew === 'SmartArt (OPF layout)'), built = rows.filter(r => r.drew === 'SmartArt (built-in)');
const max = (list, f) => list.length ? Math.max(...list.map(f)) : 0;
const lines = [
  `# SH-19 gate (${sweep}, ${rows.length} decks)`, '',
  `- OPF layout, live: ${opf.length}, pass ${count(r => r.drew === 'SmartArt (OPF layout)' && r.result === 'pass')}; node rectangles max ${max(opf, r => r.rect).toFixed(3)} pt, arrow turns max ${max(opf, r => r.turn ?? 0).toFixed(3)} degrees; native gate max mad ${max(opf, r => r.native?.mad ?? 0)} (quarter) / ${max(opf, r => r.native?.mad1280 ?? 0)} (full), text ${max(opf, r => r.native?.text ?? 0)} px`,
  "- Shapes vs preview leaves out each node’s text rectangle less its margins, grown by 0.2 em up and down (the preview sets baselines up to 0.15 em below PowerPoint’s; the native check measures that offset). SH-17’s gate left out only the rectangle less its margins, which counted a one-level pyramid’s 36 pt text as a shape difference (2.67 to 3.82, on origin/main too); SH-09’s left out the whole rectangle.",
  `- built-in layout, live: ${built.length}, pass ${count(r => r.drew === 'SmartArt (built-in)' && r.result === 'pass')} (SH-09, SH-17 and SH-18's domains, with SMART_ART_DOMAIN.lineWidth: five decks with a line over 500 px now draw OPF's design as native shapes)`,
  ...Object.entries(rows.reduce((m, r) => (r.live ? m : (m[r.drew] = (m[r.drew] ?? 0) + 1, m)), {})).map(([k, v]) => `- ${k} (native): ${v}`), '',
];
writeFileSync(`${base}/gate.md`, lines.join('\n') + '\n' + readFileSync(`${base}/${sweep}/pyramid/gate.md`, 'utf8').split('\n').slice(0, 2).join('\n') + '\n' +
  ['pyramid', 'matrix', 'cycle', 'chevrons', 'flow', 'vertical-flow'].map(k => readFileSync(`${base}/${sweep}/${k}/gate.md`, 'utf8').split('\n').slice(2).join('\n')).join(''));
console.log(lines.join('\n'));
const fails = opf.filter(r => r.result !== 'pass'); if (fails.length) console.log('OPF layout failures:', fails.map(r => `${r.id} ${r.result}`).join('; '));
