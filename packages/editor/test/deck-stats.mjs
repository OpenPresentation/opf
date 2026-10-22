// RR-55: `deckStats(editor)` is core's `stats` of the open presentation: neutral facts for a deck-info view, no severities.
import assert from "node:assert/strict";
import { stats } from "@openpresentation/opf";
import { createEditorSession, deckStats } from "../dist/index.js";

const editor = createEditorSession({
  name: "Stats",
  slides: [
    { id: "a", title: "Revenue", text: "one two three", notes: "say this" },
    { id: "b", title: "Picture", image: { src: "https://example.com/p.png" } },
  ],
});

// It is core's report for the session's document, and it follows edits and undo.
assert.deepEqual(deckStats(editor), stats(editor.presentation));
assert.equal(deckStats(editor).slides.total, 2);
assert.equal(deckStats(editor).notes.withNotes, 1);
assert.equal(deckStats(editor).images.content.missingAlt, 1, "a fact about alt text, not a severity");
editor.set("slides.1.notes", "and this");
assert.equal(deckStats(editor).notes.withNotes, 2);
editor.undo();
assert.equal(deckStats(editor).notes.withNotes, 1);
editor.set("slides.0.hidden", true);
assert.deepEqual(deckStats(editor).slides.hidden, [{ index: 0, id: "a" }]);

// Options are core's: per-slide detail and the speaking rate.
assert.deepEqual(deckStats(editor, { perSlide: true }), stats(editor.presentation, { perSlide: true }), "options reach core");
assert.notDeepEqual(deckStats(editor, { perSlide: true }), deckStats(editor), "per-slide detail is added");
assert.equal(deckStats(editor, { wordsPerMinute: 65 }).speakingTime.wordsPerMinute, 65);

// It reads the JSON only, so a deck that fails validation still has facts, and a non-session is refused.
const broken = createEditorSession({ slides: [{ title: 42 }] });
assert.equal(broken.validation.valid, false);
assert.equal(deckStats(broken).slides.total, 1);
assert.throws(() => deckStats({}), (error) => error.code === "invalid-editor");
assert.equal("severity" in deckStats(editor), false, "facts carry no severities");

console.log("Deck stats: core's stats over the session's document, following edits and undo, with no severities.");
