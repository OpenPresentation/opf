// Classify raw measurements (out/raw-results.json) into results.json + per-dimension markdown tables.
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const B = path.resolve(here, '..');
const raw = JSON.parse(await readFile(`${B}/out/raw-results.json`, 'utf8'));
const gallery = JSON.parse(await readFile(`${process.env.GALLERY_DIR ?? '<workspace>/pptx-gallery'}/data/font-schemes.json`, 'utf8'));
const galleryFont = id => [...gallery.items, ...gallery.legacyItems].find(x => (x.id ?? x.slug) === id);
const RTL = new Set(['arabic', 'hebrew', 'persian', 'urdu', 'pashto', 'dari', 'sindhi', 'kurdish-sorani', 'uyghur', 'yiddish', 'dhivehi']);

const SHARED_EXPORT = ['theme clrScheme is the pptxgenjs Office default (accent1 4472C4)', 'theme major/minor ea+cs typeface=""', 'app.xml Fonts Used = Arial, Calibri', 'every run lang="en-US"', 'fromPptx drops the catalog id (no diagnostic)'];

function classify(r) {
  const m = r.measure ?? {}, reasons = [];
  const base = {dimension: r.dimension, id: r.id, name: r.name, schemaValid: r.schemaValid, catalogResolves: r.catalogResolves,
    validatorWarnings: r.validatorWarnings, lintWarnings: r.lintWarnings.filter(w => !/catalog-source/.test(w)),
    preview: {hostFonts: r.preview.none.ok || r.preview.none.error, bundledBase: r.preview.base.ok || `${r.preview.base.error}:${r.preview.base.details?.fontFamily ?? ''}`, officePackVisual: r.preview.officeVisual.ok || `${r.preview.officeVisual.error}:${r.preview.officeVisual.details?.fontFamily ?? ''}`},
    export: {default: r.export.defaultOk || r.export.defaultError?.error, withBundledRegistry: r.export.baseRegistryOk || r.export.baseRegistryError?.error},
    reimport: r.reimport?.ok ? {retainedDesignKeys: r.reimport.designKeys, diagnostics: r.reimport.diagnostics} : r.reimport, measure: m};
  const d = r.dimension;
  let cls, engine;
  if (d === 'color-schemes') {
    const agree = m.previewVsExportColorDiff && !m.previewVsExportColorDiff.previewOnly.length && !m.previewVsExportColorDiff.exportOnly.length;
    engine = agree && m.previewSchemeColorsUsed.length >= 5 ? 'preview+export apply scheme colours (literal srgbClr)' : 'colour mismatch';
    reasons.push(`theme clrScheme matches ${m.exportThemeClrScheme.matched}/${m.exportThemeClrScheme.of} slots (Office default)`, 'scheme colours exported as literal RGB, not schemeClr', 're-import loses colorScheme id silently');
    if (m.previewSchemeColorsUsed.length < 5) reasons.push('few scheme colours used');
    cls = r.schemaValid && r.catalogResolves && agree ? 'partial' : 'broken';
  } else if (d.startsWith('font-schemes')) {
    const g = galleryFont(r.id);
    const open = /OFL|Open Font|Apache|SIL/i.test(g?.license ?? '') || g?.scope === 'google';
    base.licensing = {scope: g?.scope, license: g?.license, openlyLicensed: open, webFontUrl: g?.webFontUrl ?? null, bundledForPreview: m.availability?.heading === 'bundled-base' && m.availability?.body === 'bundled-base', availability: m.availability};
    const expOk = m.majorMatches && m.minorMatches && (m.foreignTypefaces ?? []).length === 0;
    engine = `export ${expOk ? 'writes chosen families' : 'mismatch'}; preview ${base.licensing.bundledForPreview ? 'bundled' : r.preview.officeVisual.ok ? 'office-pack substitute ' + (m.previewOfficeVisual.substitutions ?? []).join(',') : 'host fonts only (strict: font-unavailable)'}`;
    if (!base.licensing.bundledForPreview) reasons.push(r.preview.officeVisual.ok ? `preview needs office-pack substitution (${(m.previewOfficeVisual.substitutions ?? []).join(',')}); export with that registry writes the substitute, not the chosen family` : `no bundled or substitute face: strict preview throws font-unavailable (${m.previewBase?.family}); host-font preview is unmeasured fallback`);
    if (!r.catalogResolves) reasons.push('id not in core catalog (legacy inlined by gallery)');
    if (m.textSampleProbe && m.textSampleProbe.base !== 'ok') reasons.push(`non-Latin textSample: strict ${m.textSampleProbe.base}`);
    if (!expOk) reasons.push('export major/minor or run typefaces differ from scheme');
    reasons.push('theme ea/cs empty; re-import drops fontScheme');
    cls = !r.schemaValid ? 'broken' : !expOk ? 'broken' : (base.licensing.bundledForPreview ? 'partial' : 'partial');
    base.previewTier = base.licensing.bundledForPreview ? 'bundled' : r.preview.officeVisual.ok ? 'substitute' : 'host-only';
  } else if (d === 'languages') {
    const p = m.nativeProbe ?? {};
    base.glyph = {nativeText: p.text, nonLatinScript: p.nonLatinScript, strictWithSnippetScheme: p.base, officePack: p.officeVisual, onBundledRoboto: p.robotoBase, onGoogleFontScheme: p.googleSchemeBase};
    base.languageFontScheme = r.catalog.fontSchemeRecord?.id; base.bcp47 = m.bcp47;
    engine = `engine ignores language (preview identical=${m.consumption?.previewIdentical}, export identical=${m.consumption?.exportIdentical?.equal}); lang emitted: ${(m.exportLangs ?? []).join(',')}`;
    reasons.push('no engine reads `language`; the font change comes only from the gallery snippet injecting design.fontScheme');
    if (!m.langEmitted) reasons.push("PPTX runs lang=en-US instead of the language bcp47");
    if (RTL.has(r.id) || /arab|hebr|urdu|pers|pasht/i.test(r.id)) reasons.push('RTL language but no rtl attribute emitted');
    if (p.nonLatinScript && String(p.robotoBase).startsWith('missing-glyph')) reasons.push('bundled Roboto lacks the script (missing-glyph)');
    if (String(p.base).startsWith('font-unavailable')) reasons.push(`language font scheme ${base.languageFontScheme} not bundled`);
    reasons.push('re-import drops language');
    cls = r.schemaValid && r.catalogResolves ? 'schema-only' : 'broken';
  } else if (d === 'themes') {
    const bgOk = m.previewSvgBackground === m.expectedBgHex && m.exportSlideBg?.[0] === m.expectedBgHex;
    const fontsOk = m.majorMatches && m.minorMatches;
    engine = `bg preview ${m.previewSvgBackground}/export ${m.exportSlideBg?.[0]} (expected ${m.expectedBgHex}); fonts ${m.exportThemeMajorLatin}/${m.exportThemeMinorLatin}; theme-only doc applies bundle: ${m.themeOnly.exportMajor === m.expected?.heading && m.themeOnly.exportBg?.[0] === m.expectedBgHex}`;
    reasons.push(`theme clrScheme Office default (${m.exportThemeClrScheme?.matched}/12)`, `fonts ${m.availability?.heading}`, 're-import keeps only dimensions');
    cls = bgOk && fontsOk ? 'partial' : 'broken';
  } else if (d === 'narratives' || d === 'tones' || d === 'audiences') {
    const inert = m.consumption?.previewIdentical && m.consumption?.exportIdentical?.equal;
    engine = inert ? 'no effect on preview or export (byte-identical when removed)' : 'engine output changes';
    if (!r.catalogResolves) reasons.push(`gallery id not in core ${d} catalog${r.validatorWarnings.length && d !== 'audiences' ? ' (validator + lint warn)' : d === 'audiences' ? ' (no validator/lint warning)' : ''}`);
    if (d === 'audiences' && r.catalog.narrativeResolves === false) reasons.push('snippet narrative (recommendedNarratives[0]) not in core catalog');
    reasons.push('consumed only by validator/lint/bundle catalog checks, opf-editor transfer mapping and authoring skills; re-import drops it');
    cls = !r.catalogResolves ? 'gallery-only' : inert ? 'authoring-metadata' : 'works';
  } else if (d === 'socials') {
    const inert = m.consumption?.previewIdentical && m.consumption?.exportIdentical?.equal;
    engine = inert ? 'organization/speaker socials have no effect on preview or export; handle not rendered' : 'engine output changes';
    reasons.push('no size/aspect or rendered handle; re-import drops organization/speaker');
    cls = r.catalogResolves ? (inert ? 'authoring-metadata' : 'works') : 'gallery-only';
  }
  return {...base, classification: cls, engineSummary: engine, reasons};
}

