---
type: changed
packages: [gallery]
drawing: ["layouts:closing", "layouts:statement", "layouts:quote", "layouts:comparison"]
---
WI-2 (declared drawing change, a minor release): the single-message layouts place the title and what belongs to it as one group. `closing` and `statement` are all-`auto` columns anchored in the middle, so the supporting text sits one gap under the title and subtitle (it used to sit a few hundred pixels below) and the title-only slide draws as before; `closing` also keeps a contact or QR picture whole (`imageFit: contain`). `quote` sizes its quotations `auto`, so the title and the quotation are centered together. `comparison` sizes its options `auto`, so the verdict follows the options instead of sitting at the foot of the slide (dense options keep their size). `image` now says that the picture is shown whole, and that a full-bleed crop needs an explicit `fit: "cover"` (wording only). The layouts' previews are regenerated.
