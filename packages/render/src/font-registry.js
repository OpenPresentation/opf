import { create } from "fontkit";
import { FONT_COMPATIBILITY, disabledFeaturesFor } from "./font-compatibility.js";
import { adjustedFontSize, createScriptFonts, openTypeLanguage, scriptFontAliases, sizeAdjustFor } from "./script-fonts.js";
import { fontPolicyFor } from "@openpresentation/opf/font-policy";
import { BUNDLED_FONT_MANIFEST } from "./font-manifest.js";
import { SYMBOL_SCRIPT, isSymbolEncodedFamily, symbolEncodingFamily, symbolPreviewFaces } from "./symbol-fonts.js";

// The font registry the loaders (`loadFonts` in fonts-node.js and fonts-browser.js) build: faces in, one text measurement out.
// It is not a public entry point; callers load fonts with `loadFonts` and read `handle.registry`. `/fonts` (fonts.js) re-exports
// the data and helpers a host may read.
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
// The open families load with the office pack (loadFonts({pack:"office"})).

const packFor = family => { const pack = BUNDLED_FONT_MANIFEST.packages.find(pkg=>pkg.renamedFrom?.toLowerCase()===family.toLowerCase() || pkg.faces.some(face=>face.family.toLowerCase()===family.toLowerCase()))?.pack; return pack==="open" ? "office" : pack; };
const percent = value => `${(value*100).toFixed(1)}%`;
/** FF-31: say why a family has no face and what the caller can do, from the OPF font policy. */
function unavailableFontError(family, style, policy) {
  const row = fontPolicyFor(family), details = {path:style.path, fontFamily:family, substitutionPolicy:policy};
  const hook = `supply licensed '${family}' font files (loadFonts({faces}))`;
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
  return new OPFFontError("font-unavailable", `No local font face for '${family}'. ${owner} None of its replacements (${candidates.join(", ")}) is loaded${packs.length ? `; load the ${packs.map(pack=>"'"+pack+"'").join(" or ")} font pack` : ""}, or ${hook}. The PPTX names '${family}' either way.`, details);
}
/** Local font files only. The caller explicitly chooses aliases and fallback. */
// fontkit 2.0.4 cannot decode every OpenType lookup: its GSUB type 8 (reverse chaining contextual single substitution) struct lacks the
// backtrackGlyphCount field, so the lookup fails with "Not a fixed size" when a feature that references it is applied, and it has no processor
// for the type anyway. Noto Sans Mongolian 3.x has such a lookup under calt and rclt in every script, so every shaping of the face threw (FF-44).
// A lookup that cannot be decoded is treated as one that applies nothing (no subtables), so the rest of the feature still runs: advances equal
// a browser's for the face's Latin and Mongolian samples (test/mongolian-shaping.mjs). Applied only after shaping failed, once per font.
const lookupsGuarded = new WeakSet();
export function skipUndecodableLookups(font) {
  if (lookupsGuarded.has(font)) return false;
  lookupsGuarded.add(font);
  let guarded = false;
  for (const tag of ["GSUB", "GPOS"]) {
    let list;
    try { list = font[tag]?.lookupList; } catch { continue; }
    if (typeof list?.get !== "function") continue;
    const get = list.get.bind(list);
    list.get = index => { try { return get(index); } catch { return { lookupType: 1, flags: {}, subTables: [] }; } };
    guarded = true;
  }
  return guarded;
}

/**
 * The face a registry draws for `family` (a validated concrete family: theme tokens are already resolved) in `style`, chosen
 * from `faces` ({family, familyGroup, weight, italic, fallbackOnly?, scripts?}) under the substitution policy, aliases and
 * fallback family, or an OPFFontError when none applies. Shared by the registry's resolution and by the lazy loader's face
 * planning (lazy-fonts.js), so the browser loads exactly the faces Node would draw with everything loaded.
 */
