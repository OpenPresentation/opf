# Compatibility matrix

Published registry evidence for the coordinated Node 24 toolchain. This matrix
is the honest supported subset for [the developer quickstart](quickstart.md).
It is not universal Office parity and does not describe archived prototypes as
shipped.

Verify live versions with `npm view <package> version` before treating a
dated handoff as current. The pin set below matches `release-plan.json` at the
time this file was updated.

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
| `@openpresentation/opf` | 0.10.1 | — |
| `@openpresentation/cli` | 0.8.1 | Bundles core 0.10.1; registry metadata has no runtime `dependencies` |
| `@openpresentation/opf-render` | 0.8.1 | `@openpresentation/opf@^0.10.1` |
| `@openpresentation/opf-editor` | 0.7.1 | `@openpresentation/opf@^0.10.1`; peer `@openpresentation/opf-render@^0.8.1` |
| `@openpresentation/opf-pptx` | 0.8.1 | `@openpresentation/opf@^0.10.1`; peer `@openpresentation/opf-render@^0.8.1` |

Install that whole set together. Mixing an older renderer or editor with core
0.10.1 is unsupported.

Shared header/footer geometry (`furniture-flow-v2`) shipped in this set (core
composition plus renderer 0.8.x / editor 0.7.x / PPTX 0.8.x consumers). It is
not a pending unpublished increment. PPTX 0.8.1 writes furniture as tagged
slide shapes (`OPF_FURNITURE_V1`), not native Office Header/Footer objects
(`p:hf` / notes master). Native Header/Footer compilation is
[issue 87](https://github.com/OpenPresentation/opf/issues/87) only.

## Supported in this set

| Capability | How | Notes |
| --- | --- | --- |
| JSON authoring | `*.opf.json` plus CLI `opf create` | Local files only |
| Bundled examples catalog | `@openpresentation/opf/examples` | **126** decks; the quickstart JSON is a docs fixture, not a 127th catalog entry |
| Validate | `validatePresentation` / `opf validate` | Schema and semantic checks |
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

## Public sites (production, 2026-09-17)

These issue88 features are **live on canonical custom domains** (not Vercel
preview hosts). GitHub [issue 88](https://github.com/OpenPresentation/opf/issues/88)
remains **open** because its full checklist is not closed (homepage `/`
baseline re-verify, docs/stale API audit, overlay vs stacked-SVG hit testing).

| Surface | Production | Live feature | Squash SHA |
| --- | --- | --- | --- |
| pptx.dev Inspector / Author | https://www.pptx.dev/inspector (`/playground` **308** → `/inspector`); https://www.pptx.dev/author | Overlay + preview-to-JSON; last-valid preview; Author json-options | `17de6da` ([pptx-dev#42](https://github.com/Data-Advantage/pptx-dev/pull/42); Vercel `dpl_6QHXPJ5QLTYXHNqtPoByqxHxbqHx`) |
| pptx.gallery | https://www.pptx.gallery/layouts and `/layouts/title-slide` | Playground + Editor actions outside card `<Link>`; **0** nested anchors | `c7d3754` ([pptx-gallery#32](https://github.com/Data-Advantage/pptx-gallery/pull/32); Vercel `dpl_2SyhP4oX23ZBjsnVec7WKKaSF8xU`) |
| openpresentation.org playground | https://www.openpresentation.org/playground (apex **308** → `www`) | **Header & footer** example pill | `ea0d032` ([openpresentation-site#39](https://github.com/Data-Advantage/openpresentation-site/pull/39); Vercel `dpl_GqqrJyxmwT5JCeQY3m9Tw2SDRN5R`) |

Do **not** describe open geometry drafts or the homepage-renderer branch as
shipped ([opf#94](https://github.com/OpenPresentation/opf/pull/94) and siblings;
[openpresentation-site#40](https://github.com/Data-Advantage/openpresentation-site/pull/40)).

## Explicitly not shipped

| Topic | Tracker | Do not describe as done |
| --- | --- | --- |
| Linux vs Chromium native-width residual at the 0.1px gate | [opf-render#24](https://github.com/OpenPresentation/opf-render/issues/24) | Rounding that fixes Linux but breaks macOS is rejected |
| Native PowerPoint open/edit/save/reopen, provenance, tabs, notes-master, font embedding, real Office Header/Footer objects (`p:hf`) | [opf#87](https://github.com/OpenPresentation/opf/issues/87) | Self-import and `toPptx` tagged-shape furniture are not Office acceptance |
| Remaining issue88 checklist (GitHub issue still open) | [opf#88](https://github.com/OpenPresentation/opf/issues/88) | The three production features above are live; do not treat the issue as closed |
| HarfBuzz / prepared-glyph shaping | Archive branches `codex/archive-shaping-20260915` | Prototypes are preserved, not in npm |
| Selectable vector PDF | [pdf plan](plans/pdf-export.md) | Follows font reliability |
| General SVG diagrams / Mermaid | [diagrams plan](plans/diagrams-svg.md) | Embedded SVG ≠ native editable primitives |
| Full visual editor / IME / bidi / repair loop | [developer adoption](plans/developer-adoption-20260915.md) | Schema support ≠ WYSIWYG coverage |

CLI 0.8.1 does not render or export PPTX. Browser `svgToPng` / `svgToPdf` are
not available; those are Node APIs.

## Predecessor notes

| Older set | Relationship |
| --- | --- |
| core 0.10.0, renderer/PPTX/CLI 0.8.0, editor 0.7.0 | Previous coordinated Node 24 baseline. Lint and furniture landed across 0.10.0/0.8.0 then layout-placeholder fixes in 0.10.1/0.8.1/0.7.1. |
| Node 20 / 22 | Not valid for these packages |

Do not install sibling `../opf-render` dist folders when following the
quickstart. Packed and registry consumers must resolve `@openpresentation/*`
from npm.
