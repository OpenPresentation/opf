# Font fidelity everywhere: burndown

Goal and resume protocol: [README.md](README.md). Research:
[font-flow map (FF-06)](font-flow-map.md), [Aptos origin brief](aptos-origin-brief.md).
Measured per-dimension status: [gallery support table (FF-23)](gallery-support.md).
Per-font status, priorities and next actions (FF-40 to FF-46): [font tracker](font-tracker.md).

Status values: `todo`, `in-progress`, `review` (PR open), `done` (merged after
independent review and applicable acceptance, evidence linked), `blocked` (reason in notes).
Every item's criteria must all hold before it is `done`. Dates are UTC.
On September 29 the owner authorized reviewed local-test merges during the
Actions credit shortage; this does not waive native/font, functional fidelity or
release-specific gates. Original CI denials and failed observations remain intact.

## Summary

| Status | Count |
| --- | --- |
| done | 27 |
| review / in-progress | 17 |
| todo | 19 |

**Next goal (owner, 2026-09-30): every gallery config `works` (100%). Baseline 427 of 819 `works` (52.1%)**, 322 `partial`, 70 `gallery-only` (`support-status.json` at core `60e73d4`, measured on opf-render 0.11.3 `a66caa3`, opf-pptx 0.11.2 `0400434`, opf-editor 0.10.2 `c7995ed`, pptx-gallery `b2238ac`). Items FF-47 to FF-58; tracked internally, never shown on pptx.gallery; `pnpm report:works` prints the number. Per dimension: layouts 291 of 485 (60.0%), charts 19 of 26, content blocks 31 of 32, font schemes 0 of 93, languages 0 of 93, themes 0 of 4; audiences, backgrounds, color schemes, headers and footers, image treatments, narratives, socials and tones are 100%. Where the gaps go (a config can carry several reasons, so the counts overlap): audit host model and font policy FF-48 (themes 4, the font-availability reasons of the 93 font schemes and 93 languages); theme `ea`/`cs` typefaces FF-49 (font schemes 93, languages 2); language contract FF-50 (languages 93); layout placement FF-51 (50 partial, 7 gallery-only); layouts with no distinguishing geometry FF-52 (43 partial, 25 gallery-only); image re-import FF-53 (12 partial, 12 gallery-only); sample overflow FF-54 (18); the 70 legacy slugs FF-55; chartex FF-56 (7 charts); quote re-import FF-57 (1 block, 1 partial and 2 gallery-only layouts). Closure is FF-58. **Progress (2026-09-30, FF-48, review): 431 of 819 `works` (52.6%)** on the published set with opf-render 0.11.4 (core `3e1cbf0`, opf-render `1a724a6`, opf-pptx `ecdbb42`, opf-editor `c7995ed`, pptx-gallery `59ff36c`); themes are 4 of 4, and the font-availability reasons of the 93 font schemes and 93 languages are gone, leaving FF-49 (font schemes 93, languages 2) and FF-50 (languages 93) as their only reasons ([FF-48 measurement](gallery-support.md#audits-model-the-shipped-font-host-ff-48-2026-09-30)). This is separate from the parity scoreboard below; see the [README](README.md#next-goal-every-gallery-config-works-100).

**Latest headline (2026-09-30, published set with opf-render 0.11.4): 734 of 850 gallery values perfect by parity, 113 near, 3 mismatch** (core `3e1cbf0` package 0.11.2, opf-render 0.11.4 `1a724a6`, opf-pptx 0.11.3 `ecdbb42`, pptx-gallery `59ff36c`; [PARITY-2026-09-30-renderer-0.11.4.md](gallery-support/parity/PARITY-2026-09-30-renderer-0.11.4.md)). The renderer clears the three font mismatches (Raleway and Noto Sans Mongolian perfect, Playfair Display's legacy scheme near) and moves the 7 chartex charts from mismatch to 3 perfect and 4 near; the 3 remaining mismatches are content-block text colours. Presence: 431 of 819 `works` (FF-48).

**Earlier headline (2026-09-30, gallery font host modelled): 729 of 850 gallery values perfect by parity, 108 near, 13 mismatch** (core `3d51ba1` plus the harness change `26a1d82`, opf-render 0.11.3 `a66caa3`, opf-pptx `6f6122c`, pptx-gallery `1f0e382`; [PARITY-2026-09-30-gallery-font-host.md](gallery-support/parity/PARITY-2026-09-30-gallery-font-host.md)). The 86 font-resolution mismatches of the run before it were a harness artifact for 83 values (the harness loaded no script faces; the gallery editor's font gate does): 22 became perfect, 61 near (proprietary script fonts drawn with their Noto replacement, a visual tier), and 3 remain real (Raleway and Playfair Display not bundled, Noto Sans Mongolian cannot shape). Before that, the same day (charts measured): 707 perfect, 47 near, 96 mismatch (core `aedd364` with package 0.11.2, opf-pptx 0.11.2 `0400434`, pptx-gallery `b2238ac`; [PARITY-2026-09-30-charts-measured.md](gallery-support/parity/PARITY-2026-09-30-charts-measured.md); opf#186 scored 657, 37 and 156). The 26 charts are presence items now (19 `works`, 7 `partial`; parity 5, 14, 7), the image treatments are re-measured (15 of 15 `works`), and presence is 427 of 819 `works` (379 of 793 before). Three owner defaults (2026-09-30) are applied: slide-number fields count as one run, `works` for a composed image treatment is the emitted design output written natively and re-imported, and socials icons are catalog metadata only. On the same heads the harness as merged scores 700, 48 and 102, with the chart colour comparison 703, 51 and 96.

**Earlier headline (2026-09-29, merged and published heads): 657 of 850 gallery values perfect by parity, 37 near, 156 mismatch** (core `930577d` with package 0.11.2, opf-render 0.11.2 `021cca0`, opf-pptx 0.11.1 `0d15f1c`, pptx-gallery `0b2dec8`; [opf#186](https://github.com/OpenPresentation/opf/pull/186), [PARITY-2026-09-29-merged-heads.md](gallery-support/parity/PARITY-2026-09-29-merged-heads.md)). It supersedes the opf#175 scoreboard of 660, 33 and 157 as the latest run: one value improves (backgrounds `photography`) and four regress, all in the harness or by construction (the watermark and the footer logo, which the harness did not know how to map, fixed in the same PR, and two slide-number formats whose native field plus literal text is two runs where the preview has one). With the harness as merged the same heads score 653, 37 and 160. The presence audits were re-run on the same heads: 379 of 793 `works` (352 before); the audit A image-treatment probe cannot classify the merged snippets, so those 15 rows keep their 2026-09-23 measurement. Charts are now the 26 Aspose.Slides-supported types with per-type rows in the [support table](gallery-support.md#charts).

**Earlier headline: 5 of 900 gallery values perfect by parity** (accepted
merged source graph, 2026-09-29: opf `a85facf`, opf-render `6c7d781`, opf-pptx
`c749c35`, pptx-gallery `f17e9ae`; 0 near, 895 mismatch). The unchanged audit
improves the September 23 scoreboard at opf `6263985` / opf-pptx `9092954`
from 4 to 5 with no classification regressions; the first baseline at
`53be042` / `cf0bc0c` was 0 of 900. The 900 values are the 793 presence items
plus 76 charts and 31 `withAssets` variants. FF-23 presence results retain
their September 23 heads: 352 of 793 `works` (baseline 7); read the
[measurement notes](gallery-support.md#measurement-notes-2026-09-23-re-run)
first. See the
[scoreboard](gallery-support.md#parity-scoreboard) and its
[universal blockers](gallery-support.md#universal-blockers).

A later dated measurement under the FF-31 look-alike `fontResolution` definition
(owner decision 2026-09-29; [PARITY-2026-09-29-lookalike-fonts.md](gallery-support/parity/PARITY-2026-09-29-lookalike-fonts.md))
recorded 660 of 850 perfect on the Intos mains ([opf#175](https://github.com/OpenPresentation/opf/pull/175)).
It is a different definition and
denominator, so it is not compared with the dated 5 of 900 above. (Superseded by the latest headline: the audits were re-run on the merged heads.) No audit had
been re-run on the 2026-09-29 gallery, exporter, renderer and editor merges
recorded below; the pptx.gallery badges (FF-36, removed 2026-09-30, see FF-36) quoted core `f66413e3` results.

PPTX78 at `7cc779129323af6123ef5e194226a545e743f195` was a separate candidate
measurement: also 5/900 perfect, text 798 to 799 and fills 790 to 791, with no
classification change. It subsequently passed exact-head Linux/Windows CI
and merged as `bf3f78f`; the final merged-source audit retained those counts
([receipt](https://github.com/OpenPresentation/opf/pull/147)). The committed
headline above remains the explicitly dated pre-PPTX78 baseline. These
source/package audits use no Office; FF-29 remains in review. FF-05 is now
in progress: its Calibri controls still report Aptos, including with all six
theme font slots explicit and unchanged before/after bounded content reads,
without identifying the precise cause.

## Items

| ID | Item | Repo | Depends on | Status | Evidence / PR |
| --- | --- | --- | --- | --- | --- |
| FF-00 | Program tracker and agent entrypoints | all | none | done | [opf#116](https://github.com/OpenPresentation/opf/pull/116) `642f37af`; [opf-pptx#60](https://github.com/OpenPresentation/opf-pptx/pull/60), [opf-render#31](https://github.com/OpenPresentation/opf-render/pull/31), [opf-editor#29](https://github.com/OpenPresentation/opf-editor/pull/29) |
| FF-01 | Exporter master bullets follow the theme body font | opf-pptx | none | done | [opf-pptx#57](https://github.com/OpenPresentation/opf-pptx/pull/57), `7b34f557` |
| FF-02 | Embed harness records pre-edit, post-text and post-edit font observations | opf-pptx | none | done | [opf-pptx#58](https://github.com/OpenPresentation/opf-pptx/pull/58) `b6eb3bfd`; hardening [opf-pptx#62](https://github.com/OpenPresentation/opf-pptx/pull/62) `83a41b9a` |
| FF-03 | Read-only native font inventory worker | opf-pptx | none | done | [opf-pptx#59](https://github.com/OpenPresentation/opf-pptx/pull/59) `ef8a1583` |
| FF-04 | Native inventory of the unedited fixture, with and without temporary fonts | opf-pptx / opf | FF-03 | done | [opf#145](https://github.com/OpenPresentation/opf/pull/145) merged `a85facf`, [September 29 evidence](../../evidence/windows-native-font-inventory-20260929/README.md): both fixture conditions and exporter control audited; Aptos present before edits; portable staged-blob verification and independent review passed |
| FF-05 | Aptos root cause determined | opf | FF-02, FF-04 | in-progress | [brief](aptos-origin-brief.md), [E6 Calibri control](../../evidence/windows-native-calibri-control-20260929/README.md), [E7 explicit theme slots](../../evidence/windows-native-explicit-slots-20260929/README.md), [E8 before/after content reads](../../evidence/windows-native-font-query-order-20260929/README.md): the collection stays empty-name + Aptos across the bounded query interval; exact style/part or native-resolution cause remains open |
| FF-06 | Font-flow map across all 14 dimensions and environments | opf | none | done | [font-flow-map.md](font-flow-map.md), [opf#116](https://github.com/OpenPresentation/opf/pull/116) |
| FF-07 | Exporter writes chosen fonts into theme and run East Asian/complex-script slots, with `lang`/RTL | opf-pptx | FF-05, FF-06, FF-18 | review | merged: [opf-pptx#70](https://github.com/OpenPresentation/opf-pptx/pull/70) `0e886f30`, [opf#134](https://github.com/OpenPresentation/opf/pull/134) `9695bf37`, [opf#135](https://github.com/OpenPresentation/opf/pull/135) `3512af0b`; pending FF-05 native root-cause evidence (criteria are subject to FF-05) |
| FF-08 | Exporter leaks no hard-coded or default font in any part | opf-pptx | FF-05, FF-06, FF-17 | review | merged: [opf-pptx#69](https://github.com/OpenPresentation/opf-pptx/pull/69) `405963ce`; pending FF-05 native root-cause evidence (empty values must be allowed by FF-05) |
| FF-09 | Offline pairwise matrix across the 14 gallery dimensions | opf (ecosystem) | FF-07, FF-08, FF-19, FF-20 | todo |  |
| FF-10 | Matrix in CI on ubuntu, windows, macos via a packed TypeScript consumer | opf | FF-09 | in-progress | accepted [opf#156](https://github.com/OpenPresentation/opf/pull/156) `b3c8fbf`: installed portability foundation with original Linux/macOS/Windows checks; FF-09 font switching and installed FF-38 parity remain pending |
| FF-11 | Export determinism independent of host fonts, OS, locale and timezone | opf-pptx / opf | FF-06 | in-progress | accepted [opf-pptx#86](https://github.com/OpenPresentation/opf-pptx/pull/86) `373dfa39688e787d861202e7a8069ebff7e8be36`: explicit ZIP dates use UTC in PPTX and embedded workbooks; original Linux/Windows source and packed checks passed. [Runtime checkpoint](../../handoff-runtime-2026-09-29.md#utc-zip-dates-and-the-renderer-absent-candidate-gate); coordinated candidate checks run the unchanged public fixture; outcomes are recorded separately. Font, locale/LANG, broader OS/ICU and complete determinism criteria remain open. |
| FF-12 | Native PowerPoint sample of the matrix, including CJK and RTL | opf-pptx / opf | FF-03, FF-07, FF-09, FF-18 | todo |  |
| FF-13 | Font-embed attempt from merged main, audited | opf-pptx / opf | FF-02, FF-07, FF-08 | todo |  |
| FF-14 | Evidence bundles, compatibility matrix and handoff merged | opf | FF-10, FF-11, FF-12, FF-13, FF-16, FF-19 | todo |  |
| FF-15 | Release-readiness note for the release owner (no publishing) | opf | FF-14 | todo |  |
| FF-16 | Editor switch operations for every dimension patch, undo and refresh the preview | opf-editor | FF-06, FF-17 | todo |  |
| FF-17 | Code-font default follows the scheme; gallery apply keeps roles (shared default delivered by FF-35) | opf, opf-editor, opf-pptx | FF-06 | done | [opf#120](https://github.com/OpenPresentation/opf/pull/120) `53be0427`, [opf-pptx#61](https://github.com/OpenPresentation/opf-pptx/pull/61) `cf0bc0cc`, [opf-editor#30](https://github.com/OpenPresentation/opf-editor/pull/30) `f75372f2` |
| FF-18 | Language/script model: per-script fonts resolvable from language and font scheme | opf | FF-06 | done | [opf#118](https://github.com/OpenPresentation/opf/pull/118) `d03a583c` |
| FF-19 | Renderer script fonts (CJK, Arabic, Indic), `lang` and RTL in previews | opf-render | FF-18 | done | [opf-render#41](https://github.com/OpenPresentation/opf-render/pull/41) `f0cf1a81`; follow-up [opf-render#63](https://github.com/OpenPresentation/opf-render/pull/63) `b5fdd1e` (2026-09-29, released in opf-render 0.11.2 as `021cca0`, [#64](https://github.com/OpenPresentation/opf-render/pull/64)): `scripts: 'auto'` also loads the script faces a font scheme itself names, and `missing-glyph` says what to load (`details.loadedFaceHasGlyph`). Open finding (FF-38, 2026-09-30): in Node `scripts: 'auto'` leaves the Latin Noto Sans fallback-only when a scheme selects `Latn` (Sylfaen), so the Sylfaen scheme and the Armenian and Georgian languages throw `font-unavailable` in Node while the browser registry loads it; a two-line `loadOfficeFontRegistry` change, with the diff and a test to add, is in [the parity report](gallery-support/parity/PARITY-2026-09-30-gallery-font-host.md#a-difference-between-the-hosts-sylfaen-in-node) |
| FF-20 | Bump ecosystem-ci sibling pins after each opf-pptx font fix | opf | FF-07, FF-08 | done | first bump [opf#117](https://github.com/OpenPresentation/opf/pull/117) `7b4589b6`; pins past FF-07/FF-08/FF-31 [opf#136](https://github.com/OpenPresentation/opf/pull/136) `17da7ac3` |
| FF-21 | Non-blocking macOS browser job tracking opf-render#24 | opf-render | none | done | [opf-render#32](https://github.com/OpenPresentation/opf-render/pull/32) `df27685c` |
| FF-22 | Charts reduced to Aspose.Slides-supported chart types (core catalog and pptx.gallery; deprecate if breaking) | opf, pptx-gallery | none | done | core merged: [opf#121](https://github.com/OpenPresentation/opf/pull/121) `13ab00bb`, [aspose-chart-types.md](aspose-chart-types.md); gallery half merged: [pptx-gallery#40](https://github.com/Data-Advantage/pptx-gallery/pull/40) `23f9216` (2026-09-29); the Charts section of [gallery-support.md](gallery-support.md#charts) now lists the 26 kept types with measured per-type parity rows ([opf#186](https://github.com/OpenPresentation/opf/pull/186), [PARITY-2026-09-29-merged-heads.md](gallery-support/parity/PARITY-2026-09-29-merged-heads.md)), which was the last open criterion. Parity is measured for all 26 (0 perfect: series colours are not in the preview; FF-22b) |
| FF-22b | Native `chartex` export and full renderer coverage for the kept chart types | opf-pptx, opf-render | FF-22 | review | [opf-pptx#76](https://github.com/OpenPresentation/opf-pptx/pull/76), [opf-render#42](https://github.com/OpenPresentation/opf-render/pull/42) open; both merged and published (opf-pptx#76 native classic chart constructs, opf-render#42 classic chart previews; opf-pptx 0.11.2 `0400434`, opf-render 0.11.3 `a66caa3`). Measured 2026-09-30 ([PARITY-2026-09-30-charts-measured.md](gallery-support/parity/PARITY-2026-09-30-charts-measured.md), [support table](gallery-support.md#charts-measured-and-owner-defaults-2026-09-30)): the 19 classic types preview the catalog construct, export the construct core records and re-import to the same id (audit B `works`); parity 5 perfect, 14 near (native chart labels), 7 mismatch. Chartex halves open (2026-09-30): [opf-pptx#108](https://github.com/OpenPresentation/opf-pptx/pull/108) writes the seven chartex ids (`treemap`, `histogram`, `pareto`, `world`, `box-and-whisker`, `waterfall`, `funnel`) as native `cx:chartSpace` parts with style parts and an `mc:AlternateContent` frame whose fallback is the clustered column chart, re-imports them to the same id, and reports `series-dropped`/`chart-map-geodata` instead of `chartex-fallback`, behind the opt-in `toPptx` option `chartex: 'native'` (the default keeps main's clustered column bytes and diagnostics, pinned by a fixture, until the native check passes); [opf-render#66](https://github.com/OpenPresentation/opf-render/pull/66) previews the same constructs (the map as a non-geographic value tile grid). Still open: the native PowerPoint check of the classic and chartex constructs (native-check deck set with manifest prepared, root owner), the FF-38/FF-23 harness reading `chartEx` parts (today both read the fallback `c:chart` frame), and re-run audits on released packages |
| FF-23 | Measured pptx.gallery support table by dimension and reproducible audit | opf | none | done | [opf#122](https://github.com/OpenPresentation/opf/pull/122) `e18df26b`, [gallery-support.md](gallery-support.md) |
| FF-24 | Color schemes export as theme colors and re-import | opf-pptx | none | done | [opf-pptx#67](https://github.com/OpenPresentation/opf-pptx/pull/67) `5b657c9b` |
| FF-24b | Follow-up to FF-24 (remaining theme-colour items from the opf-pptx#67 review) | opf-pptx | FF-24 | done | [opf-pptx#77](https://github.com/OpenPresentation/opf-pptx/pull/77) `69e20cc` (merged 2026-09-30; theme colour references, table chrome, dark-theme master background), released as opf-pptx 0.11.2 `0400434`. Audit evidence, re-run 2026-09-30 ([support table](gallery-support.md#charts-measured-and-owner-defaults-2026-09-30)): audit B color schemes 14 of 14 `works` (14 `partial` before) and no theme-colour reason remains in the color-scheme or theme rows (themes stay `partial` on font availability only) |
| FF-25 | Pattern and photo backgrounds export natively and stay distinct | opf, opf-pptx, opf-render, pptx-gallery | none | done | engine halves merged: [opf-pptx#66](https://github.com/OpenPresentation/opf-pptx/pull/66) `2d206b3a`, [opf-render#35](https://github.com/OpenPresentation/opf-render/pull/35) `527f46d1`, [opf#127](https://github.com/OpenPresentation/opf/pull/127) `1e4cc880`, [opf-render#45](https://github.com/OpenPresentation/opf-render/pull/45) `d7d0b686`; gallery half merged: [pptx-gallery#43](https://github.com/Data-Advantage/pptx-gallery/pull/43) `e32c7dc` (2026-09-29; distinct `openDmnd`, `wave` and `pct5` presets and a self-contained photography `assets.cover`; the PR's own scratch audit of the three branches measured backgrounds 6/6 `works`, 4 to 0 disagreements); audit evidence re-run on the merged heads ([opf#186](https://github.com/OpenPresentation/opf/pull/186)): audit A backgrounds 6/6 `works` with 0 preview/export disagreements, parity 6/6 perfect (12/12 with the withAssets variants), Backgrounds section of the support table updated |
| FF-26 | Image treatments export as native pictures with distinct values | opf, opf-render, opf-pptx, pptx-gallery | none | done | engine PRs merged: [opf#126](https://github.com/OpenPresentation/opf/pull/126) `57679388`, [opf#129](https://github.com/OpenPresentation/opf/pull/129) `bb72349f`, [opf-render#36](https://github.com/OpenPresentation/opf-render/pull/36) `37572f50`, [opf-render#38](https://github.com/OpenPresentation/opf-render/pull/38) `410e5145`, [opf-pptx#68](https://github.com/OpenPresentation/opf-pptx/pull/68) `8e315610`, [opf-pptx#73](https://github.com/OpenPresentation/opf-pptx/pull/73) `29e35ac5`; `design.watermark` now exports natively: [opf-pptx#104](https://github.com/OpenPresentation/opf-pptx/pull/104) `72611c0` (2026-09-29; one `OPF watermark` picture after the slide image and before content, `alphaModFix` opacity, re-import via `OPF_WATERMARK_V1` provenance; byte-identical media parts are embedded once, a 50-slide deck falls from 10.4 MB to 0.42 MB), released as opf-pptx 0.11.1 (`0d15f1c`, [#105](https://github.com/OpenPresentation/opf-pptx/pull/105)); gallery: self-contained, distinct image-treatment snippets in [pptx-gallery#44](https://github.com/Data-Advantage/pptx-gallery/pull/44) `7498d1f` merged, its hold on silent image loss lifted (the PR reports all 15 treatments export the image the preview draws on the published set, watermark included); selected-item handoff separately accepted in [#48](https://github.com/Data-Advantage/pptx-gallery/pull/48); re-run 2026-09-29 ([opf#186](https://github.com/OpenPresentation/opf/pull/186)): parity 15/15 perfect on the merged snippets, with and without a supplied image; the 15 snippets are 15 distinct OPF documents; the gaps are labelled on the gallery items (6 `gap`, 2 `composed`, 7 `native`) and in the support table. Re-measured 2026-09-30 ([PARITY-2026-09-30-charts-measured.md](gallery-support/parity/PARITY-2026-09-30-charts-measured.md); owner default 2026-09-30 redefines `works` for a composed treatment as: the design output the snippet emits is written natively into the PPTX and re-imports): audit A's probe now measures that (declared images, preview images and native pictures or background blips agree in count and bytes; the watermark's `alphaModFix` and a background image's opacity; re-import keeps the images, backgrounds, watermark and `imageFill`), with negative controls (`image-treatment.test.mjs`), and the retained 2026-09-23 rows are dropped. All 15 are `works`, none is `schema-only` and none reports "export adds no native picture", the 15 snippets are 15 distinct documents, and every effect OPF v1 cannot express (masks, corner radii, blur, duotone, device frame) carries its gallery `gap` label and `opfGapNote`; `works` means the emitted composition is native, not that the effect is applied. Parity 15 of 15 perfect (September 30 too) |
| FF-27 | Headers/footers as OPF furniture with PowerPoint slide-number and date fields | opf-pptx, pptx-gallery | none | review | engine PRs merged: [opf#130](https://github.com/OpenPresentation/opf/pull/130) `f2dcdbd4`, [opf-render#39](https://github.com/OpenPresentation/opf-render/pull/39) `5f6bc7e8`, [opf-pptx#74](https://github.com/OpenPresentation/opf-pptx/pull/74) `23e2dfc2`; gallery snippet options in [pptx-gallery#47](https://github.com/Data-Advantage/pptx-gallery/pull/47) `2bb4970` merged (2026-09-29) on the now published contract (core 0.11.2, renderer 0.11.2, PPTX 0.11.1, pinned by [pptx-gallery#58](https://github.com/Data-Advantage/pptx-gallery/pull/58) `8d31596`); the PR's scratch audit of the four branches measured headers-footers 10/10 `works`; audit A re-run on the merged heads ([opf#186](https://github.com/OpenPresentation/opf/pull/186)): headers-footers 10/10 `works` and `slide-number-only` and `slide-number-progress` emit different OPF, so the audit-evidence criterion is met; parity 8/10 perfect and 2 near (`slide-number-progress`, `appendix-numbering`: a native field plus literal text is two runs where the preview draws one), z-order passes, support table updated. Still open: no native PowerPoint confirmation that `slidenum` fields render and renumber (FF-12, root-only), and no gallery snippet exercises a `datetime*` field (the snippets carry fixed dates, which core defines as static content; a current date, `date: true`, needs a host-supplied date) |
| FF-28 | Narrative and audience catalog parity | opf, pptx-gallery | none | done | [opf#123](https://github.com/OpenPresentation/opf/pull/123) `c2785324` (content blocks 5 to 29 `works` by audit A) |
| FF-29 | Layout catalog parity and export fidelity | opf, opf-pptx, pptx-gallery | none | review | merged: [opf#132](https://github.com/OpenPresentation/opf/pull/132) `4b991553`, [opf-render#43](https://github.com/OpenPresentation/opf-render/pull/43) `0337ce2e`, [opf-pptx#79](https://github.com/OpenPresentation/opf-pptx/pull/79) `0424d561`, [opf-pptx#81](https://github.com/OpenPresentation/opf-pptx/pull/81) `c749c35`; accepted full audit 5/900 perfect. [opf-pptx#78](https://github.com/OpenPresentation/opf-pptx/pull/78) independently reviewed at `7cc779129323af6123ef5e194226a545e743f195`, full suite and six browser suites pass; separate candidate audit 5/900, exact-head CI pending at this checkpoint |
| FF-30 | Content blocks keep metric text in preview and export | opf, opf-render, opf-pptx, pptx-gallery | none | review | metric-only [pptx-gallery#49](https://github.com/Data-Advantage/pptx-gallery/pull/49) accepted `4b48e693`; [pptx-gallery#44](https://github.com/Data-Advantage/pptx-gallery/pull/44) `7498d1f` merged 2026-09-29 (label/value metric split, chart-with-KPI column composition, inline narrative records; the newly silent image loss it was held for is fixed by the watermark export in FF-26), and quote reimport remains open; audit A re-run on the merged heads ([opf#186](https://github.com/OpenPresentation/opf/pull/186)): blocks 31/32 `works`, `market-opportunity` and `financial-snapshot` keep every metric string with no `text-overflow`, but `quote-slide` still loses its `quote` payload kind on re-import (only `heading-import-reflow` is emitted), so the audit-evidence criterion is unmet; parity 19/32 perfect, 8 near, 5 mismatch. [Local checkpoint](../../handoff-runtime-2026-09-29.md#local-acceptance-during-the-actions-credit-shortage) distinguishes exact selected-source acceptance from metric/image fidelity |
| FF-31 | Font provisioning per the owner font policy: licensed fonts never bundled or embedded (shipped open replacements render, PPTX keeps the real name); open fonts bundled, embeddable only via FF-13; policy table in core | opf, opf-render, opf-pptx | FF-35 | review | merged: [opf-pptx#63](https://github.com/OpenPresentation/opf-pptx/pull/63) `f2a7e14e`, [opf#133](https://github.com/OpenPresentation/opf/pull/133) `d3397502`, [opf-render#44](https://github.com/OpenPresentation/opf-render/pull/44) `6c7d7818`; accepted September 29 source-graph audit passes fontResolution for 5/900; final policy acceptance remains open |
| FF-32 | Re-import retains design or emits specific diagnostics | opf-pptx | FF-07, FF-24 | done | [opf-pptx#71](https://github.com/OpenPresentation/opf-pptx/pull/71) `810ee419` |
| FF-33 | Gallery snippet and "open in editor" emit every dimension's selected value | pptx-gallery | FF-26, FF-27 | done | selected-record parity accepted in [pptx-gallery#48](https://github.com/Data-Advantage/pptx-gallery/pull/48) `ca8fbf0`, superseding closed #45; 135 units and 12 browser cases pass. The field-option and image-treatment snippet work merged 2026-09-29 as [#47](https://github.com/Data-Advantage/pptx-gallery/pull/47) `2bb4970` and [#44](https://github.com/Data-Advantage/pptx-gallery/pull/44) `7498d1f` (each PR reports its editor route builds the same document as the snippet); audit A re-run on the merged heads ([opf#186](https://github.com/OpenPresentation/opf/pull/186)): the editor documents for headers-footers (10/10) and blocks (32/32) are identical to the snippets and differ per slug (`editorMatchesSnippet`, `editorPathSlugAgnostic` false), and the 15 image-treatment snippets are 15 distinct documents. Re-measured 2026-09-30 ([PARITY-2026-09-30-charts-measured.md](gallery-support/parity/PARITY-2026-09-30-charts-measured.md)): audit A compares the gallery's per-item editor builder with the snippet for headers-footers (10/10), blocks (32/32) and, now that the image-treatment probe is redefined and the retained rows dropped, image treatments (15/15); `editorPathSlugAgnostic` is false for all three, and no non-layout row reports "identical OPF" or a slug-agnostic editor reason (the 15 image-treatment snippets are 15 distinct documents). The criteria hold; native and release gates are not part of this item |
| FF-34 | Socials produce the platform size/aspect ratio or are documented as authoring-only | opf, opf-pptx, opf-render, pptx-gallery | none | done | engine PRs merged: [opf#125](https://github.com/OpenPresentation/opf/pull/125) `a74f3f62`, [opf-render#34](https://github.com/OpenPresentation/opf-render/pull/34) `bc436f3b`, [opf-pptx#65](https://github.com/OpenPresentation/opf-pptx/pull/65) `90929546`; gallery half merged: [pptx-gallery#42](https://github.com/Data-Advantage/pptx-gallery/pull/42) `1e1fadc` (2026-09-29; the snippet adds a footer with `organization` and `socials: true`, so the organization profile URL renders in preview and export, is linked in the PPTX and re-imports; decision recorded in the PR and page copy: platform records are URL and handle formatters, not size presets, and `Speaker.socials`, glyphs and brand colours stay authoring metadata); the PR's scratch audit of the published set measured 10/10; audit B re-run on the merged heads ([opf#186](https://github.com/OpenPresentation/opf/pull/186)): socials 10/10 `works` (handle in the preview and in the export, re-import returns the socials), parity 10/10 perfect, support table updated; owner default 2026-09-30 (recorded in [gallery-support.md](gallery-support.md#socials) and [PARITY-2026-09-30-charts-measured.md](gallery-support/parity/PARITY-2026-09-30-charts-measured.md)): icons are catalog metadata only (authoring), the profile URLs render and link; audit B re-run on the published set: socials 10/10 `works`, parity 10/10 perfect, matching that decision. Wording completed 2026-09-30 (owner-approved): the social-platform schema description and the Socials definition now say icons and brand colors are catalog metadata for authoring UIs and engines render the profile URL, not icons ([opf#191](https://github.com/OpenPresentation/opf/pull/191), description-only, generated schema docs regenerated, `check:spec` and `check:breaking` clean), and the gallery `/socials` copy says the same ([pptx-gallery#64](https://github.com/Data-Advantage/pptx-gallery/pull/64)). All criteria hold: decision recorded, docs, schema and gallery label icons as authoring metadata, socials rows match the decision |
| FF-35 | Shared default font scheme `aptos` across every engine | opf, opf-render, opf-editor, opf-pptx | FF-17 | done | [opf#124](https://github.com/OpenPresentation/opf/pull/124) `3ba21ff4`, [opf-render#33](https://github.com/OpenPresentation/opf-render/pull/33) `47d19b25`, [opf-editor#31](https://github.com/OpenPresentation/opf-editor/pull/31) `4e47bf95`, [opf-pptx#64](https://github.com/OpenPresentation/opf-pptx/pull/64) `e1627898` |
| FF-35b | Follow-up: unknown font-scheme ids fall back to `aptos`, not a Roboto literal | engines with the literal | FF-35 | done | [opf#131](https://github.com/OpenPresentation/opf/pull/131) `27d0ac14`, [opf-render#40](https://github.com/OpenPresentation/opf-render/pull/40) `0fa35b63`, [opf-pptx#75](https://github.com/OpenPresentation/opf-pptx/pull/75) `c606780f`, [opf-editor#32](https://github.com/OpenPresentation/opf-editor/pull/32) `214ae695` |
| FF-36 | Measured support status per gallery item (internal; not shown on pptx.gallery) | pptx-gallery, opf | FF-23 | done | **Re-scoped 2026-09-30 (owner decision): the measured support status is internal and pptx.gallery must not show it.** Owner: "why are you including a progress tracker `Measured support` on pptx.gallery!?!?!? we just want them all to work we don't need to talk about it publicly". The measurement (core `support-status.json`, [gallery-support.md](gallery-support.md), this burndown) stays; the public badges, legends, panels, `supportStatus` API field and llms.txt lines are removed by the gallery PR "Remove the public support-status UI" ([pptx-gallery#66](https://github.com/Data-Advantage/pptx-gallery/pull/66)). Status stays `done` because the measurement half met its criteria and the display half is withdrawn, not unfinished (the status values have no `superseded`). History of the removed display: charts measured and live 2026-09-30: [pptx-gallery#64](https://github.com/Data-Advantage/pptx-gallery/pull/64) `1f0e382` re-imported the support data from core `7aec43a` ([opf#190](https://github.com/OpenPresentation/opf/pull/190)); every one of the 819 gallery items has a measured status and none is pending (production `/api/charts.json`: 19 works (5 perfect, 14 near), 7 chartex partial/mismatch). Earlier: [pptx-gallery#41](https://github.com/Data-Advantage/pptx-gallery/pull/41) `719274d` merged 2026-09-29: contract `opf-gallery-support-status/v2` imported by `scripts/import-support-status.mjs` from core `f66413e3` `support-status.json` plus the FF-38 parity results (629 perfect, 33 near, 131 mismatch of the 793 gallery values), parity badge primary and pipeline badge secondary, cards, detail pages, index legends and `supportStatus` in the API; deployed to production by the release owner with #58/#59 outside this program. Badge data regenerated on the 2026-09-29 merged heads: core [opf#186](https://github.com/OpenPresentation/opf/pull/186) (793 items plus the 26 charts in `parityOnly`, 657 of 850 perfect, 379 of 793 `works`) and its gallery import [pptx-gallery#60](https://github.com/Data-Advantage/pptx-gallery/pull/60) (`--check` passes). Charts measured 2026-09-30: audit B probes the 26 charts (19 `works`, 7 `partial`) and the parity audit scores them 5 perfect, 14 near, 7 mismatch, so core `support-status.json` now lists the 26 charts as items with a pipeline and a parity status (`notMeasured` is empty and `parityOnly` is empty; 819 items, 427 `works`, 707 of 850 perfect; [support table](gallery-support.md#charts-measured-and-owner-defaults-2026-09-30)). [pptx-gallery#64](https://github.com/Data-Advantage/pptx-gallery/pull/64) re-imports the file from core merge commit `7aec43a` (819 items, no pending; the chart pages and legend show measured badges, tests and a Playwright spec cover them). Still open: that PR merging (Vercel preview and review) |
| FF-37 | pptx.gallery as a first-class OPF catalog: spec URLs serve schema-valid records; core bundles a pinned, drift-checked snapshot | opf, pptx-gallery | none | review | [opf#128](https://github.com/OpenPresentation/opf/pull/128), [pptx-gallery#46](https://github.com/Data-Advantage/pptx-gallery/pull/46); [opf#144](https://github.com/OpenPresentation/opf/pull/144) delivered into the PR128 branch `codex/ff-37-gallery-catalog` as `f8ca179488ee96c8466303bac06ea2dbf30502a0` at 2026-09-29 08:13:34 UTC, not main; gallery-first/conflict gates remain |
| FF-38 | Parity audit harness and progress scoreboard (defines "perfect") | opf | FF-23 | done | [opf#122](https://github.com/OpenPresentation/opf/pull/122) `e18df26b`, [PARITY.md](gallery-support/parity/PARITY.md); latest run, with the gallery editor's font host modelled (FF-38 harness change, 2026-09-30: 729 of 850 perfect, 108 near, 13 mismatch; fontResolution 755 pass, 92 near, 3 fail; `parity/scripts/font-host.mjs`, `PARITY_FONT_HOST`): [PARITY-2026-09-30-gallery-font-host.md](gallery-support/parity/PARITY-2026-09-30-gallery-font-host.md); the run before it, on the published set (707 of 850 perfect, 47 near, 96 mismatch; the 26 charts scored 5 perfect, 14 near, 7 mismatch): [PARITY-2026-09-30-charts-measured.md](gallery-support/parity/PARITY-2026-09-30-charts-measured.md), which also records the harness as merged on the same heads (700, 48, 102), with the chart series colours compared as each construct paints them (703, 51, 96) and the owner default for slide-number fields (707, 47, 96); previous run [opf#186](https://github.com/OpenPresentation/opf/pull/186), [PARITY-2026-09-29-merged-heads.md](gallery-support/parity/PARITY-2026-09-29-merged-heads.md) (657 of 850); the harness maps the native watermark and furniture pictures |
| FF-39 | Alignment parity: preview and PPTX text alignment and anchors agree | opf-pptx, opf-render | FF-38 | review | merged: [opf-render#37](https://github.com/OpenPresentation/opf-render/pull/37) `3f34448e`, [opf-pptx#72](https://github.com/OpenPresentation/opf-pptx/pull/72) `0330e6d0`; the September 23 reverse-alignment mismatches no longer occur in the accepted September 29 audit; geometry 880/900 and text 798/900, with remaining failures and native acceptance open |
| FF-40 | Per-font fidelity tracker and prioritized plan: baseline for every font family (the 160 reviewed plus the four Intos policy rows) | opf | FF-31, FF-38 | done | [font-tracker.md](font-tracker.md), [font-tracker.json](font-tracker.json), `scripts/build-font-tracker.mjs` (drift-checked in `pnpm test`); [opf#174](https://github.com/OpenPresentation/opf/pull/174) `0b8e6de2` (approved review; refreshed after opf-render#54 in the FF-40 refresh PR). The tracker stays live: later font PRs update the overrides file, the manifest snapshot or the parity source and regenerate |
| FF-41 | Host loading and style coverage: shipped editor, gallery, browser and Node hosts load the intended faces | opf-render, opf-editor, pptx-gallery, opf | FF-40, FF-19, FF-31 | in-progress | Merged groundwork: lazy loading of the vendored open pack and Intos ([opf-render#54](https://github.com/OpenPresentation/opf-render/pull/54) `d528be5`, [opf-editor#42](https://github.com/OpenPresentation/opf-editor/pull/42) `cfad5cd`), [opf-render#50](https://github.com/OpenPresentation/opf-render/pull/50), [opf-render#55](https://github.com/OpenPresentation/opf-render/pull/55), [opf-editor#40](https://github.com/OpenPresentation/opf-editor/pull/40), [opf-render#57](https://github.com/OpenPresentation/opf-render/pull/57); packaging merged: [opf-render#60](https://github.com/OpenPresentation/opf-render/pull/60) `2bc786c` (Barlow, Anton, Figtree, Work Sans, EB Garamond, Archivo Narrow, Libre Caslon Text and Bitter bundled lazily, Red Hat Display 600 and italics and Red Hat Text italics completed; released in opf-render 0.11.1) and [opf#178](https://github.com/OpenPresentation/opf/pull/178) `72d337b`. Editor and gallery font gate (2026-09-29): [opf-editor#46](https://github.com/OpenPresentation/opf-editor/pull/46) `997b332` loads the fonts a document needs before every render (Source Apply, gallery handoff, imports, slide navigation, undo/redo, font-scheme switches; script-aware measurement for compose, paginate and PPTX export), released as opf-editor 0.10.1 (`4af6ea6`, [#47](https://github.com/OpenPresentation/opf-editor/pull/47)); renderer follow-up [opf-render#63](https://github.com/OpenPresentation/opf-render/pull/63) `b5fdd1e` (0.11.2, see FF-19); the gallery consumes them through [pptx-gallery#58](https://github.com/Data-Advantage/pptx-gallery/pull/58) `8d31596` (renderer 0.11.2, PPTX 0.11.1) and [#59](https://github.com/Data-Advantage/pptx-gallery/pull/59) `0f6064b` (editor 0.10.1 bundle plus an e2e that fails on 0.10.0), deployed to production; a live check confirmed that Aptos plus Japanese applied through Source renders in `/editor` with Noto Sans JP served same-origin and no font CDN request. This satisfies the gallery-editor release criterion for that path. Still open: Liberation Mono, Sans and Serif, Playfair Display and Raleway; the per-family, per-host fixture (drawn face and shaped advances within 0.1 px) and the tracker host-verification moves for the gallery editor and cards; the unchanged parity audit re-run; known limit: PPTX export uses slide 0's script profile for the whole deck. FF-38 gallery font host model (2026-09-30): the parity harness now runs the editor's font gate on every value, and of the 86 script-face failures only Raleway and Playfair Display remain (the editor draws Roboto through `fallbackFamily`; Node throws `font-unavailable`), plus Noto Sans Mongolian, which loads and cannot shape (FF-44) |
| FF-42 | Aptos family compatibility: Aptos, Aptos Display, Aptos Narrow, Aptos Serif and Aptos Mono qualified separately | opf, opf-render, opf-editor | FF-40, FF-31 | in-progress | Merged: Intos metric policy [opf#166](https://github.com/OpenPresentation/opf/pull/166) `338ddcd4` (0.000% in four styles, Selawik rejected for Segoe UI), Intos faces [opf-render#54](https://github.com/OpenPresentation/opf-render/pull/54) `d528be5`, lazy loading [opf-editor#42](https://github.com/OpenPresentation/opf-editor/pull/42) `cfad5cd` (in the gallery editor since opf-editor 0.10.1, [pptx-gallery#59](https://github.com/Data-Advantage/pptx-gallery/pull/59) `0f6064b`); parity on the merged mains passes all 704 Aptos and Aptos Display values ([opf#175](https://github.com/OpenPresentation/opf/pull/175)). Open: Aptos Mono unmeasured, the tracker's gallery host verification is not yet updated for the editor 0.10.1 release, no native verification, editor fixtures for Aptos Narrow and Serif |
| FF-43 | Remaining Latin replacements: packaging, metric qualification and appearance, per family | opf, opf-render | FF-41 | in-progress | Packaging merged ([opf-render#60](https://github.com/OpenPresentation/opf-render/pull/60) `2bc786c`, released in opf-render 0.11.1; [opf#178](https://github.com/OpenPresentation/opf/pull/178) `72d337b`; the lazy font count for renderer 0.11.2 is recorded in [opf#182](https://github.com/OpenPresentation/opf/pull/182) `3971791`): eight open replacement families (28 faces) bundled, Red Hat completed; the 19 route faces re-measured against the installed originals (all stay visual: none meets the metric bar); Grandview, Tenorite and their Display styles unmeasured (not installed); Bitter bundled after the license test was fixed to the OFL name rule (instanced statics named "Bitter" do not carry the reserved "Bitter Pro"). Metric qualification, line breaks and appearance per family remain open |
| FF-44 | Script replacements and shaping corpora: script-specific corpora and per-family qualification | opf, opf-render, opf-editor | FF-41, FF-18, FF-19 | todo | Evidence from [the gallery font host run](gallery-support/parity/PARITY-2026-09-30-gallery-font-host.md) (2026-09-30): 38 proprietary script families now draw with their Noto replacement and are `near` (visual tier, none metric-compatible), 61 gallery values; 21 pinned Noto script families draw as themselves; the pinned Noto Sans Mongolian 400 face cannot shape any string in fontkit (`font-shaping-failed`, `Not a fixed size`), so the Noto Sans Mongolian font scheme cannot be drawn in any host; the Node `scripts: 'auto'` Sylfaen gap is recorded under FF-19 |
| FF-45 | Special families: Cambria Math, Segoe UI Emoji, Symbol, Webdings, Wingdings | opf, opf-render, opf-pptx | FF-40 | todo |  |
| FF-46 | Native font verification per family and full parity rerun | opf, opf-pptx | FF-41, FF-42, FF-43, FF-44, FF-45, FF-12, FF-05 | todo |  |
| FF-47 | Next goal: every gallery config `works` (100%): tracker rows, baseline headline and the `pnpm report:works` command | opf | FF-23 | review | This tracker PR (branch `codex/ff-goal-100-works`): [README goal](README.md#next-goal-every-gallery-config-works-100), `gallery-support/works-percent.mjs` with a unit test wired into `pnpm test` (`check:works-percent`); baseline 427 of 819 |
| FF-48 | Audits A and B model the shipped font hosts and the owner font policy | opf | FF-47, FF-38, FF-31 | review | [opf#200](https://github.com/OpenPresentation/opf/pull/200) (branch `codex/ff-48-audits-host-model`): [FF-48 measurement](gallery-support.md#audits-model-the-shipped-font-host-ff-48-2026-09-30), [audit README note](gallery-support/README.md), `pnpm report:works` 427 to 431 of 819 (themes 4 of 4); `done` when the PR merges |
| FF-49 | Theme `ea`/`cs` typefaces are written from the scheme's script fonts, never empty | opf-pptx, opf | FF-07, FF-18 | todo |  |
| FF-50 | Language sets script slots (`lang`, direction, `ea`/`cs` fonts), not the Latin scheme: contract documented, engines and audit agree | opf, opf-pptx, opf-render, pptx-gallery | FF-48, FF-49, FF-18 | todo |  |
| FF-51 | Layout export placement matches the preview | opf-pptx, opf-render | FF-29 | todo |  |
| FF-52 | Layouts with no distinguishing geometry: fix the catalog or merge the duplicates | opf, pptx-gallery | FF-29 | todo | Owner decision needed only if a merge or retirement is proposed |
| FF-53 | Image payloads survive re-import | opf-pptx | FF-32 | todo |  |
| FF-54 | Gallery sample content fits its layouts (no text-overflow or small-cell diagnostics) | pptx-gallery, opf | FF-29 | todo |  |
| FF-55 | The 70 legacy gallery layout slugs get canonical OPF ids, or are retired with redirects | opf, pptx-gallery | FF-37, FF-52 | todo | Owner decision needed only if any slug is retired |
| FF-56 | Chartex default flips to native after the native PowerPoint check (7 chart types) | opf-pptx, opf-render, opf | FF-22b, FF-12 | todo |  |
| FF-57 | Quote payloads survive re-import | opf-pptx | FF-32 | todo |  |
| FF-58 | Goal closure: audits re-run on published packages, every config `works` | opf, pptx-gallery | FF-48, FF-49, FF-50, FF-51, FF-52, FF-53, FF-54, FF-55, FF-56, FF-57 | todo |  |
| FF-R0 | Prior: mixed-size table edit/save/reopen and first embed attempt | opf, opf-pptx | none | done | [opf#114](https://github.com/OpenPresentation/opf/pull/114), [opf#115](https://github.com/OpenPresentation/opf/pull/115) |

## Acceptance criteria

**FF-00 Program tracker.** This README and burndown are merged in core. Core
`AGENTS.md` links them under "Active programs". opf-pptx, opf-render and
opf-editor each have an `AGENTS.md` pointing here, with accurate toolchain
commands. The resume protocol works from a fresh clone. Merging the core PR
alone does not close FF-00; the three sibling `AGENTS.md` PRs must merge too.

**FF-01 Master bullet font.** The slide master `bodyStyle` bullets use
`+mn-lt`. Only those nine elements change across the example corpus, import
round-trips are unchanged, and CI is green. Done for the exporter. Native
confirmation of PowerPoint's `Presentation.Fonts` for fixed output is a
separate criterion of FF-12.

**FF-02 Embed harness observations.** `native-font-embed.ps1` records
`Presentation.Fonts` after open, after the text sets and after the font
property sets, plus per-range `Font2` `Name`, `NameAscii`, `NameOther`,
`NameFarEast` and `NameComplexScript` before and after the edits. All are
staged begin/success pairs recorded as observations. The post-edit gate,
allowlist and single `SaveAs($savedPath,24,-1)` are unchanged. Offline controls
and PS 5.1 `-PureRegression` pass on Linux and Windows CI. Independent review
passes.

**FF-03 Inventory worker.** `native-font-inventory.ps1` opens one PPTX
read-only, with no `SaveAs` and exactly one owned close, and records
`Presentation.Fonts` plus per-run font slots for every text range, within
bounds. It supports `-WithoutTemporaryFonts` and control decks. An offline
exclusive-create audit binds hashes, lifecycle, stage pairing and `error:null`.
Controls, pure regression and CI wiring are included. Independent review
passes.

**FF-04 Native inventory.** Root runs FF-03 once per condition, in fresh
directories, on the unedited Carlito fixture with and without temporary fonts,
and on one control deck. Audits pass and the evidence bundle is merged. The
result states whether `Aptos` appears before any edit.

**FF-05 Root cause.** A merged note names the Aptos source, backed by FF-02 and
FF-04 evidence that discriminates the hypotheses: edit-inherited empty theme
`ea`/`cs` (the vendored theme hard-codes `typeface=""` for major/minor
`ea`/`cs`), listed at open, or font-registration specific. If evidence is
inconclusive, the note lists the next discriminating experiment, and the item
stays open.

**FF-06 Font-flow map.** A merged doc maps, for each of the 14 dimensions and
for code, chart, table and notes text, where fonts are chosen, defaulted or
hard-coded, and how each reaches the preview and each PPTX part. It records CI
environment coverage per repo and proposes the pairwise sample.

**FF-07 Script-slot fonts.** For at least one language of every script class
named in FF-06 (at minimum Latin, Cyrillic, Greek, CJK, Arabic/Hebrew RTL,
Indic and Thai), the exporter writes the resolved font into theme major/minor
`ea`/`cs`, instead of the vendored empty values, and into run `ea`/`cs`. For a
Latin deck that is the chosen heading/body family, subject to FF-05. It emits
run `lang`/`altLang` from `language.bcp47` instead of a fixed `en-US`, and
`rtl` for right-to-left languages, so no empty slot is left for PowerPoint to
fill. Offline tests assert the slot inventory per script class. There are no
regressions in the example corpus beyond documented, intended part changes.

**FF-08 No leaked defaults.** A reusable typeface inventory check lives in
opf-pptx and covers every XML part, including nested parts. Over every
example-corpus deck it finds only chosen fonts, `+mj-*`/`+mn-*` references
that resolve to chosen fonts, empty values explicitly allowed by FF-05, and
documented per-script theme supplements. It explicitly covers:

- the theme per-script font list;
- both hard-coded Arial chart data-label sites;
- chart axis and legend `ea`/`cs`;
- the embedded chart workbook's styles and theme (Arial/Calibri today);
- `docProps/app.xml` "Fonts Used", regenerated from the actual font list;
- `pitchFamily`, which must mark monospace fonts correctly.

FF-09 then applies the check to every matrix deck.

**FF-09 Offline matrix.** `scripts/test-font-switch-ecosystem.mjs` in core
(run by `test:fonts`) covers every value class of all 14 dimensions with a
pairwise covering array of roughly 50 to 60 decks. It also has fixed
must-have cases:

- every content type with a proportional and a monospace scheme;
- a per-slide font override;
- CJK text inside a Latin deck.

Each deck is switched A to B and back to A. For each state it exports, applies
the FF-08 check and asserts exported typefaces equal the chosen fonts,
validates the package, and asserts the preview re-rendered with the new fonts.
Content-type changes are block replacements, because no conversion API exists.
The font registry is pinned with substitution off, or every substitution
(for example Calibri to Carlito) is recorded and asserted. The matrix is
deterministic and CI runtime is bounded.

**FF-10 Cross-OS CI.** FF-09 runs on ubuntu, windows and macos, extending the
existing `cli-windows.yml` OS matrix and `check-packed-types.mjs`. It uses a
packed install consumed from a TypeScript project with a pinned TypeScript
version, running `tsc --noEmit` against the published types. Non-Linux jobs
run outside the ecosystem-ci container. On each OS it includes a
headless-browser preview re-render and a run with no system fonts available.
On macOS the required check asserts font families and that re-rendering
happened, not pixel parity; pixel residuals stay in the non-blocking FF-21 job.
It is required on core PRs that touch the matrix or sibling pins. The same
jobs run the FF-38 parity audit and report the perfect count.

**FF-11 Determinism.** Exporting the same deck under different `TZ`, `LANG`
and locale settings, and with no system fonts available, produces
byte-identical PPTX within each OS and across all three OSes. The known
variances must each be pinned, or documented and excluded with justification:
WebP conversion (Node versus browser), font-registry substitution, runtime ICU
version (`Intl.Segmenter`), and `docProps` timestamps.

**FF-12 Native sample.** Root opens a bounded sample of at most 12 decks
read-only with FF-03. It includes at least:

- Carlito with code, chart, table and notes;
- the default scheme;
- a Japanese deck (for example Meiryo);
- an Arabic RTL deck;
- a monospace scheme;
- a per-slide override;
- CJK inside a Latin deck.

Each deck's `Presentation.Fonts` names only its chosen font families, with
theme references resolving to them; any other name fails. This includes native
confirmation for FF-01 output. Evidence is merged.

**FF-13 Embed attempt.** One supervised attempt from merged main, in a fresh
directory, is audited pass or fail. If it passes, the OPC audit shows exactly
the chosen fonts embedded.

**FF-14 Published.** Evidence bundles pass their verifiers. The compatibility
matrix and handoff state exactly what is and is not guaranteed.

**FF-15 Release-readiness notes.** At each checkpoint, a merged note lists:
- which merged changes a release would ship;
- which consumer repos must follow;
- the parity-audit perfect count on the merged heads;
- what a live pptx.gallery would show once packages are published.

It is handed to the release owner, with nothing published. A perfect,
live pptx.gallery depends on that release. Inside this program,
the proof is the FF-38 parity audit on merged heads.

**FF-16 Editor switches.** In opf-editor, switching each of the 14 dimensions
produces the expected document patch with working undo/redo, and the preview
refreshes to the new fonts and content. Tests cover every dimension, and
exports after a switch pass the FF-08 check. The decision on content-type
conversion is recorded: either in scope with an API, or explicitly block
replacement only.

**FF-17 Code and default fonts.**
- The `code` role resolves from the chosen font scheme when the scheme
  defines it; otherwise a documented monospace fallback applies. Today core
  falls back to Roboto Mono for every scheme, including the Consolas and
  Courier New schemes.
- Editor gallery apply keeps every font-scheme role, not just major/minor.
- The shared default scheme moved to FF-35, which is done: every engine
  falls back to `aptos`.

**FF-18 Language/script model.** Core can resolve, for any catalog language,
the font for each script role (Latin, East Asian, complex script), from the
language record plus the chosen font scheme. This works either through
per-script scheme slots or through resolution of `language.fontScheme`. The
schema, catalogs, docs and tests cover every script class in FF-07. It is
backward compatible with existing documents.

**FF-19 Renderer script fonts.** Previews of CJK, Arabic/Hebrew and Indic
decks render with the resolved script fonts, either bundled or supplied by the
caller as documented, honoring `lang` and RTL without `missing-glyph` failures.
It is covered by renderer tests. The 0.1 px gate is unchanged.

**FF-20 Ecosystem pins.** After each merged opf-pptx font fix, core
ecosystem-ci sibling pins advance to that merge and CI passes. The first bump
covers FF-01 (`7b34f557`); the pin was `fcc006a`. The item is `done` once the
pins include the FF-07 and FF-08 merges with CI green; intermediate bumps are
progress-log entries.

**FF-21 macOS render job.** A non-blocking macOS browser job in opf-render
reports the Linux-versus-macOS preview residual, tracking opf-render#24,
without changing the 0.1 px gate.

**FF-22 Charts.** Core `spec/catalogs/chart-types` (and `spec/charts`) and
pptx-gallery `data/charts.json` (76 objects today) are reduced to the chart
types the Aspose.Slides `ChartType` documentation lists as supported, cited by
URL and access date. Every removed or renamed type is listed with its
replacement. `pnpm check:breaking` passes; a breaking removal is deprecated
(kept, marked deprecated, validator/lint warning) rather than deleted. The
Charts section of [gallery-support.md](gallery-support.md) is then replaced by
measured per-type rows.

**FF-23 Support table.** [gallery-support.md](gallery-support.md) covers all
14 dimensions with measured heads, the status legend taken from the audit
classifiers, a summary table and one section per dimension with the burndown
IDs that fix each gap. Both audits' scripts and `results.json` are committed
under `gallery-support/` with local paths scrubbed and no PPTX outputs or
logs. `support-status.json` has one record per measured value (793) and is
regenerated by `build-support-status.mjs`. The README re-run commands work from
a fresh workspace. Text and spec integrity checks pass.

Fix items do not block on FF-23: the audits are their evidence tool, not a
prerequisite. Every fix item (FF-24 to FF-37, FF-39) proves its result on the
fix heads, or
the merged heads, in the same or a follow-up PR. It re-runs the FF-23 presence
audits, reports the FF-38 parity before/after table, and updates
`gallery-support/support-status.json` and the affected rows of
[gallery-support.md](gallery-support.md).

**FF-24 Theme colors.** For each of the 14 color schemes and 4 themes, the
exported theme `clrScheme` equals the chosen scheme in all 12 slots (`dk1`,
`lt1`, `dk2`, `lt2`, `accent1` to `accent6`, `hlink`, `folHlink`), using a
documented mapping from OPF scheme roles. Fills, lines and text that resolve
from a scheme role are written as `a:schemeClr` for that slot, not
`a:srgbClr`; explicit literal colours stay literal. Preview and export still
agree slot for slot. Re-import maps the theme `clrScheme` back to the scheme:
the catalog id when it matches a record, otherwise inline colours. Audit
evidence: color-scheme and theme rows match 12/12 slots, with no "literal RGB"
reason and no re-import loss.

**FF-25 Backgrounds.** `geometric-pattern`, `abstract-shapes` and
`minimal-texture` map to three distinct OPF background values (a backward
compatible schema addition if needed). Pattern backgrounds export natively as
`a:pattFill` in `p:bg`, or, where no preset can represent the pattern, as a
documented image fill. Photo backgrounds export as `a:blipFill` in `p:bg` with
the image part. The gallery `photography` snippet includes an `assets` entry
for its image. Re-import returns the background type (pattern or image). Audit
evidence: backgrounds 6/6 `works`, 0 preview/export disagreements.

**FF-26 Image treatments.** `design.slideImage` exports as a native picture
(`p:pic`, or `a:blipFill` for the background position) with its image part.
The 15 gallery treatments map to distinct OPF values wherever OPF can express
them: position, fit or crop, crop rectangle, and shape masks such as ellipse
and rounded rectangle. Treatments OPF cannot express (for example duotone,
blur, device frame, cutout) are explicitly labeled unsupported on the gallery
item and in the support table instead of collapsing silently. Gallery snippets
include their image asset. Re-import keeps the image, and its crop or mask
where represented, or emits a specific diagnostic. Audit evidence: no
image-treatment row is `schema-only` or has "export adds no native picture";
every unsupported effect carries its label.

**FF-27 Headers and footers.** Slide number and date furniture export as
PowerPoint fields (`a:fld type="slidenum"`, and `type="datetime*"` matching the
chosen date format) inside OPF furniture shapes, not `p:hf`, so they renumber
and update in PowerPoint (confirmed in the FF-12 native sample). The three
slot collisions (`dated-footer`, `client-delivery-footer`,
`version-control-footer`) place date and slide number in separate slots. The
gallery snippet emits `hideOnTitleSlide` (slide-level furniture off),
slide-number formats, date formats and the legal line. Re-import keeps the
furniture without `invalid-furniture-provenance`. Audit evidence:
headers-footers 10/10 `works`, and `slide-number-only` and
`slide-number-progress` emit different OPF.

**FF-28 Narrative and audience parity.** Every gallery narrative and audience
id exists in the core catalogs, or the gallery is reduced to core ids with the
mapping recorded (for example `executive` to `executives`). The validator and
lint warn on an unknown audience id, as they already do for narratives.
Content blocks then resolve their narrative references. Audit evidence: 0
`gallery-only` narratives and audiences, and no content-block row with
`unresolved references: narrative:*`.

**FF-29 Layout parity and export fidelity.** The core catalog contains every
gallery canonical layout id (415 today, 30 in core), or the gallery is reduced
to core ids; the 70 legacy slugs are mapped to canonical ids or retired. The
110 layouts that change the preview also drive PPTX shape placement.
Re-import retains the layout id, or emits a specific diagnostic naming the
layout it could not recover; it never drops it silently (81 today). Audit
evidence: 0 `gallery-only` layouts, 0 preview/export disagreements, and no
"re-import drops layout id" reason without a layout-specific diagnostic.

**FF-30 Content-block text.** `market-opportunity` and `financial-snapshot`
show every metric string of their gallery content (1 and 4 strings are missing
today, for example "Revenue +22%") in the preview and as native text in the
export, without `text-overflow`. `quote-slide` keeps its `quote` payload kind
on re-import or emits a specific diagnostic. Audit evidence: no content-block
row reports missing expected strings or lost payload kinds.

**FF-31 Font provisioning (owner font policy).**
- A policy table in core lists every font family used by a catalog font
  scheme, theme or language. For each it records the license class and one of
  two routes:
  - *open*: the family is bundled by opf-render (package, version, hash,
    license notice);
  - *licensed*: the shipped open replacement used for rendering (for example
    Aptos or Calibri to Carlito), with its metric or visual compatibility tier.
- The table is machine-checked against the catalogs, so a new scheme font
  without a route fails CI.
- The preview renders every scheme with its bundled family or its shipped
  replacement, with no host fonts. Strict mode throws only for a family
  outside the table. Today 92 of 93 font schemes throw under the strict pack.
  Script coverage is shared with FF-19.
- The PPTX always references the real font name, never the replacement.
  Licensed (proprietary) fonts are never bundled or embedded. Open fonts are
  bundled, and they may be embedded only through the explicit FF-13 embed
  path. With any registry and substitution policy,
  `toPptx` writes the chosen families and only reports substitutions. Tests
  cover the 7 schemes that substitute today (`aptos`, `calibri`, `consolas`,
  `courier-new`, `georgia`, `tahoma`, `times-new-roman`) and the `minimal`
  theme.
- The default `aptos` scheme (FF-35) follows the same policy. The docs state
  that Aptos and Aptos Display are not openly licensed, which replacement
  renders them, and that the PPTX keeps the name `Aptos`.
- [Font fidelity](../../font-fidelity.md) documents the policy, strict-mode
  behaviour, and cloud/serverless guidance for export, preview and raster
  output with no system fonts.
- Audit evidence: "export w/ office registry" equals the chosen family for all
  93 font schemes. No font scheme is host-only. Open families no longer fail
  the registry probe.

**FF-32 Re-import.** `fromPptx` of an exporter-written deck recovers the color
scheme, font scheme, theme and language (from the theme `clrScheme` and
`fontScheme`, run `lang`, or an exporter-written custom property), or emits one
specific diagnostic per dropped field that names it. Authoring metadata the
exporter does not carry (narrative, tone, audience, organization, speaker)
produces a specific diagnostic instead of disappearing silently. Audit
evidence: audit B re-import rows list the retained keys or named diagnostics,
and no "dropped silently" reason remains.

**FF-33 Gallery snippet and editor parity.** For every dimension, the gallery
"OPF Config" snippet and `/editor?config=<dimension>:<slug>` emit the selected
value. Two slugs never produce the same document unless the support table
labels them equivalent. Today the editor path uses the generic builder for
headers/footers, image treatments and content blocks, and the snippets drop
header/footer options. A gallery test compares snippet and editor output per
slug. Audit evidence: no "identical OPF" or slug-agnostic editor reasons
remain.

**FF-34 Socials.** Either (a) socials render: handles format to the platform
URL and icon in preview and export, as the social-platform schema describes,
and any platform size or aspect ratio the gallery offers produces that slide
size; or (b) the docs and the social-platform schema description state that
socials are authoring-only, and the gallery labels them so. The decision is
recorded. Audit evidence: socials rows match the chosen option.

**FF-35 Shared default font scheme.** Owner decision (2026-09-23, option A):
one shared default, `aptos`, so preview equals export. Core pagination,
opf-render, opf-editor, opf-pptx and the FF-18 script-font resolver use the
same exported default font scheme (`DEFAULT_FONT_SCHEME`) when a document and
its theme have none.
`spec/reference/engine-defaults.json` is reconciled: the Latin default is
`aptos` for PPTX, and the `google` target keeps `roboto` only for a future
Google exporter. `docs/design-resolution.md` is updated. Tests pin
preview/export parity for a custom theme without a font scheme. Font
availability and licensing for Aptos are handled by FF-31.

**FF-22b Chart follow-up.** The kept Aspose.Slides chart types export
natively, including `chartex` types such as treemap, sunburst, histogram,
box-and-whisker, funnel and waterfall, and the renderer covers every kept type.
Parity rows for charts pass their text and typeface checks.

**FF-24b Theme-colour follow-up.** The items the opf-pptx#67 review deferred
are fixed, and the audit color-scheme and theme rows show no remaining
theme-colour reason.

**FF-35b Unknown-scheme fallback.** A font scheme id that no catalog resolves
falls back to the shared default `aptos` (or emits a diagnostic) in every
engine; no Roboto literal remains. Tests pin it per engine.

**FF-36 Gallery support status (internal).** Re-scoped by owner decision
(2026-09-30): the measured status is internal to OpenPresentation/opf and
pptx.gallery does not display it; the paragraph below is the original
2026-09-23 scope, kept as history. Original owner decision (2026-09-23): each
pptx.gallery item shows its measured support status (works, partial,
preview-only, schema-only, authoring-only or gallery-only), read from a
versioned machine-readable file derived from
`gallery-support/support-status.json`. The mapping from audit statuses is
documented (`authoring-metadata` shows as authoring-only; `previewOnly` shows
as preview-only; `broken`, if ever measured, has a badge too). Badge text and
definitions link to [gallery-support.md](gallery-support.md). The file is
regenerated by re-running the FF-23 audit. Nothing is deployed in this
program. The badges shown on the live site become accurate only after a
release owner publishes the packages they describe (FF-15). Until then, the
in-program proof is the badge data together with the FF-38 parity audit on
merged heads.

**FF-37 First-class catalog.** pptx.gallery is an OPF catalog like the core
ones:
- Every catalog spec URL that documents resolve against (for example
  `https://www.pptx.gallery/tones`, and the per-kind sources named in the
  schemas) serves records that validate against the matching core schema.
- Core bundles a pinned snapshot of those records, recording the source commit
  and a hash. A drift check fails CI when the live or pinned gallery data and
  the core snapshot disagree, except for changes that are explicitly
  acknowledged.
- Gallery-only ids are either added to core or retired, with the mapping
  recorded (this overlaps FF-28 and FF-29).
- Nothing is deployed in this program. The URL checks run against a local
  build or a recorded fixture.

**FF-38 Parity audit and scoreboard.**
- A harness under `gallery-support/parity/` builds each gallery value's OPF
  Config document, charts included. It compares the traced preview with the
  exported PPTX element by element and classifies each value as `perfect`,
  `near` or `mismatch`.
- It uses ten checks: geometry within 0.02 pt (0.5 pt near), text and runs
  including script-slot fonts, fills and images, z-order, slide size, package
  typefaces, re-import, font resolution, theme, and shape mapping. They are
  defined in [gallery-support.md](gallery-support.md#parity-scoreboard).
- Scripts, run and build commands, `parity-results.json` and `PARITY.md` are
  committed with local paths scrubbed.
- `support-status.json` carries a per-item `parity` field (`status`,
  `failedChecks`, `nearChecks`, `topReasons`), with `parityOnly` for charts.
- The headline metric (perfect / total) is recorded in this tracker. The
  baseline is 0 of 900.
- `run.ps1 -Baseline` produces a before/after table for fix PRs.
- Running it in CI across operating systems belongs to FF-10.

**FF-39 Alignment parity.** Preview and PPTX agree on paragraph alignment and
text-line anchors for every gallery value:
- no "alignment ctr (preview) vs l (pptx)" (504 values at baseline) and no
  reverse mismatches (36 layouts);
- no text-line anchor-x delta beyond the 0.02 pt geometry tolerance;
- table frames equal the composed box.

The fix is in the layer that diverges (exporter paragraph alignment or the
preview anchor), without relaxing a tolerance. Audit evidence: the FF-38
before/after table shows no alignment or anchor-x reasons, and the geometry
and text pass counts rise accordingly.

**FF-40 Per-font tracker.** `font-tracker.json` has one record per family: the 157 font-policy families (the 153 the owner reviewed plus the four Intos rows added by opf#166) plus the seven shipped script-font dependencies that the policy lacks, with the five special families (Cambria Math, Segoe UI Emoji, Symbol, Webdings, Wingdings) flagged. Each record carries the selected name and its PPTX retention, the preview route and tier with alternates, the bundled face (package, version or commit, license, SHA-256 per face, available styles), the styles required and missing, scripts, per-style measurements with corpus, date and source (or `null`), host verification (Node, browser, editor, gallery editor and gallery cards, recorded separately), acceptance records with evidence and date, native verification, parity signals (values affected, current fontResolution status), phase, status, next action, evidence links and a priority score. Aptos and Aptos Display rank first (704 of the 850 audited values each); priority counts only values that are not already real or pass and discounts hosts with per-family verification. `font-tracker.md` is generated, grouped by phase and class and sorted by priority, and quotes the owner's five-phase plan and rules and a "reconciled with current state" note. `scripts/build-font-tracker.mjs --check` runs in `pnpm test` and fails on drift, on a policy family without a record and on a record for a missing family. The render manifest input is a committed pinned snapshot with its source commit, so core tests never need the sibling repository. No record claims acceptance without per-family evidence, and source, installed-package and live-site claims stay separate. The tracker stays live: later font PRs update the overrides file, the manifest snapshot or the parity source and regenerate.

**FF-41 Host loading and style coverage.** For every family with a bundled route face, the shipped editor, gallery editor, browser and Node hosts load the intended face, with no unintended fallback, and the required styles. Proof is a per-family fixture that renders the family in each host and compares the drawn face and shaped advances (within 0.1 px, as the base-face evidence does); the tracker's host verification moves from `unverified` to `verified` only with that evidence. Missing styles (for example Red Hat Display 600 and italics, Red Hat Text italics) come from pinned, permitted files (OFL-1.1, Apache-2.0, MIT or UFL-1.0, unmodified upstream where a Reserved Font Name applies) or stay recorded explicit gaps with a diagnostic; a synthesized style never counts. Families without a bundle (Anton, Archivo Narrow, Barlow, Bitter, EB Garamond, Figtree, Libre Caslon Text, Work Sans, Liberation Mono, Sans and Serif) are bundled or their fallback stays explicit. Playfair Display and Raleway are resolved with upstream static files, supported variable rendering or permitted renamed instances, with distinct weights proven, or stay explicit gaps. The seven script dependencies get policy rows. The unchanged parity audit is rerun so stale `missing` readings are replaced.

**FF-42 Aptos family compatibility.** Aptos and Aptos Display are measured and qualified separately, as are Aptos Narrow, Aptos Serif and Aptos Mono. A candidate is adopted only when it has per-style measurements in all four styles (mean below 0.1% and maximum at most 0.3% on the corpus), matching line breaks and line metrics (hhea, OS/2, x-height and cap-height), unchanged geometry tolerances, original outlines, a permitted pinned license with no unmodified-name conflict, and a family name that is not the original's trademark. It loads in Node, browser, editor and gallery and never changes the PPTX name. The previous replacement stays as an alternate. Rejected candidates (Selawik for Segoe UI) are recorded with their measurements. The unchanged parity audit is rerun on the merged heads and the values affected (704 each for Aptos and Aptos Display) are reported.

**FF-43 Remaining Latin replacements.** Each of the 46 proprietary Latin families outside the Aptos family (the 51 proprietary Latin families less the five that FF-42 covers) has its own fixture and acceptance record; grouped work does not transfer acceptance. Metric qualification needs per-style measurements, matching line breaks and line metrics and unchanged geometry tolerances, not a favourable average width. The established metric routes (Arial, Calibri, Courier New, Times New Roman, Georgia) get fresh four-style regressions in each host. Every other family is either qualified against its actual reference version or documented as a visual look-alike with its measured gaps. Packaging (FF-41), metric compatibility and appearance are separate deliverables.

**FF-44 Script replacements and shaping corpora.** The Latin-only corpus is extended with script-specific text per script (joining and marks, RTL and punctuation, conjuncts and vowel placement, stacked marks and line breaks, mixed Latin text). Each of the 41 proprietary script families, the 23 open Noto script families and the seven shipped dependencies has its own fixture, host-loading proof and native-script measurements, and a native PowerPoint comparison through FF-46. Most script packs ship regular and bold only; required italics or other styles need genuine qualified faces, and diagnostics preserve honesty but do not complete a fidelity requirement. Serif-styled originals (MS Mincho, SimSun, FangSong, MingLiU, PMingLiU, Batang, Gungsuh and others) get a qualified serif candidate or a documented visual gap.

**FF-45 Special families.** Each of Cambria Math, Segoe UI Emoji, Symbol, Webdings and Wingdings has its own path with permitted fonts: math-aware layout and export for Cambria Math, a color-emoji path with ZWJ sequences, variation selectors and skin tones, and reversible version-specific character-to-glyph mappings for Symbol, Webdings and Wingdings with exhaustive code, advance, bounds, export and round-trip tests. The PPTX retains the original font names and codes. Each has browser, raster and native evidence.

**FF-46 Native font verification.** For every family a bounded native PowerPoint sample confirms the selected name in the file and the drawn behaviour, kept separate from source, installed-package and live-site claims. It runs after FF-41 to FF-45 and includes CJK and right-to-left samples (FF-12). The full parity audit is rerun on the merged heads and the tracker is regenerated. Root alone owns Office; no in-place native retries; original failed observations stay intact.

**FF-47 Next goal tracker.** Records the owner's 2026-09-30 goal (100% `works`, verbatim in the README), its definition of done (all 819 gallery configs pipeline status `works`, measured on published packages, internal only) and the font-policy rule for the audits. Adds this item range, the baseline headline (427 of 819, per dimension) and `pnpm report:works` (`gallery-support/works-percent.mjs`, `--reasons`, `--json`, unit test in `pnpm test`). Done when the PR merges. It changes no audit, gate or tolerance and adds nothing public: nothing here appears on pptx.gallery.

**FF-48 Audit host model and font policy.** Audits A and B (and `build-support-status.mjs`) classify preview font availability the way the shipped hosts behave, as FF-38 does with `PARITY_FONT_HOST=gallery` (the gallery editor's font gate with the FF-31 policy table), instead of a strict no-host preview. A config whose preview draws a policy-table look-alike (metric-compatible or visual-only) and whose PPTX writes the selected family is `works` on font availability. The reasons "preview needs office-pack substitution", "no bundled or substitute face: strict preview throws font-unavailable", "non-Latin textSample: strict font-unavailable" and "language font scheme X not bundled" then no longer count as gaps. A family with no shipped replacement, a replacement that fails to load in the modelled host, or an export that names a family other than the selected one stays a gap. Expected effect: themes 4 lose their only reason (the Intos, Figtree, Source Sans 3, Barlow and Anton substitutions); the font-availability reasons of the 93 font schemes and 93 languages clear, leaving the reasons FF-49 and FF-50 fix. The PR lists before and after counts per reason and per dimension, and each reason it removes cites the policy-table row. No tolerance, no perfect/near definition and no export or re-import check changes, and the strict-host result stays available as a diagnostic option. Evidence is the regenerated `support-status.json` and `pnpm report:works --reasons`. Result (2026-09-30, published set): themes 4 of 4 `works`; every font-availability reason of the font schemes (92 carried one), languages (93) and themes (4) clears on the gallery host model; the strict model on the same heads still gives 427 and the same reasons; on the old heads the gallery model still reported Raleway, Playfair Display and Noto Sans Mongolian as real gaps, which opf-render 0.11.4 clears; audit A unchanged (548 of 548 drawable). Font schemes and languages stay 0 of 93 until FF-49 and FF-50.

**FF-49 Theme `ea`/`cs` typefaces.** Every font scheme (93 of 93, plus the two language values whose `cs` slot is empty) exports non-empty `a:ea` and `a:cs` typefaces in both the major and the minor theme font. The values come from the scheme's script fonts: the `eastAsian`/`complexScript` slots of the font scheme where set, otherwise the default named in [script-font-model.md](script-font-model.md) (the PR states which default it uses and why, and records it there). Each named family is in the FF-31 policy table (open, or licensed with a shipped replacement), the output is deterministic and independent of host fonts, run-level slots are unchanged, and re-import retains the scheme. FF-05 (the Aptos origin, still open) and FF-08 (empty values must be allowed by FF-05) are respected: no run or theme part gains a font the user did not select, and native confirmation of the written slots is a root-only FF-12/FF-46 gate, not claimed here. Expected effect: the "theme major/minor ea or cs typeface is empty" reason clears for 93 font schemes and 2 languages.

**FF-50 Language contract.** The contract is written into the spec docs and [script-font-model.md](script-font-model.md) (Model C): a language sets `lang`, direction and the script slots (`ea`/`cs` fonts, and the layout of mixed-script text), never the Latin scheme; the deck's `design.fontScheme` alone sets the Latin fonts. The engines implement exactly that: export writes the language's script font in the slot its script uses and `lang` on runs; the preview loads the script faces through the shipped host and draws the native-name sample. Audit B's language classifier stops expecting the engines to "derive the font scheme from language alone" and measures the contract instead: slot fonts named, direction, `lang`, glyphs present under the modelled host (FF-48), re-import keeps the language. The "bundled Roboto lacks the script" reason then applies only when the script face itself is missing. Expected effect: all 93 languages `works`. The PR records the decision in the README Decisions (the owner can veto it before merge) and changes no schema field.

**FF-51 Layout placement.** Export shape placement uses the layout the preview uses, within the existing tolerances (native 0.02 pt), for every layout the audit flags: 50 `partial` layouts and 7 `gallery-only` layouts carry "export shape placement ignores layout that changes preview". The fix is in the exporter (or in the preview where the preview is the wrong one), not a tolerance change; each flagged id gets a regression fixture, and the FF-38 geometry check stays at 850 of 850. Expected effect: those reasons clear; layouts `works` rises by up to 50 before FF-55.

**FF-52 Distinguishing geometry.** For each layout the audit reports as "geometry identical to the no-layout default in both preview and export" (40 `partial`, 23 `gallery-only`) or "preview identical with and without layout" (4 `partial`, 2 `gallery-only`), either the catalog record gains the geometry that makes it distinct (a contract or catalog fix in core, published through the FF-37 path), or it is merged into an existing id as an alias with a redirect. A layout that is the default itself may be listed by name in the audit as its own baseline; that classifier change is reviewed like any other and the list is exact, not a pattern. Merging or retiring a gallery id changes ids that people may use and the denominator, so it needs an owner decision recorded here before it merges; default to fixing the catalog. Expected effect: 43 `partial` layouts (and 25 `gallery-only` ones once FF-55 lands) lose the reason.

**FF-53 Image payload re-import.** The 24 layouts whose sample carries an image payload (12 `partial`, 12 `gallery-only`; "re-import loses payload kinds image") re-import with the `image` payload retained (source, alt text, position role), not dropped or turned into a diagnostic. Exporter and importer round-trip fixtures cover each affected layout family; a lost payload is never passed off by relaxing the audit's re-import check. Expected effect: those reasons clear.

**FF-54 Sample overflow.** The gallery's sample content for the 18 layouts with "text-overflow" or "small-cell" diagnostics (12 with both, 6 text-overflow only) fits the layout in preview and export without the diagnostic. The fix is sample text or the layout's region size in the owning repository; lint or diagnostic suppression, tolerance changes and shrinking fonts below the layout's floor are not acceptable. Expected effect: those reasons clear.

**FF-55 Legacy layout slugs.** Each of the 70 legacy gallery layout slugs ("no OPF canonical id; portable only via inline `catalogs.layouts.records`") has a canonical OPF id in the core layout catalog, published through the FF-37 publisher with the pinned snapshot drift check passing, so `inCoreCatalog` is true and the config reports its measured class. Of the 70, 25 already measure `works` and 45 `partial`; the 45 also need FF-51, FF-52, FF-53 and FF-57. Retiring a slug with a redirect instead is possible only with an owner decision recorded here, and the headline then states the changed denominator. Default: publish ids, retire nothing. Expected effect: 70 `gallery-only` become their measured class, 25 of them `works` immediately.

**FF-56 Chartex default.** The seven chartex chart ids (`treemap`, `histogram`, `pareto`, `world`, `box-and-whisker`, `waterfall`, `funnel`) are `works` by the audit: the native chartex export is the default (`toPptx` no longer needs `chartex: 'native'`), and this happens only after the root owner's native PowerPoint check of the constructs passes (FF-22b, FF-12). The preview draws them natively (opf-render#66, reported published in opf-render 0.11.4; verify at pickup) and the audit reads `chartEx` parts instead of the clustered-column fallback frame. Re-import returns the same id and data with no `chart-data-adapted` diagnostic. Root alone owns Office; a failed native check keeps the default and is recorded as evidence, and the owner is told the goal cannot reach 100% for these seven without a decision. Expected effect: charts 26 of 26.

**FF-57 Quote re-import.** The `quote` payload (text and attribution) is retained on re-import for the `quote-slide` content block (1 `partial`) and for the layouts whose sample carries a quote (1 `partial`, 2 `gallery-only`). Round-trip fixtures cover the quote layouts; no audit relaxation. Expected effect: blocks 32 of 32.

**FF-58 Goal closure.** The audits A and B are re-run on published packages (the npm releases of opf-render, opf-pptx and opf-editor that carry FF-49 to FF-57, plus the pptx-gallery main consuming them; publishing is a separate release task per [release-process.md](../../release-process.md)), and `support-status.json` is regenerated. `pnpm report:works` prints 819 of 819 `works` (or the new denominator with the recorded owner decision from FF-52 or FF-55), every dimension is 100%, and no config has a reason. [gallery-support.md](gallery-support.md), the headline and the progress log are updated. The FF-38 parity results are recorded next to it as separate evidence; parity tiers are not required to be perfect for this goal. No gate or tolerance was relaxed, and nothing about support or progress is shown on pptx.gallery.

## Progress log

Append one dated line per state change. Newest last.

- 2026-09-22: FF-R0 done. Mixed-size edit/save/reopen passed (opf#114). First
  Carlito-only embed attempt failed closed on `Aptos` (opf#115).
- 2026-09-23: Program opened. FF-01 merged (opf-pptx#57). FF-02, FF-03 and
  FF-06 started by parallel agents. FF-00 in review. FF-16 added after the
  tracker review; FF-08/FF-09 cycle removed.
- 2026-09-23: FF-17, FF-18, FF-20 and FF-21 started by parallel agents.
- 2026-09-23: FF-06 brief and Aptos research brief committed. FF-17 to FF-21
  added and FF-07 to FF-12 criteria sharpened from the FF-06 findings.
- 2026-09-23: FF-00 done (core tracker plus sibling AGENTS.md merged). FF-06 done
  with the tracker. FF-21 done (macOS job confirms opf-render#24: Linux misses
  0.1 px on 5 of 5 rows, macOS on 0 of 5). FF-20 first bump merged; the sibling
  repos' own CI pins still lag. FF-02, FF-03 and FF-18 in review.
- 2026-09-23: FF-23 in review: measured pptx.gallery support by dimension
  ([gallery-support.md](gallery-support.md)); 793 values across 13 dimensions,
  7 `works`. FF-22 (charts reduced to Aspose.Slides types) in progress. FF-24
  to FF-34 added for the measured gaps. Owner decisions: one shared default
  font scheme `aptos` (FF-35, in progress) and measured support badges on
  pptx.gallery (FF-36, in progress). FF-04 partial native result: at open,
  `Presentation.Fonts` lists a nameless font and `Aptos`, and filling theme
  `ea`/`cs` did not change it; FF-04 stays open until the second condition and
  the evidence bundle land.
- 2026-09-23: Owner set the program goal to perfect support for every
  pptx.gallery configuration; the README goal and definition of done are
  replaced. FF-37 (first-class catalog) and FF-38 (parity audit and
  scoreboard) added, both in progress. FF-26 (engine side), FF-29 and FF-31
  (owner font policy) are in progress. Headline metric: parity-passing items
  over all items; presence baseline 7/793, parity baseline to be set by FF-38.
- 2026-09-23: FF-38 in review with opf#122: the parity harness and baseline are
  committed under `gallery-support/parity/`. 0 of 900 values are perfect.
  Checks passed: slideSize 900, mapping 890, zOrder 880, fills 842, geometry
  378, text 273, fontResolution 5, typefaces 0, theme 0, re-import 0. Five
  universal blockers are mapped to FF-32, FF-08, FF-24, FF-31 and FF-39.
  FF-39 (alignment parity) is in progress. `support-status.json` gains a
  per-item `parity` field and section anchors.
- 2026-09-23: FF-18 done (opf#118). FF-35 done (opf#124, opf-render#33,
  opf-editor#31, opf-pptx#64): every engine falls back to `aptos`; the
  font-flow map G10 is resolved, and FF-35b tracks the remaining Roboto literal
  for unknown schemes. FF-28 in review (opf#123; audit A content blocks 5 to 29
  `works`). FF-30 and FF-33 in review (pptx-gallery#44 and #45; combined with
  a modified harness, content blocks 31/32 and image treatments 6/15); gallery
  CI is blocked by Actions billing.
- 2026-09-23: Tracker reconciled with open and merged PRs.
  - Done: FF-03 (opf-pptx#59), FF-17 (opf#120, opf-pptx#61, opf-editor#30),
    FF-24 (opf-pptx#67) and FF-28 (opf#123).
  - FF-22: core half merged (opf#121); gallery half open (pptx-gallery#40).
  - In review with linked PRs: FF-07, FF-08, FF-25, FF-26, FF-31, FF-32,
    FF-34, FF-36, FF-37, FF-38 and FF-39. FF-02 hardening is in opf-pptx#62.
  - FF-22b and FF-24b added as follow-ups.
  - Font-policy wording corrected: licensed fonts are never bundled or
    embedded, and open fonts may be embedded only through FF-13.
  - Release dependency recorded: a live, badge-accurate gallery needs a
    release. In-program proof is the parity audit on merged heads.
  - Counts: done 11, review 16, in progress
    5, todo 12 (44 rows).
- 2026-09-23: FF-38 harness fixes, recorded in opf#122:
  - Relationship targets resolve per OPC rules, so chart parts are found.
  - Single text lines are compared by rendered extent, so metric lines no
    longer fail geometry.
  - Re-run on current mains (opf `c278532`, opf-render `47d19b2`, opf-pptx
    `5b657c9`, pptx-gallery `f17e9ae`): still 0 of 900 perfect.
  - Checks passed: geometry 390, text 326, fills 734 (chart colours are now
    compared), theme 900 (FF-24), typefaces 0, re-import 0, font resolution 5.
  - The baseline report is kept under `gallery-support/parity/history/`.
- 2026-09-23: FF-39 renderer half merged (opf-render#37); the exporter half
  (opf-pptx#72) is still in review.
- 2026-09-23: Tracker reconciled after the FF-20, FF-25, FF-26, FF-27 and FF-34
  merges, with the parity and presence audits re-run on current mains (opf
  `a74f3f6`, opf-render `bc436f3`, opf-pptx `9092954`, pptx-gallery
  `f17e9ae`).
  - Done: FF-02, FF-19, FF-20, FF-23, FF-32, FF-35b and FF-38.
  - All PRs merged but kept in review: FF-07 and FF-08 (pending FF-05 native
    root-cause evidence) and FF-39 (39 values still report "alignment l
    (preview) vs ctr (pptx)").
  - Engine PRs merged, gallery half open: FF-25, FF-26, FF-27 and FF-34. FF-22b,
    FF-24b, FF-29 and FF-31 are in review.
  - Parity: 4 of 900 perfect (`calibri`, `courier-new`,
    `times-new-roman`, `roboto`). Checks passed: geometry 774 (was 390),
    text 759 (326), fills 674 (734), zOrder 784 (880), slideSize 900,
    typefaces 900 (0), re-import 899 (0), font resolution 5, theme 900,
    mapping 672 (890). Alignment is reduced but not cleared: 39 values
    still report "alignment l (preview) vs ctr (pptx)".
  - Fills 842 to 734 at opf#122 was the chart-colour comparison starting to
    run (108 values fail only on it), not a regression. The new mapping,
    z-order and fills failures follow the FF-26 slide image; the harness does
    not map `OPF slide image` names. See the
    [measurement notes](gallery-support.md#measurement-notes-2026-09-23-re-run).
  - Presence: 362 of 793 `works`. Socials 10/10 `works`, image treatments
    15/15 `partial`, headers/footers 1/10 `works`, backgrounds 2/6
    (`photography` with its asset `works`). Audit B marks all colour schemes
    and themes `broken` because its probes predate FF-24.
  - Counts: done 18, review 16, todo 10 (44 rows).
- 2026-09-23: Parity harness maps the FF-26 slide-image picture
  (`OPF slide image slides.N`) to the preview slide-image group and compares
  its visible image rect; no tolerance changed. Re-run at opf `7f88749`,
  opf-render `bc436f3`, opf-pptx `9092954`, pptx-gallery `f17e9ae`: still 4
  of 900 perfect; mapping 890 (was 672), geometry 880 (774), fills 766 (674),
  zOrder 880 (784), no value regressed. The 225 affected values matched the
  preview exactly (0 pt, identical bytes); the drop at opf#137 was a harness
  gap, not an export difference.
- 2026-09-23: Parity harness review follow-up. Geometry now fails any
  non-finite delta or box (for example a crop with `l+r` of 100000 or more),
  and every picture gets a crop-position check against the preview's
  `preserveAspectRatio` placement at the same 0.02 pt. Re-run at opf
  `b1753ef`, opf-render `bc436f3`, opf-pptx `9092954`, pptx-gallery
  `f17e9ae`: no check or class changed (4 of 900 perfect, geometry 880);
  19 cropped-image values now record a maximum delta of 0.001 to 0.004 pt
  (srcRect quantization).
- 2026-09-23: Parity harness never skips the crop-position check silently.
  Preview image sizes are read for PNG, GIF, JPEG (with EXIF orientation),
  WebP and SVG; a picture whose size is still unknown gets a near
  `picture crop unmeasured`, counted in `meta.cropCheck` (408 of 408 measured
  at opf `6263985`, opf-render `bc436f3`, opf-pptx `9092954`, pptx-gallery
  `f17e9ae`). The frame check honours `meet` alignment. No check, class or
  reported difference changed.
- 2026-09-23: FF-36 audit probes. Audit B resolves `a:schemeClr` through the
  exported theme and compares colours with the preview slide by slide; languages and every
  other audit B reason are derived from measured fields; audit A finds the
  `OPF slide image slides.N` picture and checks its frame and crop against
  the preview. Re-run at opf `33d636d`, opf-render `bc436f3`, opf-pptx
  `9092954`, pptx-gallery `f17e9ae`: colour schemes 14 and themes 4 move
  from `broken` to `partial`, languages 93 from `schema-only` to `partial`,
  socials 10 from `works` to `partial` (no handle rendered), image
  treatments with assets 2 `works` (was 0). Presence 352 of 793 `works`.
- 2026-09-23: FF-36 audit hardening. Audit B resolves slide colours per
  slide through slide, layout, master and theme relationships (layout
  `clrMapOvr` applied; unresolved links are reasons), socials look for the
  handle only in slide, layout and master XML, and audit A reports
  "slide-image probe not run" instead of passing a null probe. Re-run at opf
  `1ad25df`, opf-render `bc436f3`, opf-pptx `9092954`, pptx-gallery
  `f17e9ae`: no class changed (352 of 793 `works`); only the socials reason
  text changed.

- 2026-09-29: Resumed from fresh fetched main worktrees: opf `d3397502`,
  opf-pptx `90929546`, opf-render `6c7d7818`, opf-editor `214ae695`, and
  pptx-gallery `f17e9ae5`. Existing worktrees and historical evidence preserved.
  - FF-04: the missing no-temporary-font inventory ran once in a freshly
    inspected PowerPoint session, on the canonical unedited fixture. Its
    observational audit passed with zero failures, source unchanged and one
    confirmed owned close. Aptos and an empty-name font entry were present
    before editing. Historical with-temp and exporter-control audits now have
    passing v2 sidecars; original failed audits remain preserved.
    The independently reviewed portable bundle is published by opf#145;
    its merge completes FF-04 (19 done, 16 review/in-progress, 9 todo).
  - FF-05 remains open: the inventory narrows the hypotheses, without locating
    the exact style/part or identifying which physical font drew a glyph.
  - FF-29: independent review reproduced hidden media in privacy modes, stale
    hyperlinks, slide-reorder loss (#78), and malformed recovered layouts
    crashing rendering (#79). Isolated fixes and regression tests are under
    review; previous green CI alone was insufficient to merge these heads.
    PPTX79 subsequently passed Linux/Windows CI at `ab0fc1d` and merged as
    `0424d561`. PPTX78's combined fixes passed full local and six browser
    suites; final-head CI is required after reconciling the squash-merge
    ancestry (`ede5ca7`, unchanged tested tree `d3ddb6d`).
  - FF-31 and FF-29 rows now identify engine PRs that had already merged.
    At this initial continuation checkpoint, no fresh FF-38 scoreboard was
    claimed; the later September 29 audit receipt follows below.
  - Node 24.21.0 and pnpm 10.33.2 used. Initial PowerShell module-path and
    nested pnpm PATH failures are preserved with successful process-local
    corrections; no global security or tooling settings changed. No publish,
    deployment, native p:hf work, or tolerance changes.

- 2026-09-29: FF-38 unchanged full 900-value audit on the accepted merged graph
  completed at `2026-09-29T08:23:46.429Z`: core
  `a85facf11d7b99102ca801885c5afaa783d1c800`, renderer
  `6c7d7818e40d0f9c519e4b34f7a24e9150c1787f`, PPTX
  `c749c356b4fb5a5b5dfa77db8f1f7dd3c7daef63`, gallery
  `f17e9ae5869669d5fbac3720f285652d0c37551c`. Local raw receipt
  `baseline81-results.json` SHA-256
  `f2b427a0e1a2a835a404e73631963daaff60cee3996893f05008a318881dd6ee`;
  committed [results](gallery-support/parity/parity-results.json) SHA-256
  `c8896904457c582054ff588df7f77719e49c9d8dd55fcb58685777a6a886ca56`
  differs only by the [documented one-slug normalization](gallery-support/README.md#normalized-ids).
  The [scoreboard](gallery-support/parity/PARITY.md) records 5 perfect, 0 near, 895
  mismatch, up from 4 with no classification regressions. Text 798, fills
  790; `blocks/kpi-dashboard` is the fifth perfect value. PPTX79 and PPTX81
  are accepted; core145 merged as `a85facf`, completing FF-04. Editor
  `d0c95a1` was refreshed by a dependency-only merge and is not used by parity.
  - Candidate PPTX78 `7cc779129323af6123ef5e194226a545e743f195`, with the same
    other heads, completed at `2026-09-29T08:30:22.322Z`:
    local raw `candidate78-results.json` SHA-256
    `316e21129d57ec198de4f9e390f6962b96715b6cf8e4c361cb5dd2cfe30022fa`.
    It also measures 5 perfect, 0 near, 895 mismatch; text 799 and fills 791,
    with no classification change from the accepted baseline. Independent
    review, package tests and six browser suites pass; exact-head CI
    [36543078806](https://github.com/OpenPresentation/opf-pptx/actions/runs/36543078806)
    is pending at this checkpoint. PPTX80's old-base exact-caption and
    fallback-link findings were reconciled in PPTX78, not merged as-is.
  - Accepted headline excludes this candidate. No Office was used in either
    parity run; no native parity or new font acceptance is claimed. FF-29
    stays in review, FF-05 stays open, and counts remain 19 done, 16
    review/in-progress, 9 todo. September 23 presence values and dates are
    retained independently.

- 2026-09-29 09:01 UTC: FF-05 E6 ran once on the independently reviewed
  Calibri control, using PPTX `bf3f78f` and core `061499d`. All 17 explicit
  Carlito typeface attributes changed to Calibri; the other 38 ZIP entry contents,
  relationships and four empty theme ea/cs slots were unchanged. One owned
  read-only open/close completed under the 45-second deadline without
  temporary font registration. The current audit passed with zero failures,
  all input hashes unchanged; UI preflight/postflight showed Home without an
  open deck or dialog. `Presentation.Fonts` still reported an empty-name entry
  and Aptos while the nonempty inspected slide font names and theme Latin
  reported Calibri (`NameOther` remained empty).
  [Evidence](../../evidence/windows-native-calibri-control-20260929/README.md).
  This narrows Carlito-specific explanations, without proving a source,
  physical glyph identity, font allowlist or embedding. FF-05 moves from todo
  to in-progress: 19 done, 17 review/in-progress, 8 todo. Next: offline-reviewed
  style/part isolation before another bounded native control.
  - Wrap-up receipts: PPTX79 `0424d561`, PPTX81 `c749c35`, PPTX78 `bf3f78f`,
    core145 `a85facf` and core147 `061499d` merged after independent review and
    green CI. PPTX80 closed as superseded with its findings reconciled in78;
    its branch was preserved. No release, deployment or tolerance change.

- 2026-09-29 09:38 UTC: FF-05 E7 completed once on the independently reviewed
  [four-slot Calibri control](../../evidence/windows-native-explicit-slots-20260929/README.md),
  source `4e2bab2a4f5a0f09350d2edc2463bcb29302fa7db34a8c621e39fcd5c9a16cd7`.
  Only the four empty theme major/minor ea/cs attributes changed from E6;
  the other 40 ZIP entry contents and all relationships were preserved.
  The native audit passed with zero failures, one owned read-only open/close,
  unchanged inputs and no temporary registration. Helper time 1,227 ms under
  the 45-second deadline. All six theme names reported Calibri; the initial
  Fonts collection still contained the empty-name entry and Aptos. Empty theme
  slots are therefore unnecessary for this observation, without identifying a
  cause or proving glyph identity. UI preflight/postflight showed Home without
  an open presentation or dialog; running PowerPoint file/product version was
  `16.0.20430.20092`. Actual source graph: core `0e81a407`, PPTX `7fca9a2`,
  renderer `6c7d7818`, editor `d0c95a1`. FF-05 stays in progress and counts
  remain 19 done, 17 review/in-progress, 8 todo. Next: separately reviewed
  dual Fonts snapshots before/after the existing bounded content queries;
  no such harness or native run is part of this evidence.

- 2026-09-29: FF-11 moves from todo to in-progress for the bounded explicit ZIP
  timestamp repair in [opf-pptx#86](https://github.com/OpenPresentation/opf-pptx/pull/86),
  accepted `373dfa39688e787d861202e7a8069ebff7e8be36` with reviewed tree
  `2405fa1b86ac1abc034f14ab47e01bd8d38a56c2`. Original
  [Linux/Windows CI](https://github.com/OpenPresentation/opf-pptx/actions/runs/36570457498)
  passed source and fresh packed timezone controls; those dependency graphs
  remain distinct. Explicit `zipDate` uses UTC calendar fields in PPTX and nested
  workbooks, while omitted/undefined input preserves the established fixed
  output. Ambiguous/invalid explicit values reject at `options.zipDate`.
  - The combined core candidate pins that accepted source and runs the unchanged
    public timezone fixture against coordinated installed packages, alongside
    six renderer-absent furniture groups. Acceptance requires the full 41-stage
    protocol and comparison of eight local furniture PPTX files against frozen
    core154 Linux outputs; outcomes are recorded separately. Original
    accepted-main PPTX CI is audited independently.
  - Font availability/substitution, LANG/locale, broader OS/runtime/ICU and
    complete export determinism remain open; default behavior after a host TZ
    mutation is outside this bounded control. FF-27 remains in review. No Office,
    package publication, deployment or tolerance change; summary becomes
    19 done, 18 review/in-progress, 7 todo. The parity headline is unchanged.

- 2026-09-29: FF-10 foundation adds Windows/macOS installed-candidate jobs beside
  the existing Linux ecosystem lane. Candidate consumers explicitly install the
  core-locked test-only Node types and run TypeScript 5.9/7 in NodeNext/Bundler,
  retaining declaration containment and a real downstream-error control.
  Existing installed canvas/furniture rerender checks and the explicit
  no-system-font-discovery path are reused. Fresh original cross-OS CI and visual
  review are required; this is not the FF-09 font-switch matrix, installed FF-38
  parity, a physically fontless host, native fidelity or release acceptance.

- 2026-09-29 15:07 UTC: FF-05 E8 used the exact E7 input with
  [PPTX88](https://github.com/OpenPresentation/opf-pptx/pull/88) merged
  `9a7f3c1513c5875b4ac9d5974c04151a4ac26cbe`. One owned read-only open/close,
  303 stages, about 1,405 ms under the 45-second helper deadline, unchanged
  inputs and zero temporary registrations passed the observational audit.
  Both ordered Fonts collections and flags remained empty-name + Aptos before
  and after existing content reads. This proves stability only over that
  sequence/interval, not root cause, physical font identity, allowlist or
  embedding. [Evidence](../../evidence/windows-native-font-query-order-20260929/README.md).
  PowerPoint was freshly launched after sleep; its process differs from E7.
  Actual native source graph: core `9261eac5`, PPTX `9a7f3c1`, renderer
  `c62b3f9`, editor `d0c95a1`, gallery `f17e9ae5`.
  - The owner explicitly authorized independently reviewed merges after local
    tests during the Actions credit shortage. PPTX88 passed 22 focused groups,
    29 independent audit cases, source build/typecheck/validate/full tests,
    six browser suites and a fresh packed consumer. Registry and source
    dependency results remain separate; no remote CI pass is claimed here.
    Fidelity and native safety gates remain unchanged.
  - FF-05 remains in progress. Preserve the concurrently merged FF-10/FF-11
    work: summary stays 19 done, 19 review/in-progress, 6 todo and the dated
    parity headline stays 5/900. Next is offline style/part isolation review,
    not another unmodified inventory or an embed retry. No publish/deploy.

- 2026-09-29 16:14 UTC: Owner-authorized local-test merge batch accepted app52,
  app57, app58, app51, PPTX89, gallery37, site48 and gallery48 after independent
  source/evidence/visual review. [Runtime checkpoint](../../handoff-runtime-2026-09-29.md#local-acceptance-during-the-actions-credit-shortage)
  records exact acceptance scopes and [merge receipts](../../evidence/local-acceptance-merges-20260929/README.md).
  Original gallery45 closed as superseded, branch unchanged. Gallery44 stays
  held for five newly silent image losses; current-public socials/field options,
  geometry, native/font and release gates remain open. This is not a fresh full
  parity audit or completion of FF-09/FF-10/FF-14/FF-15/FF-26/FF-27/FF-33.
  The 19/19/6 item counts and dated 5/900 headline are unchanged.

- 2026-09-29 16:32 UTC: App56 dependency update accepted after fresh local
  737-unit, 13-standalone and 49-browser checks, build/type/audit and bounded
  MCP limit controls with independent visual and source review. The exact
  reviewed tree is retained in the same local merge receipts. This changes
  no program item status, native/font or release gate; counts remain 19/19/6.

- 2026-09-29 16:41 UTC: PPTX90 accepts supported current native body/list rich
  formatting after source, registry-backed, installed and browser checks with
  six reviewed previews. Original cross-shape authoring boundaries and FF-09
  remain open. Gallery49 accepts only the metric readability slice after 144
  units and 12 browser cases; original chart data and image refusals remain
  unchanged. Gallery44 image loss and quote reimport stay open. Exact merge
  receipts are linked above. No item status changes: counts stay 19/19/6 and
  the dated 5/900 parity headline is unchanged. No native/release completion.

- 2026-09-29: FF-40 in review: [font-tracker.md](font-tracker.md) records every font family (157 policy families, of which 153 were reviewed and four are the Intos rows from opf#166, and the seven shipped script-font dependencies missing from the policy) with route, bundled face, styles, measurements, host and native status, parity signals, phase, status and next action, sorted by priority (Aptos and Aptos Display first). FF-41 to FF-46 added from the owner's five-phase plan (todo, except FF-42 in progress: opf#166 merged, opf-render#54 and opf-editor#42 open). Summary is now 19 done, 21 review/in-progress, 11 todo; the dated 5/900 parity headline and all gates are unchanged. No native or release completion.

- 2026-09-29: FF-40 done (opf#174 merged `0b8e6de2`). The tracker is refreshed after the Intos merges: manifest snapshot at opf-render `d528be5` (50 packages, Intos bundled) and the parity run on the merged mains ([opf#175](https://github.com/OpenPresentation/opf/pull/175): 660 of 850 perfect, fontResolution 733 pass, 31 near, 86 fail). The Aptos family is `metric-measured` and passes all 704 values each for Aptos and Aptos Display, so it no longer leads the priority queue; Node and browser hosts are recorded verified for the Intos faces (opf-render aptos-preview and lazy-fonts-browser tests) and the editor for Aptos and Aptos Display (opf-editor playground-lazy-fonts), while the gallery editor waits for a release. FF-42 stays in progress (Aptos Mono unmeasured, no native verification). Summary is now 20 done, 20 review/in-progress, 11 todo. No native or release completion.

- 2026-09-29: FF-43 in review (opf-render#60, opf#178): the open replacement faces that policy routes to are bundled and the missing Red Hat styles completed. Barlow (400, 700, italics) and Anton (400) are google/fonts statics byte-identical at commit `23e54b51ddff`; Figtree, Work Sans, EB Garamond, Archivo Narrow, Bitter (400, 700, italics) and Libre Caslon Text (400, 400 italic, 700) are npm-derived `@expo-google-fonts` statics at exact versions (no Reserved Font Name); all OFL-1.1 from the shipped notice, `embed: "used"`, lazy in browser hosts, the eager list unchanged at 33 faces (28 new faces, 4.6 MiB uncompressed with the Red Hat additions, about 2.4 MB in the tarball). Red Hat Display now has 300, 400, 600, 700 with italics and Red Hat Text 400 and 700 with italics: the RedHatFont statics cannot be used (the Regular, Light and SemiBold italics (and Red Hat Text Italic) do not set the OS/2 italic bit (only the Bold Italic files do), Red Hat Display SemiBold declares weight 707 and Bold 799 (Red Hat Text Bold declares 700); a per-face resvg paint probe showed 600 painting as Bold and the regular and bold italics as one face), Red Hat has no Reserved Font Name, so the correctly labelled `@expo-google-fonts` instances replace them; the new per-face paint test proves all 70 open faces paint as themselves and distinctly. The 19 route faces are re-measured against the installed Windows originals (widths unchanged except Corbel and Gill Sans MT, which now follow the vendored Source Sans 3; vertical metrics and outline identity in `bundled-replacements-ff43-20260929.json`, 0 identical outlines): every row stays visual, none meets the metric bar. Bitter (Rockwell) is bundled as instanced statics: its Reserved Font Name is "Bitter Pro", the coordinator ruled that the OFL only bars a modified font from carrying the reserved name in its family or file name, and opf-render's license test now implements that rule (instanced faces named Carlito, Raleway, Lora or Playfair Display still fail). Libre Caslon Text has no bold italic upstream (explicit gap). Grandview, Grandview Display, Tenorite and Tenorite Display are not installed on the measuring host and stay unmeasured. The tracker is regenerated (manifest snapshot at the opf-render branch). FF-43 is in-progress, FF-41 stays todo. Summary is now 20 done, 21 review/in-progress, 10 todo. No native or release completion.

- 2026-09-29: Release checkpoint. opf-render 0.11.2 ([#64](https://github.com/OpenPresentation/opf-render/pull/64) `021cca0`, provenance), opf-pptx 0.11.1 ([#105](https://github.com/OpenPresentation/opf-pptx/pull/105) `0d15f1c`) and opf-editor 0.10.1 ([#47](https://github.com/OpenPresentation/opf-editor/pull/47) `4af6ea6`) are published on npm; core [opf#184](https://github.com/OpenPresentation/opf/pull/184) `55b7d45` carries the release plan for them, [opf#182](https://github.com/OpenPresentation/opf/pull/182) `3971791` the renderer 0.11.2 lazy font count and [opf#183](https://github.com/OpenPresentation/opf/pull/183) `a5b588b` the fast-uri 3.1.8 advisory fix. pptx.gallery consumes them ([#58](https://github.com/Data-Advantage/pptx-gallery/pull/58) `8d31596`, [#59](https://github.com/Data-Advantage/pptx-gallery/pull/59) `0f6064b`) and is deployed to production (Vercel success). The release and deploy were done by the release owner outside the program's own PRs; the invariant that program work does not publish or deploy is unchanged. FF-15 (release-readiness note), FF-14 and every native gate are not completed by this.

- 2026-09-29: FF-41 moves from todo to in-progress. [opf-editor#46](https://github.com/OpenPresentation/opf-editor/pull/46) `997b332` (font gate, released as 0.10.1) and [opf-render#63](https://github.com/OpenPresentation/opf-render/pull/63) `b5fdd1e` (0.11.2) merged, and the gallery editor now ships the gate ([pptx-gallery#59](https://github.com/Data-Advantage/pptx-gallery/pull/59) `0f6064b`). A live check on the deployed site confirmed that Aptos plus Japanese applied through Source renders in `/editor` with Noto Sans JP served same-origin and no font CDN request. FF-41 is broader than this: Liberation Mono, Sans and Serif, Playfair Display and Raleway, per-family per-host fixtures, tracker host verification and the parity re-run remain, and PPTX export uses slide 0's script profile for the whole deck. FF-19 gains its follow-up (still done); FF-42 and FF-43 rows updated for the merged packaging and editor release (statuses unchanged).

- 2026-09-29: pptx.gallery halves merged (statuses stay review, remaining criteria recorded in each row): FF-25 [#43](https://github.com/Data-Advantage/pptx-gallery/pull/43) `e32c7dc`, FF-34 [#42](https://github.com/Data-Advantage/pptx-gallery/pull/42) `1e1fadc`, FF-27 [#47](https://github.com/Data-Advantage/pptx-gallery/pull/47) `2bb4970`, FF-36 [#41](https://github.com/Data-Advantage/pptx-gallery/pull/41) `719274d`, and FF-30, FF-26 and FF-33 snippets in [#44](https://github.com/Data-Advantage/pptx-gallery/pull/44) `7498d1f`. FF-26 also gains the native watermark export ([opf-pptx#104](https://github.com/OpenPresentation/opf-pptx/pull/104) `72611c0`, released as 0.11.1). FF-22 gallery half ([pptx-gallery#40](https://github.com/Data-Advantage/pptx-gallery/pull/40) `23f9216`) is recorded as merged. None of these items moves to done: the FF-23 and FF-38 audits were not re-run on the merged heads, the support table sections are not updated, FF-36 still shows the 76 charts as pending, and FF-12 native confirmation of fields is not run. Counts are now 20 done, 22 review/in-progress, 9 todo. The dated parity headline is unchanged. No Office, tolerance or gate change.

- 2026-09-29 (local; UTC 2026-09-30 06:22): FF-23 and FF-38 audits re-run on the merged and published heads (core `930577d`, opf-render 0.11.2 `021cca0`, opf-pptx 0.11.1 `0d15f1c`, pptx-gallery `0b2dec8`, editor `4af6ea6`) in [opf#186](https://github.com/OpenPresentation/opf/pull/186), one local core for all engines, no Office. Parity is 657 perfect, 37 near, 156 mismatch of 850 (opf#175: 660, 33, 157; [PARITY-2026-09-29-merged-heads.md](gallery-support/parity/PARITY-2026-09-29-merged-heads.md)); presence is 379 of 793 `works` (352 before). One value improves (backgrounds `photography`); four regress, none in an engine: the watermark and the footer logo (the earlier snippets never emitted them; the harness could not map the `OPF watermark` and `OPF image N` pictures, now mapped, with an opacity check) and two slide-number formats (native field plus literal text is two runs where the preview draws one: near by construction). The harness as merged scores 653, 37 and 160. Audit A was updated for the current gallery contract (assets in the snippet, three distinct pattern presets, per-item editor builder, furniture measured on the slide that shows it, fixed dates checked as static text); its image-treatment probe cannot classify the composed snippets (`design.slideImage` is no longer used), so those 15 rows are retained from 2026-09-23. Rows: FF-22 and FF-25 move to done (audit evidence and support-table sections now hold); FF-26, FF-27, FF-30, FF-33, FF-34 and FF-36 stay in review with the evidence and the remaining criteria recorded in each row. Summary is now 22 done, 20 review/in-progress, 9 todo. No Office, tolerance, gate or publish change; native and release gates unchanged.
- 2026-09-30 (charts measured, owner defaults applied; core `aedd364`, opf-render 0.11.3 `a66caa3`, opf-pptx 0.11.2 `0400434`, pptx-gallery `b2238ac`, editor 0.10.2 `c7995ed`): FF-36 re-run of audits A and B and the FF-38 parity audit on the published set, one local core, no Office ([PARITY-2026-09-30-charts-measured.md](gallery-support/parity/PARITY-2026-09-30-charts-measured.md), [support table](gallery-support.md#charts-measured-and-owner-defaults-2026-09-30)). Parity is 707 perfect, 47 near, 96 mismatch of 850 (opf#186: 657, 37, 156); with the harness as merged the same heads score 700, 48, 102, with the chart series-colour comparison (line and radar series on their stroke; pie and doughnut on their slice fills, the 0.75 pt `F9F9F9` slice border not a series colour; no tolerance change) 703, 51, 96, and with slide-number field folding 707, 47, 96. Layouts 483 of 485 perfect (39 embedded-chart mismatches fixed by the engines), charts 5 / 14 / 7, headers-footers 10 of 10 perfect. Presence is 427 of 819 `works` (379 of 793): audit B now probes the 26 charts (19 `works`; the seven chartex ids `partial`: legacy preview, clustered column export with `chart-data-adapted`, re-import returns `column`), color schemes 14 `partial` to 14 `works` (schemeClr, FF-24b), and audit A's image-treatment probe is redefined and re-measured (15 of 15 `works`, the retained rows dropped). Owner defaults 2026-09-30: (a) a native slide-number field plus adjacent literal runs is one run (`slide-number-progress`, `appendix-numbering` perfect); (b) `works` for a composed image treatment means the emitted design output is written natively into the PPTX and re-imports (gap labels stay on the gallery items); (c) socials icons are catalog metadata only, URLs render and link. Two script defects found and fixed on the way: audit A's `missingAssets` pattern had lost its backslash and never matched, and audit B needs `--max-old-space-size=12000`. Rows: FF-24b, FF-26 and FF-33 move to done (evidence in each row); FF-22b stays review (native chartex export, renderer coverage for the seven chartex ids, native PowerPoint check); FF-34 stays review (icons decision recorded; the schema description and the gallery `/socials` copy still say renderers pick icons); FF-36 stays review until the gallery re-imports the file (charts show badges); FF-38 done, latest run updated. Summary is now 25 done, 17 review/in-progress, 9 todo. No Office, tolerance, gate or publish change.
- 2026-09-30 (FF-34 wording; [opf#191](https://github.com/OpenPresentation/opf/pull/191), [pptx-gallery#64](https://github.com/Data-Advantage/pptx-gallery/pull/64)): the release owner approved the wording change as an application of the owner default 2026-09-30 (icons are catalog metadata only, URLs render and link). The social-platform schema description (and the `brandColor`, `icon`, `iconLight`, `iconDark` descriptions) and the `Socials` definition no longer say renderers pick icons; the generated schema docs are regenerated with `scripts/generate-schema-docs.mjs`; `check:spec` passes and `check:breaking` reports 0 breaking; the gallery `/socials` copy is updated. FF-34 moves to done (26 done, 16 review/in-progress, 9 todo). No Office, tolerance, gate or publish change; the package-level schemas carry the new text from the next core release.
- 2026-09-30: FF-36 done. [pptx-gallery#64](https://github.com/Data-Advantage/pptx-gallery/pull/64) `1f0e382` re-imported `data/support-status.json` from core `7aec43a` (opf#190) and is deployed: all 819 gallery items carry a measured parity and pipeline status, charts included (production `/api/charts.json`: 5 perfect/works, 14 near/works, 7 chartex mismatch/partial); no dimension is pending. Summary 27 done, 15 review/in-progress, 9 todo.
- 2026-09-30 (FF-22b chartex halves opened, not merged): [opf-pptx#108](https://github.com/OpenPresentation/opf-pptx/pull/108) exports the seven chartex ids as native Office 2016 chartex parts (`cx:chartSpace` with `cx:chartData`, one `cx:series` per plotted column named by layoutId: `treemap`, `clusteredColumn` with `cx:binning` or `cx:aggregation`, `clusteredColumn` owning `paretoLine`, `boxWhisker`, `waterfall`, `funnel`, `regionMap`; chart style and colour style parts; `mc:AlternateContent` with the clustered column chart as fallback; same-id re-import; `series-dropped` and `chart-map-geodata` reported instead of `chartex-fallback`/`histogram-binned`; no geography cache is written, PowerPoint fetches Bing data). The native export is opt-in (`toPptx` option `chartex: 'native'`): the default keeps main's clustered column export of the chartex ids byte for byte (fixture-pinned) because an unvalidated chartex part would make PowerPoint offer to repair the whole deck; the default flips after the native check. [opf-render#66](https://github.com/OpenPresentation/opf-render/pull/66) previews the same constructs with traced marks (26 golden chart slides change); the map preview is a value-shaded tile grid, not geography. Both suites pass locally on Windows; CI pending at the time of writing. Native PowerPoint confirmation is root-owned: a native-check deck set (one deck per construct, preview PNG, `manifest.json` of the expected look) is prepared in the session scratchpad `ff22b-native`. The audit-B and FF-38 harnesses still read the fallback `c:chart` frame, so the seven charts stay `partial`/mismatch until the harness reads `chartEx` parts and the audits re-run on released packages. No Office, tolerance or gate change.
- 2026-09-30: FF-38 harness models the gallery editor's font host (branch `codex/ff-38-font-resolution-model`; core `3d51ba1` plus `26a1d82`, opf-render 0.11.3 `a66caa3`, opf-pptx `6f6122c`, pptx-gallery `1f0e382`, one local core, no Office; [PARITY-2026-09-30-gallery-font-host.md](gallery-support/parity/PARITY-2026-09-30-gallery-font-host.md), [support table](gallery-support.md#gallery-font-host-model-2026-09-30)). The 86 remaining fontResolution mismatches came from a harness that loaded no script faces; the editor's font gate (`ensureLazyFonts` and `ensureScripts`, opf-editor 0.10.1, with opf-render 0.11.2 selecting the faces a font scheme names) loads them. `parity/scripts/font-host.mjs` runs those calls per value (`PARITY_FONT_HOST`: `gallery`, `node-auto`, `office-only`, which reproduces 707, 47, 96 exactly) and the value must also pass the strict measured render; no tolerance changed and every other check is identical in every value. Parity is 729 perfect, 108 near, 13 mismatch of 850 (was 707, 47, 96); fontResolution 755 pass, 92 near, 3 fail (was 733, 31, 86). Of the 86: 22 perfect, 61 near (visual-tier Noto replacements), 3 real gaps recorded against their tracker families (Raleway and Playfair Display `loading-gap`, FF-43 and FF-41; Noto Sans Mongolian shaping, FF-44). One host difference recorded under FF-19: Node `scripts: 'auto'` does not serve Sylfaen (three values). `support-status.json` and the font tracker (parity source moves to this run; 0 stale records, was 60) are regenerated; the parity fields of 83 values change, so the pptx.gallery re-import of `data/support-status.json` is a follow-up.
- 2026-09-30: Next goal recorded, internal tracking only: the owner set 100% `works` for every gallery config ("for our progress table, set the next goal to get everything to 100% 'works'"). FF-47 (this tracker PR, review) adds FF-47 to FF-58 and `pnpm report:works`. Baseline from `support-status.json` at core `60e73d4`: 427 of 819 `works` (52.1%), 322 `partial`, 70 `gallery-only`; layouts 291 of 485, charts 19 of 26, content blocks 31 of 32, font schemes 0 of 93, languages 0 of 93, themes 0 of 4, the other eight dimensions 100%. Summary 27 done, 16 review/in-progress, 20 todo. No audit, gate or tolerance changed; nothing is shown on pptx.gallery.
- 2026-09-30: FF-36 re-scoped by owner decision. pptx.gallery must not show support or progress status publicly ("we just want them all to work we don't need to talk about it publicly"). The measurement stays internal (core `support-status.json`, [gallery-support.md](gallery-support.md), this burndown); the gallery removes every public surface in [pptx-gallery#66](https://github.com/Data-Advantage/pptx-gallery/pull/66) (card badges, index legends, detail panels, `supportStatus` in `/api/<dimension>.json`, llms.txt lines, importer and data file) and adds a guard test. FF-36 stays `done` (measurement delivered; display withdrawn). README invariant added: no public support or progress status on the gallery.
- 2026-09-30: FF-48 in review ([opf#200](https://github.com/OpenPresentation/opf/pull/200), branch `codex/ff-48-audits-host-model`; measured on core `3e1cbf0`, opf-render 0.11.4 `1a724a6`, opf-pptx 0.11.3 `ecdbb42`, opf-editor 0.10.2 `c7995ed`, pptx-gallery `59ff36c`, one local core, no Office). Audits A and B classify font availability against the parity harness's gallery font host and the owner font policy (a policy look-alike with the PPTX naming the selected family is `works`); `AUDIT_FONT_HOST=strict` reproduces the earlier results exactly. `pnpm report:works`: 427 to 431 of 819 (themes 0 to 4 of 4); font schemes and languages stay 0 of 93 on their FF-49 and FF-50 reasons only. FF-38 parity re-run on the same heads: 734 perfect, 113 near, 3 mismatch (was 729, 108, 13; the three font mismatches clear and the 7 chartex charts move to 3 perfect and 4 near with opf-render 0.11.4); the parity extraction is byte-identical. Summary 27 done, 17 review/in-progress, 19 todo. Nothing is shown on pptx.gallery.
