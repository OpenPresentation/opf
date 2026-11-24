---
type: fixed
packages: [pptx]
---
Import only; exported files are unchanged: a deck that declares no language and mixes scripts no longer comes back from a PPTX round trip with an invented deck language. Where the slide in the engine default had more runs than the right-to-left slide (an English slide with a title and five bullets beside an Arabic slide with one title), the importer returned `"language": "en-US"` on the deck and `"ar-SA"` on the Arabic slide, neither of which the source had. It decided whether the file was untouched by comparing the most common run tag of the whole file (which counts runs) with the reading of the whole deck's text (which counts letters). It now compares each slide's runs with the language read from that slide's text, which is how the export wrote them. A language set in PowerPoint is imported as observed, and a file without the stored record imports as before.
