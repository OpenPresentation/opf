// Native-script reference measurement (RR-17, FF-44). Reads the proprietary script fonts that are INSTALLED on a licensed Windows host, in place
// (C:\Windows\Fonts, never copied, never committed), shapes the script corpora with them and with their designated open replacement, and
// records numbers: per family the advance-width ratio replacement / original on the corpus samples of the family's script, the line metrics
// of both, and the corpus coverage of the original. The result is a plain JSON report (no font bytes, no outlines).
//   node scripts/measure-script-references.mjs report.json
// Families that are not installed are listed as `notInstalled` (the policy rows say `windows-optional`: the Supplemental Fonts on Demand).
import {existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import * as fontkit from 'fontkit';
import {fontPolicyFor, scriptFontAliases} from '../dist/fonts.js';
import {fontkitRun, lineMetrics, loadCorpora, loadFaces} from './script-corpora.mjs';

if (process.platform !== 'win32') throw new Error('This measurement reads the Windows font directory; run it on a licensed Windows host.');
const directory = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'Fonts');

// Policy family -> installed file(s), by style (regular, bold), and the corpus script group it is measured on.
const TARGETS = [
  ['Yu Gothic', 'Jpan', {400: 'YuGothR.ttc', 700: 'YuGothB.ttc'}], ['MS Gothic', 'Jpan', {400: 'msgothic.ttc'}], ['Meiryo', 'Jpan', {400: 'meiryo.ttc', 700: 'meiryob.ttc'}],
  ['MS Mincho', 'Jpan', {400: 'msmincho.ttc'}],
  ['Microsoft YaHei', 'Hans', {400: 'msyh.ttc', 700: 'msyhbd.ttc'}], ['SimSun', 'Hans', {400: 'simsun.ttc'}], ['SimHei', 'Hans', {400: 'simhei.ttf'}], ['FangSong', 'Hans', {400: 'simfang.ttf'}],
  ['Microsoft JhengHei', 'Hant', {400: 'msjh.ttc', 700: 'msjhbd.ttc'}], ['MingLiU', 'Hant', {400: 'mingliu.ttc'}], ['PMingLiU', 'Hant', {400: 'mingliu.ttc'}],
  ['Malgun Gothic', 'Kore', {400: 'malgun.ttf', 700: 'malgunbd.ttf'}], ['Batang', 'Kore', {400: 'batang.ttc'}], ['BatangChe', 'Kore', {400: 'batangche.ttc'}], ['Gungsuh', 'Kore', {400: 'gungsuh.ttc'}], ['GungsuhChe', 'Kore', {400: 'gungsuhche.ttc'}],
  ['Arabic Typesetting', 'Arab', {400: 'arabtype.ttf'}], ['Traditional Arabic', 'Arab', {400: 'trado.ttf', 700: 'tradbdo.ttf'}], ['Sakkal Majalla', 'Arab', {400: 'majalla.ttf', 700: 'majallab.ttf'}],
  ['Simplified Arabic', 'Arab', {400: 'simpo.ttf', 700: 'simpbdo.ttf'}], ['Andalus', 'Arab', {400: 'andlso.ttf'}], ['Urdu Typesetting', 'Arab', {400: 'UrdType.ttf', 700: 'UrdTypeb.ttf'}], ['Aldhabi', 'Arab', {400: 'aldhabi.ttf'}],
  ['David', 'Hebr', {400: 'david.ttf', 700: 'davidbd.ttf'}], ['Miriam', 'Hebr', {400: 'mriam.ttf'}], ['Gisha', 'Hebr', {400: 'gisha.ttf', 700: 'gishabd.ttf'}],
  ['Mangal', 'Deva', {400: 'mangal.ttf', 700: 'mangalb.ttf'}], ['Aparajita', 'Deva', {400: 'aparaj.ttf'}], ['Nirmala UI', 'Deva', {400: 'Nirmala.ttc', 700: 'NirmalaB.ttc'}],
  ['Shonar Bangla', 'Beng', {400: 'Shonar.ttf'}], ['Vrinda', 'Beng', {400: 'vrinda.ttf'}], ['Raavi', 'Guru', {400: 'raavi.ttf'}], ['Shruti', 'Gujr', {400: 'shruti.ttf'}],
  ['Kalinga', 'Orya', {400: 'kalinga.ttf'}], ['Latha', 'Taml', {400: 'latha.ttf'}], ['Gautami', 'Telu', {400: 'gautami.ttf'}], ['Tunga', 'Knda', {400: 'tunga.ttf'}], ['Kartika', 'Mlym', {400: 'kartika.ttf'}],
  ['Iskoola Pota', 'Sinh', {400: 'iskpota.ttf'}],
  ['Angsana New', 'Thai', {400: 'angsana.ttc'}], ['DilleniaUPC', 'Thai', {400: 'upcdl.ttf'}], ['Leelawadee', 'Thai', {400: 'leelawad.ttf', 700: 'leelawdb.ttf'}], ['Cordia New', 'Thai', {400: 'cordia.ttc'}], ['Browallia New', 'Thai', {400: 'browalia.ttc'}],
  ['DokChampa', 'Laoo', {400: 'dokchamp.ttf'}], ['DaunPenh', 'Khmr', {400: 'daunpenh.ttf'}], ['Khmer UI', 'Khmr', {400: 'KhmerUI.ttf'}], ['MoolBoran', 'Khmr', {400: 'moolbor.ttf'}],
  ['Myanmar Text', 'Mymr', {400: 'mmrtext.ttf', 700: 'mmrtextb.ttf'}], ['Microsoft Himalaya', 'Tibt', {400: 'himalaya.ttf'}], ['Mongolian Baiti', 'Mong', {400: 'monbaiti.ttf'}],
  ['MV Boli', 'Thaa', {400: 'mvboli.ttf'}], ['Estrangelo Edessa', 'Syrc', {400: 'estre.ttf'}], ['Nyala', 'Ethi', {400: 'nyala.ttf'}], ['Sylfaen', 'Armn', {400: 'sylfaen.ttf'}], ['Sylfaen', 'Geor', {400: 'sylfaen.ttf'}],
];

