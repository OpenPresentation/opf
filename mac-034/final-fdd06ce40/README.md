# Final Keynote pass on the v0.34.0 release content (fdd06ce4084457bece40b074633b2500ddbfdb6a)

Keynote 15.1.1 on macOS 26.6, the qualification corpus built with `scripts/native-acceptance/qualification/build.mjs` (67 files).
Opened read-only with AppleScript, slides exported as images, documents closed without saving.

- `keynote/<file>/slides/`: Keynote's slide images (hidden slides are not exported). `_probe2.tsv`: Keynote's object model per slide
  (layout, title showing, title text and paragraphs, title font and size, presenter notes length, fonts of text items, shapes and
  table cells). `_input-sha-*`: the input's SHA-256 before and after.
- `final-report.json`: the probe joined with what each PPTX says (`pptx-expect.json`) and the pixel scores against OPF's preview and
  the earlier Keynote pass. `coverage-grades.md`: the visual review of the 30 coverage decks.
- `sheets/`: OPF preview | Keynote | difference, for the slides discussed in issue #1278. `sheets-vs-previous/`: earlier Keynote pass
  (RC 4eea78c) | this pass | difference.
