import assert from "node:assert/strict";
import { createDragController, trackPointer } from "../dist/studio-kit/drag.js";

// CE-18, the studio kit's drag controller and pointer tracking, against the kit API only: the 4px threshold, a refused start, the order of
// the callbacks, a no-drag release, Escape, the touch hold that keeps a scroll from becoming a move, and one tracked pointer.
// test/studio-kit-browser.mjs drives the same controller with real pointer events.
const keydown = (key) => { const event = new Event("keydown", { cancelable: true }); Object.defineProperty(event, "key", { value: key }); return event; };
const at = (x, y, extra = {}) => ({ clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", ...extra });

const doc = new EventTarget();
const log = [];
let clock = 0;
let refuse = false;
const drag = createDragController({
  doc,
  now: () => clock,
  holdMs: 150,
  onStart: (press) => (refuse ? null : { items: press.payload.items, moves: 0 }),
  onStarted: (session) => log.push(`started ${session.items}`),
  onMove: (session) => { session.moves++; log.push("move"); },
  onEnd: (session, { cancelled }) => log.push(`end ${cancelled ? "cancelled" : "dropped"} after ${session.moves}`),
  onDrop: () => log.push("drop"),
  onEscape: () => log.push("escape"),
});

// Under the threshold: no drag, and the release forgets the press.
drag.press(at(0, 0), { items: "a" });
assert.equal(drag.move(at(3, 2)), false);
assert.equal(drag.active, null);
assert.ok(drag.pending, "the press waits");
assert.equal(drag.release(at(3, 2)), false);
assert.equal(drag.pending, null);

// Past 4px: start, then the move that started it is reported; release ends before it drops.
drag.press(at(0, 0), { items: "a,b" });
assert.equal(drag.move(at(5, 0)), true);
assert.equal(drag.move(at(9, 0)), true);
assert.equal(drag.release(at(9, 0)), true);
assert.deepEqual(log, ["started a,b", "move", "move", "end dropped after 2", "drop"]);
assert.equal(drag.active, null);

// A refused start (read only, nothing left to drag) drops the press.
log.length = 0;
refuse = true;
drag.press(at(0, 0), { items: "a" });
assert.equal(drag.move(at(10, 0)), false);
assert.equal(drag.pending, null);
refuse = false;

// Escape while dragging cancels (the key is the drag's: it does not reach other handlers) and reports it; Escape later does nothing.
drag.press(at(0, 0), { items: "a" });
drag.move(at(10, 10));
const escape = keydown("Escape");
doc.dispatchEvent(escape);
assert.equal(escape.defaultPrevented, true);
assert.equal(drag.active, null);
assert.deepEqual(log, ["started a", "move", "end cancelled after 1", "escape"]);
const later = keydown("Escape");
doc.dispatchEvent(later);
assert.equal(later.defaultPrevented, false, "no listener once the drag ended");

// cancel(): with a drag it ends it; without one it forgets the press.
log.length = 0;
drag.press(at(0, 0), { items: "a" });
drag.move(at(10, 0));
assert.equal(drag.cancel(), true);
assert.deepEqual(log, ["started a", "move", "end cancelled after 1"]);
drag.press(at(0, 0), { items: "a" });
assert.equal(drag.cancel(), false);
assert.equal(drag.pending, null);

// Touch: moving before the hold abandons the press (a scroll); holding first, then moving, drags.
log.length = 0;
clock = 1000;
drag.press(at(0, 0, { pointerType: "touch" }), { items: "t" });
clock = 1050;
assert.equal(drag.move(at(0, 20, { pointerType: "touch" })), false);
assert.equal(drag.pending, null, "a quick touch movement is a scroll");
clock = 2000;
drag.press(at(0, 0, { pointerType: "touch" }), { items: "t" });
clock = 2200;
assert.equal(drag.move(at(0, 20, { pointerType: "touch" })), true);
drag.release(at(0, 20));
assert.deepEqual(log, ["started t", "move", "end dropped after 1", "drop"]);

// trackPointer: moves until the release (commit) or Escape (no commit); it stops listening afterwards.
const node = new EventTarget();
const moves = [];
let ended = null;
trackPointer(node, { doc, onMove: (event) => moves.push(event.type), onEnd: (commit) => { ended = commit; } });
node.dispatchEvent(new Event("pointermove"));
node.dispatchEvent(new Event("pointerup"));
node.dispatchEvent(new Event("pointermove"));
assert.deepEqual(moves, ["pointermove"]);
assert.equal(ended, true);
ended = null;
const tracked = trackPointer(node, { doc, onMove: () => {}, onEnd: (commit) => { ended = commit; } });
doc.dispatchEvent(keydown("Escape"));
assert.equal(ended, false, "Escape cancels");
ended = null;
tracked.cancel();
assert.equal(ended, null, "a finished track does not end twice");

console.log("studio kit drag: threshold, refused start, callback order, release, Escape, cancel, touch hold and pointer tracking passed");
