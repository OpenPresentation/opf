# opf#87: native save and reopen of pictures and furniture (2026-10-05)

This covers two open rows of [opf#87](https://github.com/OpenPresentation/opf/issues/87) (status comment of 2026-10-02):

- **Open, save and reopen exported pictures and furniture.**
  - Furniture passes.
  - Pictures: PNG, JPEG and cropped pictures pass. The SVG picture keeps its SVG, but PowerPoint drops its PNG fallback
    on save, as it does for an SVG it inserts itself (see the control below).
- **Preserve furniture provenance through native edits.** Passes: `OPF_FURNITURE_V1` survives a native edit and save, and
  re-import recovers the edited footer.

**Owner decision (2026-10-05):** saving copies is allowed for these rows. Copies were saved with `SaveAs` into a fresh
attempt directory only, never over a source deck. The third open row of opf#87, native tab positions (0.0227 pt
against the 0.02 pt gate), needs no save. It is not covered here, and the gate is unchanged.

## Host and method

- Windows 11 with desktop PowerPoint 365, `Application.Version` 16.0 build 20430.
- The supervisor session ran Office. An agent built the decks, scripts and audit without opening Office.
- **Decks:** `pictures` (5 slides) and `furniture` (3 slides). Both were built with the published
  `@openpresentation/opf` 0.12.1, `@openpresentation/opf-pptx` 0.12.3 and `@openpresentation/opf-render` 0.12.0, with
  `strictAssets` ([decks.json](decks.json): sha256 values, registry integrity, expected content).
  - `pictures` has a PNG, a JPEG, a cropped picture and a native SVG picture (`asvg:svgBlip` over a PNG fallback).
  - Both decks have footer furniture: footer text, a `slidenum` field, a `datetime` field and a logo image, with
    `OPF_FURNITURE_V1` tags.
- **Two runs per deck,** each in its own `powershell.exe` with a 90 s deadline and no retries ([run.json](run.json)).
  Both runs open the source read-only (`Presentations.Open(path, -1, 0, 0)`), read it, `SaveAs` a copy (format 24) into
  the attempt directory, then reopen the copy read-only and read it again.
  - **control:** no edit before the save.
  - **edit:** two native edits in memory before the save. A body run on slide 1 changes from `ORIGINAL-RUN` to
    `EDITED-RUN`, and the footer text changes from "Footer original text" to "Footer edited natively" through the footer
    furniture shape.

  PowerPoint was never quit or killed.
- **Audit:** `audit.mjs` compares each saved copy with its source, both natively (the two reads) and in the package. It
  also re-imports the saved copy with `@openpresentation/opf-pptx` 0.12.3 `fromPptx`.
  - **FAIL rules:** pictures lost or changed (type, crop, geometry beyond 0.02 pt, alt text, SVG part); footer placeholders
    or fields lost; `OPF_FURNITURE_V1` tags lost or changed; re-import not recovering the footer (with the edited text),
    the logo or the pictures.
  - **Everything else:** recorded as "what PowerPoint rewrote".

## Results

| Deck | Run | Audit | Failures | Warnings |
| --- | --- | --- | --- | --- |
| furniture | control | PASS | 0 | 0 |
| furniture | edit | PASS | 0 | slide 1 PNG differs by 0.53 % (the edited footer text) |
| pictures | control | FAIL | slide 5 SVG picture: PNG fallback blip removed | 0 |
| pictures | edit | FAIL | slide 5 SVG picture: PNG fallback blip removed | slide 1 PNG differs by 0.53 % (the edited text) |

The full report is [compare.md](compare.md) and [compare.json](compare.json). The raw reads are
`<deck>-<run>.json`.

**Furniture and provenance (pass).** Native edit and save keep all of the following:

- the footer, date and slide-number placeholders and their fields, with HeadersFooters reading
  `footerText: "Footer edited natively"` after the edit;
- every `OPF_FURNITURE_V1` tag, renamed to `ppt/tags/tagN.xml` but with the same names and values;
- the logo.

`fromPptx` on the saved copy recovers the footer with the edited text. In the edit runs, the edit and control copies
differ only in `ppt/slides/slide1.xml` and in `docProps/core.xml`, which differs by save time.

**Pictures.** The PNG, JPEG and cropped pictures keep type, crop, geometry within 0.02 pt and alt text. The SVG picture on
slide 5 keeps its `asvg:svgBlip` and SVG part. But PowerPoint writes `<a:blip>` without `r:embed`, so the PNG fallback
part is gone from the saved copy.

- **Source:** `<a:blip r:embed="rId1">` (PNG) with `asvg:svgBlip r:embed="rIdOpfSvg1"`.
- **Saved:** `<a:blip>` with only `asvg:svgBlip r:embed="rId8"`.

**Control: PowerPoint does the same for its own SVG.** The run [svg-control-report.json](svg-control-report.json) took
four steps:

1. created a new presentation;
2. inserted the same SVG file natively (`Shapes.AddPicture`, read back as shape type 28, graphic);
3. saved one copy into a fresh directory;
4. closed it.

The saved slide has `<a:blip>` with only `asvg:svgBlip`, and `ppt/media` holds only the SVG. So the dropped fallback is
how PowerPoint 16.0 build 20430 saves an SVG picture, not something the opf export causes.

Consequence: after a PowerPoint save, an exported SVG picture has no raster fallback for applications that cannot draw
SVG. The audit's FAIL is kept as measured. Whether to accept this as PowerPoint's native form is a decision for review.

## What PowerPoint rewrites on save (both runs, both decks)

- **Parts renamed:** media become `ppt/media/imageN.*` and OPF tag parts become `ppt/tags/tagN.xml`. The content is the
  same; the relationship ids change.
- **`p:hf` on masters and layouts:** `<p:hf sldNum="1" hdr="0" ftr="1" dt="1"/>` becomes `<p:hf hdr="0"/>`. PowerPoint
  leaves out attributes that equal the schema default (`true`), so the meaning is the same.
- **Other parts:** `[Content_Types].xml`, `docProps`, relationships, notes parts and others are re-serialized.
  `compare.md` lists every added, removed and changed part.

## Files

- [compare.md](compare.md) and [compare.json](compare.json): the audit.
- [run.json](run.json): one record per run (child process id, exit code, timeout).
- `pictures-control.json`, `pictures-edit.json`, `furniture-control.json` and `furniture-edit.json`: the native reads of
  each source and its saved copy.
- [svg-control-report.json](svg-control-report.json): the native SVG control.
- [decks.json](decks.json): the set manifest.

The decks, the saved copies and the PNGs are not committed. Host paths are written as `<set>`.
