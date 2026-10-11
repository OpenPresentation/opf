// Builds every opf#323 native deck on the published 0.18 packages, the preview PNGs the FF-46 comparison needs, manifest.json and
// helpers/decks-order.txt. No Office. Run with Node 24:  <node24> build/build.mjs [--sets ff12,ff27,ff46,ff13] [--no-previews]
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {unzipSync, strFromU8} from 'fflate';
import {ROOT, PACKAGES, ZIP_DATE, EXPORT_DATE, sha256, check, exportDeck, inspectPptx, previews, writeJson} from './lib.mjs';
import {FF12} from './decks-ff12.mjs';
import {FF27} from './decks-ff27.mjs';
import {FF46} from './decks-ff46.mjs';
import {PROBES, PROBES_B, buildProbe} from './decks-probe38.mjs';
import {fontPolicyFor} from '@openpresentation/opf/font-policy';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const wanted = new Set(opt('--sets', 'ff12,ff27,ff46,ff13').split(','));
const withPreviews = !args.includes('--no-previews');
const S = 'https://openpresentation.org/schema/opf/v1';

// FF-13: the font-embed fixture. Carlito (OFL) in every run and theme slot, all four styles on slide 1, no code (no Roboto Mono).
const FF13 = [{id: 'ff13-carlito-embed-source', covers: 'FF-13 font-embed fixture: Carlito only, regular, bold, italic and bold italic',
  deck: {$schema: S, name: 'FF-13 embed fixture', language: 'en-US', design: {fontScheme: {major: 'Carlito', minor: 'Carlito', code: 'Carlito'}}, slides: [
    {title: 'Carlito embed fixture', items: ['Regular text in Carlito', [{text: 'Bold text in Carlito', bold: true}], [{text: 'Italic text in Carlito', italic: true}], [{text: 'Bold italic text in Carlito', bold: true, italic: true}]]},
    {title: 'Second slide', text: 'Only Carlito is chosen in this deck. PowerPoint Embed fonts must embed exactly Carlito.'},
  ]}, chosen: ['Carlito']}];

const SETS = {ff12: {item: 'RR-05 / FF-12', mode: 'read', decks: FF12}, ff27: {item: 'FF-27', mode: 'fields', decks: FF27}, ff46: {item: 'FF-46 / RR-17', mode: 'read', decks: FF46}, ff13: {item: 'FF-13', mode: 'embed', decks: FF13},
  // opf#361 (attempt-2): the five shipping families' FF-46 decks rebuilt with the rule factors in a LOCAL policy patch (patched/), and the
  // RR-38 lineAscent probes. ff46sa must be built under `node --import ./patched/register.mjs`; every other set must not be.
  ff46sa: {item: 'FF-46 / opf#361 factor-applied re-run', mode: 'read', patched: true, decks: FF46.filter(d => ['Angsana New', 'DilleniaUPC', 'Sakkal Majalla', 'Malgun Gothic', 'Nirmala UI'].includes(d.family)).map(d => ({...d, id: `sa-${d.id}`}))},
  probe38: {item: 'opf#361 lineAscent probe (RR-38 method)', mode: 'read', exportWidth: 2880, decks: PROBES},
  probe38b: {item: 'opf#361 lineAscent probe, attempt 3: mixed lines for Angsana New, Sakkal Majalla, Arabic Typesetting', mode: 'read', exportWidth: 2880, decks: PROBES_B}};
const patchActive = process.env.OPF361_PATCHED_POLICY === '1' && fontPolicyFor('Angsana New')?.replacement?.sizeAdjust === 0.75;
for (const set of wanted) {
  if (SETS[set]?.patched && !patchActive) throw new Error(`set ${set} needs the scratch policy patch: run with node --import ./patched/register.mjs`);
  if (SETS[set] && !SETS[set].patched && patchActive) throw new Error(`set ${set} must be built WITHOUT the policy patch`);
}

const relTarget = (files, relsPath, type) => { const xml = files[relsPath] ? strFromU8(files[relsPath]) : ''; const m = new RegExp(`Type="[^"]*/${type}"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Type="[^"]*/${type}"`).exec(xml); return m ? (m[1] ?? m[2]) : undefined; };

