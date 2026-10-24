// Problems in the text (artifacts/source-editor/SPEC.md, section 9): every finding the pane has a range for is a squiggle with its message, what
// could come next and its quick fixes; F8 and Shift+F8 walk them; Cmd/Ctrl+. lists the fixes at the caret. The pane decides what the problems
// are (`control.setProblems`); this module only draws them and acts on them. Ranges are original-source offsets (CRLF counts as two).
import { ChangeSet, EditorSelection, Prec, StateEffect, StateField, Transaction } from "@codemirror/state";
import { EditorView, activateHover, keymap, showTooltip } from "@codemirror/view";
import { forEachDiagnostic, linter, setDiagnostics } from "@codemirror/lint";
import { isolateHistory } from "@codemirror/commands";
import { textInputMap } from "./text-input.js";
import { setJsonSource } from "./json-source.js";
import { applySourceEdits } from "./source-fixes.js";

const SEVERITY_WORD = { error: "Error", warning: "Warning", info: "Note" };
const MAX_FIXES = 7;
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** The platform's name for the quick fix chord, for the hint in a problem's tooltip. */
const isMac = () => /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? "");
export const quickFixChord = () => (isMac() ? "Cmd+." : "Ctrl+.");

// ---- the diagnostics ---------------------------------------------------------------------------------------------------------------
/** One problem as CodeMirror's lint state keeps it (`problem` is the pane's object, with source offsets as of when it was set). */
function toDiagnostic(problem, map, length, applyFix) {
  const clamp = (offset) => Math.max(0, Math.min(offset, length));
  const from = map.toInput(clamp(problem.from)), to = map.toInput(clamp(problem.to));
  return {
    from, to: Math.max(from, to),
    severity: problem.severity === "warning" || problem.severity === "info" ? problem.severity : "error",
    message: problem.message,
    source: problem.rule,
    problem,
    renderMessage: () => renderProblem(problem),
    actions: (problem.fixes ?? []).slice(0, MAX_FIXES).map((fix) => ({ name: fix.title, apply: () => applyFix(fix, problem) })),
  };
}
/** The tooltip body: the message, what could come next, and the quick fix hint. */
function renderProblem(problem) {
  const body = el("div", "opf-problem");
  body.append(el("div", "opf-problem-message", problem.message));
  if (problem.next) body.append(el("div", "opf-problem-next", `Next: ${problem.next}`));
  if (problem.fixes?.length) body.append(el("div", "opf-problem-hint", `Quick Fix (${quickFixChord()}): ${problem.fixes.length} ${problem.fixes.length === 1 ? "action" : "actions"}`));
  return body;
}

/** The problems now in the text, in position order, with their current source offsets. */
export function currentProblems(state, source) {
  const map = textInputMap(source), out = [];
  forEachDiagnostic(state, (diagnostic, from, to) => {
    if (!diagnostic.problem) return;
    out.push({ ...diagnostic.problem, from: map.toSource(Math.min(from, map.text.length)), to: map.toSource(Math.min(to, map.text.length)), diagnostic });
  });
  return out.sort((a, b) => a.from - b.from || a.to - b.to || a.message.localeCompare(b.message));
}

// ---- quick fix menu ----------------------------------------------------------------------------------------------------------------
const openFixes = StateEffect.define();
const closeFixes = StateEffect.define();
const moveFixes = StateEffect.define();
const fixMenu = StateField.define({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(openFixes)) value = { pos: effect.value.pos, items: effect.value.items, selected: 0 };
      else if (effect.is(closeFixes)) value = null;
      else if (effect.is(moveFixes) && value) value = { ...value, selected: (value.selected + effect.value + value.items.length) % value.items.length };
    }
    // Any change of the text or the caret closes the menu.
    if (value && !tr.effects.some((effect) => effect.is(openFixes) || effect.is(moveFixes)) && (tr.docChanged || tr.selection)) value = null;
    return value;
  },
  provide: (field) => showTooltip.from(field, (value) => value && {
    pos: value.pos,
    above: false,
    strictSide: false,
    arrow: false,
    create() {
      const dom = el("div", "cm-tooltip-section opf-fixes");
      dom.setAttribute("role", "listbox");
      dom.setAttribute("aria-label", "Quick fixes");
      value.items.forEach((fix, index) => {
        const item = el("div", "opf-fix", fix.title);
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", String(index === value.selected));
        item.dataset.fix = fix.id;
        if (fix.safe) item.dataset.safe = "true";
        dom.append(item);
      });
      return { dom };
    },
  }),
});

