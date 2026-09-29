import { create } from "fontkit";
import { FONT_COMPATIBILITY, disabledFeaturesFor } from "./font-compatibility.js";
import { openTypeLanguage, scriptFontAliases } from "./script-fonts.js";
import { fontPolicyFor } from "./font-policy.js";
import { BUNDLED_FONT_MANIFEST } from "./font-manifest.js";
export { FONT_COMPATIBILITY, EXPERIMENTAL_FONT_CANDIDATES, disabledFeaturesFor } from "./font-compatibility.js";
export { FONT_POLICY, FONT_POLICY_DECISIONS, FONT_POLICY_SOURCE, fontPolicyFor } from "./font-policy.js";
export { SCRIPT_FONT_FAMILIES, SCRIPT_FONT_REPLACEMENTS, createScriptFonts, createScriptTextMeasurement, designatedFamilies, glyphFallbackFamilies, detectScripts, itemizeScripts, openTypeLanguage, scriptFontAliases, scriptFontRole, scriptOfCharacter, textRole } from "./script-fonts.js";

export class OPFFontError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = "OPFFontError"; this.code = code; this.details = details; }
}
const key = (family, weight, italic) => `${family.toLowerCase()}:${weight}:${!!italic}`;
function base64(data) {
  let binary = "";
  for (let i = 0; i < data.length; i += 32768) binary += String.fromCharCode(...data.subarray(i, i + 32768));
  return btoa(binary);
}
function validFamily(family) {
  if (typeof family !== "string" || !family.trim() || /[\u0000-\u001f"'\\<>;]/.test(family)) throw new OPFFontError("invalid-font-family", "Font family must be a nonempty plain name.");
  return family;
}
// The open families load with the office pack (prepareNodeFonts({pack:"office"})).
const packFor = family => { const pack = BUNDLED_FONT_MANIFEST.packages.find(pkg=>pkg.renamedFrom?.toLowerCase()===family.toLowerCase() || pkg.faces.some(face=>face.family.toLowerCase()===family.toLowerCase()))?.pack; return pack==="open" ? "office" : pack; };
const percent = value => `${(value*100).toFixed(1)}%`;
/** FF-31: say why a family has no face and what the caller can do, from the OPF font policy. */
function unavailableFontError(family, style, policy) {
  const row = fontPolicyFor(family), details = {path:style.path, fontFamily:family, substitutionPolicy:policy};
  const hook = `supply licensed '${family}' font files (prepareNodeFonts({faces}) or createFontRegistry entries)`;
  if (!row) return new OPFFontError("font-unavailable", `No local font face for '${family}'. '${family}' is not in the OPF font policy table, so there is no declared replacement: ${hook}, add an alias, or set fallbackFamily.`, {...details, licenseClass:"unknown"});
  Object.assign(details, {licenseClass:row.licenseClass});
  if (!row.replacement) {
    const pack = packFor(family);
    return new OPFFontError("font-unavailable", `No local font face for '${family}'. '${family}' is ${row.licenseClass === "open" ? `openly licensed (${row.license})` : row.license}${pack ? `; load the '${pack}' font pack` : `; no pinned renderer pack ships it yet, so supply its font files (for example from @expo-google-fonts/${family.toLowerCase().replace(/ +/g,"-")})`}.`, {...details, ...(pack?{pack}:{})});
  }
  const {family:replacement, compatibility, measured} = row.replacement;
  const candidates = [replacement, ...(row.alternates ?? [])], packs = [...new Set(candidates.map(packFor).filter(Boolean))];
  Object.assign(details, {replacement, replacementCompatibility:compatibility, candidates, ...(packs.length?{packs}:{}), ...(measured?{measured}:{}), ...(row.replacement.decision?{decision:row.replacement.decision}:{})});
  const delta = measured ? ` (measured mean width difference ${percent(measured.meanAbsWidthDelta)}, max ${percent(measured.maxAbsWidthDelta)})` : " (not measured against the real font)";
  const owner = `'${family}' is ${row.license} and OPF never bundles or embeds it.`;
  if (compatibility === "visual" && policy !== "visual")
    return new OPFFontError("font-unavailable", `No local font face for '${family}'. ${owner} Its declared replacement ${replacement} is visual only${delta}, which substitutionPolicy '${policy}' does not allow. Pass substitutionPolicy: 'visual' to preview with ${candidates.join(" or ")}, or ${hook}. The PPTX names '${family}' either way.`, details);
  if (policy === "none")
    return new OPFFontError("font-unavailable", `No local font face for '${family}'. ${owner} Its declared ${compatibility} replacement is ${replacement}${delta}; substitutionPolicy 'none' does not allow it. Pass substitutionPolicy: '${compatibility}', or ${hook}.`, details);
  return new OPFFontError("font-unavailable", `No local font face for '${family}'. ${owner} None of its replacements (${candidates.join(", ")}) is loaded${packs.length ? `; load the ${packs.map(pack=>"'"+pack+"'").join(" or ")} font pack` : ""}, or ${hook}.`, details);
}
/** Local font files only. The caller explicitly chooses aliases and fallback. */
export function createFontRegistry(entries, options = {}) {
  if (!Array.isArray(entries) || !entries.length) throw new OPFFontError("empty-font-registry", "Supply at least one font file.");
  const makeFace = entry => {
    if (!(entry.data instanceof Uint8Array)) throw new OPFFontError("invalid-font-data", "Font data must be a Uint8Array.");
    const data = entry.data.slice();
    let font;
    try { font = create(data, entry.postscriptName); } catch (error) { throw new OPFFontError("invalid-font-data", error.message); }
    if (!font?.layout || !font.unitsPerEm) throw new OPFFontError("font-collection", "Select one font from a collection with postscriptName.");
    const family = validFamily(entry.family ?? font.familyName);
    // OpenType groups Medium/SemiBold/ExtraBold under a preferred family, while
    // retaining separate legacy families for four-style native font selectors.
    // An explicit caller rename owns its namespace and must not add this alias.
    const familyGroup = entry.family && entry.family.toLowerCase() !== font.familyName?.toLowerCase()
      ? family : validFamily(font.getName?.('preferredFamily', 'en') ?? family);
    const linking = font['OS/2']?.fsSelection ?? font.head?.macStyle;
    const fontFace = linking && typeof linking.bold === 'boolean' && typeof linking.italic === 'boolean'
      ? {family:validFamily(font.getName?.('fontFamily', 'en') ?? font.familyName ?? family),bold:linking.bold,italic:linking.italic} : undefined;
    const weight = entry.weight ?? 400;
    const italic = entry.italic ?? !!font.italicAngle;
    if (!Number.isInteger(weight) || weight < 1 || weight > 1000) throw new OPFFontError("invalid-font-weight", "Font weight must be between 1 and 1000.");
    const signature = String.fromCharCode(...data.subarray(0,4));
    const format = signature === "OTTO" ? "otf" : signature === "wOFF" ? "woff" : signature === "wOF2" ? "woff2" : "ttf";
    // Script replacement faces (FF-19) declare the ISO 15924 scripts they serve.
    const scripts = Array.isArray(entry.scripts) && entry.scripts.length ? Object.freeze(entry.scripts.map(String)) : undefined;
    // "used": a bundled face is embedded in an SVG only when the slide's text names its family.
    if (entry.embed !== undefined && entry.embed !== "always" && entry.embed !== "used") throw new OPFFontError("invalid-font-embed", "Font embed must be 'always' or 'used'.");
    // A fallback-only face (the default Noto Sans) serves glyph fallback and explicit requests by its own name,
    // but never stands in for another family, so loading it does not change what any other font previews with.
    return {family,familyGroup,fontFace,weight,italic,font,data,format,license:entry.license,embed:entry.embed,scripts,fallbackOnly:entry.fallbackOnly===true,cache:new Map()};
  };
  const faces = [], duplicates = new Set(), familySlots = new Map();
  // Adds faces atomically: every check runs before any face is registered.
  const register = added => {
    const ids = new Set(duplicates), slots = new Map(familySlots);
    for (const face of added) {
      const id = key(face.family,face.weight,face.italic);
      if (ids.has(id)) throw new OPFFontError("duplicate-font-face", `Duplicate face: ${id}`);
      ids.add(id);
    }
    for (const face of added) for (const family of new Set([face.family,face.familyGroup])) {
      const id=key(family,face.weight,face.italic),previous=slots.get(id);
      if(previous && previous!==face) throw new OPFFontError('ambiguous-font-face', `Multiple physical faces match '${family}' at weight ${face.weight}.`, {fontFamily:family,fontWeight:face.weight,italic:face.italic});
      slots.set(id,face);
    }
    faces.push(...added);
    for (const id of ids) duplicates.add(id);
    for (const [id,face] of slots) familySlots.set(id,face);
  };
  register(entries.map(makeFace));
  const substitutions = new Map();
  // Loaded script replacement faces stand in for the proprietary script fonts
  // they replace (Meiryo -> Noto Sans JP). Caller aliases take precedence.
  let aliases = new Map();
  const buildAliases = () => {
    const scriptAliases = scriptFontAliases(new Set(faces.filter(face=>face.scripts&&!face.fallbackOnly).map(face=>face.family)));
    aliases = new Map(Object.entries({...scriptAliases,...options.aliases}).map(([from,to])=>[validFamily(from).toLowerCase(),validFamily(to)]));
  };
  buildAliases();
  const policy = options.substitutionPolicy ?? "none";
  if (!["none","metric","visual"].includes(policy)) throw new OPFFontError("invalid-font-policy", "substitutionPolicy must be none, metric, or visual.");
  if (options.fallbackFamily) validFamily(options.fallbackFamily);
  const findFamily = family => faces.filter(face=>face.family.toLowerCase()===family.toLowerCase() || face.familyGroup.toLowerCase()===family.toLowerCase());
  const resolve = style => {
    const requested = validFamily(style?.fontFamily);
    const weight = style.fontWeight ?? 400;
    if (!Number.isFinite(weight) || weight < 1 || weight > 1000) throw new OPFFontError("invalid-font-weight", "Font weight must be between 1 and 1000.");
    // DrawingML theme tokens are resolved before family lookup, never as literal fonts.
    const themeKey = {"+mj-lt":"majorLatin","+mn-lt":"minorLatin","+mj-ea":"majorEastAsia","+mn-ea":"minorEastAsia","+mj-cs":"majorComplexScript","+mn-cs":"minorComplexScript"}[requested.toLowerCase()];
    if (requested.startsWith("+") && !themeKey) throw new OPFFontError("unresolved-theme-font", `Unknown theme font '${requested}'.`, {path:style.path});
    const family = themeKey ? options.themeFonts?.[themeKey] : requested;
    if (!family || family.startsWith("+")) throw new OPFFontError("unresolved-theme-font", `Supply a concrete theme family for '${requested}'.`, {path:style.path});
    validFamily(family);
    let matching = findFamily(family), compatibility = "exact", rule, targetWeight = weight, styleFallback = false, via = "family";
    const encodedSymbol = /^(wingdings(?: [23])?|webdings|symbol)$/i.test(family);
    if (!matching.length && encodedSymbol) throw new OPFFontError("font-encoding-required", `Font '${family}' requires character mapping before substitution.`, {path:style.path,fontFamily:family});
    if (!matching.length && aliases.has(family.toLowerCase())) {
      matching = findFamily(aliases.get(family.toLowerCase())); compatibility = "visual"; via = "alias";
    }
    if (!matching.length && policy!=="none") {
      const candidate = FONT_COMPATIBILITY.find(entry=>entry.requestedFamily.toLowerCase()===family.toLowerCase());
      const tier = candidate?.compatibility==="metric" && !candidate.weights.includes(weight) ? "visual" : candidate?.compatibility;
      // A declared visual replacement is used in visual mode, and in metric mode only when the
      // policy keeps it as a metric-mode fallback (Cambria -> Caladea); it is still reported visual.
      // In metric mode the fallback applies only where the pre-FF-31 metric rule did: the declared
      // replacement at weights 400 and 700, normal or italic, with an exact face weight.
      const metricFallback = policy!=="visual" && candidate?.metricModeFallback===true && [400,700].includes(weight);
      const allowVisual = policy==="visual" || metricFallback;
      if (candidate && (allowVisual || tier==="metric")) {
        // A family that names its weight (Segoe UI Semibold, Arial Black) selects that weight in
        // the replacement; its bold style link still selects bold (FF-31).
        const wanted = candidate.weight ? (weight>=600 ? Math.max(candidate.weight,700) : candidate.weight) : weight;
        for (const [index, substitute] of candidate.substitutes.entries()) {
          // Only the declared replacement can carry the row's metric claim; an alternate is visual.
          const substituteTier = index===0 ? tier : "visual";
          if (substituteTier==="visual" && !(policy==="visual" || metricFallback && index===0)) continue;
          const exactWeight = substituteTier==="metric" || policy!=="visual";
          const faces = findFamily(substitute).filter(face=>!face.fallbackOnly && (!exactWeight || face.weight===weight));
          let available = faces.filter(face=>face.italic===!!style.italic);
          // Visual replacements without the requested style draw the other one and say so.
          if (!available.length && substituteTier==="visual" && policy==="visual" && faces.length) { available = faces.filter(face=>!face.italic); styleFallback = available.length>0; }
          if (available.length) { matching=available; compatibility=substituteTier; rule={...candidate, substituteIndex:index}; targetWeight=wanted; via="replacement"; break; }
        }
      }
    }
    // Equations require an explicit math-aware choice; never fall through to body text.
    if (!matching.length && /^(cambria math|stix two math|noto sans math)$/i.test(family)) throw new OPFFontError("math-font-required", `Supply '${family}' or an explicit math-font alias.`, {path:style.path});
    if (!matching.length && options.fallbackFamily) { matching=findFamily(options.fallbackFamily); compatibility="generic"; via="fallback"; }
    if (!matching.length) throw unavailableFontError(family, style, policy);
    const styled = styleFallback ? matching : matching.filter(face=>face.italic===!!style.italic);
    // Script replacement faces have no italics; use upright glyphs and advances.
    if (!styled.length && style.italic && matching.length && matching.every(face=>face.scripts)) { if (compatibility!=="generic") compatibility="visual"; }
    else matching = styled;
    if (!matching.length) throw new OPFFontError("font-style-unavailable", `No ${style.italic ? "italic" : "upright"} face for '${family}'.`, {path:style.path});
    matching.sort((a,b)=>Math.abs(a.weight-targetWeight)-Math.abs(b.weight-targetWeight) || a.weight-b.weight);
    const face = matching[0];
    if ((face.weight!==targetWeight || styleFallback) && compatibility!=="generic") compatibility="visual";
    // FF-31: `substitute` is true whenever the face is not the chosen family itself (policy
    // replacement, alias, script replacement or fallback). Exporters keep writing sourceFamily.
    const substitute = via!=="family", policyRow = substitute ? fontPolicyFor(family) : undefined;
    const measured = rule?.measured && rule.substituteIndex===0 ? rule.measured : undefined;
    const resolution={requestedFamily:requested,sourceFamily:family,resolvedFamily:face.family,requestedWeight:weight,resolvedWeight:face.weight,italic:face.italic,compatibility,substitute,...(styleFallback?{styleFallback:true}:{}),...(face.fontFace?{fontFace:{...face.fontFace}}:{}),...(style.path?{path:style.path}:{}),...(rule?{source:rule.source,note:rule.note,...(rule.decision?{decision:rule.decision}:{})}:{}),...(measured?{measured:{...measured}}:{}),...(policyRow?{licenseClass:policyRow.licenseClass,availability:[...policyRow.availability]}:{})};
    if (face.family.toLowerCase()!==family.toLowerCase() || face.weight!==weight || face.italic!==!!style.italic) substitutions.set(JSON.stringify([requested,weight,!!style.italic,style.path]),resolution);
    return {face,resolution};
  };
  const resolveFace = style => resolve(style).face;
  const resolveStyle = style => {
    const face=resolveFace(style),resolved={...style,fontFamily:face.family,fontWeight:face.weight,italic:face.italic};
    // Never carry a stale selection from a previously resolved style.
    delete resolved.fontFace;
    if(face.fontFace) resolved.fontFace={...face.fontFace};
    return resolved;
  };
  const metrics = (text,size,style,includeOutline=false) => {
    if (typeof text!=='string'||!Number.isFinite(size)||size<=0) throw new OPFFontError('invalid-text-measurement','Text measurement requires a string and a positive finite font size.');
    const face=resolveFace(style);
    // A BCP-47 `lang` selects the font's OpenType language system, as a browser
    // does for an element's lang (FF-19). Without it, shaping is unchanged.
    const language=openTypeLanguage(style.lang),key=language?`${language}\u0000${text}`:text;
    let value=face.cache.get(key);
    if (value===undefined) {
      if (options.strictGlyphs!==false) for(const character of text) {
        if (/\p{Default_Ignorable_Code_Point}/u.test(character)) continue;
        if (!face.font.hasGlyphForCodePoint(character.codePointAt(0))) throw new OPFFontError("missing-glyph", `Font '${face.family}' cannot display U+${character.codePointAt(0).toString(16).toUpperCase()}.`, {path:style.path,fontFamily:face.family,character});
      }
    }
    if(value===undefined||includeOutline&&!Object.hasOwn(value,'outline')) {
      // FF-31: features a policy row turns off in its replacement (Gelasio for Georgia: liga, clig), the
      // same ones the SVG output turns off, so measured and drawn advances agree.
      const off=disabledFeaturesFor(face.family),policyFeatures=off&&Object.fromEntries(off.map(tag=>[tag,false]));
      const shape=extra=>{const features=policyFeatures||extra?{...policyFeatures,...extra}:undefined;return language?face.font.layout(text,features,undefined,language):features?face.font.layout(text,features):face.font.layout(text);};
      let run;
      try { run=shape(); }
      catch (error) {
        // fontkit rejects some mark-attachment lookups (null anchors, for example
        // Gurmukhi tippi in Noto Sans Gurmukhi). Mark positioning moves marks
        // without changing advances, so measure again without it (FF-19).
        try { run=shape({abvm:false,blwm:false,mark:false,mkmk:false}); }
        catch { throw new OPFFontError("font-shaping-failed", `Font '${face.family}' cannot shape this text.`, {path:style.path,fontFamily:face.family,cause:error?.message}); }
      }
      value={width:run.positions.reduce((total,position)=>total+position.xAdvance,0)/face.font.unitsPerEm,...value};
      if(includeOutline) {
        const bounds=run.bbox,unit=face.font.unitsPerEm;
        value.outline=[bounds.minX,bounds.minY,bounds.maxX,bounds.maxY].every(Number.isFinite)
          ?{x:bounds.minX/unit,y:-bounds.maxY/unit,width:bounds.width/unit,height:bounds.height/unit}:null;
      }
      if (text.length<=2048) {
        if (face.cache.size>=512&&!face.cache.has(key)) face.cache.delete(face.cache.keys().next().value);
        face.cache.set(key,value);
      }
    }
    return value;
  };
  const measure=(text,size,style)=>metrics(text,size,style).width*size;
  const outlineBounds=(text,size,style)=>{
    const bounds=metrics(text,size,style,true).outline;
    return bounds===null?null:{x:bounds.x*size,y:bounds.y*size,width:bounds.width*size,height:bounds.height*size};
  };
  return {
    // resolveFont lets exporters tell a substitute from the chosen family (FF-31).
    textMeasurement: {measure,resolveStyle,outlineBounds,resolveFont:style=>resolve(style).resolution},
    resolveFont(style) { return resolve(style).resolution; },
    clearSubstitutions() { substitutions.clear(); },
    get substitutions() { return [...substitutions.values()]; },
    // Faces flagged embed:"used" (the open pack, FF-31) are not in this eager list: supplied with selectEmbeddedFonts (or
    // prepareNodeFonts().options.embeddedFonts) they are embedded only in SVGs whose text names their family.
    get embeddedFonts() { return embedded(face=>face.embed!=="used"); },
    /** Parsed face metadata in entry order, without encoding font bytes. */
    describeFaces: ()=>faces.map(face=>({family:face.family,weight:face.weight,italic:face.italic,...(face.scripts?{scripts:[...face.scripts]}:{}),...(face.fallbackOnly?{fallbackOnly:true}:{})})),
    /** Embedded faces for which `predicate({family,weight,italic,scripts})` holds; large script faces can be left to raster fontFiles. */
    selectEmbeddedFonts: predicate=>embedded(predicate),
    /** True when a loaded script-pack face has a glyph for the character (FF-19 glyph fallback planning). */
    scriptFacesCover: character => faces.some(face => face.scripts && face.font.hasGlyphForCodePoint(character.codePointAt(0))),
    /**
     * Register more faces in this registry (FF-19: script faces are added once a document needs
     * them). Atomic: on an error no face is added. Returns the added faces' metadata. Text
     * measurements planned before the call may not know the new faces; plan again afterwards.
     */
    addFaces(added) {
      if (!Array.isArray(added)) throw new OPFFontError("invalid-font-data", "addFaces requires an array of font entries.");
      const made = added.map(makeFace);
      register(made);
      buildAliases();
      substitutions.clear();
      return made.map(face=>({family:face.family,weight:face.weight,italic:face.italic,...(face.scripts?{scripts:[...face.scripts]}:{})}));
    },
  };
  function embedded(predicate) { return faces.filter(face=>predicate({family:face.family,weight:face.weight,italic:face.italic,scripts:face.scripts,embed:face.embed,fallbackOnly:face.fallbackOnly})).map(face=>({family:face.family,weight:face.weight,italic:face.italic,...(face.license ? {license:face.license} : {}),...(face.embed==="used" ? {embed:"used"} : {}),dataUrl:`data:font/${face.format};base64,${base64(face.data)}`})); }
}