export function pickFace(faces, family, style, {policy = "none", aliases = new Map(), fallbackFamily} = {}) {
  const findFamily = name => faces.filter(face=>face.family.toLowerCase()===name.toLowerCase() || face.familyGroup.toLowerCase()===name.toLowerCase());
  const weight = style.fontWeight ?? 400;
  let matching = findFamily(family), compatibility = "exact", rule, targetWeight = weight, styleFallback = false, via = "family", encoding;
  // FF-45: a symbol-encoded family (Symbol, Wingdings, Wingdings 2, Wingdings 3, Webdings) whose own face is not loaded
  // draws the Unicode equivalent of each code with the first loaded open symbol face (symbol-fonts.js: Noto Sans Symbols 2,
  // Noto Sans Symbols, Noto Sans Math, or the office pack's Noto Sans). The resolved style carries the encoding so the
  // planner maps every character; the PPTX keeps the family and the original codes. Without any such face the caller's
  // fallback family applies, else the request fails as before (font-encoding-required) and names the pack to load.
  if (!matching.length && isSymbolEncodedFamily(family)) {
    for (const candidate of symbolPreviewFaces(family)) { const pool = findFamily(candidate); if (pool.length) { matching = pool; break; } }
    if (matching.length) { compatibility = "visual"; via = "encoding"; encoding = symbolEncodingFamily(family); }
    else if (!fallbackFamily) throw new OPFFontError("font-encoding-required", `Font '${family}' is symbol-encoded and no open symbol face is loaded: load the symbol faces (loadFonts with scripts: ['${SYMBOL_SCRIPT}'], or scripts: 'auto' with the presentation) or supply '${family}' itself.`, {path:style.path,fontFamily:family,scripts:[SYMBOL_SCRIPT],faces:[...symbolPreviewFaces(family)]});
  }
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
        const pool = findFamily(substitute).filter(face=>!face.fallbackOnly && (!exactWeight || face.weight===weight));
        let available = pool.filter(face=>face.italic===!!style.italic);
        // Visual replacements without the requested style draw the other one and say so.
        if (!available.length && substituteTier==="visual" && policy==="visual" && pool.length) { available = pool.filter(face=>!face.italic); styleFallback = available.length>0; }
        if (available.length) { matching=available; compatibility=substituteTier; rule={...candidate, substituteIndex:index}; targetWeight=wanted; via="replacement"; break; }
      }
    }
  }
  // FF-45: Cambria Math previews with STIX Two Math (the math pack, loaded as a script face: the alias above resolves it
  // under every policy). Without the pack the policy error below names the pack; the former `math-font-required` failure is gone.
  if (!matching.length && fallbackFamily) { matching=findFamily(fallbackFamily); compatibility="generic"; via="fallback"; }
  if (!matching.length) throw unavailableFontError(family, style, policy);
  const styled = styleFallback ? matching : matching.filter(face=>face.italic===!!style.italic);
  // Script replacement faces have no italics; use upright glyphs and advances. RR-17 (FF-41): so does a visual preview of a
  // single-style display face (Anton, Bebas Neue: the families Impact and the open font schemes name), reported visual; PowerPoint
  // synthesizes the slant of such a face too, so the advances agree and the preview no longer refuses the deck. A strict registry
  // (policy none) still reports font-style-unavailable.
  if (!styled.length && style.italic && matching.length && (matching.every(face=>face.scripts) || policy==="visual" && matching.every(face=>!face.italic))) { if (compatibility!=="generic") compatibility="visual"; }
  else matching = styled;
  if (!matching.length) throw new OPFFontError("font-style-unavailable", `No ${style.italic ? "italic" : "upright"} face for '${family}'.`, {path:style.path});
  matching.sort((a,b)=>Math.abs(a.weight-targetWeight)-Math.abs(b.weight-targetWeight) || a.weight-b.weight);
  const face = matching[0];
  if ((face.weight!==targetWeight || styleFallback) && compatibility!=="generic") compatibility="visual";
  return {face, compatibility, rule, styleFallback, via, ...(encoding ? {encoding} : {})};
}

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
    const {face, compatibility, rule, styleFallback, via, encoding} = pickFace(faces, family, style, {policy, aliases, fallbackFamily:options.fallbackFamily});
    // FF-31: `substitute` is true whenever the face is not the chosen family itself (policy
    // replacement, alias, script replacement or fallback). Exporters keep writing sourceFamily.
    const substitute = via!=="family", policyRow = substitute ? fontPolicyFor(family) : undefined;
    // RR-38: a policy row can scale its replacement's size (Arabic Typesetting -> Noto Naskh Arabic: 0.64) so measured and drawn
    // advances approximate the real font's. It holds only for the face the multiplier was measured on.
    const sizeAdjust = sizeAdjustFor(policyRow, face.family);
    const measured = rule?.measured && rule.substituteIndex===0 ? rule.measured : undefined;
    const resolution={requestedFamily:requested,sourceFamily:family,resolvedFamily:face.family,requestedWeight:weight,resolvedWeight:face.weight,italic:face.italic,compatibility,substitute,...(styleFallback?{styleFallback:true}:{}),...(face.fontFace?{fontFace:{...face.fontFace}}:{}),...(style.path?{path:style.path}:{}),...(rule?{source:rule.source,note:rule.note,...(rule.decision?{decision:rule.decision}:{})}:{}),...(measured?{measured:{...measured}}:{}),...(policyRow?{licenseClass:policyRow.licenseClass,availability:[...policyRow.availability]}:{}),...(sizeAdjust?{sizeAdjust}:{}),...(encoding?{symbolEncoding:encoding}:{})};
    if (face.family.toLowerCase()!==family.toLowerCase() || face.weight!==weight || face.italic!==!!style.italic) substitutions.set(JSON.stringify([requested,weight,!!style.italic,style.path]),resolution);
    return {face,resolution};
  };
  const resolveFace = style => resolve(style).face;
  const resolveStyle = style => {
    const {face,resolution}=resolve(style),resolved={...style,fontFamily:face.family,fontWeight:face.weight,italic:face.italic};
    // Never carry a stale selection from a previously resolved style.
    delete resolved.fontFace;
    delete resolved.symbolEncoding;
    if(face.fontFace) resolved.fontFace={...face.fontFace};
    // FF-45: the planner maps a symbol-encoded family's codes (symbol-fonts.js); the face only lends its glyphs.
    if(resolution.symbolEncoding) resolved.symbolEncoding=resolution.symbolEncoding;
    return resolved;
  };
  const metrics = (text,size,style,includeOutline=false) => {
    if (typeof text!=='string'||!Number.isFinite(size)||size<=0) throw new OPFFontError('invalid-text-measurement','Text measurement requires a string and a positive finite font size.');
    const {face,resolution}=resolve(style);
    // A BCP-47 `lang` selects the font's OpenType language system, as a browser
    // does for an element's lang (FF-19). Without it, shaping is unchanged.
    const language=openTypeLanguage(style.lang),key=language?`${language}\u0000${text}`:text;
    let value=face.cache.get(key);
    if (value===undefined) {
      if (options.strictGlyphs!==false) for(const character of text) {
        if (/\p{Default_Ignorable_Code_Point}/u.test(character)) continue;
        const code=character.codePointAt(0);
        if (!face.font.hasGlyphForCodePoint(code)) {
          // No loaded face has it: the script faces for this text are not loaded (glyph fallback needs a face to fall back to).
          const loadedElsewhere=faces.some(other=>other!==face&&other.font.hasGlyphForCodePoint(code));
          throw new OPFFontError("missing-glyph", `Font '${face.family}' cannot display U+${code.toString(16).toUpperCase()}.${loadedElsewhere?"":" No loaded font has it, so glyph fallback has no face to fall back to; if it is a script character, load that script's font (loadFonts with scripts: 'auto' and the presentation, or fonts.ensure(presentation))."}`, {path:style.path,fontFamily:face.family,character,...(loadedElsewhere?{}:{loadedFaceHasGlyph:false})});
        }
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
        // A lookup fontkit cannot decode (GSUB type 8 in Noto Sans Mongolian) applies nothing; shape again with the rest (FF-44).
        if (skipUndecodableLookups(face.font)) { try { run=shape(); } catch { /* the mark retry below */ } }
        // fontkit rejects some mark-attachment lookups (null anchors, for example
        // Gurmukhi tippi in Noto Sans Gurmukhi). Mark positioning moves marks
        // without changing advances, so measure again without it (FF-19).
        if (!run) {
          try { run=shape({abvm:false,blwm:false,mark:false,mkmk:false}); }
          catch { throw new OPFFontError("font-shaping-failed", `Font '${face.family}' cannot shape this text.`, {path:style.path,fontFamily:face.family,cause:error?.message}); }
        }
      }
      value={width:run.positions.reduce((total,position)=>total+position.xAdvance,0)/face.font.unitsPerEm,...value};
      if(includeOutline) {
        const unit=face.font.unitsPerEm;
        let bounds=null;
        // FF-45: fontkit reads COLR v0 layers only; a COLRv1 colour face (Noto Color Emoji) has no outlines it can bound (its
        // glyf outlines are empty), so its ink box is the face's em box over the run: the colour image fills the em square.
        try { bounds=run.bbox; } catch { bounds=null; }
        if(bounds&&[bounds.minX,bounds.minY,bounds.maxX,bounds.maxY].every(Number.isFinite)) value.outline={x:bounds.minX/unit,y:-bounds.maxY/unit,width:bounds.width/unit,height:bounds.height/unit};
        else if(face.font.directory?.tables?.COLR&&value.width>0) { const ascent=face.font.ascent/unit,descent=face.font.descent/unit; value.outline={x:0,y:-ascent,width:value.width,height:ascent-descent}; }
        else value.outline=null;
      }
      if (text.length<=2048) {
        if (face.cache.size>=512&&!face.cache.has(key)) face.cache.delete(face.cache.keys().next().value);
        face.cache.set(key,value);
      }
    }
    // RR-38: the replacement is measured at its adjusted size, the one the SVG draws it at.
    return {value,scale:resolution.sizeAdjust??1};
  };
  const measure=(text,size,style)=>{const {value,scale}=metrics(text,size,style);return value.width*adjustedFontSize(size,scale===1?undefined:scale);};
  const outlineBounds=(text,size,style)=>{
    const {value,scale}=metrics(text,size,style,true),bounds=value.outline,drawn=adjustedFontSize(size,scale===1?undefined:scale);
    return bounds===null?null:{x:bounds.x*drawn,y:bounds.y*drawn,width:bounds.width*drawn,height:bounds.height*drawn};
  };
  // resolveFont lets exporters tell a substitute from the chosen family (FF-31). forScripts (opf#485) is the script planner core
  // validate asks for each slide's measurement, so its layout checks measure script runs in the faces this renderer draws.
  const textMeasurement={measure,resolveStyle,outlineBounds,resolveFont:style=>resolve(style).resolution};
  textMeasurement.forScripts=profile=>createScriptFonts(profile,textMeasurement).textMeasurement;
  return {
    textMeasurement,
    resolveFont(style) { return resolve(style).resolution; },
    clearSubstitutions() { substitutions.clear(); },
    get substitutions() { return [...substitutions.values()]; },
    // Faces flagged embed:"used" (the open pack, FF-31) are not in this eager list: they come with selectEmbeddedFonts (or the
    // `loadFonts` handle's embeddedFonts). Whichever list it is given, the SVG writer embeds a face only where its text draws it (RR-61).
    get embeddedFonts() { return embedded(face=>face.embed!=="used"); },
    /** Parsed face metadata in entry order, without encoding font bytes. */
    describeFaces: ()=>faces.map(face=>({family:face.family,weight:face.weight,italic:face.italic,...(face.scripts?{scripts:[...face.scripts]}:{}),...(face.fallbackOnly?{fallbackOnly:true}:{})})),
    /** Embedded faces for which `predicate({family,weight,italic,scripts})` holds; large script faces can be left to raster fontFiles. */
    selectEmbeddedFonts: predicate=>embedded(predicate),
    /** Every face as `{family, data}` (the bytes the registry measures with), for the browser PDF export to embed. */
    exportFaces: ()=>faces.map(face=>({family:face.family,data:face.data})),
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
  function embedded(predicate) { return faces.filter(face=>predicate({family:face.family,weight:face.weight,italic:face.italic,scripts:face.scripts,embed:face.embed,fallbackOnly:face.fallbackOnly})).map(face=>({family:face.family,weight:face.weight,italic:face.italic,...(face.license ? {license:face.license} : {}),...(face.embed ? {embed:face.embed} : {}),dataUrl:`data:font/${face.format};base64,${base64(face.data)}`})); }
}
