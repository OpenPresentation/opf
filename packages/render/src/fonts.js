// `/fonts`: the font data and helpers a host may read, in an entry that needs neither Node nor a DOM. The pieces that core owns
// are core's own exports, not copies: the font policy table and its lookup (`FONT_POLICY`, `fontPolicyFor`), the symbol-font
// code rules (`isSymbolEncodedFamily`, `symbolCodeOf`, `mapSymbolText`) and the script slot of a script (`scriptFontRole`).
// Fonts are loaded with `loadFonts` from `/fonts-node` or `/fonts-browser`, which return the handle every deck-level function takes.
export { OPFFontError } from "./font-registry.js";
export { FONT_POLICY, fontPolicyFor } from "@openpresentation/opf/font-policy";
export { SYMBOL_SCRIPT, SYMBOL_PLACEHOLDER, SYMBOL_PREVIEW_FACES, SYMBOL_FACE_FAMILIES, isSymbolEncodedFamily, symbolPreviewFaces, symbolCodeOf, mapSymbolText } from "./symbol-fonts.js";
export { FONT_COMPATIBILITY, EXPERIMENTAL_FONT_CANDIDATES, disabledFeaturesFor } from "./font-compatibility.js";
export { EMOJI_FONT_FAMILIES, SCRIPT_FONT_FAMILIES, SCRIPT_FONT_REPLACEMENTS, createScriptFonts, createScriptTextMeasurement, designatedFamilies, glyphFallbackFamilies, detectScripts, hasEmojiPresentation, hasMathNotation, itemizeScripts, openTypeLanguage, scriptFontAliases, scriptFontRole, sizeAdjustFor, adjustedFontSize, lineAscentFor, baselineShift, scriptOfCharacter, textRole } from "./script-fonts.js";
export { COLOR_FONT_FACES } from "./color-fonts.js";
