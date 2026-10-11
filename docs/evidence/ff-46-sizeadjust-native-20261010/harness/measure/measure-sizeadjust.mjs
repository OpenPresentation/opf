// opf#361 (FF-46): size-adjust factors for eight proprietary script families on the RR-38 basis, plus the effect of each candidate
// factor on whole lines (script, mixed and Latin) as the published opf-render 0.18.0 plans them.
//
// Basis (RR-38, as `spec/reference/font-policy.json` Arabic Typesetting records it): the sum of the real font's shaped advances over
// the sum of the replacement's, fontkit 2.0.4 with each sample's OpenType language, regular style, on the FF-44 corpus samples of the
// family's script (opf-render test/fixtures/script-corpora.json, unchanged since opf-render#101 and identical at opf-render-v0.18.0).
// The shaping helper is opf-render scripts/script-corpora.mjs `fontkitRun` (same retries), and the replacement faces are the files the
// published renderer loads (`loadFonts({pack: 'office', scripts: 'all', substitutionPolicy: 'visual'})`), so this measures what the preview draws.
//
// The real fonts are read IN PLACE from %SystemRoot%\Fonts with fontkit.openSync. Nothing is copied; the report keeps only names,
// versions, file names and numbers.
//
// Line model (the part RR-38 did not have): every line is planned by the published renderer's script planner
// (`createScriptFonts(profile, registry.textMeasurement).plan`) for a deck whose font scheme is the family (major = minor = family, as
// the gallery font-scheme records write it), so Latin text takes the scheme's Latin slot exactly as it would in a deck. Each planned
// run is measured at factor 1 with the renderer's own `runWidths`. A candidate factor F then scales:
//   - single: every run drawn in the row's replacement face (that is what `sizeAdjustFor` does: Latin runs included, when the
//     replacement draws them);
//   - perScript: only the runs that hold the family's own script (a hypothetical per-script factor; Latin runs stay at 1).
// The native width is the real font's shaped advance of the whole line (PowerPoint draws every run of such a deck in the real font).
// native / preview > 1 means PowerPoint draws the line longer than the preview composed it (overhang).
//
// node measure-sizeadjust.mjs <out.json>
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

const report = {
  measuredAt: new Date().toISOString(),
  host: {platform: process.platform, node: process.version, fontsDir: '%SystemRoot%\\Fonts (read in place)'},
  packages: Object.fromEntries(['@openpresentation/opf', '@openpresentation/opf-render', 'fontkit'].map(name => [name, JSON.parse(readFileSync(path.join(here, '..', 'node_modules', name, 'package.json'), 'utf8')).version])),
  corpus: {scriptCorpus: 'opf-render test/fixtures/script-corpora.json (opf-render#101, unchanged at opf-render-v0.18.0)', latinCorpus: 'core docs/evidence/font-replacements-20260923/corpus.json (300 Latin title/body strings, FF-31)'},
  basis: 'factor = sum(real advances) / sum(replacement advances), fontkit, sample OpenType language, on the corpus samples of the family script that hold the script and that the real font covers',
  families: [],
};

