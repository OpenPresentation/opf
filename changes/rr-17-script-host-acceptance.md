---
type: changed
packages: []
---
RR-17 (records and tooling only; no schema, catalog or API change): the font tracker derives acceptance for the open script, emoji and math families from their own per-host fixture evidence (`scriptAcceptance`, `docs/evidence/font-replacements-20260923/script-host-fixtures-20261002.json`, assembled by `scripts/assemble-script-host-evidence.mjs` from the opf-render, opf-editor and pptx-gallery fixtures), as it does for the Latin families; the Latin path and output are unchanged. Of the 38 `baseline-needed` families, 37 are now `qualified` (the three Liberation aliases once the gallery editor's pinned renderer carries them, and 34 script, emoji and math faces); Noto Emoji stays `baseline-needed` with a recorded browser finding (Chromium falls back for its emoji-presentation sequences). Native PowerPoint verification remains separate (FF-46).
