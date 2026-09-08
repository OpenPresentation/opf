# Native PowerPoint candidate checkpoint

PPTX source: OpenPresentation/opf-pptx@50a96e4be3f0500990a095c8d4fd0980e3f11f06; installed candidate 0.5.0, registry core 0.7.0 and renderer 0.5.0. This evidence is not final all-registry verification.

See [comparison.json](comparison.json) for measured differences, targeted native border assertions, native editing/save/reopen and reimport results. [source.opf.json](source.opf.json) is the input. The generator uses locally installed Calibri; no font binaries are included. Run the scripts described in [Windows evidence](../../evidence-2026-09-08-windows.md) to regenerate PPTX, SVG and images.

| Fixture | SVG raster | Native PowerPoint |
| --- | --- | --- |
| Text | [Renderer 1](renderer-1.png) | [Native 1](native-1.png) |
| Styled merge | [Renderer 2](renderer-2.png) | [Native 2](native-2.png) |
| Border segments | [Renderer 3](renderer-3.png) | [Native 3](native-3.png) |

Native output remains editable. Global raster equivalence has not been established; the images reveal text-baseline/line-spacing and border-rendering differences even with identical local font files.
