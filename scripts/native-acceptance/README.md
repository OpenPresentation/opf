# Native PowerPoint acceptance suite

This is the versioned test suite for OPF's native PowerPoint acceptance. Check out
the reviewed core and PPTX revisions on the Windows machine, prepare the fixtures
there, and run the tracked supervisor command. Do not send generated decks or a
temporary ZIP between computers as the test distribution mechanism.

## Prepare

Use the repository's coordinated installed-package qualification to create the
six-package consumer (`pack:ecosystem` followed by `test:packed-ecosystem`). For an
unpublished Gallery candidate, use the existing candidate-gallery workflow and
its explicit source authorization. Do not substitute registry packages for an
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
