# 0.14 slideImage references for the 15 gallery image treatments (FA-23)

fa-stale-refs: history. These files record what OPF 0.14 drew; the 0.15 model is core `docs/programs/format-audit/0.15-design.md`.

OPF 0.15 removed `design.slideImage`: a full-slide photo is an image background and every other picture is an image block,
placed at an edge band with `placement`. The design requires the 15 pptx.gallery image treatments, written the 0.15 way, to
draw the same frames in the same paint order as the 0.14 slideImage did.

These PNGs (scale 0.5, bundled fonts) and `reference.json` (`written014`: the slideImage each treatment was written as, the composed item
boxes and the frame, shape and overlay outlines) were drawn by opf-render 0.14.0 on core 0.14.0 with
`node test/fixtures/make-image-treatments-014.mjs`, from the treatment descriptions in `../image-treatments.mjs`. Every 0.14
treatment key maps to the image block key of the same name (`position` to `placement.edge`, `size` and `inset` to the
placement, `fill: crop|fit` to `fit: cover|contain`); a `background` slideImage maps to an image background, drawn over the
colour scheme's default slide background, so the 0.14 deck set that colour (light1) as its solid background.

`test/image-treatments.mjs` renders the 0.15 documents and compares them with these files. Do not regenerate them: the
0.15 renderer cannot draw a slideImage, which is the point of keeping them.