for (const spec of FAMILIES) {
  const row = fontPolicyFor(spec.family);
  const replacementFamily = row?.replacement?.family;
  const entry = {family: spec.family, replacement: replacementFamily, policySizeAdjust: row?.replacement?.sizeAdjust ?? null, script: spec.script, styles: {}, lines: {}};
  // ---- RR-38 basis, per style ----
  for (const [weight, [file, sub]] of Object.entries(spec.files)) {
    const real = openReal(file, spec.family, sub);
    const repl = replacementFace(replacementFamily, Number(weight));
    if (!real || !repl) { entry.styles[weight] = {missing: !real ? file : `replacement ${replacementFamily} ${weight}`}; continue; }
    const group = corpora.groups.find(g => g.script === spec.script);
    const rows = [];
    for (const sample of group.samples) {
      if (!SCRIPT_RE[spec.script].test(sample.text)) continue;
      if (!covers(real, sample.text)) { rows.push({id: sample.id, skipped: 'real font lacks glyphs'}); continue; }
      const r = width(real, sample.text, sample.lang), p = width(repl.font, sample.text, sample.lang);
      if (r && p) rows.push({id: sample.id, category: sample.category, real: round(r, 2), replacement: round(p, 2), ratio: round(r / p)});
    }
    const ok = rows.filter(x => x.ratio !== undefined);
    const sumR = ok.reduce((t, x) => t + x.real, 0), sumP = ok.reduce((t, x) => t + x.replacement, 0);
    // Latin corpus at this style: real Latin over the replacement's Latin (what the replacement draws for Latin in this scheme).
    const latin = latinCorpus.map(text => ({text, r: width(real, text, 'en'), p: covers(repl.font, text) ? width(repl.font, text, 'en') : null})).filter(x => x.r && x.p);
    entry.styles[weight] = {
      file, real: {version: real.version, postscriptName: real.postscriptName, subfamily: real.subfamilyName}, replacementFile: repl.file,
      factor: ok.length ? round(sumR / sumP) : null, samples: ok.length, skipped: rows.filter(x => x.skipped).map(x => x.id), perSample: stats(ok.map(x => x.ratio)), rows,
      latinCorpus: latin.length ? {factor: round(latin.reduce((t, x) => t + x.r, 0) / latin.reduce((t, x) => t + x.p, 0)), perString: stats(latin.map(x => x.r / x.p)), strings: latin.length} : null,
      lineMetrics: {real: lineMetrics(real), replacement: lineMetrics(repl.font)},
      replacementCoversBasicLatin: covers(repl.font, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'),
    };
  }
  // ---- line model on the published planner (regular) ----
  const real = openReal(spec.files[400][0], spec.family, spec.files[400][1]);
  const sets = {};
  const groupsOf = [spec.script, ...spec.also, ...(spec.script !== 'Latn' ? ['Latn'] : [])];
  for (const script of groupsOf) {
    const group = corpora.groups.find(g => g.script === script);
    sets[`corpus-${script}`] = group.samples.map(s => ({id: s.id, text: s.text, lang: s.lang, category: s.category}));
  }
  sets['latin-ff31'] = latinCorpus.map((text, i) => ({id: `ff31-${i}`, text, lang: 'en', category: 'latin'}));
  for (const [setName, samples] of Object.entries(sets)) {
    const lines = [];
    for (const s of samples) {
      if (!covers(real, s.text)) { lines.push({id: s.id, skipped: 'real font lacks glyphs'}); continue; }
      const profile = {body: {}, heading: {}, script: spec.script === 'Latn' ? 'Latn' : spec.script, bcp47: s.lang, languageSource: 'document', rtl: spec.script === 'Arab'};
      const fonts = createScriptFonts(profile, registry.textMeasurement);
      const style = {fontFamily: spec.family, fontWeight: 400};
      const runs = fonts.plan(s.text, style);
      const widths = fonts.runWidths(runs, SIZE, style);
      const resolved = runs.map(run => run.own ? registry.textMeasurement.resolveFont({fontFamily: spec.family, fontWeight: 400})?.resolvedFamily : run.family);
      const native = width(real, s.text, s.lang);
      if (!native || !widths) { lines.push({id: s.id, skipped: 'no width'}); continue; }
      lines.push({
        id: s.id, category: s.category, native: round(native, 2),
        runs: runs.map((run, i) => ({text: run.text, drawn: resolved[i], width: round(widths[i], 2), ownScript: spec.script !== 'Latn' ? SCRIPT_RE[spec.script].test(run.text) : SCRIPT_RE.Latn.test(run.text)})),
      });
    }
    entry.lines[setName] = lines;
  }
  report.families.push(entry);
  console.error(`${spec.family}: regular ${entry.styles[400]?.factor} (${entry.styles[400]?.samples} samples), bold ${entry.styles[700]?.factor ?? '-'}`);
}

// ---- verification of the "single" model: Arabic Typesetting already carries sizeAdjust 0.64 in the published policy. The published
// renderer's own measurement of a Latin line and a mixed line in an Arabic Typesetting scheme against 0.64 x the factor-1 replacement
// width (fontkit on the Noto Naskh Arabic file the renderer loads) shows which runs the factor reaches.
{
  const text = 'تقرير الربع الثالث Q3 2026 للمبيعات', latin = 'Quarterly revenue review 2026';
  const profile = {body: {}, heading: {}, script: 'Arab', bcp47: 'ar', languageSource: 'document', rtl: true};
  const style = {fontFamily: 'Arabic Typesetting', fontWeight: 400};
  const fonts = createScriptFonts(profile, registry.textMeasurement);
  const naskh = replacementFace('Noto Naskh Arabic', 400).font;
  const runs = fonts.plan(text, style), widths = fonts.runWidths(runs, SIZE, style);
  report.verification = {
    note: 'Arabic Typesetting (policy sizeAdjust 0.64) on the published renderer: renderer width over fontkit width of the replacement at factor 1',
    latinLine: {text: latin, renderer: round(registry.textMeasurement.measure(latin, SIZE, style), 2), replacementAt1: round(width(naskh, latin, 'en'), 2), ratio: round(registry.textMeasurement.measure(latin, SIZE, style) / width(naskh, latin, 'en'))},
    mixedLineRuns: runs.map((run, i) => ({text: run.text, family: run.family, own: run.own, sizeAdjust: run.sizeAdjust ?? null, renderer: round(widths[i], 2), replacementAt1: round(width(naskh, run.text, 'ar'), 2)})),
  };
}
writeFileSync(out, `${JSON.stringify(report, null, 1)}\n`);
console.error(`wrote ${out}`);
