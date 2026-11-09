# Native PowerPoint acceptance suite

This is the versioned test suite for OPF's native PowerPoint acceptance. Check out
the reviewed core and PPTX revisions on the Windows machine, prepare the fixtures
there, and run the tracked supervisor command. Do not send generated decks or a
temporary ZIP between computers as the test distribution mechanism.

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
