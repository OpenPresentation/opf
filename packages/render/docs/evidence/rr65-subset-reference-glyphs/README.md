# Named font subset reference glyphs (RR-65)

On macOS, the unchanged strict browser test failed on renderer main `d425933` with published core `0.18.3`, independently of the held 0.19 changes. The first cover differed in 4,389 RGB channels (maximum 111), exclusively in 16px regular Intos text. The 25px regular Intos subtitle and 54px Intos Display title matched. This is actual browser pixel evidence, not a layout or native PowerPoint claim.

## Discriminating controls

All glyphs **and** all Unicode retained through the same subset pipeline still produced the mismatch. Restoring only the original `post` table in that control produced an exact match. Both fonts have the same 19 table kinds: GDEF, GPOS, GSUB, OS/2, cmap, cvt, fpgm, gasp, glyf, head, hhea, hmtx, loca, maxp, name, post, prep, vhea and vmtx. There are no omitted LTSH, hdmx, VDMX or AAT tables.

Preserving glyph names alone failed. Retaining ASCII alone failed. Combining them passed. Binary removal across the compliance and model-governance covers reduced the retained characters to `X` (U+0058) and `o` (U+006F); neither alone covers both samples. [reference-search.json](reference-search.json) records the exact removal trials. The resulting minimal combination passes the unchanged complete browser corpus: 147 slides and 384 embedded faces.

This proves an empirical dependency on named reference glyphs for these macOS small-text raster cases. The precise internal CoreText implementation is opaque; use of those glyphs by its scaler is an inference, not an Apple-documented algorithm claim. The implementation preserves them uniformly, without an OS branch, rendered-content change, whole-font exception or tolerance adjustment. HarfBuzz keeps its ordinary deterministic glyph subset and layout closure, now with `GLYPH_NAMES` (0x80) and the two reference characters.

The primary [HarfBuzz `hb-subset.h` definition](https://github.com/harfbuzz/harfbuzz/blob/main/src/hb-subset.h) defines `HB_SUBSET_FLAGS_GLYPH_NAMES = 0x00000080u` and describes preserving PostScript glyph names. The pinned, prebuilt `harfbuzzjs@1.6.3` subset WASM exports `hb_subset_input_set_flags` as a function (confirmed with `WebAssembly.Module.exports`); the subsetter's required-export check now verifies it explicitly. The actual-font regression verifies the result independently of that flag value.

Unadjusted browser advances, per-character origins and bounding boxes were exactly equal after removing SVG `textLength`/`lengthAdjust`. DevTools `CSS.getPlatformFontsForNode` confirmed actual custom Intos-Regular/IntosDisplay-Bold use, with equal glyph counts. Hint programs and global scaler fields match. Restoring OS/2/name metadata, changing loca encoding, retaining glyph IDs/count and unique internal naming did not fix it. A previous no-hint diagnostic changed only the subset, so it does **not** establish symmetric hint independence.

## Reproducible gates

Node 24.21.0, Playwright 1.63.0, macOS Chromium headless shell 1243; main-based source uses actual published core 0.18.3.

```sh
npm run build
node test/font-subset-reference-glyphs.mjs
node test/font-subsets.mjs
node test/font-subsets-browser.mjs
npm run typecheck
npm run validate
npm test
```

The new Node regression decodes eight actual regular/bold/italic/bold-italic Intos and Intos Display subsets, authored sample `Revenue 12% — affine` containing neither reference character. It checks retained glyph IDs and actual names, identical shaping and small glyph counts. Browser coverage adds 40 exact, unadjusted comparisons at 12, 14.4, 16, 25 and 54px across those eight faces. Existing subset size, shaping, determinism, license/RFN/fsType and PDF checks remain intact: 84 example slides average 2,556 KB whole versus 56 KB subset SVG.

## Held 0.19 qualification

A disposable copy of frozen renderer `2377a136aebfb68559ef202dcb8f75d3fad6d0ad` and gallery `e0a7eee2dfe996e680b34a907cabfe41905e6d99` uses only the source-built subset module overlay. The initial core `6d3d4e12` run was a pre-chart-correction control. The final run uses a private copy of clean core #596 `fa688e9780f9ba1d6b05c1e06b7004e06837b4ed`, including the 20 corrected chart layouts. `/private/tmp/rr65-final-subset-qualification` does not modify the frozen checkouts.

The corrected 807-slide candidate exactly equals `/private/tmp/rr81-golden-clean594-corrected20/candidate.json` (source digest `b05ed665d5e357e0453fbd4a20a5e0074a6bface26b5e9afa0a3a630827115bf`). All 807 final example golden entries and all 498 final template entries, including source/options metadata, equal their existing final candidates exactly. The template run writes a separate candidate only; its 26 differences against the older committed fixture baseline are already-existing gallery record changes, not new subset drift. No baseline was edited or promoted. The final copy also passes all 147 slides/384 embedded faces and the 40 added strict browser cases.

All listed source gates passed, including the complete 111-file package test run. The corrected core copy also passed the strict 147-slide/384-face browser gate plus the 40 added comparisons. Reproduce the corrected golden comparison with `OPF_GOLDEN_BASELINE=/private/tmp/rr81-golden-clean594-corrected20/candidate.json OPF_GOLDEN_OUT=/private/tmp/rr65-final-corrected20-golden node test/golden.mjs` in the disposable candidate copy. Logs are `/private/tmp/rr65-reference-full-node.log`, `/private/tmp/rr65-final-corrected20-golden.log` and `/private/tmp/rr65-final-corrected20-browser.log`.
