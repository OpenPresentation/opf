// Folding in the source editor (artifacts/source-editor/SPEC.md, sections 6.8 and 8.5): a fold gutter, and VS Code's commands over it. Fold and Unfold work
// on the innermost range around the caret; Fold All, Unfold All, Fold Level 1 to 7, Fold and Unfold Recursively and Toggle Fold are the chords of
// Cmd/Ctrl+K. The ranges are the language's own (JSON objects and lists, YAML by indent) and, for Markdown, the front matter, each fence and each slide
// (source-editing.js `markdownFoldIndex`, one pass over the text). Nothing here reads the whole text unless a command that needs every range runs.
import { EditorState } from "@codemirror/state";
import { foldEffect, foldGutter, foldable, foldedRanges, unfoldEffect } from "@codemirror/language";

const svg = (open) => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  node.setAttribute("viewBox", "0 0 16 16");
  node.setAttribute("width", "12");
  node.setAttribute("height", "12");
  node.setAttribute("aria-hidden", "true");
  node.setAttribute("focusable", "false");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", open ? "M4 6l4 4 4-4" : "M6 4l4 4-4 4");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.6");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  node.append(path);
  return node;
};

/** The fold gutter: a chevron beside every line that starts a foldable range; clicking it folds or unfolds. Keys are in source-keymap.js. */
export const foldGutterExtension = [
  foldGutter({
    markerDOM(open) {
      const marker = document.createElement("span");
      marker.className = `opf-fold-marker ${open ? "is-open" : "is-folded"}`;
      marker.append(svg(open));
      return marker;
    },
  }),
  EditorState.phrases.of({ "Folded lines": "Folded lines", "Unfolded lines": "Unfolded lines", to: "to", "folded code": "folded code", unfold: "unfold", "Fold line": "Fold", "Unfold line": "Unfold" }),
];

// ---- ranges ----------------------------------------------------------------------------------------------------------------------------
/** The fold that starts on the line of `from` and covers [from, to), or null. */
const foldedAt = (state, from, to) => {
  let found = null;
  foldedRanges(state).between(from, to, (start, end) => { if (start >= from && start <= to) { found = { from: start, to: end }; return false; } return undefined; });
  return found;
};
const isFolded = (state, range) => {
  let found = false;
  foldedRanges(state).between(range.from, range.to, (start, end) => { if (start === range.from && end === range.to) found = true; });
  return found;
};

/** Every foldable range of the text, outermost first, with its nesting `level` (1 = not inside another): `{ from, to, line, level }`. */
export function allFoldRanges(state) {
  const ranges = [];
  for (let number = 1; number <= state.doc.lines; number++) {
    const line = state.doc.line(number);
    const range = foldable(state, line.from, line.to);
    if (range && range.to > range.from) ranges.push({ from: range.from, to: range.to, line: number, level: 1 });
  }
  // A range inside another one is one level deeper. The ranges come in order of their first line, so a stack of the open ones finds the parent.
  const open = [];
  for (const range of ranges) {
    while (open.length && open.at(-1).to < range.from) open.pop();
    range.level = open.length + 1;
    open.push(range);
  }
  return ranges;
}

/** The innermost foldable range around the caret line that is (`folded`) or is not folded yet (VS Code's Fold), or null. */
function rangeAround(state, position, { folded = false } = {}) {
  const here = state.doc.lineAt(position).number;
  for (let number = here; number >= 1; number--) {
    const line = state.doc.line(number);
    const range = foldable(state, line.from, line.to);
    if (!range || range.to <= range.from) continue;
    if (number !== here && state.doc.lineAt(range.to).number < here) continue;
    if (isFolded(state, range) === folded) return { from: range.from, to: range.to, line: number };
  }
  return null;
}

const dispatchFolds = (view, effects) => { if (!effects.length) return false; view.dispatch({ effects, scrollIntoView: true }); return true; };

// ---- commands --------------------------------------------------------------------------------------------------------------------------
/** Fold: the innermost range around the caret. */
export function fold(view, say) {
  const range = rangeAround(view.state, view.state.selection.main.head);
  if (!range) { say?.("Nothing to fold here"); return true; }
  view.dispatch({ effects: foldEffect.of({ from: range.from, to: range.to }), selection: { anchor: Math.min(view.state.selection.main.head, range.from) }, scrollIntoView: true });
  say?.("Folded");
  return true;
}

