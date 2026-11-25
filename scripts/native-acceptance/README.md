# Native PowerPoint acceptance suite

This is the versioned test suite for OPF's native PowerPoint acceptance. Check out
the reviewed core and PPTX revisions on the Windows machine, prepare the fixtures
there, and run the tracked supervisor command. Do not send generated decks or a
temporary ZIP between computers as the test distribution mechanism.

## One command: pnpm native

`pnpm native <target>` (`native.mjs`) takes OPF's qualification decks to a classified result for one native application:
it exports the decks, has the application open, draw and resave each file, and says what is new.

```sh
pnpm native <target> [--tier smoke|release|full] [--decks a,b] [--variants default,native-body] [--baseline <opf version>|none]
                     [--out <dir>] [--from-run <dir>] [--inputs <dir>] [--previews <dir>] [--warnings-dir <dir>]
                     [--look deck#slide,...] [--no-sheets] [--write-summary] [--release <x.y.z>] [--force-summary] [--json]
```

**Targets.**

| Target | Driver |
| --- | --- |
| `keynote` | `apps/keynote/driver.mjs`, on a Mac where the owner has started Keynote and the screen is unlocked. |
| `powerpoint` | The PowerPoint driver runs on the release supervisor's Windows computer and writes a run directory; classify it here with `--from-run`. |
| `impress` | The LibreOffice runner (`scripts/libreoffice/run.mjs`). The command refuses when LibreOffice is missing. When it is installed, the command builds the decks and prints the runner's command and the `--from-run` command that classifies the runner's `native/` folder; it does not start the runner itself yet. |
| `powerpoint-mac` | No driver yet (opf#1314); the command says so. |

**Tiers** come from `qualification/manifest.json` (`qualification/README.md`, "Tiers"). `smoke`, the default, runs about
ten decks and adds the decks that unreleased changelog fragments name in `native:` (`changes/README.md`). `release` runs
every deck and variant. `full` adds sources the runner cannot build yet (example decks, gallery layouts, language decks):
they are listed as "not run" and the run exits with 2. `--decks` replaces the tier's decks (the tier still says which
variants, unless `--variants` does), and a run narrowed by `--decks` is not stopped by a source it does not run. In every
tier the slides the fragments name, and `--look deck#slide`, are new whatever their score: someone looks at each one.

**The steps**, each printed as it starts and with its duration when it ends:

1. **select**: the decks and variants, and the slides to look at.
2. **check**: the target's driver says whether this machine can run it now. It runs before the build, so a machine that
   cannot run the target spends no time building, and again before every file. A refusal prints the reasons and opens
   nothing. Keynote's check reads the process list, the screen's lock state and the macOS version, and sends Keynote its
   one read-only `info` event only when Keynote runs and the screen is unlocked (`apps/keynote/README.md`).
3. **build**: the selected decks' `.pptx` files and OPF's previews (`qualification/build.mjs --only`) into `<out>/build`,
   with the OPF version of the workspace's CLI package and the checkout's commit. A workspace that is not built stops here
   with the command to run (`pnpm build:packages`).
4. **run**: per file `open`, `probe`, `render`, `resave` and `close` through the driver (`apps/keynote/run-file.mjs`) into
   `<out>/run`, in the shared format (`core/result/README.md`) with the tier and the baseline in `run.json`.
   `--warnings-dir <dir>` gives the Keynote driver the text of Keynote's Warnings window per file (`<dir>/<fileId>.txt`).
5. **round trip** (`core/roundtrip/`), **compare** with OPF's previews (`core/compare/`) and **classify**
   (`core/classify/README.md`) against `known/<target>.json` and the baseline summary `runs/<version>/<target>.json`. A
   target without known records is classified with an empty list, and a note says so. The baseline is `--baseline
   <version>`, `none`, or by default the newest version under `runs/` that has the target (below `--release` when it is
   given). Then a labeled sheet for every
   new slide (`<run>/sheets/`), unless `--no-sheets`.
6. **report**: files opened; slides same, known and still there, known and gone, new, and not compared; file findings; new
   import-warning lines. Then every new item with its reason and its sheet, then what was not run. `--json` prints the
   same as one JSON object on standard output (the step lines go to standard error).

**Exit codes.** 0: nothing new. 1: something new: look at each item, then add or extend a record in `known/<target>.json`
or fix OPF (`core/classify/README.md`, "When a slide is new"). 2: refused, something not run (a tier source, a deck a
fragment names that is not in the manifest, a failed export, a verb that did not finish on a file that opened), or the run
could not finish.

