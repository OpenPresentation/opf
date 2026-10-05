// FF-43: exact counts of the vendored (embed "used" or open pack) faces a renderer lists as lazy fonts, keyed by its package version.
// A renderer whose count drifts, or whose version is not listed, fails the installed-font checks instead of passing a loose lower bound:
// a release that vendors more faces adds its entry here.
//   0.11.0: the published release lists 51 (35 open faces and 16 Intos faces).
//   0.11.1: the FF-43 release lists 86 (18 open packs, 70 faces, plus 16 Intos faces).
//   0.11.2: the FF-19 release adds no faces and lists the same 86 as 0.11.1.
//   0.11.3: the FF-22 classic chart preview release adds no faces and lists the same 86 as 0.11.2.
//   0.11.4: the FF-43 release adds Raleway and Playfair Display (2 open packs, 8 faces: Regular, Italic, Bold, Bold Italic each) and lists 94, 8 more than 0.11.3.
//   0.11.5: the FF-41 release (face-level lazy loading) adds no faces and lists the same 94 as 0.11.4.
//   0.11.6: the chart category-axis label release adds no faces and lists the same 94 as 0.11.5.
//   0.11.7: the FF-41 release (extraLazyFonts, splitStartupFaces) adds no vendored faces and lists the same 94 as 0.11.6 (registry.lazyFonts of a registry without extraLazyFonts).
//   0.11.8: the FF-59 tag colour release adds no faces and lists the same 94 as 0.11.7.
//   0.11.9: the design-fields release (logos, picture bullets, accent font) adds no faces and lists the same 94 as 0.11.8.
//   0.12.0: the lockstep release with core 0.12.0 (right-to-left mirroring, numbered lists, citations, chart options, template variables, Arabic Typesetting size) adds no vendored faces and lists the same 94 as 0.11.9.
//   0.12.1: the RR-20 patch release (Node engines range >=22) adds no faces and lists the same 94 as 0.12.0.
export const LAZY_FONT_COUNTS = Object.freeze({ '0.11.0': Object.freeze([51]), '0.11.1': Object.freeze([86]), '0.11.2': Object.freeze([86]), '0.11.3': Object.freeze([86]), '0.11.4': Object.freeze([94]), '0.11.5': Object.freeze([94]), '0.11.6': Object.freeze([94]), '0.11.7': Object.freeze([94]), '0.11.8': Object.freeze([94]), '0.11.9': Object.freeze([94]), '0.12.0': Object.freeze([94]), '0.12.1': Object.freeze([94]) });

/** Throws unless `count` is an expected lazy face count for the renderer `version`. */
export function assertLazyFontCount(version, count, label = 'renderer') {
  const expected = LAZY_FONT_COUNTS[version];
  if (!expected) throw new Error(`${label} ${version}: no expected lazy font count is recorded; add it to scripts/lazy-font-counts.mjs`);
  if (!expected.includes(count)) throw new Error(`${label} ${version} lists ${count} lazy fonts; expected ${expected.join(' or ')} (scripts/lazy-font-counts.mjs)`);
}
