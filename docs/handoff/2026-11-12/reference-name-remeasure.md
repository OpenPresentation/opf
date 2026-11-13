# Measuring the reference series-name route again

The route under `scripts/native-acceptance` (`reference-name-*`) renames one chart series in PowerPoint and proves that nothing else in
the file changes. It admits exactly one input: the current PPTX export of the `reference-native-lines` deck. When that export changes,
`reference-name-snapshot.test.mjs` fails ("The maintained export of the reference deck changed") and the measurement has to be taken
again. This is the procedure of 2026-11-13 (PowerPoint 16.0.20527, Windows PowerShell 5.1, Node 24), about one hour.

## What is sealed

- **Sealed by tests** (change only with the owner's word): the worker `packages/pptx/test/native-furniture-control.ps1`, pinned whole
  by `scripts/native-acceptance/b07-postflight.test.mjs`, `packages/pptx/test/native-reference-startup.mjs` and
  `packages/pptx/test/native-reference-startup-check.ps1`. Each test derives every earlier stage of the worker by exact, unique text
  replacements. A new input is a new stage: two literals in the worker (the admitted input's bytes and hash, and the helper series
  names) and one added stage in each of the three tests. Stage 8 of 2026-11-13 is the model.
- **Not sealed, moved by the tool:** every other pin of the input (`reference-name-reseal.mjs seal-input`).
- **Never moved:** the PowerPoint observations (series type evidence, the name's literal form after the edit, revision 1, 2, 2, the
  workbooks byte-identical). If a run does not reproduce them, that is a finding to review.

## Steps

1. **Controller.** A clean worktree at the final commit, installed and built. The route refuses a dirty or moved controller, so keep
   scratch output outside it and do not commit between `create` and `record-run`.
2. **Export.** `node scripts/native-acceptance/reference-name-reseal.mjs export --output <dir>`; `export.json` names the bytes, the
   hash and the two helper series names.
3. **Re-seal.** `... seal-input --export <dir>/reference-native-lines.pptx --write --sealed-out <dir2>` moves the unsealed pins and
   writes the proposed worker and `worker-stage8.json` (the two edit pairs and the new identity).
4. **Worker stage (owner's word).** Copy the proposed worker over the sealed one and add the stage to the three sealing tests. Then
   these must pass: `reference-name-snapshot.test.mjs`, `reference-name-profile.test.mjs`, `b07-postflight.test.mjs`,
   `native-reference-startup.mjs`, `native-series-name.mjs`. Commit.
5. **Generation checkout and consumer.** A second, detached worktree at the same commit (installed, not built). Pack the six
   packages from the controller, install them with npm (not pnpm) into an empty consumer folder together with
   `@expo-google-fonts/roboto` and `@resvg/resvg-js`, and check that the consumer exports the same bytes as step 2.
6. **Suite, envelope, request.** From the generation checkout: `reference-chart-generate.mjs generate --consumer ... --output ...
   --worker-repository <generation>/packages/pptx --expected-revision <commit> --expected-runtime-identity-sha256 <hash>`. From the
   controller: `reference-name-snapshot-profile.mjs create --options <file> --output <envelope>` (prints the envelope hash), then
   `prepare --envelope ... --sha256 ... --output <run dir> --require-office true` (prints the request hash). Paths in the options
   file are canonical Windows paths. A rehearsal with `--require-office false` and no `-RunOffice` runs every check except Office.
7. **PowerPoint.** No `POWERPNT.EXE` or `EXCEL.EXE` may be running. With Windows PowerShell 5.1:
   `scripts\native-acceptance\run-reference-name-snapshots.ps1 -SuiteDirectory ... -PptxRepository <controller>\packages\pptx
   -OutputDirectory <run dir> -ExecutionEnvelope ... -ExpectedEnvelopeSha256 ... -ExpectedRequestSha256 ... -NodeExecutable ...
   -RunOffice`. Success is exit 0 and `runner.json` with `lifecycle-observed; semantic-and-visual-review-required`. The worker opens
   the file read-only without a window, saves only copies, closes only its own presentation and never kills Office. Look at the
   nine slide images it writes.
8. **Record.** `reference-name-reseal.mjs record-run --run <run dir> --envelope ... --sha256 ... --write` repeats the admission and
   writes `test-fixtures/reference-name/measurement/`. Then `reference-name-measurement.test.mjs` (3 tests) and
   `pnpm check:native-acceptance` must pass. Commit the folder.

## What went wrong on 2026-11-13, so it does not again

- **The run was refused after PowerPoint had finished.** An admission binds every file of the installed packages and accepted at
  most 2,000; the gallery has 7,248 since icons ship as files. The bound is 20,000 now (owner-approved), in `owned-postflight.mjs`
  (twice), `owned-postflight.ps1` and `furniture-postflight.ps1`. The admission file and the envelope must each stay under
  4,194,304 bytes; the envelope was 3.9 MB.
- **A change of the route's own code needs a new envelope and a new PowerPoint run.** The envelope binds the controller's files, so a
  completed run cannot be admitted by a later commit. Keep a refused run's folder and use a new output folder.
- **The recorded files must keep their exact bytes in git.** PowerShell writes `report.json` and `stages.jsonl` with CRLF and a byte
  order mark; `.gitattributes` marks the measurement folder `-text`. Without that line the hashes fail on Linux.
- **The contract can find product defects.** It refused the first comparison because the import of the renamed series gained an
  `alt` (the stale generated description). That was a real defect in the importer, fixed in the same release.
- **PowerPoint writes the Office user's name** into `cp:lastModifiedBy` of the three retained archives, as in the other
  PowerPoint-saved fixtures of this repository. `record-run --no-archives` records the run without them.
