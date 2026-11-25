// Native export of captions and footnote areas (RR-34). Core composition owns the geometry
// (`item.caption`, `geometry.footnotes`); this module writes one editable native text box per
// fitted line at those boxes, like every other measured text shape, and records the shape tags
// (OPF_CAPTION_V1, OPF_FOOTNOTES_V1) that annotation-provenance.js attaches at packaging and reads
// back at import. Citation markers need nothing here (a marker fragment carries `nominalSize`, the marked run size, which is what is written with baseline 30000; PowerPoint draws it at 2/3, measured 2026-10-01): they are `kind: "marker"` fragments of the
// rich-text fits and export through the ordinary rich-run path as superscript runs. RR-105: the rule's tag lists the markers of
// empty runs (`detached`), which natively follow the text before them.
import {paragraphDirection, walkCitationRuns} from '@openpresentation/opf/composition';
import {exportHyperlink} from './slide-links.js';

// The whitespace that hangs at a line's soft wrap (core's TextLineSource.hang, RichTextLine.hang, TextPlacementLine.hang) in a PowerPoint
// line box: one paragraph that ends in that whitespace. Core aligns the line's glyphs and the preview draws them there; PowerPoint aligns
// the paragraph with the whitespace counted on one side, so the box is anchored that much off the glyphs' anchor that PowerPoint puts
// them where the preview does. Which side PowerPoint counts it on follows the line's own text, not the deck (PowerPoint 2026-11-24/25).

// A character that stays left to right at the end of a line of a right-to-left paragraph, right before the hanging whitespace: a letter,
// a digit (also with its percent sign) or a closing bracket.
const LEFT_TO_RIGHT_BEFORE_SPACE = /(?:[\p{L}\p{N})\]}]|\p{N}%)[^\S\r\n\u00a0\u202f\ufeff]+$/u;

/**
 * Whether PowerPoint counts the whitespace hanging at the end of a left-to-right line of a right-to-left deck on the line's right, as in a
 * left-to-right deck. Measured in PowerPoint on 2026-11-25 (an 18-slide deck of English paragraphs in a Hebrew deck, left-aligned,
 * centered and right-aligned, the wrapped line ending in each of the characters below and its space): after a letter, a digit and a
 * closing parenthesis the space is counted on the right (the line ended a space short of the right edge, or half a space left of the
 * center, where it was not accounted for); after a comma, a period and a straight quotation mark it is not counted there (those
 * characters and the space take the paragraph's right-to-left direction; PowerPoint draws "planning ,"). That is the bidirectional
 * algorithm: a letter is left to right, a digit after letters becomes so, a bracket around left-to-right text does too, and other
 * punctuation at the end of the line follows the paragraph. Brackets other than the round one and the percent sign follow from that
 * rule and were not measured.
 */
export function countsSpaceAfterLeftToRightText(text) {
  return LEFT_TO_RIGHT_BEFORE_SPACE.test(String(text ?? ''));
}

/**
 * How far the anchor of a line's PowerPoint paragraph is from its glyphs' anchor, `factor` being 0, 0.5 or 1 (left, center, right):
 * - a line whose text is right to left (by its first strong character), in any deck: PowerPoint counts the whitespace at its left end
 *   (centered half a hang and left-aligned a whole hang to the left) and ignores it when the line is right-aligned (2026-10-02,
 *   2026-11-24 and 2026-11-25: Hebrew and Arabic in right-to-left and left-to-right decks);
 * - a left-to-right line of a left-to-right deck: counted at its right end (`hang * factor`);
 * - a left-to-right line of a right-to-left deck (`rtlDeck`): as in a left-to-right deck when countsSpaceAfterLeftToRightText, else
 *   not at all.
 */
export function paragraphHangShift({text, hang, factor, rtlDeck}) {
  if (!(hang > 0)) return 0;
  if (paragraphDirection(String(text ?? ''), 'rtl') === 'rtl') return hang * (factor - 1);
  if (rtlDeck && !countsSpaceAfterLeftToRightText(text)) return 0;
  return hang * factor;
}

/**
 * The anchor of a line's glyphs: from core's placement, which put the whitespace on the left of a line it laid out right to left
 * (`direction`, core's fit.directions entry) and on the right of any other; else the box's own anchor (core aligned the glyphs there).
 */
export function glyphAnchor({placed, box, factor, direction}) {
  if (!placed) return box.x + box.width * factor;
  const hang = placed.hang > 0 ? placed.hang : 0;
  return placed.x + (direction === 'rtl' ? hang : 0) + (placed.width - hang) * factor;
}

