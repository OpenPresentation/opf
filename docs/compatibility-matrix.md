# Compatibility matrix

Published registry evidence for the coordinated Node 24 toolchain. This matrix
is the honest supported subset for [the developer quickstart](quickstart.md).
It is not universal Office parity and does not describe archived prototypes as
shipped.

Verify live versions with `npm view <package> version` before treating a
dated handoff as current. The pin set below matches `release-plan.json` at the
time this file was updated (21 September 2026). Immutable tag commits pin
the verification harnesses; see [current evidence](evidence/shipped-train-20260921/README.md).

## Runtime

| Requirement | Status |
| --- | --- |
| Node.js | **24.x** on every package below (`engines.node`) |
| Package managers | npm for published installs; this repo uses pnpm 10.33.2 for core development |
| Account / model / hosted API | Not required |
| Operating systems | macOS, Linux, Windows for Node APIs; browser entrypoints are separate |

## Coordinated published packages

| Package | Version | Depends on |
| --- | --- | --- |
| `@openpresentation/opf` | 0.11.0 | — |
| `@openpresentation/cli` | 0.9.0 | Bundles core 0.11.0; registry metadata has no runtime `dependencies` |
| `@openpresentation/opf-render` | 0.9.0 | `@openpresentation/opf@^0.11.0` |
| `@openpresentation/opf-editor` | 0.8.0 | `@openpresentation/opf@^0.11.0`; optional peer `@openpresentation/opf-render@^0.9.0` |
| `@openpresentation/opf-pptx` | 0.9.1 | `@openpresentation/opf@^0.11.0`; optional peer `@openpresentation/opf-render@^0.9.0` |

Install the complete pinned set. A caret range starting at 0.10.1 does not
include 0.11.0; old consumers can install a second core and do not establish
ColorRef preview/export support. PPTX 0.9.1 corrects its renderer peer to 0.9.x.

