# September 29 runtime and release checkpoint

The delivery goal remains open, and work has resumed.
This checkpoint separates accepted source, installed-package checks, native
compatibility and publication. No package was published by this review. Web merges
may trigger existing deployment automation; local acceptance does not establish
production acceptance.
Official npm latest metadata checked on September 29 still reports the
September 17 train: core 0.11.0, CLI/render 0.9.0, PPTX 0.9.1 and editor 0.8.0
on Node 24.x. See the [published compatibility
matrix](compatibility-matrix.md) and [earlier checkpoint](handoff-2026-09-29.md).

The earlier [notes/scalar whitespace repair, PPTX87](https://github.com/OpenPresentation/opf-pptx/pull/87),
accepted as `170bb8755ba07c1e81b0a6a0c98b3e7d84f06eb0`, passes 123 controls in
source, registry-packed and coordinated installed contexts. Original Linux and
Windows premerge CI passed. The first automatic postmerge run was canceled on
both platforms; the distinct later run's retained snapshot records Linux success
and Windows pending. Neither is relabeled a complete postmerge pass. It preserves
notes, description and native
scalar characters. Supported ordinary body formatting is now accepted separately
in PPTX90 below; original source-shape reconstruction remains open. No new
package version is implied.

[Core155](https://github.com/OpenPresentation/opf/pull/155) accepted the six
renderer-absent furniture groups and coordinated UTC fixture, with original
core/ecosystem CI passing. Two synthetic edited copies differed only in caller
ZIP timestamps; their original whole-byte comparison failure remains retained
alongside equal member contents. [Core156](https://github.com/OpenPresentation/opf/pull/156),
accepted as `b3c8fbf762d975bd2e7d65d56b7e9838c94ae2e7`, adds the installed
portability foundation. Its original macOS missing-Chromium setup failure was
preserved and the browser installation moved before first use; all corrected
premerge jobs passed. Installed Linux/macOS/Windows and strict compiler controls
remain distinct from FF-09 font switching, physical-font/native acceptance and
final unmodified release tarballs. The postmerge snapshot retained Linux/Windows
pending results without relabeling them as passes.

## Local acceptance during the Actions credit shortage

On September 29 the owner explicitly authorized local tests and reviewed PR merges
while Actions credits are unavailable. Fresh appropriate local acceptance is now
sufficient for these merges; zero-step billing denials remain recorded as such.
No workflow protection, test assertion, native tolerance or release gate was
relaxed. Passing local tests is not a cross-platform, production or desktop
PowerPoint result.

The following accepted trees were independently reviewed and verified after
squash merge. [Compact merge receipts](evidence/local-acceptance-merges-20260929/README.md)
record each exact head, base, tree and accepted commit.

| Accepted PR | Change and local evidence |
| --- | --- |
| App52 | Nano ID 6; 704 unit tests, 13 standalone controls, 43 browser cases, SDK/CLI and app build/type checks, zero audit findings. |
| App57 | Six SDK/CLI workflow commands now have separate required steps, preserving Windows exit status. Structural negative controls and the same six local commands pass; no new PowerShell result is claimed. |
| [PPTX89](https://github.com/OpenPresentation/opf-pptx/pull/89) | Explicit native underline at four exporter sites. Source/current-installed controls, packed regressions and reviewed export comparisons pass; original failures and the published-core furniture limitation remain separate. |
| Gallery37 | Dependency update with fast-uri security correction; 117 units, 7 browser cases, build/type/registry/editor checks and zero audit findings. |
| App58 | Exact-source preset history and synchronous accepted-replacement guards; 737 units, 13 standalone controls, 49 browser cases and build/type checks. |
| Site48 | Dependency/security update plus compatible Lezer common deduplication. The first green browser run lost syntax highlighting; the corrected candidate passes the real highlighting regression and 27 browser cases, with visual review and zero audit findings. |
| App51 | TypeScript 6 with explicit SDK/CLI Node types, declaration-only tsup accommodation and one source-bound test-helper correction; 737 units, 13 standalone controls, 49 browser cases, SDK/CLI and app build/type checks pass. |
| Gallery48 | Selected detail-page, registry and editor JSON agree, including legacy hash links; 135 units and 7 original plus 5 scoped browser cases pass. Supersedes closed Gallery45 without merging Gallery44. |
| App56 | Dependency update; 737 units, 13 standalone controls, 49 browser cases, SDK/CLI and app build/type checks, zero audit findings and eight bounded HTTP MCP limit cases in CJS and public ESM pass. Scoped visual differences were reviewed; live authentication/provider and production acceptance remain separate. |
| [PPTX90](https://github.com/OpenPresentation/opf-pptx/pull/90) | Supported current native body/list formatting survives import. All 16 portable stages, 42 body and 123 notes controls across source/registry-backed/installed contexts, seven source browser suites and 108 installed browser checks pass; six previews reviewed. |
| Gallery49 | Metric values and labels remain readable; financial KPIs sit above the original chart. 144 units and 7 original plus 5 scoped browser cases pass, including edit/undo and all 15 pairs in native export. Four metric previews reviewed. |

All application/gallery browser counts above are single runs with zero retries.
Site48's original visually failing run is retained separately from its corrected
candidate. Root and delegated reviews retain bound source, original failures,
logs, screenshots, downloads and browser traces in the private task archive;
compact public receipts are an index, not a replacement for raw evidence.
No new npm train or manual deployment is included.

PPTX90 intentionally lets some ordinary untagged body/list values import as rich
arrays instead of strings, preserving current native runs, fields, breaks,
whitespace and supported styles. Heading inference and tagged recovery stay
separate. Exact current native text/styles replace the affected scalar test
expectations; their original failures remain retained. The portable native-quote
comparator keeps exact characters and block structure while allowing schema-valid
rich values. This does not reconstruct original cross-shape authoring boundaries,
source run identities or master/layout inheritance, and does not complete FF-09
or native/font compatibility. The only post-acceptance source change removed one
extra EOF newline from two identical modules, with byte, syntax and parity checks.

Gallery49 isolates the metric repair from the held image recipes. It preserves
original chart data, all image snippet bytes and visible missing-asset refusal.
Unknown whitespace or ambiguous metric strings remain exact. This is bounded
metric/payload ordering, not universal lossless prose parsing; quote reimport and
the rest of FF-30 remain open.

App51 does not fix the existing standalone `@pptx/cli` declaration dependency:
a CLI-only tarball cannot resolve its SDK type dependency, also on the preceding
TypeScript 5.9 graph. The co-installed SDK/CLI consumer passes. Experimental
bundled declarations caused incompatible private class identity and were rejected;
standalone package release remains a separate gate.

Gallery44 remains held despite 149 units and 7 original plus 6 scoped browser
cases passing on its reviewed pair. Its five new image recipes change a visible
missing-asset export refusal into successful output with missing images and no
diagnostic; two yield white text on white. A detail-page note does not protect
direct editor links or external consumers. Gallery48 preserves the original
clear refusal and does not claim to fix image fidelity. Gallery49 separately
repairs the reviewed metric wrapping; the unresolved image work remains open.

The published graph also still ignores all ten Gallery42 `socials: true`
examples: removing that flag leaves preview SVG and native slide XML unchanged,
and reimport omits organization socials. Its future-release qualification is
accurate, but it is not current functional feature acceptance. Gallery47's newer
number/date field options and Gallery43 backgrounds likewise retain their
coordinated release requirements. Their branch proposals are not a shipped
package capability.

## Accepted portable fixes

[PPTX #82](https://github.com/OpenPresentation/opf-pptx/pull/82) preserves native
chart cache positions and trailing gaps. Missing values remain null and actual
zero and explicit empty labels remain distinct; malformed or excessive caches
reject before dense allocation. Accepted commit
`7fca9a2eb5088ee2325fb686d1ff84332af2b8d9` has the same tree as reviewed
`1c60887793067d8c830a289d8bf0e3405f9749c2` and its original tested merge.
Original [Linux/Windows CI](https://github.com/OpenPresentation/opf-pptx/actions/runs/36546748615)
passed, as did original accepted-main [postmerge CI](https://github.com/OpenPresentation/opf-pptx/actions/runs/36548215070). Each platform ran 44 public cache controls against a fresh packed
consumer and again in the source suite. All 36 shipped files bind to reviewed
source; Windows CRLF conversion is recorded explicitly.

An unedited numeric cache containing `1e21` or `1e-7` still imported as `121` or
`1` after that fix. [PPTX #85](https://github.com/OpenPresentation/opf-pptx/pull/85),
accepted as `2fa70d8b71be13d7053b295994c984e6478f761d`, reads complete signed
decimal exponent tokens without changing the shared exporter parser or workbook.
Exponent overflow and nonzero underflow refuse with the affected chart, series,
cache and logical point path. All 44 prior cache controls plus 13 new groups
passed in fresh installed and source scopes on both platforms in the original
[CI run](https://github.com/OpenPresentation/opf-pptx/actions/runs/36561675960).
All 36 shipped files bind to the reviewed tree. Three representative exports
remain byte-identical, including their embedded workbooks. Original accepted-main
[CI](https://github.com/OpenPresentation/opf-pptx/actions/runs/36563260194) also
passed on Linux and Windows at the identical reviewed tree. Both original
artifacts passed digest and ZIP integrity checks; the 36 shipped files and all
nine packed fixtures bind to that tree, with Windows line endings recorded
explicitly. Neither workflow runs desktop Office.

Malformed/non-exponent parsing, exporter/workbook missing-value behavior,
category disagreement, scatter labels and broader chart parity remain open.
The broad renderer/PPTX chart drafts cannot be accepted solely because these
bounded import fixes passed.

Renderer [#47](https://github.com/OpenPresentation/opf-render/pull/47), accepted
as `c62b3f98a4ac98cdec8ffd28c035a17a04197396`, fixes finite extreme values that
previously produced infinite coordinates or `NaN` axis labels in column, bar,
line and area charts. It preserves the ordinary arithmetic path. All 36 public
axis cases passed against source and a fresh installed package, with all 20
shipped files bound to reviewed source. The original
[package CI](https://github.com/OpenPresentation/opf-render/actions/runs/36564292238)
passed; its 805-slide, 126-deck golden and the six bounded ordinary SVG controls
are unchanged. Ten local before/after images were reviewed. Very large scientific
axis labels still wrap or clip, so this is arithmetic acceptance, not completed
extreme-chart readability work.

The renderer's separate, report-only
[platform run](https://github.com/OpenPresentation/opf-render/actions/runs/36564292334)
completed successfully while still measuring five of five Source Serif Linux
rows above the unchanged 0.1 reference-pixel limit (maximum 0.134625 px).
The corresponding macOS rows and 18 bundled-font controls per platform were
within that limit. This diagnostic result does not close renderer issue #24 or
the native/font compatibility gates. The coordinated installed-package harness
now runs the original exponent and axis fixtures against accepted #85/#47;
historical registry checks keep their original published-train scope.

[PPTX #81](https://github.com/OpenPresentation/opf-pptx/pull/81), accepted as
`c749c356b4fb5a5b5dfa77db8f1f7dd3c7daef63`, also passed its original automatic
[postmerge Linux/Windows CI](https://github.com/OpenPresentation/opf-pptx/actions/runs/36542244211).
Its valid inline-layout regression ran in source; that older packed subset did
not yet include the layout fixture. Selected installed tests are not a complete
fidelity gate.

[PPTX #83](https://github.com/OpenPresentation/opf-pptx/pull/83) preserves current
media caption characters across soft wraps and exact full-tag CR/LF boundaries.
Cleared captions use linked-text/empty-text fallback instead of inventing a URL
caption. Compatible older soft/end tags remain readable. Accepted commit
`357171a5ceb798ccd550207ec365b08a694c5d6d` has the exact reviewed and tested tree
of `08815c76ab9494cfad98e18149c003385306882b`, which integrates #82.
Original [combined Linux/Windows CI](https://github.com/OpenPresentation/opf-pptx/actions/runs/36548912840)
passed with all nine installed fixtures, including 37 media groups, 11 layout
intent groups and 44 cache controls. Original [postmerge CI](https://github.com/OpenPresentation/opf-pptx/actions/runs/36550576333)
also passed on both platforms, with all shipped files and fixtures bound to the
accepted tree. Six bounded before/after media images were reviewed;
full-tag source fidelity, references-only semantic LF and ordinary native fallback
have distinct limits. This does not restore arbitrary native formatting/geometry
or certify desktop Office. Owner #78 merged earlier; the owner closed #80
unmerged, and its branch remains preserved.

The [compact receipts](evidence/runtime-pr-review-20260929/README.md) bind the
earlier #81/#82/#83 records; #85 is recorded separately above. All source fixes
above remain unpublished.

## Installed furniture checkpoint and wrapped-date follow-up

Core [#150](https://github.com/OpenPresentation/opf/pull/150) accepted the current
renderer/editor/PPTX checkpoint and candidate-only formatted-furniture fixture.
Core [#151](https://github.com/OpenPresentation/opf/pull/151) accepted this runtime
handoff. Their combined main at `ea32a63111c6d06be333e20fb31db22ab2d7b7a1` passed
both original [core](https://github.com/OpenPresentation/opf/actions/runs/36554712162)
and [ecosystem](https://github.com/OpenPresentation/opf/actions/runs/36554712113)
checks. The earlier #150 ecosystem push run was cancelled after #151 landed;
its later skipped stages remain recorded as skipped, not passed.

Core [#152](https://github.com/OpenPresentation/opf/pull/152), accepted as
`de88f4e0607ef099f41c96331b1c353502ba7cec`, adds three installed-browser workflows
for wide/portrait decks and actual pagination. Six PPTX exports check the same
explicit host date and final slide total as composition and actual SVG text.
The fixture also checks title-footer hiding, exact source ranges, literal edits,
undo/redo and a date-only update that leaves document history unchanged.
Its original [core](https://github.com/OpenPresentation/opf/actions/runs/36555305435)
and [ecosystem](https://github.com/OpenPresentation/opf/actions/runs/36555305454)
checks passed, as did accepted-main [core](https://github.com/OpenPresentation/opf/actions/runs/36556931351)
and [ecosystem](https://github.com/OpenPresentation/opf/actions/runs/36556931527).
Both accepted-main runs bind the reviewed tree; core passed 707 tests. The three
original CI screenshots were reviewed, and the postmerge images are byte-identical.
The initial local test-parser failure is retained separately. Its correction
changed no runtime code or field/source contract.

A separate portrait `minFontSize: 32` (reference pixels) probe exposed an unedited roundtrip loss:
a current date spanning two accepted lines became static PPTX text without a
warning, then imported as a literal instead of `date: true` with its format.
[PPTX #84](https://github.com/OpenPresentation/opf-pptx/pull/84), accepted as
`f91fbf82f7407b669ae159435aa4d7925ac51832`, now diagnoses dropped native field
ranges and recovers unchanged supported wrapped-date intent through bounded full
provenance. All 41 other files and 19 directory entries in the original probe remain
byte-identical; only two furniture manifest tag files change. Current edited or cleared text wins.
Old unmarked, references-only and provenance-off exports remain conservative.
The PPTX words remain static: this does not restore native live-date refresh or
arbitrary formatting/geometry.

The repair passed 20 focused source and fresh installed controls, including the
original package comparison, plus its full portable suite. Original
[Linux/Windows CI](https://github.com/OpenPresentation/opf-pptx/actions/runs/36556325988)
and original accepted-main [Linux/Windows CI](https://github.com/OpenPresentation/opf-pptx/actions/runs/36557698682)
both passed 19 new source cases per platform against that workflow's recorded
older sibling graph. The accepted commit and all shipped files bind to the
reviewed tree. These passes are distinct from the current coordinated graph.
Core [#153](https://github.com/OpenPresentation/opf/pull/153), accepted as
`7fdd39e39a4712c052b08f56f5a4dd4d9a625ab2`, uses accepted #84 with its recorded
renderer/editor pins, adds 19
installed wrapped-date mutation controls and expands the
[browser fixture](../scripts/test-furniture-fields-browser.mjs) to four workflows.
The [compact acceptance record](evidence/wrapped-furniture-20260929/README.md)
binds fresh local package checks, 805-slide goldens, 707 core tests and all four
passing browser workflows. Both original PR workflows
([core](https://github.com/OpenPresentation/opf/actions/runs/36559866383),
[ecosystem](https://github.com/OpenPresentation/opf/actions/runs/36559866319))
and original accepted-main workflows
([core](https://github.com/OpenPresentation/opf/actions/runs/36561369174),
[ecosystem](https://github.com/OpenPresentation/opf/actions/runs/36561369076))
passed every step. The accepted tree matches the reviewed tree; 19 installed
wrapped controls and all four browser cases passed. All four reviewed screenshots
and eight exported PPTX files are byte-identical between those original premerge
and postmerge runs. The wrapped date is legible; the 805-slide golden is unchanged.
These candidate results are not a published or native compatibility claim.

## UTC ZIP dates and the renderer-absent candidate gate

Core [#154](https://github.com/OpenPresentation/opf/pull/154), accepted as
`4bdaa5900ecd6a647d491c0322bfbf5bc71f59dc`, passed its original accepted-main
[core](https://github.com/OpenPresentation/opf/actions/runs/36568416311) and
[ecosystem](https://github.com/OpenPresentation/opf/actions/runs/36568416369)
workflows. That checkpoint binds the accepted chart fixes, 19 installed
wrapped-date controls, four installed furniture browser workflows and unchanged
805-slide golden. Its eight Linux PPTX exports match the prior Linux run.
The separate local-versus-Linux comparison found identical uncompressed content
across 714 ZIP members, with only timestamp metadata differing; it did not pass
whole-file cross-timezone determinism.

[PPTX #86](https://github.com/OpenPresentation/opf-pptx/pull/86), accepted as
`373dfa39688e787d861202e7a8069ebff7e8be36`, repairs explicit `zipDate` handling
using UTC calendar fields in both PPTX and embedded workbook archives. The tree
`2405fa1b86ac1abc034f14ab47e01bd8d38a56c2` matches reviewed head `5865743`.
Omission/undefined retains established fixed 1980 output; `timestamp` remains
the separate core-property XML option. Ambiguous, invalid and out-of-range
explicit dates now reject with `invalid-zip-date` at `options.zipDate`, an
intentional unreleased input-contract tightening. Original
[Linux/Windows CI](https://github.com/OpenPresentation/opf-pptx/actions/runs/36570457498)
passed the public timezone fixture in source and fresh packed contexts. Whole
control-PPTX bytes agree across those platforms within each recorded dependency
graph; that older CI graph and registry-backed packed checks remain separate from the
new coordinated candidate. At source preparation (`2026-09-29T13:05:16.240058+00:00`),
the original accepted-main CI audit was still pending; its result is recorded
separately from these permanent verification requirements.

The coordinated candidate checks pin accepted #86, retain its original public
UTC fixture with only the two installed-package import substitutions, and save
unique source and installed outputs. They also include the six reviewed
renderer-absent furniture groups in a separate fresh consumer. The isolated
preparation passed those groups with copied preview tarballs, including a real
wrapped date, exact authored whitespace, local overrides and current edited or
cleared text; it used estimated composition with no renderer or font provider.
The acceptance protocol requires 41 sequential stages on the combined accepted
graph and an independent whole-byte comparison of its eight furniture PPTX
outputs against frozen core154 Linux files. Resulting PNGs require separate
visual review; package byte equality does not establish raster equivalence.

[FF-11](programs/font-fidelity-everywhere/burndown.md) is **in-progress**, not done.
Font availability/substitution, LANG/locale, broader OS/runtime/ICU and complete
export determinism still need their own evidence. Default behavior after a host
TZ mutation is excluded from the bounded control. FF-27 remains in review;
static wrapped dates, native refresh/save/reopen, physical fonts, renderer's
0.1 reference-pixel compatibility limit and release dependency floors remain
separate gates. No package or production site changed.

## Release holds

The retained dependency-floor finding from the earlier PPTX #83 checkpoint remains:

Current unreleased PPTX source passes its full portable suite with accepted
core `061499d53aabefb266dd4f7f5c5bd85f6d24c425` and renderer
`6c7d7818e40d0f9c519e4b34f7a24e9150c1787f`. The retained full-suite run with
registry core 0.11.0/render 0.9.0 fails `test/furniture-fields.mjs:38`:
a requested `{current} / {total}` yields only the live slide number, without
` / 3`. Published core 0.11.0 does not expand the new format; accepted core
contains that later FF-27 implementation. This is an unreleased capability versus
dependency-floor mismatch, not evidence that published PPTX 0.9.1 fails its own
released suite. The current renderer, PPTX and editor still declare core
`^0.11.0`; PPTX/editor also allow the older renderer `^0.9.0`, which lacks the
accepted explicit host-date forwarding. The coordinated packer rewrites ranges
to preview versions, so its passing set does not establish those advertised
minimum versions. Final release tarballs must be tested with their manifests
unchanged and declared minima forced explicitly, including the supported
renderer-absent exporter path. The CLI bundles core and its skills and must be
rebuilt from the approved source; installing a newer standalone core cannot
upgrade the existing CLI's embedded implementation.

Before publishing any package in the new contract:

1. Select the complete candidate set and compatible minimum dependency versions;
   verify fresh isolated tarball installs at those floors. Preserve the accepted
   formatted-field, provenance, source-preservation and browser controls.
2. Finish the required cross-OS CI and visual review on that exact set, plus the
   separate native field refresh/save/reopen and physical-font gates for the
   release scope. Shared host-date forwarding now has installed integration
   evidence; it is not a missing renderer implementation.
3. Only after candidate acceptance, publish in dependency order, verify each exact
   registry artifact and supported floor, then verify the complete registry set
   before downstream consumers or production change. Historical registry fixtures
   and older CI sibling pins remain separately identified evidence.

No target versions, lowered tolerances or release exception are selected here.
All accepted source fixes above remain unpublished.

## Remaining PRs and ownership

Core #128 has a reviewed provenance correction and a main integration at
`e46c278e5dcbe2e2385f7a30c1b9d60aa62d13d4`. All three original workflows passed,
but the actual external gallery comparison was skipped because its checkout
token is absent. A separate local comparison passed against clean gallery
`58aa122690489a9206e1b583e5d9eea5e8cfd84e`. Keep the gallery #46 publisher-first
hold and the actual external-catalog comparison contract. The comparison may
run locally under the owner's policy, but the skipped CI step is not green and
local source parity does not establish that the required catalog is published.

The captured Data-Advantage Actions denials remain zero-step account/billing
failures. The owner's later local-test merge authorization is recorded above;
restoring credit is no longer a prerequisite for these reviewed PR merges.
No unchanged failed run was retried, and no denial is represented as a test pass.

PPTX #77 remains a substantive theme draft: accepted main does not contain its
changes, a read-only merge preview found 17 conflict regions, and per-reference
acceptance remains unfinished. Its old CI pass does not certify current-main
integration. Broader master/theme writing overlaps deferred scope; do not merge
it as routine cleanup. Keep the five geometry drafts coordinated: core #94,
renderer #27, PPTX #42, editor #25 and site #40. They remain substantive. Four
repositories conflict with current main; the clean site diff does not make it
independently ready. Choosing the old draft side of the core conflicts would
discard accepted image-safe areas, explicit heading alignment and
replaced-picture-slot removal. Historical
green checks never tested all five draft heads together. The site's default
canvas also needs an exact-source Escape/Undo/Redo control: source review shows
that an edited escaped token can be reconstructed with different JSON spelling.
That finding is source-derived, not a new browser observation. Never merge only
the site half or substitute the old geometry golden for current visual review.

App #58 is merged as
`4613656add2ed810eb70a7dc3a8a995dd6618255`, at the exact locally reviewed tree.
Its history guard binds preset undo to exact source, format and document
generation, commits pending preview edits, and invalidates on accepted local,
handoff, thread, agent or account replacements. Pending, cancelled, null and
failed responses do not invalidate the group. Its earlier and final zero-step
CI denials remain preserved; the owner explicitly accepted reviewed local
results for this merge. Signed-in UI, deferred source effects, broader stale
response ordering and production acceptance remain separate. The September 21
canonical 34/39 and Windows 38/39 failures are not erased by this narrower pass.

The Windows supervisor retains sole desktop Office control and owns its native
branches and evidence. Core [#148](https://github.com/OpenPresentation/opf/pull/148),
accepted as `0e81a407f57e5106ad607a9617c571d86b5428da`, retains the Calibri control.
The subsequent explicit-slot control in accepted
[#149](https://github.com/OpenPresentation/opf/pull/149), commit
`b5a88a58147bced0ff8b4e94f631d207bd48e122`, still observes an empty name and Aptos
in the native font collection after filling the four empty theme slots with
Calibri. Empty slots are unnecessary for that observation; its cause remains
open. Reported names and an orderly native lifecycle do not prove physical glyph
identity, an allowlist or embedding success. The later accepted [query-order evidence](https://github.com/OpenPresentation/opf/pull/157)
retains the same collection before and after bounded content reads; it establishes
stability over that interval, not the cause. This task did not repeat Office testing.
The latest accepted parity measurement in core #147 is 5/900 perfect, zero near
and 895 mismatches on its documented graph; it is not an overall completion
percentage. Physical fonts, embedding and native wrapping remain unresolved.
Preserve the renderer 0.1px and native tab 0.02pt gates. Native `p:hf` stays roadmap
work, and the Windows owner retains all desktop Office decisions.
