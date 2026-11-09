# LH-10: capped automatic-list reading measure

Issue [#1232](https://github.com/OpenPresentation/opf/issues/1232). Branch codex/lh-10-capped-list-measure, owned worktree C:/opf-work/lh10-measure. Fresh origin/main was 9545016583ccfa151077cda4d51043ac6505a140; it was normally fast-forwarded to reviewed integration base b8fdd1cb88273a4f9963c9c01b89fbf1d5d5cc1b. No folded branch was changed.

The valid paginated Pyramid5long continuation has a correct retained minFontSize:24, maxFontSize:24 and seven 78-character lines. It has already failed its diagram arrangement and is ordinary list text. The initial diagnostic matched all four current SVG hashes to the authoritative tracked fixture and saved golden2 evidence before trusting metrics. Its first parser failed because trace paths are inherited from SVG groups; that attempt remains untouched. One authorized parser-only recovery passed, preserving all inherited paths and every body entry. Both existing public auto/fixed-two column oracles retain all35 entries, exact mappings and24px glyph sizes, reducing continuation maxima78→41 with zero fit failures. This does not undo the separately justified28→24 cap correction.

## Change and decisions

**Vetoable decision LH10-CAPPED-MEASURE:** compare actual whole-word lines at the effective cap for a lone eligible automatic list. A fitting column alternative may win at that same size, without requiring a size increase that the cap forbids. For an arrangement that actually failed, reuse the existing retained-size fallback fitter to try readable wrapping/columns. A new optional trial that cannot fit leaves the prior result; existing mandatory SH26 overflow refusals remain unchanged.

The implementation uses the existing70-character prose measure, minimum column measure, type/cap calculation, list slicing, rich fits and RTL ordering. It has no title, layout-id, fixture-key or text-string condition. Explicit payload/region column counts, authored run sizes, fill:false, uncapped behavior and accepted diagram geometry remain constrained as before. The shared word-cut helper is a function declaration so the earlier selector can use its unchanged logic safely.

Ten focused controls pass: caps20/24/28; exact24px and ordered entries; explicit one-column and run sizes; short lists/opt-out; uncapped larger-type and no-worse arrangement; rich formatting/RTL; all35 paginated entries and original mappings; intact words; and authored region/payload fallback counts. Original baseline and intermediate failures remain in the evidence packet, including a stale-build test invocation and a word-helper initialization error corrected before qualification.

Required pnpm check:changed --base b8fdd1cb88273a4f9963c9c01b89fbf1d5d5cc1b, representative bound SVG/PNG and owner review are pending. No authoritative golden was regenerated or changed. This is a bounded candidate, not final visual/native/release acceptance. Chart representation agreement, native readiness, E1/private comparison recovery and broader release scope remain separate.

External raw evidence currently lives at C:/opf-work/lh10-pyramid-diagnostic-01/, C:/opf-work/lh10-pyramid-diagnostic-02/ and C:/opf-work/lh10-source-evidence-01/; final publication must preserve it on GitHub.
