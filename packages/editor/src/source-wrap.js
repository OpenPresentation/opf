import { RangeSetBuilder, StateEffect, countColumn } from "@codemirror/state";
import { Decoration, ViewPlugin } from "@codemirror/view";

// A wrapped line continues under its own indentation, as VS Code's `wrappingIndent: "indent"` does (JSON, YAML and Markdown).
// Each line carries a class `opf-hang-<n>`; the stylesheet (panels.css) turns n columns into a left padding and the same negative
// text-indent, so the first line starts where it always did and every continuation line starts n columns in. n is the line's leading
// whitespace (a tab counts as the editor's tab size) plus the width of a list marker ("- ", "1. ") when the line starts one, so wrapped
// list items line up under their text, or plus two columns (one indent step) for any other line, so a continuation never looks like a new line.
// The hang is capped at 40% of the line's width, so a deeply nested line still leaves room for text on a phone. The cap is worked out here, in
// columns, from the measured width, and not in the stylesheet: a percentage in `padding-left` makes the style and layout of every line depend on
// its containing block, and replacing the text of a long document then took about 15 times as long (0.26.7).

/** The most columns a line can hang. The stylesheet defines `opf-hang-0` through `opf-hang-${MAX_HANG}`. */
export const MAX_HANG = 32;
/** The share of the line's width a hang can take. */
export const HANG_SHARE = 0.4;
const LIST_MARKER = /^([-*+]|\d{1,9}[.)])[ \t]+/;
const OFFSET = 2;

/** How many columns the continuation lines of `text` are indented. */
export function hangColumns(text, tabSize = 4) {
  let at = 0;
  while (at < text.length && (text[at] === " " || text[at] === "\t")) at++;
  const indent = countColumn(text.slice(0, at), tabSize);
  const marker = LIST_MARKER.exec(text.slice(at));
  const columns = marker ? indent + countColumn(marker[0], tabSize) : indent + OFFSET;
  return Math.min(columns, MAX_HANG);
}

/**
 * The most columns a line can hang in a line `width` pixels wide whose columns are `columnWidth` pixels wide: 40% of the width, in whole
 * columns, never above MAX_HANG. `MAX_HANG` when either size is unknown (zero, negative or not a number), for example while the editor is hidden.
 */
export function hangCap(width, columnWidth) {
  if (!(width > 0) || !(columnWidth > 0)) return MAX_HANG;
  return Math.max(0, Math.min(MAX_HANG, Math.floor((width * HANG_SHARE) / columnWidth)));
}

const decorations = Array.from({ length: MAX_HANG + 1 }, (_, columns) => Decoration.line({ class: `opf-hang-${columns}` }));

function build(view, cap) {
  const builder = new RangeSetBuilder();
  const { doc, tabSize } = view.state;
  let last = -1;
  for (const { from, to } of view.visibleRanges) {
    for (let position = from; position <= to;) {
      const line = doc.lineAt(position);
      if (line.from > last) {
        builder.add(line.from, line.from, decorations[Math.min(hangColumns(line.text, tabSize), cap)]);
        last = line.from;
      }
      position = line.to + 1;
    }
  }
  return builder.finish();
}

const setCap = StateEffect.define();

/** The width of the text area of a line, in pixels: the content box of the editor's content element, which is what a percentage would have resolved against. */
function lineWidth(view) {
  const content = view.contentDOM, style = getComputedStyle(content);
  return content.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
}

/**
 * The extension: line decorations for the visible lines (a line is decorated again when the document, the viewport, the tab size or the cap
 * changes). The cap is measured in CodeMirror's measure cycle whenever the geometry changes, and the lines are decorated again only when it differs.
 */
export const hangingIndent = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.cap = MAX_HANG;
      this.decorations = build(view, this.cap);
      this.measure = {
        key: this,
        read: (target) => hangCap(lineWidth(target), target.defaultCharacterWidth),
        write: (cap, target) => {
          if (cap === this.cap) return;
          // The measure cycle is an update in progress: the new cap is dispatched right after it, before the browser paints.
          queueMicrotask(() => { if (!this.destroyed) target.dispatch({ effects: setCap.of(cap) }); });
        },
      };
      view.requestMeasure(this.measure);
    }
    update(update) {
      let capped = false;
      for (const transaction of update.transactions) for (const effect of transaction.effects) if (effect.is(setCap)) { this.cap = effect.value; capped = true; }
      if (update.geometryChanged || update.viewportChanged) update.view.requestMeasure(this.measure);
      if (capped || update.docChanged || update.viewportChanged || update.startState.tabSize !== update.state.tabSize) this.decorations = build(update.view, this.cap);
    }
    destroy() {
      this.destroyed = true;
    }
  },
  { decorations: (plugin) => plugin.decorations },
);
