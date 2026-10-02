// RR-33: numbered lists. OPF `numbering` (a style, a start and a suffix per list level) is written as native
// `a:buAutoNum` and read back from it.
//
// Export: every marker line of a measured list is its own text box (see addMeasuredList), so each carries the number
// core counted as `startAt`; there is nothing for PowerPoint to count across boxes.
// Import: `a:buAutoNum` of a native paragraph is read with PowerPoint's own counting (consecutive paragraphs of one
// level and one scheme count up from `startAt`; a paragraph of another scheme or start begins a new sequence; a
// shallower or unnumbered paragraph ends the deeper sequences), then the numbers of the whole list are expressed as the
// shortest `numbering` plus per-entry `start` values that reproduce them.

const STYLES = ['arabic', 'roman-upper', 'roman-lower', 'alpha-upper', 'alpha-lower'];
const STYLE_STEMS = {arabic: 'arabic', 'roman-upper': 'romanUc', 'roman-lower': 'romanLc', 'alpha-upper': 'alphaUc', 'alpha-lower': 'alphaLc'};
const SUFFIX_TAILS = {period: 'Period', paren: 'ParenR', 'paren-both': 'ParenBoth'};

/** The `a:buAutoNum@type` scheme of an OPF style and suffix. */
export const autoNumScheme = (style, suffix = 'period') => `${STYLE_STEMS[style]}${SUFFIX_TAILS[suffix]}`;

const SCHEMES = new Map(STYLES.flatMap(style => Object.keys(SUFFIX_TAILS).map(suffix => [autoNumScheme(style, suffix), {style, suffix}])));
/** OPF style and suffix of a native scheme, or `undefined` for a scheme OPF has no equivalent for. */
export const schemeNumbering = type => SCHEMES.get(type);

/** `startAt` of a native auto-number: an integer from 1 to 32767, default 1. */
export function autoNumStart(value) {
  if (value === undefined || value === '') return 1;
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 32767 ? number : undefined;
}

/**
 * The number each paragraph of one native shape displays, by PowerPoint's counting. `paragraphs` are
 * `{level, autoNum?: {type, startAt}}`; returns the displayed numbers (`undefined` for an unnumbered paragraph).
 */
export function displayedNumbers(paragraphs) {
  const sequences = [];
  return paragraphs.map(paragraph => {
    const level = Number.isInteger(paragraph.level) && paragraph.level >= 0 ? paragraph.level : 0;
    if (!paragraph.autoNum) { sequences.length = Math.min(sequences.length, level); return undefined; }
    const start = autoNumStart(paragraph.autoNum.startAt) ?? 1, type = paragraph.autoNum.type ?? 'arabicPeriod';
    const current = sequences[level];
    const value = current && current.type === type && current.start === start ? current.value + 1 : start;
    sequences[level] = {type, start, value};
    sequences.length = level + 1;
    return value;
  });
}

const entryOf = ({style, start, suffix}) => {
  const fields = {...(style !== 'arabic' ? {style} : {}), ...(start !== 1 ? {start} : {}), ...(suffix !== 'period' ? {suffix} : {})};
  const names = Object.keys(fields);
  if (!names.length) return 'arabic';
  return names.length === 1 && names[0] === 'style' ? style : fields;
};

/**
 * The OPF numbering of a native list: `paragraphs` are `{level, number?: {type, value}}` in reading order (`number` is the
 * displayed number and its scheme). Returns `{numbering, starts, diagnostics}`: `numbering` is the shortest authored form
 * (`undefined` when the list is not numbered), `starts` maps a paragraph index to the entry `start` that restores its
 * number, and `diagnostics` lists what could not be represented.
 */
export function deriveListNumbering(paragraphs) {
  const diagnostics = [];
  const numbered = paragraphs.filter(paragraph => paragraph.number);
  if (!numbered.length) return {numbering: undefined, starts: new Map(), diagnostics};
  if (numbered.length !== paragraphs.length) {
    diagnostics.push({code: 'numbering-mixed', message: 'A list that mixes numbered and bulleted or plain paragraphs has no OPF equivalent (numbering applies to the whole list); it imports as bullets.'});
    return {numbering: undefined, starts: new Map(), diagnostics};
  }
  const levels = [];
  let unknown = false, mixedStyles = false;
  for (const paragraph of numbered) {
    const level = paragraph.level ?? 0;
    const known = schemeNumbering(paragraph.number.type);
    if (!known) { unknown = true; }
    const resolved = known ?? {style: 'arabic', suffix: 'period'};
    if (!levels[level]) levels[level] = {...resolved, start: paragraph.number.value};
    else if (levels[level].style !== resolved.style || levels[level].suffix !== resolved.suffix) mixedStyles = true;
  }
  if (unknown) diagnostics.push({code: 'numbering-scheme-adapted', message: 'A native numbering scheme OPF has no equivalent for (an East Asian, Hebrew or Arabic scheme, or a bullet-only scheme) imports as arabic with a period.'});
  if (mixedStyles) diagnostics.push({code: 'numbering-style-adapted', message: 'Entries of one list level use different native numbering schemes; OPF numbers a level in one style, so the first entry\'s style is used for the level.'});
  const filled = [];
  for (let level = 0; level < levels.length; level++) filled[level] = levels[level] ?? {...(filled[level - 1] ?? {style: 'arabic', suffix: 'period'}), start: 1};
  // Per-entry starts: restart wherever the displayed number is not what counting gives.
  const counters = [], starts = new Map();
  paragraphs.forEach((paragraph, index) => {
    const level = paragraph.level ?? 0, value = paragraph.number.value;
    const natural = counters[level] === undefined ? filled[level].start : counters[level] + 1;
    if (natural !== value) starts.set(index, value);
    counters[level] = value;
    counters.length = level + 1;
  });
  // The last entry repeats for deeper levels, so trailing equal entries are redundant.
  const same = (a, b) => a.style === b.style && a.suffix === b.suffix && a.start === b.start;
  while (filled.length > 1 && same(filled.at(-1), filled.at(-2))) filled.pop();
  const entries = filled.map(entryOf);
  return {numbering: entries.length === 1 ? entries[0] : entries, starts, diagnostics};
}

/** A canonical form of an authored `numbering`, for comparing two spellings of the same numbering. */
export function canonicalNumbering(numbering) {
  const list = Array.isArray(numbering) ? numbering : [numbering];
  const resolved = list.map(entry => typeof entry === 'string' ? {style: entry, start: 1, suffix: 'period'} : {style: entry?.style ?? 'arabic', start: entry?.start ?? 1, suffix: entry?.suffix ?? 'period'});
  while (resolved.length > 1 && JSON.stringify(resolved.at(-1)) === JSON.stringify(resolved.at(-2))) resolved.pop();
  return JSON.stringify(resolved);
}

/**
 * Add `autoNum` (the paragraph's `a:buAutoNum` attributes) and the displayed `number` ({type, value}) to the numbered
 * paragraphs of one native shape. Paragraphs without a native auto-number are returned unchanged.
 */
export function withDisplayedNumbers(paragraphs) {
  if (!paragraphs.some(paragraph => paragraph.autoNum)) return paragraphs;
  const numbers = displayedNumbers(paragraphs);
  return paragraphs.map((paragraph, index) => numbers[index] === undefined ? paragraph : {...paragraph, number: {type: paragraph.autoNum.type ?? 'arabicPeriod', value: numbers[index]}});
}
