---
type: changed
packages: [gallery]
drawing: ["layouts:two-column", "layouts:image-beside", "layouts:logos"]
---
WI-3 (output-changing: columns and media): `two-column` takes timelines, and its pictures are shown whole.
    - `two-column` accepts every content kind, the timeline included (a timeline in a column was drawn below the layout's grid with a `layout-unplaced` warning), and sets `design.imageFit: "contain"`, so a picture beside text is shown whole at the region's anchor instead of cropped into a tall strip. An explicit `fit` on the block still wins.
    - `image-beside` and `logos` write `anchor: "middle"` on their media regions: a picture shown whole now sits at its region's anchor (top by default), and these two keep the centered look they had.
