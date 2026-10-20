# OPF Example Gallery

This folder contains broader OPF examples organized by scenario instead of by isolated schema feature.

- `industries/`: vertical market and operating model examples.
- `business-functions/`: department and function-specific decks.
- `education/`: K-12, higher education, research, and workforce learning examples.
- `government/`: public-sector, civic, regulator, and public engagement examples.
- `presentation-types/`: common deck shapes such as pitches, QBRs, training, incident reviews, and reports.
- `international/`: multilingual or region-specific examples.
- `design-and-media/`: examples that stress design, image, video, and data-storytelling choices.

The root-level examples one directory up remain compact regression fixtures. The gallery examples are intentionally more varied: some are sparse OPF documents, while others use catalog overrides, assets, metadata, promoted regions, blocks, and richer design configuration.

Brand marks, header icons, watermarks, cover artwork and supporting photos are original MIT-licensed abstract illustrations embedded as PNG data URIs. They work offline without fonts or an image resolver and can be regenerated with `scripts/gallery-artwork.mjs`. They are fictional demonstration artwork, not photographs or third-party logos: a supporting photo is an abstract landscape that stands in for a real photograph, which is what a deck of your own would carry there.

Every gallery deck converts to PNG and PPTX with `opf convert` as it is, and `pnpm check:examples-convert` keeps it so. Two kinds of reference remain authoring examples, because their files are not embedded and no conversion reads them: each deck's `demo-video` asset (`./media/<organization>-demo.mp4`) and its `metric-data` asset (`./data/<title>.csv`). The video slide draws its placeholder and the data asset feeds nothing on the page, so neither makes a conversion fail; playback and data resolution belong to the application that opens the deck.
