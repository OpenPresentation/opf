# Images: backgrounds, image blocks and treatments

OPF 0.15 has two places for a picture, with one fit vocabulary:

- A **background** is the slide's canvas fill. A picture background fills the whole slide behind everything and never moves content.
- An **image block** holds every content picture. It carries fit, focus, the treatment vocabulary below, and an optional placement that bleeds it to one slide edge.

opf-render draws both as SVG and opf-pptx exports them as native PowerPoint DrawingML, from the same core geometry. This page also maps each of the 15 [pptx.gallery image treatments](https://www.pptx.gallery/image-treatments) to OPF, with its support status and the reason. The reference deck [`fixtures/image-treatments.opf.json`](fixtures/image-treatments.opf.json) has one slide per gallery treatment. Core's `test/image-blocks.test.mjs` checks it against core 0.14's frozen picture geometry, and `pnpm test:image-treatments` checks it across core, SVG and PPTX.

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
| `alt` | Alternative text. With `alt` the picture is meaningful, and PPTX export draws it as a full-slide picture at the back that carries the text. Without `alt` it is decorative and exports as the native slide background. A referenced asset's alt text does not count. In the preview a picture with `alt` is an image with that name, and one with `alt: ""` is hidden from assistive technology. |
| `fit` | `cover` (the default) fills the slide and crops around `focus`. `contain` shows the whole picture over the colour scheme's default background. `stretch` scales it to the slide. `tile` repeats it at its own size from the top-left corner. |
| `focus` | `{ x, y }` in 0 to 1: the point of the picture that a `cover` crop keeps in view. The default is the center. |
| `opacity` | Picture opacity. The overlay keeps its own. |
| `recolor` | `"grayscale"`, or `{ dark, light }` for duotone, as on an image block. Recolor and opacity apply to the picture's pixels; the overlay is drawn above them. |
| `overlay` | A scrim over the whole picture, or a band along one edge (`edge`, `size`; see [Overlay](#overlay)). Without one, core draws an [automatic scrim](#automatic-scrim) behind text on the picture; `false` turns it off. |
| `tone` | `dark` or `light` (from core 0.23.0): the variant the slide takes (`dark1` or `light1`) so text and lines read on the picture. Absent: the deck's variant, else light. |

A picture or gradient background can carry `tone: "dark"` or `"light"` (from core 0.23.0). The tone picks the color map (`dark1` or `light1`, see `design.variant` in [design resolution](design-resolution.md#color-variants)) so the slide's text, borders and chart furniture are chosen to read on the picture. Without a tone the picture takes the deck's variant, else counts as light, as before.

The string shorthand `"asset:hero"` (or any source starting with `asset:`, `https://`, `data:`, `./` or `../`) is a cover picture background. Theme slots (`light1`) and hex colours keep their meaning, and any other string is invalid.

`composeSlide` reports the picture as `SlideComposition.backgroundImage`: the canvas `box`, `fit`, `focus`, `opacity`, `recolor`, the overlay box, the [automatic scrim](#automatic-scrim) (`scrim`), and the fit placement when core can read the picture's proportions. The headings and the body compose exactly as on a slide without the background. A slide with only a title over a picture background is a cover, and its title centers like any cover's.

## Image blocks

```json
{ "image": { "src": "asset:hero", "alt": "Harbour" }, "fit": "cover", "focus": { "x": 0.3, "y": 0.5 }, "shape": "rounded", "border": { "color": "accent5", "width": 1 } }
```

`Slide.image` is source shorthand for one image block, with the effective `design.imageFit`: it takes no fit, focus, treatment or placement keys of its own (the schema rejects them on the slide). To treat or place a picture, write an image block in `blocks`. Every property below is optional, valid only on an image payload, and additive.

| Property | Meaning | Native PPTX | SVG preview |
|---|---|---|---|
| `fit` | `cover` fills the frame and crops around `focus`. `contain` shows the whole picture. `stretch` scales it to the frame. `auto` (LH-104) covers when the crop keeps at least 85% of the picture's width or height (at most 7.5% off each edge; the proportions read from the file with its EXIF orientation applied, against the frame) and contains otherwise; an SVG, or a picture whose size core cannot read from the document (an https URL, a relative path), is always contained. In an automatic picture track (LH-80), a frame the engine chose to crop into, `auto` covers. Core decides it, so both engines draw the same fit, and `ComposedItem.image.fit` is the fit it took, with `autoFit: true`. Default: the effective `design.imageFit` (the slide's, the deck's, then the layout's), else `cover` in a layout and `contain` on a slide with no layout. A contained picture has a frame of its own proportions at the region's anchor (top by default). | `a:srcRect`: positive insets crop, negative insets pad | the shared placement (`fitImage`) |
| `focus` | `{ x, y }`: the point a `cover` crop keeps in view. | `a:srcRect` | the same placement |
| `aspectRatio` | The largest centered frame with this width/height ratio (`circle` uses 1). | frame geometry | frame geometry |
| `shape` | `rectangle`, `rounded`, `circle` or `hexagon`. | `a:prstGeom` `rect` / `roundRect` / `ellipse` / `hexagon` with core's guide values | `clipPath` with core's outline of the same preset formula |
| `cornerRadius` | Radius of a `rounded` frame as a share of the shorter side. Default 0.16667. | `roundRect` `adj` | circular arcs with the same radius |
| `border` | `{ color, width }`. The line is centered on the outline, and its width is in reference pixels. | `a:ln` with `solidFill`, `algn="ctr"` and a miter join | `stroke` on the same outline, miter join |
| `opacity` | Opacity of the picture's pixels only. | `a:alphaModFix` | `opacity` on the image only |
| `recolor` | `"grayscale"`, or `{ dark, light }` for duotone. Luminance uses Rec. 601 weights on sRGB. | `a:grayscl` / `a:duotone` | `feColorMatrix` in sRGB |
| `overlay` | A scrim in the frame's shape, or an edge band on a rectangle frame. | one `p:sp` directly above the picture | `path` with `fill-opacity` |
| `placement` | `{ edge, size, inset }`: bleed the block to one slide edge (see below). | frame geometry | frame geometry |
| `portrait` | A person's picture in a team (LH-132): `top` across the top of the card, `side` beside the text, `avatar` the small picture over the name. See [Team portraits](#team-portraits). | frame geometry | frame geometry |

Colors accept the usual `ColorRef` forms: hex, scheme slot or role, or `var:<id>`. Eight-digit hex alpha is kept as native `a:alpha` and SVG opacity. Alt text comes from the image's asset.

`composeSlide` reports every image item's picture as `ComposedItem.image`: the `region` (the cell, or the placement band), the frame `box`, `fit`, `focus`, the `shape` with its DrawingML preset and SVG outline, `border`, `opacity`, `recolor`, `overlay` and `placement`. Both engines draw exactly that. The paint order is the same in both: the picture with its recolor and opacity, clipped to the shape, then the line, then the overlay.

### Team portraits

A person is a group of a picture followed by a name: a list of one entry whose `description` holds the role and a line (`"Chief executive\nFounded the company in 2016."`), or a short text. A slide whose body is only people is a team, and core draws each person as one card with a portrait (LH-132):

- **2 to 4 people** in one row, each picture across the top of its card at the card's inner width (Claude Design's leadership slide). A card too wide for that (two people) draws the picture beside the text.
- **5 or 6 people** in a grid (3 + 2, 3 + 3, the short row at the same card width), each picture beside the text at 40% of the card's inner width, on the logical start side (the right in a right-to-left deck).
- **More people**, or a card too narrow for a portrait (under 160 px across the top, a picture under 72 px or a text column under 150 px beside it), keep the avatar: the picture over the name, as before.

The text comes first: the team's names, roles and lines take the largest size of the type scale at which the tallest of them fits under a square portrait (down to 21 px, then under a 4:3 one) or in the card's height beside it, and the portrait takes the room left, at most 4:5 across the top or 0.7 beside the text, never flatter than 4:3 (then the avatar). Every card reserves the team's tallest text, so the cards are equal and the portraits align; each card holds its portrait and text and sits in the middle of its cell. The automatic choice is a guarded rule (`portraits`): a slide keeps it only when no name, role or line is smaller than with the avatars.

The picture keeps its `fit` and `focus`; without them it covers its frame around the upper third (`{x: 0.5, y: 0.3}`, where a face is), so it never distorts. A `circle` (or unshaped) picture is drawn in a frame rounded as a card is (8 px); another `shape` is kept. The engines draw core's frame: the preview clips the picture to it, PowerPoint writes a native picture with `a:srcRect` and the `roundRect` preset, so a raster portrait is not re-encoded.

`portrait` on a person's picture overrides the choice: `top`, `side` or `avatar`. The first person's value in reading order applies to the whole team, so the cards stay equal; an authored `top` that does not fit gives way to `side`, and either gives way to the avatar where the card has no room. A quote's `portrait` does the same for its `photo` ([content payloads](content-payloads.md#quote)).

### Placement

`placement: { edge: "left" | "right" | "top" | "bottom", size: 0.1–0.9 (default 0.5), inset: false }` gives the image a band along that edge of the slide, edge to edge, and the headings and other content compose in the rest of the slide at the normal padding. `size` is the band's share of the slide width (left, right) or height (top, bottom). `inset: true` puts the frame inside the slide padding of the band, like a card. Header and footer bands keep their full-width placement.

- Only a top-level block (`slides.N.blocks.I`) can be placed, and each slide edge takes at most one placed image. A placed block inside a group or a promoted region, or a second block on the same edge, is an `opf/image-placement-invalid` error.
- Bands are taken in block order. Each spans the free area left by the earlier ones.
- Placement belongs to a top-level image block. Current v2 layout records do not have image-placeholder placement; write a block in `blocks` to place a picture rather than using the root `Slide.image` shorthand.
- A slide whose only body is placed images is composed like a cover: its headings center in the free area beside the image.
- In a right-to-left deck `left` is the start side, drawn at the right. Edge overlays mirror the same way.

Placement is the only mechanism that moves content aside. A background never does.

## Overlay

`{ color, opacity, edge?, size? }` is shared by backgrounds and image blocks. Without `edge` it covers the whole frame in the frame's shape. With `edge` (`top`, `bottom`, `left` or `right`) it covers a band of `size` (default 0.3) of the frame along that edge, for example a caption strip. An edge overlay on a non-rectangle image frame reports `unsupported-image-treatment` at `...overlay.edge`, and neither engine draws it. That diagnostic never fails strict layout. Text over a picture background is certified readable (`opf/text-on-image`) through a full-frame overlay strong enough for every possible pixel, or core's [automatic scrim](#automatic-scrim) when there is no overlay; an edge band does not count.

An unchanged export imports back as the same OPF: the background and the image blocks with their treatments, plus a data URI of each embedded picture. The `OPF_IMAGE_V1` and `OPF_IMAGE_OVERLAY_V1` shape tags record the native geometry of an image block. A picture that was moved, re-cropped or recolored stays an ordinary image and reports its provenance diagnostic. An edited overlay drops only the overlay.

## Automatic scrim

Text over a photograph reads only as well as the photograph allows (LH-02). When text sits on a picture background and the background has no `overlay` key, core adds a scrim behind the text in the slide's background color (`bg1` of the slide's variant, the color the text was chosen for: dark under light text, light under dark text). `SlideComposition.backgroundImage.scrim` reports it, and both engines draw it directly above the picture, beneath furniture and content: the preview as a rectangle with an SVG linear gradient, the PPTX export as one native rectangle with a gradient fill (`a:gradFill` of `bg1` with `a:alpha` stops), or a plain alpha fill for a band of one opacity. It is never baked into the picture, and it moves and resizes nothing.

- **What it covers.** Every item drawn straight on the picture (not a picture, video, code panel or table, which draw on fills of their own, nor an item on a card or the emphasis surface), every caption, and the header and footer text, each by the part of its box its lines cover, plus a margin of 24 reference pixels. A right-to-left slide covers whole boxes.
- **Its form.** A gradient from the bottom edge when the text sits in the lower part of the slide (or, centered, a little below the middle), from the top when it sits in the upper part, or from the side when it is a column at the left or right: solid from the edge to just past the text, then fading out over a fifth of the slide. Otherwise a band across the text: solid over the text and about half a line above and below it only, fading out over one and a half times the text's height on each side (at least a quarter of the slide). Every fade is eased (smoothstep, six stops), so neither form has a visible edge. The scrim keeps the background color itself in every stop, so it never fades through gray; over a light picture a dark color at partial opacity still reads lighter than the color. `form`, `edge`, `box`, `axis` and `stops` describe it.
- **Its opacity.** The lowest, in hundredths, at which the slide's text color reads at 4.5:1 over every pixel the picture could have under the text: the gray ramp from black to white, through the picture's `opacity`. The muted color of header, footer and attribution text reaches 4.5:1 too, and the primary color of a metric value or timeline 3:1. `contrast` is the worst ratio reached and `basis` is `worst-case`.
- **Measured pictures.** Core reads no pixels itself. A host that can (`ComposeSlideOptions.pictureLuminance`, also an option of the preview and the PPTX export) returns a luminance grid of the picture, which core's `luminanceGrid(pixels, width, height)` builds from decoded RGBA (each cell keeps its darkest and lightest pixel), and the scrim is then sized for the grays under the text (`basis: 'sampled'`, `grays`): none at all on a dark photo under light text. A recolored picture is not the one measured and keeps the worst case. Give the preview and the export the same function, or neither, so they draw the same scrim. `measurePictures(deck)` of `@openpresentation/opf-render` is that function: it decodes each picture background (data URI, `asset:` reference or the file a host `imageResolver` reads) once, lazily (sharp in Node, a canvas in a browser), and returns the sampler. `opf convert` and `convert()` call it for every format (`measurePictures: false` turns it off, and a machine without the optional `sharp` peer sizes every scrim for any picture, with a `render/picture-not-measured` note), and the editor's canvas, `convert` and Export menu call it in the page and give `exportPptx` the sampler as `pictureLuminance`. A picture that cannot be decoded keeps the worst case.
- **The author decides.** Any `overlay` of the author's, full-frame or an edge band, replaces the scrim, and `overlay: false` turns it off: the picture shows as it is, and `opf/text-on-image` says contrast cannot be guaranteed. A picture that names its `tone` gets the same scrim in its variant's background color (it replaces the 40% scrim of RR-96).

`opf/text-on-image` notes the scrim (its opacity and form) as an info finding, and the contrast rules count it over the text it covers. An unchanged export imports back as the same background: the scrim shape is no content.

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
