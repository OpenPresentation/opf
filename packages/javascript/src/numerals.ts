// LH-106: the one way OPF turns a number it generates into text. A number the engines draw from a numeric value (a metric's value
// and delta, chart labels, ticks and percentages, table cells typed as numbers, list numerals and step badges, slide numbers and
// number variables) follows the numbering system of the language in effect (deck, slide or run), as the platform's locale data
// defines it: `ar-SA` draws Arabic-Indic digits, `ar-AE` and `hi-IN` Latin ones, `fa-IR` Persian ones. The BCP 47 extension
// `-u-nu-<system>` chooses another: `ar-SA-u-nu-latn` draws Latin digits, `ar-AE-u-nu-arab` Arabic-Indic ones. Text the author
// typed is never rewritten. Digits, separators and the percent sign come from one table (number-locale-data.ts, read from
// `Intl` once by scripts/build-number-locales.mjs), never from the runtime's `Intl`, so every runtime draws the same text.

import {NUMBER_LOCALES, NUMBER_SEPARATOR_OVERRIDES, NUMBERING_SYSTEMS} from './number-locale-data.js';

/** How one locale writes numbers. */
export interface NumberLocale {
  /** The numbering system (`latn`, `arab`, `arabext`, `deva`, `beng`, ...). */
  system: string;
  /** The ISO 15924 script of its digits (`Latn`, `Arab`, `Deva`, ...): the script whose font draws them. */
  script: string;
  /** The ten digits, zero first. */
  digits: string;
  decimal: string;
  group: string;
  /** The size of the group next to the decimal separator (3: 1,234) and of every group before it (2 in the Indian 12,34,567). */
  primaryGroup: number;
  secondaryGroup: number;
  /** Whole numbers group from this many digits: 4, or 5 in a locale that leaves four digits alone (Spanish 1000, 10.000). */
  groupsFrom: number;
  /** The percent sign, which follows the number as PowerPoint's `0%` prints it: `٪` with Persian digits, else `%` (Arabic-Indic too). */
  percent: string;
}

const ROOT = NUMBER_LOCALES[''] as string;
const cache = new Map<string, NumberLocale>();

/** A tag's language, script and region subtags and its `-u-nu-` numbering system, as written (case-insensitive). */
function tagParts(tag: string): {language: string; script?: string; region?: string; nu?: string} | undefined {
  const subtags = tag.trim().replaceAll('_', '-').split('-');
  const language = subtags[0]?.toLowerCase() ?? '';
  if (!/^[a-z]{2,3}$/.test(language)) return undefined;
  let script: string | undefined, region: string | undefined, nu: string | undefined, index = 1;
  if (/^[a-z]{4}$/i.test(subtags[index] ?? '')) script = subtags[index++]!.charAt(0).toUpperCase() + subtags[index - 1]!.slice(1).toLowerCase();
  if (/^(?:[a-z]{2}|\d{3})$/i.test(subtags[index] ?? '')) region = subtags[index++]!.toUpperCase();
  for (; index < subtags.length; index++) {
    if (subtags[index]!.toLowerCase() !== 'u') continue;
    // A Unicode extension: keys of two characters, each followed by its values; `nu` names the numbering system.
    for (let key = index + 1; key < subtags.length && subtags[key]!.length > 1; key++) {
      if (subtags[key]!.toLowerCase() === 'nu' && /^[a-z0-9]{3,8}$/i.test(subtags[key + 1] ?? '')) { nu = subtags[key + 1]!.toLowerCase(); break; }
    }
    break;
  }
  return {language, ...(script ? {script} : {}), ...(region ? {region} : {}), ...(nu ? {nu} : {})};
}

/** The numbering system a `-u-nu-` extension names, when the tag has one (`ar-SA-u-nu-latn` names `latn`), whether OPF draws it or not. */
export function numberingSystemExtension(tag: string): string | undefined {
  return tagParts(tag)?.nu;
}

