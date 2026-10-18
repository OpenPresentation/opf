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
//   0.12.2: the RR-20 patch release that replaces the unpublished 0.12.1 (golden baseline for the core 0.12.2 examples) adds no faces and lists the same 94 as 0.12.1.
//   0.13.0: the lockstep minor release with core 0.13.0 (RR-54 chart and table data, golden baseline for the core 0.13.0 examples) adds no faces and lists the same 94 as 0.12.2 (counted at opf-render main 23553be: BUNDLED_FONT_MANIFEST and registry.lazyFonts both 94).
//   0.13.1: the RR-20 security patch (sharp 0.35.5, GHSA-wq5f-xc86-pv6w) adds no faces and lists the same 94 as 0.13.0.
//   0.14.0: the lockstep minor release with core 0.14.0 (FA format audit, RR-55 short verbs and the fonts handle) adds no faces and lists the same 94 as 0.13.1 (counted at opf-render#151 88ae726 with prepareNodeFonts and at opf-render#150 085263b with loadFonts on core opf#423: BUNDLED_FONT_MANIFEST and registry.lazyFonts both 94; src/font-manifest.js is byte-identical to 0.13.1).
//   0.15.0: the FA wave C release (catalog groups, zero built-in records, image backgrounds and image blocks) adds no vendored faces and lists the same 94 as 0.14.0 (counted at opf-render main 8b27cd2 on core main 2c026f5: registry.lazyFonts 94).
//   0.16.0: the lockstep release with core 0.16.0 (RR-61 used-face embedding, RR-63 optional converter and font packages, FA-26 nested placeholder groups, FA-27/FA-30 accessibility) adds no vendored faces and lists the same 94 as 0.15.0 (counted at opf-render main d94eeec on core main 2149117 with the office font packages installed: registry.lazyFonts 94).
//   0.17.0: the lockstep release with core 0.17.0 (FA-31 slide variables in furniture, RR-64 text as paths, the Arabic preview fix, the forScripts paginate hook) adds no vendored faces and lists the same 94 as 0.16.0 (counted at opf-render main afeae6b on core main e81008b9: registry.lazyFonts 94; src/font-manifest.js is byte-identical to 0.16.0).
//   0.17.1: the renderer patch with RR-76 (SVG honours OS/2 fsType), RR-65 (glyph subsets) and RR-64 phases 2 and 3 adds no vendored faces and lists the same 94 as 0.17.0 (counted at opf-render main 6623103: registry.lazyFonts 94; src/font-manifest.js is byte-identical to 0.17.0).
//   0.18.0: the consistent-API lockstep release (RR-70 one import, RR-71 organization logos, RR-72 master furniture, RR-73 and RR-74 names and options, RR-75 CLI) adds no vendored faces and lists the same 94 as 0.17.1 (counted at opf-render main 7116acb with core main 0a34013 linked: registry.lazyFonts 94; src/font-manifest.js is byte-identical to 0.17.1).
//   0.18.1: the renderer patch (render#199 bundler-safe file resolution, #125 and #189 shaping state and cluster pins, #188 HarfBuzz in the vector PDF, #191 harfbuzzjs 1.6.3 and the Noto Sans JP/KR 0.4.4 and Noto Color Emoji 0.4.7 pins) adds no vendored faces and lists the same 94 as 0.18.0 (counted at opf-render main 8738c65 with core main cf85102c linked: registry.lazyFonts 94, registry.embeddedFonts 33; src/font-manifest.js changes only the re-pinned package versions and hashes).
//   0.18.2: the geometry-floor/held-fix patch preserves 0.18.1's font manifest and all vendored font bytes (qualified renderer 09325bdd, published baseline d4259333); 78 open faces plus 16 Intos faces remain 94.
//   0.19.0: planned stable layout-engine release; merged renderer 0e18fb53 preserves all 143 font-manifest/vendored files of 0.18.2, and its actual office registry lists 94 (78 open plus 16 Intos). This records source evidence, not registry publication.
//   0.19.1: publish-baseline repair; renderer c9631797 retains the exact 143 manifest/font/license files of published 0.18.1 d4259333. The office used-font registry remains 78 open faces plus 16 Intos faces: 94. This is source evidence, not a publication claim.
//   0.20.0: array-area train; renderer 0eeafb28 preserves all 143 reviewed manifest/font/license files of published baseline d4259333. The unchanged office registry remains 78 open plus 16 Intos faces: 94. Source evidence only, not publication.
//   0.20.1: RR-85 core-floor release; renderer d8103461 preserves all 143 manifest/font/license files of published 0.20.0 (83c1e6e4). Manifest SHA-256 16d0b4141054f42c66f3aa9a4f146362693825689c442c8ee693832b729fa699; 78 open plus 16 Intos faces remain 94. Source evidence only, not publication.
//   0.20.2: planned ordinary-baseline repair after the failed 0.20.1 tag; source based on b5330eab preserves all 143 manifest/font/license files of published 0.20.0 (83c1e6e4). Manifest SHA-256 16d0b4141054f42c66f3aa9a4f146362693825689c442c8ee693832b729fa699; 78 open plus 16 Intos faces remain 94. Prospective source evidence only, not publication.
//   0.20.3: RR-87 release prep a63fef11 on merged source a0ca9a5e preserves all 143 manifest/font/license files of genuine published 0.20.2 (837dbca5). Manifest SHA-256 16d0b4141054f42c66f3aa9a4f146362693825689c442c8ee693832b729fa699; the actual office registry, measured on byte-identical source/build b0092591, lists 78 open plus 16 Intos faces: 94. Source qualification only, not publication.
//   0.20.4: trusted-publish workflow recovery preserves all 143 manifest/font/license files of failed 0.20.3 tag 886a5e77 and genuine published 0.20.2 (837dbca5), verified against the owned recovery checkout. Manifest SHA-256 16d0b4141054f42c66f3aa9a4f146362693825689c442c8ee693832b729fa699; the byte-identical office registry remains 78 open plus 16 Intos faces: 94. Prospective source evidence only, not publication.
//   0.22.0: RR-90 first-use train; renderer main 2ba167d0 has no change under fonts/ since tag opf-render-v0.20.4 (142 tracked files, empty diff), and the packed candidate's office registry measured 94 lazy faces (78 open plus 16 Intos) in opf-render#258 CI. Release qualification.
export const LAZY_FONT_COUNTS = Object.freeze({ '0.11.0': Object.freeze([51]), '0.11.1': Object.freeze([86]), '0.11.2': Object.freeze([86]), '0.11.3': Object.freeze([86]), '0.11.4': Object.freeze([94]), '0.11.5': Object.freeze([94]), '0.11.6': Object.freeze([94]), '0.11.7': Object.freeze([94]), '0.11.8': Object.freeze([94]), '0.11.9': Object.freeze([94]), '0.12.0': Object.freeze([94]), '0.12.1': Object.freeze([94]), '0.12.2': Object.freeze([94]), '0.13.0': Object.freeze([94]), '0.13.1': Object.freeze([94]), '0.14.0': Object.freeze([94]), '0.15.0': Object.freeze([94]), '0.16.0': Object.freeze([94]), '0.17.0': Object.freeze([94]), '0.17.1': Object.freeze([94]), '0.18.0': Object.freeze([94]), '0.18.1': Object.freeze([94]), '0.18.2': Object.freeze([94]), '0.19.0': Object.freeze([94]), '0.19.1': Object.freeze([94]), '0.20.0': Object.freeze([94]), '0.20.1': Object.freeze([94]), '0.20.2': Object.freeze([94]), '0.20.3': Object.freeze([94]), '0.20.4': Object.freeze([94]), '0.22.0': Object.freeze([94]) });

