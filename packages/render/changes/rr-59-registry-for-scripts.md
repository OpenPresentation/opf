---
type: fixed
---
RR-59 (opf#485): the fonts handle's `textMeasurement` offers `forScripts(profile)`, the script planner (`createScriptFonts`) that core `validate` and `paginate` (core with opf#488) ask for each slide's measurement. With it, `validate(deck, { fonts })` no longer reports `opf/layout-failed` ("Font 'Intos Display' cannot display U+645") and `paginate(deck, { fonts })` no longer throws `missing-glyph` for Arabic and other script text the same handle renders and exports: they measure each script run in the face this renderer draws. The hook is additive; an older core ignores it, and rendering is unchanged.
