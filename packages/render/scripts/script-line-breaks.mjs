// Line-breaking audit for the non-space scripts (RR-17, FF-44). Core wraps text at white space and, for a token wider than the line, at grapheme
// clusters (`wrapText`, the public API composition uses). This script wraps each corpus sample of Thai, Lao, Khmer, Myanmar, Japanese and
// Chinese (spaces removed, so every break is a grapheme break) at 61 line widths (120 to 600 px, 24 px text, the script's designated face) and counts
//   - breaks inside an ICU word (Intl.Segmenter, dictionary based for Thai, Lao, Khmer, Myanmar): where a dictionary line breaker would not break;
//   - lines that start with closing punctuation or end with an opening bracket (kinsoku violations, which PowerPoint's East Asian line
//     breaking, on by default, avoids).
// Information only: nothing gates on it (it records the current limit; the native probe deck shows what PowerPoint does).
//   node scripts/script-line-breaks.mjs [report.json]
import {writeFile} from 'node:fs/promises';
import {wrapText} from '@openpresentation/opf';
import {prepareNodeFonts} from '../dist/fonts-node.js';
import {loadCorpora} from './script-corpora.mjs';

const corpora = await loadCorpora();
const {registry} = await prepareNodeFonts({pack: 'office', scripts: 'all'});
const closing = /^[、。，．！？；：」』）］｝〉》】〕”’]/u, opening = /[「『（［｛〈《【〔“‘]$/u;
const family = {Thai: 'Noto Sans Thai', Laoo: 'Noto Sans Lao', Khmr: 'Noto Sans Khmer', Mymr: 'Noto Sans Myanmar', Jpan: 'Noto Sans JP', Hans: 'Noto Sans SC', Hant: 'Noto Sans TC'};
const rows = [];
for (const group of corpora.groups) {
  if (!family[group.script]) continue;
  for (const sample of group.samples) {
    const text = sample.text.replace(/\s+/g, ''), lang = sample.lang.split('-')[0];
    const wordStarts = new Set([0, ...[...new Intl.Segmenter(lang, {granularity: 'word'}).segment(text)].map(item => item.index)]);
    let breaks = 0, inside = 0, kinsoku = 0, widths = 0;
    for (let width = 120; width <= 600; width += 8) {
      let lines;
      try { lines = wrapText(text, width, 24, (value, size) => registry.textMeasurement.measure(value, size, {fontFamily: family[group.script], fontWeight: 400, lang: sample.lang})); } catch { continue; }
      widths++;
      let position = 0;
      for (const [index, line] of lines.entries()) {
        if (index < lines.length - 1) { position += line.length; breaks++; if (!wordStarts.has(position)) inside++; }
        if ((index > 0 && closing.test(line)) || (index < lines.length - 1 && opening.test(line))) kinsoku++;
      }
    }
    if (breaks) rows.push({id: sample.id, script: group.script, widths, breaks, insideIcuWord: inside, kinsokuViolations: kinsoku});
  }
}
const report = {method: 'wrapText from @openpresentation/opf at 61 widths, 24 px, spaces removed; the face is the designated open replacement', rows};
if (process.argv[2]) await writeFile(process.argv[2], `${JSON.stringify(report, null, 2)}\n`); else console.log(JSON.stringify(report, null, 2));
const by = script => rows.filter(row => row.script === script);
for (const script of Object.keys(family)) { const set = by(script); if (set.length) console.error(`${script}: ${set.reduce((t, r) => t + r.insideIcuWord, 0)} of ${set.reduce((t, r) => t + r.breaks, 0)} breaks inside an ICU word, ${set.reduce((t, r) => t + r.kinsokuViolations, 0)} kinsoku violations`); }
