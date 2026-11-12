// LH-106 (vetoable, 2026-11-12): a native chart draws its numbers in the language's digits.
//
// PowerPoint formats a native chart's values itself, with the chart's number format codes, and draws Latin digits whatever the run
// language. An Excel numeral-shape prefix on the format code changes that: PowerPoint 16.0.20527 draws `[$-2000000]#,##0.00` as
// "٤,٥٠٠.٠٠" (Arabic-Indic digits, Latin separators) and `[$-3000000]#,##0.00` as "۴٬۵۰۰٫۰۰" (Persian). So in a slide whose language
// draws digits of its own (core `numeralShapePrefix`), every number format code of its charts and chartex charts carries the prefix:
// series caches, data labels and value axes, a percent label (`0%`) included. Import strips it again (`stripNumeralShape`): the
// language carries the digits, so the document comes back as it was.
import {numeralShapePrefix} from '@openpresentation/opf/composition';

/** A numeral-shape prefix: `[$-` and seven or eight hex digits whose high digits name the shape (`[$-2000000]`, `[$-2000401]`). */
const SHAPE = /^\[\$-[1-9A-Fa-f][0-9A-Fa-f]{6}\]/;

/** `code` without its numeral-shape prefix (an LCID-only block such as `[$-409]` stays). */
export const stripNumeralShape = code => typeof code === 'string' ? code.replace(/(^|;)\[\$-[1-9A-Fa-f][0-9A-Fa-f]{6}\]/g, '$1') : code;

// Every section of a code (`"+"#,##0.0;"−"#,##0.0;#,##0.0`, a waterfall's steps) takes the prefix: a section is drawn with its own.
const sections = code => {
  const out = [];
  let current = '', quoted = false;
  for (const character of code) {
    if (character === '"') quoted = !quoted;
    if (character === ';' && !quoted) { out.push(current); current = ''; continue; }
    current += character;
  }
  return [...out, current];
};
const shaped = (code, prefix) => sections(code.replaceAll('&quot;', '"')).map(section => SHAPE.test(section) ? section : `${prefix}${section}`).join(';').replaceAll('"', code.includes('&quot;') ? '&quot;' : '"');

/** The chart XML with every format code prefixed, and a percent-only data label block given the `0%` code it draws with. */
export function shapeChartNumbers(xml, prefix) {
  if (!prefix) return xml;
  let out = xml
    .replace(/(<(?:c|cx):numFmt\b[^>]*\bformatCode=")([^"]*)"/g, (_, start, code) => `${start}${shaped(code, prefix)}"`)
    .replace(/(<cx:lvl\b[^>]*\bformatCode=")([^"]*)"/g, (_, start, code) => `${start}${shaped(code, prefix)}"`)
    .replace(/<c:formatCode>([^<]*)<\/c:formatCode>/g, (_, code) => `<c:formatCode>${shaped(code, prefix)}</c:formatCode>`);
  // A pie's percentages: PowerPoint draws a label that shows only the percentage with its own `0%`, so the label block names it.
  out = out.replace(/<c:dLbls>[\s\S]*?<\/c:dLbls>/g, block => {
    if (!/<c:showPercent val="1"\/>/.test(block) || /<c:showVal val="1"\/>/.test(block)) return block;
    const code = `${prefix}0%`;
    return /<c:numFmt\b/.test(block) ? block.replace(/<c:numFmt\b[^>]*\/>/g, `<c:numFmt formatCode="${code}" sourceLinked="0"/>`) : block;
  });
  return out;
}

/**
 * Prefix the number formats of every native chart part (`ppt/charts/chart*.xml`, `ppt/charts/chartEx*.xml`) by the language of the
 * slide it belongs to (`partSlides`: part path -> slide index; `languageOf(index)`: that slide's language tag). Entries change in place.
 */
export function applyNumeralShapes(entries, partSlides, languageOf) {
  const decoder = new TextDecoder(), encoder = new TextEncoder();
  for (const [part, slide] of partSlides) {
    if (!/^ppt\/charts\/chart(?:Ex)?\d+\.xml$/i.test(part) || !entries[part]) continue;
    const prefix = numeralShapePrefix(languageOf(slide));
    if (!prefix) continue;
    const bytes = entries[part], text = typeof bytes === 'string' ? bytes : decoder.decode(bytes);
    const next = shapeChartNumbers(text, prefix);
    if (next !== text) entries[part] = typeof bytes === 'string' ? next : encoder.encode(next);
  }
}