/**
 * RR-90: a renderer version that is not in LAZY_FONT_COUNTS still passes when its font files are exactly a set already reviewed. The
 * set is the 143 files the renderer package ships for fonts (dist/font-manifest.js and every file under fonts/: faces, licenses,
 * PROVENANCE.json, NOTICE.md), hashed by `hashFontSet`. A set is reviewed when it is listed in REVIEWED_FONT_SETS with the lazy face
 * count measured for it. Any other change fails closed: a changed or unknown file set, a different count for a reviewed set, or a
 * prerelease (which always needs its own LAZY_FONT_COUNTS entry).
 * To review a new set: pack the release, run hashFontSet over the package, read why the files changed, then add the set (and the
 * version's count to LAZY_FONT_COUNTS).
 */
export const REVIEWED_FONT_SETS = Object.freeze({
  '7bd7928683331c2bca5ca0a642738257c646cb8b0da94600768424a6d5bb8e65': Object.freeze({
    manifestSha256: '16d0b4141054f42c66f3aa9a4f146362693825689c442c8ee693832b729fa699',
    files: 143,
    count: 94,
    versions: Object.freeze(['0.18.1', '0.20.0', '0.20.2', '0.20.4']),
    note: 'Hashed from the published tarballs of those four versions, which are byte-identical in font files (RR-90). The office pack of renderer 0.20.4: 78 open faces plus 16 Intos faces list as 94 lazy fonts.',
  }),
});