function expectations(bytes, info, def) {
  const files = unzipSync(bytes);
  const masterTheme = relTarget(files, 'ppt/slideMasters/_rels/slideMaster1.xml.rels', 'theme')?.replace('../', 'ppt/');
  const notesMaster = relTarget(files, 'ppt/_rels/presentation.xml.rels', 'notesMaster');
  const notesTheme = notesMaster ? relTarget(files, `ppt/notesMasters/_rels/${path.posix.basename(notesMaster)}.rels`, 'theme')?.replace('../', 'ppt/') : undefined;
  const slots = t => t ? {major: {latin: t.major.latin ?? '', ea: t.major.ea ?? '', cs: t.major.cs ?? ''}, minor: {latin: t.minor.latin ?? '', ea: t.minor.ea ?? '', cs: t.minor.cs ?? ''}} : null;
  const theme = slots(info.themeParts[masterTheme]), notesThemeSlots = slots(info.themeParts[notesTheme]);
  const isRef = n => !n || n.startsWith('+');
  const runFonts = new Set(info.slides.flatMap(s => s.shapes.flatMap(sh => sh.runs.flatMap(r => [r.latin, r.ea, r.cs]))).filter(n => !isRef(n)));
  const themeFonts = new Set(Object.entries(info.themeParts).filter(([p]) => p.startsWith('ppt/theme/')).flatMap(([, t]) => [...Object.values(t.major), ...Object.values(t.minor)]).filter(n => !isRef(n)));
  const latinRunFonts = new Set(info.slides.flatMap(s => s.shapes.flatMap(sh => sh.runs.map(r => r.latin))).filter(n => !isRef(n)));
  const themeLatin = new Set([theme?.major.latin, theme?.minor.latin].filter(Boolean));
  const chosen = [...new Set([...runFonts, ...themeFonts, ...(info.fontsUsed ?? [])])].sort();
  // Required in Presentation.Fonts: the Latin families the runs draw (theme Latin slots when runs reference the theme).
  const required = [...new Set([...latinRunFonts, ...themeLatin])].sort();
  const soft = chosen.filter(n => !required.includes(n));
  const authored = def.chosen ? [...new Set([...def.chosen, ...(def.codeFallback ? ['Roboto Mono'] : [])])].sort() : null;
  return {
    theme, notesTheme: notesThemeSlots, masterThemePart: masterTheme, notesThemePart: notesTheme,
    expectedFonts: chosen, requiredFonts: required, softFonts: soft,
    supplementFacesNotChosen: info.typefaces.filter(n => !isRef(n) && !chosen.includes(n)),
    authoredChoice: authored, authoredMatchesPackage: authored ? authored.every(n => chosen.includes(n)) && chosen.every(n => authored.includes(n) || soft.includes(n)) : null,
  };
}

