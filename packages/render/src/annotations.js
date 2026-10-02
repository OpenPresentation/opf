// Footnotes, citations and captions (RR-34). Core composition owns every box here: a captioned
// item carries `item.caption` (the band inside the block region; `item.box` is the media box), a
// slide whose runs cite or carry footnotes carries `geometry.footnotes` (the area above the footer
// band), and marker fragments (`kind: "marker"`) are drawn by the rich-text path in svg.js. This
// module only paints those boxes with the text fits core accepted. The draw helpers of svg.js are
// injected (`draw`) so the module needs no DOM and svg.js keeps its private helpers.

/** The caption band of a captioned item, in the muted text colour at core's caption box. */
export function renderCaption(item, bound, options, draw) {
  const caption = item.caption;
  if (!caption) return "";
  // A string or TextRun[] caption is its own value; the object form draws its `text`, so an inline
  // edit through the traced path never replaces the position or alignment.
  const path = typeof caption.value === "string" || Array.isArray(caption.value) ? caption.path : `${caption.path}.text`;
  const config = { path, fit: caption.fit, textStyle: caption.textStyle, fontFamily: caption.textStyle?.fontFamily ?? bound.design.fonts.body, fontSize: 15, align: caption.alignment, fill: bound.design.colors.mutedText, diagnosticsHandled: true, options, rich: Array.isArray(caption.text) };
  const body = Array.isArray(caption.text)
    ? draw.renderRichLines(caption.text, caption.fit, caption.box, bound, config)
    : draw.renderTextBox(caption.text, caption.box, bound, config);
  const trace = options.trace ? { "data-opf-caption": caption.position, "data-opf-caption-of": item.path, "data-opf-box-x": caption.box.x, "data-opf-box-y": caption.box.y, "data-opf-box-width": caption.box.width, "data-opf-box-height": caption.box.height } : {};
  return draw.tag("g", trace, body);
}

/**
 * The slide's footnote area: a rule in the border colour, then `<n> <text>` for each note the slide
 * uses, in number order, in the muted text colour. The listed lines are not source text (a reference
 * is listed with its number in front), so they carry no `data-opf-path`; the source of each entry is
 * traced on its group instead.
 */
export function renderFootnotes(bound, options, draw) {
  const footnotes = bound.geometry.footnotes;
  if (!footnotes) return "";
  const untraced = { ...options, trace: false };
  const { rule } = footnotes;
  const line = draw.tag("line", { x1: rule.x, y1: rule.y + rule.thickness / 2, x2: rule.x + rule.width, y2: rule.y + rule.thickness / 2, stroke: bound.design.colors.border, "stroke-width": rule.thickness });
  const entries = footnotes.entries.map(entry => {
    const config = { path: undefined, fit: entry.fit, textStyle: entry.textStyle, fontFamily: entry.textStyle?.fontFamily ?? bound.design.fonts.body, fontSize: 13, align: "left", fill: bound.design.colors.mutedText, diagnosticsHandled: true, options: untraced, rich: Array.isArray(entry.value) };
    const body = Array.isArray(entry.value)
      ? draw.renderRichLines(entry.value, entry.fit, entry.box, bound, config)
      : draw.renderTextBox(entry.value, entry.box, bound, config);
    const trace = options.trace ? { "data-opf-footnote": String(entry.number), "data-opf-footnote-kind": entry.kind, "data-opf-footnote-source": entry.sourcePath, ...(entry.id !== undefined ? { "data-opf-footnote-id": entry.id } : {}), "data-opf-box-x": entry.box.x, "data-opf-box-y": entry.box.y, "data-opf-box-width": entry.box.width, "data-opf-box-height": entry.box.height, ...(entry.overflow ? { "data-opf-overflow": "true" } : {}) } : {};
    return draw.tag("g", trace, body);
  });
  const trace = options.trace ? { "data-opf-footnotes": footnotes.path, "data-opf-box-x": footnotes.box.x, "data-opf-box-y": footnotes.box.y, "data-opf-box-width": footnotes.box.width, "data-opf-box-height": footnotes.box.height, "data-opf-footnote-markers": JSON.stringify(footnotes.markers.map(marker => [marker.path, marker.text])) } : {};
  return draw.tag("g", trace, [line, ...entries].join("\n"));
}