Shared header/footer geometry (`furniture-flow-v2`) is published. PPTX exports
editable slide shapes tagged `OPF_FURNITURE_V1` with provenance for controlled
reimport. These are not native Office Header/Footer objects (`p:hf` / notes
master). Native Header/Footer work remains [issue 87](https://github.com/OpenPresentation/opf/issues/87).

The [Windows native-picture checkpoint](evidence/windows-native-picture-20260921/README.md)
and accepted [native B/C bundle](evidence/windows-native-edits-20260921/README.md)
record finite picture/furniture edits, current-content provenance reimport and
safe fallback, production notes packaging and two controlled reordered-file
refusals. Core105 publishes that evidence; PPTX47 adds the tested harness, with
no new package version. UI image replacement changes geometry, longer header
text clips, and duplicated tagged headers overlap. Refused workers retain their
failed cleanup state separately from later empty-workspace observations.
This is not general native layout/reflow fidelity.

Accepted core106's [tab and font checkpoint](evidence/windows-native-tabs-fonts-20260921/README.md)
records plain native tab target error **0.022655487060546875pt** and tab/literal
difference **0.022678375244140625pt**, both above the unchanged **0.02pt** gate.
Its bounded four-face Carlito edit/save/reopen control passes exact text/style
persistence, zero observed bounds drift, matching rasters and owned font cleanup.
Mixed-size table fidelity, physical glyph-font identity, fallback/synthesis and actual embedding remain
open; embedding was disabled for this control. The Windows supervisor retains sole
Office control. This documentation task reads evidence and makes no Office calls.

The later [read-only font inventory](evidence/windows-native-font-inventory-20260921/README.md)
retains the four Carlito text styles but reports both Carlito and unexpected
Aptos in `Presentation.Fonts`. The native font allowlist fails, and no embedding
was attempted. The original parent report incorrectly fails cleanup because of
a Windows PowerShell 5.1 JSON-array parsing defect; raw stages and registration
rows establish one owned close and four removals in a separately labeled offline
audit. The raw failure remains intact. Collection names and flags do not identify
the physical font used for each glyph.

The [read-only mixed-table observation](evidence/windows-native-mixed-table-20260921/README.md)
retains all 245 characters, one literal tab and five authored runs, with outer
geometry within 0.02pt and confirmed owned close/font cleanup. Native soft-line
boundaries are 92/194 versus the estimated preview's 78/172, and native default
tab spacing is 72pt. These finite content/style results do not pass table
edit/save/reopen, browser/native raster agreement or physical glyph identity.
The accepted [nine-pair offline tab analysis](evidence/windows-native-tab-analysis-20260921/REPORT.md)
finds a 0.05pt-compatible pattern in the observed character starts, with finer saved
tab coordinates. These inputs do not distinguish relative versus absolute placement
or establish an internal engine cause. The 0.02pt native tab gate remains failed;
the separate 0.1px renderer gate is unchanged. Accepted core108 `9b277e1` and
core109 `b2711549` publish bounded evidence only. Windows-owned [core110](https://github.com/OpenPresentation/opf/pull/110)
is merged as `4f7a4bd494f1a873319eff897423d301d1cfc9d6`, from reviewed fc3c36e
with four required PR checks passing. [Renderer30](https://github.com/OpenPresentation/opf-render/pull/30) is now merged
as `c8d7d5ca1f67a7b39f70c7c4bd14577a865b175b`, with exact-head CI 35661051100
passing. The supervisor reports postmerge 35661504472 also passed. Its companion
source preserves rich-tab advances/spans; the [accepted Windows wrap-up](handoff-windows-native-2026-09-21-wrap-up.md)
records bounded source-linked rendering/browser checks and the original missing-test
CI failure. These checks do not update the frozen registry consumer. Core111
`3c5048522714365a41d9b5b9ba81620affae718b` publishes the font-inventory evidence
above with both PR workflows green; its postmerge workflows were started at the
final notice, not recorded as passed. Package/lock/release/site pins, schema,
goldens and tolerances are unchanged. Native allowlist and physical-glyph/embedding
acceptance remain open; no new package train or broad native pass is inferred.

## Supported in this set

| Capability | How | Notes |
| --- | --- | --- |
| JSON authoring | `*.opf.json` plus CLI `opf create` | Local files only |
| Bundled examples catalog | `@openpresentation/opf/examples` | **126** decks; the quickstart JSON is a docs fixture, not a 127th catalog entry |
| Validate | `validatePresentation` / `opf validate` | Schema and semantic checks |
| Color references | `ColorRef`, `variables`, `resolveColorRef` | Core schema/resolution, renderer preview and PPTX resolved colors are shipped. Native `schemeClr`/theme writing and editor canvas named-color fidelity remain follow-ups. |
| Offline catalog bundle | `bundlePresentation` / `opf bundle` | Inlines resolved catalog records; remote media/data and custom catalog sources remain explicit host concerns. |
| Lint | `lintSource` / `opf lint` | Read-only; no network catalog fetch |
| Offline fonts | `prepareNodeFonts` (`/fonts-node`) | Bundled Roboto pack; hashed files |
| Composition | `composeSlide` | Includes shared headers/footers |
| Pagination | `paginatePresentation` / `opf paginate` | Returns mappings; preserves source |
| Edit + undo | `@openpresentation/opf-editor` `createEditorSession` | JSON Patch undo/redo |
| JSON Patch CLI | `opf edit` | No persistent CLI undo history |
| SVG preview | `renderSvg` / `renderSvgDeck` | Local; same options as layout |
| PNG | `svgToPng` | Node raster of SVG |
| PDF | `svgToPdf` | **Raster-backed**, not selectable text |
| Editable PPTX export | `toPptx` | OPF → PPTX serialization. Furniture is tagged slide shapes (`OPF_FURNITURE_V1`), not native `p:hf` / notes-master Header/Footer objects |
| Agent skills | `opf skills install` | Offline after the CLI is installed |
| Browser canvas | `@openpresentation/opf-editor/canvas` | Host must supply font bytes |

## Public sites

The current source, CI and canonical production results are recorded in the
[current font-readiness checkpoint](evidence/font-readiness-acceptance-20260921/README.md),
[prior Inspector actions checkpoint](evidence/inspector-current-actions-20260921/README.md),
[earlier publication checkpoint](evidence/inspector-share-acceptance-20260921/README.md),
[source-preservation checkpoint](evidence/author-source-acceptance-20260921/README.md),
[completion checkpoint](evidence/completion-acceptance-20260921/README.md),
[earlier acceptance ledger](evidence/issue88-final-20260921/README.md) and
[handoff](handoff-2026-09-21.md). [Issue88](https://github.com/OpenPresentation/opf/issues/88)
remains open. Package adoption, deployed features and complete workflow
acceptance are separate claims.

| Surface | Deployed scope and acceptance | Source commit |
| --- | --- | --- |
| [openpresentation.org](https://www.openpresentation.org) | Current published guides, agent skills, JSON/preview workflow and downloads. Exact canonical deployment passes 321 checks across 11 pages and 18 raw resources, plus two browser flows for agent installation/navigation and JSON/SVG/PPTX downloads. Reviewed screenshots and output hashes match the accepted build. | `a85bcc77d899ce9ba1df659548be564142c16120` |
| [pptx.dev](https://www.pptx.dev) `/inspector` and `/author` | App54 merged/live on exact READY production. Premerge Linux/Windows pass 704 units, 13 standalone controls and 39/39 browsers. Full canonical acceptance **fails (34/39 passed)** at five no-POST assertions; the bounded audit does not establish an introduced upload regression. Postmerge Linux 39/39 passes, Windows 38/39 fails initial font readiness. Preset Undo all and broader source writers remain unresolved. | `8f54228a9e38a1dcc0bf8188bcdd519795b3799a` |
| [pptx.gallery](https://www.pptx.gallery) `/docs`, `/editor` and gallery pages | Published ColorRef/bundle guidance, Playground and Editor actions, and the canonical docs-to-editor flow are verified. | `f17e9ae5869669d5fbac3720f285652d0c37551c` |

The site uses documentation source `120a770`, whose tree matches accepted core
PR98 commit `b1ff81db6f8714b0db1a98bde482ed8a64d0ccc9`. Core PR93/97/98/99/100/102/103 passed
pre-merge and post-merge CI. Accepted core102 is
`578bcc6e0894129b00059258bd4ad1994a414baa`; its reviewed and accepted trees match,
and all four required pre/post-merge runs passed on their first attempts. The
[core102 receipts](evidence/inspector-share-acceptance-20260921/README.md#accepted-core102)
pin this documentation checkpoint without changing the site's older accepted
documentation snapshot. The site's complete guides and raw resources match
the reviewed source; binary evidence remains linked and downloadable without
being decoded into the AI-facing guide.
Core104 `3d301f1` preserves exact postmerge OPF success and coordinated cancellation;
it is not a complete green postmerge gate. Accepted descendant core105
`84e914710520a7b0e777fce30e5758ee64a64924` preserves all 60 core104 evidence blobs
and passes both exact-head workflows on their first attempts. [Compact receipts](evidence/inspector-current-actions-20260921/README.md#core-source-and-ci)
keep descendant acceptance separate from the canceled predecessor run.
Accepted core106 `3847f712ccb2379952bcc8ab7c9fdbaedfd0a4ce` also passes both
pre/postmerge workflows on their first attempts. Its [compact receipt](evidence/inspector-current-actions-20260921/core106/acceptance-receipt.json)
binds the bounded native evidence above without completing general compatibility.
Accepted core107 `5bc0d3f89414b382b2ce48452c7e56e5d66aaf74` has reviewed tree
`ffdc678beadf0808bc717d67e7fc0a9ec4790127`. Both original postmerge push workflows
**35652360502 / 35652360551** passed on attempt 1 under Node24.20.0.
[Compact receipts](evidence/font-readiness-acceptance-20260921/README.md#core107-acceptance)
retain earlier automatic premerge cancellations separately from the later automatic
successful pair; no rerun or accepted checkpoint relabels them.

[App47](https://github.com/Data-Advantage/pptx-dev/pull/47) corrects the pre-app47
completion adapter's rejected layout choices while preserving unchanged source
tokens and undo history. Accepted commit `0f35352a1445f56ad4bb7c9f4c5609e01f2dd9ae`
has reviewed tree `203bdab509d05911f04f234d996f9c91f2b5e4f2`, green Linux/Windows
pre/post-merge CI and its exact READY canonical deployment. The historical App47 **23/24** production run passes all five new completion cases but still fails the existing
LF Author third-popup assertion. This does not establish complete public-surface
acceptance; the [historical App47 report](evidence/completion-acceptance-20260921/canonical/REPORT.md)
and [earlier failed app45/app46 results](evidence/issue88-final-20260921/README.md)
retain their evidence and unresolved causes.

The [source audit](evidence/completion-acceptance-20260921/source-preservation-audit/REPORT.md)
identified Author canvas/Copy/export and Inspector JSON-download normalization.
Merged [App53](https://github.com/Data-Advantage/pptx-dev/pull/53) at
`e40c287b64fcbcfb85fb4a8a50641aea8e3e54a8` has the identical reviewed b33dc18
tree and preserves those bounded raw-source
paths and corrects order-only reimport history. A public Suggest-action guard
addresses the observed stale Quick Input context competing with focused-editor
Ctrl+Space. Current local checks pass **627 unit tests and 29/29 browser cases
in 88.78 seconds**, zero retries. First-attempt Linux/Windows application CI
passed 627 unit tests and 29 browser cases per platform; artifact CI also passed.
The [exact READY canonical run](evidence/author-source-acceptance-20260921/canonical/REPORT.md) passes **29/29**, zero retries, with matching deployment receipts before and after. Postmerge application CI fails Linux **28/29** while Windows passes **29/29**; both pass 627 unit tests and separate artifact CI passes. The [Linux failure](evidence/author-source-acceptance-20260921/app53/postmerge-ci/README.md) stops before security assertions because five default-deck canvases remain after the shared-load toast. No rerun or canonical pass replaces that failed gate. The retained draft preview was READY but not browser-accepted.

The earlier **24/27** import-undo regression, **26/27** local popup failure and
old-head Windows **26/27** shared-load failure remain historical evidence.
The fresh successful Windows job retained its sanitized timing artifact, but
only Author timings survived; the Inspector pagehide snapshot is missing. This
does not explain or fix the old readiness delay. Phase4
captured no post-fix stale-context overlap, so causal stress is inconclusive.
The existing suggestion-details pane remains clipped; visibility is not legibility.
The [postmerge trace diagnosis](evidence/author-source-acceptance-20260921/inspector-share-diagnosis/REPORT.md)
proves wrong-document automatic share-hash publication during import.
[App54](https://github.com/Data-Advantage/pptx-dev/pull/54) first corrected automatic
publication at `60c91f6`: authoritative source/format is checked before and after
encoding, load/navigation guards remain, and obsolete `import=hash:` is removed.
URL transfer preserves semantics, not raw spelling. Local 659-unit/31-browser
acceptance does not replace original first-attempt CI **35638158483**, which
passed Linux **31/31** but failed Windows **30/31** at the unchanged 45-second
Author readiness deadline. Both publication cases passed. The [frozen diagnosis](evidence/inspector-share-acceptance-20260921/app54/windows-timeout/REPORT.md)
retains bounded slow-delivery observations with unknown cause. Late assertions
are not an in-budget pass. Browser History tests permit prior accepted content
until first new publication; held-promise controls establish the narrower race guard.

The product correction was added at `57e5e59fddbc94346f142dc12d86a916228bf2ae`, tree
`d9c3aab543c6a886a85c6ec07dd55e5ab22590cd`. It guards current snapshots for
explicit Copy/JSON/Share/PPTX/PDF/Author/Deckchat actions. Pending public canvas
drafts commit before capture, pointer-blur rejection survives session recovery,
and newer source/load/navigation/unmount/action invalidates late results. Raw
Copy and accepted same-format JSON bytes are preserved; handoffs remain semantic.
Already-started clipboard/download effects cannot be retroactively canceled.
The integrated portable standalone startup verifies packaged runtime assets,
fonts and traced schema inputs without changing dependencies or published pins.

Local runtime checks pass **692 unit tests**, **7 standalone controls**, focused
**8/8** and full **39/39** browser cases, zero retries, with visual review. The
[immutable 93-file app bundle](https://github.com/Data-Advantage/pptx-dev/tree/57e5e59fddbc94346f142dc12d86a916228bf2ae/docs/evidence/inspector-action-snapshots-20260921)
retains stale-draft negative evidence and the initial candidate **7/8** result.
The latter did not establish accepted pasted source before releasing mocked PDF 401;
final visible-code preconditions change no product bytes or budgets. PDF/Deckchat
are locally mocked. CRLF ingress normalized 279 to 274 LF bytes; subsequent exact
actions preserve the accepted buffer, not that ingress boundary.

**The original 57e packaging gate failed.** First-attempt CI **35645493900** failed Linux and
Windows typecheck on archived `.spec.ts` evidence copies after each platform
passed 692 units and 7 standalone controls. The exact-head preview failed with
`module_not_found`; precise Vercel compiler logs were unavailable. [The first-attempt receipt](evidence/inspector-current-actions-20260921/app54/first57-ci/REPORT.md)
records skipped build/browser steps and no uploaded artifacts. The passing runtime build
predates those copies. A byte-identical `.ts.txt` archive correction produced captured App54 head
`6dfc2584698c1306505929a2bc3e427996d66563`, tree
`f3279495f7685945b7541c90d24f7239407639a0`. Its final-tree local typecheck passes
with all 305 product/test inputs unchanged. [The corrected receipt](evidence/inspector-current-actions-20260921/app54/corrected6df/commit-receipt.json)
binds its 106-file evidence bundle. [Exact-head CI 35646213757](evidence/inspector-current-actions-20260921/app54/corrected6df/ci/REPORT.md)
passes 692 units, seven standalone controls, typechecks and build on both platforms;
Linux passes **39/39** browsers. Windows executes **zero browser tests** because
standalone startup fails with `EPERM` while statting its packaged React dependency
link. No timing or test-result artifacts were uploaded. The exact-head preview
is READY, which is metadata only; at that 6df checkpoint App54 was unmerged and undeployed to production.
The [current ledger](evidence/inspector-current-actions-20260921/README.md)
retains the separate 60c readiness, 57e packaging and 6df startup failures. Production then remained App53 `e40c287`, with its original
failed Linux postmerge gate preserved separately from canonical **29/29**.
The [startup-link correction at 4338e57](https://github.com/Data-Advantage/pptx-dev/blob/4338e57b951c469d5c5f239b78a303fbad3c745e/docs/evidence/standalone-windows-links-20260921/README.md)
then reached all browser cases: Linux **39/39**, Windows **38/39** in first-attempt
CI **35649707689**, with 692 units and 13 standalone controls passing per platform.
The sole Windows failure was initial canvas-title visibility at five seconds,
before any edit/recovery operation; correct incoming source remained at loading
fonts. Late font acquisition and eleven incomplete responses at teardown do not
establish a permanent stall or a dominant cause. The [failed gate](evidence/font-readiness-acceptance-20260921/README.md#preserved-failed-windows-gate)
is preserved.

App54 font-preparation revision `a4eb88ab7aa585c9efb91de4c190c1f1c0c7d0eb`, tree
`031d893855a540fd2a4d2ec2162605817b8dde16`, overlaps font acquisition with converter
warmup while readiness still waits for both. The offline converter barrier and all
**33 faces / 9,317,044 bytes**, manifest, substitution/measurement policy and
`document.fonts.ready` gate remain unchanged. Fresh local Node24.21.0 checks pass
**704 units, 13 standalone controls and 39/39 browsers**, zero retries, including
unchanged offline export/reimport. [Immutable app evidence](https://github.com/Data-Advantage/pptx-dev/tree/a4eb88ab7aa585c9efb91de4c190c1f1c0c7d0eb/docs/evidence/font-preparation-concurrency-20260921)
retains reviewed images, exact source/output bindings and the original failed run.

**The original a4eb gate failed:** first-attempt application **35654753237** passes
Linux **39/39** but fails Windows **38/39**; both pass 704 units, 13 standalone
controls, typecheck and build. The Open in Author URL assertion exceeds its existing
five-second deadline at `inspector-actions.spec.ts:176`; later source checks are
not reached. Original4338 font readiness passes in this run. No navigation cause
or data-loss finding is established. The [frozen final audit](evidence/font-readiness-acceptance-20260921/app54/final-a4eb-ci/release-audit.json)
retains exact source/artifact bindings and the original failed trace; that failure remains preserved.
The Python artifact workflow is not applicable under its full-PR path filters,
not a fresh pass. Exact-head preview is READY metadata only; an
unauthenticated request redirects to sign-in, with no preview-browser acceptance.
At that a4eb capture App54 was unmerged and production remained App53
`e40c287`. The separate suggestion-details candidate remains unreleased and supplies
no acceptance here. No local/browser pass broadens native compatibility.
The [bounded navigation diagnosis](evidence/font-readiness-acceptance-20260921/README.md#author-navigation-diagnosis-and-prospective-policy)
records Loading Author and a delayed successful script response: 1490 bytes inferred
from ETag, 766 compressed bytes recorded, actual body absent. Later DOM does not
accept unreached assertions or identify a cause. App54 accepted merge
`8f54228a9e38a1dcc0bf8188bcdd519795b3799a` retains reviewed 79ba tree
`3639d3c14daec94d13711fa2b10f2b927df45eca`, preregisters `waitForURL(load)` before
the real action, matching `page.goto` within the unchanged 45-second test and default
five-second content budgets. It retains all oracles but deliberately removes the
incidental five-second navigation deadline. Fresh local **39/39**, zero retries,
passes in 112.780048s with reviewed source/images and prepared-tree build/typecheck.
The [immutable app bundle](https://github.com/Data-Advantage/pptx-dev/tree/79ba0157984fce8405eeb786b8ede1a4e59ba138/docs/evidence/author-navigation-policy-20260921)
retains original failures. Units/standalone controls were not repeated locally;
fresh first-attempt application **35659187971 passes 704 units, 13 standalone
controls and 39/39 browsers on both Linux and Windows**. Exact-head preview was
READY/protected, not browser accepted. The identical reviewed tree is merged/live
at 8f on READY deployment `dpl_H1FtXx1QSuGxn3MwzJwWJpGtRg8b`, but full canonical
acceptance **fails (34/39 passed)** at five no-POST assertions observing Clerk environment
POSTs. The [safe audit](evidence/font-readiness-acceptance-20260921/app54/canonical8f/write-audit/REPORT.md.txt)
records ten such requests, nine with HTTP200/zero-length bodies and one incomplete.
No fixture-content needle was detected in captured fields; uncaptured data remains
unknown. Three final action page-error assertions were not reached; the two share
cases passed theirs. The prior auth/config comparison is 28/29 identical, with only
package scripts changed. Production is kept without a rollback, test change or
rerun; the strict gate remains failed. Raw authentication-bearing diagnostics
remain private. [Postmerge CI 35660464578](https://github.com/Data-Advantage/pptx-dev/actions/runs/35660464578)
finishes failed: Linux 39/39 passes while Windows 38/39 fails, with 704 units/13 controls/typecheck/build
passing on each. Windows fails initial gallery-rail title visibility after 5,000ms
with correct source, clean schema and Loading slide fonts; later editing/export/
reimport checks were not reached. The [final audit](evidence/font-readiness-acceptance-20260921/app54/merged8f/postmerge-ci/REPORT.md.txt)
preserves this separate failed gate without cause inference or a retry. No canonical
pass or general native/font acceptance is claimed. Work is paused until user resumption.

Separate local negative controls confirm that preset Undo all discards New run
and imported replacement documents; ordinary-edit Undo remains untested after a
raw-buffer precondition failure. The proposed guarded preset correction remains
unapplied pending its separately requested approval. Local author/filename/gallery/preset writers
still serialize source. These unresolved local findings and raw imported-file/account/agent/metadata boundaries remain outside
App53 and App54. See the [App53 ledger](evidence/author-source-acceptance-20260921/README.md)
and its immutable application evidence links. Issue88 remains OPEN. Native/font
compatibility, required repair and release gates remain separate; geometry is
deferred as the coordinated set below. The unimplemented worker candidate remains in the [handoff](handoff-2026-09-21.md).

The five coordinated geometry drafts (core94, renderer27, editor25, PPTX42,
site40) remain unmerged. In particular, site40 is not independently shipped.

## Explicitly not shipped

| Topic | Tracker | Do not describe as done |
| --- | --- | --- |
| Linux vs Chromium native-width residual at the 0.1px gate | [opf-render#24](https://github.com/OpenPresentation/opf-render/issues/24) | Rounding that fixes Linux but breaks macOS is rejected |
| General native PowerPoint fidelity and real Office Header/Footer objects (`p:hf`) | [opf#87](https://github.com/OpenPresentation/opf/issues/87) | Finite B/C and bounded Carlito edit controls above are accepted evidence, as is one finite mixed-size table edit/save/reopen ([evidence](evidence/windows-native-mixed-edit-20260922/README.md)). Tab tolerance, preview/native mixed-table wrapping, physical glyph identity/fallback/synthesis, embedding and general layout/reflow fidelity remain open; self-import and tagged furniture do not certify arbitrary Office behavior |
| Public-surface acceptance checklist | [opf#88](https://github.com/OpenPresentation/opf/issues/88) | Shipping features does not establish every acceptance item; use the checklist and deployment receipts |
| HarfBuzz / prepared-glyph shaping | Archive branches `codex/archive-shaping-20260915` | Prototypes are preserved, not in npm |
| Selectable vector PDF | [pdf plan](plans/pdf-export.md) | Follows font reliability |
| General SVG diagrams / Mermaid | [diagrams plan](plans/diagrams-svg.md) | Embedded SVG ≠ native editable primitives |
| Full visual editor / IME / bidi / repair loop | [developer adoption](plans/developer-adoption-20260915.md) | Schema support ≠ WYSIWYG coverage |

CLI 0.9.0 does not render or export PPTX. Browser `svgToPng` / `svgToPdf` are
not available; those are Node APIs.

## Predecessor notes

| Older set | Relationship |
| --- | --- |
| core 0.10.0, renderer/PPTX/CLI 0.8.0, editor 0.7.0 | Previous coordinated Node 24 baseline. Lint and furniture landed across 0.10.0/0.8.0 then layout-placeholder fixes in 0.10.1/0.8.1/0.7.1. |
| Node 20 / 22 | Not valid for these packages |

Do not install sibling `../opf-render` dist folders when following the
quickstart. Packed and registry consumers must resolve `@openpresentation/*`
from npm.