/** The fixes of the problems at the selection (or, when none touches it, on its line), the safest first. */
export function fixesAtCaret(state, source) {
  const { from, to } = state.selection.main;
  const map = textInputMap(source);
  const problems = currentProblems(state, source);
  const caretFrom = map.toSource(from), caretTo = map.toSource(to);
  const touching = problems.filter((problem) => problem.from <= caretTo && problem.to >= caretFrom);
  let chosen = touching;
  if (!chosen.length) {
    const line = state.doc.lineAt(from);
    chosen = problems.filter((problem) => state.doc.lineAt(map.toInput(Math.min(problem.from, source.length))).number === line.number);
  }
  const fixes = [];
  const seen = new Set();
  for (const problem of chosen) for (const fix of problem.fixes ?? []) {
    const key = `${fix.id}|${fix.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    fixes.push({ ...fix, problem });
  }
  fixes.sort((a, b) => Number(Boolean(b.safe)) - Number(Boolean(a.safe)));
  return fixes.slice(0, MAX_FIXES);
}

// ---- the extension -----------------------------------------------------------------------------------------------------------------
/**
 * `getSource()` is the original text; `applyFix(fix, problem)` performs a fix (the editor's edits or the pane's own action); `say(message)` is
 * the live region. Returns `{ extension, draw(view, problems), problems(view) }`.
 */
export function createDiagnostics({ getSource, applyFix, say, km }) {
  let announced = null;
  const stepProblem = (forward) => (view) => {
    const source = getSource(), map = textInputMap(source), list = currentProblems(view.state, source);
    if (!list.length) { say("No problems"); return true; }
    const sel = view.state.selection.main, here = map.toSource(sel.from), end = map.toSource(sel.to);
    let target;
    if (forward) target = list.find((problem) => problem.from > here || (problem.from === here && problem.to > end)) ?? list[0];
    else target = [...list].reverse().find((problem) => problem.from < here || (problem.from === here && problem.to < end)) ?? list[list.length - 1];
    selectProblem(view, target, map);
    return true;
  };
  const selectProblem = (view, problem, map) => {
    const anchor = map.toInput(problem.from), head = map.toInput(problem.to);
    view.dispatch({ selection: EditorSelection.single(anchor, head), scrollIntoView: true, userEvent: "select.problem" });
    announced = problem.diagnostic;
    say(`${SEVERITY_WORD[problem.severity] ?? "Error"}: ${problem.message}${problem.next ? ` Next: ${problem.next}` : ""}`);
    activateHover(view, anchor, 1, { until: (tr) => tr.docChanged || (tr.selection !== undefined && !tr.isUserEvent("select.problem")) });
  };
  const openMenu = (view) => {
    const fixes = fixesAtCaret(view.state, getSource());
    if (!fixes.length) { say("No quick fixes available"); return true; }
    view.dispatch({ effects: openFixes.of({ pos: view.state.selection.main.from, items: fixes }) });
    say(`${fixes.length} quick ${fixes.length === 1 ? "fix" : "fixes"}. ${fixes[0].title}`);
    return true;
  };
  const menuOpen = (view) => view.state.field(fixMenu, false) !== null;
  const whenOpen = (run) => (view) => (menuOpen(view) ? (run(view), true) : false);
  const move = (by) => (view) => {
    view.dispatch({ effects: moveFixes.of(typeof by === "function" ? by(view.state.field(fixMenu)) : by) });
    const menu = view.state.field(fixMenu);
    say(menu.items[menu.selected].title);
  };
  const keys = Prec.highest(keymap.of([
    { key: "ArrowDown", run: whenOpen(move(1)) },
    { key: "ArrowUp", run: whenOpen(move(-1)) },
    { key: "Home", run: whenOpen(move((menu) => -menu.selected)) },
    { key: "End", run: whenOpen(move((menu) => menu.items.length - 1 - menu.selected)) },
    { key: "Enter", run: whenOpen((view) => { const menu = view.state.field(fixMenu), fix = menu.items[menu.selected]; view.dispatch({ effects: closeFixes.of(null) }); applyFix(fix, fix.problem); }) },
    { key: "Escape", run: whenOpen((view) => view.dispatch({ effects: closeFixes.of(null) })) },
    { key: "Tab", run: whenOpen((view) => view.dispatch({ effects: closeFixes.of(null) })) },
  ]));
  // F8, Shift+F8 and the quick fix key are declared in source-keymap.js; the menu's own keys above are modal and not listed.
  const plain = keymap.of(km ? [...km.bind("problem.next", stepProblem(true)), ...km.bind("problem.previous", stepProblem(false)), ...km.bind("problem.quickFix", openMenu)] : [
    { key: "F8", run: stepProblem(true), shift: stepProblem(false) },
    { key: "Mod-.", run: openMenu },
  ]);
  // The caret entering a squiggle says what the problem is, once per problem (a screen reader user finds it without looking for it).
  const caretWatch = EditorView.updateListener.of((update) => {
    if (!update.selectionSet || update.docChanged || update.transactions.some((tr) => tr.isUserEvent("select.problem"))) return;
    const { head } = update.state.selection.main;
    let found = null;
    forEachDiagnostic(update.state, (diagnostic, from, to) => { if (!found && diagnostic.problem && head >= from && head <= to && from !== to) found = diagnostic; });
    if (found && found !== announced) say(`${SEVERITY_WORD[found.severity] ?? "Error"}: ${found.message}`);
    announced = found;
  });
  return {
    extension: [linter(null), fixMenu, keys, plain, caretWatch],
    /** Replace the problems drawn in the text. `problems` carry source offsets into `getSource()`. */
    draw(view, problems) {
      const source = getSource(), map = textInputMap(source);
      announced = null;
      view.dispatch(setDiagnostics(view.state, problems
        .filter((problem) => Number.isInteger(problem.from) && Number.isInteger(problem.to) && problem.from <= source.length)
        .map((problem) => toDiagnostic(problem, map, source.length, applyFix))));
    },
    problems: (view) => currentProblems(view.state, getSource()),
    openMenu,
    next: stepProblem(true),
    previous: stepProblem(false),
  };
}

/** The edit of a fix as one CodeMirror transaction spec (source offsets in, editor offsets out), or null when an edit splits a CRLF pair. */
export function editsTransaction(state, source, edits, { caret, select, userEvent = "input.fix" } = {}) {
  const map = textInputMap(source);
  const sorted = edits.map((edit, index) => ({ edit, index })).sort((a, b) => a.edit.from - b.edit.from || a.index - b.index).map((entry) => entry.edit);
  const next = applySourceEdits(source, edits);
  const changes = ChangeSet.of(sorted.map((edit) => ({ from: map.toInput(edit.from), to: map.toInput(edit.to), insert: textInputMap(edit.insert).text })), state.doc.length);
  const spec = { changes, effects: setJsonSource.of(next), annotations: [Transaction.userEvent.of(userEvent), isolateHistory.of("full")], scrollIntoView: true };
  const nextMap = textInputMap(next);
  // A caret or selection is given as offsets in the new text; otherwise the selection follows the edits.
  if (select) spec.selection = EditorSelection.single(nextMap.toInput(Math.min(select[0], next.length)), nextMap.toInput(Math.min(select[1], next.length)));
  else if (caret !== undefined) spec.selection = EditorSelection.single(nextMap.toInput(Math.min(caret, next.length)));
  else spec.selection = state.selection.map(changes, 1);
  return spec;
}
