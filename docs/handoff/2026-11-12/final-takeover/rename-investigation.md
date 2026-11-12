# Presentation rename report — unimplemented

The owner requested full available toolbar-row use while editing the presentation name, with explicit Save/Cancel. Enter should commit and Escape cancel; blur must not silently commit. No source fix, browser test or live reproduction was completed before this handoff.

Shared source: packages/editor/src/deck-title.js; packages/editor/src/styles/deck-title.css; examples host packages/editor/examples/playground.css around389; workspace.js around1294. Current component has only an input, content sizing, Enter/blur commit via one editor.applyPatch(source: deck-name), and Escape reversion. Host .document-title width clamp(200px,20vw,340px)/max340px causes the narrow editor.

Update the shared editing state and host row, not just the private site copy. Preserve beforeCommit/inSync/commitPending, readOnly, undo, source/recovery synchronization and IME behavior. Existing deck-title-browser.mjs asserts blur commit/content width and needs meaningful revised coverage. Verify desktop and320/390/820/1024touch widths, focus,44px controls, Save/Cancel/Enter/Escape and no accidental blur commit. The clean investigation checkout /tmp/opf-fullrow-rename had no implementation changes.
