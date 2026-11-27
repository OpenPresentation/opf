# Release qualification corpus

One deck set that exercises every user-facing change of a release, run in every native app the release supports: PowerPoint for
Windows (COM), PowerPoint for Mac and Keynote (the Mac mini), and LibreOffice on Linux (experimental). `manifest.json` lists the decks
(new ones in `decks/`, existing examples by path), the PPTX variants each is exported in, the run tiers, and per feature the
slides, what to check and what each application is expected to make of it. `version` is the release whose export the content
describes. It is platform-neutral: every stream builds the same files from a fresh checkout and grades the same features.

## Build (any OS)

```sh
pnpm install --frozen-lockfile
pnpm build
node scripts/native-acceptance/qualification/build.mjs --out <dir>
```

`<dir>/pptx/<deck>[~<variant>].pptx` are the files to open, `<dir>/preview/<deck>/slide-<n>.png` OPF's own preview of each slide
(1280 x 720), and `<dir>/build.json` the checkout revision, the OPF version and every file's SHA-256 with the export's findings.
`--only <deck>[,<deck>]` rebuilds some decks and keeps the others' records. Nothing generated is committed.

## PowerPoint for Windows

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\native-acceptance\qualification\run-powerpoint-windows.ps1 -Out <dir> [-Only smartart] [-WaitMinutes 60]
node scripts/native-acceptance/qualification/evaluate.mjs --out <dir>
```

The runner uses COM only (no UI control). It starts only when no `POWERPNT.EXE` is running (another session may be measuring;
`-WaitMinutes` waits, checking once a minute), opens a copy of each file with alerts off (a file that needs repair fails to open
instead of prompting), exports every slide, probes every shape (SmartArt layout, nodes and a node edit; charts; tables with a cell
edit; connectors and their glue; text past its frame; shrink-on-overflow autofit; Header and Footer settings; a slide move that
renumbers live slide numbers), saves one untouched copy for the import round trip and closes without saving. It never quits
PowerPoint while another presentation is open and never kills Office.

`evaluate.mjs` grades the probe against the manifest and writes `<dir>/powerpoint/results.md` and `results.json`, plus a sheet per
slide (`sheets/<file>-<n>.png`: OPF's preview, PowerPoint's slide, their difference) for the visual review, and the import of each
saved copy (`roundtrip/`). The visual verdict is a reviewer's; the score only says where to look.

## Keynote, LibreOffice Impress and PowerPoint for Mac

Keynote and Impress runs belong to the native-testing program ([docs/programs/native-testing/README.md](../../../docs/programs/native-testing/README.md)):
one command per application and tier, one result format for every application, known differences as data
(`scripts/native-acceptance/known/<target>.json`), and a comparison of each run with the `targets` below. Until that command
lands, `scripts/libreoffice/run.mjs --qualification <dir>` grades the features in Impress (`docs/libreoffice.md`). PowerPoint for
Mac has a slot in the result format (`powerpoint-mac`) and no driver yet. `checks` in the manifest says what each check means;
`fallback` (SH-16's picture fallback for SmartArt) applies only where the app does not lay SmartArt out.

## Tiers

`tiers` says which decks a run takes; `qualification/tiers.mjs` reads it (`decksForTier(manifest, tier)` returns
`[{ deck, variants }]`, `sourcesForTier` the named sources):

| Tier | Decks | Variants |
| --- | --- | --- |
| `smoke` | the decks listed in `tiers.smoke.decks`, each with a `why`, plus the source `native-fragments` | `default`, unless an entry lists its `variants` |
| `release` | `"all"`: every deck of `decks` | `"all"`: every variant a deck lists |
| `full` | `"all"`, plus the sources `examples`, `gallery-layouts` and `languages` | `"all"` |

The smoke decks together show every object kind of the result format but `media` (OPF writes no video or audio), a hidden slide, a right-to-left slide,
a chart of each family Keynote reads differently, and every place of an open known difference graded `wrong` in OPF's own
file or importer; a test fails when a change to the tier or the features loses one of these. `sources` names what the
runner builds or collects beyond the corpus (the decks a changelog fragment's `native:` key names, every example, the gallery
layouts at three content sizes, the language decks); they are names the runner resolves, not file lists.

## Targets

A feature's `targets` says what each application is expected to make of the feature's object, keyed by the result format's
target names (`powerpoint`, `keynote`, `impress`; `powerpoint-mac` once it has a driver):

```json
"targets": {
  "powerpoint": { "outcome": "native", "kind": "diagram", "note": "Live SmartArt with one node per entry ..." },
  "keynote": { "outcome": "picture", "kind": "diagram", "known": ["kn-smartart-picture-alt"], "note": "Keynote has no SmartArt ..." },
  "impress": { "outcome": "changed", "kind": "diagram", "note": "LibreOffice does not lay SmartArt out ..." }
}
```

- `outcome`: `native`, `changed`, `picture` or `dropped`, the outcomes of the result format (`core/result/README.md`), or `n/a`
  when the object does not apply to that application (SmartArt's picture fallback in PowerPoint, a footer that Impress
  cannot be asked about headless, a feature with no exported object).
- `kind`: the object kind, one of the 15 of the result format, that the application's object is expected to be reported as.
  For live SmartArt it is `diagram` for every application: the round-trip step reports the exported diagram under its
  own kind, and the outcome says what it became (`native` in PowerPoint, `picture` in Keynote, `changed` in Impress).
- `known`: ids of records in `scripts/native-acceptance/known/<target>.json` that explain the outcome or a difference on the
  feature's slides. Records with a `scope` (missing fonts, alt text, OPF's tags dropped in the application's copy) apply to
  every deck and are named only where they explain the outcome.
- `note`: the evidence in one or two sentences.

**No entry means no expectation recorded**, never "expected native": a run reports what the application did and does not
compare that feature. The entries come from evidence only: Keynote's from the 0.36.0 round (opf#1466, its corpus reports and
the known records), Impress's from what `scripts/libreoffice/features.mjs` and `docs/libreoffice.md` state, PowerPoint's from
the object checks the Windows runner grades (smartArt, nativeChart, nativeTable, connectors, shapes, footer) and the changelog
lines that say what PowerPoint does. `expectationsFor(manifest, target)` in `tiers.mjs` lists them per file and slide
(`slide` null: every slide of the file).

## Format coverage

The `coverage-*.opf.json` decks in `decks/` use every key, enum value and `oneOf`/`anyOf` alternative of
`spec/schemas/opf.schema.json` and every default layout, one area per deck (text, lists, tables, charts, images, backgrounds,
shape presets and styles, overlays, diagrams, regions, composition, design, furniture, metadata, variables, template,
languages, catalogs, deliberate warnings, and one deck per slide size). `pnpm check:format-coverage`
(`scripts/check-format-coverage.mjs`) walks every JSON deck of the manifest along the schema and fails on a location no deck
uses, unless `scripts/format-coverage-allowlist.json` lists it with a reason; a schema addition therefore comes with a slide.
`packages/integration/test/format-coverage-decks.test.mjs` validates, draws and exports every coverage deck on each CI run.
`coverage-known-issues.opf.json` holds a valid case the engines cannot draw yet; it is not in the manifest.

`pnpm check:native-coverage` (`scripts/native-acceptance/core/coverage/`, NT-12) keeps the corpus small and complete: every
known record has a place the release tier runs, every schema location is on a corpus slide, every deck shows a unit no other
deck shows (or a known record or a feature names it), and each tier stays within its modeled time budget.
`pnpm report:native-coverage` prints the units per tier, the units on one slide only, the decks with no unit of their own and
the minutes per tier. A new deck or slide must add something; see "Coverage and budgets" in `docs/native-testing.md`.

## Maintain

Add a feature as a slide in `decks/` (or an example by path) and a `features` entry naming its change fragments, deck, variant,
slides, checks and expectations, and its `targets` where there is evidence for an application. Keep decks free of fonts or
assets that only one platform has; images go in `decks/assets/`. `node --test scripts/native-acceptance/qualification.test.mjs`
checks the manifest, the tiers and the targets (`pnpm check:native-acceptance` runs it).
