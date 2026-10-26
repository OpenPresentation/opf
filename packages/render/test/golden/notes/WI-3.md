# WI-3: columns and media

Core changes how pictures, videos and charts are framed; the renderer draws what core composes. No colors, fonts or drawing code change. Four engine rules and three record changes cause every move below.

1. **Contained media at the anchor.** A picture shown whole (`contain`) takes a frame of its own proportions, centered across and placed down its cell by the region's `anchor` (top by default).
2. **16:9 video frames.** A video draws in the largest 16:9 box that fits its cell, placed the same way. The play badge and caption center on that frame.
3. **Auto-mode pictures and charts.** With no layout, a picture that sets no fit is shown whole, and a chart is at most 4:3.
4. **Auto-mode widths** (portrait picture beside other blocks; two prose blocks of very different demand). No corpus slide uses either, so no golden moved for them.
5. Records: `two-column` accepts timelines and contains pictures; `three-column` is new; `image-beside` and `logos` write `anchor: "middle"` on their media region, which embeds in the example decks that carry the `image-beside` record.

## Corpus goldens (`golden.yml`, run 40323187369)

24 decks and 26 slides of 818 changed against main's baseline (the review sheets are in the run's artifact).

- **Video slides (23).** The single-video slides: each of the 20 `gallery/*` decks' slide 7 ("Demo Moment") plus `technical/asset-source-forms` (slide 2), `technical/content-payload-matrix` (slide 4) and `technical/full-feature-tour` (slide 9). The play placeholder is now a 16:9 frame at the top of the media cell instead of the whole cell.
- **Charts (2).** `technical/chart-type-sampler` (slides 0 and 1): a chart beside other content is at most 4:3.
- **Picture (1).** `technical/asset-source-forms` slide 1 (the data-URI picture): shown whole, in its own frame.
- The 20 `gallery/*` deck files also changed in `examples/` (they embed the `image-beside` record with its new `anchor`); `check:registry-golden`'s source digest moves with them.

## Template baseline (`layout-templates-rr96-color-variants.json`)

`node test/layout-template-goldens.mjs --update`, reviewed, then `--promote`d: 499 slides (29 templates x 12 and the feature and paginated cases), 52 changed.

| Template | Slides | Cause |
| --- | --- | --- |
| `three-column` | 12 (+ 2 paginated) | new template |
| `image` | 12 | the picture is drawn in its own frame at the top of the bled cell |
| `logos` | 12 | logo frames follow their proportions, centered by the region's anchor |
| `image-beside` | 10 (+ 2 paginated) | the picture frame follows its proportions, centered by the region's anchor |
| feature cases | 2 | `image carded`, `image-beside mirrored`: the same two rules |

Core's own geometry golden (`packages/javascript/test/fixtures/template-goldens-0.19.json`) only gained the 12 `three-column` entries: no existing template's text geometry moved.
