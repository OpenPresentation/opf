---
type: changed
packages: []
---
opf#364 (docs): "pass `fonts`, otherwise the estimate". `docs/font-fidelity.md` and `docs/validate.md` now say that one `fonts` handle (from opf-render's `loadFonts()`) carries text measurement for `validate`, `paginate`, the slide context, `toSvg`/`toPng`/`toPdf` and `toPptx`; that preview, validation, pagination and export should share it; and that a call without it uses core's built-in estimate (0.54 em per character, 0.62 em for capitals and digits, 0.32 em for a space, 1 em for CJK, zero for combining marks), which is too narrow for some scripts (opf#566).
