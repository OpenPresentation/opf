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
not a pending unpublished increment.

## Supported in this set

| Capability | How | Notes |
| --- | --- | --- |
| JSON authoring | `*.opf.json` plus CLI `opf create` | Local files only |
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
| Editable PPTX export | `toPptx` | OPF → PPTX serialization |
| Agent skills | `opf skills install` | Offline after the CLI is installed |
| Browser canvas | `@openpresentation/opf-editor/canvas` | Host must supply font bytes |

## Explicitly not shipped

| Topic | Tracker | Do not describe as done |
| --- | --- | --- |
| Linux vs Chromium native-width residual at the 0.1px gate | [opf-render#24](https://github.com/OpenPresentation/opf-render/issues/24) | Rounding that fixes Linux but breaks macOS is rejected |
| Native PowerPoint open/edit/save/reopen, provenance, tabs, notes-master, font embedding | [opf#87](https://github.com/OpenPresentation/opf/issues/87) | Self-import and `toPptx` are not Office acceptance |
| Public site route-by-route adoption | [opf#88](https://github.com/OpenPresentation/opf/issues/88) | Dependency bumps are not production verification |
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