/**
 * Where a line's PowerPoint paragraph is anchored: its glyphs' anchor plus paragraphHangShift. `directions` is core's fit.directions (present
 * only in a right-to-left deck), `index` the line's.
 */
export function paragraphAnchor({placed, line, text, box, factor, directions, index}) {
  const hang = placed ? placed.hang : line?.hang;
  return glyphAnchor({placed, box, factor, direction: directions?.[index]}) + paragraphHangShift({text, hang, factor, rtlDeck: !!directions});
}

export const CAPTION_TAG = 'OPF_CAPTION_V1';
export const FOOTNOTES_TAG = 'OPF_FOOTNOTES_V1';

export const captionShapeName = path => `OPF caption ${path}`;
export const footnotesRuleName = slideIndex => `OPF footnotes ${slideIndex} rule`;
export const footnoteEntryName = (slideIndex, entry) => `OPF footnotes ${slideIndex} entry ${entry}`;


const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF￾￿]/u;

/**
 * Write a core text fit (plain `fit.lines` with optional `sourceLines`/`placement`, or a rich fit
 * with `richLines`) as one native text box per line at `box`, named `${objectName} line N` and
 * recorded in `tags` with `record` plus the line's position and source boundary. `helpers` are the
 * exporter's private text helpers (textBoxOptions, nativeFontOptions, exportColor, nativeColor).
 */
