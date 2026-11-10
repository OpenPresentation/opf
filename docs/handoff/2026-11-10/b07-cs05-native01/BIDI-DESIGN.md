# Read-only bidi-formatting feasibility and invariant constraints

No new mark/isolate variant, exporter patch or import rule was prepared in this task.

## What the current criteria require

The original contrast review scope explicitly binds every authored field/Unicode codepoint and says “No Unicode/language normalization.” The current qualified observer compares native Text with `-ceq expected.text` before font/size observations. The current CS-only05 meets that raw-text constraint: `البند: Bonjour 1` remains exact, primary1025 and point sizes/frames are unchanged. Adding even an invisible formatting codepoint would fail that unchanged expectation. It must not be silently stripped or reported as raw native UTF16 equality.

This is not a schema-wide prohibition on authored bidi controls. Core `packages/javascript/src/direction.ts` explicitly processes LRI/RLI/FSI/PDI under its P2 paragraph-direction rule. Renderer `svg.js` inserts backend paragraph isolates without changing OPF input. These facts show a distinction between semantic input and backend formatting; they do not establish native PowerPoint support or a currently approved exporter-owned formatting exception.

Two important existing source limitations apply:

- `packages/javascript/src/number-text.ts` states that SVG uses LRI/PDI but PPTX uses separate English number runs because PowerPoint draws LRI/PDI as visible boxes. That is an existing source/historical behavior record, not a new current-build native test. Legacy LRE/PDF or LRM/RLM are distinct characters; this warning does not prove their current behavior.
- `packages/pptx/src/native-body.js` explicitly rejects bidi controls (including U+202A–U+202E and U+2066–U+2069) from its editable paragraph-body eligibility. Default measured line boxes and paragraph-native editing must not be conflated in any proposed product support claim.

## Current import behavior

`text-provenance.js` deliberately takes CURRENT native characters; boundary tags cannot restore discarded old words. `native-language-provenance.js` has a bounded, owned read-view normalization for inherited proofing only: it validates current text, direction, ownership and proofing pair before restoring the semantic language view, while preserving original ZIP bytes for ordinary fingerprint checks. It inserts/removes no bidi controls. There is no current public rule that safely removes new exporter-owned formatting marks.

Blanket removal of bidi codepoints is unsafe: an author may have supplied them, or a user may edit/delete/move them in PowerPoint. A future proposal would need to distinguish original semantic text from explicitly declared exporter-added formatting, retain the actual native text/codepoint delta and bind a versioned receipt to exact inserted positions, current text, run/style/language and relevant geometry/ownership. Unchanged verified formatting could then have a semantic import view; stripped, duplicate, edited or uncertain ownership must preserve CURRENT ordinary text and report a diagnostic instead of deleting characters or restoring stale words. This is a design requirement, not implemented support.

## Bounded proposal and limits

A separately authorized diagnostic could test one explicitly declared directional-formatting pair around the exact existing ASCII span, in the original single box with the proven CS-slot correction, preserving visible semantic text, primary1025, fonts/point sizes, marker and frames. Its raw native expectation would openly contain the extra formatting codepoints; the original raw-UTF16 criterion would remain unmet, and no original acceptance box would be checked from that experiment. No alternate-language waiver, outlines or extra text boxes would be involved. Root has separately assigned any such source-only preparation; this task authors none.

Before product adoption, owner/root must explicitly decide whether an exporter-owned formatting-codepoint exception is acceptable while keeping OPF semantic text exact. Copy/paste/search/editing behavior, font selection/zero advance, saved/reopened native appearance and conservative public import all remain required evidence. A visually better image alone cannot establish that exception or close B07. Current measured evidence justifies the Latin/CS face consistency component; word-order behavior remains open.

Authority is the preserved original review scope and frozen db640 local source snapshots in raw.json.gz, not a new claim about undocumented Office behavior. All old failed numeric partition/direction/language/segmentation controls remain separate immutable evidence.
