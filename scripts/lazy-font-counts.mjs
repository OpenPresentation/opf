// FF-43: exact counts of the vendored (embed "used" or open pack) faces a renderer lists as lazy fonts, keyed by its package version.
// A renderer whose count drifts, or whose version is not listed, fails the installed-font checks instead of passing a loose lower bound:
// a release that vendors more faces adds its entry here.
//   0.11.0: the published release lists 51 (35 open faces and 16 Intos faces).
//   0.11.1: the FF-43 release lists 86 (18 open packs, 70 faces, plus 16 Intos faces).
//   0.11.2: FF-19 script-face loading; the vendored set is unchanged, 86.
export const LAZY_FONT_COUNTS = Object.freeze({ '0.11.0': Object.freeze([51]), '0.11.1': Object.freeze([86]), '0.11.2': Object.freeze([86]) });

/** Throws unless `count` is an expected lazy face count for the renderer `version`. */
export function assertLazyFontCount(version, count, label = 'renderer') {
  const expected = LAZY_FONT_COUNTS[version];
  if (!expected) throw new Error(`${label} ${version}: no expected lazy font count is recorded; add it to scripts/lazy-font-counts.mjs`);
  if (!expected.includes(count)) throw new Error(`${label} ${version} lists ${count} lazy fonts; expected ${expected.join(' or ')} (scripts/lazy-font-counts.mjs)`);
}
