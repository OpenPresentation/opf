# bin: OPF toolchain for the Keynote round

`W=/Users/michael/opf-work/keynote-036`. Node v26.7.0, pnpm 10.33.2 (pnpm is only needed to rebuild a checkout).

| Wrapper | What it runs | Commit / version |
| --- | --- | --- |
| `bin/opf-036` | `src-036/packages/cli/dist/index.js` (tag v0.36.0) | 293d956a9933a75859970ff8e633d18ea1652d49, cli 0.36.0 |
| `bin/opf-main` | `src-main/packages/cli/dist/index.js` (origin/main) | 04f265afc34a70fbfee8d1a91cd2357cb56ea301, cli still prints 0.36.0 |
| `bin/opf-0351` | `npm-0351` (published 0.35.1 + PNG peers, all pinned) | cli 0.35.1 |

All three take the same arguments as `opf`. The `convert --help` text is identical in the three (`build/_help-036.txt`).

## Commands (replace `opf-036` by the version you need; a report JSON goes to stdout)

```sh
opf-036 validate deck.opf.json                         # findings + counts; exit 1 on errors, 2 on usage/IO
opf-036 convert deck.opf.json "out/slide-{n}.png"      # preview, 1280x720; {n} always numbers (padded when 10+ slides: slide-01.png)
opf-036 convert deck.opf.json out/slide-{n}.png --slides 2,5 --scale 2
opf-036 convert deck.opf.json default.pptx --force                        # mode "default"
opf-036 convert deck.opf.json native.pptx --force --body-text native      # mode "native"
opf-036 convert deck.opf.json static.pptx --force --slide-numbers static  # mode "static"
opf-036 convert back.pptx back.opf.json --force                           # import a .pptx back
opf-036 convert back.pptx back.opf.json --signals signals.json --force    # also per-shape layout and style signals
```

Existing output needs `--force`. Images resolve next to the input (run with the source in place) unless `--asset-dir`.
Hidden slides are not drawn to PNG unless `--include-hidden`; the PPTX keeps them as hidden slides.

## pptx flags that matter for Keynote

- `--charts <auto|native|picture>`: native charts or one picture per chart.
- `--diagrams <shapes|picture>`: native shapes/connectors for the families that passed (others stay pictures: `diagram-shapes-unavailable`), or one SVG picture each.
- `--smart-art <live|shapes>`: live SmartArt (default) or native shapes (`smartart-unavailable` says why).
- `--body-text <measured|native>`: measured (default) = one text box per wrapped line; native = whole paragraphs and placeholders (`native-body-fallback` for what stays measured).
- `--slide-numbers <static|live>`: live field (default; Keynote shows the digit alone) or fixed text.
- `--typefaces <selected|safe>`: the deck's families (default; `typeface-not-office-safe`) or Arial/Georgia/Courier New/Times New Roman (`typeface-replaced`).
- `--as <native|images>`: editable shapes (default) or one full-bleed PNG per slide (`--scale`).
- `--images <compatible|preserve>`, `--provenance <full|references-only|none>`, `--paginate`, `--keep-slides`, `--fonts <dir>`, `--asset-dir <dir>`, `--date <YYYY-MM-DD>`.

## build-deck

```sh
bin/build-deck [--force] [--suffix <text>] <036|0351|main> <family> <source-deck> [name] [-- <pptx flags>]
```

Writes `$W/build/<ver>/<family>/<name><suffix>/`: `preview/slide-{n}.png`, `default.pptx`, `native.pptx`, `static.pptx`, `build.json`.
Steps: validate (errors or a validate failure stop with exit 1; `build.json` is still written), preview, three exports.
Extra flags after `--` go to all three exports (recorded in `build.json`); give the output a `--suffix` such as `-safe` so it does not overwrite the plain build.
`native`/`static` are compared with `default` by the bytes of the unzipped slide, layout, master, chart parts (and their rels, plus diagrams/embeddings/media): when equal the duplicate file is deleted and `"sameAsDefault": true` (also `"same-as-default"`) is set; otherwise `differingParts` lists the parts.
`build.json` keys: `source`, `sourceSha256`, `slides`, `hiddenSlides`, `cli`, `utc`, `flags`, `validate{ok,errors,warnings,codes,findings}`, `preview{ok,files,codes}`, `exports.{default,native,static}{ok,sha256,codes,findings,counts,sameAsDefault,differingParts,file}`.
Finding codes are the rule ids (`pptx/native-body-fallback`, `pptx/smartart-unavailable`, `pptx/diagram-shapes-unavailable`, `pptx/typeface-not-office-safe`, `fonts/font-substituted`, ...). Exit 3 = output exists (use `--force`). The name defaults to the source's base name without `.opf.json/.opf.yaml/.yaml/.yml/.opf.md/.md`.

## build-family

```sh
bin/build-family [--force] [--suffix <text>] [-j 4] <ver> <family> <dir|list.txt|deck> [-- <pptx flags>]
```

A directory is searched for `*.opf.json|yaml|yml|md` and plain `.json/.yaml/.yml/.md` (not README*, `*schema.json`, `package.json`, and not in `assets`, `data`, `node_modules` or dot folders; those are listed under `skipped` in the manifest). A `.txt` is a list of deck paths. Duplicate base names become `<folder>-<name>`. Runs 4 build-decks at a time and writes `build/<ver>/<family>/manifest[suffix].json` (per deck: name, source, slides, hiddenSlides, validate, previewFiles, pptx files that exist, sameAsDefault, finding codes per mode, exportFailed) and `pptx-list[suffix].txt` (absolute path of every `.pptx` to open in Keynote). Exit 1 if any deck failed.
- Exit 3 from build-deck (output exists) counts as ok in build-family; manifest is rebuilt from the existing build.json files, so a re-run without --force only refreshes manifest and pptx-list.
