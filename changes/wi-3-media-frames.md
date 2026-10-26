---
type: changed
packages: [opf, render, pptx]
---
WI-3 (output-changing: media frames):
    - A picture shown whole (`fit: "contain"`) takes a frame of its own proportions, centered across and placed down its cell by the region's `anchor` (top by default), instead of the whole cell with the picture centered in it. A landscape picture beside text now starts on the text's first line (it sat 30 px lower). `item.image.box` is the picture's frame, so a border, a shape or an overlay follows the picture; a frame set with `aspectRatio` or a circle shape stays centered, and `cover` and `stretch` are unchanged. A caption closes up under a top-anchored frame.
    - A video draws in a 16:9 frame, the largest that fits its cell, placed by the region's `anchor` like a contained picture, instead of filling a portrait cell (three columns drew 372 x 515 px frames around a play button). `item.box` is the frame; the renderer and the PPTX export draw the placeholder in it.
    - Automatic composition (a slide with no layout): a picture that sets no fit is shown whole (`contain`, was `cover`, which cropped a 16:9 picture into a tall strip); a chart is at most 4:3; a single row where a portrait picture sits beside other blocks gives the width the picture does not use to them; and two prose blocks whose measured demand differs by 2.5 times or more split the row 55:45 to 70:30 in favor of the longer one when that shortens it and adds the shorter at most one line. Automatic grid selection scores a whole picture against its own proportions. Explicit fits, a layout's region, placed (edge) pictures, explicit weights and the `gallery` layout keep their results.
    - `fitImage` reports a crop of exactly 0 instead of a rounding error such as -8e-17.
    - `intrinsicImageAspect` and `intrinsicImageSize` read a JPEG's EXIF orientation: orientations 5 to 8 (a phone photo held upright) report the proportions as shown, width and height swapped, so a contained picture's frame matches the picture.