/** True when OPF draws the numbering system's digits (it is in the table: digits that are ten consecutive characters of one script). */
export function isSupportedNumberingSystem(system: string): boolean {
  return system === 'latn' || Object.hasOwn(NUMERAL_SHAPES, system);
}

/** The numbering systems OPF draws, sorted. */
export function supportedNumberingSystems(): string[] {
  return ['latn', ...Object.keys(NUMERAL_SHAPES)].sort();
}

/**
 * LH-106 (vetoable): the numbering systems OPF draws other than Latin, each with the numeral shape PowerPoint draws a native chart's
 * number format in (the `[$-<code>]` prefix of an Excel format code): a system draws only where PowerPoint draws the same digits, so
 * the preview and the export agree. Arabic-Indic and Persian were verified in PowerPoint 16.0.20527 (2026-11-12); Devanagari and
 * Bengali follow Excel's documented numbering and await that check. Any other system (Thai, Myanmar, ...) is drawn in Latin digits.
 */
export const NUMERAL_SHAPES: Readonly<Record<string, string>> = {arab: '2000000', arabext: '3000000', deva: '4000000', beng: '5000000'};

/**
 * The prefix a native chart's number format takes so PowerPoint draws its digits in the language's numbering system (`[$-2000000]`
 * in `ar-SA`), or '' with Latin digits.
 */
export function numeralShapePrefix(language?: string): string {
  const code = NUMERAL_SHAPES[numberLocale(language).system];
  return code ? `[$-${code}]` : '';
}

/**
 * `tag` without its extensions and private-use subtags (`ar-SA-u-nu-latn` is `ar-SA`): the plain language tag PowerPoint's `lang`
 * attribute and other consumers that know no extensions take. A tag without extensions is returned as written.
 */
export function plainLanguageTag(tag: string): string {
  const subtags = tag.split('-');
  const end = subtags.findIndex((subtag, index) => index > 0 && subtag.length === 1);
  return end < 0 ? tag : subtags.slice(0, end).join('-');
}

/**
 * How the language writes numbers. A missing or unknown tag writes them as English does (Latin digits, `.` and `,`); a
 * `-u-nu-` numbering system OPF draws replaces the locale's own, with Arabic separators for Arabic and Persian digits and the
 * locale's Latin ones otherwise.
 */
export function numberLocale(language?: string): NumberLocale {
  const key = language ?? '';
  let locale = cache.get(key);
  if (locale) return locale;
  const parts = language ? tagParts(language) : undefined;
  const entry = (parts && ((parts.script && parts.region && NUMBER_LOCALES[`${parts.language}-${parts.script}-${parts.region}`]) ?? (parts.region && NUMBER_LOCALES[`${parts.language}-${parts.region}`]) ?? (parts.script && NUMBER_LOCALES[`${parts.language}-${parts.script}`]) ?? NUMBER_LOCALES[parts.language])) || ROOT;
  const [own = 'latn', decimal = '.', group = ',', grouping = '33', minimum = '1', latinDecimal, latinGroup] = entry.split('|');
  const primaryGroup = Number(grouping[0]) || 3, secondaryGroup = Number(grouping[1]) || primaryGroup;
  // A system OPF does not draw (the locale's own, or the one -u-nu- names) is drawn in Latin digits.
  const requested = parts?.nu && isSupportedNumberingSystem(parts.nu) ? parts.nu : isSupportedNumberingSystem(own) ? own : 'latn';
  // The locale's separators with Latin digits: its own when its digits are Latin, else the ones its `-u-nu-latn` form uses.
  const latin = own === 'latn' ? {decimal, group} : {decimal: latinDecimal ?? '.', group: latinGroup ?? ','};
  // Arabic-Indic digits take PowerPoint's Latin comma and period (NUMBER_SEPARATOR_OVERRIDES), Persian digits the Persian separators.
  const separators = requested === own ? {decimal, group} : NUMBER_SEPARATOR_OVERRIDES[requested] ?? (requested === 'arabext' ? {decimal: '٫', group: '٬'} : latin);
  const [zero, script] = NUMBERING_SYSTEMS[requested] ?? NUMBERING_SYSTEMS.latn!;
  locale = {system: requested, script, digits: Array.from({length: 10}, (_, digit) => String.fromCodePoint(zero + digit)).join(''), ...separators, primaryGroup, secondaryGroup, groupsFrom: primaryGroup + (minimum === '2' ? 2 : 1), percent: requested === 'arabext' ? '٪' : '%'};
  if (cache.size >= 256) cache.clear();
  cache.set(key, locale);
  return locale;
}

