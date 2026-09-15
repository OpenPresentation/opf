# Source-preserving font shaping

The [Akasia shaping study](../evidence/akasia-shaping-20260914/README.md) changes
the next implementation decision: investigate a full shaping backend before
adapting the font or introducing width corrections. Current Fontkit differs
from Chromium on 460 of 8,568 canonical-form specimens from twelve exact open
faces. Both HarfBuzz bindings match Chromium advances on every specimen, and
the JavaScript binding produces the same glyph IDs, offsets and advances in
Node and Chromium. This narrows the recorded combining-mark problem to a
shaping difference; it does not prove general font compatibility.

The test-only model demonstrates the intended behavior through core `fitText`:
underestimated text wraps before its advance exceeds the available width, while
overestimated text avoids an unnecessary wrap. Original source ranges, accents,
tabs, mixed line endings, blank lines and the selected font-size floor survive.
At that study checkpoint no production backend or published font mapping changed.

## Runtime checkpoint — September 14, 2026

[Renderer PR21](https://github.com/OpenPresentation/opf-render/pull/21), commit
`d0d417952b706806e250c178bdc46732be429e9f`, implements the prepared opt-in
service behind the registry. Initialization is asynchronous and measurement
stays synchronous. Widths, outlines and original UTF-16 ranges come from one
run; caches bound both entries and glyphs. Registries own their bytes, including
Node Buffer input, and disposal leaves other owners usable. Physical selection,
coverage errors, substitutions and licenses retain existing policy. Fontkit
remains the default.

The [runtime evidence](https://github.com/OpenPresentation/opf-render/tree/d0d417952b706806e250c178bdc46732be429e9f/docs/evidence/font-shaping-service-20260914)
checks all 8,568 prior Akasia observations and three actual core wrapping/source
fixtures through the registry. All 33 bundled faces participate in Node and
offline-browser tests: 165 browser cases shape and 33 preserve coverage errors.
Node/browser glyphs agree; SVG advances differ by at most 0.01525px within the
unchanged 0.1px gate. Fresh candidate tarballs pass runtime-byte checks, those
APIs, public TypeScript consumers and dependency audit. The default renderer
still passes all 805 furniture-baseline golden slides.

This is an implementation checkpoint, not backend promotion or release. The
draft adds macOS/Windows Node and Linux package/browser CI; consult its current
checks rather than treating local results as those runs. Next: compressed-font
preparation and browser collection painting, followed by the variable/CFF,
itemization/bidi, fallback, performance, complete slide/ink and shared
editor/export acceptance below. Explicit WOFF rejection is a temporary
candidate limitation, not the target format contract. Native prerequisites
remain unchanged.

## Next runtime implementation

1. Add a reusable shaping service behind the existing font registry. Preserve
   physical-face resolution, theme/alias/substitution policy, explicit errors,
   licenses, glyph coverage and bounded caches. Initialize the pinned WASM
   asynchronously in the existing asynchronous loaders; retain a supported
   synchronous registry path with an explicitly prepared service. Do not add
   asynchronous behavior inside synchronous `measure` or layout calls.
2. Keep original source text authoritative. Shape original UTF-16 buffers;
   preserve clusters and their ranges without rewriting JSON to NFC. Widths
   and outline bounds must come from the same shaped run. Cache keys must
   include the face, engine, language, script, direction and feature settings.
   Treat empty glyph outlines and missing glyphs distinctly.
3. Cover every currently supported font input, including WOFF/WOFF2 and selected
   collection faces, before changing defaults. Verify variable-face behavior,
   resource lifetime, initialization errors, browser asset/CSP requirements,
   offline bundling, payload size and repeated-call performance. The current
   probe handles only twelve static TTFs and must not silently stand in for this.
4. Extend exact-face comparisons to all bundled base and Office-substitute packs,
   kerning, ligatures, combining marks, script/language itemization, mixed-script
   runs, bidi, fallback and supplementary characters. A buffer's guessed script
   is not paragraph-level bidi or mixed-script support. Retain failures and
   compare actual ink, baselines and complete slides, not just advances.
5. Integrate the accepted service into shared layout, preview/edit/undo and
   editable PPTX export, using one resolved configuration. Review any changed
   corpus output, run fresh installed-package and offline browser workflows,
   and preserve native validation as a separate gate. Only then promote the
   backend, publish in dependency order and adopt it on the public sites.

Native Office recovery, native font-file/glyph identity, existing tab/image
failures and independent Aptos comparison remain open. No Office retry is
authorized by this study. Selectable/vector PDF and diagram work retain their
existing sequence after font acceptance.

## Dependency assessment

The prototype pins `harfbuzzjs` 1.6.1 and `uharfbuzz` 0.56.1, both reporting
HarfBuzz 14.4.0. Two bindings of the same shaping engine are a cross-binding
check, not two independent shaping algorithms. The npm lockfile records its
integrity; the evidence records the actual JS/WASM hashes and Python install
report. The Python binding remains test-only. Renderer PR21 adds pinned
harfbuzzjs as a candidate product dependency, including the unchanged WASM and
both upstream license notices; it is not a published dependency change.

The [JavaScript migration guide](https://github.com/harfbuzz/harfbuzzjs/blob/main/MIGRATING.md)
documents module-load WASM initialization and automatic object cleanup. The
installed `Buffer.addText` implementation calls `hb_buffer_add_utf16`; the
probe includes an offset control after an astral codepoint. Product lifetime,
format coverage and packaging decisions still require verification.
