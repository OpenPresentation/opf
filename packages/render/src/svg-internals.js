// Hooks svg.js fills in for the renderer's own modules (the font analysis in lazy-fonts.js). They are not part of the package API:
// index.js re-exports svg.js, so internals live here instead of as exports there.
export const deckInternals = {};
