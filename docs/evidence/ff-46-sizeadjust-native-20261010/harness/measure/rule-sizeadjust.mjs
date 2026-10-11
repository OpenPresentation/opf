// opf#361 RULE (release supervisor, 2026-10-10): per family the SMALLEST single factor at which the worst line-model overhang (native wider
// than the preview plan) over the whole corpus (the family's script samples incl. digits, plus the scheme's Latin: corpus Latn and the
// 300 FF-31 strings), regular AND bold, is <= 3 %. Shared helpers are copied from measure-sizeadjust.mjs (same basis and faces).
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import * as fontkit from 'fontkit';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {createScriptFonts, openTypeLanguage, fontPolicyFor} from '@openpresentation/opf-render/fonts';

const out = process.argv[2] ?? 'ff46-sizeadjust-raw.json';
const fontsDir = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'Fonts');
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const corpora = JSON.parse(readFileSync(path.join(here, 'script-corpora.json'), 'utf8'));
const latinCorpus = JSON.parse(readFileSync(process.env.OPF_CORE ? path.join(process.env.OPF_CORE, 'docs/evidence/font-replacements-20260923/corpus.json') : 'C:/opf-work/native-0-18/docs/evidence/font-replacements-20260923/corpus.json', 'utf8'));

// Family, the corpus group its factor is measured on (RR-38 basis), the other groups the real font covers (spread only), installed files.
const FAMILIES = [
  {family: 'Angsana New', script: 'Thai', lang: 'th', also: [], files: {400: ['angsana.ttc', 'Regular'], 700: ['angsana.ttc', 'Bold']}},
  {family: 'DilleniaUPC', script: 'Thai', lang: 'th', also: [], files: {400: ['upcdl.ttf'], 700: ['upcdb.ttf']}},
  {family: 'Sakkal Majalla', script: 'Arab', lang: 'ar', also: [], files: {400: ['majalla.ttf'], 700: ['majallab.ttf']}},
  {family: 'Traditional Arabic', script: 'Arab', lang: 'ar', also: [], files: {400: ['trado.ttf'], 700: ['tradbdo.ttf']}},
  {family: 'Malgun Gothic', script: 'Kore', lang: 'ko', also: [], files: {400: ['malgun.ttf'], 700: ['malgunbd.ttf']}},
  {family: 'Nirmala UI', script: 'Deva', lang: 'hi', also: ['Beng', 'Guru', 'Gujr', 'Orya', 'Taml', 'Telu', 'Knda', 'Mlym', 'Sinh'], files: {400: ['Nirmala.ttc', 'Regular'], 700: ['Nirmala.ttc', 'Bold']}},
  {family: 'Ebrima', script: 'Latn', lang: 'en', also: ['Ethi'], files: {400: ['ebrima.ttf'], 700: ['ebrimabd.ttf']}},
  {family: 'MS Gothic', script: 'Jpan', lang: 'ja', also: [], files: {400: ['msgothic.ttc', 'Regular']}},
];
const SCRIPT_RE = {
  Thai: /\p{Script=Thai}/u, Arab: /\p{Script=Arabic}/u, Kore: /[\p{Script=Hangul}]/u, Jpan: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u,
  Deva: /\p{Script=Devanagari}/u, Beng: /\p{Script=Bengali}/u, Guru: /\p{Script=Gurmukhi}/u, Gujr: /\p{Script=Gujarati}/u, Orya: /\p{Script=Oriya}/u,
  Taml: /\p{Script=Tamil}/u, Telu: /\p{Script=Telugu}/u, Knda: /\p{Script=Kannada}/u, Mlym: /\p{Script=Malayalam}/u, Sinh: /\p{Script=Sinhala}/u,
  Ethi: /\p{Script=Ethiopic}/u, Latn: /\p{Script=Latin}/u,
};
const ignorable = /^\p{Default_Ignorable_Code_Point}$/u;

