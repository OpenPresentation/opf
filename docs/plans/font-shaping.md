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
checks rather than treating local results as those runs. The temporary WOFF
rejection at that checkpoint is superseded by the container increment below.
Native prerequisites remain unchanged.

### Container checkpoint — September 14, 2026

Renderer `955aaf8261885c645ff95446269584b35b40cc71` prepares WOFF/WOFF2 locally
and fixes selected TTC browser/embedding bytes. All 33 bundled faces pass 66
compressed-instance comparisons; both faces of TTC and WOFF2 collections match
the originals. Seventy browser canvas pairs paint identical nonempty pixels to
their original selected faces, with geometric-precision advance differences
below the unchanged 0.1px gate. Standalone wrappers retain metadata/private
bytes, selected tables survive extraction, checksum repair and invalidated
signature removal are explicit, and fourteen malformed/limit controls reject.

The [retained container evidence](https://github.com/OpenPresentation/opf-render/tree/955aaf8261885c645ff95446269584b35b40cc71/docs/evidence/font-containers-20260914)
includes the initial canvas-mode mismatch and fixture errors. Full Node 24
renderer acceptance still covers all 805 unchanged golden slides; fresh
core/renderer tarballs pass the Node/browser matrix, all shipped-file hashes,
TypeScript consumers and a zero-finding audit. The source-pinned WOFF2 adapter
uses bounded synchronous Brotli and works without JavaScript `unsafe-eval`.
These are portable local/installed results; consult PR21 for current-head CI.

The follow-up renderer `a8e13eb82de9779593876aa882adc2eafef6a956` corrects
allocation based on advisory WOFF2 glyph-table lengths. Two Google-accepted
inputs rejected by the preceding installed candidate now preserve the original
glyph runs within the configured limit. Fresh installed checks include 72
browser pixel pairs; all 805 baseline slides still pass. The
[failure and corrected acceptance](https://github.com/OpenPresentation/opf-render/tree/a8e13eb82de9779593876aa882adc2eafef6a956/docs/evidence/woff2-reconstruction-20260914)
are retained separately. Both the initial container run and
[reconstruction follow-up CI](https://github.com/OpenPresentation/opf-render/actions/runs/34923247963)
passed Windows/macOS Node and Linux browser/installed/coordinated checks.

Renderer `f5a02752e96e1c1d40f2df2dca75ffcb1fd3dba1` fixes transformed horizontal
metrics with literal glyph/location tables. All three transform flags across
33 bundled faces preserve every advance/bearing and original glyph run; an
independent FontTools check accepts all 99 source-hashed fixtures. Seventeen
malformed inputs reject. The Google/browser decoder limitation is retained
separately from the original OPF failure. The registry supplies a compatible
standalone face for painting and keeps the complete original WOFF2 wrapper and
license in SVG metadata, reporting the compatibility reason explicitly.

The [metrics evidence](https://github.com/OpenPresentation/opf-render/tree/f5a02752e96e1c1d40f2df2dca75ffcb1fd3dba1/docs/evidence/woff2-hmtx-20260914)
retains both failures, independent checks and fresh tarball acceptance. All
171 installed browser pixel pairs are identical and nonempty; source metadata,
local-only requests, CSP, TypeScript consumers and zero audit findings pass.
All 805 reviewed-baseline slides remain unchanged. This is local and fresh
installed acceptance. The first Mac/Windows CI jobs failed before the new
metrics cases ran because importing SVG required candidate core composition
exports absent from published 0.9.0. Both failures are
[retained with the CI correction](https://github.com/OpenPresentation/opf-render/tree/246459149000f0be41766a1cf020676f4e38e0ff/docs/evidence/woff2-hmtx-ci-20260914).
Renderer `246459149000f0be41766a1cf020676f4e38e0ff` uses the same pinned core
candidate as Linux and stops at each failed preparation command. Runtime and
tests are unchanged from `f5a0275`; [CI at that correction](https://github.com/OpenPresentation/opf-render/actions/runs/34925817838)
passed Mac/Windows Node and Linux browser, installed-package and coordinated
checks. Its raw logs are retained in the following collection checkpoint.

Renderer `9bd4d320588750d8afa4f1b5732ec5fa4517393d` preserves each collection
face's transformed metrics when glyph tables are shared. Reused glyph bounds
and counts remain local to one decode; horizontal metric counts remain specific
to each face. It validates table identity/pairing before decompression and rejects
inconsistent shared metric reconstruction. All 33 bundled faces participate in
198 selected-face cases with distinct metric tables, four shared-metric/literal
controls and seven malformed controls. Test derivatives are renamed and retain
licenses; shipped fonts remain unchanged.

The [collection evidence](https://github.com/OpenPresentation/opf-render/tree/9bd4d320588750d8afa4f1b5732ec5fa4517393d/docs/evidence/woff2-collections-20260914)
retains the initial product failure, source hashes and independent FontTools
per-face reconstruction of every metric, glyph coordinate and instruction byte.
That reference check does not claim whole-collection decoding; its separate
recompilation limitation is recorded. All 373 browser pixel pairs are identical
and nonempty, including fresh tarballs, within the unchanged advance gate. The
expanded fixture transfer uses bounded batches on one persistent page/shaper
after reproducing Chromium's DevTools message-size limit. All 805 reviewed
baseline slides, public TypeScript consumers and the zero-finding audit pass.
[CI at this head](https://github.com/OpenPresentation/opf-render/actions/runs/34928184737)
passed Mac/Windows Node and Linux browser, installed-package and coordinated
checks. Raw logs were inspected and are retained with the DFont checkpoint.

Renderer `0ca1656c1884f6ba5f00a8e15ef17898df0be983` corrects selected DFont
resources for both backends. Previously the default embedded the outer resource
container as a TTF, and the prepared backend rejected it. The registry now
validates the supplied raw resource map, requires a unique PostScript name and
extracts that same face for measurement and browser loading. Complete original
container bytes and licenses survive in SVG metadata. Preparation reports the
resource ID/index and an explicit `dfont-resource` reason. No OS font lookup or
installation occurs.

The [DFont evidence](https://github.com/OpenPresentation/opf-render/tree/0ca1656c1884f6ba5f00a8e15ef17898df0be983/docs/evidence/dfont-resources-20260914)
retains both predecessor failures, all 66 selected-face/backend cases, first/single
resource controls and 19 malformed/selection controls. Independent FontTools
parsing checks all 66 sfnt resources in 33 containers against every original
byte and identity. The full 439 browser pixel pairs, 805 unchanged baseline
slides, 35 fresh-package file hashes, public TypeScript consumers and zero-finding
audit pass. Default DFont cases compare Fontkit metrics/outlines; prepared cases
also compare shaped glyphs and source ranges. [Current-head CI](https://github.com/OpenPresentation/opf-render/actions/runs/34929695382)
passed Mac/Windows Node and Linux browser, installed-package and coordinated checks; raw logs are retained in the following checkpoint. Raw resources are covered; MacBinary/AppleDouble wrappers
and Type 1 suitcase conversion are separate formats.

Renderer `28bd820286e0bf28b2efcaca3610d56988b1079e` preserves a **draft** fixed-variable-instance
implementation and its unresolved browser gate. Both backends receive selected
coordinates or named instances; browser FontFace and SVG CSS retain the same
selection and original source bytes. The bounded `fvar` adapter handles standard
subfamily IDs and record offsets. Compressed fonts now use the bounded decoder
with the default backend as well; browser payload impact remains unmeasured.

The [immutable draft evidence](https://github.com/OpenPresentation/opf-render/tree/28bd820286e0bf28b2efcaca3610d56988b1079e/docs/evidence/variable-instances-draft-20260914)
contains 712 passing Node format/instance/backend cases across 16 pinned OFL
fonts, 148 independently recorded named instances and 12 rejection controls.
All 712 Chromium pixel comparisons match, but ten measurements exceed the
unchanged 0.1px browser advance gate: five Fontkit CFF2 and five HarfBuzz variable
TTF cases. Maximum observed differences are 0.134625px and 0.132061px. The full
805-slide renderer regression and syntax/package checks pass. CI now includes
the unresolved browser gate; this commit is not accepted for release.

The subsequent renderer checkpoint `a5f3ec6d8acbccaae3ade462621349070d5244f7`
adds stricter variation-input/standalone-name validation and
[portable installed evidence](https://github.com/OpenPresentation/opf-render/tree/a5f3ec6d8acbccaae3ade462621349070d5244f7/docs/evidence/variable-metrics-portability-20260914).
The metadata suite passes 88 positive controls and 58 rejection/limit controls;
16 record the pinned HarfBuzz rejection of hypothetical extended fvar records.
Fresh packages verify 36 shipped hashes, the 712-case Node matrix, public
TypeScript variation APIs, existing 439 browser comparisons and a zero-finding
audit. Their new variable browser matrix reproduces all ten Mac failures and
correctly exits nonzero. The full 805-slide regression remains unchanged.

Linux Chromium has the same pixels within its matrix, but fails ten Fontkit
advance cases and zero prepared HarfBuzz cases. Mac fails five with each backend.
Native advances differ by up to 0.134765625px for five TrueType instances. The
repeated-glyph diagnostic amplifies the difference to about 4.57px. Pinned
HarfBuzz rounds HVAR deltas before scaling, so increasing output precision alone
does not recover those fractions. CI at 7916fc1 passed Mac/Windows Node and all
earlier Linux acceptance steps before failing this new browser gate. Raw logs
and complete reports are retained. CI at `a5f3ec6` also completes with passing
Mac/Windows shaping jobs and all earlier Linux checks, followed by failures in
both the fresh installed and source variable browser gates. The raw reports
and three platform logs are retained in the next renderer checkpoint.

Renderer `1b17e70` adds controlled browser/kerning context to that diagnostic:
pinned Chromium on both Mac and Windows, system Edge as a separate Windows
comparison, and both `none` and `normal` kerning. Locally, the 188 Mac instance
selections produce identical repeated-H widths in both modes. The preceding
Windows result used Edge 152 with kerning disabled; its much larger CFF2 drift
cannot yet be generalized to Chromium 153 or normal kerning. The diagnostic
records finite positive measurements and cleanup, not fidelity acceptance.
The completed Windows diagnostic shows the same repeated-H CFF2 differences
in Chromium 153 and Edge 152 with either kerning mode. Neither version nor
kerning setting explains this Windows observation. The run was cancelled by
the later implementation push after both Mac/Windows jobs passed and Linux
failed its installed variable gate; its source-browser result was incomplete.

Controlled browser bundles add 74,415 gzip bytes for the font loader and 413 for
SVG versus the verified DFont predecessor, without pulling in HarfBuzz WASM.
These are bundle measurements, not deployed page-load measurements. No package
publication, deployment or native variable-instance acceptance occurred.

A further [CFF2 glyph probe](../evidence/variable-rounding-probe-20260914/README.md)
found 458 one-unit counterexamples to naive HVAR delta rounding across 143,207
glyph/instance combinations. Renderer `489273e1ae0688cb8295cd09b7137636ad4c72f5`
corrects Fontkit coordinate normalization before glyph/layout caches populate:
16.16 input and mapping calculations, followed by signed 2.14 coordinates.
It also preserves exact four-character tags and fixes defaults at axis maxima.
Original font bytes, user values and source text remain unchanged. The new
bounded reader supports `avar` 1.0 and explicitly rejects unsupported mapping
versions, including `avar` 2; broader axis-mapping coverage remains open.

An independently built FreeType 2.14.1 confirms all 188 fixture instances.
Four Source Sans Semibold boundaries differ from FontTools 4.60.2's floating
reference; both references and the initial failure are retained. All 143,207
CFF2 glyph comparisons now agree with HarfBuzz after applying its integer
advance policy in the diagnostic. No runtime rounding of derived advances
was added. Endpoint, collapsed-axis, exact-tag and mapping controls pass.

The unchanged 805-slide regression and source Node matrix pass. Fresh tarballs
verify all 37 shipped-file hashes, the independent normalization controls,
712 Node cases, original 439 browser pixel pairs, public TypeScript consumers
and a zero-finding audit. Both the source and installed 712-case browser
matrices still fail five Fontkit CFF2 and five prepared TrueType advance
comparisons on Mac, while all within-platform pixels match. The normalization
correction resolves a prerequisite; it does not close the metric/paint gate.
Renderer evidence checkpoint `e293b55` retains full reports and failures.

The subsequent CFF2 implementation `1b3da21926fa81b0614a4407b0e10142853d8a9f`
applies HarfBuzz's integer HVAR advance policy before Fontkit glyph positioning.
It leaves outline, interpolation, kerning and mark deltas fractional. All
143,207 actual CFF2 glyph advances and 188 complete positioning runs agree with
the independent reference; 112 runs retain fractional positioning. The source
and fresh installed Mac matrices now pass all 356 default Fontkit cases, with
maximum source advance drift 0.002414013px. All 712 pixel comparisons match.
Only the five prepared HarfBuzz TrueType cases still fail on Mac. The full
805-slide regression and 37-hash installed-package checks pass unchanged.

[Evidence checkpoint 41311de](https://github.com/OpenPresentation/opf-render/tree/41311deeaf18fa738f7e5934620c7e84710fde9e/docs/evidence/cff2-advances-paint-20260914)
also adds selected-outline versus actual-paint diagnostics for 564 glyph cases.
On Mac, no default/minimum/maximum control is closer than the selected outline;
the reviewed thin italic still shows stroke differences. An initial cropped
probe is retained as invalid evidence. The final probe rejects cropped ink,
records widths separately, and runs in pinned Chromium on all three platforms
plus system Edge on Windows. Windows/Linux results were pending at that
checkpoint; the completed comparison follows below.

### Native metric/paint checkpoint — September 15, 2026

Renderer [checkpoint `74f0b8b`](https://github.com/OpenPresentation/opf-render/tree/74f0b8b8968ba168f1a5d67e5951184fc3602365/docs/evidence/native-metric-portability-20260915)
adds a reproducible cross-platform report and retains completed CI at
`41311de`. The Mac and Windows shaping/diagnostic jobs passed. Linux passed the
earlier 805-slide, browser and coordinated installed workflows, then failed
both source and fresh installed variable-font gates. Each Linux report has
712 matching nonempty pixel comparisons; all CFF2 cases and all 356 HarfBuzz
cases pass. Five Fontkit TrueType cases fail (maximum 0.134625px). The fresh
package also verifies 37 shipped hashes, the 712 Node cases, normalization,
439 earlier browser pairs, TypeScript consumers and zero audit findings.

Each platform's 564 selected-outline glyph comparisons supports selection for
the sampled `H`, `g` and `W`; no default/minimum/maximum control is closer.
Windows Edge repeats the Chromium observations. Reviewed thin italic strokes
still differ, so this is not identical rasterization or full-slide acceptance.

With the same font bytes, coordinates, Chromium 153 and HarfBuzz 14.4.0, native
Mac/Linux CFF2 widths agree while Windows uses pixel-rounded advances. In the
repeated-H diagnostic, the maximum native gap is 64.509765625px for CFF2 and
4.568359375px for TrueType. Some gaps exceed twice the 0.1px precision target:
no common measurement can be within that target of both native widths.
The report verifies identity/sample coverage and retains all joined cases;
four malformed/incomparable-report controls reject. Pinned Chromium/Skia source
routes CFF2 through Fontations and contains a hinted advance-rounding path
consistent with the observations. This is not a captured native call trace.

The next rendering experiment must paint the accepted glyph IDs and per-glyph
positions from the same run used by layout, while retaining selectable and
accessible logical text, exact UTF-16 source ranges, rich formatting,
preview editing/undo and editable PPTX semantics. Verify complete lines,
ligatures, combining marks and full-slide ink. Keep native-text comparisons
separate and unchanged; neither a final-width correction nor platform-dependent
hidden metrics resolves the common rendering contract. No runtime policy,
default, tolerance, package or deployment changed in this diagnostic increment.
A font-functions adapter also requires ownership/lifetime verification.

Next: complete the shared glyph-paint contract, wider axis-mapping coverage and
the CFF2/variable metric/paint gate, paragraph
itemization/bidi, fallback, performance/lifetime analysis, complete slide/ink
review and shared editing/undo/export acceptance. Fontkit remains the default;
this is not registry publication, site adoption or native compatibility proof.

## Implementation and promotion requirements

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
   offline bundling, payload size and repeated-call performance. The original
   Akasia probe covers twelve static TTFs; the container checkpoints above remain
   separate matrices and must not stand in for uncovered formats.
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