export function addFitLines(slide, value, fit, box, context, helpers, {objectName, record, tags, align = 'left', color, fontFamily, error}) {
  const text = typeof value === 'string' ? value : value.map(run => typeof run === 'string' ? run : run.text).join('');
  const invalid = INVALID_XML.exec(text);
  if (invalid) throw error('invalid-text', `Text contains U+${invalid[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0')} at UTF-16 offset ${invalid.index}, which DrawingML XML cannot represent.`);
  const factor = align === 'right' ? 1 : align === 'center' ? .5 : 0;
  const lineColor = (color ?? context.textColor).replace(/^#/, '');
  // `provenance: false` writes no tags at all (like every other OPF record): the lines stay named, untagged text boxes.
  const tagged = context.provenanceMode === false ? new Map() : tags;
  tags = tagged;
  if (fit.richLines) {
    const count = fit.richLines.length;
    fit.richLines.forEach((line, index) => {
      const runs = line.fragments.map(fragment => {
        const runColor = helpers.exportColor(fragment.run.color, context, lineColor), native = helpers.nativeColor(fragment.run.color, runColor, context, lineColor);
        return {text: fragment.text, options: {...helpers.nativeFontOptions(fragment.style), fontSize: (fragment.nominalSize ?? fragment.fontSize) * .75, color: native,
          underline: fragment.run.underline ? {style: 'sng', color: native} : undefined, strike: fragment.run.strikethrough ? 'sngStrike' : undefined,
          baseline: fragment.baselineShift ? -fragment.baselineShift / (fragment.nominalSize ?? fragment.fontSize) * 2000 : undefined,
          hyperlink: (fragment.kind !== 'marker' ? exportHyperlink(fragment.run.link, context) : undefined)}};
      });
      if (!runs.length) runs.push({text: '', options: {}});
      const placed = fit.placement?.lines[index];
      // PowerPoint counts the whitespace at a paragraph end in its alignment: a line whose whitespace hangs at a soft wrap is anchored that
      // much past its glyphs (core's placement does it for a placed line, RichTextLine.hang for one it did not place).
      // A line whose whitespace hangs at its wrap is anchored as PowerPoint counts that whitespace (paragraphAnchor).
      const anchor = paragraphAnchor({placed, line, text: fit.lines?.[index] ?? line.fragments.map(fragment => fragment.text).join(''), box, factor, directions: fit.directions, index});
      const area = placed ? {x: (anchor - box.width * factor) / 96, y: placed.y / 96, w: box.width / 96, h: placed.height / 96}
        : {x: (anchor - box.width * factor) / 96, y: (box.y + line.y) / 96, w: box.width / 96, h: line.height / 96};
      const name = `${objectName} line ${index}`;
      tags.set(name, {...record, line: index, count, boundary: index === count - 1 ? 'end' : 'soft', separator: '', rich: true});
      slide.addText(runs, {...helpers.textBoxOptions(area, context, fit.fontSize * .75), ...(fontFamily ? {fontFace: fontFamily} : {}), color: lineColor, align, fit: 'none', wrap: false, lineSpacingMultiple: 1, objectName: name});
    });
    return;
  }
  const count = fit.lines.length;
  fit.lines.forEach((line, index) => {
    const placed = fit.placement?.lines[index], sourceLine = fit.sourceLines?.[index];
    const boundary = sourceLine ? {boundary: sourceLine.boundary, separator: text.slice(sourceLine.end, sourceLine.nextStart)} : {boundary: index === count - 1 ? 'end' : 'soft', separator: ''};
    const anchor = paragraphAnchor({placed, line: sourceLine, text: line, box, factor, directions: fit.directions, index});
    const area = placed ? {x: (anchor - box.width * factor) / 96, y: (placed.baseline - fit.fontSize) / 96, w: box.width / 96, h: placed.height / 96}
      : {x: (anchor - box.width * factor) / 96, y: (box.y + index * fit.lineHeight) / 96, w: box.width / 96, h: fit.lineHeight / 96};
    const name = `${objectName} line ${index}`;
    tags.set(name, {...record, line: index, count, ...boundary});
    slide.addText(line, {...helpers.textBoxOptions(area, context, fit.fontSize * .75), ...(fontFamily ? {fontFace: fontFamily} : {}), color: lineColor, align, fit: 'none', wrap: false, lineSpacingMultiple: 1,
      tabStops: sourceLine?.segments.filter(segment => segment.kind === 'tab').map(segment => ({position: (segment.x + segment.width) / 96, alignment: 'l'})), objectName: name});
  });
}

/** The caption band of a captioned item: one tagged text box per line, linked to the media shape by name. */
export function addCaption(slide, item, mediaName, context, helpers, error) {
  const caption = item.caption;
  if (!caption) return;
  // The record keeps the document's word for the alignment (start, center, end); `caption.alignment` is the engine's (left is the start edge).
  const record = {v: 1, role: 'caption', path: item.path, field: caption.path, media: mediaName ?? null, position: caption.position, align: {left: 'start', center: 'center', right: 'end'}[caption.alignment]};
  addFitLines(slide, caption.text, caption.fit, caption.box, context, helpers, {objectName: captionShapeName(item.path), record, tags: context.captionTags, align: caption.alignment, color: context.mutedColor, fontFamily: helpers.nativeFontOptions(caption.textStyle).fontFace, error});
}

/**
 * RR-105: the markers of `source` (the slide) whose run is empty (`{"text": "", "cite": "a"}`), as `{path, at}`: the run array's path
 * (`text`, `items.0.text`, `title`) and the marker's place among the markers of that array. Natively the marker run follows the text
 * before it, so import needs this to give the empty run back instead of marking the run before it.
 */
export function detachedMarkers(source) {
  const counts = new Map(), detached = [];
  walkCitationRuns(source, '', entry => {
    const path = entry.path.replace(/^\./, '').replace(/\.\d+$/, ''), at = counts.get(path) ?? 0;
    counts.set(path, at + 1);
    if (entry.run.text === '') detached.push({path, at});
  });
  return detached;
}

/** The footnote area: a rule shape and one tagged text box per listed line, at core's geometry above the footer band. */
export function addFootnotes(slide, footnotes, slideIndex, context, helpers, error, source) {
  if (!footnotes) return;
  const {rule} = footnotes, ruleName = footnotesRuleName(slideIndex), detached = source === undefined ? [] : detachedMarkers(source);
  if (context.provenanceMode !== false) context.footnoteTags.set(ruleName, {v: 1, role: 'rule', slide: slideIndex, ...(detached.length ? {detached} : {})});
  slide.addShape('line', {x: rule.x / 96, y: (rule.y + rule.thickness / 2) / 96, w: rule.width / 96, h: 0, line: {color: context.colors.border, width: rule.thickness * .75}, objectName: ruleName});
  footnotes.entries.forEach((entry, index) => {
    const record = {v: 1, role: 'entry', slide: slideIndex, entry: index, number: entry.number, kind: entry.kind, ...(entry.id !== undefined ? {id: entry.id} : {}), source: entry.sourcePath, ...(entry.link !== undefined ? {link: entry.link} : {})};
    addFitLines(slide, entry.value, entry.fit, entry.box, context, helpers, {objectName: footnoteEntryName(slideIndex, index), record, tags: context.footnoteTags, align: 'left', color: context.mutedColor, fontFamily: helpers.nativeFontOptions(entry.textStyle).fontFace, error});
  });
}
