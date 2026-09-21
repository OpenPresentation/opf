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
[Inspector publication checkpoint](evidence/inspector-share-acceptance-20260921/README.md),
[source-preservation checkpoint](evidence/author-source-acceptance-20260921/README.md),
[completion checkpoint](evidence/completion-acceptance-20260921/README.md),
[earlier acceptance ledger](evidence/issue88-final-20260921/README.md) and
[handoff](handoff-2026-09-21.md). [Issue88](https://github.com/OpenPresentation/opf/issues/88)
remains open. Package adoption, deployed features and complete workflow
acceptance are separate claims.

| Surface | Deployed scope and acceptance | Source commit |
| --- | --- | --- |
| [openpresentation.org](https://www.openpresentation.org) | Current published guides, agent skills, JSON/preview workflow and downloads. Exact canonical deployment passes 321 checks across 11 pages and 18 raw resources, plus two browser flows for agent installation/navigation and JSON/SVG/PPTX downloads. Reviewed screenshots and output hashes match the accepted build. | `a85bcc77d899ce9ba1df659548be564142c16120` |
| [pptx.dev](https://www.pptx.dev) `/inspector` and `/author` | App53 exact READY canonical deployment passes **29/29**, zero retries. Premerge application/artifact CI passed both platforms. Postmerge application CI remains failed: Linux **28/29**, Windows **29/29**; artifact CI passes both. Destructive preset Undo all and broader source writers remain unresolved. | `e40c287b64fcbcfb85fb4a8a50641aea8e3e54a8` |
| [pptx.gallery](https://www.pptx.gallery) `/docs`, `/editor` and gallery pages | Published ColorRef/bundle guidance, Playground and Editor actions, and the canonical docs-to-editor flow are verified. | `f17e9ae5869669d5fbac3720f285652d0c37551c` |

The site uses documentation source `120a770`, whose tree matches accepted core
PR98 commit `b1ff81db6f8714b0db1a98bde482ed8a64d0ccc9`. Core PR93/97/98/99/100/102 passed
pre-merge and post-merge CI. Accepted core102 is
`578bcc6e0894129b00059258bd4ad1994a414baa`; its reviewed and accepted trees match,
and all four required pre/post-merge runs passed on their first attempts. The
[core102 receipts](evidence/inspector-share-acceptance-20260921/README.md#accepted-core102)
pin this documentation checkpoint without changing the site's older accepted
documentation snapshot. The site's complete guides and raw resources match
the reviewed source; binary evidence remains linked and downloadable without
being decoded into the AI-facing guide.

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
The [postmerge trace diagnosis](evidence/author-source-acceptance-20260921/inspector-share-diagnosis/REPORT.md) also proves wrong-document automatic share-hash publication during import; [App54](https://github.com/Data-Advantage/pptx-dev/pull/54) is the unreleased
correction at `60c91f6b97c75636f533202f4112e09dc01144e4`, tree
`b317179a899e97740003b4195b7172f7d3d6d8b2`. Automatic publication validates the
current source/format before and after encoding, retains navigation/load guards,
and removes the obsolete reserved import query so refresh uses the new fragment.
URL transfer preserves document semantics, not original whitespace or spelling.
Fresh local checks pass **659 unit tests**, focused **3/3** browser cases and
full **31/31** in **97.035744 seconds**, zero retries, with independent source and
screenshot review. Browser transitions permit the preceding accepted document
until the new publication; held-promise controls cover the narrower asynchronous
source race. Security assertions and timeout budgets remain unchanged.
First-attempt application CI **35638158483 failed**: Linux **31/31**, Windows
**30/31**, with **659 unit tests** passing on each platform under Node24.20.0.
Both new share-publication cases passed on both platforms. The original
45-second SVG-security deadline expired waiting for Author Preview after
31.400 seconds of Author navigation; a 1,490-byte decoded local script took
30.026 seconds. The [frozen diagnosis](evidence/inspector-share-acceptance-20260921/app54/windows-timeout/REPORT.md)
records bounded delivery observations, not an established scheduling cause.
Inspector security checks passed before navigation; late Author assertions do
not count as an in-budget pass. App54 is held and unmerged. Artifact compatibility
was not applicable or triggered, not a fresh pass.
Exact-head preview `dpl_Atu9SsSsLY8hPAZJ6RPNx91pKA31` is READY with target null and
has no browser acceptance. Production deployment/acceptance and post-merge CI
remain pending behind the failed application gate. See the
[current App54 ledger](evidence/inspector-share-acceptance-20260921/README.md)
and its immutable application evidence. Explicit toolbar Share, export and
Author handoff freshness remain outside this automatic-publication correction.

Separate local negative controls confirm that preset Undo all discards New run
and imported replacement documents; ordinary-edit Undo remains untested after a
raw-buffer precondition failure. Local author/filename/gallery/preset writers
still serialize source. These unresolved local findings and raw imported-file/account/agent/metadata boundaries remain outside
App53 and App54. See the [App53 ledger](evidence/author-source-acceptance-20260921/README.md)
and its immutable application evidence links. Issue88 remains OPEN. Native/font
compatibility, required repair, geometry and release gates remain separate; the
unimplemented worker candidate remains in the [handoff](handoff-2026-09-21.md).

The five coordinated geometry drafts (core94, renderer27, editor25, PPTX42,
site40) remain unmerged. In particular, site40 is not independently shipped.

## Explicitly not shipped

| Topic | Tracker | Do not describe as done |
| --- | --- | --- |
| Linux vs Chromium native-width residual at the 0.1px gate | [opf-render#24](https://github.com/OpenPresentation/opf-render/issues/24) | Rounding that fixes Linux but breaks macOS is rejected |
| Native PowerPoint open/edit/save/reopen, provenance, tabs, notes-master, font embedding, real Office Header/Footer objects (`p:hf`) | [opf#87](https://github.com/OpenPresentation/opf/issues/87) | Self-import and `toPptx` tagged-shape furniture are not Office acceptance |
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