// opf-render scripts/script-corpora.mjs fontkitRun (the renderer's retries), verbatim in behaviour.
const guarded = new WeakSet();
function skipUndecodableLookups(font) {
  if (guarded.has(font)) return false;
  guarded.add(font);
  let did = false;
  for (const tag of ['GSUB', 'GPOS']) {
    let list;
    try { list = font[tag]?.lookupList; } catch { continue; }
    if (typeof list?.get !== 'function') continue;
    const get = list.get.bind(list);
    list.get = index => { try { return get(index); } catch { return {lookupType: 1, flags: {}, subTables: []}; } };
    did = true;
  }
  return did;
}
function fontkitRun(font, text, lang) {
  const language = openTypeLanguage(lang);
  const shape = extra => font.layout(text, extra, undefined, language);
  try { return {run: shape(), retry: 'none'}; } catch { /* the renderer's retries */ }
  if (skipUndecodableLookups(font)) { try { return {run: shape(), retry: 'skip-undecodable-lookups'}; } catch { /* mark retry */ } }
  try { return {run: shape({abvm: false, blwm: false, mark: false, mkmk: false}), retry: 'no-mark-positioning'}; } catch (error) { return {error: error.message}; }
}
const width = (font, text, lang) => { const shaped = fontkitRun(font, text, lang); return shaped.run ? shaped.run.positions.reduce((total, p) => total + p.xAdvance, 0) / font.unitsPerEm * 100 : null; };
const covers = (font, text) => [...text].every(ch => /\s/u.test(ch) || ignorable.test(ch) || font.hasGlyphForCodePoint(ch.codePointAt(0)));
const round = (v, d = 4) => v === null || v === undefined || Number.isNaN(v) ? null : Math.round(v * 10 ** d) / 10 ** d;
const stats = values => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b), mid = s.length >> 1;
  return {n: s.length, min: round(s[0]), median: round(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2), max: round(s.at(-1))};
};
const lineMetrics = font => { const u = font.unitsPerEm, os2 = font['OS/2'] ?? {}; return {hhea: [round(font.ascent / u, 3), round(font.descent / u, 3), round(font.lineGap / u, 3)], win: os2.winAscent === undefined ? null : [round(os2.winAscent / u, 3), round(os2.winDescent / u, 3)]}; };

function openReal(file, name, sub) {
  const full = path.join(fontsDir, file);
  if (!existsSync(full)) return null;
  const opened = fontkit.openSync(full);
  if (!opened.fonts) return opened;
  const flat = n => String(n ?? '').replace(/ +/g, '').toLowerCase();
  const same = opened.fonts.filter(f => flat(f.familyName) === flat(name) || flat(f.getName?.('preferredFamily', 'en')) === flat(name));
  return same.find(f => !sub || f.subfamilyName === sub) ?? same[0] ?? null;
}