const manifest = {
  item: 'opf#323 native PowerPoint runs on the published 0.18 packages (RR-05/FF-12, FF-27, FF-46/RR-17, FF-13)',
  built: {date: new Date().toISOString(), node: process.version, packages: PACKAGES, zipDate: ZIP_DATE, exportDate: EXPORT_DATE, note: 'Published npm packages only, exact versions pinned in package.json. Decks, previews and absolute paths are never committed.'},
  previewPixels: {width: 1280},
  sets: {},
};
for (const [set, spec] of Object.entries(SETS)) {
  if (!wanted.has(set)) continue;
  const outDir = path.join(ROOT, 'decks', set);
  mkdirSync(outDir, {recursive: true});
  manifest.sets[set] = {item: spec.item, mode: spec.mode, exportWidth: spec.exportWidth ?? 1280, ...(spec.patched ? {patchedPolicy: JSON.parse(readFileSync(path.join(ROOT, 'patched', 'target.json'), 'utf8')).rows} : {}), decks: {}};
  if (set === 'probe38' || set === 'probe38b') {
    for (const probe of spec.decks) {
      const {bytes, diagnostics, layout} = await buildProbe(probe);
      writeFileSync(path.join(outDir, `${probe.id}.pptx`), bytes);
      manifest.sets[set].decks[probe.id] = {title: probe.id, family: probe.family, file: `decks/${set}/${probe.id}.pptx`, bytes: bytes.length, sha256: sha256(bytes), slides: layout.length, layout, exportDiagnostics: diagnostics};
      console.log(`${set} ${probe.id}: ${layout.length} slides, ${bytes.length} bytes`);
    }
    continue;
  }
  for (const def of spec.decks) {
    const warnings = check(def.deck, def.id);
    const {bytes, diagnostics} = await exportDeck(def.deck);
    const file = path.join(outDir, `${def.id}.pptx`);
    writeFileSync(file, bytes);
    writeJson(path.join(ROOT, 'decks', set, 'opf', `${def.id}.opf.json`), def.deck);
    const info = inspectPptx(bytes);
    const exp = expectations(bytes, info, def);
    const entry = {
      title: def.deck.name, covers: def.covers ?? def.note ?? null, family: def.family ?? null, language: def.language ?? def.deck.language ?? null, status: def.status ?? null, probe: def.probe ?? false,
      file: `decks/${set}/${def.id}.pptx`, bytes: bytes.length, sha256: sha256(bytes), slides: info.slides.length,
      slideSize: info.slideSize, ...exp,
      perSlide: info.slides.map(s => ({index: s.index, charts: s.charts, tables: s.tables, notesText: s.notesText,
        runFonts: [...new Set(s.shapes.flatMap(sh => sh.runs.flatMap(r => [r.latin, r.ea, r.cs])).filter(n => n && !n.startsWith('+')))].sort(),
        shapes: s.shapes.filter(sh => sh.runs.length).map(sh => ({name: sh.name, placeholder: sh.placeholder ?? null, box: sh.box, rtl: sh.rtl, text: sh.runs.map(r => r.text).join(''),
          fields: sh.runs.filter(r => r.kind === 'fld').map(r => ({type: r.fieldType, cachedText: r.text})), runs: sh.runs.map(r => ({text: r.text, latin: r.latin ?? null, ea: r.ea ?? null, cs: r.cs ?? null, lang: r.lang ?? null, size: r.size ?? null, bold: r.bold, italic: r.italic}))})),
      })),
      layout: def.slides ?? null, expectedSlideFamilies: def.perSlide ?? null, fields: def.fields ?? null,
      validationWarnings: warnings, exportDiagnostics: diagnostics,
    };
    if ((set === 'ff46' || set === 'ff46sa') && withPreviews) entry.previews = await previews(def.deck, path.join(ROOT, 'previews', set), def.id, manifest.previewPixels.width);
    if (exp.authoredMatchesPackage === false) console.warn(`WARN ${def.id}: authored choice ${exp.authoredChoice} differs from the package ${exp.expectedFonts}`);
    manifest.sets[set].decks[def.id] = entry;
    console.log(`${set} ${def.id}: ${entry.slides} slides, ${bytes.length} bytes, fonts ${exp.expectedFonts.join(', ')}${diagnostics.length ? `, diagnostics ${[...new Set(diagnostics.map(d => d.code))].join(',')}` : ''}`);
  }
}
// Merge with an existing manifest so one set can be rebuilt alone.
let previous = {};
try { previous = JSON.parse(readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')); } catch { /* first build */ }
const merged = {...manifest, sets: {...(previous.sets ?? {}), ...manifest.sets}};
writeJson(path.join(ROOT, 'manifest.json'), merged);
const allOrder = Object.entries(merged.sets).flatMap(([set, s]) => Object.entries(s.decks).map(([id, d]) => [set, id, s.mode, d.slides, d.sha256, s.exportWidth ?? 1280].join('\t')));
writeFileSync(path.join(ROOT, 'helpers', 'decks-order.txt'), `${allOrder.join('\n')}\n`);
console.log(`manifest: ${Object.values(merged.sets).reduce((t, s) => t + Object.keys(s.decks).length, 0)} decks`);
