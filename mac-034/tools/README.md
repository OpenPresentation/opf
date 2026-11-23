# Keynote qualification tools (Mac mini)

AppleScript open/export only, no UI scripting; Keynote is opened read-only and never saved. Pass absolute paths.

1. Build the corpus from a fresh checkout: `node scripts/native-acceptance/qualification/build.mjs --out <dir>`.
2. Check that Keynote has no one else's documents open: `osascript -e 'tell application id "com.apple.Keynote" to get name of every document'`.
   Check that the screen is unlocked; Keynote's AppleScript `open` times out while it is locked:
   `ioreg -n Root -d1 -a | plutil -extract IOConsoleUsers xml1 -o - - | grep -A1 CGSSessionScreenIsLocked` (no output: unlocked).
3. Compile the helpers once: `swiftc kalert.swift -o kalert` and `swiftc kwinids.swift -o kwinids`.
4. Export the slides: `C=<dir> zsh kn-all.sh <dir>/pptx/*.pptx`. This writes `<dir>/keynote/<file>/slides/*.png` and `_log.txt`, and
   the input's SHA-256 before and after. An alert is detected (`kalert`), captured and Keynote quit; never clicked.
5. Probe the object model: `C=<dir> zsh kn-probe2-all.sh <dir>/pptx/*.pptx` (`_probe2.tsv`: layout, title showing, text, paragraphs,
   font, size (whole points only), notes length, fonts of text items, shapes and table cells).
6. Compare: `python3 final_expect.py <dir>` (what each PPTX says), then `python3 final_compare.py <dir> <previous-dir>` (joins the
   probe with the PPTX, scores each slide against the preview and a previous pass, writes `keynote-sheets/`). Run them with a
   Python that has Pillow; `sheets.py` is the older single-pass sheet builder.

Gotchas: build `POSIX file` outside the `tell` block (or Keynote's sandbox reports "can't be imported"); `export ... as slide images`
empties its target folder, so the scripts export into `slides/`; hidden slides are not exported; zsh's `log` builtin shadows
`/usr/bin/log`.
