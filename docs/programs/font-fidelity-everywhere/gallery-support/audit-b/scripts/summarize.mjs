// Classify raw measurements (out/raw-results.json) into results.json + per-dimension markdown tables.
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const B = path.resolve(here, '..');
const raw = JSON.parse(await readFile(`${B}/out/raw-results.json`, 'utf8'));
const gallery = JSON.parse(await readFile(`${process.env.GALLERY_DIR ?? '<workspace>/pptx-gallery'}/data/font-schemes.json`, 'utf8'));
const galleryFont = id => [...gallery.items, ...gallery.legacyItems].find(x => (x.id ?? x.slug) === id);
// Every reason below is derived from a measured field in out/raw-results.json; nothing is printed unconditionally.
// A value is `works` only when the audit recorded no reason against it.
const list = a => (a ?? []).join(', ');
const diag = r => r.reimport?.diagnostics?.length ? `diagnostics: ${r.reimport.diagnostics.join(',')}` : 'no diagnostic';
const reimportReason = (r, what, got, want) => `re-import returns ${what} ${JSON.stringify(got ?? null)}, expected ${JSON.stringify(want ?? null)} (${diag(r)})`;

// Colour checks shared by color schemes and themes (FF-24): theme clrScheme slots, slide colour references resolved
// through the exported theme, and agreement with the preview.
function colorReasons(m, reasons) {
  const t = m.exportThemeClrScheme;
  if (!t) reasons.push('no exported theme clrScheme measured');
  else if (t.matched < t.of) reasons.push(`theme clrScheme matches ${t.matched}/${t.of} slots${t.officeDefaultAccent1 ? ' (accent1 is the Office default 4472C4)' : ''}`);
  const u = m.exportColorUses;
  if (!u) reasons.push('no slide colour references measured');
  else {
    if (!u.scheme) reasons.push('slides have no a:schemeClr reference (colours are literal only)');
    if (u.transformed.length) reasons.push(`colour transforms not resolved by the audit: ${list(u.transformed)}`);
    if (u.unresolved.length) reasons.push(`colour references that do not resolve through the theme: ${list(u.unresolved)}`);
  }
  if (m.literalSchemeHexes?.length) reasons.push(`scheme slot colours written as literal srgbClr (${m.literalSchemeUses} uses): ${list(m.literalSchemeHexes)}`);
  const d = m.previewVsExportColorDiff;
  if (d?.previewOnly.length) reasons.push(`scheme colours in the preview but not in the export: ${list(d.previewOnly)}`);
  if (d?.exportOnly.length) reasons.push(`scheme colours in the export but not in the preview: ${list(d.exportOnly)}`);
  if (m.colorBySlide === undefined) reasons.push('slide-by-slide colours not measured');
  else if (m.previewSlides !== m.exportSlides) reasons.push(`slide count ${m.previewSlides} (preview) vs ${m.exportSlides} (export)`);
  for (const x of m.colorBySlide ?? []) {
    if (x.previewOnly.length || x.exportOnly.length) reasons.push(`slide ${x.slide}: scheme colours preview-only [${list(x.previewOnly)}], export-only [${list(x.exportOnly)}]`);
    if (x.exportHexesNotInPreview.length) reasons.push(`slide ${x.slide}: export colours the preview does not paint: ${list(x.exportHexesNotInPreview)}`);
    if (x.previewBg !== x.exportBg) reasons.push(`slide ${x.slide}: background ${x.previewBg} (preview) vs ${x.exportBg} (export)`);
  }
}

// Font availability for preview (FF-31): only the strict bundled base pack is a measured, host-independent preview.
// Preview and export colours agree deck-wide and slide by slide (slots, unpainted export colours, backgrounds).
const colorsAgree = m => !!m.previewVsExportColorDiff && !m.previewVsExportColorDiff.previewOnly.length && !m.previewVsExportColorDiff.exportOnly.length &&
  Array.isArray(m.colorBySlide) && m.colorBySlide.length === 0 && m.previewSlides === m.exportSlides;

