// One undo step for a suggestion and the value list it opened (artifacts/source-editor/SPEC.md, section 4.6, item 4; TEST-PLAN J-INS-017). Accepting a key
// of a closed set of values writes `"key": ""` and opens the list of the values; accepting a value is a second edit. Each is an edit of its own in
// CodeMirror's history, as every accepted suggestion is, so the pair is recorded here and Undo and Redo step over both: one Cmd+Z puts back the text
// the author had typed before accepting the key (VS Code: "accept is one step with its typed prefix undoable"). Anything typed in between, or any
// other edit after the pair, makes the pair void, so Undo is the plain one again. Plain functions over an editor view, no DOM.
import { redo, undo, undoDepth, redoDepth } from "@codemirror/commands";

const pending = new WeakMap();
const pairs = new WeakMap();

/** A suggestion that opens a list of values was accepted: the text before it and after it. */
export function beginUndoGroup(view, before) {
  pending.set(view, { before, after: view.state.doc });
}

/** A suggestion is about to be accepted: the pair it completes (the key accepted just before, with nothing typed since), or null. */
export function takeUndoGroup(view) {
  const link = pending.get(view);
  pending.delete(view);
  pairs.delete(view);
  return link && link.after.eq(view.state.doc) ? link : null;
}

/** The value was accepted (and the history closed after it): the key and the value are one undo step from now on. */
export function finishUndoGroup(view, link) {
  pairs.set(view, { before: link.before, after: view.state.doc, depth: undoDepth(view.state), undone: false });
}

/** Whether Undo should step over the last pair; does it when so (returns true). Otherwise the caller does the plain undo. */
export function undoPair(view) {
  const pair = pairs.get(view);
  if (!pair || pair.undone || undoDepth(view.state) !== pair.depth || !view.state.doc.eq(pair.after)) return false;
  for (let step = 0; step < 3 && !view.state.doc.eq(pair.before); step++) if (!undo(view)) break;
  pair.undone = view.state.doc.eq(pair.before);
  pair.redoDepth = redoDepth(view.state);
  return true;
}

/** The same for Redo: after the pair was undone, Redo puts both back. */
export function redoPair(view) {
  const pair = pairs.get(view);
  if (!pair || !pair.undone || redoDepth(view.state) !== pair.redoDepth || !view.state.doc.eq(pair.before)) return false;
  for (let step = 0; step < 3 && !view.state.doc.eq(pair.after); step++) if (!redo(view)) break;
  pair.undone = !view.state.doc.eq(pair.after);
  return true;
}
