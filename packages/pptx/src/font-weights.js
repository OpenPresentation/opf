// One table of the weight and posture words that native legacy font families use
// as style-link names ("Roboto SemiBold"). The exporter recognizes them to keep
// a chosen family's own faces (sameTypeface) and the importer uses the same
// table to map such a face back to family plus OPF weight (splitWeightFace).
// Weights are CSS numeric weights. Words are compact; a two-word spelling
// ("semi bold") is the same word split by one space.
export const FONT_WEIGHT_WORDS = Object.freeze([
  ['thin', 100], ['hairline', 100],
  ['extralight', 200], ['ultralight', 200], ['light', 300], ['semilight', 350], ['demilight', 350],
  ['book', 400], ['regular', 400], ['normal', 400], ['medium', 500],
  ['semibold', 600], ['demibold', 600], ['bold', 700], ['extrabold', 800], ['ultrabold', 800],
  ['black', 900], ['heavy', 900], ['extrablack', 950], ['ultrablack', 950],
]);
export const FONT_POSTURE_WORDS = Object.freeze(['italic', 'oblique']);

const weights = new Map(FONT_WEIGHT_WORDS);
const postures = new Set(FONT_POSTURE_WORDS);
const isWord = word => weights.has(word) || postures.has(word);

// Tokenize a style suffix in one linear pass, without regular expressions:
// this runs on typeface names from untrusted PPTX files. A word is one
// whitespace-separated part ("SemiBold"), or two adjacent parts that join into a
// word ("Semi Bold"). Returns the lower-case words, or undefined when any part
// is not a style word.
function styleWords(suffix) {
  const parts = suffix.toLowerCase().split(/[ \t]+/).filter(Boolean);
  if (!parts.length) return undefined;
  const words = [];
  for (let index = 0; index < parts.length; index++) {
    if (isWord(parts[index])) words.push(parts[index]);
    else if (index + 1 < parts.length && isWord(parts[index] + parts[index + 1])) words.push(parts[index] + parts[++index]);
    else return undefined;
  }
  return words;
}
// True when the whole suffix is made only of style words, e.g. "SemiBold", "Extra Bold Italic".
export const isFaceStyleSuffix = suffix => styleWords(suffix) !== undefined;

// Families whose weight faces the exporter itself writes under native style-link
// names: the bundled families a provider resolves by legacy weight name. Other
// families ("Aptos Light", a theme font that is itself "Roboto Light") are
// authored typefaces and are never split.
export const KNOWN_WEIGHT_FACE_FAMILIES = Object.freeze(['Roboto']);

// Split "<family> <weight words>" into the family and its CSS weight. Returns
// undefined for any other name, so authored families are never altered.
export function splitWeightFace(typeface, families = KNOWN_WEIGHT_FACE_FAMILIES) {
  if (typeof typeface !== 'string') return undefined;
  const name = typeface.trim();
  for (const family of families) {
    const base = family.trim();
    if (name.length <= base.length + 1 || !name.toLowerCase().startsWith(base.toLowerCase()) || !/[ \t]/.test(name[base.length])) continue;
    const words = styleWords(name.slice(base.length + 1));
    if (!words) continue;
    let weight, italic = false;
    for (const word of words) {
      if (postures.has(word)) italic = true;
      else weight = weights.get(word);
    }
    return {family: base, weight: weight ?? 400, italic};
  }
  return undefined;
}
