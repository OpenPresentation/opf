# Handoff: v0.34 schema review implementation (FA-34 to FA-38)

Branch `claude/elegant-bell-2g5ks5`, based on `codex/integration-034-native-staging-20261109` at `e7dc3709`. No pull request
is open (the owner did not ask for one). This note is for the agent that finishes the work; delete this folder before the branch
merges.

## What the owner asked for

A review of the OPF schema for 0.34 produced a list of Must (M1 to M7), High (H1 to H7) and Optional (O1 to O6) items. The owner
answered the open questions and said "ok implement all M/H/O". Decisions: an unsupported chart type with `referenceLines` is an
error with its own rule; RTL geometry flip is research ([opf#1256](https://github.com/OpenPresentation/opf/issues/1256));
`left`/`right` become `start`/`end` now; a reference line never changes emphasis; shape dimensions cap at 8; `fontSize` stays in
points. Rows FA-34 to FA-38 and the progress log in `docs/programs/format-audit/burndown.md` record them.

## Status of every item

| Item | State |
| --- | --- |
| M1 bar charts draw `referenceLines`; M2 `opf/chart-reference-unsupported-type`; M3 stale LH-110 text; H3 one `Line`; H4 stacked types; H5 `highlight` off switch; O6 import of unchanged references | Done, tested, commit `4a8e47d0` (FA-34) |
| M4 `opf/shape-off-slide` and `FiniteNumber`; H1 `widthPx`/`heightPx`; H2 dimension cap 8 | Done, tested, `4a8e47d0` (FA-35) |
| M6 closed objects; M7 descriptions; H6 messages; H7 `inverted-pyramid`; O5 option rules; O3 `fontSize` unit text | Done, `4a8e47d0` (FA-36). Two follow-ups are in the last commits: the PPTX importer checks a document without its transient `_opf*` run markers, and the inline `ColorScheme` declares `name` (the exporter reads it for `a:clrScheme name`) |
| O1 `left`/`right` to `start`/`end` (FA-37); M5 direction rule; O4 `TextRun.lang` to `language` (FA-38) | Source, schemas, examples, gallery records, docs and skills are done and build. **Test migration is not finished** (see below) |
| O2 one fill vocabulary for backgrounds and shapes | **Not implemented, on purpose.** It reverses the owner-adopted FA-22 flat image background and changes the default gradient angle of backgrounds (0 against 90). Bring the owner a concrete representation first |

## What is left, in order

1. **Rebuild**: `pnpm run build:packages` (the core `dist/` is one small source change and one schema change behind: the
   `ColorScheme.name` property and a lint fix in `chart-references.ts`). Then `node scripts/generate-schema-docs.mjs` and
   `node scripts/build-validate-docs.mjs`.
2. **Finish the test migration.** An automated pass rewrote the unambiguous patterns in every test file; what remains are
   values passed through variables, expected word lists, and property accesses. The rules for doing this without weakening a
   test are in `tools/test-brief.md` (give it to a helper as it is). Run one package at a time with
   `node docs/handoff/2026-11-12-schema-034/tools/ptest.mjs packages/<name> --jobs 3`: it never stops at a failure and writes
   each failing log under `ptest-logs/` beside the tools folder.
   - `packages/javascript`: 37 files failed before the helpers started; they fixed part of them (their edits are committed). Rerun to get the current list.
   - `packages/editor`: 27 files failed; a helper fixed some. Rerun. `font-gate-script-families.mjs` and `font-gate-script-names.mjs` were not looked at (the baseline has 0 editor failures, so check whether they are load-related or real).
   - `packages/pptx`: the run was cut off part way; `pptx-failing-partial.txt` lists what had failed by then. Six of them fail on staging too (see the baseline).
   - `packages/render`, `packages/cli`, `packages/mcp`, `packages/integration`: not run after the rename except integration (only `overfull-continuation` fails, as on staging).
3. **Baseline**: `baseline-staging-e7dc3709.log` is the full suite on pristine staging (render was not reached). Failures there
   are not this branch's: 10 CLI files and `mcp.test.mjs` (`opf validate` on an invalid deck returns `internal-error` because
   the demand-font provider throws; report it), integration `overfull-continuation` and the old `lh-110` test (rewritten
   here), and six PPTX files (`determinism`, `keynote-registry-runtime`, `lh-16-duration-timeline`,
   `lh-63-run-in-quote-marks`, `native-conformance`, `registry-glyph-fallback`).
4. **Goldens**: dispatch `golden.yml` on the branch (never by hand). `packages/render/test/golden.mjs` reports 8 changed
   slides and one new deck: the seven slides of `technical/localized-chart-references` (already stale on staging),
   `technical/full-feature-tour#1` (its run `href` typo is now `link`), and the new `technical/explicit-chart-reference-lines`.
   `layout-template-goldens.mjs` reports a changed fixture hash because four gallery layout records were renamed
   (`titleAlignment: "start"`) and `inverted-pyramid` changed its arrangement key; the 40 layout previews are unchanged
   (`render-previews.mjs --check` passes), so promote it through the same workflow.
5. **Checks**: `npx biome check . --diagnostic-level=error` passes. These root checks passed after the rename: `check:changes`,
   `check:spec`, `check:schema-examples`, `check:schema-strict`, `check:schema-docs`, `check:catalog`, `check:catalog-schema`,
   `check:first-deck`, `check:skill-glossary`, `check:text`, `check:breaking`, and `generate-example-suite.mjs --check` (101
   generated decks match). Still to run: `pnpm typecheck`, `check:stability`, `check:gallery-tracker`, and `pnpm check:changed`
   once the suites are green.
6. Open the pull request only when the owner asks. The three sites (other repositories) need the same rename when they adopt 0.34.

## Decisions made while implementing (all vetoable)

- Engine geometry keeps `left`/`right`: a composed item's `alignment` is logical and `physicalAlignment` resolves it; a
  composed placement's `edge` is physical. `resolveDesignHints` and `SlideComposition.design` report the document's words and
  `itemAlignment()` converts.
- No alias in documents or records. One reader of the old words: `packages/pptx/src/legacy-tags.js` upgrades OPF tags written
  before 0.34, because PowerPoint keeps those tags and the PowerPoint-saved fixtures (`header-footer-dialog`,
  `rr105-tag-ownership`) can only be regenerated natively. `test/legacy-tags.mjs` states the rule.
- `rr105-tag-ownership/11-source.json` is checksummed evidence and stays as written; its test converts `lang` in memory.
- An unknown `left` key gets the help `Write "start"`; did-you-mean now reaches the object branch of a union.
- The layout region names `left` and `right` are no longer reserved; `start` and `end` are.
- Historical files were not rewritten: `docs/handoff/**`, `docs/programs/**`, `docs/plans/**`, changelogs and old fragments.

## Tools in `tools/`

`ptest.mjs` (parallel suite runner), `o1-tests.mjs` (the regex pass for test sources and prose; safe to run again),
`o1-codemod.mjs` (the JSON-aware pass for decks and records), `o1lib.py` (edit helpers), `vall.mjs` (validate every example
with the built core), `test-brief.md` (rules for migrating a package's tests).
