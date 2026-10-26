// CE-18, the studio kit: dragging. `createDragController` turns a press into a drag once the pointer moves past a threshold (on touch, after a
// hold, so a scroll is never taken for a move), runs the host's trial drop on each move, lands it once on release, and cancels on Escape.
// `trackPointer` follows one captured pointer (a divider) until it is released or cancelled. `dragGhost` is the label that follows the
// pointer. No document knowledge: the host decides what a drag carries and what a drop does.

/**
 * A drag controller. Options:
 * - `doc`: the document (for the Escape key while dragging);
 * - `threshold`: the distance in pixels before a press becomes a drag (default 4);
 * - `holdMs`: on touch, how long the press must be held before movement drags (default 0); moving earlier abandons the press;
 * - `onStart(pending)`: make the drag session from the press (`{ x, y, id, type, time, payload }`); null or undefined refuses it;
 * - `onStarted(session)`: after the controller holds the session (paint the dragging state here);
 * - `onMove(session, event)`: each move while dragging (the trial drop);
 * - `onEnd(session, { cancelled })`: clean up, before `onDrop` or after a cancel;
 * - `onDrop(session, event)`: the release (land the drop);
 * - `onEscape(session)`: after Escape cancelled the drag.
 * The host forwards its pointer events: `press(event, payload)`, `move(event)` (true while dragging), `release(event)` (true when it ended a
 * drag) and `cancel()`.
 */
export function createDragController(options = {}) {
  const threshold = options.threshold ?? 4;
  const holdMs = options.holdMs ?? 0;
  const now = options.now ?? (() => Date.now());
  let pending = null;
  let active = null;

  const onKey = (event) => {
    if (event.key !== "Escape" || !active) return;
    event.preventDefault();
    event.stopPropagation();
    const session = active;
    controller.cancel();
    options.onEscape?.(session);
  };
  const listen = (on) => { if (options.doc) (on ? options.doc.addEventListener : options.doc.removeEventListener).call(options.doc, "keydown", onKey, true); };

  function start() {
    const session = options.onStart ? options.onStart(pending) : pending;
    if (session === null || session === undefined) { pending = null; return false; }
    active = session;
    listen(true);
    options.onStarted?.(session);
    return true;
  }
  function end(cancelled) {
    const session = active;
    listen(false);
    active = null;
    pending = null;
    options.onEnd?.(session, { cancelled });
    return session;
  }

  const controller = {
    get active() { return active; },
    get pending() { return pending; },
    /** A press that may become a drag; `payload` is what the drag would carry. */
    press(event, payload) {
      pending = { x: event.clientX, y: event.clientY, id: event.pointerId, type: event.pointerType, time: now(), payload };
    },
    /** A move: starts the drag past the threshold, then reports each move. Returns true while a drag runs. */
    move(event) {
      if (pending && !active && Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > threshold) {
        if (holdMs > 0 && pending.type === "touch" && now() - pending.time < holdMs) pending = null;
        else start();
      }
      if (!active) return false;
      options.onMove?.(active, event);
      return true;
    },
    /** The release: lands the drag (`onEnd`, then `onDrop`) and returns true, or forgets the press and returns false. */
    release(event) {
      if (!active) { pending = null; return false; }
      const session = end(false);
      options.onDrop?.(session, event);
      return true;
    },
    /** Drop the press, and the drag if one runs (`onEnd` with `cancelled`). */
    cancel() {
      if (!active) { pending = null; return false; }
      end(true);
      return true;
    },
  };
  return controller;
}

/**
 * Follow one captured pointer on `node` from a press: `onMove(event)` on each move, then `onEnd(commit)`, true on release and false on
 * cancel or Escape. Returns `{ cancel }`.
 */
export function trackPointer(node, { doc, onMove, onEnd }) {
  let done = false;
  const finish = (commit) => {
    if (done) return;
    done = true;
    node.removeEventListener("pointermove", onMove);
    node.removeEventListener("pointerup", onUp);
    node.removeEventListener("pointercancel", onCancel);
    doc?.removeEventListener("keydown", onKey, true);
    onEnd(commit);
  };
  const onUp = () => finish(true);
  const onCancel = () => finish(false);
  const onKey = (event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); finish(false); } };
  node.addEventListener("pointermove", onMove);
  node.addEventListener("pointerup", onUp);
  node.addEventListener("pointercancel", onCancel);
  doc?.addEventListener("keydown", onKey, true);
  return { cancel: () => finish(false) };
}

/** The label that follows the pointer during a drag ("Text", "3 blocks"), inside `host` (a positioned element). */
export function dragGhost(dom, host, text) {
  const ghost = dom.el("div", `${dom.prefix}-ghost`, { "aria-hidden": "true", text });
  host.append(ghost);
  return {
    element: ghost,
    /** Put the label just below and right of the pointer. */
    moveTo(event) {
      const box = host.getBoundingClientRect();
      ghost.style.left = `${event.clientX - box.left + 12}px`;
      ghost.style.top = `${event.clientY - box.top + 12}px`;
    },
    remove() { ghost.remove(); },
  };
}
