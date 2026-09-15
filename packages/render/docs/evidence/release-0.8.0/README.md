# Renderer 0.8.0 release checkpoint — 2026-09-15

The release branch consumes published core 0.10.0 from npm. Its lockfile was refreshed after core publication, and a clean `npm ci` succeeded on macOS with Node 24.21.0. The full package test command, typecheck, validation and isolated packed installation passed. The packed check verified 17 shipped files byte-for-byte, registry signatures and available provenance attestations.

The local `npm run test:browser` failed at the JPEG orientation-7 crop comparison; the exact output is preserved in [macos-browser-failure.log](macos-browser-failure.log). The existing aggregate pixel-error criteria remain unchanged. The subsequent code-browser command was not run because the command chain stopped on this failure.

This is a release gate to investigate, not native Office acceptance. The release stays draft until browser acceptance and the exact dependency graph are verified. Furniture and prepared-font shaping are separate draft branches and are not in this candidate.

## Browser investigation and acceptance

The original failure above is retained. It also occurs with published renderer 0.7.0 and core 0.9.0, producing the same SVG SHA-256 and pixel measurements as this candidate with registry core 0.10.0. [The 32-case predecessor comparison](predecessor-comparison.json) records both versions in macOS arm64 Chromium 153.0.8010.12 on Node 24.21.0. Orientation 7 crop has mean channel error 0.775416 and 2.799127% of channels differing by more than 10 in both versions.

[Sampling diagnostics](sampling-investigation.json) localize the discrepancy to enlargement of already-oriented pixels: the JPEG and independent Pillow PNG decode identically at 60 × 120, but enlarged output differs even when the PNG is produced from that JPEG by the same browser. CPU readback and disabling GPU do not change this result. Explicit EXIF transforms on the original Pillow PNG avoid that interpolation-coordinate difference. The actual and expected full-size images were visually inspected; no product rendering, smoothing setting, geometry, font, or source asset was changed.

The corrected browser oracle checks all eight native JPEG decodes against their independent Pillow PNGs with the existing maximum channel difference of 2. It separately compares all 16 rendered fit/crop cases against the original PNG with independently specified EXIF matrices. Both original aggregate limits remain required: mean channel error ≤ 1 and no more than 2% of channels differing by more than 10. Every case rejects an incorrect orientation and a swapped fit/crop mode (32 negative controls). The earlier pre-oriented PNG measurements remain in every report, including their discrepancy. This replaces a sampling-sensitive reference, not a tolerance or production behavior.

[macOS browser acceptance](macos-browser-acceptance.json) passes all eight native decodes with zero pixel difference and all 16 enlarged cases. `npm run test:browser` also passes quote/footer glyph containment, and `npm run test:code-browser` passes 12 wide/portrait cases preserving source, tab positions and glyph containment. Reports are now saved before asserting success and uploaded by CI, so subsequent failures retain their measurements.

Reproduce with Node 24, the committed lockfile, `npm ci`, `npm run build`, `npm run test:browser`, and `npm run test:code-browser`. The browser report includes both the old diagnostic and new acceptance measurements. This resolves the local JPEG release gate; the updated PR must pass CI before publication. Native Office and experimental furniture/font-shaping acceptance remain separate.