const {registry, fontFiles} = await loadFonts({pack: 'office', scripts: 'all', substitutionPolicy: 'visual'});
const described = registry.describeFaces();
const replacementFace = (family, weight) => {
  const i = described.findIndex(f => f.family === family && f.weight === weight && !f.italic);
  const j = i >= 0 ? i : described.findIndex(f => f.family === family && !f.italic);
  return j >= 0 ? {font: fontkit.create(new Uint8Array(readFileSync(fontFiles[j]))), file: path.basename(fontFiles[j]), weight: described[j].weight} : null;
};
const SIZE = 100;
const LIMIT = 1.03;
const out2 = process.argv[2] ?? 'ff46-sizeadjust-rule-raw.json';
const latinSets = {'corpus-Latn': corpora.groups.find(g => g.script === 'Latn').samples, 'latin-ff31': latinCorpus.map((text, i) => ({id: `ff31-${i}`, text, lang: 'en', category: 'latin'}))};
const rows = [];
for (const spec of FAMILIES) {
  const replacementFamily = fontPolicyFor(spec.family).replacement.family;
  const sets = {[`corpus-${spec.script}`]: corpora.groups.find(g => g.script === spec.script).samples, ...(spec.script === 'Latn' ? {'latin-ff31': latinSets['latin-ff31']} : latinSets)};
  // Not reachable by the row factor (other faces draw them): recorded, never counted in the rule.
  const unreachable = {};
  for (const s of spec.also) unreachable[`corpus-${s}`] = corpora.groups.find(g => g.script === s).samples;
  const lines = [];
  for (const weight of [400, 700]) {
    // MS Gothic has no bold face: PowerPoint emboldens synthetically, so its bold lines use the regular advances (no wider), against the replacement's 700.
    const [file, sub] = spec.files[weight] ?? spec.files[400];
    const real = openReal(file, spec.family, spec.files[weight] ? sub : spec.files[400][1]);
    for (const [setName, samples] of Object.entries({...sets, ...unreachable})) {
      for (const s of samples) {
        if (!covers(real, s.text)) continue;
        const profile = {body: {}, heading: {}, script: spec.script, bcp47: s.lang, languageSource: 'document', rtl: spec.script === 'Arab'};
        const fonts = createScriptFonts(profile, registry.textMeasurement);
        const style = {fontFamily: spec.family, fontWeight: weight};
        const runs = fonts.plan(s.text, style), widths = fonts.runWidths(runs, SIZE, style);
        const drawnOwn = registry.textMeasurement.resolveFont(style)?.resolvedFamily;
        let rep = 0, other = 0;
        // OWN_UNSCALED=1: the SVG pipeline draws own runs (Latin and common text left in the style's resolved family) at the composed size, unscaled.
        runs.forEach((run, i) => { if (process.env.OWN_UNSCALED === '1' && run.own) other += widths[i]; else if ((run.own ? drawnOwn : run.family) === replacementFamily) rep += widths[i]; else other += widths[i]; });
        const native = width(real, s.text, s.lang);
        if (!native) continue;
        lines.push({set: setName, id: s.id, weight, native, rep, other, counted: !unreachable[setName], syntheticBold: weight === 700 && !spec.files[700]});
      }
    }
  }
  const counted = lines.filter(l => l.counted);
  // Needed factor per line: native / (F*rep + other) <= LIMIT  =>  F >= (native/LIMIT - other) / rep.
  const need = counted.map(l => ({...l, need: l.rep > 0 ? (l.native / LIMIT - l.other) / l.rep : (l.native / l.other <= LIMIT ? -Infinity : Infinity)}));
  const exact = Math.max(...need.map(l => l.need));
  const factor = Math.ceil(exact * 100 - 1e-9) / 100;
  const ratioAt = (l, f) => l.native / (f * l.rep + l.other);
  const at = f => { const r = counted.map(l => ({l, r: ratioAt(l, f)})); const worst = r.reduce((a, b) => (b.r > a.r ? b : a)); return {worst: worst.r, line: worst.l}; };
  const w = at(factor);
  const latin = counted.filter(l => l.set !== `corpus-${spec.script}` || spec.script === 'Latn').map(l => ratioAt(l, factor)).sort((a, b) => a - b);
  const script = counted.filter(l => l.set === `corpus-${spec.script}`).map(l => ratioAt(l, factor)).sort((a, b) => a - b);
  const med = a => a.length ? (a.length % 2 ? a[a.length >> 1] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : null;
  const perLineFactor = counted.filter(l => l.rep > 0 && l.other === 0 && l.set === `corpus-${spec.script}`).map(l => l.native / l.rep).sort((a, b) => a - b);
  const sumBasis = (wgt) => { const ls = counted.filter(l => l.set === `corpus-${spec.script}` && l.weight === wgt && l.rep > 0); return ls.reduce((t, l) => t + l.native, 0) / ls.reduce((t, l) => t + l.rep + l.other, 0); };
  const unreach = lines.filter(l => !l.counted).map(l => l.native / (l.rep * factor + l.other));
  const proposed = {'Angsana New': 0.70, DilleniaUPC: 0.64, 'Sakkal Majalla': 0.80, 'Traditional Arabic': 0.79, 'Malgun Gothic': 1.06, 'Nirmala UI': 1.07, Ebrima: 0.94, 'MS Gothic': 1.04}[spec.family];
  const atProposed = at(proposed);
  const r4 = v => v === null || !Number.isFinite(v) ? null : Math.round(v * 10000) / 10000;
  rows.push({
    family: spec.family, replacement: replacementFamily, linesCounted: counted.length, linesRegular: counted.filter(l => l.weight === 400).length, linesBold: counted.filter(l => l.weight === 700).length,
    sumFactorRegular: r4(sumBasis(400)), sumFactorBold: r4(sumBasis(700)), medianFactor: r4(med(perLineFactor)),
    ruleFactorExact: r4(exact), ruleFactor: factor,
    worstOverhangAtRule: r4(w.worst - 1), worstLine: `${w.line.set}/${w.line.id} ${w.line.weight === 700 ? 'bold' : 'regular'}${w.line.syntheticBold ? ' (synthetic bold)' : ''}`,
    scriptLinesAtRule: {min: r4(script[0]), median: r4(med(script)), max: r4(script.at(-1))},
    latinAtRule: {min: r4(latin[0]), median: r4(med(latin)), max: r4(latin.at(-1)), medianSlackPct: latin.length ? Math.round((1 - med(latin)) * 1000) / 10 : null},
    proposedFactor: proposed, worstOverhangAtProposed: r4(atProposed.worst - 1), worstLineAtProposed: `${atProposed.line.set}/${atProposed.line.id} ${atProposed.line.weight === 700 ? 'bold' : 'regular'}`,
    withinNoAdjustBand: Math.abs(factor - 1) <= 0.03,
    unreachable: unreach.length ? {sets: Object.keys(unreachable), lines: unreach.length, maxNativeOverPreview: r4(Math.max(...unreach))} : null,
    topNeeds: need.sort((a, b) => b.need - a.need).slice(0, 4).map(l => ({line: `${l.set}/${l.id} ${l.weight === 700 ? 'bold' : 'regular'}`, need: r4(l.need)})),
  });
  console.error(`${spec.family}: rule ${factor} (exact ${r4(exact)}), worst ${r4(w.worst - 1)} at ${rows.at(-1).worstLine}`);
}
writeFileSync(out2, `${JSON.stringify({rule: 'smallest single factor F (0.01 steps, rounded up) with native/(F*replacementRuns + otherRuns) <= 1.03 on every counted line; counted = the family script corpus samples the real font covers (letters, digits, punctuation, mixed) + corpus Latn + 300 FF-31 Latin strings, regular and bold; ships no sizeAdjust when |F-1| <= 0.03', limit: LIMIT, measuredAt: new Date().toISOString(), families: rows}, null, 1)}\n`);
