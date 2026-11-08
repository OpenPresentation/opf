# Release qualification corpus

One deck set that exercises every user-facing change of a release, run in every native app the release supports: PowerPoint for
Windows (COM), PowerPoint for Mac and Keynote (the Mac mini), and LibreOffice on Linux (experimental). `manifest.json` lists the decks
(new ones in `decks/`, existing examples by path), the PPTX variants each is exported in, and per feature the slides and what to
check. It is platform-neutral: every stream builds the same files from a fresh checkout and grades the same features.

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

## PowerPoint for Mac, Keynote and LibreOffice

Build the corpus on that machine, open each file, and grade the manifest's features by hand where the app has no object model
(Keynote is opened read-only and never saved). `checks` in the manifest says what each check means; `fallback` (SH-16's picture
fallback for SmartArt) is graded only where the app does not lay SmartArt out. Record the results beside the Windows table in
`docs/programs/release-readiness/`.

## Maintain

Add a feature as a slide in `decks/` (or an example by path) and a `features` entry naming its change fragments, deck, variant,
slides, checks and expectations. Keep decks free of fonts or assets that only one platform has; images go in `decks/assets/`.
