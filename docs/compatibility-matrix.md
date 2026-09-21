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

The owner verified the 17 September production release on the canonical
sites with this package train. Feature implementation and package adoption
are distinct from completing every acceptance item in
[issue 88](https://github.com/OpenPresentation/opf/issues/88). Fresh checks pass the homepage/playground baseline and gallery config handoff.
The original [production audit](evidence/shipped-train-20260921/production/REPORT.md)
identified Inspector later-slide and raw-source gaps. [pptx-dev PR45](https://github.com/Data-Advantage/pptx-dev/pull/45)
contains the corrective implementation and fresh local browser evidence; exact
PR CI and canonical deployment acceptance determine shipping status. Author
catalog-choice apply/undo now passes on canonical production. Site43 and
gallery35 correct the public agent pins and ColorRef guidance. The remaining
website docs snapshot/exporter and gallery36 follow-ups are tracked in the
[acceptance ledger](evidence/issue88-followup-20260921/README.md) and issue88.
The latest
[handoff](handoff-2026-09-21.md) records exact source commits and outstanding work.

| Surface | Shipped feature | Source commit |
| --- | --- | --- |
| [openpresentation.org](https://www.openpresentation.org) `/` and `/playground` | JSON/preview workflow, contextual choices, Header & footer example | `1e28978cb27899c3708e25b9d4baf2f2eb83d597` |
| [pptx.dev](https://www.pptx.dev) `/inspector` and `/author` | Inspector preview-to-JSON overlay and last-valid preview; Author contextual json-options | `761885b98092657fbbd05ffa529316d8b635539a` |
| [pptx.gallery](https://www.pptx.gallery) `/layouts` and detail pages | Playground and Editor actions | `7e50114ef4ce4fcac7843f9ff11d83d9bd7c37ee` |

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
