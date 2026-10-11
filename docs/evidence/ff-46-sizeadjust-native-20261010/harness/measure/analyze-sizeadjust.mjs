// opf#361: turns ff46-sizeadjust-raw.json (measure-sizeadjust.mjs) into ../ff46-sizeadjust-measurements.json and .md.
// Scenarios per family, on every line the planner drew:
//   none        factor 1 everywhere (today's published policy for these eight rows);
//   single      the rounded corpus factor on every run drawn in the row's replacement (what policy `sizeAdjust` does today);
//   perScript   the factor on the family's own-script text only, Latin and common text at 1 (not expressible in the policy today);
//   noOverhang  the smallest single factor at which no measured line (script or Latin) runs past its composed width natively.
// ratio = native / preview: above 1, PowerPoint draws the line longer than the preview composed it (overhang); below 1, slack.
import {readFileSync, writeFileSync} from 'node:fs';
import * as fontkit from 'fontkit';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {openTypeLanguage} from '@openpresentation/opf-render/fonts';

const raw = JSON.parse(readFileSync('ff46-sizeadjust-raw.json', 'utf8'));
const REF_LINE_PT = 842; // the body-line width opf#523 / docs/font-fidelity.md uses for Traditional Arabic
const SCRIPT_RE = {
  Thai: /\p{Script=Thai}/u, Arab: /\p{Script=Arabic}/u, Kore: /\p{Script=Hangul}/u, Jpan: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u30FC]/u,
  Deva: /\p{Script=Devanagari}/u, Latn: /\p{Script=Latin}/u,
};
// Native cross-checks already on record (opf#361 comments, FF-46 set 2, one family per deck; native / preview ink at factor 1).
const NATIVE = {
  'Angsana New': {set2: 0.697, note: 'set 2 ink, 12 regular lines BoundWidth 0.701'}, DilleniaUPC: {set2: 0.639}, 'Sakkal Majalla': {set2: 0.805},
  'Traditional Arabic': {set2: 0.815, note: 'set 2 ink (6 lines); docs/font-fidelity.md opf#523: 10 native lines 0.68 to 0.90, pooled 0.79'},
  'Malgun Gothic': {set2: 1.049, note: 'decomposed jamo lines draw up to 1.9x natively; no factor fixes them'}, 'Nirmala UI': {set2: 1.027, note: 'line-break paragraphs mix Latin and digits'},
  Ebrima: {set2: 1.074, note: 'measured on Ethiopic, drawn by Noto Sans Ethiopic through fallback, which the row factor does not reach'}, 'MS Gothic': {set2: 1.024},
};

const {registry, fontFiles} = await loadFonts({pack: 'office', scripts: 'all', substitutionPolicy: 'visual'});
const described = registry.describeFaces();
const faceCache = new Map();
const face = family => {
  if (!faceCache.has(family)) { const i = described.findIndex(f => f.family === family && f.weight === 400 && !f.italic); faceCache.set(family, i < 0 ? null : fontkit.create(new Uint8Array(readFileSync(fontFiles[i])))); }
  return faceCache.get(family);
};
const fkWidth = (font, text, lang) => { try { const run = font.layout(text, undefined, undefined, openTypeLanguage(lang)); return run.positions.reduce((t, p) => t + p.xAdvance, 0) / font.unitsPerEm * 100; } catch { try { const run = font.layout(text, {abvm: false, blwm: false, mark: false, mkmk: false}, undefined, openTypeLanguage(lang)); return run.positions.reduce((t, p) => t + p.xAdvance, 0) / font.unitsPerEm * 100; } catch { return null; } } };
const round = (v, d = 4) => v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d;
const stats = values => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b), mid = s.length >> 1;
  return {n: s.length, min: round(s[0]), median: round(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2), max: round(s.at(-1))};
};

