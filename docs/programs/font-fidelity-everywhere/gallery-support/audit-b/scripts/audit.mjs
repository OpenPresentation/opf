// Dimension audit B: measure every gallery value (color schemes, font schemes, languages, themes,
// narratives, audiences, tones, socials, and the gallery charts) through core validate -> catalog -> opf-render preview ->
// opf-pptx export (typeface/lang/clrScheme inventory) -> fromPptx re-import.
// Run: node --import <audit-B-opf>/scripts/register-local-opf.mjs audit.mjs   (after gen-snippets.mjs)
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createFontHosts, FONT_HOST_MODELS} from '../../parity/scripts/font-host.mjs';
import {classifyChosenFamilies, firstFamily, hostRenderOutcome, slotsByFamily, svgTextRuns} from '../../parity/scripts/font-availability.mjs';
import {chartexExpectations, chartIdFromLayouts, chartexPreviewMarks, chartexDataMismatches, parseChartex} from '../../parity/scripts/chartex.mjs';

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
const {fontPolicyFor, resolveScriptFonts} = await imp(`${core}/index.js`);
const req = createRequire(`${SRC}/audit-B-opf-pptx/package.json`);
const {unzipSync} = req('fflate');

const snippets = JSON.parse(await readFile(`${OUT}/snippets.json`, 'utf8'));
const nativeNamesSrc = await readFile(`${process.env.GALLERY_DIR ?? '<workspace>/pptx-gallery'}/lib/language-native-names.ts`, 'utf8');
const nativeNames = Object.fromEntries([...nativeNamesSrc.matchAll(/^\s*"([^"]+)":\s*"([^"]*)",?$/gm)].map(m => [m[1], m[2]]));

const recs = kind => Array.isArray(C[kind]) ? C[kind] : (C.catalogs?.[kind] ?? []);
const byId = (kind, id) => recs(kind).find(r => r.id === id) ?? null;
// FF-56: the chartex constructs the catalog records (mappings.openxml element and extension) and the cx layoutIds that follow from them.
const CX_EXPECT = chartexExpectations(recs('chartTypes'));
const bundledFamilies = new Set(BUNDLED_FONT_MANIFEST.packages.flatMap(p => p.faces.map(f => f.family)));
const basePackFamilies = new Set(BUNDLED_FONT_MANIFEST.packages.filter(p => p.pack === 'base').flatMap(p => p.faces.map(f => f.family)));

// Preview font host (FF-48). The presence audits classify font availability against the host that ships, as the parity harness does
// (parity/scripts/font-host.mjs, README "Preview font host (FF-38, 2026-09-30): the gallery model"): the gallery editor's browser registry
// and font gate (ensureLazyFonts + ensureScripts on the value's own document, the same package files), then the owner font policy
// (font-resolution.mjs): the preview draws the policy table's replacement and the PPTX writes the selected family is `works`.
// AUDIT_FONT_HOST selects the model: gallery (default), node-auto, office-only (the parity harness's models) or strict (diagnostic:
// classify against the strict no-host previews measured below, the pre-FF-48 behaviour). Every strict measurement is recorded in every
// mode; the host measurement is taken with the modelled host (gallery when strict is asked for).
const FONT_HOST = process.env.AUDIT_FONT_HOST ?? 'gallery';
if (FONT_HOST !== 'strict' && !FONT_HOST_MODELS.includes(FONT_HOST)) throw new Error(`AUDIT_FONT_HOST must be one of ${[...FONT_HOST_MODELS, 'strict'].join(', ')}, not ${FONT_HOST}`);
const HOST_MODEL = FONT_HOST === 'strict' ? 'gallery' : FONT_HOST;
const fontHosts = await createFontHosts({renderDir: `${SRC}/audit-B-opf-render`, model: HOST_MODEL});
const bundledIn = family => [...new Set(BUNDLED_FONT_MANIFEST.packages.filter(p => p.faces.some(f => f.family.toLowerCase() === family.toLowerCase())).map(p => p.pack))];

const base = await prepareNodeFonts({pack: 'base'});
const officeVisual = await prepareNodeFonts({pack: 'office', substitutionPolicy: 'visual'});

const dec = new TextDecoder();
const hexes = s => new Set([...s.matchAll(/#([0-9a-fA-F]{6})\b/g)].map(m => m[1].toUpperCase()));
// Font slot for a text sample, as parity.mjs scriptOf: East Asian (ea), complex script (cs) or latin.
const scriptOf = t => /[\u3000-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF\u3040-\u30FF]/u.test(t) ? 'ea' : /[\u0590-\u08FF\u0900-\u0DFF\u0E00-\u0EFF\u1000-\u109F\u10A0-\u10FF\u1200-\u137F\u1780-\u17FF]/u.test(t) ? 'cs' : 'latin';
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
      diagnostics: diagnostics.map(d => d.code ?? d.message), svg: all, svgs};
  } catch (e) {
    return {ok: false, error: e.code ?? e.name, message: String(e.message).slice(0, 200), details: e.details ? {fontFamily: e.details.fontFamily, character: e.details.character} : undefined, diagnostics: diagnostics.map(d => d.code)};
  }
}

