# B07 direction observation: hypothesis rejected

The native run completed cleanly, but the first English line is still reversed. The three real PowerPoint PNGs are byte-identical to the original fb370 baseline. Nine actual ParagraphFormat.TextDirection observations match the source XML (heading2, English lines1/1 across original/edited/reopened), and all nine LanguageID observations are1025. These facts reject the paragraph-direction mismatch hypothesis; they do not explain or fix the remaining glyph-order defect. **glyphFix:false; currentRuntimeAcceptance:false; nativeAcceptance:false.**

Root's actual native session57166 exited0. Supervisor timeoutfalse/exit0/cleanuptrue and global POWERPNT preflight/postflight counts0 are preserved. Preparation and ValidateOnly also exited0. No retry or launcher COM cleanup ran. Archiving did not invoke any preparation/native/export/Office command. Both root and the archiving agent viewed the original real PNG and observed the reversed first English line.

This is the original09 historical case, not a fresh current-runtime feature qualification. The bound sources are worker2b825aa72e16dfa6593a8171011f7fcb6138255b; adapterf9b713ca1c15fbfc9ed350e1f019e6b80658c6bb; unchanged controllerce92ccc65d8cb40cc6532b2d9082e12202d6c283; historical generationfb37046f043f860c8887e0574620ef3c507e3fa4. The prepared suite SHA is a9c91a0bd1df36298bd920e3a578e39be5871ea39d9aaf856a036910d97ebf25. Original producers remain unchanged.

The303-record raw.json.gz packet preserves4,241,084decoded bytes (1,991,706gzip): ALL native/ValidateOnly outputs including their managed synthetic harness files, suite inputs/previews/source, root launch scripts/logs/exits/preflight/postflight, exact executed source bytes, and the unchanged historical transport. **Files under native/harness and validate/harness are synthetic fake tests, not native observations or real renderings.** The three direct images below alone are the real native rasters; the30278byte sealed CLI preview is separate. Fake success/failure/timeout harness records must never be counted as extra Office runs.

All three real images are10442bytes,1280×720, SHA256 add5221afa2afa4d7193acc77d03d0dc77ed047b5c7806ad9f3a0edb60c6c3ba. Their bytes are independently matched to cases/A/native members in the original452-member fb370 transport beaaa89b3373c0c0e215ad86da5611f75edea6de8eb442957522fd1014583e31.

- [Original](images/original.png)
- [Edited phase; zero actions](images/edited.png)
- [Reopened](images/reopened.png)

Offline replay: `node docs/handoff/2026-11-10/b07-direction-observation/verify.mjs`. It checks all lossless records, source/suite identities, actual exits/cleanup/directions/languages, all452 historical members and exact real-PNG equality. It does not invoke archived executable code. The visual conclusion is explicitly human observation, not an automated OCR claim. NEVER MERGE this evidence branch. Further diagnosis or any Office action needs a separate coordinator decision; no release acceptance follows from this packet.
