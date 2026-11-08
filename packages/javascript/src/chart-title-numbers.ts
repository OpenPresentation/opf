// LH-110 remainder: the numbers a slide title compares its chart's data with, in English and the main European languages, written in digits
// or, in English, in words ("above twenty percent", "more than ninety-two percent"). Pure and browser-safe; chart-marks.ts reads the result.
//
// A title names a reference value when a comparison word stands right before the number ("stayed above 92%", "über 92 %", "au-dessus de
// 92 %"); any other number in a title is a data value or not a reference. The word lists are deliberately short: a missed reference draws
// no line, a false one draws a wrong line.
import {titleNumbers} from './chart-focus.js';

/** One number a title compares with: its value, the decimals it is written to, whether it is a percent, its label and the text before it. */
export interface TitleReferenceNumber {
  value: number;
  decimals: number;
  percent: boolean;
  /** The label of the reference line: the number as the title writes it in digits ("92%", "92,5 %"), a number in words as digits ("20%"). */
  text: string;
  /** The title text before the number (lower case for the comparison test). */
  before: string;
}

interface ReferenceLanguage {
  /** The comparison words, matched at the end of the text before a number (articles and "of" may stand between). */
  comparison: RegExp;
  /** The decimal separator digits are written with. */
  decimal: '.' | ',';
}

// A comparison word, then any of `between` (articles, "of", and the reference nouns themselves), then the number. `\p{L}` boundaries: JavaScript's
// `\b` is ASCII only and would split "über" or "dépasse".
const comparison = (words: string, between: string): RegExp =>
  new RegExp(`(?:^|[^\\p{L}])(?:${words})(?:[\\s’']+(?:${between}))*[\\s’']*$`, 'iu');

/**
 * The languages LH-110 reads, by primary subtag. English keeps LH-110's list; the others name the same comparisons: above and below,
 * more and less than, at least and at most, exceeding, beating and reaching, and a target, goal, threshold, limit or benchmark.
 */
export const TITLE_REFERENCE_LANGUAGES: Readonly<Record<string, ReferenceLanguage>> = Object.freeze({
  // LH-110's English list, unchanged: "stayed above 92%", "beat the target of 30", "at least 1,000".
  en: {decimal: '.', comparison: /\b(?:above|below|over|under|exceed(?:s|ed|ing)?|surpass(?:es|ed|ing)?|beat(?:s|ing)?|top(?:s|ped)?|cross(?:es|ed|ing)?|reach(?:es|ed|ing)?|at least|at most|more than|less than|fewer than|within|beyond|target|goal|threshold|limit|cap|benchmark)(?:\s+(?:the|a|an|its|our|their|of|target|goal|threshold|limit|benchmark))*\s+$/i},
  de: {decimal: ',', comparison: comparison(
    'über|unter|oberhalb|unterhalb|mehr als|weniger als|mindestens|höchstens|wenigstens|übertr(?:ifft|af|afen|offen|effen)|überschr(?:eitet|itt|itten)|erreich(?:t|te|ten)|ziel(?:wert)?|grenz(?:e|wert)|schwelle(?:nwert)?|vorgabe',
    'der|die|das|den|dem|des|ein|eine|einen|einem|einer|von|vom|ihr|ihre|ihren|unser|unsere|unseren|ziel(?:wert)?|grenz(?:e|wert)|schwelle(?:nwert)?|vorgabe|marke')},
  fr: {decimal: ',', comparison: comparison(
    'au-dessus|au-dessous|en dessous|en deçà|au-delà|plus|moins|au moins|au plus|dépass(?:e|ent|é|ait|aient|ant)|franchi(?:t|ssent)?|atteint|atteignent|objectif|seuil|cible|limite|plafond',
    'de|du|des|d|la|le|les|l|son|sa|ses|notre|nos|leur|leurs|objectif|seuil|cible|limite|plafond|que')},
  es: {decimal: ',', comparison: comparison(
    'por encima|por debajo|más|menos|al menos|como mínimo|como máximo|super(?:a|an|ó|aron|ando)|alcanz(?:a|an|ó|aron)|objetivo|meta|umbral|límite|tope',
    'de|del|la|el|los|las|su|sus|nuestro|nuestra|objetivo|meta|umbral|límite|tope')},
  it: {decimal: ',', comparison: comparison(
    'sopra|sotto|oltre|più|meno|almeno|al massimo|super(?:a|ano|ato|ò)|raggiung(?:e|ono)|raggiunto|obiettivo|soglia|limite|tetto|target',
    'di|del|della|dello|dei|delle|il|la|lo|l|i|le|suo|sua|nostro|nostra|obiettivo|soglia|limite|tetto|target')},
  pt: {decimal: ',', comparison: comparison(
    'acima|abaixo|mais|menos|pelo menos|no mínimo|no máximo|super(?:a|am|ou|aram)|ating(?:e|em|iu|iram)|meta|objetivo|limite|alvo|teto',
    'de|do|da|dos|das|o|a|os|as|seu|sua|nosso|nossa|meta|objetivo|limite|alvo|teto')},
  nl: {decimal: ',', comparison: comparison(
    'boven|onder|meer dan|minder dan|ten minste|minstens|hoogstens|overschr(?:ijdt|eed|eden)|bereik(?:t|te|ten)|doel(?:stelling)?|drempel(?:waarde)?|grens(?:waarde)?|norm',
    'de|het|een|van|onze|hun|zijn|haar|doel(?:stelling)?|drempel(?:waarde)?|grens(?:waarde)?|norm')},
});

