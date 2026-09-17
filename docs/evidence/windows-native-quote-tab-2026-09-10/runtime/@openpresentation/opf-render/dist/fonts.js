import { create } from "fontkit";
import { FONT_COMPATIBILITY } from "./font-compatibility.js";
export { FONT_COMPATIBILITY, EXPERIMENTAL_FONT_CANDIDATES } from "./font-compatibility.js";

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
/** Local font files only. The caller explicitly chooses aliases and fallback. */
export function createFontRegistry(entries, options = {}) {
  if (!Array.isArray(entries) || !entries.length) throw new OPFFontError("empty-font-registry", "Supply at least one font file.");
  const faces = entries.map(entry => {
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
    return {family,familyGroup,fontFace,weight,italic,font,data,format,license:entry.license,cache:new Map()};
  });
  const duplicates = new Set();
  for (const face of faces) {
    const id = key(face.family,face.weight,face.italic);
    if (duplicates.has(id)) throw new OPFFontError("duplicate-font-face", `Duplicate face: ${id}`);
    duplicates.add(id);
  }
  const familySlots = new Map();
  for (const face of faces) for (const family of new Set([face.family,face.familyGroup])) {
    const id=key(family,face.weight,face.italic),previous=familySlots.get(id);
    if(previous && previous!==face) throw new OPFFontError('ambiguous-font-face', `Multiple physical faces match '${family}' at weight ${face.weight}.`, {fontFamily:family,fontWeight:face.weight,italic:face.italic});
    familySlots.set(id,face);
  }
  const substitutions = new Map();
  const aliases = new Map(Object.entries(options.aliases ?? {}).map(([from,to])=>[validFamily(from).toLowerCase(),validFamily(to)]));
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
    let matching = findFamily(family), compatibility = "exact", rule;
    const encodedSymbol = /^(wingdings(?: [23])?|webdings|symbol)$/i.test(family);
    if (!matching.length && encodedSymbol) throw new OPFFontError("font-encoding-required", `Font '${family}' requires character mapping before substitution.`, {path:style.path,fontFamily:family});
    if (!matching.length && aliases.has(family.toLowerCase())) {
      matching = findFamily(aliases.get(family.toLowerCase())); compatibility = "visual";
    }
    if (!matching.length && policy!=="none") {
      const candidate = FONT_COMPATIBILITY.find(entry=>entry.requestedFamily.toLowerCase()===family.toLowerCase());
      const tier = candidate?.compatibility==="metric" && !candidate.weights.includes(weight) ? "visual" : candidate?.compatibility;
      if (candidate && (policy==="visual" || tier==="metric")) {
        for (const substitute of candidate.substitutes) {
          const available = findFamily(substitute).filter(face=>face.italic===!!style.italic && (tier!=="metric" || face.weight===weight));
          if (available.length) { matching=available; compatibility=tier; rule=candidate; break; }
        }
      }
    }
    // Equations require an explicit math-aware choice; never fall through to body text.
    if (!matching.length && /^(cambria math|stix two math|noto sans math)$/i.test(family)) throw new OPFFontError("math-font-required", `Supply '${family}' or an explicit math-font alias.`, {path:style.path});
    if (!matching.length && options.fallbackFamily) { matching=findFamily(options.fallbackFamily); compatibility="generic"; }
    if (!matching.length) throw new OPFFontError("font-unavailable", `No local font face for '${family}'.`, {path:style.path,fontFamily:family});
    matching = matching.filter(face=>face.italic===!!style.italic);
    if (!matching.length) throw new OPFFontError("font-style-unavailable", `No ${style.italic ? "italic" : "upright"} face for '${family}'.`, {path:style.path});
    matching.sort((a,b)=>Math.abs(a.weight-weight)-Math.abs(b.weight-weight) || a.weight-b.weight);
    const face = matching[0];
    if (face.weight!==weight && compatibility!=="generic") compatibility="visual";
    const resolution={requestedFamily:requested,sourceFamily:family,resolvedFamily:face.family,requestedWeight:weight,resolvedWeight:face.weight,italic:face.italic,compatibility,...(face.fontFace?{fontFace:{...face.fontFace}}:{}),...(style.path?{path:style.path}:{}),...(rule?{source:rule.source,note:rule.note}:{})};
    if (face.family.toLowerCase()!==family.toLowerCase() || face.weight!==weight) substitutions.set(JSON.stringify([requested,weight,!!style.italic,style.path]),resolution);
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
    let value=face.cache.get(text);
    if (value===undefined) {
      if (options.strictGlyphs!==false) for(const character of text) {
        if (/\p{Default_Ignorable_Code_Point}/u.test(character)) continue;
        if (!face.font.hasGlyphForCodePoint(character.codePointAt(0))) throw new OPFFontError("missing-glyph", `Font '${face.family}' cannot display U+${character.codePointAt(0).toString(16).toUpperCase()}.`, {path:style.path,fontFamily:face.family,character});
      }
    }
    if(value===undefined||includeOutline&&!Object.hasOwn(value,'outline')) {
      const run=face.font.layout(text);
      value={width:run.positions.reduce((total,position)=>total+position.xAdvance,0)/face.font.unitsPerEm,...value};
      if(includeOutline) {
        const bounds=run.bbox,unit=face.font.unitsPerEm;
        value.outline=[bounds.minX,bounds.minY,bounds.maxX,bounds.maxY].every(Number.isFinite)
          ?{x:bounds.minX/unit,y:-bounds.maxY/unit,width:bounds.width/unit,height:bounds.height/unit}:null;
      }
      if (text.length<=2048) {
        if (face.cache.size>=512&&!face.cache.has(text)) face.cache.delete(face.cache.keys().next().value);
        face.cache.set(text,value);
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
    textMeasurement: {measure,resolveStyle,outlineBounds},
    resolveFont(style) { return resolve(style).resolution; },
    clearSubstitutions() { substitutions.clear(); },
    get substitutions() { return [...substitutions.values()]; },
    get embeddedFonts() { return faces.map(face=>({family:face.family,weight:face.weight,italic:face.italic,...(face.license ? {license:face.license} : {}),dataUrl:`data:font/${face.format};base64,${base64(face.data)}`})); },
  };
}
