---
type: changed
packages: [render]
---
CE-20: `toSvg(deck, slides)` binds and composes only the slides it draws (a slide is composed on its own), so drawing one slide of a long deck no longer composes every slide; `resolvePresentation(deck, options, { slides })` does the same for the 0-based slides it names (the other entries of `slides` are then undefined). Output is unchanged; a glyph-fallback diagnostic of a slide that is not drawn is no longer reported for that draw.