const corpora = await loadCorpora();
const {faces, registry} = await loadFaces();
// The replacement the preview draws: the policy row's, else the script-font alias rule (every script face loaded).
const aliases = scriptFontAliases(new Set(faces.map(face => face.family)));
const family = (name, weight) => faces.find(face => face.family === name && face.weight === weight && !face.italic) ?? faces.find(face => face.family === name && !face.italic);
const open = (file, wantedName) => {
  const opened = fontkit.openSync(path.join(directory, file));
  if (!opened.fonts) return opened;
  const wanted = opened.fonts.find(font => font.familyName === wantedName) ?? opened.fonts.find(font => font.familyName?.replace(/ +/g, '').toLowerCase() === wantedName.replace(/ +/g, '').toLowerCase());
  return wanted ?? opened.fonts[0];
};
const ignorable = /^\p{Default_Ignorable_Code_Point}$/u;
const width = (font, text, lang) => { const shaped = fontkitRun(font, text, lang); return shaped.run ? shaped.run.positions.reduce((total, position) => total + position.xAdvance, 0) / font.unitsPerEm * 100 : null; };
const report = {measuredAt: new Date().toISOString(), host: {platform: process.platform}, method: 'fontkit 2.0.4 shaping (the renderer\'s measurement) of every corpus sample of the family\'s script at 100 px in the installed original and in its designated open replacement; widthRatio = replacement / original; samples the original lacks glyphs for are skipped', families: [], notInstalled: []};
for (const [name, script, files] of TARGETS) {
  const present = Object.entries(files).filter(([, file]) => existsSync(path.join(directory, file)));
  if (!present.length) { if (!report.notInstalled.includes(name)) report.notInstalled.push(name); continue; }
  const group = corpora.groups.find(item => item.script === script);
  const policy = fontPolicyFor(name), replacementFamily = policy?.replacement?.family ?? aliases[name] ?? null;
  const entry = {family: name, script, replacement: replacementFamily, policyCompatibility: policy?.replacement?.compatibility ?? (policy ? null : 'visual (script alias rule, no policy row)'), styles: []};
  for (const [weight, file] of present) {
    const original = open(file, name);
    const replacement = replacementFamily ? family(replacementFamily, Number(weight)) : undefined;
    const own = new RegExp(String.raw`[^\u0000-\u024F\s\p{P}\p{S}\p{Cf}]`, 'u');
    const rows = [];
    for (const sample of group.samples) {
      if (!own.test(sample.text)) continue;
      const covered = [...sample.text].every(character => /\s/u.test(character) || ignorable.test(character) || original.hasGlyphForCodePoint(character.codePointAt(0)));
      if (!covered || !replacement) { rows.push({id: sample.id, skipped: covered ? 'no replacement face' : 'the original lacks glyphs for the sample'}); continue; }
      const originalWidth = width(original, sample.text, sample.lang), replacementWidth = width(replacement.font, sample.text, sample.lang);
      if (originalWidth && replacementWidth) rows.push({id: sample.id, original: Number(originalWidth.toFixed(2)), replacement: Number(replacementWidth.toFixed(2)), widthRatio: Number((replacementWidth / originalWidth).toFixed(4))});
    }
    const measured = rows.filter(row => row.widthRatio !== undefined);
    const deltas = measured.map(row => row.widthRatio - 1);
    entry.styles.push({
      weight: Number(weight), file: file, sha256: createHash('sha256').update(await readFile(path.join(directory, file))).digest('hex'), version: original.version ?? null, postscriptName: original.postscriptName ?? null,
      lineMetrics: lineMetrics(original), replacementLineMetrics: replacement ? lineMetrics(replacement.font) : null,
      samples: measured.length, skipped: rows.filter(row => row.skipped).length,
      meanSignedDelta: measured.length ? Number((deltas.reduce((total, value) => total + value, 0) / deltas.length).toFixed(4)) : null,
      meanAbsDelta: measured.length ? Number((deltas.reduce((total, value) => total + Math.abs(value), 0) / deltas.length).toFixed(4)) : null,
      maxAbsDelta: measured.length ? Number(Math.max(...deltas.map(Math.abs)).toFixed(4)) : null,
      rows,
    });
  }
  report.families.push(entry);
}
const output = process.argv[2];
if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`); else console.log(JSON.stringify(report, null, 2));
console.error(`${report.families.length} families measured, ${report.notInstalled.length} not installed: ${report.notInstalled.join(', ')}`);