/** Split a run's text into own-script and other segments (marks and joiners stay with their base, white space with the segment before). */
function segments(text, re, lettersOnly = false) {
  const out = [];
  let current = null;
  for (const ch of text) {
    const own = (re.test(ch) && (!lettersOnly || /[\p{L}\p{M}]/u.test(ch))) || (/[\p{M}\u200C\u200D]/u.test(ch) && current?.own);
    const kind = /\s/u.test(ch) && current ? current.own : own;
    if (!current || current.own !== kind) out.push(current = {own: kind, text: ''});
    current.text += ch;
  }
  return out;
}

const families = [];
for (const fam of raw.families) {
  const reg = fam.styles['400'], bold = fam.styles['700'];
  const F = Math.round(reg.factor * 100) / 100;
  const latinFactor = reg.latinCorpus?.factor ?? null;
  const ownRe = SCRIPT_RE[fam.script];
  const sets = {};
  for (const [setName, lines] of Object.entries(fam.lines)) {
    const ok = lines.filter(l => !l.skipped);
    const rows = ok.map(line => {
      const at1 = line.runs.reduce((t, r) => t + r.width, 0);
      const single = line.runs.reduce((t, r) => t + r.width * (r.drawn === fam.replacement ? F : 1), 0);
      const scoped = lettersOnly => {
        let sum = 0;
        for (const r of line.runs) {
          if (r.drawn !== fam.replacement) { sum += r.width; continue; }
          const segs = segments(r.text, ownRe, lettersOnly), font = face(r.drawn);
          const widths = segs.map(s => fkWidth(font, s.text, fam.script === 'Arab' ? 'ar' : 'en') ?? 0), total = widths.reduce((a, b) => a + b, 0) || 1;
          sum += segs.reduce((t, s, i) => t + r.width * widths[i] / total * (s.own ? F : 1), 0);
        }
        return sum;
      };
      const perScript = scoped(false), perScriptLetters = scoped(true);
      const drawnInReplacement = line.runs.filter(r => r.drawn === fam.replacement).reduce((t, r) => t + r.width, 0) / at1;
      return {id: line.id, category: line.category, native: line.native, at1: round(at1, 2), ratio: {none: round(line.native / at1), single: round(line.native / single), perScript: round(line.native / perScript), perScriptLetters: round(line.native / perScriptLetters)}, replacementShare: round(drawnInReplacement, 3)};
    });
    const scenario = key => {
      const r = rows.map(x => x.ratio[key]), st = stats(r);
      if (!st) return null;
      const worst = rows.reduce((a, b) => (b.ratio[key] > a.ratio[key] ? b : a), rows[0]);
      return {...st, overhangLines: r.filter(v => v > 1.01).length, worstOverhangPct: round((st.max - 1) * 100, 1), worstOverhangPtOn842: st.max > 1 ? round((st.max - 1) * REF_LINE_PT, 1) : 0, worstLine: worst.id, worstSlackPct: round((1 - st.min) * 100, 1)};
    };
    sets[setName] = {lines: rows.length, skipped: lines.length - ok.length, none: scenario('none'), single: scenario('single'), perScript: scenario('perScript'), perScriptLetters: scenario('perScriptLetters'), rows};
  }
  // The smallest single factor with no overhang on any measured line the factor reaches (primary script corpus and the Latin sets).
  const reached = Object.entries(sets).filter(([name]) => name === `corpus-${fam.script}` || name === 'latin-ff31' || name === 'corpus-Latn').flatMap(([, s]) => s.rows.filter(r => r.replacementShare > 0.5));
  const noOverhang = reached.length ? round(Math.max(...reached.map(r => r.native / r.at1)), 3) : null;
  const primary = sets[`corpus-${fam.script}`];
  families.push({
    family: fam.family, replacement: fam.replacement, script: fam.script, realVersion: reg.real.version,
    factor: {regular: reg.factor, bold: bold?.factor ?? null, proposed: F, samples: reg.samples, skippedSamples: reg.skipped, perSample: reg.perSample},
    latin: {replacementDrawsLatin: reg.replacementCoversBasicLatin, realOverReplacement: latinFactor, perString: reg.latinCorpus?.perString ?? null, nativeOverPreviewAtSingle: latinFactor ? round(latinFactor / F) : null},
    noOverhangFactor: noOverhang,
    nativeCrossCheck: NATIVE[fam.family] ?? null,
    lineMetrics: reg.lineMetrics,
    sets: Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, {...v, rows: v.rows}])),
    primaryLines: primary ? {none: primary.none, single: primary.single, perScript: primary.perScript, perScriptLetters: primary.perScriptLetters} : null,
  });
}

