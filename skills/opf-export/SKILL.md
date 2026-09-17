---
name: opf-export
description: "Render OPF in a browser or export OPF to SVG, PNG, PDF, and PPTX; inspect PPTX imports. Use for font/asset fidelity, reproducible output, and distinguishing schema validity from visual/export parity."
license: MIT
---

# Preview and export OPF

Start with a validated OPF document and the output formats the user requested. Preserve OPF as the editable source. Read [rendering and conversion](references/rendering.md) for the concrete local APIs and environment boundaries.

## Establish the rendering inputs

Use coordinated versions of `@openpresentation/opf`, `opf-render`, and `opf-pptx`. The repository's preview tarballs can contain APIs absent from published packages. Determine the actual installed exports before using them.

Resolve design, dimensions, catalog records, assets, and required font faces. Core validation does not fetch catalog sources. SVG accepts embedded raster data or an explicit host image resolver; PPTX has a separate resolver contract and may require different handling. Resolve only the resources needed for the user's task. Do not treat a resource URL as authorization to upload the deck elsewhere.

Pass the same text measurement provider to preview and PPTX export. Use identical pinned font files in the browser and measurement engine. Rendering a named family without loading its bytes can silently substitute fonts and change line breaks.

## Verify what the user will receive

Collect path-specific diagnostics, inspect rendered slides, and check requested exports. Use explicit pagination before preview/export when needed, and export those exact pages. Shared geometry does not guarantee identical pixels in browsers and PowerPoint.

Do not describe successful serialization as complete fidelity. Rich-text shaping, advanced chart variants, video playback, automatic branding placement, and external assets have known limitations in the current ecosystem. Native PPTX font names and line breaks do not mean font binaries are embedded. Describe substitutions or unsupported visuals that affect the requested deck.

PPTX import is a conversion with limitations, not an assurance of lossless round-trip for arbitrary Office files. Validate and inspect the imported OPF and retain the original when making a derivative artifact.

Prefer new output paths while developing a conversion; follow the user's explicit overwrite preferences. Creating a local export does not include publishing or sending it.