function availabilityReason(m, r) {
  const a = m.availability ?? {};
  if (a.heading === 'bundled-base' && a.body === 'bundled-base') return null;
  return r.preview.officeVisual.ok
    ? `preview needs office-pack substitution (${list(m.previewOfficeVisual?.substitutions)}); export with that registry writes ${m.exportWithOfficeVisualRegistry?.major ?? m.exportWithOfficeVisualRegistry?.error}/${m.exportWithOfficeVisualRegistry?.minor ?? ''}`
    : `no bundled or substitute face: strict preview throws font-unavailable (${m.previewBase?.family}); host-font preview is unmeasured fallback`;
}
const emptyEaCs = m => [...(m.exportThemeEaCs?.major ?? []), ...(m.exportThemeEaCs?.minor ?? [])].some(v => v === '');

function classify(r) {
  const m = r.measure ?? {}, reasons = [];
  const base = {dimension: r.dimension, id: r.id, name: r.name, schemaValid: r.schemaValid, catalogResolves: r.catalogResolves,
    validatorWarnings: r.validatorWarnings, lintWarnings: r.lintWarnings.filter(w => !/catalog-source/.test(w)),
    preview: {hostFonts: r.preview.none.ok || r.preview.none.error, bundledBase: r.preview.base.ok || `${r.preview.base.error}:${r.preview.base.details?.fontFamily ?? ''}`, officePackVisual: r.preview.officeVisual.ok || `${r.preview.officeVisual.error}:${r.preview.officeVisual.details?.fontFamily ?? ''}`},
    export: {default: r.export.defaultOk || r.export.defaultError?.error, withBundledRegistry: r.export.baseRegistryOk || r.export.baseRegistryError?.error},
    reimport: r.reimport?.ok ? {retainedDesignKeys: r.reimport.designKeys, diagnostics: r.reimport.diagnostics} : r.reimport, measure: m};
  const d = r.dimension;
  // Anything that failed before a measurement could be taken is broken, whatever the dimension.
  const hardFail = !r.schemaValid ? 'schema invalid' : !r.preview.none.ok ? `preview threw ${r.preview.none.error}` : !r.export.defaultOk ? `export threw ${r.export.defaultError?.error}` : !r.reimport?.ok ? `re-import threw ${r.reimport?.error}` : null;
  if (hardFail) reasons.push(hardFail);
  for (const issue of r.export.inventory?.chainIssues ?? []) reasons.push(`export colour chain unresolved: ${issue}`);
  let cls, engine;
  if (d === 'color-schemes') {
    const agree = colorsAgree(m);
    const u = m.exportColorUses ?? {};
    engine = `preview ${list(m.previewSchemeColorsUsed)}; export ${list(m.exportSchemeColorsInSlides)} (${u.scheme ?? 0} schemeClr, ${u.literal ?? 0} srgbClr); theme ${m.exportThemeClrScheme?.matched}/${m.exportThemeClrScheme?.of}`;
    if (!r.catalogResolves) reasons.push('color scheme id not in core catalog');
    colorReasons(m, reasons);
    if ((m.previewSchemeColorsUsed ?? []).length < 5) reasons.push(`few scheme colours used (${(m.previewSchemeColorsUsed ?? []).length})`);
    if (m.reimportColorScheme !== m.colorScheme) reasons.push(reimportReason(r, 'colorScheme', m.reimportColorScheme, m.colorScheme));
    cls = hardFail || !r.catalogResolves || !agree ? 'broken' : reasons.length ? 'partial' : 'works';
  } else if (d.startsWith('font-schemes')) {
    const g = galleryFont(r.id);
    const open = /OFL|Open Font|Apache|SIL/i.test(g?.license ?? '') || g?.scope === 'google';
    base.licensing = {scope: g?.scope, license: g?.license, openlyLicensed: open, webFontUrl: g?.webFontUrl ?? null, bundledForPreview: m.availability?.heading === 'bundled-base' && m.availability?.body === 'bundled-base', availability: m.availability};
    const expOk = m.majorMatches && m.minorMatches && (m.foreignTypefaces ?? []).length === 0;
    engine = `export ${expOk ? 'writes chosen families' : 'mismatch'}; preview ${base.licensing.bundledForPreview ? 'bundled' : r.preview.officeVisual.ok ? 'office-pack substitute ' + (m.previewOfficeVisual.substitutions ?? []).join(',') : 'host fonts only (strict: font-unavailable)'}`;
    const avail = availabilityReason(m, r); if (avail) reasons.push(avail);
    if (!r.catalogResolves) reasons.push('id not in core catalog (legacy inlined by gallery)');
    if (m.textSampleProbe && m.textSampleProbe.base !== 'ok') reasons.push(`non-Latin textSample: strict ${m.textSampleProbe.base}`);
    if (!expOk) reasons.push(`export major/minor or run typefaces differ from scheme (${m.exportThemeMajorLatin}/${m.exportThemeMinorLatin}; foreign: ${list(m.foreignTypefaces) || 'none'})`);
    if (m.previewVsExportFontDiff && !m.previewVsExportFontDiff.agree) reasons.push(`preview ${m.previewVsExportFontDiff.previewHeading}/${m.previewVsExportFontDiff.previewBody} vs export ${m.previewVsExportFontDiff.exportMajor}/${m.previewVsExportFontDiff.exportMinor}`);
    if (emptyEaCs(m)) reasons.push('theme major/minor ea or cs typeface is empty');
    if (m.reimportFontScheme !== m.fontScheme) reasons.push(reimportReason(r, 'fontScheme', m.reimportFontScheme, m.fontScheme));
    cls = hardFail || !expOk ? 'broken' : reasons.length ? 'partial' : 'works';
    base.previewTier = base.licensing.bundledForPreview ? 'bundled' : r.preview.officeVisual.ok ? 'substitute' : 'host-only';
  } else if (d === 'languages') {
    const p = m.nativeProbe ?? {}, cat = m.catalogLanguage ?? {};
    base.glyph = {nativeText: p.text, nonLatinScript: p.nonLatinScript, strictWithSnippetScheme: p.base, officePack: p.officeVisual, onBundledRoboto: p.robotoBase, onGoogleFontScheme: p.googleSchemeBase};
    base.languageFontScheme = r.catalog.fontSchemeRecord?.id; base.bcp47 = m.bcp47; base.ooxmlLang = cat.ooxmlLang; base.direction = cat.direction; base.scriptSlot = p.scriptSlot ?? null;
    const c = m.consumption ?? {};
    const inert = c.previewIdentical === true && c.exportIdentical?.equal === true;
    engine = `removing language changes preview=${c.previewIdentical === false}${m.previewChangeIsLangAttributeOnly ? ' (lang attribute only)' : ''}, export=${c.exportIdentical?.equal === false}; slide lang ${list(m.exportSlideLangs)}; native-text rtl paragraphs ${p.exportSlideRtlParagraphs ?? '-'}, preview rtl lines ${p.previewRtlLines ?? '-'}`;
    if (!r.catalogResolves) reasons.push('language id not in core catalog');
    if (c.previewIdentical === true) reasons.push('removing language leaves the preview unchanged');
    if (c.exportIdentical?.equal === true) reasons.push('removing language leaves every PPTX part unchanged');
    const want = cat.ooxmlLang ?? m.bcp47;
    const langs = m.exportSlideLangs ?? [];
    if (!langs.length || langs.some(l => l !== want)) reasons.push(`slide runs carry lang ${list(langs) || 'none'}, catalog ooxmlLang ${want}`);
    // Direction, measured on the gallery's native-name probe (the snippet's own text is Latin).
    if (p.text) {
      const xr = p.exportSlideRtlParagraphs ?? 0, pr = p.previewRtlLines ?? 0;
      if (cat.direction === 'rtl' && (xr === 0 || pr === 0)) reasons.push(`right-to-left language: native text exports ${xr} rtl paragraph(s), preview marks ${pr} line(s) right-to-left`);
      if (cat.direction !== 'rtl' && (xr > 0 || pr > 0)) reasons.push(`left-to-right language: native text exports ${xr} rtl paragraph(s), preview marks ${pr} line(s) right-to-left`);
      if (cat.direction === 'rtl' && xr > 0 && pr > 0 && xr !== pr) reasons.push(`rtl paragraphs ${xr} (export) vs ${pr} (preview)`);
      if (!p.exportOk) reasons.push('native-text probe export failed');
      else if ((p.exportSlideLangs ?? []).some(l => l !== want)) reasons.push(`native text exports lang ${list(p.exportSlideLangs)}, catalog ooxmlLang ${want}`);
      // Script slot (ea or cs): the runs must name the language's font there, and the theme must not leave it empty.
      if (p.scriptSlot === 'ea' || p.scriptSlot === 'cs') {
        const fam = [m.expected?.heading, m.expected?.body].filter(Boolean);
        if (!(p.slotFaces ?? []).some(f => fam.includes(f))) reasons.push(`native text uses the ${p.scriptSlot} slot but runs name ${list(p.slotFaces) || 'no face'} there (scheme ${list(fam)})`);
        const i = p.scriptSlot === 'ea' ? 0 : 1;
        if (m.exportThemeEaCs && (m.exportThemeEaCs.major?.[i] === '' || m.exportThemeEaCs.minor?.[i] === '')) reasons.push(`theme major/minor ${p.scriptSlot} is empty for a ${p.scriptSlot}-slot script`);
      }
      if (p.none !== 'ok') reasons.push(`native text preview (host fonts) ${p.none}`);
      if (p.nonLatinScript && String(p.robotoBase).startsWith('missing-glyph')) reasons.push('bundled Roboto lacks the script (missing-glyph)');
      if (p.base !== 'ok') reasons.push(`language font scheme ${base.languageFontScheme} not bundled: strict preview ${p.base}`);
    } else reasons.push('no native-name sample in the gallery; direction and script slot unmeasured');
    if (m.foreignTypefaces?.length) reasons.push(`foreign typefaces in export: ${list(m.foreignTypefaces)}`);
    if (m.engineAppliesLanguageFontScheme !== true) reasons.push(`engines do not derive the font scheme from language alone (${m.engineAppliesLanguageFontScheme === false ? "the snippet's design.fontScheme sets it" : m.engineAppliesLanguageFontScheme})`);
    if (m.reimportLanguage !== r.id) reasons.push(reimportReason(r, 'language', m.reimportLanguage, r.id));
    cls = hardFail || !r.catalogResolves ? 'broken' : inert ? 'schema-only' : reasons.length ? 'partial' : 'works';
  } else if (d === 'themes') {
    const bgOk = m.previewSvgBackground === m.expectedBgHex && m.exportSlideBg?.[0] === m.expectedBgHex;
    const fontsOk = m.majorMatches && m.minorMatches;
    const bundle = m.themeOnly?.exportMajor === m.expected?.heading && m.themeOnly?.exportBg?.[0] === m.expectedBgHex && m.themeOnly?.previewBackground === m.expectedBgHex;
    engine = `bg preview ${m.previewSvgBackground}/export ${m.exportSlideBg?.[0]} (expected ${m.expectedBgHex}); fonts ${m.exportThemeMajorLatin}/${m.exportThemeMinorLatin}; theme-only doc applies bundle: ${bundle}`;
    if (!r.catalogResolves) reasons.push('theme id not in core catalog');
    if (!bgOk) reasons.push(`background preview ${m.previewSvgBackground} / export ${m.exportSlideBg?.[0]}, expected ${m.expectedBgHex}`);
    if (!fontsOk) reasons.push(`theme fonts ${m.exportThemeMajorLatin}/${m.exportThemeMinorLatin}, expected ${m.expected?.heading}/${m.expected?.body}`);
    if (!bundle) reasons.push('a theme-only document does not apply the theme bundle (fonts or background)');
    colorReasons(m, reasons);
    const avail = availabilityReason(m, r); if (avail) reasons.push(avail);
    if (m.previewVsExportFontDiff && !m.previewVsExportFontDiff.agree) reasons.push(`preview fonts ${m.previewVsExportFontDiff.previewHeading}/${m.previewVsExportFontDiff.previewBody} vs export ${m.previewVsExportFontDiff.exportMajor}/${m.previewVsExportFontDiff.exportMinor}`);
    if (m.reimportTheme !== r.catalog.value) reasons.push(reimportReason(r, 'theme', m.reimportTheme, r.catalog.value));
    cls = hardFail || !bgOk || !fontsOk || !colorsAgree(m) ? 'broken' : reasons.length ? 'partial' : 'works';
  } else if (d === 'narratives' || d === 'tones' || d === 'audiences') {
    const c = m.consumption ?? {};
    const inert = c.previewIdentical && c.exportIdentical?.equal;
    engine = inert ? 'no effect on preview or export (byte-identical when removed)' : `removing the field changes preview=${c.previewIdentical === false}, export parts: ${list(c.exportIdentical?.diffParts)}`;
    if (!r.catalogResolves) reasons.push(`gallery id not in core ${d} catalog${r.validatorWarnings.length ? ' (validator warns)' : ' (no validator warning)'}`);
    if (d === 'audiences' && r.catalog.narrativeResolves === false) reasons.push('snippet narrative (recommendedNarratives[0]) not in core catalog');
    const want = d === 'narratives' ? r.snippet?.narrative : d === 'tones' ? r.snippet?.tone : r.snippet?.audience;
    if (JSON.stringify(m.reimportValue ?? null) !== JSON.stringify(want ?? null)) reasons.push(reimportReason(r, d.slice(0, -1), m.reimportValue, want));
    cls = hardFail ? 'broken' : !r.catalogResolves ? 'gallery-only' : inert ? 'authoring-metadata' : reasons.length ? 'partial' : 'works';
  } else if (d === 'socials') {
    const c = m.consumption ?? {};
    const inert = c.previewIdentical && c.exportIdentical?.equal;
    engine = inert ? 'organization/speaker socials have no effect on preview or export' : `removing the socials changes preview=${c.previewIdentical === false}, export parts: ${list(c.exportIdentical?.diffParts)}`;
    if (!r.catalogResolves) reasons.push('social platform id not in core catalog');
    if (m.handleInPreview !== true) reasons.push('the social handle is not rendered in the preview');
    if (m.handleInExport !== true) reasons.push('the social handle is not in the exported slide, layout or master XML');
    const soc = r.snippet?.speaker?.socials?.[r.id], got = m.reimportSocials ?? {};
    if (got.speaker?.[r.id] !== soc || (r.snippet?.organization?.socials && got.organization?.[r.id] !== r.snippet.organization.socials[r.id])) reasons.push(reimportReason(r, 'socials', got, {organization: r.snippet?.organization?.socials ?? null, speaker: r.snippet?.speaker?.socials ?? null}));
    cls = hardFail ? 'broken' : !r.catalogResolves ? 'gallery-only' : inert ? 'authoring-metadata' : reasons.length ? 'partial' : 'works';
  }
  return {...base, classification: cls, engineSummary: engine, reasons};
}