// Colour references in slide XML (FF-24). a:srgbClr is literal; a:schemeClr resolves through the slide's colour map
// (see slideChain) to the clrScheme slot of the theme that the slide's master references. A colour with child transforms
// (lumMod, lumOff, tint, shade, alpha, ...) is recorded as unresolved: the audit does not compute transforms, so such
// a use can never count as agreeing with the preview. phClr, sysClr, prstClr, scrgbClr and hslClr are unresolved too.
const COLOR_RE = /<a:(srgbClr|schemeClr|sysClr|prstClr|scrgbClr|hslClr)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/a:\1>)/g;
const DEFAULT_CLRMAP = {bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2', accent1: 'accent1', accent2: 'accent2', accent3: 'accent3', accent4: 'accent4', accent5: 'accent5', accent6: 'accent6', hlink: 'hlink', folHlink: 'folHlink'};
const clrMapOf = s => s ? Object.fromEntries([...s.matchAll(/(\w+)="(\w+)"/g)].map(m => [m[1], m[2]])) : null;
function colorUses(xml, themeClr, clrMap) {
  const out = [];
  for (const m of xml.matchAll(COLOR_RE)) {
    const kind = m[1], val = (m[2].match(/\bval="([^"]*)"/) ?? [])[1] ?? null, transforms = [...(m[3] ?? '').matchAll(/<a:(\w+)\b/g)].map(x => x[1]);
    const u = {kind, val, transforms, hex: null, via: kind === 'srgbClr' ? 'srgb' : kind === 'schemeClr' ? `scheme:${val}` : kind};
    if (kind === 'srgbClr' && /^[0-9A-Fa-f]{6}$/.test(val ?? '')) u.hex = val.toUpperCase();
    if (kind === 'schemeClr') { u.slot = val in DEFAULT_CLRMAP ? clrMap[val] ?? null : ['dk1', 'lt1', 'dk2', 'lt2'].includes(val) ? val : null; u.hex = u.slot ? themeClr?.[u.slot] ?? null : null; }
    u.resolved = !!u.hex && transforms.length === 0;
    out.push(u);
  }
  return out;
}
function bgColor(bgXml, themeClr, clrMap) {
  if (/<p:bgRef\b/.test(bgXml)) return {kind: 'bgRef', hex: null};
  const fill = bgXml.match(/<p:bgPr>\s*<a:(solidFill|gradFill|blipFill|pattFill|noFill)\b/)?.[1] ?? 'other';
  if (fill !== 'solidFill') return {kind: fill, hex: null};
  const u = colorUses(bgXml, themeClr, clrMap)[0];
  return {kind: 'solid', via: u?.via ?? null, transforms: u?.transforms ?? [], hex: u?.resolved ? u.hex : null};
}

function themeInfo(xml) {
  const t = {};
  for (const m of xml.matchAll(/<a:(dk1|lt1|dk2|lt2|accent[1-6]|hlink|folHlink)>(.*?)<\/a:\1>/g)) t[m[1]] = (m[2].match(/(?:val|lastClr)="([0-9A-Fa-f]{6})"/g) ?? []).map(v => v.slice(-7, -1).toUpperCase()).pop();
  const maj = xml.match(/<a:majorFont><a:latin typeface="([^"]*)"[^>]*\/><a:ea typeface="([^"]*)"\/><a:cs typeface="([^"]*)"/);
  const min = xml.match(/<a:minorFont><a:latin typeface="([^"]*)"[^>]*\/><a:ea typeface="([^"]*)"\/><a:cs typeface="([^"]*)"/);
  return {clr: t, major: maj?.slice(1), minor: min?.slice(1)};
}
// Relationship targets of one part for one relationship type (last segment of Type), resolved per OPC.
function relTargets(zip, part, type) {
  const r = zip[part.replace(/([^/]+)$/, '_rels/$1.rels')]; if (!r) return [];
  return [...dec.decode(r).matchAll(/<Relationship\b([^>]*)\/?>/g)].map(m => Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map(x => [x[1], x[2]])))
    .filter(a => a.Type?.split('/').pop() === type && a.TargetMode !== 'External')
    .map(a => a.Target.startsWith('/') ? path.posix.normalize(a.Target.slice(1)) : path.posix.normalize(path.posix.join(path.posix.dirname(part), a.Target)));
}
// One slide's colour chain: slide -> layout -> master -> theme through relationships. The effective colour map is the
// innermost override (slide clrMapOvr, then layout clrMapOvr, then the master p:clrMap). Every unresolved link is an
// issue; nothing falls back to master 1, theme 1 or a default map.
function slideChain(zip, slidePart) {
  const issues = [], xmlOf = p => zip[p] ? dec.decode(zip[p]) : null;
  const one = (from, type) => {
    const t = relTargets(zip, from, type);
    if (t.length !== 1) { issues.push(`${slidePart}: ${from} has ${t.length} ${type} relationships`); return null; }
    if (!zip[t[0]]) { issues.push(`${slidePart}: ${type} part ${t[0]} is missing`); return null; }
    return t[0];
  };
  const override = (from) => {
    const o = xmlOf(from)?.match(/<p:clrMapOvr>([\s\S]*?)<\/p:clrMapOvr>/)?.[1];
    if (!o || /<a:masterClrMapping\s*\/>/.test(o)) return null;
    const m = o.match(/<a:overrideClrMapping\b([^>]*)\/>/)?.[1];
    if (!m) { issues.push(`${slidePart}: unreadable clrMapOvr in ${from}`); return null; }
    return clrMapOf(m);
  };
  const layoutPart = one(slidePart, 'slideLayout'), masterPart = layoutPart && one(layoutPart, 'slideMaster'), themePart = masterPart && one(masterPart, 'theme');
  const slideOverride = override(slidePart), layoutOverride = layoutPart ? override(layoutPart) : null;
  const masterMap = masterPart ? clrMapOf(xmlOf(masterPart).match(/<p:clrMap\b([^>]*)\/>/)?.[1]) : null;
  if (masterPart && !masterMap) issues.push(`${slidePart}: master ${masterPart} has no p:clrMap`);
  const clrMap = slideOverride ?? layoutOverride ?? masterMap;
  const themeClr = themePart ? themeInfo(xmlOf(themePart)).clr : null;
  return {layoutPart, masterPart, themePart, slideOverride: !!slideOverride, layoutOverride: !!layoutOverride, clrMap, themeClr, issues};
}

