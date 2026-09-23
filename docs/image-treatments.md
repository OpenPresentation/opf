# Image treatments

This page covers `design.slideImage`: the slide-level image and the treatments that both coordinated engines draw the same way. opf-render draws them as SVG and opf-pptx exports them as native PowerPoint DrawingML. It also maps each of the 15 [pptx.gallery image treatments](https://www.pptx.gallery/image-treatments) to OPF. Each mapping is either supported, partial or unsupported, with the reason. The reference deck [`fixtures/image-treatments.opf.json`](fixtures/image-treatments.opf.json) has one slide per gallery treatment, and `pnpm test:slide-images` checks it across core, SVG and PPTX.

## When a slide image applies

Core composition (`composeSlide`) resolves `design.slideImage` into `geometry.slideImage`. Both engines draw exactly that frame. It applies to a slide in three cases:

- The slide sets its own `design.slideImage`.
- The deck sets it and the slide's layout declares `slideImage: true`.
- The deck sets it and the slide's root `image` is the same source.

When the slide's root `image` is the same source, or when the treatment has no `src`, the root image becomes the slide image instead of a content item. Other slides ignore a deck-level value. See [dynamic composition](dynamic-composition.md#slide-level-images).

## Treatment vocabulary

Every property is optional and additive on the `{ position, ... }` object form.

| Property | Meaning | Native PPTX | SVG preview |
|---|---|---|---|
| `position` | `background`, or a band along `left`/`right`/`top`/`bottom`. Headings and content compose in the rest of the slide. | `p:pic` beneath all content | `<image>` beneath branding and content |
| `size` | Band share of the slide, 0.1 to 0.9. Default 0.5. | frame geometry | frame geometry |
| `inset` | Frame inside the slide padding, like a card. | frame geometry | frame geometry |
| `aspectRatio` | Largest centered frame with this width/height ratio (`circle` uses 1). | frame geometry | frame geometry |
| `fill` | `crop` covers the frame from the center; `fit` centers the whole image. Default `design.imageFill`, else `crop`. | `a:srcRect`: positive insets crop, negative insets pad | `preserveAspectRatio` `slice` / `meet` |
| `shape` | `rectangle`, `rounded`, `circle`, `hexagon` | `a:prstGeom` `rect` / `roundRect` / `ellipse` / `hexagon` with core's guide values | `clipPath` with core's outline of the same preset formula |
| `cornerRadius` | `rounded` radius as a share of the shorter side. Default 0.16667. | `roundRect` `adj` | circular arcs with the same radius |
| `border` | `{ color, width }`. The line is centered on the outline, and its width is in reference pixels. | `a:ln` with `solidFill`, `algn="ctr"` and a miter join | `stroke` on the same outline, miter join |
| `opacity` | Image opacity, image pixels only. | `a:alphaModFix` | `opacity` on the image only |
| `recolor` | `"grayscale"`, or `{ dark, light }` for duotone. Luminance uses Rec. 601 weights on sRGB. | `a:grayscl` / `a:duotone` | `feColorMatrix` in sRGB |
| `overlay` | `{ color, opacity, edge?, size? }` scrim in the frame's shape, or an edge band on a rectangle frame. | one `p:sp` directly above the picture | `path` with `fill-opacity` |
| `alt` | Alternative text. | `descr` | `aria-label` |

Colors accept the usual `ColorRef` forms: hex, scheme slot or role, or `var:<id>`. Eight-digit hex alpha is kept as native `a:alpha` and SVG opacity. The paint order is the same in both engines: image with its recolor and opacity, then the line, then the overlay. An edge overlay on a non-rectangle frame reports `unsupported-image-treatment` at `...slideImage.overlay.edge`, and neither engine draws it. That diagnostic never fails strict layout.

An unchanged export imports back as the slide's `design.slideImage`: the treatment, plus a data URI of the embedded image. `OPF_SLIDE_IMAGE_V1` and `OPF_SLIDE_IMAGE_OVERLAY_V1` shape tags record the native geometry. Changes are handled like this:

- A picture that was moved, re-cropped or recolored stays an ordinary image and reports `invalid-slide-image-provenance`.
- An edited overlay drops only the overlay.

## pptx.gallery treatments

| Gallery treatment | OPF `design.slideImage` (plus slide design) | Status | Reason or gap |
|---|---|---|---|
| full-bleed | `{position: background, fill: crop, overlay: {color: dark1, opacity: 0.2}}` | supported | |
| text-overlay | `{position: background, fill: crop, overlay: {color: dark1, opacity: 0.55}}` | supported | Heading color still follows the theme background. Use a dark theme or background for light text over photos. |
| side-by-side | `{position: left, size: 0.46, fill: crop}` | supported | |
| caption-overlay | `{position: background, inset: true, fill: crop, overlay: {color: dark1, opacity: 0.75, edge: bottom, size: 0.25}}` | supported | Square corners. An edge band cannot follow a rounded mask as one native shape. |
| masked-shape | `{position: right, inset: true, shape: hexagon, aspectRatio: 1.1547, fill: crop}` | supported | Masks are limited to the four presets. Arbitrary polygon and custom-geometry masks are not in the vocabulary. |
| circular-crop | `{position: left, size: 0.4, inset: true, shape: circle, fill: crop}` | supported | The gallery's small shadow is not drawn (see shadows). |
| rounded-card | `{position: background, inset: true, shape: rounded, cornerRadius: 0.05, fill: crop, border: {color: accent5, width: 1}}` | supported, without shadow | The optional card shadow is unsupported (see shadows). |
| duotone | `{position: background, fill: crop, recolor: {dark: accent1, light: light1}}` | supported | Native raster parity of PowerPoint's luminance weights is unverified (see fidelity). |
| background-blur | `{position: background, fill: crop, overlay: {color: light1, opacity: 0.4}}` plus `contentBox: true` | **unsupported: blur** | Blur is not expressible. The mapping keeps the light scrim and the sharp card, without the blur. |
| image-strip | `{position: bottom, size: 0.3, fill: crop}` | partial | A slide image is one picture. A strip of several images is content: blocks with image payloads in a row composition, which already export as native cropped pictures. |
| collage-grid | no slide image: 4 `image` blocks, `composition: {mode: grid, columns: 2}`, `imageFill: crop` | supported via content blocks | A collage is content composition, not a single-image treatment. Content images export as native pictures. Reimport keeps the pictures but reports `unsupported-image-crop` for their crops. |
| device-frame | `{position: right, inset: true, aspectRatio: 0.5, shape: rounded, cornerRadius: 0.12, fill: crop, border: {color: dark1, width: 12}}` | partial | The bezel is a thick line on a rounded portrait frame. Device artwork (notch, buttons, device-specific screens) is not expressible. |
| cutout-subject | `{position: right, fill: fit}` with a transparent PNG | partial | **Background removal is unsupported.** PowerPoint's Remove Background produces an edited bitmap, not a declarative effect. Supply a pre-cut transparent PNG, and both engines keep its alpha. The grounding shadow is unsupported (see shadows). |
| watermark | `{position: background, inset: true, fill: fit, opacity: 0.1, recolor: grayscale}` | supported | `design.watermark` remains a separate, preview-only feature. |
| cinematic-crop | `{position: background, aspectRatio: 2.39, fill: crop}` with `design.background: dark1` | supported | |

With a real image, 14 treatments are distinct OPF documents. Collage-grid is block content, not a slide-image treatment. The gallery snippets themselves live in pptx.gallery (FF-30).

## Unsupported effects

These effects are left out of the vocabulary on purpose. A value that both engines cannot draw identically would break the preview/export contract.

- **Blur** (`a:blur` inside a blip, or the Office 2010 `a14:imgEffect` artistic blur): PowerPoint's blur kernel and radius scale are not specified. There is also no native evidence that PowerPoint renders a blip `a:blur` on pictures. An SVG `feGaussianBlur` cannot be shown to match. background-blur is therefore unsupported.
- **Shadows and soft edges** (`a:outerShdw`, `a:softEdge` in `a:effectLst`): these are native, but PowerPoint's blur kernel for them is unspecified. An SVG drop shadow would only approximate it.
- **Background removal**: this is a bitmap edit, not an effect. Use a transparent source.
- **Device artwork and arbitrary masks**: these would need custom geometry and composed artwork. The treatment vocabulary is limited to preset masks and a line.
- **Tint, brightness and contrast** (`a:lum`, `a:clrChange`, `a:tint`): no gallery treatment needs them. They are left out until they have the same luminance-formula verification as grayscale and duotone.

## Fidelity boundary

These checks prove the shared contract: geometry, preset guides and outlines, line width and color, recolor endpoints, alpha, overlay and round trip (`pnpm test:slide-images`, plus the tests in each engine). They do not prove PowerPoint raster parity. Office runs are root-only, and the following are still unverified in native PowerPoint:

- negative `a:srcRect` insets for `fit`;
- the luminance weights PowerPoint uses for `a:grayscl` and `a:duotone`. The preview uses Rec. 601 on sRGB, as LibreOffice does.
- line joins on the hexagon outline.
