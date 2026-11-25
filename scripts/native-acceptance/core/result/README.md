# The native result format

A native run opens OPF-exported `.pptx` files in one application (Keynote, PowerPoint, Impress) and records what the application did with each. Every driver writes the same files, so the compare, classify and report steps are shared. This folder holds the format: `native-result.schema.json`, `native-run.schema.json` (JSON Schema 2020-12, every property described), `result.mjs` (vocabulary, validators, helpers) and fixtures from the 0.36.0 Keynote round. `pnpm check:native` tests it.

## A run directory

A run writes a new directory outside the repository:

```
<out>/run.json                                 one per run (native-run.schema.json)
<out>/files/<fileId>/result.json               one per input file (native-result.schema.json)
<out>/files/<fileId>/slides/slide-001.png ...  the application's own picture of each slide, as it wrote it
<out>/files/<fileId>/resaved.pptx              the application's own PowerPoint copy
<out>/preview/<deck>/slide-<n>.png             OPF's preview of each visible slide (copied in by the compare step)
<out>/sheets/<fileId>/slide-001.jpg ...        labeled sheets of slides someone has to look at (core/compare/sheet.mjs)
```

`fileId` is `<deck>~<variant>`, lower case, characters `a-z 0-9 . _ -` plus the one `~`; the variant is `default` when the deck has one export only (`slide-links~default`, `layouts-lots~native`). `fileId(deck, variant)` in `result.mjs` builds it. Every path inside the files is relative with forward slashes; an absolute path fails validation.

## result.json

| Key | What it holds |
| --- | --- |
| `schemaVersion` | `1` |
| `target` | `keynote`, `powerpoint` (Windows), `impress`, `powerpoint-mac` |
| `application` | `{ name, version, build? }` read from the application, never hard-coded |
| `system` | `{ os: macOS / Windows / Linux, version }` |
| `fonts` | `installed`, or a named font profile (Impress: `opf`, `stock`) |
| `opf` | `{ version, commit? }`: the OPF that exported the file |
| `file` | `{ id, deck, variant, path, sha256, unchangedAfterRun }`: `path` is relative to the run's input root; `unchangedAfterRun` is true when the file's SHA-256 did not change (the application did not save over it), null when not checked |
| `started`, `finished` | UTC date-times |
| `verbs` | `open`, `render`, `probe`, `resave`, each `{ status, seconds?, message?, ... }`; all four are always present |
| `slides` | every slide in file order, hidden slides included |

`verbs.open` adds `slideCount` and `warnings: { status, source, lines: [{ text, slides?, layouts? }] }`: the application's import warnings, word for word. `status` is `read` (an empty `lines` means it reported none), `partial` (the list was cut off) or `not-read` (it could not be read: Keynote shows its Warnings window only while it is in front). `source` is `application`, `screen` (text recognized in a capture), `log`, or null when nothing was captured. `verbs.render` may add `pixelSize`, `colorProfile` and `alpha`; `verbs.resave` adds `path` (`resaved.pptx`) and, after the round trip, `import: { status: imported / failed / not-run, error?, slideCount? }`.

A slide is `{ index, hidden, layout, picture, notes, objects, compare? }`: `index` is the position in the file (1 for the first, hidden slides counted), `layout` the application's own name for the slide's layout, `picture` `slides/slide-001.png` (numbered by index) or null when the application exported none (a hidden slide), `notes` the presenter notes or null, `compare` added by the compare step.

`compare` is `{ preview, score, note?, aspectDiffers?, regions? }`, filled by `core/compare/compare-run.mjs`: `preview` is OPF's preview of the slide relative to the run directory (`preview/<deck>/slide-<n>.png`: the compare step copies the previews there, so a run directory stands alone), or null for a slide OPF has no preview of (a hidden slide); `score` is the share of pixels that differ, or null with a `note` that says why there was no pair; `aspectDiffers` is true when the two pictures' aspect ratios differ; `regions` are the largest differing areas, `{ box: [x0, y0, x1, y1] in slide fractions, cells, share }`.

The top level, `verbs`, each verb, the slides and the objects allow no other keys. An object's `details` is the one free-form object, for target-specific facts no shared code reads.

## Objects: 13 kinds

An object is `{ kind, outcome, how?, name?, appClass?, box?, text?, fonts?, rows?, columns?, role?, on?, target?, objects?, details? }`. `box` is `[x, y, width, height]` in points from the slide's top left; `text` is plain text cut to 200 characters; `appClass` keeps the application's own word.

