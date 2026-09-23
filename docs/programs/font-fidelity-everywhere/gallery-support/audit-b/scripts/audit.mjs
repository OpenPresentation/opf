// Dimension audit B: measure every gallery value (color schemes, font schemes, languages, themes,
// narratives, audiences, tones, socials) through core validate -> catalog -> opf-render preview ->
// opf-pptx export (typeface/lang/clrScheme inventory) -> fromPptx re-import.
// Run: node --import <audit-B-opf>/scripts/register-local-opf.mjs audit.mjs   (after gen-snippets.mjs)
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, '../../../sources');
const OUT = path.resolve(here, '../out');
const imp = p => import(pathToFileURL(p).href);
const core = `${SRC}/audit-B-opf/packages/javascript/dist`;
const {validatePresentation} = await imp(`${core}/validator.js`);
const {lintPresentation} = await imp(`${core}/lint.js`);
const C = await imp(`${core}/catalogs.js`);
const render = await imp(`${SRC}/audit-B-opf-render/dist/index.js`);
const {prepareNodeFonts, BUNDLED_FONT_MANIFEST} = await imp(`${SRC}/audit-B-opf-render/dist/fonts-node.js`);
const {FONT_COMPATIBILITY} = await imp(`${SRC}/audit-B-opf-render/dist/fonts.js`).catch(() => ({}));
const {toPptx, fromPptx} = await imp(`${SRC}/audit-B-opf-pptx/dist/index.js`);
const req = createRequire(`${SRC}/audit-B-opf-pptx/package.json`);
const {unzipSync} = req('fflate');

const snippets = JSON.parse(await readFile(`${OUT}/snippets.json`, 'utf8'));
const nativeNamesSrc = await readFile(`${process.env.GALLERY_DIR ?? '<workspace>/pptx-gallery'}/lib/language-native-names.ts`, 'utf8');
const nativeNames = Object.fromEntries([...nativeNamesSrc.matchAll(/^\s*"([^"]+)":\s*"([^"]*)",?$/gm)].map(m => [m[1], m[2]]));

const recs = kind => Array.isArray(C[kind]) ? C[kind] : (C.catalogs?.[kind] ?? []);
const byId = (kind, id) => recs(kind).find(r => r.id === id) ?? null;
const bundledFamilies = new Set(BUNDLED_FONT_MANIFEST.packages.flatMap(p => p.faces.map(f => f.family)));
const basePackFamilies = new Set(BUNDLED_FONT_MANIFEST.packages.filter(p => p.pack === 'base').flatMap(p => p.faces.map(f => f.family)));

const base = await prepareNodeFonts({pack: 'base'});
const officeVisual = await prepareNodeFonts({pack: 'office', substitutionPolicy: 'visual'});