const tagOf = (language: unknown): string | undefined => {
  const tag = typeof language === 'string' ? language : language && typeof language === 'object' ? (language as {bcp47?: unknown}).bcp47 : undefined;
  return typeof tag === 'string' && tag.trim() ? tag.trim() : undefined;
};

/**
 * The language tag in effect on a slide: the slide's own `language` (LH-106), else the presentation's, else undefined. A tag
 * string or a Language object's `bcp47`, as written: numbers read only its language, script, region and `-u-nu-`.
 */
export function languageInEffect(presentation: unknown, slideIndex?: number): string | undefined {
  if (!presentation || typeof presentation !== 'object') return undefined;
  const {slides, language} = presentation as {slides?: unknown; language?: unknown};
  const slide = slideIndex !== undefined && Array.isArray(slides) ? slides[slideIndex] : undefined;
  return (slide && typeof slide === 'object' ? tagOf((slide as {language?: unknown}).language) : undefined) ?? tagOf(language);
}

/** The numbering system of the language in effect (`latn` for a missing or unknown tag). */
export function numberingSystemOf(language?: string): string {
  return numberLocale(language).system;
}

const localeOf = (language?: string | NumberLocale): NumberLocale => typeof language === 'object' ? language : numberLocale(language);

/** `text` with its ASCII digits drawn in the locale's digits. Nothing else changes. */
export function localizeDigits(text: string, language?: string | NumberLocale): string {
  const locale = localeOf(language);
  if (locale.system === 'latn') return text;
  const digits = [...locale.digits];
  return text.replace(/[0-9]/g, (digit) => digits[digit.charCodeAt(0) - 48]!);
}

/** The whole-number digits `integer` (ASCII) with the locale's group separators. */
function groupDigits(integer: string, locale: NumberLocale): string {
  if (integer.length < locale.groupsFrom) return integer;
  const last = integer.slice(-locale.primaryGroup), rest = integer.slice(0, -locale.primaryGroup), size = locale.secondaryGroup, groups: string[] = [];
  for (let end = rest.length; end > 0; end -= size) groups.unshift(rest.slice(Math.max(0, end - size), end));
  return [...groups, last].join('\u0000');
}

/**
 * The text of a number in parts the caller already decided (ASCII digits, sign separate): the locale's digits, its decimal
 * separator and, with `group`, its group separators. The one place a generated number's digits and separators are chosen.
 */
export function localizeNumberParts(parts: {negative?: boolean; integer: string; fraction?: string; group?: boolean}, language?: string | NumberLocale): string {
  const locale = localeOf(language);
  const integer = parts.group ? groupDigits(parts.integer, locale) : parts.integer;
  const body = `${integer}${parts.fraction ? `\u0001${parts.fraction}` : ''}`;
  return `${parts.negative ? '-' : ''}${localizeDigits(body, locale).replaceAll('\u0000', locale.group).replace('\u0001', locale.decimal)}`;
}

/**
 * A number in the General form (at most twelve significant digits, an exponent only where the value needs one), in the
 * language's digits and decimal separator, and with `group` its group separators (where four digits or more are a whole
 * number's: the callers decide when a number groups). A value that is not finite is its plain text.
 */
