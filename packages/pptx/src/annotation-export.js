// Native export of captions and footnote areas (RR-34). Core composition owns the geometry
// (`item.caption`, `geometry.footnotes`); this module writes one editable native text box per
// fitted line at those boxes, like every other measured text shape, and records the shape tags
// (OPF_CAPTION_V1, OPF_FOOTNOTES_V1) that annotation-provenance.js attaches at packaging and reads
// back at import. Citation markers need nothing here (a marker fragment carries `nominalSize`, the marked run size, which is what is written with baseline 30000; PowerPoint draws it at 2/3, measured 2026-10-01): they are `kind: "marker"` fragments of the
// rich-text fits and export through the ordinary rich-run path as superscript runs.

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
          hyperlink: fragment.kind !== 'marker' && fragment.run.link && /^(https?:|mailto:|tel:)/i.test(fragment.run.link) ? {url: fragment.run.link} : undefined}};
      });
      if (!runs.length) runs.push({text: '', options: {}});
      const placed = fit.placement?.lines[index];
      const area = placed ? {x: (placed.x + line.width * factor - box.width * factor) / 96, y: placed.y / 96, w: box.width / 96, h: placed.height / 96}
        : {x: box.x / 96, y: (box.y + line.y) / 96, w: box.width / 96, h: line.height / 96};
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
    const area = placed ? {x: (placed.x + placed.width * factor - box.width * factor) / 96, y: (placed.baseline - fit.fontSize) / 96, w: box.width / 96, h: placed.height / 96}
      : {x: box.x / 96, y: (box.y + index * fit.lineHeight) / 96, w: box.width / 96, h: fit.lineHeight / 96};
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
  const record = {v: 1, role: 'caption', path: item.path, field: caption.path, media: mediaName ?? null, position: caption.position, align: caption.alignment};
  addFitLines(slide, caption.text, caption.fit, caption.box, context, helpers, {objectName: captionShapeName(item.path), record, tags: context.captionTags, align: caption.alignment, color: context.mutedColor, fontFamily: helpers.nativeFontOptions(caption.textStyle).fontFace, error});
}

/** The footnote area: a rule shape and one tagged text box per listed line, at core's geometry above the footer band. */
export function addFootnotes(slide, footnotes, slideIndex, context, helpers, error) {
  if (!footnotes) return;
  const {rule} = footnotes, ruleName = footnotesRuleName(slideIndex);
  if (context.provenanceMode !== false) context.footnoteTags.set(ruleName, {v: 1, role: 'rule', slide: slideIndex});
  slide.addShape('line', {x: rule.x / 96, y: (rule.y + rule.thickness / 2) / 96, w: rule.width / 96, h: 0, line: {color: context.colors.border, width: rule.thickness * .75}, objectName: ruleName});
  footnotes.entries.forEach((entry, index) => {
    const record = {v: 1, role: 'entry', slide: slideIndex, entry: index, number: entry.number, kind: entry.kind, ...(entry.id !== undefined ? {id: entry.id} : {}), source: entry.sourcePath, ...(entry.url !== undefined ? {url: entry.url} : {})};
    addFitLines(slide, entry.value, entry.fit, entry.box, context, helpers, {objectName: footnoteEntryName(slideIndex, index), record, tags: context.footnoteTags, align: 'left', color: context.mutedColor, fontFamily: helpers.nativeFontOptions(entry.textStyle).fontFace, error});
  });
}
