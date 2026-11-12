# Keynote grading brief (OPF v0.34.0 RC, commit 4eea78c2efbd40f576b395ab57bdbba87ae6d744)

You grade how Keynote 15.1.1 (macOS 26.6.2) draws the OPF v0.34.0 qualification corpus compared with OPF's own preview. Read-only work: do NOT open Keynote, PowerPoint or any GUI app, do not commit or push, do not edit files outside the path given for your notes. American English. Never name other presentation libraries.

## Inputs (all 1280 x 720 unless noted)

- OPF preview: `/Users/michael/opf-work/mac-034-corpus/preview/<deck>/slide-<n>.png` (variants such as `layout-sampler~native-body` share the deck's preview).
- Keynote slide, scaled from Keynote's native 960 x 540 export: `/Users/michael/opf-work/mac-034-corpus/keynote-1280/<file>/slide-<n>.png` (`<file>` is the PPTX name without extension, e.g. `diagrams~picture`).
- Side-by-side sheet (preview | Keynote | pixel difference, 3880 x 760): `/Users/michael/opf-work/mac-034-corpus/keynote-sheets/<file>-<n>.png`. Start with the sheet; open the two 1280 images when you need detail.
- Scores (share of pixels that differ by 24/255 or more; only a pointer, not a verdict): `/Users/michael/opf-work/mac-034-corpus/keynote-scores.json`.
- Keynote object counts per slide (charts, tables, images, shapes, lines, groups, text items), if present: `/Users/michael/opf-work/mac-034-corpus/keynote/<file>/_probe.txt`.
- Manifest of features and what each check means: `/Users/michael/opf-work/mac-034-review/scripts/native-acceptance/qualification/manifest.json` (`checks`, and `features[]` with `deck`, `variant`, `slides`, `checks`, `check`).

## Known context (do not report these as new findings; mention them once if they explain a difference)

- This Mac has no Office fonts. Keynote substitutes: Aptos and Aptos Display (most decks), Roboto / Roboto Medium / Roboto SemiBold (chart-point-overlays, duration-timeline, explicit-chart-reference-lines, image-callouts, singleton-combo-reference-lines), Roboto Mono (code), Montserrat and Work Sans (data-story-academy), Consolas (compliance-readiness-review), Open Sans (plantuml-diagrams), Noto Naskh Arabic (Arabic slides), Meiryo (Japanese). Keynote shows a non-modal "This presentation has missing fonts." banner. Different glyph widths, so slightly different line breaks and text widths, are expected. Flag a font difference only when it causes real harm: text clipped, overlapping, running out of its box or off the slide, a line break that changes meaning, or text that wraps onto many more lines.
- Keynote does not lay out SmartArt; the manifest's `fallback` check (the picture fallback) applies there.
- Keynote lays out a chart's plot area itself; small shifts of gridlines, axes and labels are expected. Report missing or wrong data, missing labels, wrong chart type, wrong colors, missing reference lines, and lost overlays.
- The Windows PowerPoint pass of this corpus found all files open; known gaps there: text 2 to 6 px higher than the preview; plot areas laid out by the app.

## What to report

For every slide of your decks: OK, or what differs. Grade each manifest feature of your decks that a picture can grade (`visual`, `slides`, `noOverflow` judged by eye, `fallback`, `nativeChart`/`nativeTable` from `_probe.txt` if present). Mark checks that need the app's object model or UI (`noShrink`, `smartArt` node edits, `connectors` glue, `footer` live renumbering, `roundtrip`) as "not graded here".

Return a compact table with one row per difference: `| file | slide | what differs | size (minor: cosmetic, a few px / moderate: visibly different but content intact / major: content lost, unreadable, overlapping, or wrong) |`. Lead with anything major: lost content, wrong data, missing elements, unreadable text. Then one line per manifest feature: `feature id: pass / differs (rows) / not graded here`. Be precise about what you saw; do not guess, and say when something is unclear at this resolution. Keep the reply under about 60 lines.
