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

WI-4 (the subtitle draws at 28 px, up from 25 px): the PNGs of the treatments with a subtitle were redrawn by the current renderer, because the text pixels moved. The frames, the pictures and `reference.json` (the 0.14 boxes of the picture frames and outlines) are unchanged; the paint order and the heading frames follow `packages/javascript/test/fixtures/image-treatments-0.14.json`.

LH-51 (a content title steps down by up to a quarter before it wraps): `device-frame.png` and the heading and body boxes of `device-frame` in `reference.json` were redrawn by the current renderer, because its title, which wrapped at 54 px beside the picture, now sits on one line at a smaller step. Its frame, shape and overlay outlines are unchanged.

LH-48 (a lone block that fills under half of the body grows on the type scale and sits in its middle): every PNG and the body text box of every treatment in `reference.json` were redrawn by the current renderer, because the one short paragraph of each slide now draws larger and centered. The frames, shapes and overlay outlines are unchanged.
