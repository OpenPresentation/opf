# Current59 native coverage: observations, not acceptance

| # | Current case / full PPTX SHA256 | Exact historical input? | Raw evidence / same actions? | Remaining acceptance |
|---|---|---|---|---|
|1|layout-title-auto<br>e803970281c809194c5a87542dd75a26803180695ea2570007b6d5086905f4ad|Not found in bounded scan|None|visual/font + CURRENT saved import unrun; no blanket acceptance|
|2|layout-media-regions<br>66045a856f8788028fcbee657cc60423b4ac96071da39b6a5ad7334d9d61e61d|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|3|layout-empty-custom<br>1ec8301b3ea012360a057b250bd494c47d358be5ca1d00d127814d82f9bba54d|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|4|table-save<br>63800e02b5fba61005226230a990dadcf8fcb9e243db56a5415b16b18d4d3fc7|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|5|furniture-inherited<br>534752506fcba148ce75c70a7fde6e96ab91185f39367b43b01bb177ae50e45e|Not found in bounded scan|None|visual/font + CURRENT saved import unrun; no blanket acceptance|
|6|furniture-flags<br>f72a63a98e356d87e58513592584312e6b961d5101dddee9f1200b044c1407d2|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; adaptation/inequality retained|
|7|list-description-native-edit<br>e4daad6b6089ae22b87352ca0340cc373c40dab85d748cb2d989044b8c9e5d6d|YES|N03 / same plan|visual/font + CURRENT saved import unrun; no blanket acceptance|
|8|list-description-native-save<br>e4daad6b6089ae22b87352ca0340cc373c40dab85d748cb2d989044b8c9e5d6d|YES|N03 / DIFFERENT actions / alias list-description-native-edit|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|9|layout-bleed-card<br>ee16b8b3c81150f25b9e46ecce9a737f06c0dfe69f8dc60ee6b7c874042a2533|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|10|picture-control<br>75b9413aebd821085a8069ce0f210da0d7ce32caae3432dd7b1b03fb1b161ea5|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|11|furniture-layouts<br>2434367db71fac47c9818149bd6de2b8bd27c3d0e8c47be6ce51dc70327a2214|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|12|chart-treemap-category<br>a578e072df14d00fcc4105f60be8ccba10bf5464e59d6064ac3032d200e1b7da|YES|N02 / same plan|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|13|chart-histogram-single<br>69e2f1022f11d3b5fdafb69d07124163c00eb97d815ab3cd16f76d3a6d8c4977|YES|N05 / same plan|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|14|chart-histogram-category<br>84a5eaca1a7ca44f199e7f72b166eeaa7d33222e57766585b2fd4db6230c24f3|Not found in bounded scan|N04 old DIFFERENT input|No-op only; visual/font + CURRENT saved import unrun; adaptation/inequality retained|
|15|chart-pareto-multi<br>5557b74239b11517d71b4a609b7458aa274c25084474e83fcf5b9f9654dd8f6a|YES|N15 / same plan|No-op only; visual/font + CURRENT saved import unrun; adaptation/inequality retained|
|16|chart-box-multi<br>2a6bf10820673c1f6a9bbdd9244e9c9b687825bfa86caf9d4057a9ad62dee923|YES|N13 / same plan|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|17|chart-waterfall-single<br>83a01144694d526ffa7399c8142a150b29cd7e42784b00fa9d67a1766f84a170|YES|N16 / same plan|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|18|chart-funnel-category<br>68e436a3c0356a4aaec5ac1ee36c673d1b8733380226bf6d8f228e63e80b97fd|YES|N14 / same plan|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|19|chart-world-category<br>5330e1a6e7a90265e0a03df8a202e0b2419817f59ab4be4c8612e49518b0a708|YES|N17 / same plan|No-op only; visual/font + CURRENT saved import unrun; adaptation/inequality retained|
|20|chart-all-seven<br>854dcc9a2ef73bf6b55d8b0fe14c704486ea575b602cddf5216f2ae697e9291a|Not found in bounded scan|None|Dedicated unchanged-cap plan; No-op only; visual/font + CURRENT saved import unrun; adaptation/inequality retained|
|21|feature-catalog-timeline<br>2aa8ffa8c9370f078808453ca6a0152919ffb858de9d53a61e297f3dc95c38a5|YES|N07 / same plan|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|22|feature-dense-events<br>dcbaec0f1889997af5f21ea67ad5aa10d8865eb99eb5149ce624e316a50730c4|YES|N18 / same plan / alias dense-events-readonly-v1|Dedicated unchanged-cap plan; No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|23|feature-custom-roadmap<br>cb51862837f03929dfdccbcc5352e8b833ed08d51cb23ee224c795b1145b3945|YES|N08 / same plan|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|24|feature-long-labels<br>b2f8158f850cfe4f870f6b9622d9378ee73fc12816fe5eccaff6f7424f769826|YES|N10 / same plan|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|25|feature-metrics<br>9d68dd0820805d1462027091e33f94e21f516d329e91d95a0f6fe203944b2ecc|YES|N01 / same plan|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|26|feature-quote<br>ef7a22560be327ca993de7f6a54141df6b16d8f577788cd63ca09ab028a332b5|YES|N11 / same plan|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|27|feature-list<br>6f0eac67859085e2ba04a293ac67a63c133538ad5a0bc79577e358f1a384cda6|YES|N09 / same plan|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|28|feature-table<br>d69512faf6f4b292527204215c60a5b11b2f1d07781dec53f9f325771883871a|YES|N12 / same plan|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|29|chart-mode-treemap-category-fallback<br>c844c8abe2f223546f9a735e27f16cb0e036dd7c519b01992e02df5c22639079|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; adaptation/inequality retained|
|30|chart-mode-treemap-category-auto<br>984e83d7f4df796f12b65b695240175009d5cf8a97cb91945badfffae3c8c2a7|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|31|chart-mode-treemap-category-native<br>984e83d7f4df796f12b65b695240175009d5cf8a97cb91945badfffae3c8c2a7|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|32|chart-mode-histogram-single-fallback<br>909e7a7c8a0c7b363c9e76102f943308aed577285e776d4ff523779309ecddf1|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; adaptation/inequality retained|
|33|chart-mode-histogram-single-auto<br>5eed8536ae3a05f2b0e85755e0eb2e19f13faf82be958df0b383fa106dba4708|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|34|chart-mode-histogram-single-native<br>5eed8536ae3a05f2b0e85755e0eb2e19f13faf82be958df0b383fa106dba4708|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|35|chart-mode-histogram-category-fallback<br>b1dacc5a077cafa4d6f1c7e895c4a1dfb00f5675a012f9b9987b5ebea6756a3f|YES|N06 / same plan|No-op only; visual/font + CURRENT saved import unrun; adaptation/inequality retained|
|36|chart-mode-histogram-category-auto<br>b1dacc5a077cafa4d6f1c7e895c4a1dfb00f5675a012f9b9987b5ebea6756a3f|YES|N06 / same plan / alias chart-mode-histogram-category-fallback|No-op only; visual/font + CURRENT saved import unrun; adaptation/inequality retained|
|37|chart-mode-histogram-category-native<br>b1dacc5a077cafa4d6f1c7e895c4a1dfb00f5675a012f9b9987b5ebea6756a3f|YES|N06 / same plan / alias chart-mode-histogram-category-fallback|No-op only; visual/font + CURRENT saved import unrun; adaptation/inequality retained|
|38|chart-mode-pareto-multi-fallback<br>27332eb5dc21f204a9974fc5f4c94782e6255e6cd8ea8f95592e93151761cbf3|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; adaptation/inequality retained|
|39|chart-mode-pareto-multi-auto<br>27332eb5dc21f204a9974fc5f4c94782e6255e6cd8ea8f95592e93151761cbf3|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; adaptation/inequality retained|
|40|chart-mode-pareto-multi-native<br>27332eb5dc21f204a9974fc5f4c94782e6255e6cd8ea8f95592e93151761cbf3|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; adaptation/inequality retained|
|41|chart-mode-box-multi-fallback<br>b3aa657940d76070d05e9474ebffaa230c334e706671830503d2db10c754a0ab|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; adaptation/inequality retained|
|42|chart-mode-box-multi-auto<br>f0b7a7f4a2b50ebe8bbd048c543f638a80bbb9c570fceb9f0bda40debd3db4b2|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|43|chart-mode-box-multi-native<br>f0b7a7f4a2b50ebe8bbd048c543f638a80bbb9c570fceb9f0bda40debd3db4b2|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|44|chart-mode-waterfall-single-fallback<br>be6e0cdace0e905efce8d1df59bca66e2e6e64370fcf5a5acad59aacf747c66e|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; adaptation/inequality retained|
|45|chart-mode-waterfall-single-auto<br>f7648a7febf9fe4d6dd5a30b528d71003e0ab20c7cfa4575dbc38737a30571b1|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|46|chart-mode-waterfall-single-native<br>f7648a7febf9fe4d6dd5a30b528d71003e0ab20c7cfa4575dbc38737a30571b1|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|47|chart-mode-funnel-category-fallback<br>a497c583b3bdf5544a274667b428f8d268cf9470adf5c9a545512d8aa736974f|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; adaptation/inequality retained|
|48|chart-mode-funnel-category-auto<br>5fab47abd2af883156bc1cac7b6b650aebe31b5ab70addab8e8b3078468078bf|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|49|chart-mode-funnel-category-native<br>5fab47abd2af883156bc1cac7b6b650aebe31b5ab70addab8e8b3078468078bf|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|50|chart-mode-world-category-fallback<br>f33103aca9e84add9d05cd672092e20fd73521cdcb4447aa9a4defb45ddf58cc|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; adaptation/inequality retained|
|51|chart-mode-world-category-auto<br>f33103aca9e84add9d05cd672092e20fd73521cdcb4447aa9a4defb45ddf58cc|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; adaptation/inequality retained|
|52|chart-mode-world-category-native<br>5a68433827021732d9d4978398209aaae984dcea1fb134d1058d974ce8666ec7|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|53|chart-mode-all-seven-fallback<br>b8d9448f8b8a09aca2d5cc3d19432b1c29d875bd227cd617879467fca9d0afde|Not found in bounded scan|None|Dedicated unchanged-cap plan; No-op only; visual/font + CURRENT saved import unrun; adaptation/inequality retained|
|54|chart-mode-all-seven-auto<br>3d3e326cad98c0b3c15127c91607216d58127658cf7f1b9e274a5e6d702e4e74|Not found in bounded scan|None|Dedicated unchanged-cap plan; No-op only; visual/font + CURRENT saved import unrun; adaptation/inequality retained|
|55|chart-mode-all-seven-native<br>3d3e326cad98c0b3c15127c91607216d58127658cf7f1b9e274a5e6d702e4e74|Not found in bounded scan|None|Dedicated unchanged-cap plan; No-op only; visual/font + CURRENT saved import unrun; adaptation/inequality retained|
|56|chart-mode-pareto-single-auto<br>ce3bc0ec80c641e3c8d915118357d02d50119b12913e0999448607d0b190d87d|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|57|chart-mode-pareto-single-fallback<br>50d3792f202959f25f836f1d1b56e6ac282c878daa15293b2b760bd5d6b8b06d|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; adaptation/inequality retained|
|58|chart-mode-pareto-single-native<br>ce3bc0ec80c641e3c8d915118357d02d50119b12913e0999448607d0b190d87d|Not found in bounded scan|None|No-op only; visual/font + CURRENT saved import unrun; no blanket acceptance|
|59|table-colors<br>485236f38e925ac3435582799edbf968d6ea8a2a2148a88f6e23194a9cfcb6fb|YES, FAILED table|None|Fresh corrected table profile/native; visual/font + CURRENT saved import unrun; no blanket acceptance|

Full absolute raw report, original/edited/reopened PNG and saved PPTX paths/hashes, worker/producer/action/phase details and missing criteria are in matrix.json observations/rows. N-identifiers refer to its exact input-bound historical observations; none is a native PASS badge.
