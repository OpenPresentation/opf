import { resolveScriptFonts } from './script-fonts.js';

/** The quotation marks that wrap a quote body. Each is one UTF-16 code unit, so a quote's source offsets shift by exactly one. */
export interface QuoteMarks { readonly open: string; readonly close: string }

const marks = (open: string, close: string): QuoteMarks => ({ open, close });
const ENGLISH = marks('“', '”'), GUILLEMETS = marks('«', '»'), LOW_HIGH = marks('„', '“'), LOW_RIGHT = marks('„', '”');
const RIGHT_ONLY = marks('”', '”'), CORNER = marks('「', '」'), REVERSED = marks('»', '«');

/**
 * Typographic quotation marks by BCP-47 tag, lower-cased: the full tag (`zh-tw`) is tried before its primary subtag (`zh`). A
 * language that is not listed draws the plain ASCII `"` pair (`ASCII_QUOTE_MARKS`). French guillemets are not padded with
 * spaces: a padded mark would shift quote source offsets by more than one.
 */
export const QUOTE_MARKS: Readonly<Record<string, QuoteMarks>> = {
  en: ENGLISH, es: GUILLEMETS, fr: GUILLEMETS, de: LOW_HIGH, it: GUILLEMETS, pt: ENGLISH, nl: ENGLISH, ca: GUILLEMETS, gl: GUILLEMETS, eu: GUILLEMETS,
  sv: RIGHT_ONLY, fi: RIGHT_ONLY, da: REVERSED, nb: GUILLEMETS, nn: GUILLEMETS, no: GUILLEMETS, is: LOW_HIGH,
  pl: LOW_RIGHT, hu: LOW_RIGHT, ro: LOW_RIGHT, cs: LOW_HIGH, sk: LOW_HIGH, sl: LOW_HIGH, hr: LOW_HIGH, sr: LOW_HIGH, bg: LOW_HIGH, lt: LOW_HIGH, lv: LOW_HIGH, et: LOW_HIGH,
  ru: GUILLEMETS, uk: GUILLEMETS, el: GUILLEMETS, tr: ENGLISH, ga: ENGLISH, cy: ENGLISH,
  ja: CORNER, zh: ENGLISH, 'zh-tw': CORNER, 'zh-hk': CORNER, 'zh-hant': CORNER, ko: ENGLISH,
  ar: GUILLEMETS, fa: GUILLEMETS, he: ENGLISH, ur: ENGLISH, hi: ENGLISH, th: ENGLISH, vi: ENGLISH, id: ENGLISH, ms: ENGLISH,
  'de-ch': GUILLEMETS, 'fr-ch': GUILLEMETS, 'pt-pt': GUILLEMETS,
};
/** What a language with no entry draws. */
export const ASCII_QUOTE_MARKS: QuoteMarks = marks('"', '"');

/** The marks for a BCP-47 tag; a missing tag reads as the engine default language (en-US), an unknown one draws ASCII. */
export function quoteMarksFor(tag?: string): QuoteMarks {
  if (tag === undefined || tag === '') return ENGLISH;
  const lower = tag.toLowerCase().replaceAll('_', '-'), primary = lower.split('-')[0]!;
  return QUOTE_MARKS[lower] ?? QUOTE_MARKS[primary] ?? ASCII_QUOTE_MARKS;
}

/** The deck language a slide's quotes are marked for: the presentation's `language` tag, `undefined` when it names none. */
export function quoteLanguage(presentation: unknown, slideIndex?: number): string | undefined {
  if (presentation === null || typeof presentation !== 'object' || (presentation as { language?: unknown }).language === undefined) return undefined;
  try {
    const resolved = resolveScriptFonts(presentation, Number.isInteger(slideIndex) ? { slideIndex } : {});
    return resolved.languageSource === 'document' ? resolved.bcp47 : undefined;
  } catch {
    return undefined;
  }
}

const PAIRS = new Set(Object.values(QUOTE_MARKS).concat(ASCII_QUOTE_MARKS).map(entry => entry.open + entry.close));
/** True when `text` starts and ends with the opening and closing mark of one known pair: the wrapping `layoutQuote` adds. */
export function isWrappedInQuoteMarks(text: string): boolean {
  return text.length >= 2 && PAIRS.has(text[0]! + text.at(-1)!);
}
/** A quote body without the opening and closing mark of any known pair (the mark pair an exported quote body carries); other text is returned as it is. */
export function unwrapQuoteMarks(text: string): string {
  return isWrappedInQuoteMarks(text) ? text.slice(1, -1) : text;
}
