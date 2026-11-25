# The native result format

A native run opens OPF-exported `.pptx` files in one application (Keynote, PowerPoint, Impress) and records what the application did with each. Every driver writes the same files, so the compare, classify and report steps are shared. This folder holds the format: `native-result.schema.json`, `native-run.schema.json` (JSON Schema 2020-12, every property described), `result.mjs` (vocabulary, validators, helpers) and fixtures from the 0.36.0 Keynote round. `pnpm check:native` tests it.

## A run directory

A run writes a new directory outside the repository:

```
<out>/run.json                                 one per run (native-run.schema.json)
<out>/files/<fileId>/result.json               one per input file (native-result.schema.json)
<out>/files/<fileId>/slides/slide-001.png ...  the application's own picture of each slide, as it wrote it
<out>/files/<fileId>/resaved.pptx              the application's own PowerPoint copy
<out>/files/<fileId>/edits/<id>.pptx           optional: one copy per edit case (see "Edit cases")
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
| `verbs` | `open`, `render`, `probe`, `resave`, each `{ status, seconds?, message?, ... }`; all four are always present; optional `edits` beside `resave` |
| `slides` | every slide in file order, hidden slides included |
| `details` | optional: facts about the file as the application opened it (the fonts it reports for the presentation, the slide size); free-form, read by no shared code |

`verbs.open` adds `slideCount` and `warnings: { status, source, lines: [{ text, slides?, layouts? }] }`: the application's import warnings, word for word. `status` is `read` (an empty `lines` means it reported none), `partial` (the list was cut off) or `not-read` (it could not be read: Keynote shows its Warnings window only while it is in front). `source` is `application`, `screen` (text recognized in a capture), `log`, or null when nothing was captured. `verbs.render` may add `pixelSize`, `colorProfile` and `alpha`; `verbs.resave` adds `path` (`resaved.pptx`) and, after the round trip, `import: { status: imported / failed / not-run, error?, slideCount? }`.

`open: done` means the file opened without an error. Whether the application showed a repair prompt is known only to a driver that can see its dialogs (Keynote's, which captures every window); a driver that cannot (PowerPoint over COM without a window) says so in `verbs.open.message`, and its `done` does not establish "no repair prompt".

A slide is `{ index, hidden, layout, picture, notes, objects, details?, compare? }`: `index` is the position in the file (1 for the first, hidden slides counted), `layout` the application's own name for the slide's layout, `picture` `slides/slide-001.png` (numbered by index) or null when the application exported none, `notes` the presenter notes or null, `details` free-form facts about the slide (its placeholders as the application reports them), `compare` added by the compare step.

Pictures:

- **Any pixel size.** The compare step resizes OPF's preview and the application's picture to the preview's aspect at its working width, 1280 pixels (`DEFAULTS.width` in `core/compare/picture.mjs`; `--width` changes it), so Keynote's 960 x 540 and PowerPoint's 1920 x 1080 compare alike. `verbs.render.pixelSize` records what the application wrote.
- **Hidden slides.** Keynote and LibreOffice export no picture of a hidden slide (`picture` null); PowerPoint does, so `picture` may be set on a hidden slide. OPF previews visible slides only, and the compare step pairs preview k with the k-th visible slide whatever the hidden slides carry: a hidden slide's `compare` is `{ preview: null, score: null, note }`.
- **A render that fails for some slides** is `render: failed` with a `message` that names those slides; their `picture` is null and the other slides keep theirs.

`compare` is `{ preview, score, note?, aspectDiffers?, regions? }`, filled by `core/compare/compare-run.mjs`: `preview` is OPF's preview of the slide relative to the run directory (`preview/<deck>/slide-<n>.png`: the compare step copies the previews there, so a run directory stands alone), or null for a slide OPF has no preview of (a hidden slide); `score` is the share of pixels that differ, or null with a `note` that says why there was no pair; `aspectDiffers` is true when the two pictures' aspect ratios differ; `regions` are the largest differing areas, `{ box: [x0, y0, x1, y1] in slide fractions, cells, share }`.

The top level, `verbs`, each verb, the slides and the objects allow no other keys. `details` on the result, on a slide and on an object is the free-form place for target-specific facts no shared code reads.

## Edit cases

A driver may do more than resave: per edit case it makes one edit to the opened file in the application (retype a cell, refill a cell, change a link, add or delete a row, add a paragraph, move a shape), writes one PowerPoint copy with the application's own writer to `edits/<id>.pptx`, and never saves the opened file. `verbs.resave` keeps the unedited copy; the cases are an optional list beside it, `verbs.edits: [{ id, what, path, status, seconds?, message?, import?, outcomes? }]`:

- `id` is safe as a file name (`a-z 0-9 . _ -`, `retype-cell`); `what` says in one phrase what was edited; `path` is `edits/<id>.pptx` (`editPath(id)` in `result.mjs`; the validator checks it and that no id repeats); `status` is a verb status for the edit and the copy together.
- The round-trip step compares each copy with the exported file and imports it, as it does `resaved.pptx`: `import` has the shape of `verbs.resave.import`, and `outcomes` is `{ counts: { "<kind>.<outcome>": n }, objects: [{ slide, kind, name?, outcome, how? }] }`, the objects that are not native. They stay in the edit's entry and are never merged into `slides`, which describe the unedited file.

The list sits in `verbs`, next to `resave`, because an edit case is the resave verb run again after one edit, with the same statuses and the same import; a reader of the copies finds every copy there. It is not part of `slides`: each copy is a whole file.

## Objects: 15 kinds

An object is `{ kind, outcome, how?, name?, alt?, appClass?, box?, text?, fonts?, rows?, columns?, role?, on?, target?, objects?, details? }`. `box` is `[x, y, width, height]` in points in slide coordinates, origin at the slide's top left, for a group's members too (never relative to their group: PowerPoint reports a member's frame that way, and so does Keynote, checked on the 0.36.0 round's 330 recorded probes); `text` is plain text cut to 200 characters; `appClass` keeps the application's own word; `alt` is the object's alt text (DrawingML's description, PowerPoint's `AlternativeText`) as the application holds it, compared across applications (opf#1479).

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
| `diagram` | live SmartArt (`msoSmartArt`; `details.layout`, `details.layoutId`, `details.nodes`) | never from a probe | never from a probe |
| `media` | video or audio (`msoMedia`) | movie, audio clip | media object |

A driver that cannot tell a title from other text reports `text`; what the scripting interface does not expose is left to the round-trip step, which reads the application's PowerPoint copy.

`diagram` is live SmartArt only. Keynote and Impress have no SmartArt and report what they show (a picture, a group); the round-trip step gives the exported diagram its kind and the outcome `picture` (the application kept OPF's fallback picture) or `changed` (drawn as a group: "no longer a live diagram"), so "did it stay a live diagram" is the outcome of one object. In a copy that keeps it live, a different node count or layout is `changed`, and the copy's layout and node count go into `details`. OPF's own diagrams (Mermaid, DOT, PlantUML and the arrangements drawn as shapes, named "OPF diagram N") are groups of ordinary shapes everywhere and stay `group`. `media`: OPF writes no video or audio, so a media object comes from a file someone else made; Keynote removes media on import ("Unsupported media were removed").

`outcome` says what the exported object became: `native` (the same kind of editable object), `changed` (editable, but something changed; `how` says what in one phrase), `picture` (a picture of it), `dropped` (gone), or null when not determined. A probe alone cannot tell, so a driver writes null and the round-trip step fills it.

Alt text does not decide an outcome. The round-trip step records, per exported object, the description in the export and in the copy and whether it was kept, changed, lost or added, and fills `alt` from the copy where the probe could not read it (`details.altFrom: "copy"`); the outcome stays what the shape, text and geometry say, as in the 0.36.0 round's rules.

## Verb statuses

`done` (finished without an error; for `open`, see above on repair prompts), `failed` (the application returned an error), `timeout` (no answer in time), `alert` (an unexpected dialog or window appeared: captured, never clicked), `not-run` (not asked for, or could not start). A verb that did not run says `not-run`; it is never left out and never `done`. `emptyResult({...})` in `result.mjs` starts every verb at `not-run`.

A driver without screen access (PowerPoint over COM, whose window is never driven) cannot see a modal prompt such as a password or a linked file: the call does not return, so it reports `timeout` where a driver that sees the screen reports `alert`, and the files after it are `not-run`.

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

The Windows driver may instead be a command that writes the same files. The format and these verbs are agreed with the release supervisor on Windows ([opf#1468, comment of 2026-11-25](https://github.com/OpenPresentation/opf/issues/1468#issuecomment-7174529699)), with the additions of NT-01b (the `diagram` and `media` kinds, `alt`, `details` on the result and the slide, edit cases); the Windows command that writes a run directory is the release supervisor's and comes after the 0.37.0 format changes. `validateResult` and `validateRun` in `result.mjs` check the schema and what it cannot say (the id matches deck and variant, slides are in order); each returns `{ ok, errors }` with paths such as `/verbs: must have required property 'resave'`.

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
