# Images: backgrounds, image blocks and treatments

OPF 0.15 has two places for a picture, with one fit vocabulary:

- A **background** is the slide's canvas fill. A picture background fills the whole slide behind everything and never moves content.
- An **image block** holds every content picture. It carries fit, focus, the treatment vocabulary below, and an optional placement that bleeds it to one slide edge.

opf-render draws both as SVG and opf-pptx exports them as native PowerPoint DrawingML, from the same core geometry. This page also maps each of the 15 [pptx.gallery image treatments](https://www.pptx.gallery/image-treatments) to OPF, with its support status and the reason. The reference deck [`fixtures/image-treatments.opf.json`](fixtures/image-treatments.opf.json) has one slide per gallery treatment. Core's `test/image-blocks.test.mjs` checks it against core 0.14's frozen slide-image geometry, and `pnpm test:image-treatments` checks it across core, SVG and PPTX.

## Backgrounds

```json
{
  "design": {
    "background": {
      "type": "image",
      "src": "./images/harbour.jpg",
      "alt": "Container ships at dawn",
      "fit": "cover",
      "focus": { "x": 0.5, "y": 0.7 },
      "overlay": { "color": "dark1", "opacity": 0.4 }
    }
  }
}
```

The effective background is the slide's `design.background`, then the deck's, then the theme's. A picture background has these properties:

| Property | Meaning |
|---|---|
| `src` | The picture: `asset:<id>`, an HTTPS URL, a data URI or a relative path. |
| `alt` | Alternative text. With `alt` the picture is meaningful, and PPTX export draws it as a full-slide picture at the back that carries the text. Without `alt` it is decorative and exports as the native slide background. A referenced asset's alt text does not count. |
| `fit` | `cover` (the default) fills the slide and crops around `focus`. `contain` shows the whole picture over the colour scheme's default background. `stretch` scales it to the slide. `tile` repeats it at its own size from the top-left corner. |
| `focus` | `{ x, y }` in 0 to 1: the point of the picture that a `cover` crop keeps in view. The default is the center. |
| `opacity` | Picture opacity. The overlay keeps its own. |
| `recolor` | `"grayscale"`, or `{ dark, light }` for duotone, as on an image block. Recolor and opacity apply to the picture's pixels; the overlay is drawn above them. |
| `overlay` | A scrim over the whole picture, or a band along one edge (`edge`, `size`; see [Overlay](#overlay)). |

The string shorthand `"asset:hero"` (or any source starting with `asset:`, `https://`, `data:`, `./` or `../`) is a cover picture background. Theme slots (`light1`) and hex colours keep their meaning, and any other string is invalid.

`composeSlide` reports the picture as `SlideComposition.backgroundImage`: the canvas `box`, `fit`, `focus`, `opacity`, `recolor`, the overlay box, and the fit placement when core can read the picture's proportions. The headings and the body compose exactly as on a slide without the background. A slide with only a title over a picture background is a cover, and its title centers like any cover's.

## Image blocks

```json
{ "type": "image", "image": { "src": "asset:hero", "alt": "Harbour" }, "fit": "cover", "focus": { "x": 0.3, "y": 0.5 }, "shape": "rounded", "border": { "color": "accent5", "width": 1 } }
```

`Slide.image` is the shorthand for one image block, with the effective `design.imageFit`. Use a block in `blocks` for fit, focus, treatments or an explicit placement. Every property below is optional, valid only on an image payload, and additive.

| Property | Meaning | Native PPTX | SVG preview |
|---|---|---|---|
| `fit` | `cover` fills the frame and crops around `focus`. `contain` shows the whole picture. `stretch` scales it to the frame. Default: the effective `design.imageFit` (the slide's, the deck's, then the layout's), else `cover`. | `a:srcRect`: positive insets crop, negative insets pad | the shared placement (`fitImage`) |
| `focus` | `{ x, y }`: the point a `cover` crop keeps in view. | `a:srcRect` | the same placement |
| `aspectRatio` | The largest centered frame with this width/height ratio (`circle` uses 1). | frame geometry | frame geometry |
| `shape` | `rectangle`, `rounded`, `circle` or `hexagon`. | `a:prstGeom` `rect` / `roundRect` / `ellipse` / `hexagon` with core's guide values | `clipPath` with core's outline of the same preset formula |
| `cornerRadius` | Radius of a `rounded` frame as a share of the shorter side. Default 0.16667. | `roundRect` `adj` | circular arcs with the same radius |
| `border` | `{ color, width }`. The line is centered on the outline, and its width is in reference pixels. | `a:ln` with `solidFill`, `algn="ctr"` and a miter join | `stroke` on the same outline, miter join |
| `opacity` | Opacity of the picture's pixels only. | `a:alphaModFix` | `opacity` on the image only |
| `recolor` | `"grayscale"`, or `{ dark, light }` for duotone. Luminance uses Rec. 601 weights on sRGB. | `a:grayscl` / `a:duotone` | `feColorMatrix` in sRGB |
| `overlay` | A scrim in the frame's shape, or an edge band on a rectangle frame. | one `p:sp` directly above the picture | `path` with `fill-opacity` |
| `placement` | `{ edge, size, inset }`: bleed the block to one slide edge (see below). | frame geometry | frame geometry |

Colors accept the usual `ColorRef` forms: hex, scheme slot or role, or `var:<id>`. Eight-digit hex alpha is kept as native `a:alpha` and SVG opacity. Alt text comes from the image's asset.

`composeSlide` reports every image item's picture as `ComposedItem.image`: the `region` (the cell, or the placement band), the frame `box`, `fit`, `focus`, the `shape` with its DrawingML preset and SVG outline, `border`, `opacity`, `recolor`, `overlay` and `placement`. Both engines draw exactly that. The paint order is the same in both: the picture with its recolor and opacity, clipped to the shape, then the line, then the overlay.

### Placement

`placement: { edge: "left" | "right" | "top" | "bottom", size: 0.1–0.9 (default 0.5), inset: false }` gives the image a band along that edge of the slide, edge to edge, and the headings and other content compose in the rest of the slide at the normal padding. `size` is the band's share of the slide width (left, right) or height (top, bottom). `inset: true` puts the frame inside the slide padding of the band, like a card. Header and footer bands keep their full-width placement.

- Only a top-level block (`slides.N.blocks.I`) can be placed, and each slide edge takes at most one placed image. A placed block inside a group or a promoted region, or a second block on the same edge, is an `opf/image-placement-invalid` error.
- Bands are taken in block order. Each spans the free area left by the earlier ones.
- A layout's image placeholder may carry the same `placement`. The layout's n-th image placeholder places the slide's n-th top-level image (`Slide.image` or an image block) unless that block sets its own.
- A slide whose only body is placed images is composed like a cover: its headings center in the free area beside the image.
- In a right-to-left deck `left` is the start side, drawn at the right. Edge overlays mirror the same way.

Placement is the only mechanism that moves content aside. A background never does.

## Overlay

`{ color, opacity, edge?, size? }` is shared by backgrounds and image blocks. Without `edge` it covers the whole frame in the frame's shape. With `edge` (`top`, `bottom`, `left` or `right`) it covers a band of `size` (default 0.3) of the frame along that edge, for example a caption strip. An edge overlay on a non-rectangle image frame reports `unsupported-image-treatment` at `...overlay.edge`, and neither engine draws it. That diagnostic never fails strict layout. Text over a picture background is certified readable (`opf/text-on-image`) only through a full-frame overlay strong enough for every possible pixel; an edge band does not count.

An unchanged export imports back as the same OPF: the background and the image blocks with their treatments, plus a data URI of each embedded picture. The `OPF_IMAGE_V1` and `OPF_IMAGE_OVERLAY_V1` shape tags record the native geometry of an image block. A picture that was moved, re-cropped or recolored stays an ordinary image and reports its provenance diagnostic. An edited overlay drops only the overlay.

## pptx.gallery treatments

| Gallery treatment | OPF | Status | Reason or gap |
|---|---|---|---|
| full-bleed | background `{type: image, src, overlay: {color: dark1, opacity: 0.2}}` | supported | |
| text-overlay | background with `overlay: {color: dark1, opacity: 0.55}` | supported | Heading color still follows the theme background. Use a dark theme or background for light text over photos. |
| side-by-side | image block, `placement: {edge: left, size: 0.46}` | supported | |
| caption-overlay | image block, `overlay: {color: dark1, opacity: 0.75, edge: bottom, size: 0.25}` | supported | Square corners. An edge band cannot follow a rounded mask as one native shape. The gallery's card sits inside the slide padding, which a background cannot do, so the picture is content below the headings. Without the inset it is a background with the same edge-band overlay. |
| masked-shape | image block, `shape: hexagon, aspectRatio: 1.1547, placement: {edge: right, inset: true}` | supported | Masks are limited to the four presets. Arbitrary polygon and custom-geometry masks are not in the vocabulary. |
| circular-crop | image block, `shape: circle, placement: {edge: left, size: 0.4, inset: true}` | supported | The gallery's small shadow is not drawn (see shadows). |
| rounded-card | image block, `shape: rounded, cornerRadius: 0.05, border: {color: accent5, width: 1}` | supported, without shadow | The optional card shadow is unsupported (see shadows). |
| duotone | background with `recolor: {dark: accent1, light: light1}` | supported | Native raster parity of PowerPoint's luminance weights is unverified (see fidelity). |
| background-blur | background with `overlay: {color: light1, opacity: 0.4}`, plus `contentBox: true` | **unsupported: blur** | Blur is not expressible. The mapping keeps the light scrim and the sharp card, without the blur. |
| image-strip | image block, `placement: {edge: bottom, size: 0.3}` | partial | A placed block is one picture. A strip of several images is content: image blocks in a row composition. |
| collage-grid | 4 image blocks, `composition: {mode: grid, columns: 2}`, `imageFit: cover` | supported via content blocks | A collage is content composition, not a single-image treatment. |
| device-frame | image block, `aspectRatio: 0.5, shape: rounded, cornerRadius: 0.12, border: {color: dark1, width: 12}, placement: {edge: right, inset: true}` | partial | The bezel is a thick line on a rounded portrait frame. Device artwork (notch, buttons, device-specific screens) is not expressible. |
| cutout-subject | image block, `fit: contain, placement: {edge: right}`, with a transparent PNG | partial | **Background removal is unsupported.** PowerPoint's Remove Background produces an edited bitmap, not a declarative effect. Supply a pre-cut transparent PNG, and both engines keep its alpha. The grounding shadow is unsupported (see shadows). |
| watermark | image block, `fit: contain, opacity: 0.1, recolor: grayscale` | supported | `design.watermark` remains a separate, preview-only feature. |
| cinematic-crop | image block, `aspectRatio: 2.39`, with `design.background: dark1` | supported | |

The frames of full-bleed, text-overlay, background-blur, duotone, side-by-side, masked-shape, circular-crop, image-strip, device-frame, cutout-subject and collage-grid are those of core 0.14. Caption-overlay, rounded-card, watermark and cinematic-crop were 0.14 slide images behind the headings that need an inset, a mask, a line or an aspect ratio, which a background does not have. In 0.15 they are image blocks below the headings, and their treatment geometry within the frame is unchanged. The gallery snippets themselves live in pptx.gallery (FF-30).

## Unsupported effects

These effects are left out of the vocabulary on purpose. A value that both engines cannot draw identically would break the preview/export contract.

- **Blur** (`a:blur` inside a blip, or the Office 2010 `a14:imgEffect` artistic blur): PowerPoint's blur kernel and radius scale are not specified. There is also no native evidence that PowerPoint renders a blip `a:blur` on pictures. An SVG `feGaussianBlur` cannot be shown to match. background-blur is therefore unsupported.
- **Shadows and soft edges** (`a:outerShdw`, `a:softEdge` in `a:effectLst`): these are native, but PowerPoint's blur kernel for them is unspecified. An SVG drop shadow would only approximate it.
- **Background removal**: this is a bitmap edit, not an effect. Use a transparent source.
- **Device artwork and arbitrary masks**: these would need custom geometry and composed artwork. The treatment vocabulary is limited to preset masks and a line.
- **Tint, brightness and contrast** (`a:lum`, `a:clrChange`, `a:tint`): no gallery treatment needs them. They are left out until they have the same luminance-formula verification as grayscale and duotone.
- **Frame treatments on backgrounds**: a background has fit, focus, opacity, recolor and an overlay (with edge bands). A masked, bordered, inset or aspect-ratio picture is an image block.

## Fidelity boundary

These checks prove the shared contract: geometry, preset guides and outlines, line width and color, recolor endpoints, alpha, overlay and round trip (`pnpm test:image-treatments`, plus the tests in each engine). They do not prove PowerPoint raster parity. Office runs are root-only, and the following are still unverified in native PowerPoint:

- negative `a:srcRect` insets for `contain`;
- the luminance weights PowerPoint uses for `a:grayscl` and `a:duotone`. The preview uses Rec. 601 on sRGB, as LibreOffice does.
- line joins on the hexagon outline.