// Gaps shared by every exported value, measured over this run (the list is empty when no gap is universal).
function sharedExportGaps(rows) {
  const ex = rows.filter(r => r.export.defaultOk && r.export.inventory);
  const inv = r => r.export.inventory;
  const checks = [
    ['theme clrScheme accent1 is the Office default 4472C4', r => inv(r).themeClr?.accent1 === '4472C4'],
    ['theme major/minor ea or cs typeface=""', r => [...(inv(r).themeMajor ?? []).slice(1), ...(inv(r).themeMinor ?? []).slice(1)].some(v => v === '')],
    ['app.xml lists Arial or Calibri', r => (inv(r).appFonts ?? []).some(f => f === 'Arial' || f === 'Calibri')],
    ['every run lang="en-US"', r => (inv(r).langs ?? []).length === 1 && inv(r).langs[0] === 'en-US'],
    ['re-import emits heading-import-reflow', r => (r.reimport?.diagnostics ?? []).includes('heading-import-reflow')],
  ];
  return checks.map(([gap, hit]) => [gap, ex.filter(hit).length]).filter(([, n]) => ex.length && n === ex.length).map(([gap, n]) => `${gap} (${n}/${ex.length} exports)`);
}

const results = raw.map(classify);
await writeFile(`${B}/results.json`, JSON.stringify({generated: new Date().toISOString(), heads: JSON.parse(await readFile(`${B}/out/heads.json`, 'utf8').catch(() => '{}')), sharedExportGaps: sharedExportGaps(raw), results}, null, 1));

