---
type: fixed
packages: [opf]
---
RR-58 (output-changing for slide images on layouts that set `design.imageFill` only): a slide image without its own `fill` now takes the effective `design.imageFill`, the slide's, then the deck's, then the layout record's (FA-17). Before, composition read only the slide's and the deck's value, so a layout such as `image-1x-fit-slideimage` drew its slide image cropped unless a document copied `imageFill: "fit"` into the slide.