/** The reference language of a BCP 47 tag, or undefined when LH-110 does not read titles in it. */
export function titleReferenceLanguage(language: string | undefined): ReferenceLanguage | undefined {
  const primary = (language || 'en').toLowerCase().split(/[-_]/)[0]!;
  return Object.hasOwn(TITLE_REFERENCE_LANGUAGES, primary) ? TITLE_REFERENCE_LANGUAGES[primary] : undefined;
}

/** ASCII digits for every decimal digit (Arabic-Indic, Devanagari ...), after NFKC (which also turns no-break spaces into spaces). */
const asciiDigits = (text: string): string => text.normalize('NFKC').replace(/\p{Nd}/gu, char => {
  const code = char.codePointAt(0)!;
  let zero = code;
  while (code - zero < 9 && /\p{Nd}/u.test(String.fromCodePoint(zero - 1))) zero--;
  return String((code - zero) % 10);
});

/**
 * Numbers in digits with a decimal comma: "92,5 %", "1.000", "1 000" (thousands by a dot or a space, then a comma and decimals); a percent
 * sign or the percent word of the language ("92 Prozent", "92 pour cent") makes a percent.
 */
function commaNumbers(text: string): TitleReferenceNumber[] {
  const ascii = asciiDigits(text);
  return [...ascii.matchAll(/(?<![\p{L}\d.,])(\d{1,3}(?:[. ]\d{3})+|\d+)(,\d+)?(?![\d])(\s?%|\s+(?:prozent|pour cent|por ciento|per cento|por cento|procent)(?![\p{L}]))?/giu)].map(match => {
    const decimals = match[2] ? match[2].length - 1 : 0;
    const value = Number(`${match[1]!.replace(/[. ]/g, '')}${match[2] ? `.${match[2].slice(1)}` : ''}`);
    return {value, decimals, percent: match[3] !== undefined, text: match[0].trim(), before: ascii.slice(0, match.index ?? 0)};
  });
}

const UNITS: Readonly<Record<string, number>> = Object.freeze({
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
});
const SCALES: Readonly<Record<string, number>> = Object.freeze({hundred: 100, thousand: 1000, million: 1_000_000});
const NUMBER_WORD = `(?:${[...Object.keys(UNITS), ...Object.keys(SCALES)].join('|')})`;
const WORD_NUMBER = new RegExp(`(?<![\\p{L}-])${NUMBER_WORD}(?:(?:[\\s-]+(?:and[\\s-]+)?)${NUMBER_WORD})*(?![\\p{L}-])(\\s+(?:percent|per cent)(?![\\p{L}])|\\s?%)?`, 'giu');

/**
 * The value of English number words ("ninety-two", "one hundred and five", "two thousand"), or undefined when they do not form one number
 * ("five six", "hundred" alone stands for 100). Units after a scale add to it; a unit after a unit is not one number.
 */
export function englishWordNumber(text: string): number | undefined {
  const tokens = text.toLowerCase().split(/[\s-]+/).filter(token => token && token !== 'and');
  if (!tokens.length) return undefined;
  let total = 0, current = 0, last: 'unit' | 'ten' | 'scale' | undefined;
  for (const token of tokens) {
    if (Object.hasOwn(UNITS, token)) {
      const value = UNITS[token]!, ten = value >= 20;
      // "twenty two" and "twenty-two" are one number; "two twenty" or "five six" are not.
      if (last === 'unit' || (last === 'ten' && (ten || value >= 10))) return undefined;
      current += value;
      last = ten ? 'ten' : 'unit';
    } else if (Object.hasOwn(SCALES, token)) {
      const scale = SCALES[token]!;
      if (scale === 100) { current = (current || 1) * 100; }
      else { total += (current || 1) * scale; current = 0; }
      last = 'scale';
    } else return undefined;
  }
  return total + current;
}

/** English number words in a title, each as a reference candidate labeled in digits ("twenty percent" is 20, labeled "20%"). */
function wordNumbers(text: string): TitleReferenceNumber[] {
  const plain = text.normalize('NFKC');
  return [...plain.matchAll(WORD_NUMBER)].flatMap(match => {
    const words = match[0].slice(0, match[0].length - (match[1]?.length ?? 0));
    const value = englishWordNumber(words);
    if (value === undefined) return [];
    const percent = match[1] !== undefined;
    return [{value, decimals: 0, percent, text: `${value.toLocaleString('en-US')}${percent ? '%' : ''}`, before: plain.slice(0, match.index ?? 0)}];
  });
}

/**
 * LH-110: the numbers of a title that a comparison word of its language names (`titleReferenceLanguage`), in the order they appear:
 * digits as the language writes them (a decimal point in English, a decimal comma in the others, LH-110's `titleNumbers` for English),
 * and English number words. Empty for a language LH-110 does not read.
 */
export function titleReferenceNumbers(text: string, language?: string): TitleReferenceNumber[] {
  const spec = titleReferenceLanguage(language);
  if (!spec) return [];
  const digits = spec.decimal === '.' ? titleNumbers(text) : commaNumbers(text);
  const english = spec === TITLE_REFERENCE_LANGUAGES.en ? wordNumbers(text) : [];
  return [...digits, ...english].filter(number => spec.comparison.test(number.before)).sort((a, b) => a.before.length - b.before.length);
}
