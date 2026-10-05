---
type: changed
packages: []
---
RR-20 (release records; no package change): the release plan, compatibility matrix, quickstart and live-editor guide adopt core 0.12.1 (gitHead 1f698c4, RR-41: the six plural audience ids are deprecated aliases), opf-pptx 0.12.2 (gitHead e4569ac, RR-17: Vietnamese and Uyghur decks list only the deck's fonts) and opf-editor 0.11.2 (gitHead c7ac1d7, RR-41: `slide-sizes` and `purposes` switch dimensions); renderer, PPTX and editor keep the core floor `^0.12.0` (core 0.12.1 moves no geometry). The published-matrix consumer moves to that set, and the gallery tracker's pinned snapshots move to the opf-editor 0.11.2 release commit and pptx.gallery 555c1a1, which clears the `missing-editor` gaps for slide sizes and purposes.