/**
 * Hash a renderer package's font set: sha256 of the lines `<path> <sha256 of the file>` (path relative to the package, `/`
 * separators, sorted by path) for dist/font-manifest.js and every file under fonts/. Self-contained so the installed-consumer check
 * can embed it (pass `readdir`, `readFile` from node:fs/promises and `createHash` from node:crypto). Returns { manifestSha256,
 * fontSetSha256, files }.
 */
export async function hashFontSet({ root, readdir, readFile, createHash }) {
  const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const paths = ['dist/font-manifest.js'];
  const walk = async (directory) => {
    for (const entry of await readdir(`${root}/${directory}`, { withFileTypes: true })) {
      const relative = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await walk(relative);
      else paths.push(relative);
    }
  };
  await walk('fonts');
  paths.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const lines = [];
  let manifestSha256;
  for (const relative of paths) {
    const hash = sha256(await readFile(`${root}/${relative}`));
    if (relative === 'dist/font-manifest.js') manifestSha256 = hash;
    lines.push(`${relative} ${hash}\n`);
  }
  return { manifestSha256, fontSetSha256: sha256(lines.join('')), files: paths.length };
}

/**
 * The reason `count` is not acceptable for renderer `version`, or undefined. `fonts` is hashFontSet's result for the installed
 * renderer (optional: without it only LAZY_FONT_COUNTS can admit a version). Self-contained so the installed-consumer check can embed it.
 */
export function lazyFontCountProblem({ version, count, counts, reviewedSets, fonts }) {
  const expected = counts[version];
  if (expected) return expected.includes(count) ? undefined : `renderer ${version} lists ${count} lazy fonts; expected ${expected.join(' or ')} (scripts/lazy-font-counts.mjs)`;
  const unrecorded = `renderer ${version}: no expected lazy font count is recorded; add it to scripts/lazy-font-counts.mjs`;
  if (!fonts) return unrecorded;
  if (/-/.test(version)) return `${unrecorded} (a prerelease is never admitted by its font files alone)`;
  const reviewed = reviewedSets[fonts.fontSetSha256];
  if (!reviewed) {
    return `${unrecorded}. Its font files are not a reviewed set (font set sha256 ${fonts.fontSetSha256}, dist/font-manifest.js sha256 ${fonts.manifestSha256}, ${fonts.files} files): the fonts changed. Review the change, then add the set to REVIEWED_FONT_SETS and the count to LAZY_FONT_COUNTS`;
  }
  if (count !== reviewed.count) {
    return `${unrecorded}. Its font files are the reviewed set of renderer ${reviewed.versions.at(-1)}, but it lists ${count} lazy fonts and that set lists ${reviewed.count}: the count changed without the fonts. Review why, then add the count to LAZY_FONT_COUNTS`;
  }
  return undefined;
}

/** Throws unless `count` is an expected lazy face count for the renderer `version` (see lazyFontCountProblem; `fonts` is hashFontSet's result). */
export function assertLazyFontCount(version, count, label = 'renderer', fonts = undefined) {
  const problem = lazyFontCountProblem({ version, count, counts: LAZY_FONT_COUNTS, reviewedSets: REVIEWED_FONT_SETS, fonts });
  if (problem) throw new Error(label === 'renderer' ? problem : problem.replace(/^renderer /, `${label} `));
}
