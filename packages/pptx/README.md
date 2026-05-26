# OPF PPTX

Pure local PowerPoint conversion tooling for Open Presentation Format documents. This repo owns the Phase 3 and Phase 4 toolkit lanes: OPF to PPTX export and PPTX to OPF import.

## Scope

- Package: `@openpresentation/opf-pptx`
- Repository: `OpenPresentation/opf-pptx`
- License: MIT
- Compatibility target: `@openpresentation/opf`
- Renderer relationship: may use `@openpresentation/opf-render` for chart rasterization and visual verification
- Public export API: `toPptx(opf, opts)`
- Planned import API: `fromPptx(buffer, opts)` in the PPTX import phase

The export path validates OPF with `@openpresentation/opf`, maps slide titles and common content payloads to editable PowerPoint objects through `pptxgenjs`, then normalizes the generated ZIP for stable entry ordering, fixed timestamps, and reproducible bytes.

```js
import { toPptx } from "@openpresentation/opf-pptx";

const bytes = await toPptx({
  $schema: "https://openpresentation.org/schema/opf/v1",
  name: "Quarterly Review",
  slides: [
    {
      title: "Revenue grew across all regions",
      items: ["North America +18%", "EMEA +14%", "APAC +11%"]
    }
  ]
});

await fs.promises.writeFile("quarterly-review.pptx", bytes);
```

`toPptx` returns a `Uint8Array` containing a PowerPoint-openable `.pptx`. It does not fetch remote assets. Data URI images and local paths can be embedded directly; hosts that need private asset loading should pass `imageResolver(src, context)`. Set `strictAssets: true` to turn unresolved or remote image assets into structured `OPFPptxError` failures instead of editable placeholder boxes.

## v1 Placeholder and OOXML Mapping

The first exporter keeps the public API stable while using `pptxgenjs` internally:

- `Slide.title`, `Slide.subtitle`, and `Slide.tag` become editable text boxes, not PowerPoint master placeholders.
- Root payloads, `blocks[]`, and promoted region keys become editable slide objects in deterministic regions. Promoted keys use the OPF 3x3 region vocabulary (`top`, `middle`, `bottom`, `left`, `center`, `right`).
- Text, lists, metrics, quotes, timelines, code, tables, and inline-data charts are emitted as editable PowerPoint text, table, and chart objects.
- Image assets are embedded only when supplied as data URIs, local paths, or host-resolved bytes/paths. Remote asset URLs are never fetched by the runtime path.
- ZIP entries, generated chart/workbook part names, core-property timestamps, and nested chart workbook timestamps are normalized for reproducible bytes.

This pass did not require an OPF schema change. The deferred full OOXML placeholder mapping from `docs/plans/layout-placeholders.md` remains a later hand-written OOXML emitter concern.

## Runtime Policy

The package runtime must stay local and deterministic:

- No hosted service in the critical path
- No telemetry or hidden analytics
- No commercial SDK dependency in the critical path
- No required network calls
- No required AI dependency
- No required LibreOffice dependency in the runtime path; LibreOffice is allowed only as an optional verification tool in CI
- Host applications own auth, storage, queues, analytics, collaboration, branding, and product workflow

## Development

```sh
npm ci
npm run build
npm run typecheck
npm test
npm run validate
```

LibreOffice is not a runtime dependency. When it is installed in CI or a local verification environment, generated `.pptx` files can be smoke-opened there as an optional export check.

## Release Lane

Public npm package publication is handled by `.github/workflows/release.yml` with npm provenance.

Required first-publish setup:

1. An npm owner for the `@openpresentation` scope must run the first publish or reserve/grant the `@openpresentation/opf-pptx` package.
2. Configure npm Trusted Publishing for GitHub repository `OpenPresentation/opf-pptx` and workflow `.github/workflows/release.yml`.
3. Publish by creating a GitHub Release or manually running the Release workflow after CI passes.

This repo does not require an npm automation token when Trusted Publishing is configured.
