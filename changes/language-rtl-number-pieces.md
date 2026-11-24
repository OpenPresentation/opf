---
type: fixed
packages: [pptx]
---
#1404 (import only; exported files are unchanged): a right-to-left slide with a paragraph of only numbers comes back from a PPTX round trip in its own language. The export writes such a paragraph ("+16%", "-2.5%", "$42") as an `en-US` run in a paragraph marked left to right (LH-118), and the importer counted that run as the slide's language: a Hebrew title with one number paragraph tied 1:1 and came back as `en-US`, on the deck (`{"slides": [{"title": "תוצאות", "text": "+16%"}]}`), on a slide beside one declared `en-US`, and against a deck or slide that declared `he` (with `metadata-reference-changed` and `rtl-language-mismatch`). On a slide that has a right-to-left paragraph in another language, these runs are now left out like the Latin pieces of a right-to-left paragraph. A number paragraph tagged with an author's language (`altLang`) still counts, and Hebrew or Arabic text set to English in PowerPoint still imports as English.