| Kind | PowerPoint | Keynote | Impress |
| --- | --- | --- | --- |
| `title` | title placeholder | the slide's default title item | title presentation object |
| `body` | body placeholder | the slide's default body item | outline presentation object |
| `text` | text box, or a shape with text | text item, or a shape with text | text frame, or a shape with text |
| `list` | text with bullets or numbering | (not exposed to scripting) | outline text with bullets |
| `table` | table (`rows`, `columns`) | table | table |
| `chart` | chart | chart | chart object |
| `shape` | AutoShape without text | shape without text | custom shape without text |
| `connector` | line or connector | line | line or connector |
| `group` | group (members in `objects`) | group | group |
| `picture` | picture | image | graphic object |
| `link` | hyperlink (`on`: text, shape or cell; `target`: a URL or `slide:<index>`) | (not exposed) | hyperlink |
| `notes` | notes page text, one per slide that has notes | presenter notes | notes |
| `footer` | footer, slide number or date placeholder (`role`) | (not exposed) | footer, page number or date field |

A driver that cannot tell a title from other text reports `text`; what the scripting interface does not expose is left to the round-trip step, which reads the application's PowerPoint copy.

`outcome` says what the exported object became: `native` (the same kind of editable object), `changed` (editable, but something changed; `how` says what in one phrase), `picture` (a picture of it), `dropped` (gone), or null when not determined. A probe alone cannot tell, so a driver writes null and the round-trip step fills it.

## Verb statuses

`done` (finished; for `open`, the file opened with no repair prompt), `failed` (the application returned an error), `timeout` (no answer in time), `alert` (an unexpected dialog or window appeared: captured, never clicked), `not-run` (not asked for, or could not start). A verb that did not run says `not-run`; it is never left out and never `done`. `emptyResult({...})` in `result.mjs` starts every verb at `not-run`.

## run.json

`{ schemaVersion: 1, target, application, system, fonts, opf, tier, baseline, started, finished, check, files }`. `tier` is `smoke`, `release`, `full` or null; `baseline` the OPF version compared against, or null. `check` is `{ status: ready / refused, reasons: [] }`, what the driver's `check` said before the run (a refused run opens nothing). `files` has one `{ id, deck, variant, result: "files/<id>/result.json", open, slideCount }` per input in run order; `runFileEntry(result)` builds it.

## The driver contract

A driver is `apps/<target>/driver.mjs`, exporting async functions the shared runner calls; the runner writes the files.

- `check(ctx)`: can this machine run this target now? Never starts or quits the application. Refuses when the screen is locked, when the application is not running where the owner must start it, or when a document the run did not open is open.
- `open(ctx, file)`: open one file; record the status, the slide count and the import warnings; return a handle.
- `render(ctx, handle)`: the application's picture of every slide.
- `probe(ctx, handle)`: the object list of every slide.
- `resave(ctx, handle)`: the application's own PowerPoint copy.
- `close(ctx, handle)`: close without saving.

The Windows driver may instead be a command that writes the same files. `validateResult` and `validateRun` in `result.mjs` check the schema and what it cannot say (the id matches deck and variant, slides are in order); each returns `{ ok, errors }` with paths such as `/verbs: must have required property 'resave'`.

## Example

From `fixtures/keynote-0.36.0/slide-links~default/result.json` (Keynote 16.0; slide 4 is hidden, so it has no picture):

```json
"verbs": {
  "open": { "status": "done", "seconds": 1.67, "slideCount": 4, "warnings": { "status": "not-read", "source": null, "lines": [] } },
  "render": { "status": "done", "seconds": 0.74 },
  "probe": { "status": "done", "seconds": 1.85 },
  "resave": { "status": "done", "seconds": 0.83, "path": "resaved.pptx" }
},
"slides": [
  { "index": 2, "hidden": false, "layout": "Title Only", "picture": "slides/slide-002.png", "notes": null, "objects": [
    { "kind": "title", "outcome": null, "appClass": "shape", "box": [43, 43, 874, 49], "text": "Pricing", "fonts": ["Helvetica-Bold"] },
    { "kind": "table", "outcome": null, "appClass": "table", "box": [43, 225, 874, 156], "fonts": ["Helvetica-Bold", "Helvetica"], "rows": 3, "columns": 2 } ] },
  { "index": 4, "hidden": true, "layout": "Title Only", "picture": null, "notes": null, "objects": [ ... ] }
]
```

Each fixture folder also keeps the round's raw `run.json` and `probe.json` under `raw/`; `apps/keynote/normalize.mjs` turns them into `result.json` (`UPDATE_FIXTURES=1 pnpm check:native` rewrites the expected files).