// ---------------- recommendations (agent judgement, vetoable; see the .md for the reasoning) ----------------
const RECOMMEND = {
  'Angsana New': {kind: 'single', value: 0.70, why: 'Thai lines at 0.70: native / preview 0.90 / 1.01 / 1.09 (the worst is the Thai-digit sample, +8.9 %; 0.76 would remove every overhang). The Latin of the scheme is narrower still (0.57 of Noto Sans Thai), so it keeps 10 to 23 % slack and never overhangs; leaving Latin at 1 (per-script) would make that 37 to 46 % slack, worse than the single factor.'},
  DilleniaUPC: {kind: 'single', value: 0.64, why: 'Thai lines at 0.64: 0.95 / 0.99 / 1.08 (Thai digits +7.9 %). Latin 0.88 / 0.94 / 1.02 (one of 300 strings +1.7 %). Single factor is right; per-script would leave Latin 35 to 44 % slack.'},
  'Sakkal Majalla': {kind: 'single', value: 0.80, why: 'Arabic lines at 0.80: 0.92 / 1.00 / 1.14; the two digit samples (Arabic-Indic and Persian digits) overhang 13 to 14 %, the letter samples are within +4 %. Latin of the scheme (0.65) keeps 17 to 23 % slack. Native set 2: 0.805. A letters-only per-script factor would fix the digits (Arabic 0.87 / 0.98 / 1.01) but leave Latin 33 to 38 % slack, so single 0.80 now.'},
  'Traditional Arabic': {kind: 'none', value: null, why: 'No single factor works. Arabic letters are 0.71 to 0.74 of Noto Naskh Arabic, but its digits are 0.90 to 1.02, Arabic with Latin 0.84 and the Latin of the scheme 0.84 (0.81 to 0.95). At 0.79 every one of the 300 Latin strings overhangs (median +6.7 %, worst +20.7 %, 175 pt on an 842 pt line) and the Persian-digit sample +28.5 %. The smallest single factor without overhang is 1.015, so keep 1 (the wide-erring proxy opf#523 documents). The right fix is a per-script, letters-only factor (0.79 on Arabic letters, digits and Latin at 1: Arabic lines 0.90 / 0.94 / 1.04, Latin 0.81 to 0.95 slack), which the policy format cannot express today.'},
  'Malgun Gothic': {kind: 'single', value: 1.06, why: 'Korean lines at 1.06: 0.97 / 1.00 / 1.04 (the jamo sample +3.7 %; decomposed jamo draw up to 1.9 times natively, which no factor fixes). Latin of the scheme (0.99) keeps 4 to 13 % slack, the safe direction. Native set 2: 1.049.'},
  'Nirmala UI': {kind: 'single', value: 1.07, why: 'Devanagari lines at 1.07: 0.95 / 0.99 / 1.03. Latin of the scheme (0.94 of Noto Sans Devanagari) gets 11 to 15 % slack (safe direction; per-script Deva-only would make it 4 to 9 %). Not reachable by this row: the other Indic scripts draw in their own Noto faces and already overhang at 1 (Telugu up to +33 %, Kannada +19 %, Gujarati and Malayalam +13 %, Bengali and Gurmukhi +10 %, Tamil +6 %); that needs factors on those routes, a separate item.'},
  Ebrima: {kind: 'single', value: 0.94, why: 'The row replacement (Noto Sans) only draws Latin: 0.943 on the corpus Latin, 0.939 on the 300 FF-31 strings; at 0.94 Latin lines are 0.97 / 1.00 / 1.03. Ethiopic (Ebrima is 1.07 to 1.09 of Noto Sans Ethiopic on the corpus; native set 2: 1.074) falls back to Noto Sans Ethiopic, which this row cannot reach; that needs a route change or a factor on the Ethiopic route.'},
  'MS Gothic': {kind: 'single-with-caveat', value: 1.04, why: 'Japanese lines at 1.04: 0.96 / 0.97 / 1.15 (combining dakuten +14.8 %). MS Gothic is fixed-pitch, so its Latin cannot follow any proportional factor: at 1.04, 139 of 300 Latin strings overhang over 1 % (worst +13.4 %), against 223 (worst +18 %) today. 1.04 improves both; full fidelity for its Latin needs a fixed-pitch preview route.'},
};
for (const f of families) f.recommendation = RECOMMEND[f.family];