**Where output goes.** `--out <dir>` must be a new or empty folder outside the repository; the command refuses one inside
it. Without `--out` the run goes to `~/opf-work/native/<target>-<date>-<time>` (UTC) when `~/opf-work` exists (the agents'
work folder), else to `<system temp>/opf-native/<target>-<date>-<time>`. `<out>/build` holds the exported files and the
previews, `<out>/run` the run directory with `classify.json` and the sheets. All of it is evidence and stays out of `main`.
Nothing is written inside the repository unless `--write-summary` is given: it writes `runs/<version>/<target>.json`
(`core/classify/summary.mjs`) for a run that finished (exit 0 or 1), prints the path, and notes how many new items the
summary keeps as new. Commit that one file, and only after review.

**Summaries of a release candidate.** A candidate is built from a workspace that still carries the previous release's
version, so without more the summary would be named after that release and replace the baseline the run was classified
against. `--release <x.y.z>` names the version the candidate will be released as: `--write-summary` then writes
`runs/<release>/<target>.json`, whose `opf` is `{ version: <release>, commit: <the candidate's commit> }`. `run.json` and
every `result.json` keep the truth (the workspace's version and commit; the run format has no field for the release, so the
release lives in the summary only). The report names both: "OPF workspace 0.36.0 at <commit>, release candidate 0.37.0".
A baseline equal to the release is refused (a run cannot be its own baseline), and the default baseline is the newest
summary below the release. `--write-summary` never replaces an existing summary unless `--force-summary` is given: it
prints the report, says which file it would have replaced, and exits with 2. Both flags work with `--from-run`, so a
reviewed candidate run is written later without opening the application again:

```sh
pnpm native keynote --tier release --release 0.37.0                       # run, review the new items
pnpm native keynote --from-run <out>/run --release 0.37.0 --write-summary   # after review: runs/0.37.0/keynote.json
```

**`--from-run <dir>`** skips the check, build and run steps and classifies a run directory of the shared format in place:
one the Windows PowerPoint driver wrote, the LibreOffice runner's `<out>/native`, or one from
`apps/keynote/import-recorded.mjs`. The exported files are found with `--inputs` (the folder that `file.path` in each
`result.json` is relative to), else in `<dir>/../build`, `<dir>/../inputs` or `<dir>/inputs`; OPF's previews with
`--previews`, else in `<dir>/preview` or `<dir>/../build/preview`. A file that was round-tripped before keeps its
outcomes (merging them again would add objects twice), and a directory whose slides were all compared keeps its scores
unless `--previews` is given. For Impress, the previews of qualification deck `<deck>` are copied to the run's own
`preview/q-<deck>[.<variant>]/`, the names the LibreOffice runner gives its files.

```sh
pnpm native keynote --from-run ~/opf-work/round/run --baseline 0.36.0
pnpm native powerpoint --from-run D:/opf-work/native/run --inputs D:/opf-work/native/build --previews D:/opf-work/native/build/preview
```

**What needs an agent.** Two steps stay with an agent that can see the screen. Keynote shows its import warnings only while
it is in front, so an agent reads the Warnings window of each file and passes the text with `--warnings-dir`; without it
the warnings are "not-read". And someone looks at the sheet of every new slide and decides whose difference it is.

## Prepare

Use the repository's coordinated installed-package qualification to create the
six-package consumer (`pnpm pack:ecosystem --include-cli` followed by `pnpm test:packed-ecosystem`). The opt-in includes the CLI using the same explicit local preview versions and dependency adaptation as the four engines; the default pack command remains four packages. Gallery is packed with the other packages (it is a workspace package). Original source versions and runtime identities remain recorded; these preview tarballs are not published artifacts. Do not substitute registry packages for an
unpublished candidate or invent package versions. The source selection and
installation procedures remain in [ecosystem development](../../docs/ecosystem-development.md).

From the exact reviewed core checkout, with the corresponding PPTX checkout:

```sh
pnpm native:prepare --consumer /path/to/installed-consumer --pptx-repo /path/to/opf-pptx --output /path/to/new-native-suite
```

The output directory must be new. Use absolute local paths on each host; there
are no machine-specific paths or frozen release SHAs in the suite. Generated
PPTX files, previews and results stay outside tracked source directories.

`suite.json` records all six installed package versions and complete runtime
file hashes, the test-source and worker Git revisions, exact worker/source file
hashes, fixture outputs and diagnostics. These are identity receipts, not proof
of registry provenance or native acceptance. Source round-trip inequalities
remain findings; a successful generator does not erase them.

