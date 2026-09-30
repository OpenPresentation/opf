// Font availability against a modelled preview host (FF-38, FF-48). Shared by the parity harness (parity.mjs) and the presence audits
// (audit A and audit B), so all three ask the same question of the same host model (font-host.mjs, PARITY_FONT_HOST / AUDIT_FONT_HOST,
// default `gallery`) and apply the same owner font policy (font-resolution.mjs). Pure apart from the calls it is handed: no I/O.
//
// Owner font policy (2026-09-29): a look-alike or metric replacement is for open-source previews; the PPTX names the family the user
// selected and PowerPoint draws the real font. So "the preview draws the policy table's replacement and the export writes the selected
// family" is correct (works, or `near` in the parity tiers for a visual-only route). It is a gap only when the host cannot draw the
// value at all, the family has no policy route, the preview draws an unrouted fallback, or the export names a replacement.
import {classifyFontResolution, exportedFaceWeight, legacyPasses, pptxNaming} from './font-resolution.mjs';

const unesc = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, '&');
export const firstFamily = f => String(f ?? '').split(',')[0].trim().replace(/^["']|["']$/g, '');
/** The font slot a character is drawn in (as the parity text check picks it): East Asian (ea), complex script (cs) or latin. */
export const scriptOf = t => /[　-鿿가-힯豈-﫿＀-￯぀-ヿ]/u.test(t) ? 'ea' : /[֐-ࣿऀ-෿฀-໿က-႟Ⴀ-ჿሀ-፿ក-៿]/u.test(t) ? 'cs' : 'latin';

/** Registry resolution of a family in the modelled host, cached on the host. `compatibility` and `resolvedFamily` come from the registry. */
export function resolveFamily(host, family, weight = 400, italic = false) {
  const k = `${family}|${weight}|${italic}`; if (host.resolutions.has(k)) return host.resolutions.get(k);
  let v; try { const r = host.registry.resolveFont({fontFamily: family, fontWeight: weight, italic}); v = {ok: true, compatibility: r.compatibility, resolvedFamily: r.resolvedFamily, requestedWeight: r.requestedWeight ?? weight, resolvedWeight: r.resolvedWeight ?? weight}; }
  catch (e) { v = {ok: false, code: e.code}; }
  host.resolutions.set(k, v); return v;
}

/**
 * The family as the document draws it: with face-level lazy loading (opf-render 0.11.5, FF-41) a host holds only the faces the document draws,
 * so the verdict is that of every drawn face of the family (host.drawn: lower-case family -> [{weight, italic}]). Every face must resolve; the
 * weakest compatibility (exact, metric, visual, generic, in that order) and the first resolved family are reported. A family with no drawn face (or a
 * host that does not track faces) is resolved at Regular, as before: through `host.unloaded` (a registry holding every vendored face) when the host
 * tracks faces, because the editor would load that face the moment an edit draws text in the family.
 *
 * FF-60, weights the exporter cannot write: toPptx sets bold only from weight 600 and names the same family, so PowerPoint draws Regular for
 * 500 and Bold for 600 and 800. A drawn face whose registry compatibility is weaker than metric only because the requested weight is not one
 * the metric claim covers (Aptos 500, 600, 800 against Intos, which ships 400 and 700) counts at the compatibility of the face the export
 * selects, when the preview draws exactly that face: the same resolved family and weight as the exported weight resolves to. Nothing else
 * changes: no width tolerance is touched, a route whose own tier is visual stays visual, and the raw registry value is kept as
 * `rawCompatibility` (the legacy definition reads it).
 */
const TIER = {exact: 0, metric: 1, visual: 2, generic: 3};
/** The resolution of a drawn face at the compatibility of the face toPptx selects for it (FF-60), or `r` itself. */
export function asExportedFace(host, family, face, r) {
  if ((TIER[r.compatibility] ?? 3) <= TIER.metric || r.compatibility === 'generic') return r;
  const weight = exportedFaceWeight(face.weight);
  if (weight === face.weight) return r;
  const e = resolveFamily(host, family, weight, face.italic);
  if (!e.ok || (TIER[e.compatibility] ?? 3) > TIER.metric) return r;
  if (e.resolvedFamily !== r.resolvedFamily || e.resolvedWeight !== r.resolvedWeight) return r;
  return {...r, compatibility: e.compatibility, rawCompatibility: r.compatibility, exportedWeight: weight};
}
export function resolveDrawnFamily(host, family) {
  const faces = host.drawn?.get(String(family).toLowerCase());
  if (!faces?.length) return host.unloaded && host.drawn ? resolveFamily(host.unloaded, family) : resolveFamily(host, family);
  let worst = null, rawWorst = null;
  for (const f of faces) {
    const raw = resolveFamily(host, family, f.weight, f.italic);
    if (!raw.ok) return raw;
    const r = asExportedFace(host, family, f, raw);
    if (!worst || (TIER[r.compatibility] ?? 3) > (TIER[worst.compatibility] ?? 3)) worst = r;
    if (!rawWorst || (TIER[raw.compatibility] ?? 3) > (TIER[rawWorst] ?? 3)) rawWorst = raw.compatibility;
  }
  // The legacy definition reads the weakest raw registry value over all drawn faces.
  return rawWorst === worst.compatibility ? worst : {...worst, rawCompatibility: rawWorst};
}

/**
 * The host must draw the value: its font gate finished, and the strict measured render with the host registry (what the editor's gate
 * hands the canvas) does not throw. A resolved family is not enough when the face cannot measure or shape its text (font-shaping-failed),
 * lacks a glyph the text needs (missing-glyph) or a family the value names still has no face (font-unavailable).
 * @param {{gate:{ok:boolean, code?:string, message?:string}, options:object}} host from font-host.mjs hostFor
 * @param {{renderSvgDeck:Function}} render the opf-render module that built the host
 * @returns {{ok:true}|{ok:false, code:string, family:string|null, cause:string}}
 */
export function hostRenderOutcome(host, render, doc) {
  if (!host.gate.ok) return {ok: false, code: host.gate.code, family: null, cause: host.gate.message};
  try { render.renderSvgDeck(structuredClone(doc), {...host.options}); return {ok: true}; }
  catch (e) { return {ok: false, code: e.code ?? e.name, family: e.details?.fontFamily ?? null, cause: String(e.details?.cause ?? e.message).slice(0, 120)}; }
}
/** The one-line reason for a host render that failed. */
export const hostRenderReason = o => `the modelled host cannot draw this value: ${o.code}${o.family ? ' (' + o.family + ')' : ''}, ${o.cause}`;

/**
 * Per family the selected design uses: the FF-38 fontResolution verdict for a preview drawn by `host` and a PPTX that names `theme` and
 * `pptxNamesBySlot`. Returns the per-family records, the reasons (status `fail` or `near`) and the old-definition reasons.
 * @param {object} a
 * @param {{registry:object, resolutions:Map}} a.host
 * @param {Set<string>} a.chosenFamilies every family the resolved design names (heading, body, code, ...)
 * @param {Record<string,string>} a.roles design role to family
 * @param {{major:object, minor:object}} a.theme the exported theme's fonts by slot ({latin, ea, cs})
 * @param {Map<string,Set<string>>} a.previewSlots per family, the script slots its drawn text uses
 * @param {{latin:Set<string>,ea:Set<string>,cs:Set<string>}} a.pptxNamesBySlot
 * @param {Set<string>} a.packageNames lower-case typeface names anywhere in the package (theme, runs, app.xml)
 * @param {(family:string)=>object|undefined} a.fontPolicyFor core's FF-31 lookup
 * @param {(family:string)=>string[]} a.bundledIn font packs that bundle a family
 */
export function classifyChosenFamilies({host, chosenFamilies, roles, theme, previewSlots, pptxNamesBySlot, packageNames, fontPolicyFor, bundledIn}) {
  const fontRes = {}, reasons = [], legacyFontReasons = [];
  for (const f of chosenFamilies) {
    if (!f) continue;
    const policyRow = fontPolicyFor(f), preview = resolveDrawnFamily(host, f);
    const {named, slot} = pptxNaming({family: f, roles, theme, slotsUsed: previewSlots.get(f) ?? new Set(), pptxNamesBySlot});
    const routeNames = policyRow?.replacement ? [policyRow.replacement.family, ...(policyRow.alternates ?? [])] : [];
    const replacementNames = routeNames.filter(r => r.toLowerCase() !== f.toLowerCase() && !chosenFamilies.has(r) && packageNames.has(r.toLowerCase()));
    const cls = classifyFontResolution({family: f, policyRow, preview, pptx: {named, slot, replacementNames}, bundledIn: preview.ok ? [] : [...new Set([f, ...routeNames].flatMap(bundledIn))]});
    fontRes[f] = {status: cls.legacy, resolved: cls.resolved, verdict: cls.verdict, tier: cls.tier, route: cls.route, policyTier: cls.policyTier, licenseClass: cls.licenseClass, ...(preview.ok ? {} : {error: preview.code}), pptx: {named, ...(slot ? {slot} : {}), slotsUsed: [...(previewSlots.get(f) ?? [])].sort(), replacementNames}};
    for (const r of cls.reasons) reasons.push({status: r.status, reason: r.reason, family: f});
    if (!legacyPasses(preview)) legacyFontReasons.push(`preview font ${cls.legacy}: ${f}${cls.resolved ? ' -> ' + cls.resolved : ''}`);
  }
  return {fontRes, reasons, legacyFontReasons};
}

/** The text runs of a traced or plain preview SVG, as {family, text} (attributes inherit from the enclosing text or tspan). */
export function svgTextRuns(svg) {
  const runs = [], stack = [];
  for (const m of String(svg).matchAll(/<(\/?)([a-zA-Z][\w:]*)([^>]*?)(\/?)>|([^<]+)/g)) {
    if (m[5] !== undefined) { const top = stack[stack.length - 1]; if (top && top.text) runs.push({family: firstFamily(top.attrs['font-family']), text: unesc(m[5]), hidden: top.attrs['aria-hidden'] === 'true'}); continue; }
    const [, close, tag, raw, self] = m;
    if (close) { if (tag === 'text' || tag === 'tspan') stack.pop(); continue; }
    if (tag !== 'text' && tag !== 'tspan') continue;
    const attrs = {...(stack[stack.length - 1]?.attrs ?? {}), ...Object.fromEntries([...raw.matchAll(/([\w:-]+)="([^"]*)"/g)].map(x => [x[1], unesc(x[2])]))};
    if (!self) stack.push({text: true, attrs});
  }
  return runs.filter(r => r.family && r.text.trim() && !r.hidden);
}
/** Per family, the script slots (latin/ea/cs) the preview text drawn in it uses. */
export function slotsByFamily(runs) {
  const out = new Map();
  for (const r of runs) { const set = out.get(r.family) ?? out.set(r.family, new Set()).get(r.family); for (const c of r.text) set.add(scriptOf(c === ' ' ? r.text : c)); }
  return out;
}