const result = {
  item: 'opf#361 (FF-46): sizeAdjust factors for eight proprietary script families, RR-38 basis, measured on the published 0.18 packages',
  measuredAt: raw.measuredAt, host: raw.host, packages: raw.packages, corpus: raw.corpus, basis: raw.basis,
  scenarios: {none: 'factor 1 (published policy today)', single: 'proposed factor on every run drawn in the replacement, Latin included (policy sizeAdjust semantics in opf-render 0.18.0, verified on Arabic Typesetting below)', perScript: 'proposed factor on own-script text only (Unicode Script of the family, digits of that script included), Latin and common text at 1 (needs a new policy field and renderer change)', perScriptLetters: 'proposed factor on the family script letters and marks only; digits (also Arabic-Indic and Thai digits), punctuation and Latin at 1', noOverhangFactor: 'smallest single factor at which no measured line the factor reaches (own-script corpus and Latin) runs past its composed width natively'},
  ratio: 'native / preview width of the same line; above 1 PowerPoint draws it longer than the preview composed it',
  policyFormat: 'spec/reference/font-policy.schema.json: replacement.sizeAdjust is one number per row; opf-render sizeAdjustFor applies it to every run drawn in the row replacement, whatever its script. A per-script factor is not expressible today.',
  verification: raw.verification,
  families,
};
writeFileSync('../ff46-sizeadjust-measurements.json', `${JSON.stringify(result, null, 1)}\n`);

