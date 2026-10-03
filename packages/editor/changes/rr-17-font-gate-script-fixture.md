---
type: changed
---
RR-17 (tests only; no package change): per-family script fixture for the editor font gate (FF-44, FF-45). `test/font-gate-script-families.mjs` drives `createFontGate` with the renderer's registry for each of the 35 open script, emoji and math families (`test/fixtures/script-family-samples.json`: original FF-44 corpus text and the FF-45 emoji and math samples), checks that the gate reports and loads only the family's script packages, that the registry holds the pinned faces and resolves each style to the family itself, and that a deck of the samples renders strictly in the family (`glyphFallback: 'none'`). It writes `artifacts/script-family-hosts/editor.json` for the font tracker in core.
