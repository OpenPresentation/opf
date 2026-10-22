// Rich headline text on import (FA-10): the title, subtitle, tag and quote body as `string | TextRun[]`.
//
// A heading or quote body is read from its current native runs, the way body text is (src/body-text-import.js): formatting that
// is only the heading's own look (the size, family, weight and colour every run of it shares) is not authored run style, so a
// uniform heading is a plain string and a heading with a differently formatted word is TextRun[] that carries only what
// differs. Links are content, never defaults. Tagged line shapes (the export writes one native text box per laid-out line)
// are joined with the boundaries their tags record; soft wraps insert nothing and hard boundaries keep their separator.

import {splitWeightFace} from './font-weights.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
// The run properties that describe how a heading looks. `link` and `text` are never defaults.
const LOOK = ['bold', 'italic', 'underline', 'strikethrough', 'superscript', 'subscript', 'fontSize', 'fontFamily', 'color', '_opfScheme'];

const asParts = value => Array.isArray(value) ? value : value === undefined ? [] : [value];

/**
 * The raw runs of an ordered group of native line shapes. `readBody(shapeIndex)` is the native body reader (paragraphs with
 * `richText`); `separatorOf(item, last)` is the text between this line and the next ('' for a soft wrap). Returns undefined when a
 * shape has no readable body, so the caller keeps the plain text path.
 */
export function joinRichLines(ordered, readBody, separatorOf) {
  const parts = [];
  for (const [position, item] of ordered.entries()) {
    const body = readBody?.(item.index);
    if (!Array.isArray(body) || !body.length) return undefined;
    body.forEach((paragraph, index) => {
      if (index) parts.push('\n');
      parts.push(...asParts(paragraph.richText ?? paragraph.text));
    });
    const separator = separatorOf(item, position === ordered.length - 1);
    if (separator) parts.push(separator);
  }
  return parts;
}

const styleKey = run => JSON.stringify(Object.keys(run).filter(key => key !== 'text').sort().map(key => [key, run[key]]));
const BOOLEANS = ['bold', 'italic', 'underline', 'strikethrough', 'superscript', 'subscript'];
const sameColor = (a, b) => typeof a === 'string' && typeof b === 'string' && a.slice(0, 7).toUpperCase() === b.slice(0, 7).toUpperCase();
const sameFamily = (a, b) => typeof a === 'string' && typeof b === 'string' && (a.trim().toLowerCase() === b.trim().toLowerCase() || splitWeightFace(b)?.family.toLowerCase() === a.trim().toLowerCase());
// Whether a run's value for a look property is the heading's own default (what the exporter wrote on every run).
const isDefault = {
  bold: (value, base) => value === base.bold,
  color: (value, base) => sameColor(value, base.color),
  fontSize: (value, base) => Number.isFinite(value) && Math.abs(value - base.fontSize) <= 0.011,
  fontFamily: (value, base) => sameFamily(value, base.fontFamily)
};

/**
 * `string | TextRun[]` for raw runs. Formatting that is only the heading's own look is not authored run style:
 * - with `base` (the defaults a tagged export recorded: `{bold, color, fontSize, fontFamily}`) a run's value equal to its default is removed;
 * - without it (a native shape) a value every run shares is removed;
 * - a false flag is the absence of the style (a `bold: false` is kept only where the heading is bold by default).
 * Adjacent runs left with the same formatting merge; no remaining formatting is a plain string. Links are content and are kept.
 */
export function headingValue(parts, base) {
  const runs = parts.map(part => typeof part === 'string' ? {text: part} : {...part}).filter(run => typeof run.text === 'string' && run.text !== '');
  if (!runs.length) return '';
  const defaults = base && typeof base === 'object' ? base : undefined;
  // A hyperlink run is drawn underlined natively; that is the link's look, not an authored underline.
  for (const run of runs) if (run.link !== undefined && run.underline === true) delete run.underline;
  // PowerPoint writes no b attribute for a run that is not bold, so where the heading is bold by default an unmarked run is a lighter one.
  const lineBreak = run => /^[\r\n]+$/.test(run.text);
  if (defaults?.bold === true) for (const run of runs) if (run.bold !== true && !lineBreak(run)) run.bold = false;
  for (const key of LOOK) {
    if (!runs.some(run => run[key] !== undefined)) continue;
    if (defaults && isDefault[key] && defaults[key === 'fontFamily' ? 'fontFamily' : key] !== undefined) {
      for (const run of runs) if (run[key] !== undefined && isDefault[key](run[key], defaults)) delete run[key];
    } else if (!defaults) {
      // A bare line break between paragraphs carries no formatting of its own and does not count against uniformity.
      const styled = runs.filter(run => !lineBreak(run));
      const first = JSON.stringify(styled[0]?.[key]);
      if (styled.length && styled[0][key] !== undefined && styled.every(run => run[key] !== undefined && JSON.stringify(run[key]) === first)) for (const run of runs) delete run[key];
    }
  }
  for (const key of BOOLEANS) {
    if (key === 'bold' && (defaults?.bold === true || runs.some(run => run.bold === true))) continue;
    for (const run of runs) if (run[key] === false) delete run[key];
  }
  for (const run of runs) if (run._opfScheme !== undefined && run.color === undefined) delete run._opfScheme;
  const merged = [];
  for (const run of runs) {
    const last = merged.at(-1);
    if (last && styleKey(last) === styleKey(run)) last.text += run.text;
    else merged.push(run);
  }
  if (merged.every(run => Object.keys(run).length === 1)) return merged.map(run => run.text).join('');
  return merged.map(run => Object.keys(run).length === 1 ? run.text : run);
}

/** Remove the opening and closing quotation mark an exported quote body carries (core joins them to the first and last run). */
export function unwrapQuoteRuns(value) {
  if (!Array.isArray(value)) return typeof value === 'string' && value.length >= 2 && value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
  const text = run => typeof run === 'string' ? run : run.text;
  if (!value.length || !text(value[0]).startsWith('"') || !text(value.at(-1)).endsWith('"') || (value.length === 1 && text(value[0]).length < 2)) return value;
  const runs = value.map(run => typeof run === 'string' ? run : {...run});
  const edit = (index, change) => {
    const run = runs[index];
    if (typeof run === 'string') runs[index] = change(run); else run.text = change(run.text);
  };
  edit(0, text => text.slice(1));
  edit(runs.length - 1, text => text.slice(0, -1));
  const kept = runs.filter(run => text(run) !== '');
  if (!kept.length) return '';
  return kept.every(run => typeof run === 'string') ? kept.join('') : kept;
}

export const isRichValue = value => Array.isArray(value) && value.some(run => object(run));

/** The recorded defaults of a rich heading or quote body, kept only where each value has the expected type. */
export function cleanBase(raw) {
  if (!object(raw)) return undefined;
  const base = {};
  if (typeof raw.bold === 'boolean') base.bold = raw.bold;
  if (typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color)) base.color = raw.color;
  if (Number.isFinite(raw.fontSize) && raw.fontSize > 0 && raw.fontSize < 10000) base.fontSize = raw.fontSize;
  if (typeof raw.fontFamily === 'string' && raw.fontFamily.length > 0 && raw.fontFamily.length <= 200) base.fontFamily = raw.fontFamily;
  return Object.keys(base).length ? base : undefined;
}