/** Unfold: the fold on the caret line, else the fold that hides the caret. */
export function unfold(view, say) {
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.head);
  const found = foldedAt(state, line.from, line.to);
  if (!found) { say?.("Nothing to unfold here"); return true; }
  view.dispatch({ effects: unfoldEffect.of(found), scrollIntoView: true });
  say?.("Unfolded");
  return true;
}

/** Toggle Fold: unfold the fold on the caret line, else fold the range around the caret. */
export function toggleFoldHere(view, say) {
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.head);
  return foldedAt(state, line.from, line.to) ? unfold(view, say) : fold(view, say);
}

/** Fold All: every range, nested ones too (unfolding an outer range leaves the inner ones folded, as in VS Code). */
export function foldEverything(view, say) {
  const ranges = allFoldRanges(view.state).filter((range) => !isFolded(view.state, range));
  const effects = ranges.map((range) => foldEffect.of({ from: range.from, to: range.to }));
  if (!effects.length) { say?.("Nothing to fold"); return true; }
  // The caret goes to the start of the line that now hides it, not into hidden text.
  const caret = view.state.selection.main.head;
  const hiding = ranges.filter((range) => caret > range.from && caret <= range.to).sort((a, b) => a.from - b.from)[0];
  view.dispatch({ effects, ...(hiding ? { selection: { anchor: hiding.from } } : {}), scrollIntoView: true });
  say?.(`Folded ${ranges.length} ${ranges.length === 1 ? "range" : "ranges"}`);
  return true;
}

/** Unfold All. */
export function unfoldEverything(view, say) {
  const effects = [];
  foldedRanges(view.state).between(0, view.state.doc.length, (from, to) => { effects.push(unfoldEffect.of({ from, to })); });
  if (!effects.length) { say?.("Nothing is folded"); return true; }
  view.dispatch({ effects, scrollIntoView: true });
  say?.("Unfolded all");
  return true;
}

/** Fold Level N: every range at nesting level N, except the one around the caret (VS Code). */
export function foldLevel(level) {
  return (view, say) => {
    const caret = view.state.selection.main.head;
    const ranges = allFoldRanges(view.state).filter((range) => range.level === level && !isFolded(view.state, range) && !(caret > range.from && caret <= range.to));
    if (!ranges.length) { say?.(`Nothing to fold at level ${level}`); return true; }
    dispatchFolds(view, ranges.map((range) => foldEffect.of({ from: range.from, to: range.to })));
    say?.(`Folded level ${level}`);
    return true;
  };
}

/** Fold Recursively: the range around the caret and every range inside it. */
export function foldRecursively(view, say) {
  const { state } = view;
  const around = rangeAround(state, state.selection.main.head) ?? rangeAround(state, state.selection.main.head, { folded: true });
  if (!around) { say?.("Nothing to fold here"); return true; }
  const inside = allFoldRanges(state).filter((range) => range.from >= around.from && range.to <= around.to && !isFolded(state, range));
  if (!inside.some((range) => range.from === around.from)) inside.push(around);
  view.dispatch({ effects: inside.map((range) => foldEffect.of({ from: range.from, to: range.to })), selection: { anchor: Math.min(state.selection.main.head, around.from) }, scrollIntoView: true });
  say?.("Folded recursively");
  return true;
}

/** Unfold Recursively: the fold on the caret line and every fold inside it. */
export function unfoldRecursively(view, say) {
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.head);
  const start = foldedAt(state, line.from, line.to);
  const around = start ?? rangeAround(state, state.selection.main.head);
  if (!around) { say?.("Nothing to unfold here"); return true; }
  const effects = [];
  foldedRanges(state).between(around.from, around.to, (from, to) => { effects.push(unfoldEffect.of({ from, to })); });
  if (!effects.length) { say?.("Nothing to unfold here"); return true; }
  view.dispatch({ effects, scrollIntoView: true });
  say?.("Unfolded recursively");
  return true;
}