export function formatNumber(value: number, language?: string | NumberLocale, options: {group?: boolean} = {}): string {
  if (!Number.isFinite(value)) return String(value);
  const rounded = Number(value.toPrecision(12));
  return localizeNumberText(String(Object.is(rounded, -0) ? 0 : rounded), language, options);
}

/**
 * A number JavaScript printed (`String(value)`: `-1234.5`, `1e+21`) in the language's digits and decimal separator, and with `group`
 * its group separators. An exponent form keeps its `e` and sign.
 */
export function localizeNumberText(plain: string, language?: string | NumberLocale, options: {group?: boolean} = {}): string {
  if (/e/i.test(plain)) return localizeDigits(plain, language).replace('.', localeOf(language).decimal);
  const negative = plain.startsWith('-'), [integer = '0', fraction] = (negative ? plain.slice(1) : plain).split('.');
  return localizeNumberParts({negative, integer, ...(fraction ? {fraction} : {}), group: options.group === true}, language);
}

/** A percentage (`share` 0.5 is 50%) in the General form, in the language's digits, followed by its percent sign. */
export function formatPercentNumber(percent: number, language?: string | NumberLocale): string {
  return `${formatNumber(percent, language)}${localeOf(language).percent}`;
}

/**
 * Latin text a number format pattern printed (`formatVariableNumber`: ASCII digits, `.` and `,` between them, `%` in its literal
 * parts) in the language's numbers: its digits, its decimal and group separators where the pattern has `.` and `,` (as Excel and
 * PowerPoint read a format code: `#,##0.00` is 1.000,00 in German; the pattern still decides whether a number groups, LH-141), and
 * its percent sign for `%`. The literal text is the author's and stays as written.
 */
export function localizePatternNumber(parts: {negative: boolean; prefix: string; body: string; suffix: string}, language?: string | NumberLocale): string {
  const locale = localeOf(language);
  const sign = parts.negative ? '-' : '';
  // A pattern that groups groups as the locale does (Indian lakh grouping included), from four digits as the pattern asks.
  const [integer = '', fraction] = parts.body.split('.');
  const grouped = integer.includes(',') ? groupDigits(integer.replaceAll(',', ''), {...locale, groupsFrom: locale.primaryGroup + 1}).replaceAll('\u0000', ',') : integer;
  const body = localizeDigits(fraction === undefined ? grouped : `${grouped}.${fraction}`, locale).replace(/[.,]/g, (separator) => separator === '.' ? locale.decimal : locale.group);
  const percent = (literal: string) => literal.replaceAll('%', locale.percent);
  return `${sign}${percent(parts.prefix)}${body}${percent(parts.suffix)}`;
}

/** The scripts the digits of these languages are drawn in, other than Latin (the fonts a deck in them needs for its generated numbers). */
export function numeralScripts(languages: Iterable<string | undefined>): string[] {
  const scripts = new Set<string>();
  for (const language of languages) { const {script} = numberLocale(language); if (script !== 'Latn') scripts.add(script); }
  return [...scripts].sort();
}

/**
 * Reads a number drawn in any numbering system OPF draws back to ASCII digits (Arabic-Indic `١٢٣`, Persian `۱۲۳`, Devanagari
 * `१२३`, ...), with Arabic decimal and group separators as `.` and `,`. Other characters are kept.
 */
export function asciiDigits(text: string): string {
  let out = '';
  for (const character of text) {
    const code = character.codePointAt(0)!;
    if (character === '٫') { out += '.'; continue; }
    if (character === '٬') { out += ','; continue; }
    if (character === '٪') { out += '%'; continue; }
    let digit: number | undefined;
    if (code > 0x7f) for (const [zero] of Object.values(NUMBERING_SYSTEMS)) if (code >= zero && code <= zero + 9) { digit = code - zero; break; }
    out += digit === undefined ? character : String(digit);
  }
  return out;
}