const results = raw.map(classify);
await writeFile(`${B}/results.json`, JSON.stringify({generated: new Date().toISOString(), heads: JSON.parse(await readFile(`${B}/out/heads.json`, 'utf8').catch(() => '{}')), sharedExportGaps: SHARED_EXPORT, results}, null, 1));

const dims = [['color-schemes', 'Color schemes'], ['font-schemes', 'Font schemes (89 upstream)'], ['font-schemes-legacy', 'Font schemes (gallery legacy)'], ['languages', 'Languages'], ['themes', 'Themes'], ['narratives', 'Narratives'], ['audiences', 'Audiences'], ['tones', 'Tones'], ['socials', 'Socials']];
const esc = s => String(s ?? '').replace(/\|/g, '\\|');
for (const [d, title] of dims) {
  const rows = results.filter(r => r.dimension === d);
  const counts = rows.reduce((a, r) => (a[r.classification] = (a[r.classification] ?? 0) + 1, a), {});
  const reasonCounts = Object.entries(rows.flatMap(r => r.reasons.map(x => x.replace(/\([^)]*\)/g, '(..)').replace(/scheme [a-z0-9-]+ not/, 'scheme X not'))).reduce((a, x) => (a[x] = (a[x] ?? 0) + 1, a), {})).sort((a, b) => b[1] - a[1]).slice(0, 8);
  let md = `# ${title}: ${rows.length} values\n\nClassification: ${Object.entries(counts).map(([k, v]) => `**${k}** ${v}`).join(', ')}\n\nSchema-valid ${rows.filter(r => r.schemaValid).length}/${rows.length}. Catalog id resolves in core ${rows.filter(r => r.catalogResolves).length}/${rows.length}.\n\n## Top reasons\n\n| count | reason |\n|---|---|\n${reasonCounts.map(([k, v]) => `| ${v} | ${esc(k)} |`).join('\n')}\n\n`;
  if (d.startsWith('font')) {
    const tiers = rows.reduce((a, r) => (a[r.previewTier] = (a[r.previewTier] ?? 0) + 1, a), {});
    const open = rows.filter(r => r.licensing.openlyLicensed).length;
    md += `Preview tier: ${Object.entries(tiers).map(([k, v]) => `${k} ${v}`).join(', ')}. Openly licensed (gallery license/scope) ${open}/${rows.length}; bundled for preview ${rows.filter(r => r.licensing.bundledForPreview).length}/${rows.length}.\n\n`;
    md += `| id | family | script | license scope | open | preview tier | strict preview | office-pack preview | PPTX major/minor | export w/ office registry | class |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
    md += rows.map(r => `| ${r.id} | ${esc(r.measure.expected?.heading)} / ${esc(r.measure.expected?.body)} | ${r.measure.textSampleProbe ? 'non-Latin' : 'latin'} | ${esc(r.licensing.scope)} | ${r.licensing.openlyLicensed ? 'yes' : 'no'} | ${r.previewTier} | ${esc(r.preview.bundledBase)} | ${esc(r.preview.officePackVisual === true ? (r.measure.previewOfficeVisual.substitutions ?? []).join(', ') || 'ok' : r.preview.officePackVisual)} | ${esc(r.measure.exportThemeMajorLatin)} / ${esc(r.measure.exportThemeMinorLatin)} | ${esc(r.measure.exportWithOfficeVisualRegistry?.major ?? r.measure.exportWithOfficeVisualRegistry?.error)} | ${r.classification} |`).join('\n');
  } else if (d === 'languages') {
    md += `| id | bcp47 | snippet fontScheme | native text | strict preview | office pack | on bundled Roboto | PPTX lang | class |\n|---|---|---|---|---|---|---|---|---|\n`;
    md += rows.map(r => `| ${r.id} | ${r.bcp47} | ${r.languageFontScheme} | ${esc(r.glyph.nativeText)} | ${esc(r.glyph.strictWithSnippetScheme)} | ${esc(r.glyph.officePack)} | ${esc(r.glyph.onBundledRoboto)} | ${(r.measure.exportLangs ?? []).join(',')} | ${r.classification} |`).join('\n');
  } else {
    md += `| id | valid | catalog | engine effect | reasons | class |\n|---|---|---|---|---|---|\n`;
    md += rows.map(r => `| ${r.id} | ${r.schemaValid} | ${r.catalogResolves} | ${esc(r.engineSummary)} | ${esc(r.reasons.join('; '))} | ${r.classification} |`).join('\n');
  }
  await writeFile(`${B}/${d}.md`, md + '\n');
}
const overall = dims.map(([d, t]) => { const rows = results.filter(r => r.dimension === d); const c = rows.reduce((a, r) => (a[r.classification] = (a[r.classification] ?? 0) + 1, a), {}); return `| ${t} | ${rows.length} | ${Object.entries(c).map(([k, v]) => `${k} ${v}`).join(', ')} |`; });
await writeFile(`${B}/out/overall-table.md`, `| dimension | n | classification |\n|---|---|---|\n${overall.join('\n')}\n`);
console.log(overall.join('\n'));