// ---------------- markdown ----------------
const pct = v => v === null || v === undefined ? '-' : `${v >= 1 ? '+' : ''}${((v - 1) * 100).toFixed(1)} %`;
const sp = s => s ? `${s.min.toFixed(3)} / ${s.median.toFixed(3)} / ${s.max.toFixed(3)}` : '-';
const L = [];
L.push('# opf#361: size-adjust measurements for the eight FF-46 families (2026-10-10)', '');
L.push(`Measured on the Windows host with the **published** packages (${Object.entries(raw.packages).map(([k, v]) => `\`${k}\` ${v}`).join(', ')}; Node ${raw.host.node}). The real fonts were read in place from \`%SystemRoot%\\Fonts\`; nothing was copied. No PowerPoint or Office was opened. Nothing in core or \`font-policy.json\` was changed.`, '');
L.push('**Basis (RR-38):** the sum of the real font\'s shaped advances over the sum of the replacement\'s (fontkit 2.0.4, each sample\'s OpenType language, regular), on the FF-44 corpus samples of the family\'s script that the real font covers. The replacement faces are the files the published renderer loads. This reproduces the 2026-10-05 numbers in the opf#361 comments to four decimals.', '');
L.push('**Line model (new):** every corpus line and the 300 FF-31 Latin strings were planned by opf-render 0.18.0\'s own script planner for a deck whose font scheme is the family (major = minor = family, as the gallery font-scheme records write it). Policy `sizeAdjust` scales every run drawn in the replacement, **Latin included** (checked on Arabic Typesetting\'s published 0.64: a Latin line in that scheme measures exactly 0.640 of Noto Naskh Arabic, and a mixed Arabic and Latin line is one Noto Naskh run at 0.64). The ratio below is native / preview of the same line; above 1 means PowerPoint draws it longer than the box the preview composed (overhang).', '');
L.push('## Summary', '');
L.push('| Family | Replacement | Factor regular / bold (samples) | Per-sample min / median / max | Latin: real / replacement | Latin native / preview at the factor | No-overhang factor | Native set 2 (at 1) | Recommendation |');
L.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const f of families) {
  const r = f.recommendation;
  const rec = r.kind === 'none' ? '**no sizeAdjust**' : r.kind === 'perScript-preferred' ? `single **${r.value.toFixed(2)}** now; per-script (Deva) if it lands` : r.kind === 'single-with-caveat' ? `single **${r.value.toFixed(2)}** (fixed-pitch Latin caveat)` : `single **${r.value.toFixed(2)}**`;
  L.push(`| ${f.family} ${f.realVersion.replace('Version ', '')} | ${f.replacement} | ${f.factor.regular.toFixed(3)} / ${f.factor.bold?.toFixed(3) ?? '- (no bold)'} (${f.factor.samples}) | ${sp(f.factor.perSample)} | ${f.latin.realOverReplacement?.toFixed(3)} (per string ${f.latin.perString.min.toFixed(2)} to ${f.latin.perString.max.toFixed(2)}) | ${pct(f.latin.nativeOverPreviewAtSingle)} at ${f.factor.proposed.toFixed(2)} | ${f.noOverhangFactor?.toFixed(3) ?? '-'} | ${f.nativeCrossCheck?.set2 ?? '-'} | ${rec} |`);
}
L.push('', 'Latin native / preview: positive means Latin lines of that scheme overhang natively by that much on the median string; negative means slack (the preview composes them wider than PowerPoint draws them).', '');
L.push('## Lines per scenario (native / preview: min / median / max; worst overhang)', '');
L.push('| Family | Line set | Lines | Factor 1 (today) | Single factor | Per-script factor (Latin at 1) | Per-script, letters only (digits and Latin at 1) |', '| --- | --- | ---: | --- | --- | --- | --- |');
const cell = s => s ? `${sp(s)}; ${s.max > 1.01 ? `**${s.overhangLines} over 1 %, worst +${s.worstOverhangPct} % (${s.worstOverhangPtOn842} pt on 842 pt, ${s.worstLine})**` : 'no overhang'}` : '-';
for (const f of families) for (const [name, set] of Object.entries(f.sets)) {
  if (!set.lines) continue;
  L.push(`| ${f.family} | ${name} | ${set.lines} | ${cell(set.none)} | ${cell(set.single)} | ${cell(set.perScript)} | ${cell(set.perScriptLetters)} |`);
}
L.push('', '## Recommendations (agent judgement, vetoable)', '');
for (const f of families) L.push(`- **${f.family}** (${f.recommendation.kind}${f.recommendation.value ? ` ${f.recommendation.value.toFixed(2)}` : ''}): ${f.recommendation.why}`);
L.push('', '## Traditional Arabic in detail (the supervisor\'s flag)', '');
const ta = families.find(f => f.family === 'Traditional Arabic');
const taA = ta.sets['corpus-Arab'], taL = ta.sets['latin-ff31'];
L.push(`- Corpus factor ${ta.factor.regular.toFixed(3)} on ${ta.factor.samples} of 12 Arabic samples (the font lacks the letters of ${ta.factor.skippedSamples.join(', ')}). Per sample (real / Noto Naskh Arabic): ${taA.rows.map(r => `${r.id} ${r.ratio.none.toFixed(3)}`).join(', ')}.`);
L.push('- So the spread has a cause: Arabic letters are 0.71 to 0.74, the punctuation sample 0.80, Arabic with a Latin word 0.84, Arabic-Indic digits 0.90 and Persian digits 1.02. The corpus mean of 0.79 is a mix of these, not a property of running text. The opf#523 native lines (0.68 to 0.90) show the same range.');
L.push(`- Latin of the scheme: the replacement draws it (the gallery scheme sets major = minor = Traditional Arabic, and policy sizeAdjust reaches every run drawn in Noto Naskh Arabic). Real / replacement ${ta.latin.realOverReplacement.toFixed(3)} (per string ${ta.latin.perString.min.toFixed(3)} to ${ta.latin.perString.max.toFixed(3)}). At 0.79 all 300 strings overhang natively: median ${pct(taL.single.median)}, worst ${pct(taL.single.max)} (${taL.single.worstOverhangPtOn842} pt on an 842 pt line). This confirms the supervisor\'s flag; the "about 9 %" used the policy\'s mean of inverse ratios (0.864), the sum basis gives 0.843 and +6.7 % median.`);
L.push(`- Arabic lines at a single 0.79: ${sp(taA.single)}, ${taA.single.overhangLines} over 1 %, worst ${pct(taA.single.max)} (${taA.single.worstLine}). Letters-only per-script 0.79 (digits and Latin at 1): ${sp(taA.perScriptLetters)}, Latin unchanged at ${sp(taL.perScriptLetters)} (slack only).`);
L.push(`- The smallest single factor with no measured overhang is ${ta.noOverhangFactor.toFixed(3)}: effectively 1.`);
L.push('- Recommendation: **no sizeAdjust** for Traditional Arabic today. If the per-script mechanism below lands, use a letters-only Arabic factor of about 0.79 (or 0.74 if the native line set confirms the letter samples), and re-check natively before it ships.', '');
L.push('## Policy format', '', `- ${result.policyFormat}`, '- A per-script factor would need: a schema field (for example `replacement.sizeAdjustScripts: ["Thai"]`, or `sizeAdjust` as `{ "Arab": 0.79 }`), and in opf-render `sizeAdjustFor(row, drawnFamily, script)` plus a split of the planned run at script boundaries (today a mixed Arabic and Latin line is one Noto Naskh run). It should scope the factor to the letters and marks of the script (digits and punctuation at 1): in this set that is what fixes Traditional Arabic, and it would also remove the digit overhang of Sakkal Majalla and the Thai families. Leaving Latin at 1 helps only Traditional Arabic and Nirmala UI; for the Thai families and Sakkal Majalla the Latin of the scheme is narrower still, so their Latin would want its own factor (Angsana New 0.57, DilleniaUPC 0.60, Sakkal Majalla 0.65), not 1.', '');
L.push('## Line metrics (em, regular; hhea ascent / descent / gap, win ascent / descent)', '', '| Family | Real hhea | Real win | Replacement hhea | Replacement win |', '| --- | --- | --- | --- | --- |');
for (const f of families) L.push(`| ${f.family} | ${f.lineMetrics.real.hhea.join(' / ')} | ${f.lineMetrics.real.win?.join(' / ')} | ${f.lineMetrics.replacement.hhea.join(' / ')} | ${f.lineMetrics.replacement.win?.join(' / ')} |`);
L.push('', '`lineAscent` stays as proposed in the opf#361 comments (Angsana New 0.85, Sakkal Majalla 0.78 / mixed 0.78 measured natively; the others need the RR-38-style native probe). This pass measured no baselines.', '');
L.push('## Reproduce', '', '```', 'cd C:\\opf-work\\native-0-18-run\\measure', '<node24> measure-sizeadjust.mjs ff46-sizeadjust-raw.json', '<node24> analyze-sizeadjust.mjs', '```', '', 'Raw per-line data: `measure/ff46-sizeadjust-raw.json`; per-line ratios per scenario: `ff46-sizeadjust-measurements.json` (`families[].sets[].rows`).');
writeFileSync('../ff46-sizeadjust-measurements.md', `${L.join('\n')}\n`);
for (const f of families) console.log(f.family, f.factor.regular, 'latin', f.latin.realOverReplacement, 'noOverhang', f.noOverhangFactor, JSON.stringify(f.primaryLines.single), JSON.stringify(f.sets['latin-ff31'].single));