function inventory(bytes) {
  const out = {typefaces: [], scriptFonts: 0, scriptFontNames: new Set(), langs: new Set(), altLangs: new Set(), rtl: 0, xlsxFontNames: [], appFonts: [], theme: null, slideSrgb: new Set(), slideBg: [], slideColorUses: [], slideParts: [], slideLangs: new Set(), slideRtl: 0};
  const zip = unzipSync(bytes);
  // Colour chain per slide (slideChain). Theme fonts and clrScheme are read from the theme the slides reach.
  const slideParts = Object.keys(zip).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);
  const chains = slideParts.map(part => slideChain(zip, part));
  out.chainIssues = chains.flatMap(c => c.issues);
  out.themeParts = [...new Set(chains.map(c => c.themePart).filter(Boolean))];
  out.masterParts = [...new Set(chains.map(c => c.masterPart).filter(Boolean))];
  if (!slideParts.length) out.chainIssues.push('no slide parts');
  if (out.themeParts.length > 1) out.chainIssues.push(`slides reach ${out.themeParts.length} themes (${out.themeParts.join(', ')}); theme font and clrScheme checks read only ${out.themeParts[0]}`);
  out.clrMap = {masters: out.masterParts.length, layoutOverrides: chains.filter(c => c.layoutOverride).length, slideOverrides: chains.filter(c => c.slideOverride).length};
  if (out.themeParts[0]) out.theme = themeInfo(dec.decode(zip[out.themeParts[0]]));
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
    }
  };
  walk(zip, '');
  slideParts.forEach((part, i) => {
    const xml = dec.decode(zip[part]), c = chains[i], map = c.clrMap ?? {};
    for (const m of xml.matchAll(/srgbClr val="([0-9A-Fa-f]{6})"/g)) out.slideSrgb.add(m[1].toUpperCase());
    const bg = xml.match(/<p:bg>(.*?)<\/p:bg>/s);
    const b = bg ? bgColor(bg[1], c.themeClr, map) : null;
    out.slideBg.push(b ? b.hex ?? (b.kind === 'solid' ? (b.transforms.length ? 'transformed' : 'unresolved') : 'non-solid') : 'none');
    for (const u of colorUses(xml, c.themeClr, map)) out.slideColorUses.push({part, ...u});
    out.slideParts.push(part);
    for (const m of xml.matchAll(/<a:(?:rPr|endParaRPr|defRPr)\b[^>]*\blang="([^"]*)"/g)) out.slideLangs.add(m[1]);
    out.slideRtl += (xml.match(/<a:pPr\b[^>]*\brtl="1"/g) ?? []).length;
  });
  return {...out, scriptFontNames: [...out.scriptFontNames].length, langs: [...out.langs], altLangs: [...out.altLangs], slideSrgb: [...out.slideSrgb], slideLangs: [...out.slideLangs]};
}
// Summary of slide colour uses: resolved hexes (literal or scheme, no transforms) and the uses that stay unresolved.
function colorSummary(uses) {
  const n = k => uses.filter(k).length;
  return {total: uses.length, literal: n(u => u.kind === 'srgbClr'), scheme: n(u => u.kind === 'schemeClr'),
    transformed: [...new Set(uses.filter(u => u.transforms.length).map(u => `${u.via}+${u.transforms.join('+')}`))],
    unresolved: [...new Set(uses.filter(u => !u.transforms.length && !u.hex).map(u => u.via))],
    resolvedHexes: [...new Set(uses.filter(u => u.resolved).map(u => u.hex))]};
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

// FF-48: what the modelled host does with a value. `render` is the strict measured render with the host registry after its font gate;
// `families` the FF-38 fontResolution verdict per family the design selects (the PPTX must name it, the preview must draw it or its
// policy-table route); `reasons` the failing or near verdicts, verbatim from the classifier.
async function hostMeasure(doc, pvNone, inv) {
  const host = await fontHosts.hostFor(doc), fonts = pvNone.fonts ?? {};
  const chosenFamilies = new Set(Object.values(fonts).filter(Boolean).map(firstFamily));
  const roles = Object.fromEntries(Object.entries(fonts).filter(([, v]) => v).map(([k, v]) => [k, firstFamily(v)]));
  const th = inv.theme, slot = a => ({latin: a?.[0], ea: a?.[1], cs: a?.[2]});
  const theme = {major: slot(th?.major), minor: slot(th?.minor)};
  const previewSlots = slotsByFamily(svgTextRuns(pvNone.svg));
  // The names the slides write per script slot; a run without its own ea or cs typeface takes its Latin name, and inherits the theme font of its slot.
  const slideFaces = tag => new Set(inv.typefaces.filter(t => /slides\/slide\d/.test(t.part) && t.tag === tag && t.typeface).map(t => t.typeface));
  const pptxNamesBySlot = {latin: slideFaces('latin'), ea: slideFaces('ea'), cs: slideFaces('cs')};
  for (const k of ['ea', 'cs']) if (!pptxNamesBySlot[k].size) for (const n of pptxNamesBySlot.latin) pptxNamesBySlot[k].add(n);
  for (const k of ['latin', 'ea', 'cs']) for (const t of [theme.major, theme.minor]) if (t[k]) pptxNamesBySlot[k].add(t[k]);
  const packageNames = new Set([...inv.typefaces.map(t => t.typeface), ...inv.appFonts].filter(Boolean).map(x => x.toLowerCase()));
  const c = classifyChosenFamilies({host, chosenFamilies, roles, theme, previewSlots, pptxNamesBySlot, packageNames, fontPolicyFor, bundledIn});
  return {model: HOST_MODEL, gate: host.gate, render: hostRenderOutcome(host, render, doc), selection: host.selection ? {scripts: host.selection.scripts, packages: host.selection.packages} : null, families: c.fontRes, reasons: c.reasons};
}
// The host's verdict on a probe document (a non-Latin text sample or a language's native name): its font gate finished and the strict measured render does not throw.
async function hostProbe(probeDoc) { return hostRenderOutcome(await fontHosts.hostFor(probeDoc), render, probeDoc); }

function strip(doc, keys) { const d = structuredClone(doc); for (const k of keys) { const [a, b] = k.split('.'); if (b) { if (d[a]) { delete d[a][b]; if (!Object.keys(d[a]).length) delete d[a]; } } else delete d[k]; } return d; }

// ---- Charts (FF-36, 2026-09-30) ----------------------------------------------------------------------------------
// The presence probe for the gallery chart snippets. Preview: the traced SVG has a chart group whose data-opf-chart is
// the chart id (opf-render draws the catalog construct; otherwise it keeps the legacy single-series sketch, or
// "No chart data") and the marks match the data. Export: the slide's chart part uses the construct the core catalog
// records in mappings.openxml, with the data in its caches. Re-import: fromPptx returns the same chart id and data.
const CHART_ELEMENTS = ['barChart', 'bar3DChart', 'lineChart', 'line3DChart', 'pieChart', 'pie3DChart', 'ofPieChart', 'doughnutChart', 'areaChart', 'area3DChart', 'scatterChart', 'radarChart'];
const CHART_KIND = {barChart: 'bar', lineChart: 'line', areaChart: 'area', pieChart: 'circular', doughnutChart: 'circular', scatterChart: 'scatter', radarChart: 'radar'};
const svgAttrs = s => Object.fromEntries([...s.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
// The markup of the <g> that starts at `start` (balanced).
function balancedGroup(svg, start) {
  let depth = 0;
  for (const m of svg.slice(start).matchAll(/<(\/?)g\b[^>]*?(\/?)>/g)) {
    if (m[1]) depth--; else if (!m[2]) depth++;
    if (depth === 0) return svg.slice(start, start + m.index + m[0].length);
  }
  return svg.slice(start);
}
const chartCells = (rows, col) => rows.map(r => Array.isArray(r) ? r[col] : undefined);
const chartNum = v => typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
// Series columns of an inline chart: [Category, S1, S2...]; a scatter with more than two columns is [Label, X, Y1, Y2...].
function chartSeriesColumns(kind, columns) { const first = kind === 'scatter' && columns.length > 2 ? 2 : 1; return columns.slice(first).map((name, i) => ({name, column: first + i})); }

function chartExpected(record, chart) {
  const ox = record?.mappings?.openxml ?? {};
  const kind = CHART_KIND[ox.element] ?? null;
  const columns = chart?.data?.columns ?? [], rows = chart?.data?.rows ?? [];
  const series = chartSeriesColumns(kind, columns);
  const style = ox.radarStyle;
  const markers = ox.marker === true || style === 'marker';
  const grouping = ox.grouping ?? (['bar', 'line', 'area'].includes(kind) ? 'standard' : undefined);
  return {element: ox.element ?? null, extension: ox.extension ?? null, chartex: record ? CX_EXPECT.get(record.id) ?? null : null, composition: ox.composition ?? null, kind, barDir: ox.barDir, grouping, markers, radarStyle: style, scatterStyle: ox.scatterStyle, rows: rows.length, series: series.length, seriesColumns: series};
}

function chartPreviewProbe(doc, chart, exp) {
  const diagnostics = [];
  let svg;
  try { svg = render.renderSvgDeck(structuredClone(doc), {trace: true, onDiagnostic: d => diagnostics.push(d.code ?? d.message)}).join('\n'); }
  catch (e) { return {ok: false, error: e.code ?? e.name, message: String(e.message).slice(0, 200)}; }
  const open = svg.match(/<g\b[^>]*\bdata-opf-chart="([^"]*)"[^>]*>/);
  const noChartData = /No chart data/.test(svg);
  const out = {ok: true, chartAttr: open?.[1] ?? null, noChartData, legacy: !open, diagnostics};
  if (!open) {
    out.legacyBars = [...svg.matchAll(/data-opf-path="[^"]*\.chart\.data\.rows\.\d+"/g)].length;
    return out;
  }
  const grp = balancedGroup(svg, open.index);
  const marks = [...grp.matchAll(/<(rect|circle|polyline|path|line|ellipse)\b([^>]*?)\/?>/g)].map(m => ({tag: m[1], ...svgAttrs(m[2])}));
  const pathOf = m => m['data-opf-path'] ?? '';
  const rowsRe = /\.data\.rows\.(\d+)\.(\d+)$/, colsRe = /\.data\.columns\.(\d+)$/;
  const rows = chart.data.rows, n = rows.length;
  let actual = null, expected = null;
  const k = exp.kind;
  if (k === 'bar') { expected = {marks: n * exp.series}; actual = {marks: marks.filter(m => m.tag === 'rect' && rowsRe.test(pathOf(m)) && +pathOf(m).match(rowsRe)[2] >= 1).length}; }
  else if (k === 'line') {
    expected = {lines: exp.series, markers: exp.markers ? n * exp.series : 0};
    actual = {lines: marks.filter(m => m.tag === 'polyline' && (m.points ?? '').trim().split(/\s+/).length === n).length, markers: marks.filter(m => m.tag === 'circle' && rowsRe.test(pathOf(m))).length};
  } else if (k === 'area') { expected = {areas: exp.series}; actual = {areas: marks.filter(m => m.tag === 'path' && colsRe.test(pathOf(m)) && /^M[\s\S]*Z$/.test((m.d ?? '').trim())).length}; }
  else if (k === 'circular') {
    const positive = chartCells(rows, 1).filter(v => (chartNum(v) ?? 0) !== 0).length;
    expected = {slices: positive}; actual = {slices: marks.filter(m => (m.tag === 'path' || m.tag === 'circle') && /\.data\.rows\.\d+\.1$/.test(pathOf(m))).length};
  } else if (k === 'scatter') {
    const numericX = chart.data.columns.length > 2;
    const pts = exp.seriesColumns.reduce((sum, s) => sum + rows.filter(r => (!numericX || chartNum(r[1]) !== null) && chartNum(r[s.column]) !== null).length, 0);
    expected = {points: pts}; actual = {points: marks.filter(m => m.tag === 'circle' && rowsRe.test(pathOf(m))).length};
  } else if (k === 'radar') {
    expected = {series: exp.series, markers: exp.markers ? n * exp.series : 0};
    actual = {series: marks.filter(m => m.tag === 'path' && colsRe.test(pathOf(m))).length, markers: marks.filter(m => m.tag === 'circle' && rowsRe.test(pathOf(m))).length};
  }
  if (exp.chartex) {
    // FF-56: real mark checks for a chartex preview (treemap tiles, histogram bins, Pareto bars and line, box and outliers, waterfall and funnel bars).
    const cm = chartexPreviewMarks(chart.type, rows, marks);
    out.marks = {kind: `chartex:${chart.type}`, expected: cm.checks.map(c => [c.name, c.expected]), actual: cm.checks.map(c => [c.name, c.actual]), equal: cm.ok, failed: cm.checks.filter(c => !c.ok).map(c => c.name)};
    return out;
  }
  out.marks = {kind: k, expected, actual, equal: JSON.stringify(expected) === JSON.stringify(actual)};
  return out;
}

async function chartExportProbe(doc, bytes, exp, chart) {
  const diagnostics = [];
  await toPptx(structuredClone(doc), {onDiagnostic: d => diagnostics.push({code: d.code, adaptation: d.adaptation ?? null})});
  const zip = unzipSync(bytes);
  const chartParts = relTargets(zip, 'ppt/slides/slide1.xml', 'chart');
  const out = {adaptations: diagnostics.filter(d => d.code === 'chart-data-adapted').map(d => d.adaptation), diagnostics: [...new Set(diagnostics.map(d => d.code))], chartParts, embeddedWorkbooks: Object.keys(zip).filter(n => /^ppt\/embeddings\/.+\.xlsx$/i.test(n)).length};
  // FF-56: a chartex construct is an mc:AlternateContent whose Choice references a cx:chartSpace (relationship type chartEx) and whose Fallback is a
  // classic clustered column. A consumer that understands chartex (PowerPoint 2016+, fromPptx) uses the Choice, so it is the part that is read.
  const chartExParts = relTargets(zip, 'ppt/slides/slide1.xml', 'chartEx');
  out.chartExParts = chartExParts;
  if (exp.chartex && chartExParts.length === 1 && zip[chartExParts[0]]) {
    const part = parseChartex(dec.decode(zip[chartExParts[0]]));
    const id = chartIdFromLayouts(CX_EXPECT, part.layouts);
    const matches = id === chart.type;
    out.chartex = {part: chartExParts[0], layouts: part.layouts, id, fallbackParts: chartParts.length};
    out.construct = {element: matches ? exp.chartex.element : (id ? CX_EXPECT.get(id).element : `chartex ${part.layouts.join('+')}`), extension: matches ? exp.chartex.extension : null, chartex: true};
    out.series = part.series.length;
    out.data = [{name: part.series[0]?.name ?? null, categories: part.categories, values: part.values}];
    out.dataMismatches = chartexDataMismatches(chart.type, exp.chartex, part, chart.data.rows);
    return out;
  }
  if (chartParts.length !== 1 || !zip[chartParts[0]]) return out;
  const xml = dec.decode(zip[chartParts[0]]);
  const elements = CHART_ELEMENTS.filter(e => xml.includes(`<c:${e}>`));
  out.elements = elements;
  const el = elements[0];
  const body = el ? xml.slice(xml.indexOf(`<c:${el}>`), xml.indexOf(`</c:${el}>`)) : '';
  const val = re => body.match(re)?.[1] ?? null;
  const sers = [...body.matchAll(/<c:ser>([\s\S]*?)<\/c:ser>/g)].map(m => m[1]);
  const symbols = sers.map(s => s.match(/<c:marker>\s*<c:symbol val="(\w+)"/)?.[1] ?? null);
  const pts = (blk, tag) => { const b = blk.match(new RegExp(`<c:${tag}>([\\s\\S]*?)</c:${tag}>`))?.[1] ?? ''; return [...b.matchAll(/<c:pt idx="(\d+)">\s*<c:v>([^<]*)<\/c:v>/g)].map(m => m[2]); };
  out.construct = {element: el ?? null, barDir: val(/<c:barDir val="(\w+)"/), grouping: val(/<c:grouping val="(\w+)"/), radarStyle: val(/<c:radarStyle val="(\w+)"/), scatterStyle: val(/<c:scatterStyle val="(\w+)"/), seriesSymbols: symbols, markers: symbols.length > 0 && symbols.every(s => s && s !== 'none')};
  out.series = sers.length;
  const isXy = el === 'scatterChart';
  out.data = sers.map(s => ({name: pts(s, 'tx')[0] ?? null, categories: isXy ? pts(s, 'xVal') : pts(s, 'cat'), values: pts(s, isXy ? 'yVal' : 'val').map(Number)}));
  // Source data against the caches: the values of every series (an XY chart also its X values) and, for category charts, the labels.
  const rows = chart.data.rows, mismatches = [];
  const circular = el === 'pieChart' || el === 'doughnutChart';
  const want = circular ? exp.seriesColumns.slice(0, 1) : exp.seriesColumns;
  if (sers.length !== want.length) mismatches.push(`${sers.length} series in the chart, ${want.length} in the data`);
  out.data.forEach((d, i) => {
    const src = want[i]; if (!src) return;
    if (JSON.stringify(chartCells(rows, src.column).map(chartNum)) !== JSON.stringify(d.values)) mismatches.push(`series ${i + 1} values differ from column ${src.column}`);
    if (!isXy) { if (JSON.stringify(chartCells(rows, 0).map(String)) !== JSON.stringify(d.categories)) mismatches.push(`series ${i + 1} category labels differ from the first column`); }
    else if (JSON.stringify(chartCells(rows, 1).map(chartNum)) !== JSON.stringify(d.categories.map(Number))) mismatches.push(`series ${i + 1} X values differ from column 1`);
  });
  out.dataMismatches = mismatches;
  return out;
}

function chartReimportProbe(rd, chart, exp) {
  const blocks = (rd?.slides ?? []).flatMap(s => s.blocks ?? []).filter(b => b.type === 'chart');
  const c = blocks[0]?.chart;
  const out = {charts: blocks.length, type: c?.type ?? null};
  if (!c) return out;
  const rows = chart.data.rows, got = c.data?.rows ?? [], mismatches = [];
  if (got.length !== rows.length) mismatches.push(`${got.length} rows, expected ${rows.length}`);
  else {
    for (const s of exp.seriesColumns) {
      if (JSON.stringify(chartCells(rows, s.column).map(chartNum)) !== JSON.stringify(chartCells(got, s.column).map(chartNum))) { mismatches.push(`column ${s.column} values differ`); break; }
    }
    if (exp.kind === 'scatter') { if (JSON.stringify(chartCells(rows, 1).map(chartNum)) !== JSON.stringify(chartCells(got, 1).map(chartNum))) mismatches.push('X values differ'); }
    else if (JSON.stringify(chartCells(rows, 0).map(String)) !== JSON.stringify(chartCells(got, 0).map(String))) mismatches.push('category labels differ');
  }
  out.dataMismatches = mismatches;
  return out;
}

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
  if (dim === 'charts') { cat.kind = 'chartTypes'; cat.value = doc.slides?.[0]?.chart?.type; cat.record = byId('chartTypes', cat.value); }
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
  r.preview = Object.fromEntries(Object.entries(pv).map(([k, p]) => [k, {...p, svg: undefined, svgs: undefined}]));
  r.export = {defaultOk: ex.ok, defaultError: ex.ok ? undefined : ex, baseRegistryOk: exBase.ok, baseRegistryError: exBase.ok ? undefined : {error: exBase.error, message: exBase.message}, diagnostics: ex.diagnostics};
  if (inv) {
    const tfs = inv.typefaces;
    r.export.inventory = {distinctTypefaces: [...new Set(tfs.map(t => t.typeface))], byPartKind: Object.entries(tfs.reduce((a, t) => { const k = `${t.part.replace(/\d+/g, 'N')}|${t.tag}|${t.typeface}`; a[k] = (a[k] ?? 0) + 1; return a; }, {})).map(([k, n]) => k + ' x' + n),
      themeMajor: inv.theme?.major, themeMinor: inv.theme?.minor, themeClr: inv.theme?.clr, scriptFontEntries: inv.scriptFonts, langs: inv.langs, altLangs: inv.altLangs, rtlCount: inv.rtl, appFonts: inv.appFonts, xlsxFontNames: inv.xlsxFontNames, slideSrgb: inv.slideSrgb, slideBg: inv.slideBg, themeParts: inv.themeParts, masterParts: inv.masterParts, chainIssues: inv.chainIssues};
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
    // Export slide colours: literal srgbClr plus schemeClr resolved through the exported theme clrScheme (FF-24).
    const cs = inv ? colorSummary(inv.slideColorUses) : null;
    m.exportColorUses = cs ? {total: cs.total, literal: cs.literal, scheme: cs.scheme, transformed: cs.transformed, unresolved: cs.unresolved} : null;
    m.exportSchemeColorsInSlides = cs ? schemeColorsUsed(cs.resolvedHexes, scheme) : null;
    m.exportThemeClrScheme = inv ? clrSchemeMatch(inv.theme?.clr, scheme) : null;
    m.exportClrMap = inv ? {...inv.clrMap, themeParts: inv.themeParts, masterParts: inv.masterParts} : null;
    m.previewVsExportColorDiff = (m.previewSchemeColorsUsed && m.exportSchemeColorsInSlides) ? {previewOnly: m.previewSchemeColorsUsed.filter(x => !m.exportSchemeColorsInSlides.includes(x)), exportOnly: m.exportSchemeColorsInSlides.filter(x => !m.previewSchemeColorsUsed.includes(x))} : null;
    // Slide by slide: the scheme slots each preview slide uses against the resolved colours of the matching slide part,
    // any resolved export colour the preview slide never paints, and the slide background.
    if (inv && pv.none.ok && scheme) {
      const bgRect = s => (s.match(/<rect fill="#([0-9A-Fa-f]{6})" height="\d+" opacity="1" width="\d+" x="0" y="0"\/>/) ?? [])[1]?.toUpperCase() ?? null;
      m.previewSlides = pv.none.svgs.length; m.exportSlides = inv.slideParts.length;
      m.colorBySlide = inv.slideParts.map((part, i) => {
        const svg = pv.none.svgs[i] ?? '', pvHex = hexes(svg), exHex = colorSummary(inv.slideColorUses.filter(u => u.part === part)).resolvedHexes;
        const p = schemeColorsUsed([...pvHex], scheme), e = schemeColorsUsed(exHex, scheme);
        return {slide: i, previewOnly: p.filter(x => !e.includes(x)), exportOnly: e.filter(x => !p.includes(x)), exportHexesNotInPreview: exHex.filter(h => !pvHex.has(h)), previewBg: bgRect(svg), exportBg: inv.slideBg[i] ?? null};
      }).filter(s => s.previewOnly.length || s.exportOnly.length || s.exportHexesNotInPreview.length || s.previewBg !== s.exportBg);
    }
    // A literal srgbClr whose value is a scheme slot colour that the document never writes as a literal "#RRGGBB" is a
    // scheme colour exported as RGB: recolouring the theme in PowerPoint would not follow it (FF-24).
    if (inv && scheme) {
      const slotHex = new Set(Object.keys(SLOT).map(k => norm(scheme[k])).filter(Boolean));
      const docLiterals = new Set([...JSON.stringify(doc).matchAll(/"#([0-9A-Fa-f]{6})"/g)].map(x => x[1].toUpperCase()));
      const slotsOf = h => Object.keys(SLOT).filter(k => norm(scheme[k]) === h).join('/');
      const lit = inv.slideColorUses.filter(u => u.kind === 'srgbClr' && u.hex && slotHex.has(u.hex) && !docLiterals.has(u.hex));
      m.literalSchemeHexes = [...new Set(lit.map(u => `${u.hex}=${slotsOf(u.hex)}`))];
      m.literalSchemeUses = lit.length;
    }
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
      // FF-49: the script font the scheme or language selected for each theme ea/cs slot, '' when nothing was (Office leaves it empty).
      try {
        const r = resolveScriptFonts(doc), pick = (role, key) => r.sources[key] === 'latin' ? '' : r[role][key];
        m.expectedThemeEaCs = {major: [pick('heading', 'eastAsian'), pick('heading', 'complexScript')], minor: [pick('body', 'eastAsian'), pick('body', 'complexScript')]};
      } catch (e) { m.expectedThemeEaCs = null; }
      m.exportRunTypefaces = [...new Set(inv.typefaces.filter(t => /slides\/slide\d/.test(t.part)).map(t => t.typeface))];
      m.foreignTypefaces = [...new Set(explicit.filter(t => t.typeface && !chosen.has(t.typeface)).map(t => `${t.typeface}@${t.part.replace(/\d+/g, 'N')}:${t.tag}`))];
      m.emptyTypefaceSlots = explicit.filter(t => t.typeface === '').length;
      m.appXmlFonts = inv.appFonts;
      m.majorMatches = inv.theme?.major?.[0] === fam.heading; m.minorMatches = inv.theme?.minor?.[0] === fam.body;
      m.previewVsExportFontDiff = pv.none.ok ? {previewHeading: pv.none.fonts?.heading, exportMajor: inv.theme?.major?.[0], previewBody: pv.none.fonts?.body, exportMinor: inv.theme?.minor?.[0], agree: pv.none.fonts?.heading === inv.theme?.major?.[0] && pv.none.fonts?.body === inv.theme?.minor?.[0]} : null;
    }
    m.hostFonts = inv && pv.none.ok ? await hostMeasure(doc, pv.none, inv) : null;
    m.reimportFontScheme = rd?.design?.fontScheme ?? null;
    { const eo = await doExport(doc, "office-visual"); const io = eo.ok ? inventory(eo.bytes) : null; m.exportWithOfficeVisualRegistry = eo.ok ? {major: io.theme?.major?.[0], minor: io.theme?.minor?.[0], runFaces: [...new Set(io.typefaces.filter(t => /slides\/slide\d/.test(t.part)).map(t => t.typeface))]} : {error: eo.error}; }
    // Non-Latin textSample glyph probe for the scheme itself.
    if (rec?.textSample && rec.languageFamily && rec.languageFamily !== 'latin') {
      const probe = structuredClone(doc); probe.slides = [{...probe.slides[0], title: rec.textSample}];
      const pb = doRender(probe, 'base'), po = doRender(probe, 'office-visual'), pn = doRender(probe, 'none');
      m.textSampleProbe = {sample: rec.textSample, host: await hostProbe(probe), none: pn.ok ? 'ok' : pn.error, base: pb.ok ? 'ok' : `${pb.error}:${pb.details?.fontFamily ?? ''}`, officeVisual: po.ok ? 'ok' : `${po.error}:${po.details?.fontFamily ?? ''}`};
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
    m.themeOnly = {previewFonts: bp.ok ? bp.fonts : bp.error, previewBackground: bp.ok ? bgRect(bp.svg) : null, exportMajor: bi?.theme?.major?.[0], exportMinor: bi?.theme?.minor?.[0], exportBg: bi?.slideBg, previewSchemeColorsUsed: bp.ok ? schemeColorsUsed(bp.svgHexes, scheme) : null, exportSchemeColors: bi ? schemeColorsUsed(colorSummary(bi.slideColorUses).resolvedHexes, scheme) : null, themeClr: bi ? clrSchemeMatch(bi.theme?.clr, scheme) : null};
    m.reimportTheme = rd?.design?.theme ?? null; m.reimportDimensions = rd?.design?.dimensions ?? null;
  }
  // consumption diff: remove the dimension field and compare preview SVG + PPTX parts
  const stripKeys = {narratives: ['narrative'], audiences: ['audience'], tones: ['tone'], languages: ['language', 'catalogs.languages'], socials: ['organization', 'speaker', 'catalogs.socialPlatforms']}[dim];
  if (stripKeys) {
    const ctrl = strip(doc, stripKeys);
    const pc = doRender(ctrl, 'none'); const ec = await doExport(ctrl, 'none');
    m.consumption = {stripped: stripKeys, previewIdentical: pv.none.ok && pc.ok ? pv.none.svg === pc.svg : null, exportIdentical: ex.ok && ec.ok ? partsEqual(partsMap(ex.bytes), partsMap(ec.bytes)) : null};
    if (dim === 'socials' && ex.ok) { const z = unzipSync(ex.bytes); const all = Object.entries(z).filter(([n]) => /^ppt\/(slides|slideLayouts|slideMasters)\/[^/]+\.xml$/.test(n)).map(([, d]) => dec.decode(d)).join(''); m.handleInExport = all.includes(doc.speaker?.socials?.[s.id] ?? '@@'); m.handleInPreview = pv.none.ok ? pv.none.svg.includes(doc.speaker?.socials?.[s.id] ?? '@@') : null; m.reimportSocials = {organization: rd?.organization?.socials ?? null, speaker: rd?.speaker?.socials ?? null}; }
    if (dim === 'narratives') m.reimportValue = rd?.narrative ?? null;
    if (dim === 'tones') m.reimportValue = rd?.tone ?? null;
    if (dim === 'audiences') m.reimportValue = rd?.audience ?? null;
  }
  if (dim === 'languages') {
    const lang = byId('languages', doc.language);
    m.bcp47 = lang?.bcp47; m.exportLangs = inv?.langs; m.exportRtl = inv?.rtl;
    m.langEmitted = inv ? inv.langs.includes(lang?.bcp47) || inv.langs.some(l => l.toLowerCase().startsWith((lang?.bcp47 ?? '#').toLowerCase())) : null;
    // Catalog expectations (ooxmlLang, script, direction) and what the slides actually carry.
    m.catalogLanguage = lang ? {ooxmlLang: lang.ooxmlLang ?? null, script: lang.script ?? null, direction: lang.direction ?? null} : null;
    m.exportSlideLangs = inv?.slideLangs ?? null; m.exportSlideRtlParagraphs = inv?.slideRtl ?? null;
    m.reimportLanguage = rd?.language ?? null;
    // Preview: the SVG lang attribute and any right-to-left rendering. The consumption diff above says whether
    // removing the field changes the preview at all; here we record whether the only change is the lang attribute.
    if (pv.none.ok) {
      const svg = pv.none.svg;
      m.previewLangAttrs = [...new Set([...svg.matchAll(/<svg\b[^>]*?\blang="([^"]*)"/g)].map(x => x[1]))];
      m.previewRtl = (svg.match(/\bdirection="rtl"|direction:\s*rtl|unicode-bidi/g) ?? []).length;
      const ctrl = strip(doc, ['language', 'catalogs.languages']); const pc = doRender(ctrl, 'none');
      const dropLang = s => s.replace(/ (?:xml:)?lang="[^"]*"/g, '');
      m.previewChangeIsLangAttributeOnly = pc.ok ? dropLang(svg) === dropLang(pc.svg) && svg !== pc.svg : null;
    }
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
      m.nativeProbe = {text: native, nonLatinScript: nonAscii, host: await hostProbe(probe), none: pn.ok ? 'ok' : pn.error, base: pb.ok ? 'ok' : `${pb.error}:${pb.details?.fontFamily ?? ''}`, officeVisual: po.ok ? 'ok' : `${po.error}:${po.details?.fontFamily ?? ''}`,
        // Same native text on the only fully bundled scheme (Roboto) and on the record's googleFontScheme, strict base pack:
        robotoBase: (() => { const q = structuredClone(probe); q.design = {...(q.design ?? {}), fontScheme: 'roboto'}; const x = doRender(q, 'base'); return x.ok ? 'ok' : `${x.error}:${x.details?.fontFamily ?? ''}:${x.details?.character ? 'U+' + x.details.character.codePointAt(0).toString(16).toUpperCase() : ''}`; })(),
        googleSchemeBase: lang?.googleFontScheme ? (() => { const q = structuredClone(probe); q.design = {...(q.design ?? {}), fontScheme: lang.googleFontScheme}; const x = doRender(q, 'base'); return `${lang.googleFontScheme}:` + (x.ok ? 'ok' : `${x.error}:${x.details?.fontFamily ?? ''}`); })() : null,
        exportOk: pe.ok, exportLangs: pi?.langs, exportRunFaces: pi ? [...new Set(pi.typefaces.filter(t => /slides\/slide\d/.test(t.part)).map(t => `${t.tag}:${t.typeface}`))] : null, exportRtl: pi?.rtl,
        exportSlideLangs: pi?.slideLangs, exportSlideRtlParagraphs: pi?.slideRtl,
        // Preview lines the renderer marks right-to-left (RLI/RLE/RLO isolate or embedding controls, or an explicit direction).
        previewRtlLines: pn.ok ? [...pn.svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].filter(t => /[\u2067\u202B\u202E]/.test(t[1]) || /direction="rtl"/.test(t[0])).length : null,
        // The run font slot the native text uses (same script test as parity.mjs) and the faces the slides name in it.
        scriptSlot: scriptOf(native), slotFaces: pi ? [...new Set(pi.typefaces.filter(t => /slides\/slide\d/.test(t.part) && t.tag === scriptOf(native)).map(t => t.typeface))] : null};
    }
  }
  if (dim === 'charts') {
    const chart = doc.slides?.[0]?.chart;
    const rec = cat.record;
    // A deprecated chart type does not count as resolving: the gallery must publish only kept catalog ids.
    r.catalogResolves = !!rec && !rec.deprecation;
    r.catalog.record = rec ? {id: rec.id, deprecated: !!rec.deprecation, openxml: rec.mappings?.openxml ?? null} : null;
    const exp = chartExpected(rec, chart);
    m.expected = exp; m.snippetChart = {type: chart?.type, columns: chart?.data?.columns?.length, rows: chart?.data?.rows?.length, slides: doc.slides?.length};
    m.preview = chart?.data ? chartPreviewProbe(doc, chart, exp) : null;
    m.export = ex.ok && chart?.data ? await chartExportProbe(doc, ex.bytes, exp, chart) : null;
    m.reimport = rd && chart?.data ? chartReimportProbe(rd, chart, exp) : null;
  }
  r.measure = m;
  results.push(r);
  process.stdout.write('.');
}
await writeFile(`${OUT}/raw-results.json`, JSON.stringify(results, null, 1));
console.log(`\n${results.length} values measured`);
