# LH-41 measured timeline-note allocation

This separate 0.34 source change derives from reviewed integration 1458d45934d2b5a0d04a191ec13125c5db3faec7. PR1194 and earlier source branches stay permanently frozen. No PowerPoint, registry, site or deployment action is performed here.

The immutable E1 batch03/s27 has three named timelines, all twelve described events and three notes. The previous automatic allocator measured its timeline majority as vertical intrinsic timelines in a 2+1 grid, then drew three horizontal timelines in the allocated row. Its long note overflowed at 16px and both note cells reported small-cell findings. The comparison Claude panel omits event descriptions and cannot be the content target.

Vetoable decisions:

- Restrict the retry to an already observed horizontal timeline row plus text notes with actual readability findings. Retain every observed role size, authored value and complete text style; preserve pinned regions, explicit vertical composition, recompose:false and explicit gaps.
- Measure and place that same observed timeline row, instead of its unrelated intrinsic vertical estimate. Fully measured fitting note cells have the same content-sized contract as template auto rows.
- Try one existing type-scale step of note growth, then retain their settled sizes. Notes use observed whole-line wrapping within 70 characters. Only an unauthored default gap may be halved; reject any new finding, smaller text, changed value/style or unfit result.

Nine focused controls currently pass, including four baseline failures across LTR/RTL and two deterministic metrics, authored-gap acceptance/refusal, vertical/pinned layouts, over-capacity content and ordinary bodies. On the actual office/visual/script-auto font route, the target has no findings, retains timeline roles and grows notes from 16px to 18px. Exact CLI evidence and mapped checks are being sealed; native acceptance and integration goldens remain parent-owned. This is not a published 0.34 claim.