const dims = [['color-schemes', 'Color schemes'], ['font-schemes', 'Font schemes (89 upstream)'], ['font-schemes-legacy', 'Font schemes (gallery legacy)'], ['languages', 'Languages'], ['themes', 'Themes'], ['narratives', 'Narratives'], ['audiences', 'Audiences'], ['tones', 'Tones'], ['socials', 'Socials']];
const esc = s => String(s ?? '').replace(/\|/g, '\\|');
for (const [d, title] of dims) {
  const rows = results.filter(r => r.dimension === d);
  const counts = rows.reduce((a, r) => (a[r.classification] = (a[r.classification] ?? 0) + 1, a), {});
  const reasonCounts = Object.entries(rows.flatMap(r => r.reasons.map(x => x.replace(/\([^)]*\)/g, '(..)').replace(/scheme [a-z0-9-]+ not/, 'scheme X not').replace(/: .*/, ': ..'))).reduce((a, x) => (a[x] = (a[x] ?? 0) + 1, a), {})).sort((a, b) => b[1] - a[1]).slice(0, 8);
  let md = `# ${title}: ${rows.length} values\n\nClassification: ${Object.entries(counts).map(([k, v]) => `**${k}** ${v}`).join(', ')}\n\nSchema-valid ${rows.filter(r => r.schemaValid).length}/${rows.length}. Catalog id resolves in core ${rows.filter(r => r.catalogResolves).length}/${rows.length}.\n\n## Top reasons\n\n| count | reason |\n|---|---|\n${reasonCounts.map(([k, v]) => `| ${v} | ${esc(k)} |`).join('\n')}\n\n`;
  if (d.startsWith('font')) {
    const tiers = rows.reduce((a, r) => (a[r.previewTier] = (a[r.previewTier] ?? 0) + 1, a), {});
    const open = rows.filter(r => r.licensing.openlyLicensed).length;
    md += `Preview tier: ${Object.entries(tiers).map(([k, v]) => `${k} ${v}`).join(', ')}. Openly licensed (gallery license/scope) ${open}/${rows.length}; bundled for preview ${rows.filter(r => r.licensing.bundledForPreview).length}/${rows.length}.\n\n`;
    md += `| id | family | script | license scope | open | preview tier | strict preview | office-pack preview | PPTX major/minor | export w/ office registry | class |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
    md += rows.map(r => `| ${r.id} | ${esc(r.measure.expected?.heading)} / ${esc(r.measure.expected?.body)} | ${r.measure.textSampleProbe ? 'non-Latin' : 'latin'} | ${esc(r.licensing.scope)} | ${r.licensing.openlyLicensed ? 'yes' : 'no'} | ${r.previewTier} | ${esc(r.preview.bundledBase)} | ${esc(r.preview.officePackVisual === true ? (r.measure.previewOfficeVisual.substitutions ?? []).join(', ') || 'ok' : r.preview.officePackVisual)} | ${esc(r.measure.exportThemeMajorLatin)} / ${esc(r.measure.exportThemeMinorLatin)} | ${esc(r.measure.exportWithOfficeVisualRegistry?.major ?? r.measure.exportWithOfficeVisualRegistry?.error)} | ${r.classification} |`).join('\n');
  } else if (d === 'languages') {
    md += `| id | bcp47 | ooxmlLang | snippet fontScheme | native text | slot | strict preview | office pack | on bundled Roboto | slide lang | rtl paragraphs (export / preview) | re-import | class |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
    md += rows.map(r => `| ${r.id} | ${r.bcp47} | ${r.ooxmlLang} | ${r.languageFontScheme} | ${esc(r.glyph.nativeText)} | ${r.scriptSlot ?? ''} | ${esc(r.glyph.strictWithSnippetScheme)} | ${esc(r.glyph.officePack)} | ${esc(r.glyph.onBundledRoboto)} | ${(r.measure.exportSlideLangs ?? []).join(',')} | ${r.measure.nativeProbe?.exportSlideRtlParagraphs ?? ''} / ${r.measure.nativeProbe?.previewRtlLines ?? ''} | ${r.measure.reimportLanguage ?? 'none'} | ${r.classification} |`).join('\n');
  } else {
    md += `| id | valid | catalog | engine effect | reasons | class |\n|---|---|---|---|---|---|\n`;
    md += rows.map(r => `| ${r.id} | ${r.schemaValid} | ${r.catalogResolves} | ${esc(r.engineSummary)} | ${esc(r.reasons.join('; '))} | ${r.classification} |`).join('\n');
  }
  await writeFile(`${B}/${d}.md`, md + '\n');
}
const overall = dims.map(([d, t]) => { const rows = results.filter(r => r.dimension === d); const c = rows.reduce((a, r) => (a[r.classification] = (a[r.classification] ?? 0) + 1, a), {}); return `| ${t} | ${rows.length} | ${Object.entries(c).map(([k, v]) => `${k} ${v}`).join(', ')} |`; });
await writeFile(`${B}/out/overall-table.md`, `| dimension | n | classification |\n|---|---|---|\n${overall.join('\n')}\n`);
console.log(overall.join('\n'));
