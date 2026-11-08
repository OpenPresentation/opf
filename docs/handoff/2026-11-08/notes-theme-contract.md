# RR-20 notes-theme contract and renderer release guidance

Fresh main 9545016583ccfa151077cda4d51043ac6505a140 normally aligns with integration e79043da0f13c7ed9101456736fea7a116538408 in isolated C:/opf-work/rr-notes-theme, branch codex/rr-20-notes-theme-contract. Folded PRs 1211/1212 and their source branches stay untouched.

## Confirmed test/runbook defects

notes-master-theme.mjs hardcoded app.xml Theme count 2 for every exported example. The authored multilingual fixture contains English, Arabic, Japanese and French; the Latin languages share one profile, while Arabic/Japanese need separate slide masters and themes. Its actual package correctly has four independently referenced theme parts and app metadata says four. The scalar lane already proved the complete integration67/c2da archives byte-identical, SHA256 12f36179e0d2556d7b57cff407f118ba3cc999097ae443ed60566c117a720528. Original baseline failures and this exact archive identity are reused without rebuilding/re-exporting that baseline.

The renderer AGENTS current publishing section still said all six packages and that a release-prep PR assembles fragments. Root instructions and the authoritative publisher roster require seven packages, main's dry-first Release workflow, then the tag-only trusted publisher. The existing NAMES-derived currency guard now includes renderer AGENTS; it genuinely failed before the prose correction and passes afterward. Six authoring skills and historical limits are unchanged.

## Vetoable decisions and scope

1. Declare two independent expected owner/part contracts: ordinary fixtures have slideMaster1/theme1 plus notesMaster1/theme2; the multilingual fixture additionally has slideMaster2/theme3 and slideMaster3/theme4. App count is checked against these declared expectations, never inferred from the exporter count.
2. Require exact expected master/theme sets and owner relations. App HeadingPairs/TitlesOfParts vectors must be well formed, counts must cover titles, and the Theme title segment must match each independently referenced theme's XML name in order. All prior notes-copy, theme-content-type, one-theme-per-master, unique ownership, package XML/relationship, Georgia font and no-Aptos assertions remain.
3. Positive real exports exercise both two and four themes. Six in-memory negative mutations reject both wrong counts, missing/orphan/shared theme parts and wrong app theme titles. No source fixture, archive or golden is rewritten.
4. Change only current renderer release instructions and extend the existing publisher-roster guard. No runtime, schema, tolerance, native, provider, release or CI observer work occurs.

Required mapped qualification uses exact integration e790 as this derived PR's base. The plan selects build/lint, relevant root checks and the changed PPTX test, with a correct typecheck skip (no TS change); final combined full suites/goldens/native/release/site acceptance remain coordinator-owned. Raw failures/provenance are retained under notes-theme-contract/.

## Actual frozen qualification

Source b42a491538408632246d806449b0d232acf58497 completed Node v24.20.0/pnpm 10.33.2 check:changed against exact e790 in 110.6 seconds, exit 0: thirteen passing stages and one correct typecheck skip, with no TS change. Build/lint and every selected root check pass. The changed PPTX test passes all three hand-authored decks, all 147 actual corpus exports and six in-memory refusal controls. The existing release workflow guard passes 26 controls. No source edits occurred during the run. Subsequent commits retain only evidence/handoff metadata.

This is a test and current-runbook correction, not an exporter behavior fix. The final complete combined suite and release/native/site acceptance remain owed separately. The receipt verifies the exact QA source paths, unchanged runtime/fixture/archive/golden trees and lossless raw logs; no full duplicate suite was run.
