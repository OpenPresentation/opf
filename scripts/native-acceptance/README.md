# Native PowerPoint acceptance suite

This is the versioned test suite for OPF's native PowerPoint acceptance. Check out
the reviewed core and PPTX revisions on the Windows machine, prepare the fixtures
there, and run the tracked supervisor command. Do not send generated decks or a
temporary ZIP between computers as the test distribution mechanism.

## Prepare

Use the repository's coordinated installed-package qualification to create the
six-package consumer (`pnpm pack:ecosystem --include-cli` followed by `pnpm test:packed-ecosystem`). For an
unpublished Gallery candidate, use the existing candidate-gallery workflow and
its explicit source authorization. The opt-in includes the CLI using the same explicit local preview versions and dependency adaptation as the four engines; the default pack command remains four packages. Gallery stays the genuine registry dependency. Original source versions and runtime identities remain recorded; these preview tarballs are not published artifacts. Do not substitute registry packages for an
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

## Replay retained native saves through published packages

`replay-retained-saves.mjs` compares the four retained manual saves (Change Layout,
New Slide custom/Text, Change Picture) with their accepted fixed-source imports.
It imports the saved bytes through direct PPTX import, core `open` and `convert`
with default and registered Gallery, and the installed CLI. It does not open
Office or generate a replacement native suite.

```sh
node scripts/native-acceptance/replay-retained-saves.mjs --consumer /path/to/registry-consumer --evidence docs/evidence/rr-20-windows-current-2026-10-14 --output /path/to/fresh-replay --release-plan /path/to/reviewed-release-plan.json --registry-receipt /path/to/verified-registry-authority.json
```

The release plan defaults to this checkout's `release-plan.json`; an explicit
plan must also be the supervisor's immutable approved plan. All six core,
renderer, PPTX, editor, CLI and Gallery versions must be exact stable versions,
with immutable verification refs. The consumer must declare those exact registry
versions, resolve one internal core/Gallery runtime, and have matching npm URL,
version and SHA-512 lock records. Source links, escaped/junction runtimes,
prereleases, missing packages and historical pre-0.20/Gallery-2 graphs refuse.
The driver installs nothing; use the maintained registry-consumer preparation
only after the supervisor verifies the complete graph.

`--registry-receipt` is required. It is the separately reviewed canonical
six-package verification authority, not a claim inferred from package-lock.json.
Its schema is `schemaVersion: 1`, `verifiedAt`, and `packages` containing each
package's name/version/gitHead, `dist.integrity`, repository/tag/workflow,
provenanceInvocation, and `canonicalVerification` (`ok: true`, passing named
checks, and logSha256). Each version/integrity must match the plan/consumer; each
package gitHead must match its plan ref, including `verificationRefs.gallery`. The authority also records nativeScope
(selectedCases, uiOperations, unexecutedCases, totalCases, globalAcceptance:false)
and siteDeployment:false. Those counts must match the retained evidence. Missing,
incomplete or failing authority refuses final replay before importing packages.
The driver records the plan and authority file hashes; canonical provenance and
signature verification remain a separate supervisor responsibility.

Every archive, accepted import, historical import and named-region binding is
checked against its retained index hash before processing. Inputs and original
runtime identities are never changed. A fresh output cannot overlap the consumer,
evidence, source checkout or authority. Socket/fetch refusal uses the installed
CLI regression's offline policy, applied before engines load and preloaded into
the CLI child. Attempts are logged and fail the replay even if caught by an engine.
This is Node-level denial, not a machine firewall or protection against arbitrary
untrusted native code; only the verified installed packages are executed.

The new reports retain literal package runtime and lock hashes, authority, tooling,
input hashes, diagnostics and API/CLI results. The custom slide must retain its
first-region binding and document custom-layout resolution. Change Picture must
differ from the historical direct import only by image block `fit: 'stretch'`,
keep exact embedded image bytes, cleared alt and pic500, and reexport full-source
without crop/offset/tile. Actual saved/reexport transforms are recorded, never
asserted equal. No geometry or pixel tolerance is widened.

Successful replay is bounded offline semantic evidence. Global nativeAcceptance
and registryAcceptance stay false: the original 17 selected native cases and four
UI operations remain separately identified, and all 41 unexecuted cases remain
unexecuted. Failed runtime attempts retain failure.json and partial outputs;
preflight refusals print an error without processing inputs or creating output.
Do not retry an existing output or relabel historical previews as published releases.
The focused `check:retained-native-replay` guard tests use synthetic manifests;
they establish preflight/isolation/offline refusal, not genuine registry replay.