The fixtures cover primary layouts, pictures, furniture, charts, the current
timeline/list/metric/quote/table designs, chart export modes and table colours.
The eight new design cases use the same prepared fonts for each preview/export
pair. Historical fixtures retain their original export options and explicitly
record that preview/export equivalence is unproven. Native font installation
and visual comparison remain explicit acceptance steps.

## Current chart archive authority

Preparation loads the authoritative package fixture at
`packages/pptx/test/fixtures/chartex-fallback-main.json`. Its strict whole-archive
hashes, sizes, ordered diagnostics and layout/tag counts are current-output checks.
The older `fixtures/chartex-fallback-main.json` remains an authentic historical
native witness, not an alternate accepted output. Both file hashes and source
metadata are bound in `suite.json`, and the package fixture is part of the suite
repository input inventory. Native and registry acceptance remain false.

There are 28 primary inputs, 30 positive chart-mode inputs and one six-slide
table-colour input: 59 positive prepared cases. Multi-series Pareto uses the
current clustered-column fallback in every mode with all three series. A world
chart over nonplace categories uses columns, while an actual country map keeps
its separate native/auto contract. All-seven inputs still contain seven slides:
neither they nor the table input fit the generic three-slide worker. Select a
separately reviewed bounded plan; preparation never widens the worker limits.

## Opt-in font-route subset

Prepare only the versioned Traditional Arabic and Nirmala Telugu/Kannada/Gujarati/Malayalam fixtures with `--font-routes all`, or pass comma-separated exact case IDs from `fixtures/font-routes.json`:

```sh
pnpm native:prepare --consumer /path/to/installed-consumer --pptx-repo /path/to/opf-pptx --output /path/to/fresh-font-suite --font-routes font-route-traditional-arabic
```

The default suite and case IDs stay unchanged. The opt-in output records `scope.kind: font-routes`, its exact selected IDs and `fullSuite: false`; it does not prepare chart/table fixtures or transfer Roboto font inputs. Every generated source, archive, preview and diagnostic is included in the existing complete file seal. The committed script corpus is also bound to the suite repository identity.

Measurement rows use plain rich-text lines, with explicit point sizes, rather than fitted lists. Check the exported run sizes against the source before using a prepared fixture for native measurements; preparation alone does not establish native fidelity.

Each selected fixture has explicit 400/700 upright corpus rows, numeric/Latin/neutral/mixed controls and 18/24/32 pt size controls. Requested native names remain in the source and PPTX. One pinned open-font handle measures preview and export; metadata verifies its expected route-face bytes against the installed renderer manifest. No proprietary font is read, installed or copied. These pins describe preview bytes, not a physical native face or reference measurement. No coefficient is injected.

The existing one-case Windows runner can retain its ordinary observations for a selected eligible fixture after explicit authorization. Preparation and that worker's completion do not establish font fidelity: the route metadata keeps reference measurements, native physical face, BoundWidth/ink/baseline acceptance unresolved. Actual contextual per-class reference widths and affected Office overflow/ink measurements require separately reviewed assertions and supervisor evidence. This change adds no worker assertion or native pass criterion.

## Run on Windows

For the separately qualified mixed-code cases, use the bounded
[Roboto Mono profile procedure](../../docs/handoff/2026-11-08/rr105-roboto-mono-profile.md).
It prepares only the renderer-pinned 400/700 upright faces and leaves the
existing seven-face Roboto helper and its cleanup identity unchanged. Input
generation and mocked lifecycle tests do not install fonts or establish
native acceptance; only the supervisor performs registration and Office runs.

Follow [the Windows runner instructions](WINDOWS.md). Only the supervisor runs
Office. The runner checks the selected source revision and all generated hashes,
runs the Office-free worker checks, and performs one explicitly selected case.
It never retries a failed native attempt or kills Office. Generated inputs are
preserved; the existing worker saves only its own evidence copy.

Keep each result directory, including failures and cleanup status. Do not count
an ineligible/manual case as passed, and do not equate successful serialization
with native rendering, editing, round-trip or font fidelity. The release tracker
closes a native criterion only after the supervisor reviews its actual evidence.

## Maintain

Add fixtures, expected actions and assertions here with normal code review.
`pnpm check:native-acceptance` runs portable contract and negative tests without
Office; `pnpm check:changed` selects it for changes in this directory. Native
PowerPoint remains a separate Windows supervisor gate.

## Compare recorded text geometry

After a successful bounded Windows case, run the maintained comparator against
that case's existing output and the exact consumer recorded in its suite:

```sh
node scripts/native-acceptance/compare-text.mjs --suite /path/to/suite --output /path/to/case-output --consumer /path/to/installed-consumer --case feature-metrics
```

