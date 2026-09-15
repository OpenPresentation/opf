# Joint source shaping checkpoint — September 15, 2026

The exact installed probe that previously found Arimo `AV` 2.375px too wide
and Gelasio `office` 0.765625px too wide now records zero difference for both,
plus the combining-character control. Compatible typography is measured and
painted together while original run-relative spans, formatting and links survive.
The [contract and limits](../../plans/rich-source-shaping.md) describe the new
group representation and coordinated consumer requirements.

`manifest.json` records the four runtime commits, hashes for all 612 shipped
files (each compared byte-for-byte with the fresh consumer), package manifest,
lockfile and retained report hashes. Reports/logs are gzip-compressed without
timestamps. Source and installed browser reports each verify eight exact
native/prepared pixel-and-copy pairs, including identical decorations. The
colored ligature image was visually inspected; one shaped glyph supplies both
colors while underline, strike and the original hyperlink remain present.

Fresh packages pass twenty prepared editor workflows, thirteen painted,
thirteen measured and thirteen estimated rich-input workflows. The eight
general installed browser suites pass 276 assertions and eight trusted
interaction scenarios. The full prepared painting browser matrix covers 650
supported runs, thirteen explicit coverage rejections and five full slides.
Core's 524 tests, layout/pagination/rich/list regressions, TypeScript and native
PPTX tests pass. Native body/list/table XML retains original text runs, sizes,
colors, underline, strike and hyperlink; this is not native Office acceptance.

The new decorated browser case exposed a native SVG seam when identical paints
were retained as separate tspans. `decoration-predecessor.json.gz` and the two
before/reference PNGs retain that failure. Equivalent adjacent paints are now
joined for native text and prepared decorations. The broader editor tests also
exposed the old assumption that every traced SVG text element had one text
child; DOM Ranges now walk nested styled text/link nodes. The verifier locates
the same base/cluster endpoint inside either an old fragment or a shaping group.

The first installed browser invocation lacked Playwright in its consumer. The
candidate harness now declares the pinned 1.63.0 driver and the consumer was
recreated; all installed reports here use that final lockfile. Registry-mode
historical fixtures retain their existing dependencies and verification refs.

Predecessor core `a13d36f` completed all three CI workflows successfully,
including [coordinated CI](https://github.com/OpenPresentation/opf/actions/runs/34981722317).
These local reports do not claim success for new commits' remote jobs.
New package versions, merges and deployments remain separate publishing work.
The existing variable-font/native Office gates are unchanged, and this matrix
does not prove universal mixed-script, cross-font or native rendering fidelity.
