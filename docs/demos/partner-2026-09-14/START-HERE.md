# OpenPresentation partner demo

Goal: Prepare and rehearse a reliable five-minute business-partner demo using the published OpenPresentation websites, showing a complete edit, undo, PowerPoint export and reopen workflow with a saved fallback. Resume the broader ecosystem work after this demo milestone.

Before presenting, open the gallery editor and Author URLs below and load `partner-demo.opf.json` using their source controls. The original rehearsal used prepared browser tabs, but those tabs are session-local. Keep the files in this folder available for recovery.

## Five-minute walkthrough

1. **0:00–0:40 — The idea.** Open https://www.openpresentation.org/. Say: “A presentation is one readable document that people and AI tools can share. The format and local tools are open.”
2. **0:40–1:10 — The design catalog.** Open https://www.pptx.gallery/. Show Themes or Color Schemes. Say: “People browse the same named design choices that agents can reference.” Treat homepage example figures as design examples, not product benchmarks or company results.
3. **1:10–3:15 — The working product.** Open https://www.pptx.gallery/editor with the demo source loaded. Select slide 2. Double-click its title, replace it with “People stay in control”, and press Control+Enter. Click Undo, then Redo. Show slide 3 with the table and chart. Its figures are explicitly illustrative.
4. **3:15–4:15 — Deliver a file.** Click PowerPoint, then Download PowerPoint. Click Save OPF to keep the source. The downloaded file contains editable text, a native table and chart structures. Native PowerPoint appearance has not been certified in this demo.
5. **4:15–5:00 — The business discussion.** Show https://www.pptx.dev/author with the demo source loaded, or preload `author-edited.pptx` before presenting. The rehearsal verified export and reopen there. Finish with slide 5: “Which recurring customer presentation should we pilot first, and what would make it worth adopting?”

## Files and recovery

- `partner-demo.opf.json`: original five-slide demo source, downloaded from the published gallery editor.
- `partner-demo.pptx`: PowerPoint export from the published gallery editor.
- `author-edited.pptx`: Author export with the edited slide 2 title.
- If a browser session resets: in the gallery editor choose Source, paste the complete JSON file, then Apply changes. In Author choose code and paste the same JSON.
- If a live site is slow, use the saved deck or `offline-demo.html` if present. The offline viewer is a static preview, not an editor.
- `verification.json` records the original rehearsal's package checks. `artifact-check.json` records validation of the saved source, exports and embedded preview images before committing this demo bundle.

## Rehearsal record

September 14, 2026: all three public websites loaded. The five-slide document rendered in both published editors. Gallery and Author inline edit, undo and redo succeeded. Both produced PowerPoint downloads. Author reopened its edited PowerPoint and reported a valid five-slide document with no schema warnings. Gallery export reported 34,979 bytes and zero conversion notes.

The file chooser was unusually slow during this rehearsal; keep reimport preloaded instead of making it a required live step. Preview, editing and export required no sign-in. AI generation was not tested. Do not present PDF/PNG export in Author as available: its controls are disabled. Do not claim arbitrary PowerPoint imports are lossless or that font/native compatibility gates are complete.

The broader ecosystem goal remains active. No package release, production code change, deployment or golden-baseline update was made for this demo.