const dec = new TextDecoder();
const hexes = s => new Set([...s.matchAll(/#([0-9a-fA-F]{6})\b/g)].map(m => m[1].toUpperCase()));
const svgFamilies = s => [...new Set([...s.matchAll(/font-family="([^"]*)"/g)].map(m => m[1].replace(/&quot;/g, '"')))];

function doRender(doc, mode) {
  const diagnostics = [];
  const opts = mode === 'none' ? {} : mode === 'base' ? base.options : officeVisual.options;
  const reg = mode === 'base' ? base.registry : mode === 'office-visual' ? officeVisual.registry : null;
  reg?.clearSubstitutions?.();
  try {
    const svgs = render.renderSvgDeck(structuredClone(doc), {...opts, onDiagnostic: d => diagnostics.push(d)});
    const all = svgs.join('\n');
    const resolved = render.resolvePresentation(structuredClone(doc), opts);
    return {ok: true, fonts: resolved.slides[0].design.fonts, fontSchemeType: resolved.slides[0].design.fontScheme?.type ?? null,
      colors: resolved.slides[0].design.colors ?? null, svgFamilies: svgFamilies(all), svgHexes: [...hexes(all)],
      substitutions: [...new Set((reg?.substitutions ?? []).map(s => `${s.requestedFamily}->${s.resolvedFamily}(${s.compatibility})`))],
      diagnostics: diagnostics.map(d => d.code ?? d.message), svg: all};
  } catch (e) {
    return {ok: false, error: e.code ?? e.name, message: String(e.message).slice(0, 200), details: e.details ? {fontFamily: e.details.fontFamily, character: e.details.character} : undefined, diagnostics: diagnostics.map(d => d.code)};
  }
}

function inventory(bytes) {
  const out = {typefaces: [], scriptFonts: 0, scriptFontNames: new Set(), langs: new Set(), altLangs: new Set(), rtl: 0, xlsxFontNames: [], appFonts: [], theme: null, slideSrgb: new Set(), slideBg: []};
  const walk = (zip, prefix) => {
    for (const [name, data] of Object.entries(zip)) {
      const part = prefix + name;
      if (/\.(xlsx|xlsm)$/i.test(name)) { walk(unzipSync(data), part + '!/'); continue; }
      if (!/\.(xml|rels)$/i.test(name)) continue;
      const xml = dec.decode(data);
      for (const m of xml.matchAll(/<a:(latin|ea|cs|sym|buFont)\b[^>]*\btypeface="([^"]*)"/g)) out.typefaces.push({part, tag: m[1], typeface: m[2]});
      for (const m of xml.matchAll(/<a:font script="([^"]*)" typeface="([^"]*)"/g)) { out.scriptFonts++; out.scriptFontNames.add(m[2]); }
      for (const m of xml.matchAll(/\blang="([^"]*)"/g)) out.langs.add(m[1]);
      for (const m of xml.matchAll(/\baltLang="([^"]*)"/g)) out.altLangs.add(m[1]);
      out.rtl += (xml.match(/\brtl="1"/g) ?? []).length;
      if (part.includes('!/') && /styles\.xml$/.test(name)) for (const m of xml.matchAll(/<name val="([^"]*)"/g)) out.xlsxFontNames.push({part, name: m[1]});
      if (part.includes('!/') && /theme/.test(name)) for (const m of xml.matchAll(/<a:latin typeface="([^"]*)"/g)) out.xlsxFontNames.push({part, name: m[1]});
      if (part === 'docProps/app.xml') out.appFonts = [...xml.matchAll(/<vt:lpstr>([^<]*)<\/vt:lpstr>/g)].map(m => m[1]);
      if (part === 'ppt/theme/theme1.xml') {
        const t = {};
        for (const m of xml.matchAll(/<a:(dk1|lt1|dk2|lt2|accent[1-6]|hlink|folHlink)>(.*?)<\/a:\1>/g)) t[m[1]] = (m[2].match(/(?:val|lastClr)="([0-9A-Fa-f]{6})"/g) ?? []).map(v => v.slice(-7, -1).toUpperCase()).pop();
        const maj = xml.match(/<a:majorFont><a:latin typeface="([^"]*)"[^>]*\/><a:ea typeface="([^"]*)"\/><a:cs typeface="([^"]*)"/);
        const min = xml.match(/<a:minorFont><a:latin typeface="([^"]*)"[^>]*\/><a:ea typeface="([^"]*)"\/><a:cs typeface="([^"]*)"/);
        out.theme = {clr: t, major: maj?.slice(1), minor: min?.slice(1)};
      }
      if (/^ppt\/slides\/slide\d+\.xml$/.test(part)) {
        for (const m of xml.matchAll(/srgbClr val="([0-9A-Fa-f]{6})"/g)) out.slideSrgb.add(m[1].toUpperCase());
        const bg = xml.match(/<p:bg>(.*?)<\/p:bg>/); if (bg) out.slideBg.push((bg[1].match(/val="([0-9A-Fa-f]{6})"/) ?? [])[1] ?? 'non-solid');
      }
    }
  };
  walk(unzipSync(bytes), '');
  return {...out, scriptFontNames: [...out.scriptFontNames].length, langs: [...out.langs], altLangs: [...out.altLangs], slideSrgb: [...out.slideSrgb]};
}

function partsMap(bytes) { const z = unzipSync(bytes); return Object.fromEntries(Object.entries(z).filter(([n]) => !n.startsWith('docProps/')).map(([n, d]) => [n, dec.decode(d)])); }
function partsEqual(a, b) { const ka = Object.keys(a).sort(), kb = Object.keys(b).sort(); if (ka.join() !== kb.join()) return {equal: false, diff: 'part-list'}; const d = ka.filter(k => a[k] !== b[k]); return {equal: d.length === 0, diffParts: d.slice(0, 8)}; }

async function doExport(doc, mode) {
  const diagnostics = [];
  const opts = mode === 'none' ? {} : mode === 'base' ? base.options : officeVisual.options;
  try {
    const bytes = await toPptx(structuredClone(doc), {...opts, onDiagnostic: d => diagnostics.push(d)});
    return {ok: true, bytes, diagnostics: diagnostics.map(d => d.code ?? d.message)};
  } catch (e) { return {ok: false, error: e.code ?? e.name, message: String(e.message).slice(0, 200), diagnostics: diagnostics.map(d => d.code)}; }
}
async function doImport(bytes) {
  const diagnostics = [];
  try { const doc = await fromPptx(bytes, {onDiagnostic: d => diagnostics.push(d)}); return {ok: true, doc, diagnostics: [...new Set(diagnostics.map(d => d.code ?? d.message))]}; }
  catch (e) { return {ok: false, error: e.code ?? e.name, message: String(e.message).slice(0, 200)}; }
}

const SLOT = {dark1: 'dk1', light1: 'lt1', dark2: 'dk2', light2: 'lt2', accent1: 'accent1', accent2: 'accent2', accent3: 'accent3', accent4: 'accent4', accent5: 'accent5', accent6: 'accent6', hyperlink: 'hlink', followedHyperlink: 'folHlink'};
const norm = h => typeof h === 'string' ? h.replace('#', '').toUpperCase() : null;
function clrSchemeMatch(themeClr, scheme) {
  if (!scheme || !themeClr) return null;
  const slots = Object.entries(SLOT).filter(([k]) => scheme[k]);
  const matched = slots.filter(([k, s]) => norm(scheme[k]) === themeClr[s]).map(([k]) => k);
  return {matched: matched.length, of: slots.length, officeDefaultAccent1: themeClr.accent1 === '4472C4'};
}
function schemeColorsUsed(hexSet, scheme) {
  if (!scheme) return null; const set = new Set(hexSet);
  return Object.entries(scheme).filter(([k, v]) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) && set.has(norm(v))).map(([k]) => k);
}
function fontRecordFamilies(rec) {
  if (!rec) return null;
  const fam = v => typeof v === 'string' ? v : v?.family;
  return {heading: fam(rec.heading) ?? rec.major, body: fam(rec.body) ?? rec.minor, code: fam(rec.code) ?? 'Roboto Mono (core default)'};
}
function familyAvailability(family) {
  if (!family) return null;
  if (basePackFamilies.has(family)) return 'bundled-base';
  if (bundledFamilies.has(family)) return 'bundled-office-pack';
  const compat = (FONT_COMPATIBILITY ?? []).find(c => c.requestedFamily?.toLowerCase() === family.toLowerCase());
  if (compat) { const bundledSub = compat.substitutes.find(s => bundledFamilies.has(s)); return bundledSub ? `substitute-${compat.compatibility}:${bundledSub}` : `substitute-${compat.compatibility}-not-bundled:${compat.substitutes.join('|')}`; }
  return 'not-bundled';
}

function strip(doc, keys) { const d = structuredClone(doc); for (const k of keys) { const [a, b] = k.split('.'); if (b) { if (d[a]) { delete d[a][b]; if (!Object.keys(d[a]).length) delete d[a]; } } else delete d[k]; } return d; }

const results = [];
const artifactDir = `${OUT}/pptx`; await mkdir(artifactDir, {recursive: true});
for (const s of snippets) {
  const r = {dimension: s.dimension, id: s.id, name: s.record?.name ?? s.id};
  if (s.error) { r.snippetError = s.error; r.classification = 'gallery-only'; r.reason = 'gallery snippet builder threw'; results.push(r); continue; }
  const doc = s.snippet; r.snippet = doc;
  const v = validatePresentation(structuredClone(doc)); r.schemaValid = v.valid; if (!v.valid) r.schemaErrors = v.errors?.slice(0, 3);
  r.validatorWarnings = (v.warnings ?? []).map(w => `${w.path}: ${w.message}`);
  try { r.lintWarnings = (lintPresentation(structuredClone(doc)).diagnostics ?? []).map(d => `${d.ruleId}@${d.path}: ${d.message}`); } catch (e) { r.lintWarnings = [`lint threw: ${e.message}`]; }
  const design = doc.design ?? {};
  // catalog resolution for the dimension's value
  const dim = s.dimension;
  const cat = {};
  if (dim === 'color-schemes') { cat.kind = 'colorSchemes'; cat.value = design.colorScheme; cat.record = byId('colorSchemes', design.colorScheme); cat.legacyAlias = s.id !== design.colorScheme; }
  if (dim.startsWith('font-schemes')) { cat.kind = 'fontSchemes'; cat.value = design.fontScheme; cat.record = byId('fontSchemes', design.fontScheme) ?? doc.catalogs?.fontSchemes?.records?.find(x => x.id === design.fontScheme) ?? null; cat.inline = !byId('fontSchemes', design.fontScheme) && !!cat.record; }
  if (dim === 'languages') { cat.kind = 'languages'; cat.value = doc.language; cat.record = byId('languages', doc.language); cat.fontSchemeRecord = cat.record?.fontScheme ? byId('fontSchemes', cat.record.fontScheme) : null; cat.googleFontSchemeRecord = cat.record?.googleFontScheme ? byId('fontSchemes', cat.record.googleFontScheme) : null; }
  if (dim === 'themes') { cat.kind = 'themes'; cat.value = design.theme; cat.record = byId('themes', design.theme); }
  if (dim === 'narratives') { cat.kind = 'narratives'; cat.value = doc.narrative; cat.record = byId('narratives', doc.narrative); }
  if (dim === 'audiences') { cat.kind = 'audiences'; cat.value = doc.audience?.[0]; cat.record = byId('audiences', doc.audience?.[0]); cat.narrativeResolves = doc.narrative ? !!byId('narratives', doc.narrative) : null; cat.toneResolves = doc.tone ? !!byId('tones', doc.tone) : null; cat.colorSchemeResolves = design.colorScheme ? !!byId('colorSchemes', design.colorScheme) : null; }
  if (dim === 'tones') { cat.kind = 'tones'; cat.value = doc.tone; cat.record = byId('tones', doc.tone); }
  if (dim === 'socials') { cat.kind = 'socialPlatforms'; cat.value = s.id; cat.record = byId('socialPlatforms', s.id); }
  r.catalogResolves = !!cat.record; r.catalog = {...cat, record: cat.record ? {id: cat.record.id, ...(cat.kind === 'fontSchemes' ? {major: cat.record.major, minor: cat.record.minor, languageFamily: cat.record.languageFamily, type: cat.record.type} : {})} : null,
    fontSchemeRecord: cat.fontSchemeRecord ? {id: cat.fontSchemeRecord.id, major: cat.fontSchemeRecord.major, minor: cat.fontSchemeRecord.minor, languageFamily: cat.fontSchemeRecord.languageFamily} : cat.fontSchemeRecord, googleFontSchemeRecord: cat.googleFontSchemeRecord ? cat.googleFontSchemeRecord.id : cat.googleFontSchemeRecord};

  // preview
  const pv = {none: doRender(doc, 'none'), base: doRender(doc, 'base'), officeVisual: doRender(doc, 'office-visual')};
  // export + inventory
  const ex = await doExport(doc, 'none'); const exBase = await doExport(doc, 'base');
  let inv = null, reimport = null;
  if (ex.ok) {
    inv = inventory(ex.bytes);
    await writeFile(`${artifactDir}/${dim}__${s.id}.pptx`, ex.bytes);
    const im = await doImport(ex.bytes);
    reimport = im.ok ? {ok: true, designKeys: Object.keys(im.doc.design ?? {}), top: Object.keys(im.doc).filter(k => !['$schema', 'slides'].includes(k)), diagnostics: im.diagnostics, doc: im.doc} : im;
  }
  r.preview = Object.fromEntries(Object.entries(pv).map(([k, p]) => [k, {...p, svg: undefined}]));
  r.export = {defaultOk: ex.ok, defaultError: ex.ok ? undefined : ex, baseRegistryOk: exBase.ok, baseRegistryError: exBase.ok ? undefined : {error: exBase.error, message: exBase.message}, diagnostics: ex.diagnostics};
  if (inv) {
    const tfs = inv.typefaces;
    r.export.inventory = {distinctTypefaces: [...new Set(tfs.map(t => t.typeface))], byPartKind: Object.entries(tfs.reduce((a, t) => { const k = `${t.part.replace(/\d+/g, 'N')}|${t.tag}|${t.typeface}`; a[k] = (a[k] ?? 0) + 1; return a; }, {})).map(([k, n]) => k + ' x' + n),
      themeMajor: inv.theme?.major, themeMinor: inv.theme?.minor, themeClr: inv.theme?.clr, scriptFontEntries: inv.scriptFonts, langs: inv.langs, altLangs: inv.altLangs, rtlCount: inv.rtl, appFonts: inv.appFonts, xlsxFontNames: inv.xlsxFontNames, slideSrgb: inv.slideSrgb, slideBg: inv.slideBg};
  }
  // re-import retention
  const rd = reimport?.doc;
  r.reimport = reimport ? {ok: reimport.ok, error: reimport.error, designKeys: reimport.designKeys, topKeys: reimport.top, diagnostics: reimport.diagnostics} : null;

  // dimension-specific measurements
  const m = {};
  if (dim === 'color-schemes' || dim === 'themes' || dim === 'audiences') {
    const schemeId = design.colorScheme ?? byId('themes', design.theme)?.colorScheme;
    const scheme = byId('colorSchemes', schemeId);
    m.colorScheme = schemeId;
    m.previewSchemeColorsUsed = pv.none.ok ? schemeColorsUsed(pv.none.svgHexes, scheme) : null;
    m.exportSchemeColorsInSlides = inv ? schemeColorsUsed(inv.slideSrgb, scheme) : null;
    m.exportThemeClrScheme = inv ? clrSchemeMatch(inv.theme?.clr, scheme) : null;
    m.previewVsExportColorDiff = (m.previewSchemeColorsUsed && m.exportSchemeColorsInSlides) ? {previewOnly: m.previewSchemeColorsUsed.filter(x => !m.exportSchemeColorsInSlides.includes(x)), exportOnly: m.exportSchemeColorsInSlides.filter(x => !m.previewSchemeColorsUsed.includes(x))} : null;
    m.reimportColorScheme = rd?.design?.colorScheme ?? null;
  }
  if (dim.startsWith('font-schemes') || dim === 'themes' || dim === 'languages') {
    const fsId = design.fontScheme ?? byId('themes', design.theme)?.fontScheme;
    const rec = byId('fontSchemes', fsId) ?? doc.catalogs?.fontSchemes?.records?.find(x => x.id === fsId);
    const fam = fontRecordFamilies(rec);
    m.fontScheme = fsId; m.expected = fam;
    m.availability = fam ? {heading: familyAvailability(fam.heading), body: familyAvailability(fam.body)} : null;
    m.previewFonts = pv.none.ok ? pv.none.fonts : null;
    m.previewSvgFamilies = pv.none.ok ? pv.none.svgFamilies : null;
    m.previewBase = pv.base.ok ? {ok: true, fonts: pv.base.fonts} : {ok: false, error: pv.base.error, family: pv.base.details?.fontFamily};
    m.previewOfficeVisual = pv.officeVisual.ok ? {ok: true, fonts: pv.officeVisual.fonts, substitutions: pv.officeVisual.substitutions} : {ok: false, error: pv.officeVisual.error, family: pv.officeVisual.details?.fontFamily};
    if (inv && fam) {
      const chosen = new Set([fam.heading, fam.body, pv.none.ok ? pv.none.fonts?.code : 'Roboto Mono']);
      const explicit = inv.typefaces.filter(t => !t.typeface.startsWith('+'));
      m.exportThemeMajorLatin = inv.theme?.major?.[0]; m.exportThemeMinorLatin = inv.theme?.minor?.[0];
      m.exportThemeEaCs = {major: inv.theme?.major?.slice(1), minor: inv.theme?.minor?.slice(1)};
      m.exportRunTypefaces = [...new Set(inv.typefaces.filter(t => /slides\/slide\d/.test(t.part)).map(t => t.typeface))];
      m.foreignTypefaces = [...new Set(explicit.filter(t => t.typeface && !chosen.has(t.typeface)).map(t => `${t.typeface}@${t.part.replace(/\d+/g, 'N')}:${t.tag}`))];
      m.emptyTypefaceSlots = explicit.filter(t => t.typeface === '').length;
      m.appXmlFonts = inv.appFonts;
      m.majorMatches = inv.theme?.major?.[0] === fam.heading; m.minorMatches = inv.theme?.minor?.[0] === fam.body;
      m.previewVsExportFontDiff = pv.none.ok ? {previewHeading: pv.none.fonts?.heading, exportMajor: inv.theme?.major?.[0], previewBody: pv.none.fonts?.body, exportMinor: inv.theme?.minor?.[0], agree: pv.none.fonts?.heading === inv.theme?.major?.[0] && pv.none.fonts?.body === inv.theme?.minor?.[0]} : null;
    }
    m.reimportFontScheme = rd?.design?.fontScheme ?? null;
    { const eo = await doExport(doc, "office-visual"); const io = eo.ok ? inventory(eo.bytes) : null; m.exportWithOfficeVisualRegistry = eo.ok ? {major: io.theme?.major?.[0], minor: io.theme?.minor?.[0], runFaces: [...new Set(io.typefaces.filter(t => /slides\/slide\d/.test(t.part)).map(t => t.typeface))]} : {error: eo.error}; }
    // Non-Latin textSample glyph probe for the scheme itself.
    if (rec?.textSample && rec.languageFamily && rec.languageFamily !== 'latin') {
      const probe = structuredClone(doc); probe.slides = [{...probe.slides[0], title: rec.textSample}];
      const pb = doRender(probe, 'base'), po = doRender(probe, 'office-visual'), pn = doRender(probe, 'none');
      m.textSampleProbe = {sample: rec.textSample, none: pn.ok ? 'ok' : pn.error, base: pb.ok ? 'ok' : `${pb.error}:${pb.details?.fontFamily ?? ''}`, officeVisual: po.ok ? 'ok' : `${po.error}:${po.details?.fontFamily ?? ''}`};
    }
  }
  if (dim === 'themes') {
    const th = byId('themes', design.theme);
    const scheme = byId('colorSchemes', th?.colorScheme);
    const slot = typeof th?.background === 'string' ? th.background : th?.background?.slot;
    m.themeRecord = th ? {colorScheme: th.colorScheme, fontScheme: th.fontScheme, background: th.background, dimensions: th.dimensions} : null;
    m.galleryBackgroundSlot = design.background?.slot; m.catalogBackgroundSlot = slot;
    m.expectedBgHex = norm(scheme?.[design.background?.slot ?? slot]);
    m.exportSlideBg = inv?.slideBg; m.previewBgPresent = pv.none.ok ? pv.none.svgHexes.includes(m.expectedBgHex) : null;
    const bgRect = s => (s.match(/<rect fill="#([0-9A-Fa-f]{6})" height="\d+" opacity="1" width="\d+" x="0" y="0"\/>/) ?? [])[1]?.toUpperCase() ?? null;
    m.previewSvgBackground = pv.none.ok ? bgRect(pv.none.svg) : null; m.previewBgMatchesExport = m.previewSvgBackground === (inv?.slideBg?.[0] ?? null);
    // theme-only (no explicit color/font) to check the bundle is applied by engines themselves
    const bare = structuredClone(doc); delete bare.design.colorScheme; delete bare.design.fontScheme; delete bare.design.background;
    const bp = doRender(bare, 'none'); const be = await doExport(bare, 'none'); const bi = be.ok ? inventory(be.bytes) : null;
    m.themeOnly = {previewFonts: bp.ok ? bp.fonts : bp.error, previewBackground: bp.ok ? bgRect(bp.svg) : null, exportMajor: bi?.theme?.major?.[0], exportMinor: bi?.theme?.minor?.[0], exportBg: bi?.slideBg, previewSchemeColorsUsed: bp.ok ? schemeColorsUsed(bp.svgHexes, scheme) : null, exportSchemeColors: bi ? schemeColorsUsed(bi.slideSrgb, scheme) : null, themeClr: bi ? clrSchemeMatch(bi.theme?.clr, scheme) : null};
    m.reimportTheme = rd?.design?.theme ?? null; m.reimportDimensions = rd?.design?.dimensions ?? null;
  }
  // consumption diff: remove the dimension field and compare preview SVG + PPTX parts
  const stripKeys = {narratives: ['narrative'], audiences: ['audience'], tones: ['tone'], languages: ['language', 'catalogs.languages'], socials: ['organization', 'speaker', 'catalogs.socialPlatforms']}[dim];
  if (stripKeys) {
    const ctrl = strip(doc, stripKeys);
    const pc = doRender(ctrl, 'none'); const ec = await doExport(ctrl, 'none');
    m.consumption = {stripped: stripKeys, previewIdentical: pv.none.ok && pc.ok ? pv.none.svg === pc.svg : null, exportIdentical: ex.ok && ec.ok ? partsEqual(partsMap(ex.bytes), partsMap(ec.bytes)) : null};
    if (dim === 'socials' && ex.ok) { const z = unzipSync(ex.bytes); const all = Object.entries(z).filter(([n]) => n.endsWith('.xml')).map(([, d]) => dec.decode(d)).join(''); m.handleInExport = all.includes(doc.speaker?.socials?.[s.id] ?? '@@'); m.handleInPreview = pv.none.ok ? pv.none.svg.includes(doc.speaker?.socials?.[s.id] ?? '@@') : null; m.reimportSocials = {organization: rd?.organization?.socials ?? null, speaker: rd?.speaker?.socials ?? null}; }
    if (dim === 'narratives') m.reimportValue = rd?.narrative ?? null;
    if (dim === 'tones') m.reimportValue = rd?.tone ?? null;
    if (dim === 'audiences') m.reimportValue = rd?.audience ?? null;
  }
  if (dim === 'languages') {
    const lang = byId('languages', doc.language);
    m.bcp47 = lang?.bcp47; m.exportLangs = inv?.langs; m.exportRtl = inv?.rtl;
    m.langEmitted = inv ? inv.langs.includes(lang?.bcp47) || inv.langs.some(l => l.toLowerCase().startsWith((lang?.bcp47 ?? '#').toLowerCase())) : null;
    m.reimportLanguage = rd?.language ?? null;
    // Engine-side application: language alone (no gallery-injected design.fontScheme) - do fonts change vs no language?
    const langOnly = strip(doc, ['design.fontScheme']); const noLang = strip(langOnly, ['language', 'catalogs.languages']);
    const a = doRender(langOnly, 'none'), b = doRender(noLang, 'none');
    m.engineAppliesLanguageFontScheme = a.ok && b.ok ? JSON.stringify(a.fonts) !== JSON.stringify(b.fonts) : `${a.error ?? ''}/${b.error ?? ''}`;
    // native-script glyph probe with gallery native name as title
    const native = nativeNames[s.id];
    if (native) {
      const probe = structuredClone(doc); probe.slides = [{...probe.slides[0], title: native}];
      const pn = doRender(probe, 'none'), pb = doRender(probe, 'base'), po = doRender(probe, 'office-visual');
      const pe = await doExport(probe, 'none'); const pi = pe.ok ? inventory(pe.bytes) : null;
      const nonAscii = /[^\u0000-\u024F\u1E00-\u1EFF]/.test(native);
      m.nativeProbe = {text: native, nonLatinScript: nonAscii, none: pn.ok ? 'ok' : pn.error, base: pb.ok ? 'ok' : `${pb.error}:${pb.details?.fontFamily ?? ''}`, officeVisual: po.ok ? 'ok' : `${po.error}:${po.details?.fontFamily ?? ''}`,
        // Same native text on the only fully bundled scheme (Roboto) and on the record's googleFontScheme, strict base pack:
        robotoBase: (() => { const q = structuredClone(probe); q.design = {...(q.design ?? {}), fontScheme: 'roboto'}; const x = doRender(q, 'base'); return x.ok ? 'ok' : `${x.error}:${x.details?.fontFamily ?? ''}:${x.details?.character ? 'U+' + x.details.character.codePointAt(0).toString(16).toUpperCase() : ''}`; })(),
        googleSchemeBase: lang?.googleFontScheme ? (() => { const q = structuredClone(probe); q.design = {...(q.design ?? {}), fontScheme: lang.googleFontScheme}; const x = doRender(q, 'base'); return `${lang.googleFontScheme}:` + (x.ok ? 'ok' : `${x.error}:${x.details?.fontFamily ?? ''}`); })() : null,
        exportOk: pe.ok, exportLangs: pi?.langs, exportRunFaces: pi ? [...new Set(pi.typefaces.filter(t => /slides\/slide\d/.test(t.part)).map(t => `${t.tag}:${t.typeface}`))] : null, exportRtl: pi?.rtl};
    }
  }
  r.measure = m;
  results.push(r);
  process.stdout.write('.');
}
await writeFile(`${OUT}/raw-results.json`, JSON.stringify(results, null, 1));
console.log(`\n${results.length} values measured`);
