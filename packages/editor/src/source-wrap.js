import { RangeSetBuilder, countColumn } from "@codemirror/state";
import { Decoration, ViewPlugin } from "@codemirror/view";

// A wrapped line continues under its own indentation, as VS Code's `wrappingIndent: "indent"` does (JSON, YAML and Markdown).
// Each line carries a class `opf-hang-<n>`; the stylesheet (panels.css) turns n columns into a left padding and the same negative
// text-indent, so the first line starts where it always did and every continuation line starts n columns in. n is the line's leading
// whitespace (a tab counts as the editor's tab size) plus the width of a list marker ("- ", "1. ") when the line starts one, so wrapped
// list items line up under their text, or plus two columns (one indent step) for any other line, so a continuation never looks like a new line.

/** The most columns a line can hang. The stylesheet defines `opf-hang-0` through `opf-hang-${MAX_HANG}`, and caps the indent at 40% of the line. */
export const MAX_HANG = 32;
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

const decorations = Array.from({ length: MAX_HANG + 1 }, (_, columns) => Decoration.line({ class: `opf-hang-${columns}` }));

function build(view) {
  const builder = new RangeSetBuilder();
  const { doc, tabSize } = view.state;
  let last = -1;
  for (const { from, to } of view.visibleRanges) {
    for (let position = from; position <= to;) {
      const line = doc.lineAt(position);
      if (line.from > last) {
        builder.add(line.from, line.from, decorations[hangColumns(line.text, tabSize)]);
        last = line.from;
      }
      position = line.to + 1;
    }
  }
  return builder.finish();
}

/** The extension: line decorations for the visible lines (a line is decorated again when the document, the viewport or the tab size changes). */
export const hangingIndent = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = build(view);
    }
    update(update) {
      if (update.docChanged || update.viewportChanged || update.startState.tabSize !== update.state.tabSize) this.decorations = build(update.view);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);
