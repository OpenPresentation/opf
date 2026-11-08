---
type: added
packages: [pptx]
---
opf#926 (experimental): a tested LibreOffice interoperability check for the PPTX export. A pinned LibreOffice (26.8.2.2, hash-checked)
in the pinned Linux image converts a maintained corpus (cover and text, long and nested lists, images and crops, tables, common charts,
the opf#925 long-text case and the shared native-acceptance decks) and `scripts/libreoffice/run.mjs` measures rendered text and ink
against each box and the slide edge, reads every word back from the PDF and from LibreOffice's own re-export, records the exact
LibreOffice and font identities, and compares each slide with OPF's preview. It runs every night as a report-only leg; LibreOffice
stays experimental and never a runtime dependency. See docs/libreoffice.md.
