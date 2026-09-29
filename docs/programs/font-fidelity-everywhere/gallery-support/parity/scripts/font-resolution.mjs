// fontResolution classifier (FF-38), pure and unit-tested (font-resolution.test.mjs). No I/O.
//
// Owner decision, 2026-09-29 (verbatim):
//   "look-alike fonts are to get around any font licensing restrictions. They are desirable for open source but if
//   we export to PowerPoint the pptx file should include references to the font they selected and want to see in
//   PowerPoint."
// Owner refinement, 2026-09-29, later message (verbatim):
//   "if the user wants Aptos... if Aptos is license restricted we can substitute a font (Aptos2 or whatever it's
//   named) that looks similar and has the same size in pixels on the screen for rendering live previews of SVG.
//   When we export to PPTX we should have PowerPoint open that file and display actual Aptos."
//
// For every family the SELECTED design uses, the value's fontResolution check is:
//   pass  the PPTX references the selected family name, and the preview renders with the real face (an open,
//         bundled family, or a caller-supplied real face) or with the FF-31 policy table's METRIC-COMPATIBLE
//         replacement for that family.
//   near  the PPTX references the selected family name, and the preview renders with the policy table's route for
//         that family, but only at the visual look-alike tier (the replacement, or a listed alternate, is not
//         metric-compatible, so layout is not guaranteed to match). Reported as
//         "visual-only replacement (no metric-compatible open font for <family>)".
//   fail  the family has no row in the policy table; or the preview has no face for it; or the preview uses a face
//         that is not the table's route for it (an unexpected host/system/generic fallback); or the PPTX writes a
//         replacement name instead of the selected name, or does not name the selected family.
// The metric-compatible or visual tier is always reported (`tier`, `policyTier`, `route`); it gates only through the
// pass/near split above. Nothing else in the harness (other checks, tolerances) depends on this module.

const WEIGHT_NAMES = /^(thin|hairline|extralight|ultralight|light|semilight|regular|book|medium|semibold|demibold|bold|extrabold|ultrabold|heavy|black)(\s+italic)?$/i;
const lc = s => String(s ?? '').trim().toLowerCase();

/** True when the resolved face family is `candidate` itself or one of its weight-named faces ("Roboto SemiBold"). */
export function sameFamilyGroup(resolved, candidate) {
  const r = lc(resolved), c = lc(candidate);
  if (!r || !c) return false;
  if (r === c) return true;
  return r.startsWith(c + ' ') && WEIGHT_NAMES.test(r.slice(c.length + 1));
}

/** The old (pre-decision) statuses, kept so a run can report both definitions. */
export function legacyStatus(preview) {
  if (!preview?.ok) return 'missing';
  const c = preview.compatibility;
  return c === 'exact' ? 'real' : c === 'metric' ? 'metric-substitute' : c === 'generic' ? 'missing' : 'visual-substitute';
}
/** Old definition: pass only for the real face or a metric-compatible substitute. */
export const legacyPasses = preview => ['real', 'metric-substitute'].includes(legacyStatus(preview));

/**
 * Classify one selected family.
 * @param {object} a
 * @param {string} a.family selected family name (as the design, the preview runs and the PPTX name it)
 * @param {object|undefined} a.policyRow FF-31 row from core `fontPolicyFor(family)`, or undefined
 * @param {{ok:boolean, compatibility?:string, resolvedFamily?:string, code?:string}} a.preview registry resolution of
 *        the family in the preview font configuration (ok:false when the registry has no face)
 * @param {{named:boolean, slot?:string, replacementNames?:string[]}} a.pptx named: the PPTX references `family` in
 *        the relevant theme/run slot(s); slot: where it was expected; replacementNames: replacement or alternate names
 *        of this family the PPTX writes (and that are not themselves selected families)
 * @param {string[]} [a.bundledIn] font packs that bundle this family (detail only)
 * @returns {{verdict:'pass'|'near'|'fail', tier:string|null, route:string|null, policyTier:string|null,
 *            licenseClass:string|null, resolved:string|null, legacy:string, reasons:{status:string,reason:string}[]}}
 */
export function classifyFontResolution({family, policyRow, preview, pptx, bundledIn = []}) {
  const out = {verdict: 'pass', tier: null, route: null, policyTier: null, licenseClass: policyRow?.licenseClass ?? null,
    resolved: preview?.ok ? preview.resolvedFamily : null, legacy: legacyStatus(preview), reasons: []};
  const add = (status, reason) => out.reasons.push({status, reason});
  const candidates = policyRow?.replacement ? [policyRow.replacement.family, ...(policyRow.alternates ?? [])] : [];

  // (b) preview face
  if (!policyRow) {
    add('fail', `no route in the FF-31 font policy table: ${family}${preview?.ok ? ` (preview uses ${preview.resolvedFamily})` : ''}`);
  } else if (!preview?.ok) {
    const where = bundledIn.length ? `; bundled in the ${bundledIn.join(', ')} pack, not loaded in this preview` : '';
    add('fail', policyRow.licenseClass === 'open' && !policyRow.replacement
      ? `preview has no face for open family ${family}${where}`
      : `preview has no face for ${family}; policy route ${candidates.length ? candidates.join(' | ') : 'none'} is not loaded${where}`);
  } else if (preview.compatibility === 'generic') {
    add('fail', `preview uses an unexpected fallback face for ${family}: ${preview.resolvedFamily} (not the policy route)`);
  } else if (lc(preview.resolvedFamily) === lc(family)) {
    // The real face: an open bundled family, or a caller-supplied face of a licensed family.
    out.tier = 'real'; out.route = 'real'; out.policyTier = policyRow.licenseClass === 'open' ? 'open' : 'real-face';
  } else {
    const primary = policyRow.replacement?.family, alt = policyRow.alternates ?? [];
    if (primary && sameFamilyGroup(preview.resolvedFamily, primary)) { out.route = 'replacement'; out.policyTier = policyRow.replacement.compatibility; }
    else if (alt.some(a => sameFamilyGroup(preview.resolvedFamily, a))) { out.route = 'alternate'; out.policyTier = 'visual'; }
    if (!out.route) {
      add('fail', `preview face is not the policy route for ${family}: ${preview.resolvedFamily} (route: ${candidates.length ? candidates.join(' | ') : 'none, the family renders as itself'})`);
    } else {
      // Metric only when the table says metric for this route and the registry confirms it for this style/weight.
      out.tier = out.policyTier === 'metric' && preview.compatibility === 'metric' ? 'metric' : 'visual';
      if (out.tier === 'visual') add('near', `visual-only replacement (no metric-compatible open font for ${family}): ${family} -> ${preview.resolvedFamily}${out.route === 'alternate' ? ' (listed alternate)' : ''}`);
    }
  }

  // (a) PPTX references the selected family, never the replacement
  if (pptx && pptx.named === false) add('fail', `PPTX does not name the selected family ${family} in ${pptx.slot ?? 'the theme/run slots'}`);
  for (const r of pptx?.replacementNames ?? []) add('fail', `PPTX writes replacement name ${r} instead of the selected family ${family}`);

  out.verdict = out.reasons.some(r => r.status === 'fail') ? 'fail' : out.reasons.some(r => r.status === 'near') ? 'near' : 'pass';
  return out;
}