It verifies sealed fixture files, installed package identities, runner/worker
snapshots and lifecycle completion before comparing named text allocation boxes
at the existing 0.02 pt tolerance. Word comparison is whitespace-delimited; it
does not establish preservation of spacing, tabs or line breaks. It supports
no-op and `set-text` plans; unsupported actions are refused explicitly.

The new `text-comparison.json` is written once, preserving existing evidence.
Font selection, actual baselines and raster equivalence remain unmeasured, and
`nativeAcceptance` remains false even when this comparison passes. It never opens
Office or regenerates the suite.

## Verify the native list-description edit

Generate `list-description-native-edit` with the reviewed list-role recovery
runtime and the worker supporting `set-text-style`. After its bounded Windows
save/reopen run, use the exact suite and installed consumer:

```sh
node scripts/native-acceptance/compare-list-edit.mjs --suite /path/to/suite --output /path/to/list-case-output --consumer /path/to/installed-consumer
```

The comparator requires the tracked action, exact original document recovery,
and the entire expected edited document. It independently checks the saved
PowerPoint XML for the description's 36 pt red text, the worker's immediate
style readback, unchanged words in all three phases, and saved/reopened archive
identity. It writes a new `list-edit-comparison.json` without replacing evidence.

This fixture stresses semantic edit preservation: 36 pt exceeds its original
text-box height. A pass does not establish visual fit, physical glyph-font
selection, baseline parity, or overall native release acceptance. Preserve any
failure and investigate its actual cause before changing expectations.

## Explicit dense-events survey profile

The generic furniture runner still refuses cases whose automaticControlEligible
flag is false. The dense-events profile is a separate controller for the exact
feature-dense-events case: one original slide, exactly50 source shapes, no actions.
It delegates to the recorded worker's unchanged ReadOnlySurvey mode (one slide,
at most100 shapes,16MiB/4096 ZIP entries and a60-second maximum). It does not
change the generic3-slide/30-shape/20-action contract or edit the suite.

Freeze and review the NEW controller checkout before creating an execution
envelope. Generation retains its original suite digest, preparation/worker Git
identities and installed consumer receipts; controller HEAD/code hashes and
Node24 executable identity are recorded separately. Supply the reviewed manifest
digest explicitly; no workstation path or frozen release SHA is built into the
controller. All roots must remain clean and all original file/runtime identities
are rechecked before and after execution. Moving the controller HEAD invalidates
its envelope even when a later commit changes only documentation. Keep later
results on a separate evidence branch.

Create the envelope without opening Office:

```sh
node scripts/native-acceptance/dense-survey-contract.mjs create --suite /absolute/prepared-suite --expected-manifest-sha256 REVIEWED_MANIFEST_SHA256 --preparation-repository /absolute/frozen-preparation --worker-repository /absolute/frozen-pptx-package --consumer /absolute/installed-consumer --output /absolute/new-execution-envelope.json
```

The command prints the exact envelope SHA256. The supervisor reviews that file
and pins its digest when invoking the Windows PowerShell launcher:

```powershell
& /absolute/WindowsPowerShell/powershell.exe -NoProfile -NonInteractive -File scripts/native-acceptance/run-dense-survey-windows.ps1 -ExecutionEnvelope /absolute/new-execution-envelope.json -ExpectedEnvelopeSha256 REVIEWED_ENVELOPE_SHA256 -NodeExecutable /absolute/node.exe -OutputDirectory /absolute/new-attempt
```

Without RunOffice, only the bound Office-free process/worker harness checks and
snapshot validation run. Only the supervisor adds -RunOffice after source and
envelope review and the ordinary idle/ownership safety checks. The launcher
creates one fresh attempt, never retries, never evaluates a generic or worker
entrypoint during helper imports, and delegates all COM to the unchanged worker.

The output binder requires all50 ordered named shapes and their visible words
in original, no-op edited and reopened observations; the original/snapshot,
worker, saved archive and all three1280x720 PNG identities remain bound to that
attempt. Saved OOXML must retain the same source words/shape identities. These
are structural observations, not font, glyph, spacing, raster equivalence, actual
editing or native acceptance. Both nativeAcceptance and registryAcceptance stay
false pending supervisor review. The generic text binder remains unchanged.

The retained test PNG is a prepared renderer preview used only in explicitly
modeled Office-free output tests; it is not a native screenshot. No Office
execution follows from a passing pure contract. Intact seven-slide chart controls
and the retired six-slide table-helper replacement remain separate work.
