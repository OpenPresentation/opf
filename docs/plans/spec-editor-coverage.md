# OPF editor and site coverage

The acceptance target is every aspect of the canonical OPF specification, with visual properties reflected faithfully in the browser and nonvisual properties editable without losing data. Field discovery is one dimension of coverage; rendering, interaction, and PPTX parity require separate evidence.

## Current implementation

The current 12 schemas contain 604 property definitions, including definitions nested inside union branches. The editor's All properties workspace derives controls from those schemas. It exposes optional fields, structured alternatives, arrays, arbitrary maps, promoted slide regions, assets, extensions, and all 11 catalog kinds. Valid drafts preview through the same renderer, Apply creates one undo step, and concurrent document changes reject stale drafts. Main canvas editing remains available alongside this property workspace.

The gallery `/spec` and `/api/opf-spec.json` contain the same schema digest and property inventory. `/editor` embeds the shared browser build. Run `node scripts/prepare-gallery-editor.mjs` from the OPF workspace to synchronize the reference and embedded assets. They are generated from sibling sources and checked into the gallery so a standalone site build has no sibling requirement. For linked local OPF dependencies, use `OPF_LOCAL_WORKSPACE=1 npm run build` in the gallery.

## Feature-level acceptance

| Feature | Editing and representation | Visual work remaining |
| --- | --- | --- |
| Identity, author, purpose, audience, tone, language, duration, tags, extensions | Schema controls and reference available; values preserved | Primarily nonvisual; language shaping and language-driven typography remain incomplete |
| Organizations, speakers, narrative beats and slide attribution | Structured controls, arrays and references | Automatic cover/bio/logo placement, narrative-aware UI and generated content are not implemented |
| Slides, notes, section, hidden state | All fields available, slide array reorder/duplicate/remove | Dedicated presenter mode and hidden-slide playback behavior |
| Title, subtitle, tag, plain text | Canvas editing and property controls; alignment rendered | Caret calibration across scripts and browser engines |
| Rich text runs | Every run field editable as structured data | Shared mixed-run font/style/color/link/script measurement and SVG/native PPTX output implemented for text payloads; native SVG selection toolbar and range replacement implemented; continuous mixed-style typing is now published in editor/renderer 0.1.1 with native input, glyph-aligned caret/selection, draft history and guarded commit; real OS IME, mixed-script shaping and cross-engine caret calibration remain |
| Lists and bullets | Shared rich-run/description measurement, hanging indents, nesting, inline string editing, range formatting, structural controls and native PPTX bullets | Image bullets, real OS IME and cross-engine rich typing calibration, lossless rich-list PPTX import and native raster parity |
| Tables | Cell and structure editing; development schema adds canonical rich cells and headers | Unreleased coordinated rich-cell measurement, SVG tracing, editor formatting/typing/undo and native PPTX run export are covered by regression tests; rich native import, cell decoration, advanced interactions and native PowerPoint parity remain |
| Metrics, quotes, code, timelines | Scalar/object/array forms and previews | Specialized typography, syntax highlighting, dense layout polish |
| Charts and external data | Chart/data schemas and catalog record forms | CSV/TSV/JSON snapshot import with mapping and undo; common chart families render all series and signed values. Live source refresh and advanced preset-specific charts remain |
| Content blocks, promoted regions and composition | Nested forms, geometry controls and shared layout | Track divider resizing implemented for root/nested flows with undo and keyboard support; sibling block drag/reorder and menu-based moves between groups/slides implemented; palette insertion, duplication and deletion with empty-group pruning implemented; additional placement constraints and chartPrimary/contentDirection integration remain |
| Theme, color and font schemes, dimensions | References and inline overrides editable | Theme-wide typography feature parity and coverage of all font families |
| Backgrounds | Theme/hex/solid, angled gradients, opacity, image fits, three pattern presets rendered; PPTX 0.2.1 imports supported inherited/theme backgrounds and ordered luminance/opacity transforms as explicit colors | Native theme linkage, image/pattern background import, other color transforms, other engine-defined pattern IDs and pixel calibration against PowerPoint; unresolved images need a host resolver |
| Headers and footers | All zones, text, images, slide numbers, organization and section rendered | Boolean date needs an explicit presentation date convention; use a literal date string for deterministic output |
| Watermark, imageFill, contentBox, text alignment | Controls and SVG implementation | Full decoration/layout interactions and export parity |
| Logo sets and slideImage treatments | All forms editable | Automatic logo variant selection and slideImage positioning |
| Image/video/asset registries | Asset source/metadata controls and maps; embedded raster images supported | Video playback, external asset resolution, crop/effect manipulation, vector asset pipeline |
| Catalog sources and inline records | Every record schema available | Guided source resolution, preset pickers in every applicable form, missing-reference UI |
| Package and site parity | Public coordinated npm packages, reusable schema/inspector entries, shared site bundle, installed-registry fidelity gates | Keep public site/gallery bundles synchronized with new releases; automated native PowerPoint parity remains incomplete |

This table must not be reported as complete WYSIWYG support. The field inventory closes discovery and structured-authoring gaps. Outstanding visual and interaction items remain part of the user's broader ecosystem goal.

## Verification

- `npm test` in opf-editor: model/schema/transfer/session checks.
- `/schema-tests.html`: 14 browser regressions covering live valid drafts, Apply/undo, union forms, nested arrays, invalid values, reordering, conflicts, escaped keys, boolean types, cleanup.
- `/canvas-tests.html`: includes right-aligned caret overlay regression. `/rich-text-tests.html` covers 46 selection/formatting/native-input/caret checks with loaded fonts from published 0.1.1 packages; the historical 0.1.0 baseline covers 31.
- Renderer suite: 126 corpus decks plus new design-preview tests, fonts, Office substitutes, browser font loader. The mandatory reviewed raster baseline covers all 805 current example slides; the older manifest is retained as history.
- Gallery build: 1,923 generated pages; TypeScript and reference endpoint checks.
- Packed consumer: actual tarball installs, strict TypeScript declarations and browser bundle.

- `/list-tests.html`: 19 checks for rich entries/descriptions, inline width, structure, text-style bullets and undo; packed-package equivalent included.

- `/create-tests.html`: 40 creation/lifecycle checks, including implicit conversion, local images, groups/regions, deletion, focus and overflow rejection.
